import { expect, test, type Page } from '@playwright/test';

/*
 * The acceptance test from the build plan: record three sales with no
 * connection, reconnect, and check that each reaches the server exactly once.
 *
 * "The server" is a fake PostgREST, intercepted in the browser: the build is
 * pointed at an address that does not exist, and every request to it is
 * answered here. That keeps the test hermetic (no Supabase project needed)
 * while still exercising the real supabase-js client, the real outbox and the
 * real online/offline events.
 */

const FAKE_SUPABASE = 'http://127.0.0.1:54329';

interface ServerState {
  posts: { table: string; ids: string[] }[];
  rows: Map<string, Map<string, unknown>>;
}

async function fakeSupabase(page: Page): Promise<ServerState> {
  const state: ServerState = { posts: [], rows: new Map() };

  await page.route(`${FAKE_SUPABASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    // Auth is rejected, so the app falls back to the dev OTP identity.
    if (url.pathname.startsWith('/auth/')) {
      return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"no auth in test"}' });
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    }

    const table = url.pathname.replace('/rest/v1/', '');
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown> | Record<string, unknown>[];
      const list = Array.isArray(body) ? body : [body];
      state.posts.push({ table, ids: list.map((r) => String(r.id)) });
      const store = state.rows.get(table) ?? new Map();
      for (const row of list) store.set(String(row.id), row);
      state.rows.set(table, store);
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  return state;
}

async function signUpAndOnboard(page: Page) {
  await page.goto('/ingia');
  await page.getByLabel('Namba ya simu').fill('0712 345 678');
  await page.getByRole('button', { name: 'Nitumie namba' }).click();
  await page.getByLabel('Namba ya uthibitisho').fill('123456');
  await page.getByRole('button', { name: 'Thibitisha' }).click();

  await page.waitForURL('**/karibu');
  await page.getByLabel('Biashara yako inaitwa nani?').fill('Genge la Majaribio');
  await page.getByRole('button', { name: 'Endelea' }).click();
  await page.getByRole('button', { name: /Genge \/ Kibanda/ }).click();
  await page.getByRole('button', { name: 'Endelea' }).click();
  await page.getByRole('button', { name: 'Maliza' }).click();

  await page.waitForURL('**/pin');
  for (const round of [0, 1]) {
    void round;
    for (const digit of '1234') await page.getByRole('button', { name: digit, exact: true }).click();
  }
  // Prices come before the till, so setting up ends here.
  await page.waitForURL('**/bei**');
  await page.getByLabel(/^Nyanya/).fill('1000');
  await page.getByRole('button', { name: 'Hifadhi na anza kuuza' }).click();
  await page.waitForURL('**/mauzo');
}

test('three offline sales sync exactly once when the connection returns', async ({ page, context }) => {
  const server = await fakeSupabase(page);
  await signUpAndOnboard(page);

  // Installable offline: the service worker is registered and active.
  await expect
    .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker?.getRegistration())?.active)), {
      timeout: 20_000,
    })
    .toBe(true);

  // Let the initial sync drain so we only count what happens offline.
  await expect(page.getByTitle('Tuma sasa')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(true);
  await page.waitForTimeout(1500);
  const postsBefore = server.posts.length;

  await context.setOffline(true);

  for (let i = 0; i < 3; i++) {
    // Tap 1: the tile. Tap 2: pay cash. That is the whole sale.
    await page.getByRole('button', { name: /Nyanya/ }).first().click();
    await page.getByRole('button', { name: 'Lipa taslimu' }).click();
    await expect(page.getByText('Imehifadhiwa!')).toBeVisible();
    await page.getByRole('button', { name: 'Mauzo mengine' }).click();
  }

  // Nothing can have reached the server while offline.
  const offlineSalePosts = server.posts.slice(postsBefore).filter((p) => p.table === 'sales');
  expect(offlineSalePosts).toHaveLength(0);

  await context.setOffline(false);

  // Wait for the whole sale to land -- sales, lines and payments go up as
  // separate requests, so waiting on one table alone would race the others.
  await expect
    .poll(
      () => ['sales', 'sale_lines', 'payments'].map((table) => server.rows.get(table)?.size ?? 0),
      { timeout: 20_000 }
    )
    .toEqual([3, 3, 3]);

  // Exactly once: three sale rows posted in total, no duplicates.
  const salePosts = server.posts.filter((p) => p.table === 'sales').flatMap((p) => p.ids);
  expect(salePosts).toHaveLength(3);
  expect(new Set(salePosts).size).toBe(3);

  const paymentIds = server.posts.filter((p) => p.table === 'payments').flatMap((p) => p.ids);
  expect(new Set(paymentIds).size).toBe(3);
  expect(paymentIds).toHaveLength(3);

  // And the phone agrees it has nothing left to send.
  const pending = () => page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('hesabu');
        open.onsuccess = () => {
          const count = open.result.transaction('outbox').objectStore('outbox').count();
          count.onsuccess = () => resolve(count.result);
          count.onerror = () => reject(count.error);
        };
        open.onerror = () => reject(open.error);
      })
  );
  await expect.poll(pending, { timeout: 10_000 }).toBe(0);
});

test.describe('data budget', () => {
  // Measure the network, not the service worker cache.
  test.use({ serviceWorkers: 'block' });

test('the sales screen fits the data budget on a cold load', async ({ page }) => {
  await fakeSupabase(page);
  await signUpAndOnboard(page);

  // Cold load: fresh navigation, measure JS actually transferred.
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  const sizes = new Map<string, number>();
  const types = new Map<string, string>();
  const urls = new Map<string, string>();
  client.on('Network.responseReceived', (e) => {
    types.set(e.requestId, e.type);
    urls.set(e.requestId, `${e.response.url} [${e.response.headers['content-encoding'] ?? 'identity'}]`);
  });
  client.on('Network.loadingFinished', (e) => {
    if (types.get(e.requestId) === 'Script') sizes.set(e.requestId, e.encodedDataLength);
  });

  await page.goto('/mauzo', { waitUntil: 'load' });
  await expect(page.getByRole('button', { name: /Nyanya/ }).first()).toBeVisible();
  await page.waitForTimeout(500);

  // What it takes to show the grid and take a sale.
  const sum = () => [...sizes.values()].reduce((a, b) => a + b, 0) / 1024;
  const firstLoadKb = sum();
  for (const [id, size] of [...sizes].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${(size / 1024).toFixed(1)} KB  ${urls.get(id)}`);
  }
  console.log(`sales screen first-load JS: ${firstLoadKb.toFixed(1)} KB`);

  // The sync client arrives later, on idle, only when a backend is configured.
  await page.waitForTimeout(5000);
  console.log(`after background sync starts: ${sum().toFixed(1)} KB`);
  test.info().annotations.push({ type: 'first-load-js-kb', description: firstLoadKb.toFixed(1) });
  expect(firstLoadKb).toBeLessThan(200);
  });
});
