# FIP-005H controlled staging runbook

## Manual database initializer (prepared, not executed)

The repository includes `.github/workflows/staging-database-initialize.yml`. It is manual-only for the existing `rems_staging` database; its presence is not migration evidence. The workflow must be reviewed and merged to `main` before it can be manually selected at that exact reviewed commit. Do not dispatch it as part of repository preparation.

Before adding secrets, create a GitHub environment named exactly `rems-staging-database` under **Settings → Environments**, require reviewers, prevent self-review, and restrict deployment branches to `main`. Protection comes first so no credential is available to an unreviewed job. Creating or configuring the environment is a separate authorized operator action.

After protection is reviewed, add these environment secrets (never repository variables or repository secrets):

- `REMS_STAGING_ADMIN_DATABASE_URL`: Render-generated staging owner/administrative connection.
- `REMS_STAGING_MIGRATION_DATABASE_URL`: exact user `rems_migration_owner`.
- `REMS_STAGING_APPLICATION_DATABASE_URL`: exact user `rems_application`.
- `REMS_STAGING_MIGRATION_ROLE_PASSWORD`
- `REMS_STAGING_APPLICATION_ROLE_PASSWORD`
- `REMS_STAGING_AUDIT_READER_ROLE_PASSWORD`
- `REMS_STAGING_EMERGENCY_ADMIN_ROLE_PASSWORD`
- `REMS_STAGING_FOUNDER_BOOTSTRAP_ROLE_PASSWORD`
- `REMS_STAGING_IDENTITY_ADMIN_ROLE_PASSWORD`
- `REMS_STAGING_SECURITY_READER_ROLE_PASSWORD`
- `REMS_STAGING_BACKUP_ROLE_PASSWORD`

Never record values in Git, documentation, chat, tickets, command arguments, or evidence. Separate password secrets let the immutable password-free bootstraps remain unchanged; values pass only in a child-process environment and psql `\getenv`.

At dispatch, enter the full 40-character commit SHA, exact phrase `INITIALIZE REMS STAGING DATABASE`, and affirm that API and web are suspended. A credential-free job rejects a non-`main` ref, SHA mismatch, wrong phrase, or false acknowledgement before the protected job accesses secrets.

The sequence is: sanitized PostgreSQL 17/provider-authority preflight; `bootstrap-roles.sql`; `bootstrap-identity-admin-role.sql`; environment-only password provisioning; Prisma deploy as `rems_migration_owner`; security-reader and backup-role bootstraps; password reconciliation; then ownership, checksums, grants, role-boundary, Public-access, and application-authentication verification. It performs no backup, restore, deployment, Founder ceremony, or Founder-bootstrap lockdown. Failure stops without automatic rollback or role deletion.

Render's administrative principal must have provider-supported role-creation and alteration authority. If it does not, preflight fails with a sanitized message. Do not weaken the role model or grant specialized membership to `rems_application`; treat this as a hosting-authority blocker.

A successful hosted run is staging evidence only, never production evidence or operational certification. API/web must remain suspended until migrations, controlled configuration, and OIDC prerequisites pass independent review. No operational certification is claimed.

## Scope and hard stops

This runbook permits synthetic staging verification only. Repository staging preparation is **not a
deployment**, and it supplies no credentials or operational evidence. Stop for Founder approval
before applying the Blueprint or purchasing/provisioning anything, choosing a materially significant
region other than the Founder-approved Oregon, USA staging region, entering credentials, creating
identities, changing authority or security controls, or
performing deployment. Never use real people, organizations, issuer subjects, email, or production
domains. A successful staging deployment is **not production certification**; production deployment
and the real Founder-bootstrap ceremony remain separately Founder-controlled.

## 1. Founder-controlled prerequisites

1. Confirm the Founder-approved Oregon, USA staging region (`oregon` in the Render Blueprint), and
   obtain Founder approval for paid Render PostgreSQL and paid services, synthetic naming,
   maintenance window, rollback owner, and teardown date.
2. Establish named human administrative roles with MFA and least privilege in already approved
   Render, Auth0 staging, Cloudflare, Better Stack, and encrypted-backup custody accounts. Do not
   create accounts under this milestone. Record access approvals externally.
3. In Render, the Founder (or explicitly delegated administrator) bootstraps the minimum Blueprint,
   deploy, secret-management, database-administration, and log-viewing roles. No ordinary deployer
   receives Founder, emergency, backup, identity-admin, or evidence-reader custody.
4. Review the commit, successful CI, image/SBOM/Trivy results, Blueprint diff, and provider terms.
   Confirm automatic deployment is disabled and the initial Blueprint contains no migration
   executor or automatic migration path.

## 2. Exact external staging configuration

### Render and PostgreSQL

After the separate provisioning approval, verify the database, API, and web each declare
`region: oregon`, then apply `render.yaml` without adding any automatic database link or overriding
the declared region. Render cannot represent a newly declared background worker with zero instances.
The release-migration executor was therefore removed from this initial Blueprint rather than allowed
to run continuously. Do not add a worker, cron job, pre-deploy command, migration credential, or any
other automatic migration path when applying it. An authorized database administrator uses Render's
owner connection ephemerally to run the additive role bootstrap scripts in documented order and
provisions independent random credentials in the provider secret store. Never copy values to Git,
shell history, tickets, chat, evidence, or logs.

Inject only:

- API: `DATABASE_URL` for `rems_application`, plus non-secret runtime/OIDC configuration.
- Web: `NEXT_PUBLIC_REMS_API_ORIGIN`; no database credential.

Do not assign `rems_founder_bootstrap`, `rems_identity_admin`, `rems_audit_reader`,
`rems_security_reader`, `rems_backup`, restoration/owner, or `rems_emergency_admin` credentials to
API, web, or ordinary workers. Render's generated owner URL is administrative input, not a runtime
connection.

### Auth0 / provider-neutral OIDC

Use a **separate staging tenant** containing synthetic users only. Configure the exact deployed HTTPS
issuer (including its required trailing slash if provider metadata uses one), exact staging API
audience, and `RS256` unless a later Founder-approved asymmetric algorithm is documented. Disable
symmetric token signing. Require MFA for the synthetic Founder and every administrator.

After Render origins are known, allow only exact HTTPS values—no wildcards, localhost, path
prefixes, query strings, or production origins:

| Auth0 boundary       | Exact value to record externally                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Allowed callback URL | the web's implemented OIDC callback URL; do not enable login until that route exists and is verified |
| Allowed logout URL   | the exact staging web post-logout URL                                                                |
| Allowed web origin   | the exact staging web origin                                                                         |
| API CORS origin      | the exact staging web origin only                                                                    |

The current web is a foundation and does not implement an OIDC callback; therefore interactive web
login is a fail-closed staging blocker, not a value to invent. API bearer verification may be tested
with a synthetic, minimally scoped staging client through secure operator tooling. Provider roles,
groups, permissions, email, and metadata grant no REMS authority. Only RED-001's controlled command
may link the exact verified issuer/subject pair to a persisted synthetic executive.

### Better Stack and Cloudflare

After separate account/provider approval, create minimal HTTPS uptime checks for API
`/health/live` (process) and `/health/ready` (dependency readiness). Use GET, expected 200 and the
minimal documented body, conservative intervals, and approved alert recipients. Monitor names,
URLs, headers, alert bodies, logs, and incident payloads must contain no credentials, tokens,
authorization headers, claims, issuer/subject pairs, email, database details, or record data. Do not
monitor authenticated business endpoints.

Cloudflare configuration is limited to a Founder-approved **staging** hostname after an existing
non-production zone is separately approved. Use an exact CNAME to the Render web/API host as
designed, HTTPS-only/TLS validation, and documented proxy choice. Do not select, buy, transfer, or
configure a production domain. Update Auth0 boundaries only after exact staging origins stabilize.

## 3. Controlled release sequence

The initial Blueprint cannot execute this sequence. Migration execution requires a later, separately
Founder-approved and controlled administrative mechanism that is not provisioned or specified here.
Do not infer approval to create it, invent its credential, or attach privileged access to API or web.
The API may remain unavailable until that mechanism is approved and migrations complete successfully;
this fail-closed state is intentional.

1. Capture the reviewed commit SHA and immutable API/web image digests. Keep API/web stopped.
2. Through the separately approved administrative mechanism and ephemeral access, run
   `bootstrap-roles.sql`, the additive identity, security-reader, and backup bootstrap artifacts as
   applicable, and the existing migrations in documented order. Never edit historical migrations.
   Confirm migration authority separation; capture migration names, checksums, UTC times, image or
   tool revision, and exit status without its URL. Any nonzero exit blocks startup.
3. In an isolated ceremony process only, inject `FOUNDER_BOOTSTRAP_DATABASE_URL` and run the existing
   identity CLI with clearly synthetic IDs, display name, issuer, subject, and organization. Do not
   record those values in repository artifacts. This is a **synthetic staging ceremony**, never the
   production ceremony.
4. Immediately run `lockdown-founder-bootstrap-role.sql` through authorized administrative access,
   terminate residual ceremony sessions, remove the ceremony secret from the process/store, and
   verify `rolcanlogin = false`. Failure blocks API startup.
5. Start API at the reviewed digest and verify its parsed database username is `rems_application`.
   Start web at its reviewed digest and prove its environment has no database credential.
6. Verify HTTPS `GET /health/live` returns `200 {"status":"ok"}` and `/health/ready` returns
   `200 {"status":"ready"}`. Confirm shutdown withdraws readiness. Capture only minimal output.
7. Verify OIDC discovery issuer, audience rejection, asymmetric algorithm, signature/key rotation,
   expiry/not-before checks, unknown exact issuer/subject denial, inactive-link denial, and successful
   synthetic RED-001 link resolution. Confirm provider roles cause no elevation.
8. Through separately injected readers, verify bounded system-security evidence for material denial
   and business audit for authenticated governed actions. Confirm no token/claims/secret data and no
   fabricated actor; verify application cannot mutate either append-only history.
9. Enable the two minimal Better Stack checks and verify a synthetic alert reaches only approved
   recipients with no sensitive content. Record delivery externally.

## 4. Backup, independent restoration, and reconciliation

1. In a custody-controlled transient process, inject only `BACKUP_DATABASE_URL` for `rems_backup` and
   an absolute ephemeral path. Run `scripts/operations/backup.sh`; encrypt the logical archive before
   external transfer, record digest/tool version/custodian, and securely delete plaintext. Keep media
   provider-independent and outside Git/Render runtime disks.
2. Create a **separate, empty staging database** only after separate paid-resource approval. Inject
   authorized `RESTORE_DATABASE_URL`; run `restore.sh`. Never restore over the source.
3. Bootstrap required cluster roles, reapply additive reader/backup bootstraps, and run
   `reapply-restored-grants.sql` as controlled migration/restoration authority.
4. Run `inspect-security-state.sql` against source and restoration using authorized access, normalize
   only expected database-specific identifiers, and compare role attributes, object ownership,
   grants, default privileges, append-only protections, Founder-bootstrap `NOLOGIN`, migration
   history, representative synthetic record counts, business audit, and security evidence. Any
   unexplained difference fails restoration.
5. Record recovery start/end and observed performance externally; it is not an RTO/RPO claim until
   the Founder approves objectives and repeated evidence.

## 5. Gates, rollback, and teardown

Before declaring a staging run reviewed, place redacted records shaped by
`staging-evidence-template.md` in external custody and run the fail-closed evidence gate. Missing
evidence, a HIGH/CRITICAL Trivy finding without Founder disposition, absent CycloneDX SBOM, failed
restore/security comparison, unsuccessful alert delivery, or unreviewed exception blocks promotion.

Rollback on failed migration/startup/security checks: stop API/web and the separately controlled
administrative mechanism, preserve
sanitized logs/evidence, revoke affected credentials, and redeploy only the previously reviewed
immutable digest. Do not reverse migrations or restore over staging without an approved recovery
decision; exercise the rollback and recheck health, grants, audit, and security state.

At the approved end: export required encrypted evidence/backup under custody; stop monitors; remove
staging DNS; revoke/rotate staging-only credentials; delete synthetic Auth0 users/connections and
Render services/database only with Founder approval; verify billing/resource inventory and credential
revocation; retain or destroy evidence under the approved policy. Never touch production resources.

Repository declarations are not evidence that resources were provisioned or deployed. Actual
credentials, custody records, provider configuration, monitoring delivery, backup media, recovery
performance, and operational evidence remain external to this repository. No staging or production
operational certification is claimed.
