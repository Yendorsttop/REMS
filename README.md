# REP Entertainment Management System (REMS)

REMS is a Founder-governed modular monolith. FIP-005 establishes the RED-001 repository foundation: the exclusive authority for executive identities, organizational hierarchy, memberships, reporting relationships, roles, permissions, business authorization context, and identity-based organizational participation.

## Workspace

- `apps/api`: NestJS REST API and generated OpenAPI UI/JSON
- `apps/web`: Next.js governance-console foundation
- `packages/red-001`: authoritative domain and application boundary
- `packages/database`: Prisma/PostgreSQL adapters, transaction context, schema, and migrations
- `packages/contracts`, `config`, `observability`, `testing`: shared non-authoritative capabilities
- `docs`: ADRs, constitutional traceability, and evidence limitations

## Local verification

Requires Node.js 22 and pnpm 9. `corepack enable && pnpm install`, then run the commands in `CONTRIBUTING.md`. Copy `.env.example` only for local Compose use.

The API uses PostgreSQL persistence and expects `DATABASE_URL` to reference a migrated database. For local development, start PostgreSQL with `docker compose up -d postgres`, run `pnpm prisma migrate deploy --schema packages/database/prisma/schema.prisma`, and then run the verification suite. Database integration tests are skipped when `DATABASE_URL` is absent; a skip is not database certification evidence. Initial Founder authority must be provisioned through an approved process; no production identity, credentials, or bootstrap policy is invented here.

## Status

FIP-005B production-capable persistence is implemented; operational certification is not claimed. Database-enforced audit immutability, production database roles/hosting, production OIDC, and deployment verification remain outstanding. See `docs/certification/FIP-005-evidence.md` for precise limitations.
