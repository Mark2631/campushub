import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('student accommodation and roommate categories have dedicated normalised names', async () => {
  const categories = await read('../lib/categories.ts');
  assert.match(categories, /'accommodation'.*return 'Accommodation'/);
  assert.match(categories, /'rental'.*return 'Accommodation'/);
  assert.match(categories, /'roommate'.*return 'Roommates'/);
  assert.match(categories, /'flatmate'.*return 'Roommates'/);
  assert.match(categories, /'Accommodation',\s*'Roommates'/);
});

test('housing and roommate discovery filters use their own listing types', async () => {
  const [home, listings, categories] = await Promise.all([
    read('../app/page.tsx'),
    read('../lib/listings.ts'),
    read('../app/categories/page.tsx'),
  ]);

  assert.match(home, /mode === 'Housing' && listingType === 'PROPERTY_RENTAL'/);
  assert.match(home, /mode === 'Roommates' && listingType === 'ROOMMATE'/);
  assert.match(listings, /filters\.mode === 'Housing'[\s\S]*?listing_type', 'PROPERTY_RENTAL'/);
  assert.match(listings, /filters\.mode === 'Roommates'[\s\S]*?listing_type', 'ROOMMATE'/);
  assert.match(categories, /name: 'Accommodation'/);
  assert.match(categories, /name: 'Roommates'/);
});

test('creating and editing a rental or roommate listing preserves its dedicated database type', async () => {
  const listings = await read('../lib/listings.ts');
  const sell = await read('../app/sell/page.tsx');

  assert.equal((listings.match(/validated\.value\.category === 'Accommodation'/g) || []).length, 2);
  assert.equal((listings.match(/'PROPERTY_RENTAL'/g) || []).length >= 2, true);
  assert.equal((listings.match(/validated\.value\.category === 'Roommates'/g) || []).length, 2);
  assert.equal((listings.match(/'ROOMMATE'/g) || []).length >= 2, true);
  assert.match(sell, /listing\.listing_type === 'PROPERTY_RENTAL' \? 'Accommodation'/);
  assert.match(sell, /listing\.listing_type === 'ROOMMATE' \? 'Roommates'/);
  assert.match(sell, /Add the monthly rent so students can compare places/);
  assert.match(sell, /Add the neighbourhood or campus area/);
  assert.match(sell, /requiresListingPhoto && images\.length \+ existingMediaUrls\.length === 0/);
  assert.match(sell, /options\?\.skipMedia && requiresListingPhoto && existingMediaUrls\.length === 0/);
  assert.match(sell, /Use your own photos, not catalogue images/);
  assert.match(sell, /battery health if known, repairs, accessories and every known defect/);
  assert.match(sell, /edition, course or unit/);
  assert.match(sell, /dimensions, material, condition/);
  assert.match(detail, /Seller-reported condition/);
});

test('rental and roommate cards and detail pages use monthly pricing and relevant actions', async () => {
  const [card, detail, message] = await Promise.all([
    read('../components/ListingCard.tsx'),
    read('../app/listing/[id]/page.tsx'),
    read('../components/MessageSellerButton.tsx'),
  ]);

  assert.match(card, /listing\.listing_type === 'PROPERTY_RENTAL'/);
  assert.match(card, /listing\.listing_type === 'ROOMMATE'/);
  assert.match(card, /\/mo/);
  assert.match(detail, /isRentalListing \? "Monthly rent" : isRoommateListing \? "Monthly share"/);
  assert.match(detail, /Arrange a viewing/);
  assert.match(detail, /Contact about sharing/);
  assert.match(message, /label = 'Message Seller'/);
});

test('rentals and roommate listings cannot enter physical-product checkout', async () => {
  const [detail, checkout] = await Promise.all([
    read('../app/listing/[id]/page.tsx'),
    read('../app/orders/new/page.tsx'),
  ]);
  assert.match(detail, /listing\.listing_type === 'PHYSICAL_PRODUCT'[\s\S]*?<BuyOrderButton/);
  assert.match(checkout, /isDirectPurchaseListing\(listing\)/);
});
