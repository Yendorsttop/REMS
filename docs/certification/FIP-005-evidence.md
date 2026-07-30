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

## FIP-005D provider-neutral OIDC verification

Implemented evidence includes an additive RED-001 external identity link, JOSE access-token verification, JWKS caching/rotation behavior, Nest request integration, default-deny resolution, and controlled local issuer tests. CI exercises these tests without a commercial provider.

This evidence does **not** establish production-provider provisioning, production configuration, deployment, operational monitoring, system-security rejection evidence, or full operational certification. Those remain pending Founder-reviewed infrastructure and deployment evidence.

Link resolution is implemented with application-role `SELECT` only. FIP-005E adds separately controlled link administration; the migration-owner connection remains only a fixture mechanism and is not a runtime or operational administration credential.

## FIP-005E Founder bootstrap and governed links

The additive artifacts implement a non-public, explicitly confirmed, one-time Founder ceremony and five Founder-authorized link lifecycle operations. Identity, Founder membership, exact issuer/subject link, and append-only evidence share a transaction. State gates, unique constraints, and rollback prevent repeat or partial establishment. Lifecycle authorization is derived only from verified OIDC identity resolved into active RED-001 Founder state; provider authority claims are ignored.

The separately bootstrapped `rems_founder_bootstrap` role has only initial insert/read authority and is locked `NOLOGIN` by a separate post-ceremony administrative script. The ongoing `rems_identity_admin` role can read authorization records, govern links, and append audit evidence but cannot write identities, organizations, memberships, permissions, or audit history. Neither is an owner or API credential. CI provisions only disposable credentials, exercises fresh and additive migration paths, compares their security state, and verifies lockdown. Previously committed migrations are not edited.

These source, migration, and CI artifacts are implementation evidence only. They do **not** prove production role provisioning, credential custody, provider configuration, successful Founder ceremony, deployment, or operational certification. Emergency recovery remains unimplemented pending a separate Founder-approved procedure.
