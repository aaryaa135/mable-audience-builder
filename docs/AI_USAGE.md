# AI Usage Documentation

## AI Tools Used

- **OpenCode** (Nemotron 3 Ultra) — primary development agent
- **GitHub Copilot** (VS Code) — inline completions during manual edits

## What AI Helped With

1. **Frontend implementation**
   - `audienceApi.ts`: API client with `ApiRequestError`, `previewAudience`, AbortSignal support
   - `ConditionRow.tsx`: Form controls for event type, operator, count, withinDays, remove button
   - Accessibility fixes: `aria-describedby`, `aria-label`, `aria-live="polite"`

2. **Backend HTTP boundary hardening**
   - Malformed JSON → 400 `MALFORMED_JSON`
   - Wrong Content-Type → 415 `UNSUPPORTED_MEDIA_TYPE`
   - Oversized body → 413 `PAYLOAD_TOO_LARGE`
   - Reuse existing `requestId` from logging middleware

3. **Request logging middleware**
   - `requestId`, method, path, status, durationMs
   - Extra fields for successful preview: `conditionCount`, `audienceTotal`

4. **Test expansion**
   - 10 new validation/functional tests (invalid asOf, name length, count bounds, extra fields, exactly-0 semantics)

5. **Documentation**
   - README.md, DESIGN.md, AI_USAGE.md

## Implementation Decisions Verified Manually

- Zod schema behavior (strict mode, custom refine for `at_least` count ≥ 1)
- SQLite query correctness (window boundaries, first_seen_at filter, conditional aggregation)
- Time-window semantics: inclusive start, exclusive end, UTC
- `exactly 0` includes users with zero matching events
- Frontend build passes with `erasableSyntaxOnly: true` (no parameter properties)
- All 22 backend tests pass
- Frontend production build succeeds

## Mistakes / Issues Encountered

| Issue | Detection | Correction |
|-------|-----------|------------|
| Empty `audienceApi.ts` and `ConditionRow.tsx` | TypeScript errors in `AudienceBuilder.tsx` | Implemented both files from scratch matching imports |
| `public readonly requestId` parameter property | `erasableSyntaxOnly: true` forbids it | Changed to explicit property assignment in constructor |
| 413 test failing (got 500) | `npm test` | Added handler for `PayloadTooLargeError` (type `entity.too.large`) |
| Zod unrecognized keys reported with empty path | Test failure | Updated test to check `message` field, not `path` |
| Duplicate `requestId` generation in error handlers | Code review | Reuse `X-Request-Id` from logging middleware |
| Frontend UTC hint not announced | Accessibility audit | Added `id` + `aria-describedby` |

## What Was Not Delegated to AI

- Product requirements interpretation (assignment spec)
- Database schema design (seed data, indices)
- Core evaluation logic (`selectMembers`, `windowFor`, `conditionMatches`)
- CSS styling (`App.css`, `index.css`)
- Project structure, build config (`tsconfig`, `vite.config`, `package.json`)
- Git history / commit strategy