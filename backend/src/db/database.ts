import Database from "better-sqlite3";
import path from "node:path";
import type { AudienceCondition } from "../domain/types";

const dbPath = path.resolve(process.cwd(), "audience.db");

export const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

export interface UserConditionCounts {
  anonymousId: string;
  counts: number[];
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS anonymous_users (
      anonymous_id TEXT PRIMARY KEY,
      first_seen_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anonymous_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (
        event_type IN (
          'page_view',
          'product_view',
          'add_to_cart',
          'checkout_started',
          'purchase'
        )
      ),
      occurred_at INTEGER NOT NULL,
      FOREIGN KEY (anonymous_id)
        REFERENCES anonymous_users(anonymous_id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_events_user_type_time
      ON events(anonymous_id, event_type, occurred_at);
  `);
}

export function getUserConditionCounts(
  asOf: Date,
  conditions: AudienceCondition[],
): UserConditionCounts[] {
  if (conditions.length === 0) {
    return [];
  }

  const earliestWindowStart = Math.min(
    ...conditions.map(
      (condition) =>
        asOf.getTime() - condition.withinDays * 24 * 60 * 60 * 1000,
    ),
  );

  const countExpressions = conditions.map(
    (condition, index) => `
      COALESCE(
        SUM(
          CASE
            WHEN e.event_type = @eventType${index}
             AND e.occurred_at >= @windowStart${index}
             AND e.occurred_at < @asOf
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS condition_${index}
    `,
  );

  const sql = `
    SELECT
      u.anonymous_id,
      ${countExpressions.join(",")}
    FROM anonymous_users u
    LEFT JOIN events e
      ON e.anonymous_id = u.anonymous_id
      AND e.occurred_at >= @earliestWindowStart
      AND e.occurred_at < @asOf
    WHERE u.first_seen_at < @asOf
    GROUP BY u.anonymous_id
    ORDER BY u.anonymous_id ASC
  `;

  const statement = db.prepare(sql);

  const parameters: Record<string, string | number> = {
    earliestWindowStart,
    asOf: asOf.getTime(),
  };

  conditions.forEach((condition, index) => {
    parameters[`eventType${index}`] = condition.eventType;
    parameters[`windowStart${index}`] =
      asOf.getTime() - condition.withinDays * 24 * 60 * 60 * 1000;
  });

  const rows = statement.all(parameters) as Record<string, unknown>[];

  return rows.map((row) => ({
    anonymousId: String(row.anonymous_id),
    counts: conditions.map((_, index) =>
      Number(row[`condition_${index}`]),
    ),
  }));
}