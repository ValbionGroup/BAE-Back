/**
 * Pure Gale-Shapley (Hospital-Residents, member-proposing) stable matching for
 * one event, plus the pure scoring/ranking helpers around it.
 *
 * Nothing here touches the database. `EventsController.runMatching` builds
 * the plain inputs below from `member_responses`, `event_jobs`,
 * `member_job_preferences`, `job_eligible_members` and
 * `member_event_assigned_jobs`, then persists the output.
 */

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
 * A rank-1 bonus decaying by a fixed step per rank achieved, floored at 0.
 * Tunable: BASE_BONUS/STEP are a starting point, not a fixed contract.
 */
export const BASE_BONUS = 10
export const STEP = 2

export function computePointsDelta(rankAchieved: number): number {
  return Math.max(0, BASE_BONUS - STEP * (rankAchieved - 1))
}

export function clampPoints(points: number): number {
  return Math.min(100, Math.max(0, points))
}

export interface CandidateInput {
  memberId: number
  /** Most-preferred first; already filtered to jobs offered at this event
   *  and jobs this member is eligible for. */
  orderedJobIds: number[]
}

export interface JobCapacityInput {
  jobId: number
  /** Capacity remaining after subtracting locked assignments. */
  remainingCount: number
}

export interface MatchResult {
  memberId: number
  jobId: number
  /** 1-based position of `jobId` within this member's own `orderedJobIds`. */
  rankAchieved: number
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
      const jobIds = preferences.get(memberId)!
      matches.push({ memberId, jobId, rankAchieved: jobIds.indexOf(jobId) + 1 })
    }
  }

  return { matches, unmatchedMemberIds: [...unmatchedMemberIds].sort((a, b) => a - b) }
}
