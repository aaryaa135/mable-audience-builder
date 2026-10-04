# Mable Audience Builder

A full-stack application for building and previewing audience segments based on anonymous user event data.

## Architecture

- **Backend**: Express + TypeScript + SQLite (better-sqlite3)
  - REST API at `/v1/audiences/preview`
  - Zod validation for request bodies
  - SQL-based event aggregation + TypeScript evaluation
- **Frontend**: React 19 + TypeScript + Vite
  - Audience builder UI with condition rows
  - Preview results with evidence per user

### Dependencies (one-line rationale)

**Backend**
- `express` — HTTP server & routing
- `zod` — Runtime schema validation with strict mode
- `better-sqlite3` — Synchronous SQLite driver, zero-config file DB
- `cors` — Cross-origin requests for local frontend dev
- `typescript` — Static types
- `vitest` — Unit/integration test runner
- `supertest` — HTTP endpoint testing
- `tsx` — TypeScript execution for dev/scripts

**Frontend**
- `react` + `react-dom` — UI framework
- `typescript` — Static types
- `vite` — Dev server & production bundler
- `@vitejs/plugin-react` — React Fast Refresh & JSX transform
- `oxlint` — Fast linting (replaces ESLint)

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

## Seed Database

```bash
cd backend && npm run seed
```

Seeds 13 anonymous users with events between 2026-09-22 and 2026-09-30.

## Run Backend

```bash
cd backend && npm run dev
# Runs on http://localhost:3000
```

## Run Frontend

```bash
cd frontend && npm run dev
# Runs on http://localhost:5173
```

Configure backend URL via `VITE_API_BASE_URL` (default: `http://localhost:3000`):

```bash
VITE_API_BASE_URL=http://localhost:3000 npm run dev
```

## API Endpoint

**POST** `/v1/audiences/preview`

### Example Request

```json
{
  "name": "Product Viewers - No Purchase",
  "asOf": "2026-09-29T00:00:00.000Z",
  "conditions": [
    { "eventType": "product_view", "operator": "at_least", "count": 2, "withinDays": 7 },
    { "eventType": "purchase", "operator": "exactly", "count": 0, "withinDays": 7 }
  ]
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/v1/audiences/preview \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Viewers - No Purchase",
    "asOf": "2026-09-29T00:00:00.000Z",
    "conditions": [
      { "eventType": "product_view", "operator": "at_least", "count": 2, "withinDays": 7 },
      { "eventType": "purchase", "operator": "exactly", "count": 0, "withinDays": 7 }
    ]
  }'
```

### Expected Default Result

Returns **6 users** (anon_001, anon_002, anon_005, anon_006, anon_009, anon_010) with evidence for each condition.

### Seed / Boundary Table

| User ID   | product_view (7d) | purchase (7d) | Matches? | Reason |
|-----------|-------------------|---------------|----------|--------|
| anon_001  | 2                 | 0             | ✅       | ≥2 views, 0 purchases |
| anon_002  | 2                 | 0             | ✅       | ≥2 views, 0 purchases |
| anon_003  | 1                 | 0             | ❌       | Only 1 view (<2) |
| anon_004  | 3                 | 1             | ❌       | Has purchase in window |
| anon_005  | 2                 | 0             | ✅       | ≥2 views, 0 purchases |
| anon_006  | 2                 | 0             | ✅       | ≥2 views, 0 purchases |
| anon_007  | 0                 | 0             | ❌       | 0 views (<2) |
| anon_008  | 0                 | 0             | ❌       | 0 views (<2) |
| anon_009  | 2                 | 0*            | ✅       | Purchase at asOf (excluded) |
| anon_010  | 2                 | 0             | ✅       | ≥2 views, 0 purchases |
| anon_011  | 1                 | 0             | ❌       | Only 1 view (<2) |
| anon_012  | 0                 | 0             | ❌       | 0 views (<2) |
| anon_013  | 0                 | 0             | ❌       | No events, 0 views (<2) |

*anon_009 has a purchase at exactly `asOf` (2026-09-29T00:00:00.000Z), which is excluded by the exclusive end boundary.

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_FAILED | MALFORMED_JSON | UNSUPPORTED_MEDIA_TYPE | PAYLOAD_TOO_LARGE | NOT_FOUND | INTERNAL_ERROR",
    "message": "...",
    "details": [{ "path": "...", "message": "..." }],
    "requestId": "uuid"
  }
}
```

## Tests & Typecheck

```bash
# Backend tests
cd backend && npm test

# Backend typecheck
cd backend && npm run typecheck

# Frontend build (includes typecheck)
cd frontend && npm run build
```

## Known Scope & Tradeoffs

- In-memory SQLite file (`audience.db`) — not suitable for production concurrency
- No authentication/authorization
- Frontend served separately in dev; production would need static hosting or SSR
- No pagination for large audiences (max 10 conditions, 1000 count)
- Request body limited to 100 KB