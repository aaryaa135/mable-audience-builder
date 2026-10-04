export type EventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_started"
  | "purchase";

export type Operator = "at_least" | "exactly";

export interface AudienceCondition {
  id: string;
  eventType: EventType;
  operator: Operator;
  count: string;
  withinDays: string;
}

export interface AudienceRuleRequest {
  name: string;
  asOf: string;
  conditions: {
    eventType: EventType;
    operator: Operator;
    count: number;
    withinDays: number;
  }[];
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

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: {
      path: string;
      message: string;
    }[];
    requestId?: string;
  };
}