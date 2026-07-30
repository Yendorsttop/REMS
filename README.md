# REP Entertainment Management System (REMS)

FIP-005F adds minimized append-only system-security evidence for material authentication rejections.
It is separate from RED-001 audit, has no fabricated executive actor, and keeps responses generic.
See [ADR 0007](docs/adr/0007-append-only-system-security-evidence.md).

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

For local disposable development, start PostgreSQL with `docker compose up -d postgres`, bootstrap roles, assign local-only passwords outside committed files, migrate using the migration-owner URL, and then run the verification suite with the application URL. `pnpm test:db-security` additionally requires `APPLICATION_DATABASE_URL`, `AUDIT_READER_DATABASE_URL`, and `MIGRATION_DATABASE_URL`; the last connection seeds and removes synthetic security fixtures and is never used by the runtime application. Database suites skipped without explicit enablement are not database evidence. Initial Founder authority must be provisioned through an approved process; no production identity or credential is provided here.

## Status

FIP-005C role/grant definitions and database-level runtime audit immutability are implemented and designed for CI verification; operational certification is not claimed. Production role provisioning, hosting, credentials, OIDC, deployment, and operational verification remain outstanding. See `docs/certification/FIP-005-evidence.md` for precise limitations.

## FIP-005D authentication

The API verifies OIDC JWT bearer tokens and explicitly maps the verified issuer-and-subject pair to an active RED-001 executive identity. Provider claims never grant REMS roles or permissions. Deployments must set `OIDC_ISSUER`, `OIDC_AUDIENCE`, and optionally `OIDC_ALLOWED_ALGORITHMS` (default `RS256`). No production provider is selected by this repository.

The runtime application has read-only access to external identity links. Controlled administration is described below and is never exposed through HTTP.

## FIP-005E Founder ceremony and link administration

Run `bootstrap-roles.sql`, then the additive `bootstrap-identity-admin-role.sql`, inject separate credentials outside source control, and apply migrations as the migration owner. Set `FOUNDER_BOOTSTRAP_DATABASE_URL` only in the ceremony process and run: `pnpm --filter @rems/database identity:admin -- bootstrap --confirm=ESTABLISH-INITIAL-FOUNDER --executive-id=<stable-id> --display-name=<name> --issuer=<verified-issuer> --subject=<verified-subject>`. The command accepts no provider authority claims, requires the `rems_founder_bootstrap` connection role, and refuses any prior or partial Founder state. After success, an authorized administrator must run `psql <administrative-url> -f packages/database/security/lockdown-founder-bootstrap-role.sql` to set the one-time role `NOLOGIN`; the CLI deliberately cannot lock its own role.

After bootstrap, `add`, `suspend`, `reactivate`, `replace`, and `remove` require `IDENTITY_ADMIN_DATABASE_URL` for `rems_identity_admin`, an externally injected `REMS_ADMIN_BEARER_TOKEN`, and OIDC issuer/audience configuration. They require a verified active link to an active persisted Founder and protect the final usable Founder link. Never place either controlled database URL or credential in the API environment. This repository does not select a provider or prove production provisioning, lockdown, or ceremony completion. See ADR 0006.

## FIP-005G operational readiness

Production API startup requires `NODE_ENV=production`, `HOST`, `PORT`, `TRUSTED_PROXY` (`false` or 1–10 hops), an application-only `DATABASE_URL`, HTTPS `OIDC_ISSUER`, `OIDC_AUDIENCE`, and an explicit allow-list of asymmetric `OIDC_ALLOWED_ALGORITHMS`. Unsafe, placeholder, malformed, missing, or administrative database credentials fail before listening and errors do not echo secret values. Local Compose is explicitly non-production.

Release order is: (1) administrative role bootstraps, including the additive identity, reader, and backup artifacts; (2) the `migration` image or `prisma:migrate:deploy` with `MIGRATION_DATABASE_URL`; (3) controlled Founder/link provisioning and bootstrap lockdown where required; (4) API startup with only `rems_application`; and (5) `/health/ready` verification. Web receives no database credential. `/health/live` has no dependency check; `/health/ready` checks database usability and returns only minimal state. Shutdown withdraws readiness before Prisma disconnects.

Build `api`, `web`, and `migration` Docker targets independently. They run as `node`; environment files, Git data, tests, caches, and dumps are excluded by `.dockerignore`. Backup uses `BACKUP_DATABASE_URL` for the custody-controlled, sensitive-data-reading `rems_backup` role and an absolute ephemeral `BACKUP_FILE`: `./scripts/operations/backup.sh`. Restoration uses a separately created empty database, `RESTORE_DATABASE_URL` for authorized migration/restoration authority, and `./scripts/operations/restore.sh`; afterward rerun additive administrative grants and inspect security state. Never use `rems_application` for either operation.

Repository artifacts and disposable CI restoration/SBOM/scanning are readiness evidence, not production backup, deployment, recovery, vulnerability-free, or operational certification. Vendors, schedules, retention, recovery objectives, custody, alerting, monitoring, and actual deployment remain Founder decisions. See ADR 0008.
