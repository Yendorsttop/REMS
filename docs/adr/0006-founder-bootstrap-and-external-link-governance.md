# ADR 0006: Founder bootstrap and external-link governance

## Status

Founder-approved for FIP-005E.

## Decision

Initial Founder establishment is a one-time, non-HTTP administrative ceremony using only `rems_founder_bootstrap` through `FOUNDER_BOOTSTRAP_DATABASE_URL`. The operator supplies an exact verified issuer/subject pair, a stable executive identifier, display name, and the literal confirmation `ESTABLISH-INITIAL-FOUNDER`. One transaction creates the root unit, active identity, Founder membership, active link, and audit event. Any existing Founder identity, Founder membership, Founder link, bootstrap root, missing migration, malformed input, wrong database role, or database error closes the attempt without partial writes. Provider email, roles, groups, titles, and scopes are not inputs.

Afterward, `add`, `suspend`, `reactivate`, `replace`, and `remove` run only in the controlled CLI using `rems_identity_admin`. They verify an OIDC bearer token and resolve its exact active link to an active executive with persisted Founder membership. Commands never create identities or memberships and protect the final usable Founder link. Replacement creates its successor before removing its predecessor in the same transaction. Every successful mutation appends audit evidence atomically; unverifiable actors are not fabricated for rejected-attempt audit rows.

`rems_founder_bootstrap` may read and insert the initial identity, root unit, Founder membership, link, and audit event, and read the migration state; it cannot update, delete, or truncate governed records. `rems_identity_admin` may read identities, units, memberships, permissions, links, and audit records; mutate links except truncate; and append—but never alter or remove—audit events. It has no write authority over identities, units, memberships, or permissions. Neither role owns a table. The ordinary runtime remains link-SELECT-only and receives neither credential.

## Consequences and exclusions

Role bootstrap, separate credential injection, migration, and the ceremony must be separately controlled. After a successful ceremony, an administrator—not the bootstrap process—must immediately run `lockdown-founder-bootstrap-role.sql`, which executes `ALTER ROLE rems_founder_bootstrap NOLOGIN`; connection revocation or role removal remains an authorized operational choice after active sessions are handled. Issuer/subject pairs and tokens are not logged. Emergency recovery, loss of the final usable link, production provider selection, and production provisioning evidence are explicitly outside this milestone and require a future Founder-approved procedure. Code and CI evidence cannot prove that a production ceremony, lockdown, or provisioning occurred.
