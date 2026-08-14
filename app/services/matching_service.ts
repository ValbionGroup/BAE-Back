/**
 * Pure Gale-Shapley (Hospital-Residents, member-proposing) stable matching for
 * one event, plus the pure scoring/ranking helpers around it.
 *
 * Nothing here touches the database. `EventsController.runMatching` builds
 * the plain inputs below from `member_responses`, `event_jobs`,
 * `member_job_preferences`, `job_eligible_members` and
 * `member_event_assigned_jobs`, then persists the output.
 */

/** Chronological order — préparation, soirée, nettoyage. This is the order
 *  used everywhere a period is iterated. */
export const JOB_PERIODS = ['before', 'during', 'after'] as const
export type JobPeriod = (typeof JOB_PERIODS)[number]

/**
 * Single source of truth for the default period a job gets when none is
 * specified — mirrors the SQL default on `jobs.type`
 * (`database/migrations/1773830925334_create_jobs_table.ts`, which names this
 * constant in a comment since a migration cannot import it). Used by
 * `JobsController.store` and `JobFactory` so the two never drift apart.
 */
export const DEFAULT_JOB_PERIOD: JobPeriod = 'during'

export interface RankedCandidate {
  memberId: number
  points: number
  historicalAttendanceCount: number
}

/**
 * Job-side ranking key: points normalized by how many events the member has
 * already worked. Without this, a member who attends every event would
 * always outrank one who rarely attends, even at the same points-per-event
 * rate — the denominator is floored at 1 so a member with no history yet is
 * ranked on raw points alone.
 */
export function rankingKey(points: number, historicalAttendanceCount: number): number {
  return points / Math.max(1, historicalAttendanceCount)
}

/**
 * Every job shares this same ranking of candidates (see module docstring),
 * so it is computed once by the caller rather than per job. Ties are broken
 * by ascending member id for a deterministic result.
 */
export function sortByJobRanking(candidates: RankedCandidate[]): number[] {
  return [...candidates]
    .sort((a, b) => {
      const keyDiff =
        rankingKey(b.points, b.historicalAttendanceCount) -
        rankingKey(a.points, a.historicalAttendanceCount)
      return keyDiff !== 0 ? keyDiff : a.memberId - b.memberId
    })
    .map((c) => c.memberId)
}

/**
 * The effective proposal list of a member for ONE period.
 *
 * The expressed ranking comes first, in its own order; any job of the
 * period absent from the ranking follows as a block, tied, broken by
 * ascending id. Without that block, leaving dishes unranked would mean
 * never being assigned to them: `stableMatch` only proposes what appears in
 * the list.
 */
export function buildEffectivePreferences(
  expressedRankByJobId: Readonly<Record<number, number>>,
  eligibleJobIds: readonly number[]
): number[] {
  const ranked: { jobId: number; rank: number }[] = []
  const unranked: number[] = []

  for (const jobId of eligibleJobIds) {
    const rank = expressedRankByJobId[jobId]
    if (rank !== undefined) {
      ranked.push({ jobId, rank })
    } else {
      unranked.push(jobId)
    }
  }

  ranked.sort((a, b) => a.rank - b.rank || a.jobId - b.jobId)
  unranked.sort((a, b) => a - b)

  return [...ranked.map((r) => r.jobId), ...unranked]
}

/** Crédit gagné en tenant un poste, par période. Préparation et nettoyage
 *  rapportent plus : ce sont structurellement les moments ingrats. */
export const PERIOD_CREDIT: Readonly<Record<JobPeriod, number>> = {
  before: 12,
  during: 8,
  after: 12,
}

/** Coût du rang obtenu : être bien servi dépense du crédit de priorité. */
export const RANK_COST_BASE = 12
export const RANK_COST_STEP = 2

/** `null` = poste non classé : il ne coûte rien, on ne l'avait pas demandé. */
export function rankCost(rankAchieved: number | null): number {
  if (rankAchieved === null) {
    return 0
  }
  return Math.max(0, RANK_COST_BASE - RANK_COST_STEP * (rankAchieved - 1))
}

/**
 * Le delta de crédit d'UNE affectation.
 *
 * Positif : le membre gagne de la priorité pour les prochaines soirées.
 * Négatif : il vient de la dépenser en obtenant un bon rang.
 */
export function computePointsDelta(period: JobPeriod, rankAchieved: number | null): number {
  return PERIOD_CREDIT[period] - rankCost(rankAchieved)
}

export interface CandidateInput {
  memberId: number
  /** Sortie de `buildEffectivePreferences` : postes de la période, le plus
   *  désiré d'abord, bloc ex æquo compris. */
  orderedJobIds: number[]
  /** Classement GLOBAL du membre, id de poste → rang 1-based, tel que
   *  stocké dans `member_job_preferences`. Absent = non classé. */
  expressedRankByJobId: Readonly<Record<number, number>>
}

export interface JobCapacityInput {
  jobId: number
  /** Capacity remaining after subtracting locked assignments. */
  remainingCount: number
}

export interface MatchResult {
  memberId: number
  jobId: number
  /** Rang global exprimé pour ce poste, `null` s'il n'était pas classé. */
  rankAchieved: number | null
}

/**
 * Member-proposing Gale-Shapley / Hospital-Residents algorithm.
 *
 * `jobRankingOrder` is the single common candidate ranking (best first, see
 * `sortByJobRanking`) used by every job to decide whom to hold when over
 * capacity.
 */
export function stableMatch(
  candidates: CandidateInput[],
  jobs: JobCapacityInput[],
  jobRankingOrder: number[]
): { matches: MatchResult[]; unmatchedMemberIds: number[] } {
  const rankIndex = new Map<number, number>(jobRankingOrder.map((memberId, i) => [memberId, i]))
  const capacity = new Map<number, number>(jobs.map((j) => [j.jobId, j.remainingCount]))
  const nextProposalIndex = new Map<number, number>(candidates.map((c) => [c.memberId, 0]))
  const preferences = new Map<number, number[]>(
    candidates.map((c) => [c.memberId, c.orderedJobIds])
  )
  const expressedRankByMember = new Map<number, Readonly<Record<number, number>>>(
    candidates.map((c) => [c.memberId, c.expressedRankByJobId])
  )
  const held = new Map<number, number[]>() // jobId -> memberIds currently held, worst last

  const freeQueue: number[] = candidates.map((c) => c.memberId)
  const unmatchedMemberIds = new Set<number>()

  const isBetter = (a: number, b: number) =>
    (rankIndex.get(a) ?? Infinity) < (rankIndex.get(b) ?? Infinity)

  while (freeQueue.length > 0) {
    const memberId = freeQueue.shift()!
    const index = nextProposalIndex.get(memberId)!
    const jobIds = preferences.get(memberId)!

    if (index >= jobIds.length) {
      unmatchedMemberIds.add(memberId)
      continue
    }

    const jobId = jobIds[index]
    nextProposalIndex.set(memberId, index + 1)

    const remaining = capacity.get(jobId)
    if (remaining === undefined || remaining <= 0) {
      // Job not offered at this event, or its capacity is already fully
      // consumed by locked assignments — reject outright, no holder to evict.
      freeQueue.push(memberId)
      continue
    }

    const holders = held.get(jobId) ?? []
    if (holders.length < remaining) {
      holders.push(memberId)
      holders.sort((a, b) => (rankIndex.get(a) ?? Infinity) - (rankIndex.get(b) ?? Infinity))
      held.set(jobId, holders)
      unmatchedMemberIds.delete(memberId)
      continue
    }

    const worst = holders[holders.length - 1]
    if (isBetter(memberId, worst)) {
      holders.pop()
      holders.push(memberId)
      holders.sort((a, b) => (rankIndex.get(a) ?? Infinity) - (rankIndex.get(b) ?? Infinity))
      held.set(jobId, holders)
      unmatchedMemberIds.delete(memberId)
      freeQueue.push(worst)
    } else {
      freeQueue.push(memberId)
    }
  }

  const matches: MatchResult[] = []
  for (const [jobId, memberIds] of held) {
    for (const memberId of memberIds) {
      const rankAchieved = expressedRankByMember.get(memberId)?.[jobId] ?? null
      matches.push({ memberId, jobId, rankAchieved })
    }
  }

  return { matches, unmatchedMemberIds: [...unmatchedMemberIds].sort((a, b) => a - b) }
}
