import { z } from "zod";
import { EVENT_TYPES } from "./types";

const eventTypeSchema = z.enum(EVENT_TYPES);

const conditionSchema = z
  .object({
    eventType: eventTypeSchema,
    operator: z.enum(["at_least", "exactly"]),
    count: z.number().int().min(0).max(1000),
    withinDays: z.number().int().min(1).max(90),
  })
  .strict()
  .superRefine((condition, ctx) => {
    if (condition.operator === "at_least" && condition.count < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["count"],
        message: "at_least count must be at least 1.",
      });
    }
  });

export const audienceRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    asOf: z.string().datetime({ offset: true }),
    conditions: z.array(conditionSchema).min(1).max(10),
  })
  .strict();

export type ValidatedAudienceRule = z.infer<typeof audienceRuleSchema>;