import type {
  AudienceCondition,
  AudienceMember,
  ConditionEvidence,
} from "./types";

export interface EvaluatedUser {
  anonymousId: string;
  counts: number[];
}

export interface EvaluationContext {
  asOf: Date;
  conditions: AudienceCondition[];
}

function windowFor(condition: AudienceCondition, asOf: Date) {
  const end = asOf.getTime();
  const start = end - condition.withinDays * 24 * 60 * 60 * 1000;

  return {
    start: new Date(start),
    end: new Date(end),
  };
}

function conditionMatches(
  condition: AudienceCondition,
  observedCount: number,
): boolean {
  if (condition.operator === "at_least") {
    return observedCount >= condition.count;
  }

  return observedCount === condition.count;
}

export function selectMembers(
  users: EvaluatedUser[],
  context: EvaluationContext,
): AudienceMember[] {
  return users
    .filter((user) =>
      context.conditions.every((condition, index) =>
        conditionMatches(condition, user.counts[index]),
      ),
    )
    .map((user) => ({
      anonymousId: user.anonymousId,
      evidence: context.conditions.map(
        (condition, index): ConditionEvidence => {
          const window = windowFor(condition, context.asOf);

          return {
            conditionIndex: index,
            eventType: condition.eventType,
            operator: condition.operator,
            required: condition.count,
            observedCount: user.counts[index],
            windowStart: window.start.toISOString(),
            windowEnd: window.end.toISOString(),
          };
        },
      ),
    }))
    .sort((a, b) => a.anonymousId.localeCompare(b.anonymousId));
}