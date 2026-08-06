import { test } from '@japa/runner'
import {
  clampPoints,
  computePointsDelta,
  rankingKey,
  sortByJobRanking,
  stableMatch,
} from '#services/matching_service'

test.group('Matching algorithm (pure functions)', () => {
  test('rankingKey divides points by historical attendance, floored at 1', ({ assert }) => {
    assert.equal(rankingKey(20, 4), 5)
    assert.equal(rankingKey(20, 0), 20)
  })

  test('sortByJobRanking orders candidates by ranking key descending', ({ assert }) => {
    const order = sortByJobRanking([
      { memberId: 1, points: 20, historicalAttendanceCount: 4 }, // key 5
      { memberId: 2, points: 20, historicalAttendanceCount: 1 }, // key 20
      { memberId: 3, points: 8, historicalAttendanceCount: 2 }, // key 4
    ])
    assert.deepEqual(order, [2, 1, 3])
  })

  test('sortByJobRanking breaks ties by ascending member id', ({ assert }) => {
    const order = sortByJobRanking([
      { memberId: 5, points: 10, historicalAttendanceCount: 1 },
      { memberId: 2, points: 10, historicalAttendanceCount: 1 },
    ])
    assert.deepEqual(order, [2, 5])
  })

  test('computePointsDelta decays linearly from rank 1 and floors at 0', ({ assert }) => {
    assert.equal(computePointsDelta(1), 10)
    assert.equal(computePointsDelta(2), 8)
    assert.equal(computePointsDelta(3), 6)
    assert.equal(computePointsDelta(6), 0)
    assert.equal(computePointsDelta(20), 0)
  })

  test('clampPoints keeps points within 0 and 100', ({ assert }) => {
    assert.equal(clampPoints(105), 100)
    assert.equal(clampPoints(-5), 0)
    assert.equal(clampPoints(42), 42)
  })

  test('stableMatch gives each candidate their top choice when capacity allows', ({ assert }) => {
    const { matches, unmatchedMemberIds } = stableMatch(
      [
        { memberId: 1, orderedJobIds: [10] },
        { memberId: 2, orderedJobIds: [20] },
      ],
      [
        { jobId: 10, remainingCount: 1 },
        { jobId: 20, remainingCount: 1 },
      ],
      [1, 2]
    )
    assert.deepEqual(unmatchedMemberIds, [])
    assert.sameDeepMembers(matches, [
      { memberId: 1, jobId: 10, rankAchieved: 1 },
      { memberId: 2, jobId: 20, rankAchieved: 1 },
    ])
  })

  /**
   * Members 1, 2 and 3 all prefer job 10 first, job 20 second. Job 10 has
   * capacity 1 and ranks members in job-ranking order [1, 2, 3] (1 is best).
   * Member 2 proposes to job 10, gets provisionally held, then member 1
   * proposes and evicts member 2 (member 1 outranks member 2). Member 2 must
   * then propose to job 20 (capacity 1) and evict member 3, who is left
   * unmatched since there is no third job. This is the unique stable outcome
   * — a naive first-fit implementation would stop after the first eviction
   * and leave member 2 unmatched instead of chaining their rejection.
   */
  test('produces a stable matching via a genuine rejection chain', ({ assert }) => {
    const { matches, unmatchedMemberIds } = stableMatch(
      [
        { memberId: 1, orderedJobIds: [10, 20] },
        { memberId: 2, orderedJobIds: [10, 20] },
        { memberId: 3, orderedJobIds: [10, 20] },
      ],
      [
        { jobId: 10, remainingCount: 1 },
        { jobId: 20, remainingCount: 1 },
      ],
      [1, 2, 3]
    )
    assert.sameDeepMembers(matches, [
      { memberId: 1, jobId: 10, rankAchieved: 1 },
      { memberId: 2, jobId: 20, rankAchieved: 2 },
    ])
    assert.deepEqual(unmatchedMemberIds, [3])
  })

  test('leaves a candidate with an exhausted preference list unmatched', ({ assert }) => {
    const { matches, unmatchedMemberIds } = stableMatch(
      [{ memberId: 1, orderedJobIds: [] }],
      [{ jobId: 10, remainingCount: 1 }],
      [1]
    )
    assert.deepEqual(matches, [])
    assert.deepEqual(unmatchedMemberIds, [1])
  })
})
