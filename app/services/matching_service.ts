export const JOB_PERIODS = ['before', 'during', 'after'] as const
export type JobPeriod = (typeof JOB_PERIODS)[number]

export const DEFAULT_JOB_PERIOD: JobPeriod = 'during'

export type Rng = () => number
export type TieBreaker = (a: number, b: number) => number

export const compareByAscendingId: TieBreaker = (a, b) => a - b

// The tie-break draw must vary from one event to the next, so that tied members
// are not ordered the same way every evening, yet stay reproducible for a GIVEN
// event: re-running the matching of an event may not reshuffle who got what.
// `Math.random` gives the first property and not the second, hence a generator
// seeded on a value stable across runs (mulberry32).
export function seededRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The draw happens ONCE, here: calling `rng()` from inside the comparator would
// yield a non-transitive relation (a < b, b < c, c < a), which silently corrupts
// `sort` and breaks the stability invariant of `stableMatch`. For the same
// reason a run must share a single tie-breaker across all its steps. An id
// absent from the draw sorts after the drawn ones, unknowns among themselves by
// ascending id, so the comparator stays total.
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

export function rankingKey(points: number, historicalAttendanceCount: number): number {
  return points / Math.max(1, historicalAttendanceCount)
}

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

// Jobs of the period absent from the ranking follow as a tied block: without
// them, leaving dishes unranked would mean never being assigned to them, since
// `stableMatch` only proposes what appears in the list. The ties here are
// between JOBS, which a tie-breaker drawn over member ids cannot arbitrate — it
// then falls back to ascending job id.
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

export const PERIOD_CREDIT: Readonly<Record<JobPeriod, number>> = {
  before: 12,
  during: 8,
  after: 12,
}

export const RANK_COST_BASE = 12
export const RANK_COST_STEP = 2

export function rankCost(rankAchieved: number | null): number {
  if (rankAchieved === null) {
    return 0
  }
  return Math.max(0, RANK_COST_BASE - RANK_COST_STEP * (rankAchieved - 1))
}

export function computePointsDelta(period: JobPeriod, rankAchieved: number | null): number {
  return PERIOD_CREDIT[period] - rankCost(rankAchieved)
}

export interface CandidateInput {
  memberId: number
  orderedJobIds: number[]
  expressedRankByJobId: Readonly<Record<number, number>>
}

export interface JobCapacityInput {
  jobId: number
  remainingCount: number
}

export interface MatchResult {
  memberId: number
  jobId: number
  rankAchieved: number | null
}

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
  remainingCount: number
  eligibleMemberIds: ReadonlySet<number> | null
}

export interface BackfillCandidateInput {
  memberId: number
  expressedRankByJobId: Readonly<Record<number, number>>
}

export interface BackfillResult extends MatchResult {
  period: JobPeriod
}

// Catch-up pass: a stable matching is stable, not fair. It NEVER DISLODGES
// anyone and only consumes the capacity nobody took. Placement follows
// augmenting paths (Kuhn) rather than first-fit: when two members want the same
// seat and the first served had another option, first-fit would leave the second
// at zero for no reason.
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
