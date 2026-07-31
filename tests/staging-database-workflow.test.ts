import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = '.github/workflows/staging-database-initialize.yml';
const workflow = readFileSync(path, 'utf8');

describe('controlled staging database workflow', () => {
  it('is manual-only and protected by exact dispatch gates', () => {
    expect(workflow).toMatch(/^on:\n {2}workflow_dispatch:/m);
    for (const trigger of ['push:', 'pull_request:', 'schedule:', 'workflow_call:', 'deployment:'])
      expect(workflow).not.toContain(trigger);
    expect(workflow).toContain('test "$DISPATCH_REF" = refs/heads/main');
    expect(workflow).toContain("'^[0-9a-f]{40}$'");
    expect(workflow).toContain('test "$EXPECTED_SHA" = "$DISPATCH_SHA"');
    expect(workflow).toContain('INITIALIZE REMS STAGING DATABASE');
    expect(workflow).toContain('test "$SERVICES_SUSPENDED" = true');
  });

  it('uses the protected environment and bounded least authority', () => {
    expect(workflow).toMatch(/permissions:\n {2}contents: read/);
    expect(workflow).toContain('environment: rems-staging-database');
    expect(workflow).toContain('group: rems-staging-database-initialization');
    expect(workflow).toMatch(/timeout-minutes: 20/);
    expect(workflow).toMatch(/needs: authorize[\s\S]+environment: rems-staging-database/);
  });

  it('contains no deploy, Render, ceremony, tracing, artifact, or credential-output path', () => {
    expect(workflow).not.toMatch(
      /render\.com|api\.render|deploy|founder-identity|lockdown-founder|set -x|ACTIONS_STEP_DEBUG|upload-artifact|download-artifact|pg_dump|pg_restore/i,
    );
    expect(workflow).not.toMatch(
      /echo.*(?:DATABASE_URL|PASSWORD)|printf.*(?:DATABASE_URL|PASSWORD)/i,
    );
  });

  it('pins every action to a full immutable SHA', () => {
    const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s]+)$/gm)].map((match) => match[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) expect(action).toMatch(/^[^@]+@[0-9a-f]{40}$/);
  });

  it('does not alter historical migrations or prior security artifacts', () => {
    const changed = execFileSync('git', ['diff', '--name-only', 'HEAD', '--'], { encoding: 'utf8' })
      .trim()
      .split('\n');
    expect(changed.filter((file) => file.includes('prisma/migrations/'))).toEqual([]);
    const prior = [
      'bootstrap-roles.sql',
      'bootstrap-identity-admin-role.sql',
      'bootstrap-security-reader-role.sql',
      'bootstrap-backup-role.sql',
      'inspect-security-state.sql',
      'lockdown-founder-bootstrap-role.sql',
      'reapply-restored-grants.sql',
    ];
    expect(changed.filter((file) => prior.some((name) => file.endsWith(name)))).toEqual([]);
  });
});
