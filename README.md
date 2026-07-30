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

The API uses PostgreSQL persistence and expects `DATABASE_URL` to use the restricted `rems_application` role. The required order is: an administrator runs `packages/database/security/bootstrap-roles.sql` against the selected database, approved tooling provisions credentials externally, Prisma migrations run as `rems_migration_owner`, and only then does the application start as `rems_application`. On a database where the foundation migration was already applied, rerun the bootstrap before the FIP-005C migration so the administrator can transfer existing governed objects to the migration owner. Never use migration-owner or emergency-administrator credentials for the application. The audit-reader connection is independently read-only. See ADR-0004 and `SECURITY.md` for authority and correction policy.

For local disposable development, start PostgreSQL with `docker compose up -d postgres`, bootstrap roles, assign local-only passwords outside committed files, migrate using the migration-owner URL, and then run the verification suite with the application URL. `pnpm test:db-security` additionally requires `APPLICATION_DATABASE_URL` and `AUDIT_READER_DATABASE_URL`. Database suites skipped without explicit enablement are not database evidence. Initial Founder authority must be provisioned through an approved process; no production identity or credential is provided here.

## Status

FIP-005C role/grant definitions and database-level runtime audit immutability are implemented and designed for CI verification; operational certification is not claimed. Production role provisioning, hosting, credentials, OIDC, deployment, and operational verification remain outstanding. See `docs/certification/FIP-005-evidence.md` for precise limitations.

## FIP-005D authentication

The API verifies OIDC JWT bearer tokens and explicitly maps the verified issuer-and-subject pair to an active RED-001 executive identity. Provider claims never grant REMS roles or permissions. Deployments must set `OIDC_ISSUER`, `OIDC_AUDIENCE`, and optionally `OIDC_ALLOWED_ALGORITHMS` (default `RS256`). No production provider is selected by this repository.

Only link resolution is implemented. The runtime application has read-only access to external identity links. Link administration is intentionally absent; any future link lifecycle requires separately approved, actor-authorized RED-001 commands, audit events, and an appropriately controlled persistence authority.
