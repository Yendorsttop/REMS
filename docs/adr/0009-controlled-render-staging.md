# ADR 0009: Controlled Render staging and external operational evidence

## Status

Founder-approved repository preparation; no staging resources have been provisioned or deployed.

## Decision

The initial staging declaration is a Render Blueprint with three separately governed resources: paid
PostgreSQL, API, and web. A non-secret `REMS_TARGET` selects the existing `api` or `web` Docker
target. Automatic deployments are disabled. The Founder-approved staging region is Oregon, USA, expressed explicitly as `oregon`
on every Blueprint resource rather than relying on Render's implicit default. Applying the Blueprint
and incurring cost still require a separate approval outside this repository change.

The API alone receives an externally injected `DATABASE_URL` whose PostgreSQL user is
`rems_application`. The web has no database setting. Render cannot represent a newly declared
background worker with zero instances, so the release-migration executor was removed from the
initial Blueprint rather than allowed to run continuously. The Blueprint contains no cron job,
pre-deploy migration command, privileged migration credential, or automatic migration path. A later,
separately Founder-approved and controlled administrative mechanism must provision and execute
migrations before API availability; until it succeeds, failure closed is intentional. Render's
generated database owner URL is not attached to ordinary services.
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

The Blueprint is a repository infrastructure declaration, not evidence that any resource was
provisioned or deployed. No staging operational certification is claimed. The region declaration records
a decision but does not prove provisioning or regional placement. Render administration,
credentials, custody records, actual Auth0/Cloudflare/Better Stack configuration, monitoring
delivery, backup media, recovery performance, and observed evidence are external. A successful
staging deployment is not production certification. Production deployment, domain, region,
Founder-bootstrap ceremony, and certification remain separately Founder-controlled.
