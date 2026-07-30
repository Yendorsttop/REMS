# FIP-005H external staging evidence template

Copy each section to the named file in an access-controlled external evidence directory. Do not
commit completed evidence, credentials, tokens, claims, personal data, provider exports, database
URLs, or backup media. The repository gate intentionally rejects these untouched templates.

Every file begins with:

```text
Evidence status: NOT_RECORDED
Recorded at (UTC): NOT_RECORDED
Reviewed by: NOT_RECORDED
Revision: NOT_RECORDED
External custody reference: NOT_RECORDED
```

| Required file            | Minimum redacted evidence                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deployment-revision.md` | reviewed commit SHA, immutable API/web image digests, Blueprint revision, the exact database/API/web inventory, and observed Oregon region (`oregon`) for all three resources |
| `migration-result.md`    | later administrative mechanism approval reference, start/end UTC, tool/image revision, exit result, and Prisma migration names/checksums; no URL                              |
| `role-ownership.md`      | redacted `inspect-security-state.sql` result, expected owners/grants, Founder-bootstrap `rolcanlogin=f`                                                                       |
| `health.md`              | HTTPS origins, UTC checks, live/ready status codes and minimal bodies                                                                                                         |
| `oidc.md`                | tenant/environment label, exact non-secret issuer/audience/algorithm and boundary review; redacted verification result                                                        |
| `backup-restoration.md`  | encrypted-media custody reference, digest, tool versions, empty restore target, timings, record-count/grant/security comparisons                                              |
| `vulnerability-scan.md`  | revision/image digest, Trivy version, unsuppressed HIGH/CRITICAL result and disposition, CycloneDX SBOM digest                                                                |
| `rollback-test.md`       | trigger, approved revision, steps, timings, health/security comparisons, outcome                                                                                              |
| `founder-review.md`      | scope reviewed, exceptions, external evidence references, explicit approve/reject decision and UTC date                                                                       |

Each file must also record operator role (not credentials), commands or provider actions in redacted
form, observed result, discrepancies, and remediation reference. Mark `Evidence status: VERIFIED` only
after an authorized reviewer validates the cited external artifacts. Run:
`./scripts/operations/verify-staging-evidence.sh <external-directory>`. Absence, placeholder text, an
invalid timestamp, or lack of a reviewer fails closed. Passing checks completeness of the record
shape only; it does not authenticate external evidence or certify staging or production.

The initial Blueprint contains no migration executor: Render cannot represent a newly declared
background worker with zero instances, and the executor was removed rather than run continuously.
Migration evidence can exist only after a later, separately Founder-approved administrative mechanism
is provisioned and completes. This template does not authorize that mechanism or establish that any
resource was provisioned or deployed. No operational certification is claimed.
