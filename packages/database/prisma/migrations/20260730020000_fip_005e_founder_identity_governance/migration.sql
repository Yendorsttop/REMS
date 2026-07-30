-- The controlled ceremony role is intentionally not an object owner.
GRANT SELECT, INSERT ON TABLE "ExecutiveIdentity", "OrganizationUnit", "Membership" TO rems_founder_bootstrap;
GRANT SELECT, INSERT ON TABLE "ExternalIdentityLink", "AuditEvent" TO rems_founder_bootstrap;
GRANT SELECT ON TABLE "_prisma_migrations" TO rems_founder_bootstrap;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "ExecutiveIdentity", "OrganizationUnit", "Membership", "ExternalIdentityLink", "AuditEvent" FROM rems_founder_bootstrap;

GRANT SELECT ON TABLE "ExecutiveIdentity", "OrganizationUnit", "Membership", "PermissionAssignment" TO rems_identity_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ExternalIdentityLink" TO rems_identity_admin;
GRANT SELECT, INSERT ON TABLE "AuditEvent" TO rems_identity_admin;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AuditEvent" FROM rems_identity_admin;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "ExecutiveIdentity", "OrganizationUnit", "Membership", "PermissionAssignment" FROM rems_identity_admin;
REVOKE TRUNCATE ON TABLE "ExternalIdentityLink" FROM rems_identity_admin;

-- Restate invariants so fresh and additive paths converge.
GRANT SELECT ON TABLE "ExternalIdentityLink" TO rems_application;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "ExternalIdentityLink" FROM rems_application;
REVOKE ALL ON TABLE "ExternalIdentityLink" FROM rems_audit_reader;
