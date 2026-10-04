import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../http/app";
import { seedDatabase } from "../db/seed";

const defaultRule = {
  name: "Product Viewers - No Purchase",
  asOf: "2026-09-29T00:00:00.000Z",
  conditions: [
    {
      eventType: "product_view",
      operator: "at_least",
      count: 2,
      withinDays: 7,
    },
    {
      eventType: "purchase",
      operator: "exactly",
      count: 0,
      withinDays: 7,
    },
  ],
};

beforeAll(() => {
  seedDatabase();
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("POST /v1/audiences/preview", () => {
  it("returns the expected default audience", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send(defaultRule);

    expect(response.status).toBe(200);
    expect(response.body.evaluatedUsers).toBe(12);
    expect(response.body.total).toBe(6);

    expect(
      response.body.members.map(
        (member: { anonymousId: string }) => member.anonymousId,
      ),
    ).toEqual([
      "anon_001",
      "anon_002",
      "anon_005",
      "anon_006",
      "anon_009",
      "anon_010",
    ]);
  });

  it("includes evidence for every condition", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send(defaultRule);

    const member = response.body.members[0];

    expect(member.evidence).toHaveLength(2);

    expect(member.evidence[0]).toMatchObject({
      conditionIndex: 0,
      eventType: "product_view",
      operator: "at_least",
      required: 2,
      observedCount: 2,
    });

    expect(member.evidence[1]).toMatchObject({
      conditionIndex: 1,
      eventType: "purchase",
      operator: "exactly",
      required: 0,
      observedCount: 0,
    });
  });

  it("applies AND semantics", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        conditions: [
          {
            eventType: "product_view",
            operator: "at_least",
            count: 2,
            withinDays: 7,
          },
          {
            eventType: "purchase",
            operator: "exactly",
            count: 0,
            withinDays: 7,
          },
        ],
      });

    expect(response.body.total).toBe(6);
  });

  it("rejects at_least 0", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        conditions: [
          {
            eventType: "product_view",
            operator: "at_least",
            count: 0,
            withinDays: 7,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects an unknown event type", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        conditions: [
          {
            eventType: "DROP TABLE events",
            operator: "at_least",
            count: 1,
            withinDays: 7,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects an empty conditions array", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        conditions: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects more than 10 conditions", async () => {
    const conditions = Array.from({ length: 11 }, () => ({
      eventType: "product_view",
      operator: "at_least",
      count: 1,
      withinDays: 7,
    }));

    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        conditions,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns JSON for an unknown route", async () => {
    const response = await request(app).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .set("Content-Type", "application/json")
      .send("{ invalid json }")
      .buffer(true);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("MALFORMED_JSON");
    expect(response.body.error.message).toBe("Request body contains invalid JSON.");
    expect(response.body.error.requestId).toBeDefined();
  });

  it("rejects unsupported Content-Type with 415", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .set("Content-Type", "text/plain")
      .send("some text");

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(response.body.error.message).toBe("Content-Type must be application/json.");
    expect(response.body.error.requestId).toBeDefined();
  });

  it("rejects oversized body with 413", async () => {
    const largeBody = {
      name: "x".repeat(200000),
      asOf: "2026-09-29T00:00:00.000Z",
      conditions: [{ eventType: "product_view", operator: "at_least", count: 1, withinDays: 7 }],
    };

    const response = await request(app)
      .post("/v1/audiences/preview")
      .set("Content-Type", "application/json")
      .send(largeBody);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(response.body.error.message).toBe("Request body exceeds the maximum allowed size of 100 KB.");
    expect(response.body.error.requestId).toBeDefined();
  });

  // Validation edge cases
  it("rejects invalid asOf datetime format", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        asOf: "not-a-datetime",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.details.some((d: { path: string }) => d.path === "asOf")).toBe(true);
  });

  it("rejects name longer than 100 characters", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        name: "x".repeat(101),
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.details.some((d: { path: string }) => d.path === "name")).toBe(true);
  });

  it("rejects empty name", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        name: "",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.details.some((d: { path: string }) => d.path === "name")).toBe(true);
  });

  it("rejects count greater than 1000", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        conditions: [
          {
            eventType: "product_view",
            operator: "at_least",
            count: 1001,
            withinDays: 7,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.details.some((d: { path: string }) => d.path.includes("count"))).toBe(true);
  });

  it("rejects negative count", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        conditions: [
          {
            eventType: "product_view",
            operator: "at_least",
            count: -1,
            withinDays: 7,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.details.some((d: { path: string }) => d.path.includes("count"))).toBe(true);
  });

  it("rejects withinDays greater than 90", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        conditions: [
          {
            eventType: "product_view",
            operator: "at_least",
            count: 1,
            withinDays: 91,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.details.some((d: { path: string }) => d.path.includes("withinDays"))).toBe(true);
  });

  it("rejects negative withinDays", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        conditions: [
          {
            eventType: "product_view",
            operator: "at_least",
            count: 1,
            withinDays: -1,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.details.some((d: { path: string }) => d.path.includes("withinDays"))).toBe(true);
  });

  it("rejects unknown/extra request fields", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        ...defaultRule,
        extraField: "not allowed",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    // Zod strict mode reports unrecognized keys with empty path
    expect(response.body.error.details.some((d: { path: string; message: string }) => d.message.includes("extraField"))).toBe(true);
  });

  // Functional behavior tests
  it("exactly 0 purchase condition includes users with zero purchases in window", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        name: "Zero Purchases Test",
        asOf: "2026-09-29T00:00:00.000Z",
        conditions: [
          {
            eventType: "purchase",
            operator: "exactly",
            count: 0,
            withinDays: 7,
          },
        ],
      });

    expect(response.status).toBe(200);
    // Users with zero purchases in the 7-day window should be included
    // From seed: anon_001, 002, 003, 005, 006, 007, 008, 010, 011, 012, 013 have no purchase in window
    // anon_004 has purchase in window, anon_009 has purchase at asOf (excluded)
    const memberIds = response.body.members.map((m: { anonymousId: string }) => m.anonymousId);
    expect(memberIds).toContain("anon_001");
    expect(memberIds).toContain("anon_003");
    expect(memberIds).toContain("anon_012");
    expect(memberIds).toContain("anon_013"); // User with no events at all
    expect(memberIds).not.toContain("anon_004"); // Has purchase in window
  });

  it("user with no events is still evaluated for exactly 0 condition", async () => {
    const response = await request(app)
      .post("/v1/audiences/preview")
      .send({
        name: "No Events Test",
        asOf: "2026-09-29T00:00:00.000Z",
        conditions: [
          {
            eventType: "purchase",
            operator: "exactly",
            count: 0,
            withinDays: 7,
          },
        ],
      });

    expect(response.status).toBe(200);
    // anon_013 has no events at all but should still be evaluated
    // and match the "exactly 0 purchases" condition
    const memberIds = response.body.members.map((m: { anonymousId: string }) => m.anonymousId);
    expect(memberIds).toContain("anon_013");
    // Evidence should show observedCount: 0
    const member = response.body.members.find((m: { anonymousId: string }) => m.anonymousId === "anon_013");
    expect(member).toBeDefined();
    expect(member.evidence[0].observedCount).toBe(0);
    expect(member.evidence[0].required).toBe(0);
  });
});