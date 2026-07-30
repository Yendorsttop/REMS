# FIP-005 Certification Evidence

## Implemented artifacts

FIP-005C adds version-controlled administrative role bootstrap, migration-owned grants, restricted-role integration tests, and CI orchestration. The migration owner owns migrated objects and is not a runtime credential. The application can operate on RED-001 records and append/read audit events but receives no audit `UPDATE`, `DELETE`, or `TRUNCATE`. The audit reader receives audit `SELECT` only. Corrections use new compensating audit events.

FIP-005B evidence remains covered: identities, hierarchy, memberships, roles, reporting, scoped permissions, audit insertion, atomic rollback on audit failure, and restrictive foreign-key deletion. In-memory adapters remain isolated test doubles, not persistence evidence.

## CI-verifiable enforcement

The ephemeral PostgreSQL workflow creates the roles with explicitly CI-only passwords and verifies both a fresh migration and an additive upgrade after the byte-unchanged foundation migration has already been recorded. Both paths finish under `rems_migration_owner`, run governed operations as `rems_application`, and test audit access through separate application and reader connections. `pnpm test:db-security` proves application audit insert/read; rejected update, delete, and truncate; reader read and rejected writes; governed operations; transaction rollback; restrictive deletion; and migration-owner audit-table ownership. A passing hosted workflow for the reviewed commit—not the presence of these files alone—is the CI result.

## Limitations and certification status

- PostgreSQL superusers, object owners, and appropriately authorized administrators remain technically capable of changing audit data.
- Emergency access is a documented, Founder-authorized recovery path; CI does not evidence a production authorization or access event.
- No production database host, roles, credentials, secret custody, provisioning run, migration run, or deployment evidence exists here.
- Production OIDC, infrastructure, backups, monitoring, and operational controls remain unconfigured.
- Docker, migrations, grants, tests, and workflows are implementation artifacts, not proof of production operation.

**FIP-005C database security controls are implemented and subject to CI verification; full operational certification is not claimed.** Production provisioning and deployment evidence, a successful reviewed CI run, Founder-authorized operational controls, and all remaining integrations are prerequisites to any later operational claim.
