import { expect, test } from '@playwright/test';

test('serves the health procedure over the tRPC endpoint', { tag: '@smoke' }, async ({ request }) => {
  const response = await request.get('/api/trpc/health.get');

  expect(response.status()).toBe(200);

  const body: unknown = await response.json();
  expect(body).toMatchObject({
    result: {
      data: {
        status: 'healthy',
        components: expect.arrayContaining([
          expect.objectContaining({ name: 'postgres', reachable: true }),
        ]),
        checkedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
      },
    },
  });
});
