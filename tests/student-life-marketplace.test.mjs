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
  const [listings, sell, detail] = await Promise.all([
    read('../lib/listings.ts'),
    read('../app/sell/page.tsx'),
    read('../app/listing/[id]/page.tsx'),
  ]);

  assert.equal((listings.match(/validated\.value\.category === 'Accommodation'/g) || []).length, 2);
  assert.equal((listings.match(/'PROPERTY_RENTAL'/g) || []).length >= 2, true);
  assert.equal((listings.match(/validated\.value\.category === 'Roommates'/g) || []).length, 2);
  assert.equal((listings.match(/'ROOMMATE'/g) || []).length >= 2, true);
  assert.match(sell, /listing\.listing_type === 'PROPERTY_RENTAL' \? 'Accommodation'/);
  assert.match(sell, /listing\.listing_type === 'ROOMMATE' \? 'Roommates'/);
  assert.match(sell, /Add the monthly rent so students can compare places/);
  assert.match(sell, /condition: ''/);
  assert.match(sell, /!\['Services', 'Accommodation', 'Roommates', 'Refurbished'\]\.includes\(formData\.category\)/);
  assert.match(sell, /Choose condition/);
  assert.match(sell, /Choose the seller-reported condition/);
  assert.match(sell, /condition: formData\.condition/);
  assert.doesNotMatch(sell, /condition: normalizeListingCondition\(formData\.condition, formData\.category\)/);
  assert.match(listings, /Choose the seller-reported condition/);
  assert.match(sell, /nextCategory === 'Services' \? 'service' : nextCategory === 'Refurbished' \? 'refurbished' : ''/);
  assert.match(sell, /Add the neighbourhood or campus area/);
  assert.match(sell, /approximate distance to campus/);
  assert.match(sell, /requiresListingPhoto && images\.length \+ existingMediaUrls\.length === 0/);
  assert.match(sell, /options\?\.skipMedia && requiresListingPhoto && existingMediaUrls\.length === 0/);
  assert.match(sell, /Use your own photos, not catalogue images/);
  assert.match(sell, /battery health if known, repairs, accessories and every known defect/);
  assert.match(sell, /edition, course or unit/);
  assert.match(sell, /dimensions, material, condition/);
  assert.match(detail, /Seller-reported condition/);
});

test('housing owners manage posts as available or unavailable rather than sold', async () => {
  const profile = await read('../app/profile/page.tsx');
  assert.match(profile, /function isLivingListing\(listing: Pick<Listing, 'listing_type'>\)/);
  assert.match(profile, /isLivingListing\(listing\) \? 'Mark unavailable' : 'Sold'/);
  assert.match(profile, /'Make available'/);
  assert.match(profile, /Marked as unavailable and removed from the marketplace/);
  assert.match(profile, /Sold \/ unavailable/);
  assert.match(profile, /isLivingListing\(listing\) && listing\.status === 'sold' \? 'Unavailable'/);
});

test('public unavailable rental and roommate pages use accurate status language', async () => {
  const detail = await read('../app/listing/[id]/page.tsx');
  assert.match(detail, /const unavailableLabel = isLivingListing \? 'Unavailable' : 'Sold'/);
  assert.match(detail, /This accommodation is currently marked unavailable/);
  assert.match(detail, /This roommate opening is currently marked unavailable/);
  assert.match(detail, /Ask about future availability/);
  assert.match(detail, /Need help confirming the listing details or arranging a viewing/);
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
  assert.match(detail, /Message about viewing/);
  assert.match(detail, /Message about sharing/);
  assert.match(detail, /Details last updated/);
  assert.match(message, /label = 'Message Seller'/);
});

test('students can post an item request directly from the homepage', async () => {
  const home = await read('../app/page.tsx');
  assert.match(home, /href="\/sell\?mode=request"/);
  assert.match(home, /ask the campus for what you need/);
});

test('budget shortcuts open low-to-high product discovery for price-sensitive students', async () => {
  const home = await read('../app/page.tsx');
  assert.match(home, /aria-label="Browse by budget"/);
  assert.match(home, /\[500, 1000, 3000\]/);
  assert.match(home, /setMode\('Products'\)/);
  assert.match(home, /setSort\('price-low'\)/);
  assert.match(home, /maxPrice: String\(ceiling\)/);
  assert.match(home, /Under KSh \{ceiling\.toLocaleString\('en-KE'\)\}/);
});

test('housing filters use monthly labels and do not retain product condition filters', async () => {
  const home = await read('../app/page.tsx');
  assert.match(home, /Monthly rent range \(KSh\)/);
  assert.match(home, /Monthly share range \(KSh\)/);
  assert.match(home, /mode !== 'Housing' && mode !== 'Roommates'/);
  assert.match(home, /value === 'Housing' \|\| value === 'Roommates'[\s\S]*?condition: 'all'/);
  assert.match(home, /event\.target\.value === 'Accommodation' \|\| event\.target\.value === 'Roommates'[\s\S]*?condition: 'all'/);
});

test('listing reports collect category-specific marketplace trust issues', async () => {
  const [reports, reportButton, detail] = await Promise.all([
    read('../lib/reports.ts'),
    read('../components/ReportButton.tsx'),
    read('../app/listing/[id]/page.tsx'),
  ]);
  assert.match(reports, /Suspected counterfeit or fake product/);
  assert.match(reports, /Product condition or photos do not match/);
  assert.match(reports, /Rental is no longer available/);
  assert.match(reports, /Rent or deposit differs from listing/);
  assert.match(reports, /Roommate post is no longer available/);
  assert.match(reports, /Monthly share or bills differ from listing/);
  assert.match(reports, /Service differs from listing/);
  assert.match(reportButton, /getReportReasons\(targetType, context\)/);
  assert.match(detail, /context=\{isRentalListing \? 'accommodation' : isRoommateListing \? 'roommate'/);
});

test('active accommodation and roommate listings can be reconfirmed without changing status', async () => {
  const profile = await read('../app/profile/page.tsx');
  const listings = await read('../lib/listings.ts');
  assert.match(profile, /listing\.status === 'active' && isLivingListing\(listing\)/);
  assert.match(profile, /handleListingStatus\(listing\.id, 'active'\)/);
  assert.match(profile, /'Confirm available'/);
  assert.match(profile, /wasAlreadyActive = changedListing\?\.status === 'active'/);
  assert.match(profile, /Availability reconfirmed\. The listing freshness date has been updated/);
  assert.match(listings, /\.update\(\{ status \}\)/);
  assert.match(listings, /\.eq\('seller_id', sellerId\)/);
});

test('rentals and roommate listings cannot enter physical-product checkout', async () => {
  const [detail, checkout] = await Promise.all([
    read('../app/listing/[id]/page.tsx'),
    read('../app/orders/new/page.tsx'),
  ]);
  assert.match(detail, /listing\.listing_type === 'PHYSICAL_PRODUCT'[\s\S]*?<BuyOrderButton/);
  assert.match(detail, /listing\.listing_type === 'PHYSICAL_PRODUCT' \? \([\s\S]*?<ListingInventoryManager/);
  assert.match(detail, /listing\.listing_type === 'PHYSICAL_PRODUCT' && listing\.business_id && listing\.businessDeliveryAvailable/);
  assert.match(checkout, /isDirectPurchaseListing\(listing\)/);
});
