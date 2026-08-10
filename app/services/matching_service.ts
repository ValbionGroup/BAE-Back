/**
 * Pure Gale-Shapley (Hospital-Residents, member-proposing) stable matching for
 * one event, plus the pure scoring/ranking helpers around it.
 *
 * Nothing here touches the database. `EventsController.runMatching` builds
 * the plain inputs below from `member_responses`, `event_jobs`,
 * `member_job_preferences`, `job_eligible_members` and
 * `member_event_assigned_jobs`, then persists the output.
 */

/** Chronological order — setup, evening, cleanup. This is the order used
 *  everywhere a period is iterated. */
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

export type Rng = () => number
export type TieBreaker = (a: number, b: number) => number

export const compareByAscendingId: TieBreaker = (a, b) => a - b

/**
 * Draws ONE permutation of the ids and returns the comparator that reads it.
 *
 * The shuffle happens once, here, because calling `rng()` from inside the
 * comparator would yield a non-transitive relation (a < b, b < c, c < a): that
 * silently corrupts `Array.prototype.sort` and breaks `stableMatch`, whose
 * stability invariant assumes totally ordered preferences. For the same reason
 * a run must share a single tie-breaker across all its steps, or two steps
 * would rank the same tied members differently.
 *
 * An id absent from the draw sorts after the drawn ones, unknowns among
 * themselves by ascending id, so the comparator stays total on ids it has
 * never seen.
 */
export function makeTieBreaker(ids: Iterable<number>, rng: Rng = Math.random): TieBreaker {
  const shuffled = [...ids]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)))
    const swap = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = swap
  }

  const positionById = new Map<number, number>(shuffled.map((id, index) => [id, index]))

  return (a, b) => {
    const positionA = positionById.get(a)
    const positionB = positionById.get(b)
    if (positionA === undefined || positionB === undefined) {
      if (positionA === undefined && positionB === undefined) {
        return compareByAscendingId(a, b)
      }
      return positionA === undefined ? 1 : -1
    }
    return positionA - positionB
  }
}

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
 * so it is computed once by the caller rather than per job.
 *
 * `stableMatch` re-reads this order to arbitrate evictions, so a drawn
 * `tieBreak` passed here is enough to randomize the whole matching on ties.
 */
export function sortByJobRanking(
  candidates: RankedCandidate[],
  tieBreak: TieBreaker = compareByAscendingId
): number[] {
  return [...candidates]
    .sort((a, b) => {
      const keyDiff =
        rankingKey(b.points, b.historicalAttendanceCount) -
        rankingKey(a.points, a.historicalAttendanceCount)
      return keyDiff !== 0 ? keyDiff : tieBreak(a.memberId, b.memberId)
    })
    .map((c) => c.memberId)
}

/**
 * The effective proposal list of a member for ONE period.
 *
 * The expressed ranking comes first, in its own order; any job of the
 * period absent from the ranking follows as a block, tied, broken by
 * `tieBreak`. Without that block, leaving dishes unranked would mean
 * never being assigned to them: `stableMatch` only proposes what appears in
 * the list.
 *
 * The ties here are between JOBS, not members: a tie-breaker drawn over member
 * ids has nothing to arbitrate and falls back to ascending job id.
 */
export function buildEffectivePreferences(
  expressedRankByJobId: Readonly<Record<number, number>>,
  eligibleJobIds: readonly number[],
  tieBreak: TieBreaker = compareByAscendingId
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

  ranked.sort((a, b) => a.rank - b.rank || tieBreak(a.jobId, b.jobId))
  unranked.sort(tieBreak)

  return [...ranked.map((r) => r.jobId), ...unranked]
}

/** Credit earned by holding a job, per period. Setup and cleanup pay more:
 *  they are structurally the thankless slots. */
export const PERIOD_CREDIT: Readonly<Record<JobPeriod, number>> = {
  before: 8,
  during: 5,
  after: 8,
}

/** Cost of the rank obtained: being well served spends priority credit. */
export const RANK_COST_BASE = 12
export const RANK_COST_STEP = 2

/** `null` = unranked job: it costs nothing, nobody asked for it. */
export function rankCost(rankAchieved: number | null): number {
  if (rankAchieved === null) {
    return 0
  }
  return Math.max(0, RANK_COST_BASE - RANK_COST_STEP * (rankAchieved - 1))
}

/**
 * The credit delta of ONE assignment.
 *
 * Positive: the member gains priority for the coming evenings.
 * Negative: they just spent it by obtaining a good rank.
 */
export function computePointsDelta(period: JobPeriod, rankAchieved: number | null): number {
  return PERIOD_CREDIT[period] - rankCost(rankAchieved)
}

export interface CandidateInput {
  memberId: number
  /** Output of `buildEffectivePreferences`: jobs of the period, most wanted
   *  first, ex-aequo block included. */
  orderedJobIds: number[]
  /** The member's GLOBAL ranking, job id → 1-based rank, as stored in
   *  `member_job_preferences`. Absent = unranked. */
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
  /** Global expressed rank for this job, `null` if it was unranked. */
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

export interface BackfillJobInput {
  jobId: number
  period: JobPeriod
  /** Capacity LEFT: the job's capacity minus the locks, minus what the
   *  `stableMatch` passes just placed. */
  remainingCount: number
  /** `null` = unrestricted job, open to everyone — same convention as
   *  `job_eligible_members`, where no row means no filter. */
  eligibleMemberIds: ReadonlySet<number> | null
}

export interface BackfillCandidateInput {
  memberId: number
  expressedRankByJobId: Readonly<Record<number, number>>
}

export interface BackfillResult extends MatchResult {
  period: JobPeriod
}

/**
 * Catch-up pass: give a job to the members who walk out of the three
 * `stableMatch` passes empty-handed. A stable matching is stable, not fair, so
 * the correction lives beside the algorithm rather than inside it.
 *
 * NEVER DISLODGES an already placed member — lock or stable match alike. It
 * only consumes `remainingCount`, the capacity nobody took; full jobs are
 * invisible to it. A member whose every eligible job is full therefore stays
 * at zero, knowingly.
 *
 * One job per member, `before` first (highest credit, most thankless slot),
 * then `during`, then `after`.
 *
 * Placement follows augmenting paths (Kuhn) rather than first-fit: when two
 * members want the same seat and the first served had another option,
 * first-fit would leave the second at zero for no reason. An augmenting path
 * may therefore move a member from one job to another, but only among the
 * assignments this pass created, and it never places fewer members.
 *
 * The order of passage comes from `tieBreak` alone, not from the points
 * ranking: everyone here holds zero jobs, and the only question left — which
 * of two people takes the last seat — is settled by lot.
 */
export function backfillUnmatched(
  candidates: BackfillCandidateInput[],
  jobs: BackfillJobInput[],
  tieBreak: TieBreaker = compareByAscendingId
): BackfillResult[] {
  const periodOrder = new Map<JobPeriod, number>(
    JOB_PERIODS.map((period, index) => [period, index])
  )
  const openJobs = jobs.filter((job) => job.remainingCount > 0)
  const jobById = new Map<number, BackfillJobInput>(openJobs.map((job) => [job.jobId, job]))

  const orderedCandidates = [...candidates].sort((a, b) => tieBreak(a.memberId, b.memberId))
  const reachableJobIdsByMember = new Map<number, number[]>(
    orderedCandidates.map((candidate) => [
      candidate.memberId,
      openJobs
        .filter((job) => !job.eligibleMemberIds || job.eligibleMemberIds.has(candidate.memberId))
        .sort(
          (a, b) =>
            periodOrder.get(a.period)! - periodOrder.get(b.period)! ||
            compareByAscendingId(a.jobId, b.jobId)
        )
        .map((job) => job.jobId),
    ])
  )

  const holdersByJob = new Map<number, number[]>(openJobs.map((job) => [job.jobId, []]))
  const jobByMember = new Map<number, number>()

  const place = (memberId: number, jobId: number) => {
    const previousJobId = jobByMember.get(memberId)
    if (previousJobId !== undefined) {
      const previousHolders = holdersByJob.get(previousJobId)!
      previousHolders.splice(previousHolders.indexOf(memberId), 1)
    }
    holdersByJob.get(jobId)!.push(memberId)
    jobByMember.set(memberId, jobId)
  }

  // `visitedJobIds` spans the whole augmenting path, not a single member: it
  // is what terminates the recursion, an already tried job being unavailable
  // further down the chain.
  const tryPlace = (memberId: number, visitedJobIds: Set<number>): boolean => {
    for (const jobId of reachableJobIdsByMember.get(memberId) ?? []) {
      if (visitedJobIds.has(jobId)) {
        continue
      }
      visitedJobIds.add(jobId)

      const holders = holdersByJob.get(jobId)!
      if (holders.length < jobById.get(jobId)!.remainingCount) {
        place(memberId, jobId)
        return true
      }

      for (const holder of [...holders]) {
        if (tryPlace(holder, visitedJobIds)) {
          place(memberId, jobId)
          return true
        }
      }
    }
    return false
  }

  for (const candidate of orderedCandidates) {
    tryPlace(candidate.memberId, new Set<number>())
  }

  const expressedRankByMember = new Map<number, Readonly<Record<number, number>>>(
    candidates.map((c) => [c.memberId, c.expressedRankByJobId])
  )

  return [...jobByMember]
    .sort(([a], [b]) => compareByAscendingId(a, b))
    .map(([memberId, jobId]) => ({
      memberId,
      jobId,
      period: jobById.get(jobId)!.period,
      rankAchieved: expressedRankByMember.get(memberId)?.[jobId] ?? null,
    }))
}
