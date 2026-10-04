import { db, initializeDatabase } from "./database";

const AS_OF = "2026-09-29T00:00:00.000Z";
const WINDOW_START = "2026-09-22T00:00:00.000Z";

function timestamp(value: string): number {
  return Date.parse(value);
}

function addUser(
  anonymousId: string,
  firstSeenAt: string,
): void {
  db.prepare(`
    INSERT INTO anonymous_users (anonymous_id, first_seen_at)
    VALUES (?, ?)
  `).run(anonymousId, timestamp(firstSeenAt));
}

function addEvent(
  anonymousId: string,
  eventType:
    | "page_view"
    | "product_view"
    | "add_to_cart"
    | "checkout_started"
    | "purchase",
  occurredAt: string,
): void {
  db.prepare(`
    INSERT INTO events (anonymous_id, event_type, occurred_at)
    VALUES (?, ?, ?)
  `).run(anonymousId, eventType, timestamp(occurredAt));
}

export function seedDatabase(): void {
  initializeDatabase();

  db.exec(`
    DELETE FROM events;
    DELETE FROM anonymous_users;
  `);

  // User universe
  addUser("anon_001", "2026-09-01T00:00:00.000Z");
  addUser("anon_002", "2026-09-01T00:00:00.000Z");
  addUser("anon_003", "2026-09-01T00:00:00.000Z");
  addUser("anon_004", "2026-09-01T00:00:00.000Z");
  addUser("anon_005", "2026-09-01T00:00:00.000Z");
  addUser("anon_006", "2026-09-01T00:00:00.000Z");
  addUser("anon_007", "2026-09-01T00:00:00.000Z");
  addUser("anon_008", "2026-09-01T00:00:00.000Z");
  addUser("anon_009", "2026-09-01T00:00:00.000Z");
  addUser("anon_010", "2026-09-01T00:00:00.000Z");
  addUser("anon_011", "2026-09-30T00:00:00.000Z");
  addUser("anon_012", "2026-09-01T00:00:00.000Z");
  addUser("anon_013", "2026-09-01T00:00:00.000Z");

  // anon_001: positive — exactly 2 product views
  addEvent("anon_001", "product_view", "2026-09-24T10:00:00.000Z");
  addEvent("anon_001", "product_view", "2026-09-27T10:00:00.000Z");

  // anon_002: positive — one view exactly at window start
  addEvent("anon_002", "product_view", WINDOW_START);
  addEvent("anon_002", "product_view", "2026-09-25T10:00:00.000Z");

  // anon_003: negative — only one product view
  addEvent("anon_003", "product_view", "2026-09-25T10:00:00.000Z");

  // anon_004: negative — enough views, but purchased
  addEvent("anon_004", "product_view", "2026-09-23T10:00:00.000Z");
  addEvent("anon_004", "product_view", "2026-09-24T10:00:00.000Z");
  addEvent("anon_004", "product_view", "2026-09-25T10:00:00.000Z");
  addEvent("anon_004", "product_view", "2026-09-26T10:00:00.000Z");
  addEvent("anon_004", "purchase", "2026-09-27T10:00:00.000Z");

  // anon_005: positive — purchase is outside the 7-day window
  addEvent("anon_005", "purchase", "2026-09-21T10:00:00.000Z");
  addEvent("anon_005", "product_view", "2026-09-23T10:00:00.000Z");
  addEvent("anon_005", "product_view", "2026-09-24T10:00:00.000Z");

  // anon_006: positive — start boundary is inclusive
  addEvent("anon_006", "product_view", WINDOW_START);
  addEvent("anon_006", "product_view", "2026-09-24T10:00:00.000Z");

  // anon_007: negative — one event is 1ms before the window
  addEvent("anon_007", "product_view", "2026-09-21T23:59:59.999Z");
  addEvent("anon_007", "product_view", "2026-09-24T10:00:00.000Z");

  // anon_008: negative — event at asOf is excluded
  addEvent("anon_008", "product_view", "2026-09-24T10:00:00.000Z");
  addEvent("anon_008", "product_view", AS_OF);

  // anon_009: positive — purchase exactly at asOf is excluded
  addEvent("anon_009", "product_view", "2026-09-24T10:00:00.000Z");
  addEvent("anon_009", "product_view", "2026-09-25T10:00:00.000Z");
  addEvent("anon_009", "purchase", AS_OF);

  // anon_010: positive — future purchase is ignored
  addEvent("anon_010", "product_view", "2026-09-24T10:00:00.000Z");
  addEvent("anon_010", "product_view", "2026-09-25T10:00:00.000Z");
  addEvent("anon_010", "purchase", "2026-09-30T00:00:00.000Z");

  // anon_012: only non-product-view events
  addEvent("anon_012", "page_view", "2026-09-24T10:00:00.000Z");
  addEvent("anon_012", "add_to_cart", "2026-09-25T10:00:00.000Z");

  // anon_013: old user with no events
  // Intentionally no events.

  console.log(
    `Seeded audience data for asOf ${AS_OF}. Expected default audience size: 6.`,
  );
}

if (require.main === module) {
  seedDatabase();
}