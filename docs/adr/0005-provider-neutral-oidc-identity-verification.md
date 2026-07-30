# ADR 0005: Provider-neutral OIDC identity verification

## Status

Accepted for FIP-005D implementation; production provider provisioning and deployment remain unverified.

## Decision

REMS verifies JWT access tokens with JOSE against one explicitly approved issuer, audience, algorithm allow-list, and that issuer's remotely retrieved JWKS. JOSE performs signature, key, expiration, and `nbf` validation and caches the remote JWKS while supporting key rotation.

The verified immutable `(issuer, subject)` pair is resolved through RED-001's `ExternalIdentityLink`. A link and its executive must both be active. Authorization uses only the linked executive identifier and RED-001 permission persistence. Email, provider groups, roles, titles, scopes, and other claims do not confer REMS authority. No external claim can create Founder authority.

The request guard is wired through Nest dependency injection. Missing configuration and every verification or resolution failure deny access without logging bearer-token content.

Only link resolution is implemented. `rems_application` receives `SELECT` on the link table and is explicitly denied link writes and truncation. Link administration is intentionally not implemented. Any future link lifecycle must be separately approved as actor-authorized RED-001 commands, append audit events, and use an appropriate controlled persistence authority rather than broadening the authentication runtime preemptively.

## Audit boundary

Future link lifecycle operations are material RED-001 changes and must append actor-attributed audit events when separately approved. The current audit schema requires an executive actor. Pre-authentication rejection therefore cannot be recorded there without fabricating an identity. A future append-only system-security evidence stream should record reason codes, timestamp, issuer fingerprint, and correlation identifier—but never raw tokens or unnecessary claims—and must be separately governed before implementation.

## Consequences

No production issuer, tenant, secret, domain, or hosting vendor is selected here. Operators must provide an HTTPS issuer and intended audience. This is implemented verification, not operational certification or deployment evidence.
