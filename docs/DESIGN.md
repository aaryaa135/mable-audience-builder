# Design Document

## 1. Data Model

**Tables**

- `anonymous_users(anonymous_id TEXT PRIMARY KEY, first_seen_at INTEGER)`
- `events(id INTEGER PRIMARY KEY, anonymous_id TEXT, event_type TEXT, occurred_at INTEGER)`

**Event Types**: `page_view`, `product_view`, `add_to_cart`, `checkout_started`, `purchase`

**Indices**: Composite index on `(anonymous_id, event_type, occurred_at)` for windowed queries.

**Runtime Types**

```typescript
interface AudienceCondition {
  eventType: EventType;
  operator: "at_least" | "exactly";
  count: number;       // 0–1000
  withinDays: number;  // 1–90
}
interface AudienceRuleRequest {
  name: string;        // 1–100 chars
  asOf: string;        // ISO 8601 with offset
  conditions: AudienceCondition[]; // 1–10
}
```

## 2. Rule Evaluation

1. **Parse & validate** request with Zod (strict mode rejects unknown fields).
2. **Compute window** per condition: `[asOf - withinDays*24h, asOf)` — start inclusive, end exclusive.
3. **SQL aggregation**: Single query joins `anonymous_users` → `events`, filters `occurred_at` to earliest window start across all conditions and `< asOf`. Counts events per user per condition using conditional `SUM(CASE...)`.
4. **Filter users**: `first_seen_at < asOf` (user must exist before evaluation time).
5. **TypeScript evaluation**: For each user, check every condition (`AND` semantics). `at_least` → `observed >= count`; `exactly` → `observed === count`.
6. **Build evidence**: For matching users, emit `ConditionEvidence` with `observedCount`, `required`, `windowStart`, `windowEnd`.

## 3. Time-Window Semantics

- All timestamps UTC (stored as ms since epoch, parsed from ISO strings).
- Window: `[asOf - withinDays*24h, asOf)` — inclusive start, exclusive end.
- Events at exactly `asOf` are excluded.
- Events before window start are excluded.
- `first_seen_at < asOf` ensures only users who existed at evaluation time are considered.

## 4. Scaling / Product Tradeoffs

| Aspect | Current | Tradeoff |
|--------|---------|----------|
| Storage | SQLite file | Single-node, no replication; fine for demo |
| Query | Single aggregation + in-memory filter | O(users × conditions); acceptable for ≤10K users |
| Conditions | Max 10 | Prevents query bloat; UX constraint |
| Count | Max 1000 | Prevents unreasonable thresholds |
| withinDays | Max 90 | Limits window scan size |
| Payload | 100 KB limit | Prevents DoS via large bodies |
| Concurrency | None | `better-sqlite3` is synchronous; not production-ready |
| Evidence | Full per-user per-condition | Bandwidth grows with audience size; could paginate |
| Time zones | UTC only | Simplifies semantics; no DST ambiguity |

**Future improvements**: Move to PostgreSQL, add read replicas, introduce pagination, caching, and async job queue for large previews.