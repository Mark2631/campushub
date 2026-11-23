import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('request lifecycle updates require the signed-in owner and only allow open/fulfilled transitions', async () => {
  const requests = await read('../lib/itemRequests.ts');
  assert.match(requests, /export async function updateItemRequestStatus/);
  assert.match(requests, /status: 'open' \| 'fulfilled'/);
  assert.match(requests, /supabase\.auth\.getUser\(\)/);
  assert.match(requests, /authData\.user\?\.id !== userId/);
  assert.match(requests, /\.eq\('id', requestId\)/);
  assert.match(requests, /\.eq\('user_id', userId\)/);
  assert.match(requests, /\.in\('status', \['open', 'fulfilled'\]\)/);
  assert.match(requests, /updated_at: updatedAt/);
  assert.match(requests, /if \(!data \|\| data\.id !== requestId \|\| data\.status !== status\)/);
});

test('request owners can fulfil and reopen without removing their request history', async () => {
  const home = await read('../app/page.tsx');
  assert.match(home, /changeRequestStatus = async \(request: ItemRequest, status: 'open' \| 'fulfilled'\)/);
  assert.match(home, /user\.id !== request\.user_id/);
  assert.match(home, /Mark fulfilled/);
  assert.match(home, /Reopen request/);
  assert.match(home, /Fulfilled · no longer shown to other students/);
  assert.match(home, /setRequests\(\(current\) => current\.map/);
  assert.match(home, /campustrader:requests-refresh/);
});

test('only open requests can start a student-to-student response conversation', async () => {
  const home = await read('../app/page.tsx');
  assert.match(home, /request\.status === 'open' \? \(/);
  assert.match(home, /I can help with this/);
  assert.match(home, /This request is no longer open/);
});

test('request fulfilment does not change the database schema or tenant identity fields', async () => {
  const requests = await read('../lib/itemRequests.ts');
  const statusFunction = requests.slice(requests.indexOf('export async function updateItemRequestStatus'));
  assert.match(statusFunction, /\.update\(\{ status, updated_at: updatedAt \}\)/);
  assert.doesNotMatch(statusFunction, /institution_id|campus:|user_id:/);
  assert.match(statusFunction, /\.eq\('user_id', userId\)/);
});
