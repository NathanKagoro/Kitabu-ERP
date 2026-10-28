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
  passwordSet: boolean;
}

const USER_ID = '00000000-0000-7000-8000-0000000000aa';
const SHOP_ID = '00000000-0000-7000-8000-0000000000b1';

/** An unsigned token: supabase-js reads its claims, nothing here checks a signature. */
function fakeJwt(): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: USER_ID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

/**
 * The shop as the operator created it (the accounts function): a cosmetics
 * shop, an owner whose login still carries the setup code.
 */
function seedShop(state: ServerState) {
  const at = new Date().toISOString();
  state.rows.set('businesses', new Map([[SHOP_ID, {
    id: SHOP_ID, name: 'Neema Cosmetics', type: 'cosmetics', mode: 'duka', phone: '+255712345678', locale: 'sw',
    settings: { vatRate: 18, brandColor: '#b0225f' }, status: 'active', tin: null, vrn: null, logo_url: null,
    created_at: at, updated_at: at, deleted_at: null, synced_at: at,
  }]]));
  state.rows.set('members', new Map([['m-owner', {
    id: '00000000-0000-7000-8000-0000000000c1', business_id: SHOP_ID, user_id: USER_ID, name: 'Neema', phone: '+255712345678',
    role: 'owner', pin_hash: null, active: true, created_at: at, updated_at: at, deleted_at: null, synced_at: at,
  }]]));
}

async function fakeSupabase(page: Page): Promise<ServerState> {
  const state: ServerState = { posts: [], rows: new Map(), passwordSet: false };
  seedShop(state);

  await page.route(`${FAKE_SUPABASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const user = () => ({
      id: USER_ID, aud: 'authenticated', role: 'authenticated', email: '255712345678@phone.kitabu.app',
      app_metadata: {}, user_metadata: { must_set_password: !state.passwordSet }, created_at: new Date().toISOString(),
    });

    // Sign-in with phone + setup code, then "choose your password".
    if (url.pathname === '/auth/v1/token') {
      const body = { access_token: fakeJwt(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: user() };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (url.pathname === '/auth/v1/user') {
      if (request.method() === 'PUT') state.passwordSet = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user()) });
    }
    if (url.pathname.startsWith('/auth/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
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

    // Reads: the seeded shop and membership (sign-in and the first pull).
    const seeded = table === 'members' || table === 'businesses' ? [...(state.rows.get(table)?.values() ?? [])] : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seeded) });
  });

  return state;
}

/**
 * The owner's first day: phone + setup code, choose a password, set a PIN,
 * then setup-day bulk entry (two shades of one lipstick, counted on the
 * shelf), and the till.
 */
async function firstSignIn(page: Page) {
  await page.goto('/ingia');
  await page.getByLabel('Namba ya simu').fill('0712 345 678');
  await page.getByLabel(/^Neno siri/).fill('ktab-2468');
  await page.getByRole('button', { name: 'Ingia', exact: true }).click();

  await page.waitForURL(/\/neno-siri\/?$/);
  await page.getByLabel('Neno siri jipya').fill('neema2026');
  await page.getByLabel('Rudia neno siri').fill('neema2026');
  await page.getByRole('button', { name: 'Hifadhi na endelea' }).click();

  await page.waitForURL(/\/pin\/?$/);
  for (const round of [0, 1]) {
    void round;
    for (const digit of '1234') await page.getByRole('button', { name: digit, exact: true }).click();
  }

  // A new shop with no products starts on bulk entry.
  await page.waitForURL(/\/bidhaa\/ingiza\/?\?anza=1$/);
  await page.getByLabel('Jina la bidhaa').fill('Lipstick');
  await page.getByLabel('Rangi / shade').fill('Red 01');
  await page.getByLabel('Bei ya kuuza').fill('8000');
  await page.getByLabel('Idadi', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Rangi nyingine' }).click();
  await page.getByLabel('Rangi / shade').nth(1).fill('Nude 03');
  await page.getByLabel('Idadi', { exact: true }).nth(1).fill('5');
  await page.getByRole('button', { name: /Hifadhi zote \(2\)/ }).click();
  await page.waitForURL(/\/mauzo\/?$/);
}

test('offline sales survive a reload and sync exactly once when the connection returns', async ({ page, context }) => {
  const server = await fakeSupabase(page);
  await firstSignIn(page);

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
    await page.getByRole('button', { name: /Red 01/ }).first().click();
    await page.getByRole('button', { name: 'Lipa taslimu' }).click();
    await expect(page.getByText('Imehifadhiwa!')).toBeVisible();
    await page.getByRole('button', { name: 'Mauzo mengine' }).click();
  }

  // Reopening the app with no signal must work too: a trader closes it, the
  // bus comes, they open it again at the next stall. The sales are in
  // IndexedDB either way, but without a cached shell there is no app to show
  // them in.
  await page.reload();
  await expect(page.getByRole('button', { name: /Red 01/ }).first()).toBeVisible({ timeout: 20_000 });
  await page.goto('/hesabu/');
  await expect(page.getByText(/Hesabu ya leo/)).toBeVisible({ timeout: 20_000 });
  await page.goto('/mauzo/');
  await expect(page.getByRole('button', { name: /Red 01/ }).first()).toBeVisible({ timeout: 20_000 });

  // A whole sale after the offline reload, sheets included. This is the case
  // that broke in production: the code-split sheets had never been fetched, so
  // the first sale made offline could not show its confirmation.
  await page.getByRole('button', { name: /Red 01/ }).first().click();
  await page.getByRole('button', { name: 'Lipa taslimu' }).click();
  await expect(page.getByText('Imehifadhiwa!')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Mauzo mengine' }).click();

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
    .toEqual([4, 4, 4]);

  // Exactly once: four sale rows posted in total, no duplicates.
  const salePosts = server.posts.filter((p) => p.table === 'sales').flatMap((p) => p.ids);
  expect(salePosts).toHaveLength(4);
  expect(new Set(salePosts).size).toBe(4);

  const paymentIds = server.posts.filter((p) => p.table === 'payments').flatMap((p) => p.ids);
  expect(new Set(paymentIds).size).toBe(4);
  expect(paymentIds).toHaveLength(4);

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
  await firstSignIn(page);

  // Cold load: fresh navigation, measure JS actually transferred.
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  const sizes = new Map<string, number>();
  const types = new Map<string, string>();
  const urls = new Map<string, string>();
  client.on('Network.responseReceived', (e) => {
    types.set(e.requestId, e.type);
    const headers = Object.fromEntries(Object.entries(e.response.headers).map(([k, v]) => [k.toLowerCase(), v]));
    urls.set(e.requestId, `${e.response.url} [${headers['content-encoding'] ?? 'identity'}]`);
  });
  client.on('Network.loadingFinished', (e) => {
    if (types.get(e.requestId) === 'Script') sizes.set(e.requestId, e.encodedDataLength);
  });

  await page.goto('/mauzo/', { waitUntil: 'load' });
  await expect(page.getByRole('button', { name: /Red 01/ }).first()).toBeVisible();
  await page.waitForTimeout(300);

  // What it takes to show the grid and take a sale. Measured before the
  // deferred work starts: the sync client and the code-split sheets are both
  // fetched later, on idle, and a trader never waits on them.
  const sum = () => [...sizes.values()].reduce((a, b) => a + b, 0) / 1024;
  const firstLoadKb = sum();
  for (const [id, size] of [...sizes].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${(size / 1024).toFixed(1)} KB  ${urls.get(id)}`);
  }
  console.log(`sales screen first-load JS: ${firstLoadKb.toFixed(1)} KB`);

  // The deferred work: the sync client (only with a backend configured) and
  // the sheets warmed so they are available offline.
  await page.waitForTimeout(7000);
  console.log(`after deferred warming: ${sum().toFixed(1)} KB`);
  test.info().annotations.push({ type: 'first-load-js-kb', description: firstLoadKb.toFixed(1) });
  // 210KB, up from 200 in 0.2: on a static host the Swahili wording (~9KB)
  // ships as one cached script instead of inside every page's HTML, where
  // this test never counted it. Bytes on the wire per visit are no higher.
  expect(firstLoadKb).toBeLessThan(210);
  });
});

test('a shared phone: duplicates are caught, a cashier takes the till with a PIN, and the sale is theirs', async ({ page }) => {
  const server = await fakeSupabase(page);
  await firstSignIn(page);

  // Bulk entry: a product the shop already has, and one typed twice.
  await page.goto('/bidhaa/ingiza/');
  await page.getByLabel('Jina la bidhaa').fill('lipstick ');
  await page.getByLabel('Rangi / shade').fill('red 01');
  await expect(page.getByText('Bidhaa hii tayari iko kwenye bidhaa zako', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Ondoa mstari huu' }).click();
  await page.getByLabel('Jina la bidhaa').fill('Mascara');
  await page.getByLabel('Rangi / shade').fill('Black');
  await page.getByLabel('Idadi', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Bidhaa nyingine' }).click();
  await page.getByLabel('Jina la bidhaa').nth(1).fill('MASCARA');
  await page.getByLabel('Rangi / shade').nth(1).fill('black');
  await page.getByLabel('Idadi', { exact: true }).nth(1).fill('2');
  await expect(page.getByText('Mstari 1 unajirudia', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hifadhi zote/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Unganisha na mstari wa 1' }).click();
  await expect(page.getByLabel('Idadi', { exact: true })).toHaveValue('5');
  await expect(page.getByRole('button', { name: /Hifadhi zote \(1\)/ })).toBeEnabled();

  // Staff: Juma has no phone of his own, only a till PIN.
  await page.goto('/wafanyakazi/');
  await page.getByRole('button', { name: 'Mwalike mfanyakazi' }).click();
  await page.getByLabel('Jina').fill('Juma');
  await page.getByRole('button', { name: 'Ongeza na uweke PIN yake' }).click();
  for (const round of [0, 1]) {
    void round;
    for (const digit of '5555') await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await expect(page.getByText('Ana PIN').first()).toBeVisible();

  // The till: switch to Juma with his PIN, sell.
  await page.goto('/mauzo/');
  await page.getByRole('button', { name: 'Badilisha muuzaji' }).click();
  await expect(page.getByText('Nani anauza?')).toBeVisible();
  await page.getByRole('button', { name: /Juma/ }).click();
  for (const digit of '9999') await page.getByRole('button', { name: digit, exact: true }).click();
  await expect(page.getByText('PIN si sahihi')).toBeVisible();
  for (const digit of '5555') await page.getByRole('button', { name: digit, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Badilisha muuzaji' })).toContainText('Juma');

  await page.getByRole('button', { name: /Red 01/ }).first().click();
  await page.getByRole('button', { name: 'Lipa taslimu' }).click();
  await expect(page.getByText('Imehifadhiwa!')).toBeVisible();
  // Offers only with the customer's say-so: the tick starts empty.
  await page.getByRole('button', { name: 'Mhifadhi mteja kwa ofa' }).click();
  await expect(page.getByRole('checkbox', { name: /Amekubali kupokea ofa/ })).not.toBeChecked();

  type Row = Record<string, unknown>;
  const rows = (table: string) => [...(server.rows.get(table)?.values() ?? [])] as Row[];
  await expect.poll(() => rows('members').find((m) => m.name === 'Juma')?.id, { timeout: 20_000 }).toBeTruthy();
  const jumaId = rows('members').find((m) => m.name === 'Juma')!.id;
  await expect.poll(() => rows('sales').map((sale) => sale.member_id), { timeout: 20_000 }).toContain(jumaId);
});

test('the demo link opens a stocked hardware shop with no sign-in, and sends nothing to the server', async ({ page }) => {
  const server = await fakeSupabase(page);
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().startsWith(FAKE_SUPABASE)) requests++;
  });

  await page.goto('/demo');
  await page.waitForURL(/\/mauzo\/?$/, { timeout: 60_000 });
  await expect(page.getByText('Duka la mfano', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Saruji 50kg/ }).first()).toBeVisible();

  // Two weeks of trading, today included, split across the staff.
  await page.goto('/wafanyakazi/mauzo/');
  await expect(page.getByText('Juma')).toBeVisible();
  await expect(page.getByText('Neema')).toBeVisible();
  await page.goto('/stoo/');
  await expect(page.getByText(/Zimepungua 8/).first()).toBeVisible();

  // Opening the link again the same day keeps the shop (and a sale made in it).
  await page.goto('/mauzo/');
  await page.getByRole('button', { name: /Saruji 50kg/ }).first().click();
  await page.getByRole('button', { name: 'Lipa taslimu' }).click();
  await expect(page.getByText('Imehifadhiwa!')).toBeVisible();
  await page.goto('/demo');
  await page.waitForURL(/\/mauzo\/?$/, { timeout: 60_000 });

  expect(requests).toBe(0);
  expect(server.posts).toEqual([]);

  // Leaving goes back to the real sign-in.
  await page.getByRole('button', { name: 'Toka' }).click();
  await page.waitForURL(/\/ingia\/?$/);
});
