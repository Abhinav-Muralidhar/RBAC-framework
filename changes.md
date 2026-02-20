# Optimistic Locking - Required Changes

## What We're Solving

- Lost updates: two users edit the same record and the last save overwrites the first.
- Status-change conflicts: one user deactivates a record while another edits it and the deactivate is undone.
- No feedback: users are never told their changes were overwritten.

## Strategy

Add a `version` integer column to every mutable table. On every update, check `WHERE version = (client version)` and increment it. If 0 rows match, another user changed the record, return HTTP 409 Conflict.

## Concurrency Control Rules

- Every mutable record has a `version` (default 1).
- Read responses always include `version`.
- Update requests must include the last-seen `version`.
- Update SQL must include `AND version = $N` in `WHERE`.
- Update SQL must set `version = version + 1` and `updated_at = NOW()`.
- If no row is updated, throw a concurrency error -> HTTP 409.

---

## Changes By Layer

### 1. Database Migration

Update existing migrations to include optimistic locking columns:
- `backend/migrations/01_organizations.js` -> add `version`
- `backend/migrations/02_users.js` -> add `version`
- `backend/migrations/03_roles.js` -> add `version`, `updated_at`
- `backend/migrations/05_profiles.js` -> add `version`, `updated_at`
- `backend/migrations/10_groups.js` -> add `version`, `updated_at`
- `backend/migrations/13_sharing_rules.js` -> add `version`, `updated_at`
- `backend/migrations/14_smtp_config.js` -> add `version`, `updated_at`

### 2. Models (8 files)

Add `version: number` to every model interface. Add `updated_at?: Date | null` where missing.

- `users.model.ts`
- `organizations.model.ts`
- `roles.model.ts`
- `groups.model.ts`
- `profiles.model.ts`
- `sharing_rules.model.ts`
- `smtp_config.model.ts`

### 3. Error Class

Add `ConcurrentModificationError` to `rbac.errors.ts`:
- Extends `RBACError`
- Takes `entityType` and `entityId`
- Message: `"<Entity> '<id>' was modified by another user. Please refresh and try again."`

### 4. Error Handler Middleware

In `errorHandler.middleware.ts`:
- Import `ConcurrentModificationError`
- Map it to HTTP 409 in `getStatusCode()`
- Map it to error code `CONCURRENT_MODIFICATION` in `getErrorCode()`

### 5. Repositories (8 files)

For each repository `update()` method:
- Add `AND version = $N` to the `WHERE` clause
- Add `version = version + 1, updated_at = NOW()` to the `SET` clause
- Accept `version` as a parameter
- If query returns no rows, throw `ConcurrentModificationError`

Files:
- `users.repository.ts`
- `organizations.repository.ts`
- `roles.repository.ts`
- `groups.repository.ts`
- `profiles.repository.ts`
- `sharing_rules.repository.ts`
- `smtp_config.repository.ts`

### 6. DTOs (8 files)

Add `version: number`:
- Required on all Update Request DTOs
- Included on all Response DTOs

Files:
- `user.dto.ts`
- `organization.dto.ts`
- `role.dto.ts`
- `group.dto.ts`
- `profile.dto.ts`
- `sharing-rule.dto.ts`
- `smtp_config.dto.ts`

### 7. Repository Types

In `repository.types.ts`, add `version: number` to update input types (e.g., `UpdateRoleInput`, `UpdateSharingRuleInput`).

### 8. Services (8 files)

In each service `update()` method:
- Extract `version` from the request DTO
- Pass it to the repository update call
- Do not catch the error; let it flow to the global handler

Files:
- `user.service.ts`
- `organization.service.ts`
- `role.service.ts`
- `group.service.ts`
- `profile.service.ts`
- `sharingRule.service.ts`
- `smtpConfig.service.ts`

### 9. Frontend

- Store `version` when fetching any record
- Send `version` in PUT/PATCH request body
- Handle 409 by showing: "This record was changed by someone else. Please refresh."

---

## Execution Order

1. Migration -> run `npx knex migrate:latest`
2. Error class + middleware
3. Models
4. Repository types + DTOs
5. Repositories
6. Services
7. Type check -> `npx tsc --noEmit`
8. Frontend updates
9. Manual test: open same record in two tabs, save both; second should get 409

---

## Summary

| Layer | Files | What to Add |
| --- | --- | --- |
| Migration | 7 existing | `version` column on 8 tables |
| Models | 8 | `version: number` field |
| Errors | 1 | `ConcurrentModificationError` class |
| Middleware | 1 | 409 status mapping |
| Repositories | 8 | Version check in WHERE + throw on mismatch |
| DTOs | 8 | `version` on update + response |
| Repo Types | 1 | `version` on update inputs |
| Services | 8 | Pass version through |
| Frontend | 8+ forms | Send version, handle 409 |
| Total | ~35 files | |

---

## Backend Optimization Plan

### Goals
- Improve query performance and reduce latency.
- Harden security and configuration.
- Increase reliability and observability.
- Reduce startup overhead and runtime waste.

### Plan
1. Baseline and audit. Capture current request latency and query timings using lightweight request logging. Identify slow endpoints and heavy queries, then keep a short list of targets for optimization.
2. Dependency and runtime cleanup. Audit `backend/package.json` for unused or overlapping dependencies. Move migration-only packages to devDependencies and ensure `backend/node_modules` is never committed. Ignore or relocate `backend/uploads` if it should not be in source control.
3. Configuration hardening. Create a typed config module that validates env vars on startup and centralizes defaults. Add `backend/src/config.ts`. Update `backend/src/server.ts`. Update `backend/src/db.ts`. Avoid logging secrets like database URLs.
4. Database indexing and constraints. Review tables and add indexes for foreign keys and high-cardinality lookup fields used in `WHERE` and `JOIN`. Add missing `NOT NULL`, `UNIQUE`, and `ON DELETE` constraints where appropriate. Update migration files under `backend/migrations`.
5. Query optimization pass. Review repository queries for `SELECT *`, N+1 patterns, and unbounded list endpoints. Add pagination defaults and explicit column selection. Focus on `backend/src/rbac/repositories`.
6. Connection pooling and transaction usage. Align pool settings with deployment environment and standardize multi-step operations on shared transaction utilities. Review `backend/src/rbac/utils/transaction.utils.ts`.
7. API middleware optimization. Add security headers, tighten CORS origins, and configure compression for JSON responses where appropriate. Review middleware usage in `backend/src/server.ts`.
8. Input validation and upload limits. Add schema validation for all request bodies and tighten file upload limits and type checks. Update `backend/src/rbac/routes` and related validators.
9. Observability. Introduce structured logging with request IDs and consistent error logging. Add a readiness endpoint that checks DB connectivity, and extend the health route with build/version info.
10. Build and type safety. Enable stricter TypeScript options for backend builds and add a dedicated build config. Update `backend/tsconfig.json`. Add `backend/tsconfig.build.json`. Add scripts for typecheck and lint.
11. Test coverage. Add integration tests for auth and RBAC flows using a test database and `supertest`. Add `backend/src/__tests__`.
12. Documentation and runbooks. Update backend docs with env variables, migrations, and operational commands. Add a short deployment checklist with rollback steps.

### Definition Of Done
- p95 latency and slow query counts improve versus the baseline.
- No endpoints return unbounded result sets by default.
- All required env vars are validated at startup.
- Health and readiness endpoints return deterministic JSON.
- CI checks pass for typecheck, lint, and tests.
