import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('legacy business creation derives a missing institution from the authenticated active account', async () => {
  const sql = await read('../supabase/migrations/20261027165000_business_institution_compatibility_20261027.sql');
  assert.match(sql, /IF NEW\.institution_id IS NULL THEN[\s\S]*?NEW\.institution_id := private\.current_active_institution_id\(\)/);
  assert.match(sql, /NEW\.owner_id <> auth\.uid\(\)/);
  assert.match(sql, /USING ERRCODE = '42501'/);
});

test('business creation handles request failures and validates required fields', async () => {
  const profile = await read('../app/profile/page.tsx');
  assert.match(profile, /Business profile request failed/);
  assert.match(profile, /placeholder="Business name" maxLength=\{120\} required/);
  assert.match(profile, /placeholder="Location" maxLength=\{120\} required/);
});

test('signup, sign-in and password recovery show recoverable errors after network failures', async () => {
  const auth = await read('../app/signin/page.tsx');
  assert.match(auth, /Signup request failed/);
  assert.match(auth, /Sign-in request failed/);
  assert.match(auth, /Password reset request failed/);
});

test('manual delivery WhatsApp contact link normalizes the phone number before opening WhatsApp', async () => {
  const queue = await read('../components/ManualDeliveryRequests.tsx');
  assert.match(queue, /wa\.me\/\$\{request\.contact_phone\.replace\(\/\[\^0-9\]\/g, ''\)\}/);
});
