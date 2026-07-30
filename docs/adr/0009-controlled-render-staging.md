# ADR 0009: Controlled Render staging and external operational evidence

## Status

Founder-approved repository preparation; no staging resources have been provisioned or deployed.

## Decision

The staging declaration is a Render Blueprint with four separately governed resources: paid
PostgreSQL, API, web, and a normally suspended manual release-migration executor. A non-secret
`REMS_TARGET` selects the existing `api`, `web`, or `migration` Docker target. Automatic deployments
are disabled. Region is deliberately omitted because a legally or operationally material region
selection remains Founder-controlled. Applying the Blueprint, selecting the region, and incurring
cost require a separate approval outside this repository change.

The API alone receives an externally injected `DATABASE_URL` whose PostgreSQL user is
`rems_application`. The web has no database setting. The release executor alone receives
`MIGRATION_DATABASE_URL` for `rems_migration_owner` and remains at zero instances except during one
observed release. Render's generated database owner URL is not attached to ordinary services.
Founder-bootstrap, identity-admin, audit-reader, security-reader, backup, restoration, and emergency
credentials remain in separately authorized, ephemeral processes and external custody.

Auth0 is a provider-neutral OIDC implementation choice for staging, not an authority source. A
separate staging tenant proves identity using an HTTPS issuer, an API-specific audience, and the
approved asymmetric RS256 algorithm. Provider roles never elevate REMS authority. Exact issuer and
subject linking is performed only by RED-001 controlled administration. Cloudflare may later publish
a Founder-approved staging hostname; it does not select a production domain. Better Stack may poll
minimal health endpoints and must not receive sensitive data. Provider-independent encrypted
logical backups are created and restored through separately custodied authorities.

Required operational records remain outside Git. The staging evidence gate validates only the
presence and review shape of redacted references and fails closed for absent or placeholder records.

## Consequences and limitations

The Blueprint is infrastructure declaration, not deployment evidence. Render administration,
credentials, custody records, actual Auth0/Cloudflare/Better Stack configuration, monitoring
delivery, backup media, recovery performance, and observed evidence are external. A successful
staging deployment is not production certification. Production deployment, domain, region,
Founder-bootstrap ceremony, and certification remain separately Founder-controlled.
