# Security Policy

Material authentication rejections use bounded evidence codes and correlation identifiers. Evidence
must never contain tokens, authorization headers, passwords, secrets, complete claims, email, or
arbitrary request data. An evidence-write failure never permits authentication. Production monitoring,
retention, alerting, and incident response remain future Founder decisions.

Report vulnerabilities privately to the repository maintainers; do not open a public exploit report. Never commit credentials, tokens, personal data, production secrets, or fabricated organizational data. Use environment injection and secret managers in approved deployments. Production OIDC verification remains pending. The actor-header development seam must not be exposed as production authentication.

## PostgreSQL authority

`packages/database/security/bootstrap-roles.sql` separates migration ownership, application runtime, audit reading, and emergency administration. The required order is administrative bootstrap, credential injection outside source control, Prisma migration as `rems_migration_owner`, and only then application startup as `rems_application`. When upgrading a database with pre-FIP-005C objects, the administrator reruns the bootstrap to transfer those existing objects before migration. Never use the migration or emergency credential at runtime. `rems_audit_reader` is limited to audit reads.

Runtime grants make `AuditEvent` append-only for the application and read-only for the audit reader. Corrections must be new compensating events. These grants do not and cannot make a PostgreSQL superuser, object owner, or appropriately privileged emergency administrator technically incapable of alteration. Emergency recovery requires documented Founder authorization. Production provisioning, credential custody, deployment verification, and emergency-access evidence are not supplied by repository or CI artifacts.

## OIDC identity boundary

Authentication proves external identity; RED-001 persistence alone supplies business authority. Unknown issuers, subjects, links, inactive links, and inactive or suspended executives are denied. Tokens are signature-, issuer-, audience-, expiry-, not-before-, algorithm-, and key-validated via JOSE/JWKS. Never log or persist bearer tokens. Email and external roles, groups, titles, scopes, or permissions are not authoritative linking or authorization inputs.

Pre-authentication denials are not inserted into the actor-required RED-001 audit table. ADR 0005 documents the safe future system-security evidence boundary rather than inventing an actor.

External identity link resolution is implemented with runtime `SELECT` access only. Controlled lifecycle operations use the separate administrative authority below; the runtime role is not broadened.

## Controlled identity administration

FIP-005E adds two roles through a separate additive bootstrap script. One-time `rems_founder_bootstrap` has `SELECT, INSERT` on identity, unit, membership, link, and audit tables plus migration-state `SELECT`; it has no update, delete, or truncate authority. Ongoing `rems_identity_admin` has `SELECT` on identity, unit, membership, permission, link, and audit records; link `INSERT, UPDATE, DELETE`; and audit `INSERT`, but no other governed writes or truncation. Neither owns objects. `rems_application` remains link-SELECT-only; `rems_audit_reader` has no link access.

Keep `FOUNDER_BOOTSTRAP_DATABASE_URL` only in the one-time ceremony and `IDENTITY_ADMIN_DATABASE_URL` only in the ongoing controlled process; the API receives neither. Immediately after successful bootstrap, an authorized administrator runs `lockdown-founder-bootstrap-role.sql` to set `rems_founder_bootstrap NOLOGIN`. The ceremony does not attempt to disable its own connection. Operational procedures may terminate residual sessions and remove the role later under separate authorization.

The CLI never logs tokens or issuer/subject values. Lifecycle authorization comes from verified OIDC issuer/subject resolution plus active RED-001 Founder state, never provider claims. Pre-authentication rejection cannot accurately populate the actor-required audit schema, so no actor is fabricated. Loss of the final usable Founder link is an emergency-recovery case excluded from this milestone.

## Operational credential and logging boundaries

Production validation permits only `rems_application` in the API database URL and never prints the URL. Migration, Founder bootstrap, identity administration, readers, backup, restore, and emergency credentials belong only to their controlled processes; web receives none. `rems_backup` is a sensitive-data reader without write, create, ownership, runtime, or restore authority and requires independently governed custody.

Application logs are structured and correlated using a generated or bounded caller identifier. Request logging excludes headers and bodies; authorization, cookies, bearer tokens, claims, database URLs, passwords, secrets, and identity-link values are redacted or never supplied. Health responses contain no configuration or diagnostic detail. SBOMs and unsuppressed high/critical scan findings require human review; even a clean scan does not prove absence of vulnerabilities.

## Controlled staging boundary

The Render declaration is manual and fail-closed: automatic deployments are off; release migration
is normally suspended; database credentials use dashboard injection without defaults; web receives
none. API and release authority must remain `rems_application` and `rems_migration_owner`,
respectively. Founder-bootstrap, identity-admin, readers, backup, restoration, owner, and emergency
credentials are prohibited from ordinary services. Generated provider-owner connections never become
runtime settings.

Staging Auth0 must be tenant-isolated, HTTPS, exact-origin, asymmetrically signed, and MFA-protected
for the synthetic Founder and administrators. Provider roles never elevate authority and only RED-001
may link exact issuer/subject. Better Stack checks only minimal live/ready responses; alert payloads
exclude secrets, tokens, claims, links, and records. Backups are encrypted before external transfer
and restored only to a separately approved empty database. Operational secrets and evidence remain
outside Git. See the FIP-005H runbook for stop conditions and teardown.
