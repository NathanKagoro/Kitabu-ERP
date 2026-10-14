#!/usr/bin/env node
/**
 * Makes (or re-keys) the operator login: the account that creates shops and
 * issues setup codes from /admin. Run once, on your own computer:
 *
 *   npm run operator -- 0712345678 'a-long-password'
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * The service-role key never goes anywhere near the app or GitHub.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

import { isAcceptablePassword, loginEmail } from '../lib/auth/login.ts';

config({ path: ['.env.local', '.env'], quiet: true });

const [phone, password] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function stop(message: string): never {
  console.error(`operator — ${message}`);
  process.exit(1);
}

if (!url || !serviceKey) stop('set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
if (!phone || !password) stop("usage: npm run operator -- <phone> '<password>'");
const email = loginEmail(phone);
if (!email) stop(`${phone} is not a Tanzanian mobile number`);
if (!isAcceptablePassword(password) || password.length < 10) stop('use a password of at least 10 characters');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: existingId, error: lookupError } = await admin.rpc('auth_user_id_by_email', { p_email: email });
if (lookupError) stop(`could not reach the database (${lookupError.message}). Have the migrations run?`);

if (existingId) {
  const { error } = await admin.auth.admin.updateUserById(existingId as string, {
    password,
    app_metadata: { kitabu_admin: true },
    user_metadata: { must_set_password: false },
  });
  if (error) stop(error.message);
  console.log(`operator — ${phone} is the operator; password updated.`);
} else {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { kitabu_admin: true },
    user_metadata: { must_set_password: false },
  });
  if (error) stop(error.message);
  console.log(`operator — created. Sign in to the app with ${phone} and your password, then open /admin.`);
}
