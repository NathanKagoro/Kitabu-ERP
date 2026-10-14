/**
 * accounts -- the one piece of server code in Kitabu. It runs inside Supabase
 * (Edge Functions), so there is still nothing else to host.
 *
 * It exists because creating a login needs the service-role key, which can
 * never be shipped to a phone. Everything else the app does goes straight to
 * Postgres under Row Level Security.
 *
 * Actions (POST JSON { action, ... } with the caller's session token):
 *   create_shop   operator   new business + owner login -> setup code
 *   list_shops    operator   every shop, its owner and status
 *   update_shop   operator   name, type, colour, active/paused
 *   issue_code    operator, or an owner for their own staff
 *                            first login for a member, or a reset -> setup code
 *
 * The operator is any login whose app_metadata has kitabu_admin = true
 * (scripts/create-operator.ts makes one).
 *
 * Deploy: supabase functions deploy accounts
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { loginEmail, makeSetupCode, phoneDigits } from '../_shared/login.ts';
import { cleanSettingsPatch, mayIssueCode, modeForType, parseShopInput, type Role } from './rules.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const fail = (status: number, error: string) => reply(status, { ok: false, error });

function newCode(): string {
  return makeSetupCode(crypto.getRandomValues(new Uint8Array(32)));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail(405, 'method');

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return fail(401, 'signedOut');
  const isOperator = user.app_metadata?.kitabu_admin === true;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'badJson');
  }

  try {
    switch (body.action) {
      case 'create_shop':
        if (!isOperator) return fail(403, 'notOperator');
        return await createShop(admin, body);
      case 'list_shops':
        if (!isOperator) return fail(403, 'notOperator');
        return await listShops(admin);
      case 'update_shop':
        if (!isOperator) return fail(403, 'notOperator');
        return await updateShop(admin, body);
      case 'issue_code':
        return await issueCode(admin, user.id, isOperator, body);
      default:
        return fail(400, 'unknownAction');
    }
  } catch (error) {
    console.error(error);
    return fail(500, error instanceof Error ? error.message : 'serverError');
  }
});

/** An existing login for this phone, or null. */
async function findLogin(admin: SupabaseClient, email: string): Promise<string | null> {
  const { data, error } = await admin.rpc('auth_user_id_by_email', { p_email: email });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** A brand-new login whose password is the setup code; the app asks for a real one at first sign-in. */
async function createLogin(admin: SupabaseClient, email: string, name: string | null): Promise<{ userId: string; code: string }> {
  const code = newCode();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: code,
    email_confirm: true,
    user_metadata: { must_set_password: true, name },
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  return { userId: data.user.id, code };
}

async function resetLogin(admin: SupabaseClient, userId: string): Promise<string> {
  const code = newCode();
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: code,
    user_metadata: { ...(existing?.user?.user_metadata ?? {}), must_set_password: true },
  });
  if (error) throw error;
  return code;
}

async function createShop(admin: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const input = parseShopInput(body);
  if ('error' in input) return fail(400, input.error);
  const digits = phoneDigits(input.ownerPhone);
  const email = loginEmail(input.ownerPhone);
  if (!digits || !email) return fail(400, 'badPhone');

  const businessId = crypto.randomUUID();
  const settings: Record<string, unknown> = { vatRate: 18 };
  if (input.brandColor) settings.brandColor = input.brandColor;

  const { error: bizError } = await admin.from('businesses').insert({
    id: businessId,
    name: input.name,
    type: input.type,
    mode: modeForType(input.type),
    phone: `+${digits}`,
    locale: input.locale,
    settings,
    status: 'active',
  });
  if (bizError) throw bizError;

  // Someone who already has a login (an owner opening a second shop) keeps
  // their password; only a new login gets a setup code.
  let userId = await findLogin(admin, email);
  let code: string | null = null;
  if (!userId) {
    const created = await createLogin(admin, email, input.ownerName);
    userId = created.userId;
    code = created.code;
  }

  const { error: memberError } = await admin.from('members').insert({
    id: crypto.randomUUID(),
    business_id: businessId,
    user_id: userId,
    name: input.ownerName,
    phone: `+${digits}`,
    role: 'owner',
    active: true,
  });
  if (memberError) {
    await admin.from('businesses').delete().eq('id', businessId);
    throw memberError;
  }

  return reply(200, { ok: true, businessId, code, existingLogin: code === null });
}

async function listShops(admin: SupabaseClient): Promise<Response> {
  const { data: shops, error } = await admin
    .from('businesses')
    .select('id, name, type, mode, status, phone, settings, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: members, error: memberError } = await admin
    .from('members')
    .select('id, business_id, user_id, name, phone, role, active')
    .is('deleted_at', null)
    .eq('active', true);
  if (memberError) throw memberError;

  const list = (shops ?? []).map((shop) => {
    const people = (members ?? []).filter((m) => m.business_id === shop.id);
    const owner = people.find((m) => m.role === 'owner') ?? null;
    return {
      id: shop.id,
      name: shop.name,
      type: shop.type,
      status: shop.status,
      brandColor: (shop.settings as Record<string, unknown> | null)?.brandColor ?? null,
      createdAt: shop.created_at,
      owner: owner ? { memberId: owner.id, name: owner.name, phone: owner.phone, hasLogin: Boolean(owner.user_id) } : null,
      staff: people.length - (owner ? 1 : 0),
    };
  });
  return reply(200, { ok: true, shops: list });
}

async function updateShop(admin: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const businessId = typeof body.businessId === 'string' ? body.businessId : '';
  const { data: shop, error } = await admin.from('businesses').select('id, settings').eq('id', businessId).maybeSingle();
  if (error) throw error;
  if (!shop) return fail(404, 'noShop');

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === 'string' && body.name.trim().length >= 2) update.name = body.name.trim();
  if (typeof body.type === 'string' && modeForType(body.type)) {
    update.type = body.type;
    update.mode = modeForType(body.type);
  }
  if (body.status === 'active' || body.status === 'paused') update.status = body.status;
  const patch = cleanSettingsPatch(body.settings);
  if (Object.keys(patch).length) update.settings = { ...((shop.settings as Record<string, unknown>) ?? {}), ...patch };

  const { error: updateError } = await admin.from('businesses').update(update).eq('id', businessId);
  if (updateError) throw updateError;
  return reply(200, { ok: true });
}

async function issueCode(
  admin: SupabaseClient,
  callerId: string,
  isOperator: boolean,
  body: Record<string, unknown>
): Promise<Response> {
  const businessId = typeof body.businessId === 'string' ? body.businessId : '';
  const memberId = typeof body.memberId === 'string' ? body.memberId : '';

  const { data: target, error } = await admin
    .from('members')
    .select('id, business_id, user_id, name, phone, role, active')
    .eq('id', memberId)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  // A member added offline reaches the server on the next sync; the app syncs
  // before asking, so this is only seen when that sync failed.
  if (!target) return fail(404, 'noMember');

  const { data: me } = await admin
    .from('members')
    .select('role')
    .eq('business_id', businessId)
    .eq('user_id', callerId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle();

  const allowed = mayIssueCode(
    { userId: callerId, isOperator, roleThere: (me?.role as Role | undefined) ?? null },
    { userId: target.user_id, role: target.role as Role, active: target.active }
  );
  if (!allowed) return fail(403, 'notAllowed');

  if (target.user_id) {
    const code = await resetLogin(admin, target.user_id);
    return reply(200, { ok: true, code });
  }

  const email = target.phone ? loginEmail(target.phone) : null;
  if (!email) return fail(400, 'badPhone');

  // Already has a login (works at another shop too): link it, keep the password.
  let userId = await findLogin(admin, email);
  let code: string | null = null;
  if (!userId) {
    const created = await createLogin(admin, email, target.name);
    userId = created.userId;
    code = created.code;
  }
  const { error: linkError } = await admin
    .from('members')
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq('id', target.id);
  if (linkError) throw linkError;

  return reply(200, { ok: true, code, existingLogin: code === null });
}
