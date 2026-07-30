import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const blueprint = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');

describe('controlled staging declaration', () => {
  it('declares isolated API, web, release, and paid database resources', () => {
    for (const name of [
      'rems-staging-api',
      'rems-staging-web',
      'rems-staging-release',
      'rems-staging-postgresql',
    ])
      expect(blueprint).toContain(`name: ${name}`);
    expect(blueprint).toMatch(/databases:[\s\S]*plan: (?!free\b)\S+/);
  });

  it('selects each existing Docker target and disables automatic deployment', () => {
    for (const target of ['api', 'web', 'migration'])
      expect(blueprint).toContain(`value: ${target}`);
    expect(blueprint.match(/autoDeploy: false/g)).toHaveLength(3);
    expect(blueprint).toMatch(/name: rems-staging-release[\s\S]*numInstances: 0/);
  });

  it('keeps credentials externally injected and out of web', () => {
    expect(blueprint).toMatch(/key: DATABASE_URL\n\s+sync: false/);
    expect(blueprint).toMatch(/key: MIGRATION_DATABASE_URL\n\s+sync: false/);
    const web = blueprint
      .split('name: rems-staging-web')[1]!
      .split('name: rems-staging-release')[0]!;
    expect(web).not.toMatch(/DATABASE_URL|PASSWORD|SECRET|TOKEN/);
    for (const forbidden of [
      'FOUNDER_BOOTSTRAP_DATABASE_URL',
      'IDENTITY_ADMIN_DATABASE_URL',
      'AUDIT_READER_DATABASE_URL',
      'SECURITY_READER_DATABASE_URL',
      'BACKUP_DATABASE_URL',
      'RESTORE_DATABASE_URL',
      'EMERGENCY',
    ])
      expect(blueprint).not.toContain(forbidden);
  });
});
