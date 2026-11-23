import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('conversation lookup distinguishes existing chats from newly created chats', async () => {
  const conversations = await read('../lib/conversations.ts');
  assert.match(conversations, /return \{ conversation: existing, error: null, created: false \}/);
  assert.match(conversations, /return \{ conversation: inserted, error: null, created: true \}/);
});

test('a contextual opening message is sent only when the conversation is new', async () => {
  const button = await read('../components/MessageSellerButton.tsx');
  assert.match(button, /starterMessage\?: string/);
  assert.match(button, /findOrCreateConversation\(listingId, user\.id, sellerId\)/);
  assert.match(button, /if \(created && starterMessage\?\.trim\(\)\)/);
  assert.match(button, /sendMessage\(conversation\.id, user\.id, starterMessage\)/);
  assert.match(button, /router\.push/);
});

test('listing type determines the first questions sent to the seller', async () => {
  const detail = await read('../app/listing/[id]/page.tsx');
  assert.match(detail, /sellerStarterMessage = isRentalListing/);
  assert.match(detail, /monthly rent, deposit, utility costs, amenities, distance to campus/);
  assert.match(detail, /monthly share, how bills are split, house rules/);
  assert.match(detail, /exact model, seller-reported condition, what is included, any known defects/);
  assert.match(detail, /total price, expected turnaround/);
  assert.match(detail, /starterMessage=\{sellerStarterMessage\}/);
  assert.match(detail, /Ask about future availability/);
});

test('a failed automatic first message does not block opening the conversation', async () => {
  const button = await read('../components/MessageSellerButton.tsx');
  assert.match(button, /if \(starterError\)/);
  assert.match(button, /Chat opened, but your opening message could not be sent/);
  assert.match(button, /router\.push/);
});
