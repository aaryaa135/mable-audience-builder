export const EVENT_TYPES = [
  "page_view",
  "product_view",
  "add_to_cart",
  "checkout_started",
  "purchase",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type Operator = "at_least" | "exactly";

export interface AudienceCondition {
  eventType: EventType;
  operator: Operator;
  count: number;
  withinDays: number;
}

export interface AudienceRule {
  name: string;
  asOf: string;
  conditions: AudienceCondition[];
}

export interface ConditionEvidence {
  conditionIndex: number;
  eventType: EventType;
  operator: Operator;
  required: number;
  observedCount: number;
  windowStart: string;
  windowEnd: string;
}

export interface AudienceMember {
  anonymousId: string;
  evidence: ConditionEvidence[];
}

export interface AudiencePreviewResponse {
  name: string;
  asOf: string;
  evaluatedUsers: number;
  total: number;
  members: AudienceMember[];
}