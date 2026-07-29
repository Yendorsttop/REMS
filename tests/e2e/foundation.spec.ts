import { expect, test } from '@playwright/test';
test('serves the governed RED-001 foundation', async ({ request }) => {
  const response = await request.get('/');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain('Executive authority');
  expect(html).toContain('Production persistence, OIDC verification');
});
