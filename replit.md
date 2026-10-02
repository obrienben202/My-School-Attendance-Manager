# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run migrate:development` — apply reviewed additive database changes to development
- `node scripts/check-production-db-commands.mjs` — validate that production build and startup commands do not run schema changes
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

Termly learner ILPs extend the existing Attendance Tracker. Administrators maintain templates and assignments at `/ilp-admin/termly`; learners have a restricted `/learner-ilps` area, and assigned RG teachers review at `/ilp-tutor/reviews`. The staff guide includes initial school-account setup and term-opening instructions.

- Directory roles remain authoritative; the external school password service must never assign roles. Add individual learner/student accounts through the school directory, then verify and link exact confirmed roster records as an administrator.
- The supplied ILP PDF has three substantive term reviews (17, 18 and 18 questions). Its reference to four files is a document-navigation inconsistency, not a fourth term to invent.
- Review templates become immutable when published. Future wording changes require a new draft version; opening another year/term preserves earlier reviews. Administrative support access to private answers is deliberately requested and audited.

### ILP development checks

- `pnpm --filter @workspace/api-server run test:termly-ilp` — development-only synthetic directory/roster integration fixtures; tests real login/session/routes with a controlled school password-verifier boundary, then cleans up.
- `python .agents/scripts/check-ilp-pdf.py` — compare all 53 discussion questions against the source PDF (development tool: PyMuPDF).
- `pnpm --filter @workspace/api-server test` and `pnpm --filter @workspace/attendance-tracker test` — existing server/client regression checks.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The shared development database contains populated course, timetable, and attendance data. Do not force a global Drizzle push. Add reviewed, idempotent development migrations and let Publish apply the development-to-production schema diff.
- Production builds and startup must not run Drizzle push, migrations, or SQL schema scripts. Apply reviewed changes to development through the post-merge script; use Replit Publish to review and apply the development-to-production schema diff.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
