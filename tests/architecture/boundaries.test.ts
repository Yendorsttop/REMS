import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
describe('constitutional module boundary', () => {
  it('prevents non-RED packages from defining executive authority vocabulary', () => {
    const forbidden =
      /\b(class|interface)\s+(ExecutiveIdentity|Membership|PermissionAssignment|OrganizationUnit)\b/;
    const violations = files('packages').filter(
      (path) =>
        !path.includes('red-001') &&
        !path.includes('testing') &&
        !path.includes('contracts') &&
        path.endsWith('.ts') &&
        forbidden.test(readFileSync(path, 'utf8')),
    );
    expect(violations).toEqual([]);
  });
});
