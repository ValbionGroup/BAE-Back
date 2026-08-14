import { test } from '@japa/runner'
import {
  type Rng,
  backfillUnmatched,
  buildEffectivePreferences,
  computePointsDelta,
  makeTieBreaker,
  rankCost,
  rankingKey,
  seededRng,
  sortByJobRanking,
  stableMatch,
} from '#services/matching_service'

const lowDraw: Rng = () => 0
const highDraw: Rng = () => 0.999

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

  test('sortByJobRanking follows the drawn permutation on ties instead of the member ids', ({
    assert,
  }) => {
    const memberIds = [1, 2, 3, 4]
    const tied = memberIds.map((memberId) => ({
      memberId,
      points: 10,
      historicalAttendanceCount: 1,
    }))

    const firstDraw = sortByJobRanking(tied, makeTieBreaker(memberIds, lowDraw))
    const secondDraw = sortByJobRanking(tied, makeTieBreaker(memberIds, highDraw))

    assert.notDeepEqual(firstDraw, secondDraw)
    assert.sameMembers(firstDraw, memberIds)
    assert.sameMembers(secondDraw, memberIds)
  })

  // A seed that does not reach the draw would order tied members identically at
  // every event, which is exactly the bias the draw exists to remove — and no
  // reproducibility test can see it, since they all want a STABLE order.
  test('seededRng makes the drawn permutation depend on the seed', ({ assert }) => {
    const memberIds = [1, 2, 3, 4]
    const tied = memberIds.map((memberId) => ({
      memberId,
      points: 10,
      historicalAttendanceCount: 1,
    }))

    const orders = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        sortByJobRanking(tied, makeTieBreaker(memberIds, seededRng(seed))).join(',')
      )
    )

    assert.isAbove(orders.size, 1)
  })

  test('makeTieBreaker stays a total order once ids outside the draw are thrown in', ({
    assert,
  }) => {
    const tieBreak = makeTieBreaker([3, 1], lowDraw)

    const fromOneOrder = [9, 1, 7, 3].sort(tieBreak)
    const fromAnother = [7, 3, 9, 1].sort(tieBreak)

    assert.deepEqual(fromOneOrder, fromAnother)
    assert.deepEqual(fromOneOrder.slice(2), [7, 9], 'ids outside the draw come last, by id')
  })

  test('backfillUnmatched serves the before period first, whatever the job ids', ({ assert }) => {
    const backfilled = backfillUnmatched(
      [{ memberId: 7, expressedRankByJobId: { 30: 2 } }],
      [
        { jobId: 10, period: 'during', remainingCount: 1, eligibleMemberIds: null },
        { jobId: 20, period: 'after', remainingCount: 1, eligibleMemberIds: null },
        { jobId: 30, period: 'before', remainingCount: 1, eligibleMemberIds: null },
      ]
    )

    assert.deepEqual(backfilled, [{ memberId: 7, jobId: 30, period: 'before', rankAchieved: 2 }])
  })

  test('backfillUnmatched leaves a member at zero rather than overfilling a job', ({ assert }) => {
    const cases = [
      {
        label: 'full job',
        jobs: [
          { jobId: 10, period: 'before' as const, remainingCount: 0, eligibleMemberIds: null },
        ],
      },
      {
        label: 'job restricted to somebody else',
        jobs: [
          {
            jobId: 10,
            period: 'before' as const,
            remainingCount: 1,
            eligibleMemberIds: new Set([8]),
          },
        ],
      },
    ]

    for (const { label, jobs } of cases) {
      const backfilled = backfillUnmatched([{ memberId: 7, expressedRankByJobId: {} }], jobs)
      assert.deepEqual(backfilled, [], label)
    }
  })

  test('backfillUnmatched places as many members as capacity allows, not as many as first-fit', ({
    assert,
  }) => {
    const backfilled = backfillUnmatched(
      [
        { memberId: 1, expressedRankByJobId: {} },
        { memberId: 2, expressedRankByJobId: {} },
      ],
      [
        { jobId: 10, period: 'during', remainingCount: 1, eligibleMemberIds: null },
        { jobId: 20, period: 'during', remainingCount: 1, eligibleMemberIds: new Set([1]) },
      ]
    )

    assert.deepEqual(backfilled, [
      { memberId: 1, jobId: 20, period: 'during', rankAchieved: null },
      { memberId: 2, jobId: 10, period: 'during', rankAchieved: null },
    ])
  })

  test('buildEffectivePreferences places the expressed ranking before the ex-aequo block', ({
    assert,
  }) => {
    const result = buildEffectivePreferences({ 30: 2, 10: 1 }, [10, 20, 30])
    assert.deepEqual(result, [10, 30, 20])
  })

  test('buildEffectivePreferences sorts the ex-aequo block by ascending job id, deterministically', ({
    assert,
  }) => {
    const eligibleJobIds = [50, 10, 30, 20]
    const first = buildEffectivePreferences({}, eligibleJobIds)
    const second = buildEffectivePreferences({}, eligibleJobIds)
    assert.deepEqual(first, [10, 20, 30, 50])
    assert.deepEqual(second, [10, 20, 30, 50])
  })

  test('buildEffectivePreferences on an empty ranking returns all eligible jobs by ascending id', ({
    assert,
  }) => {
    const result = buildEffectivePreferences({}, [30, 10, 20])
    assert.deepEqual(result, [10, 20, 30])
  })

  test('buildEffectivePreferences ignores an expressed rank for a job outside the period', ({
    assert,
  }) => {
    const result = buildEffectivePreferences({ 99: 1, 10: 2 }, [10, 20])
    assert.deepEqual(result, [10, 20])
  })

  test('rankCost decays linearly from rank 1 and floors at 0; null costs nothing', ({ assert }) => {
    assert.equal(rankCost(1), 12)
    assert.equal(rankCost(2), 10)
    assert.equal(rankCost(6), 2)
    assert.equal(rankCost(7), 0)
    assert.equal(rankCost(20), 0)
    assert.equal(rankCost(null), 0)
  })

  test('computePointsDelta reproduces the D5 table in full', ({ assert }) => {
    assert.equal(computePointsDelta('during', 1), -4)
    assert.equal(computePointsDelta('before', 1), 0)
    assert.equal(computePointsDelta('after', 1), 0)

    assert.equal(computePointsDelta('during', 2), -2)
    assert.equal(computePointsDelta('before', 2), 2)
    assert.equal(computePointsDelta('after', 2), 2)

    assert.equal(computePointsDelta('during', 3), 0)
    assert.equal(computePointsDelta('before', 3), 4)
    assert.equal(computePointsDelta('after', 3), 4)

    assert.equal(computePointsDelta('during', 6), 6)
    assert.equal(computePointsDelta('before', 6), 10)
    assert.equal(computePointsDelta('after', 6), 10)

    assert.equal(computePointsDelta('during', 7), 8)
    assert.equal(computePointsDelta('before', 7), 12)
    assert.equal(computePointsDelta('after', 7), 12)

    assert.equal(computePointsDelta('during', null), 8)
    assert.equal(computePointsDelta('before', null), 12)
    assert.equal(computePointsDelta('after', null), 12)
  })

  test('stableMatch gives each candidate their top choice when capacity allows', ({ assert }) => {
    const { matches, unmatchedMemberIds } = stableMatch(
      [
        { memberId: 1, orderedJobIds: [10], expressedRankByJobId: { 10: 1 } },
        { memberId: 2, orderedJobIds: [20], expressedRankByJobId: { 20: 1 } },
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

  test('produces a stable matching via a genuine rejection chain', ({ assert }) => {
    const { matches, unmatchedMemberIds } = stableMatch(
      [
        { memberId: 1, orderedJobIds: [10, 20], expressedRankByJobId: { 10: 1, 20: 2 } },
        { memberId: 2, orderedJobIds: [10, 20], expressedRankByJobId: { 10: 1, 20: 2 } },
        { memberId: 3, orderedJobIds: [10, 20], expressedRankByJobId: { 10: 1, 20: 2 } },
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
      [{ memberId: 1, orderedJobIds: [], expressedRankByJobId: {} }],
      [{ jobId: 10, remainingCount: 1 }],
      [1]
    )
    assert.deepEqual(matches, [])
    assert.deepEqual(unmatchedMemberIds, [1])
  })

  test('stableMatch reports rankAchieved null for a job obtained outside the member ranking', ({
    assert,
  }) => {
    const { matches } = stableMatch(
      [{ memberId: 1, orderedJobIds: [10], expressedRankByJobId: {} }],
      [{ jobId: 10, remainingCount: 1 }],
      [1]
    )
    assert.sameDeepMembers(matches, [{ memberId: 1, jobId: 10, rankAchieved: null }])
  })

  test('stableMatch reports the global expressed rank, not the position in the period-restricted list', ({
    assert,
  }) => {
    const { matches } = stableMatch(
      [
        {
          memberId: 1,
          orderedJobIds: [30, 10],
          expressedRankByJobId: { 10: 2, 30: 5 },
        },
      ],
      [
        { jobId: 30, remainingCount: 1 },
        { jobId: 10, remainingCount: 1 },
      ],
      [1]
    )
    assert.sameDeepMembers(matches, [{ memberId: 1, jobId: 30, rankAchieved: 5 }])
  })
})
