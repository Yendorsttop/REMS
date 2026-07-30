-- Run through an authorized administrative connection immediately after a
-- successful Founder ceremony. This is deliberately separate from the CLI.
\set ON_ERROR_STOP on
ALTER ROLE rems_founder_bootstrap NOLOGIN;
