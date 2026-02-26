import { QuestionDifficulty, QuestionType } from '@prisma/client';

export type Plan = Record<QuestionType, Record<QuestionDifficulty, number>>;

export type Movement = {
  type: QuestionType;
  from: QuestionDifficulty;
  to: QuestionDifficulty;
  count: number;
};

export type Shortage = {
  type: QuestionType;
  difficulty: QuestionDifficulty;
  missing: number;
};

const ORDER: QuestionDifficulty[] = [
  QuestionDifficulty.easy,
  QuestionDifficulty.medium,
  QuestionDifficulty.hard,
];

function nearest(
  target: QuestionDifficulty,
  allowed: QuestionDifficulty[],
): QuestionDifficulty[] {
  const idx = ORDER.indexOf(target);

  return allowed
    .filter((d) => d !== target)
    .map((d) => ({
      d,
      dist: Math.abs(ORDER.indexOf(d) - idx),
    }))
    .sort((a, b) => a.dist - b.dist)
    .map((x) => x.d);
}

export function buildInitialPlan(params: {
  typeCounts: {
    MULTIPLE_CHOICE: number;
    TRUE_FALSE: number;
    OPEN: number;
    FILL_IN: number;
    MULTI_TRUE_FALSE: number;
  };
  difficulties: QuestionDifficulty[];
  splitEven: (total: number, parts: number) => number[];
}): Plan {
  const { typeCounts, difficulties, splitEven } = params;

  const plan: Plan = {
    [QuestionType.MULTIPLE_CHOICE]: {
      [QuestionDifficulty.easy]: 0,
      [QuestionDifficulty.medium]: 0,
      [QuestionDifficulty.hard]: 0,
    },
    [QuestionType.TRUE_FALSE]: {
      [QuestionDifficulty.easy]: 0,
      [QuestionDifficulty.medium]: 0,
      [QuestionDifficulty.hard]: 0,
    },
    [QuestionType.OPEN]: {
      [QuestionDifficulty.easy]: 0,
      [QuestionDifficulty.medium]: 0,
      [QuestionDifficulty.hard]: 0,
    },
    [QuestionType.FILL_IN]: {
      [QuestionDifficulty.easy]: 0,
      [QuestionDifficulty.medium]: 0,
      [QuestionDifficulty.hard]: 0,
    },
    [QuestionType.MULTI_TRUE_FALSE]: {
      [QuestionDifficulty.easy]: 0,
      [QuestionDifficulty.medium]: 0,
      [QuestionDifficulty.hard]: 0,
    },
  };

  const entries: Array<{ type: QuestionType; count: number }> = [
    { type: QuestionType.MULTIPLE_CHOICE, count: typeCounts.MULTIPLE_CHOICE },
    { type: QuestionType.TRUE_FALSE, count: typeCounts.TRUE_FALSE },
    { type: QuestionType.OPEN, count: typeCounts.OPEN },
    { type: QuestionType.FILL_IN, count: typeCounts.FILL_IN },
  ];

  for (const e of entries) {
    if (e.count <= 0) continue;

    const split = splitEven(e.count, difficulties.length);

    for (let i = 0; i < difficulties.length; i++) {
      plan[e.type][difficulties[i]] += split[i] ?? 0;
    }
  }

  return plan;
}

export function rebalancePlanWithinAllowed(params: {
  plan: Plan;
  stock: Plan;
  allowed: QuestionDifficulty[];
}): {
  finalPlan: Plan;
  movements: Movement[];
  shortage: Shortage[];
  isPossible: boolean;
} {
  const { plan, stock, allowed } = params;

  const finalPlan: Plan = JSON.parse(JSON.stringify(plan));
  const movements: Movement[] = [];
  const shortage: Shortage[] = [];

  const types = Object.keys(finalPlan) as QuestionType[];

  for (const type of types) {
    for (const d of allowed) {
      const wanted = finalPlan[type][d];
      const available = stock[type][d];

      if (wanted <= available) continue;

      let missing = wanted - available;
      finalPlan[type][d] = available;

      for (const to of nearest(d, allowed)) {
        if (missing <= 0) break;

        const toWanted = finalPlan[type][to];
        const toAvailable = stock[type][to];
        const room = Math.max(0, toAvailable - toWanted);

        if (room <= 0) continue;

        const moved = Math.min(room, missing);
        finalPlan[type][to] += moved;
        missing -= moved;

        movements.push({
          type,
          from: d,
          to,
          count: moved,
        });
      }

      if (missing > 0) {
        shortage.push({
          type,
          difficulty: d,
          missing,
        });
      }
    }
  }

  return {
    finalPlan,
    movements,
    shortage,
    isPossible: shortage.length === 0,
  };
}

export function planToBuckets(
  plan: Plan,
  allowed: QuestionDifficulty[],
): Array<{ type: QuestionType; difficulty: QuestionDifficulty; count: number }> {
  const buckets: Array<{
    type: QuestionType;
    difficulty: QuestionDifficulty;
    count: number;
  }> = [];

  const types = Object.keys(plan) as QuestionType[];

  for (const type of types) {
    for (const d of allowed) {
      const count = plan[type][d];
      if (count > 0) {
        buckets.push({ type, difficulty: d, count });
      }
    }
  }

  return buckets;
}
