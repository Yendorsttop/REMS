import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const blueprint = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');
const resources = blueprint
  .split('\n')
  .reduce<string[][]>((declarations, line) => {
    if (line.startsWith('  - ')) declarations.push([line]);
    else declarations.at(-1)?.push(line);
    return declarations;
  }, [])
  .map((lines) => lines.join('\n'));

describe('controlled staging declaration', () => {
  it('declares exactly the initial API, web, and paid database resources', () => {
    expect(resources).toHaveLength(3);
    expect(
      resources.map(
        (resource) => resource.match(/^[ ]{2}- (?:type: \S+\n[ ]{4})?name: (\S+)/m)?.[1],
      ),
    ).toEqual(['rems-staging-postgresql', 'rems-staging-api', 'rems-staging-web']);
    expect(blueprint).toMatch(/databases:[\s\S]*plan: (?!free\b)\S+/);
    expect(blueprint.match(/^[ ]{4}plan: starter$/gm)).toHaveLength(2);
  });

  it('selects the runtime Docker targets and disables automatic deployment', () => {
    for (const target of ['api', 'web']) expect(blueprint).toContain(`value: ${target}`);
    expect(blueprint.match(/autoDeploy: false/g)).toHaveLength(2);
  });

  it('pins every resource to the Founder-approved Oregon region', () => {
    for (const resource of resources) {
      expect(resource.match(/^[ ]{4}region: oregon$/gm)).toHaveLength(1);
      expect(resource).not.toMatch(/^[ ]{4}region: (?!oregon$).+/m);
    }
  });

  it('keeps the application credential externally injected and out of web', () => {
    expect(blueprint).toMatch(/key: DATABASE_URL\n\s+sync: false/);
    const web = blueprint.split('name: rems-staging-web')[1]!;
    expect(web).not.toMatch(/DATABASE_URL|PASSWORD|SECRET|TOKEN/);
    for (const forbidden of [
      'FOUNDER_BOOTSTRAP_DATABASE_URL',
      'IDENTITY_ADMIN_DATABASE_URL',
      'AUDIT_READER_DATABASE_URL',
      'SECURITY_READER_DATABASE_URL',
      'BACKUP_DATABASE_URL',
      'RESTORE_DATABASE_URL',
      'EMERGENCY',
      'MIGRATION_DATABASE_URL',
    ])
      expect(blueprint).not.toContain(forbidden);
  });

  it('does not provision or automatically execute release migrations', () => {
    expect(blueprint).not.toMatch(/rems-staging-release|value: migration/);
    expect(blueprint).not.toMatch(/^\s*- type: (?:worker|cron)\s*$/m);
    expect(blueprint).not.toMatch(/preDeployCommand|pre-deploy|prisma:migrate|numInstances/);
  });
});
