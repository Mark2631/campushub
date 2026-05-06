import type { Listing } from './listings';

type LaunchListingInput = {
  id: string;
  title: string;
  description: string;
  category: Listing['category'];
  price: number;
  negotiable: boolean;
  condition: string;
  location: string;
  created_at: string;
  isBusiness?: boolean;
};

const launchSellerName = 'CampusTrader Admin';
const launchSellerId = 'launch-admin';
const launchUserId = 'launch-admin';
const launchBusinessId = 'launch-business';

function makeLaunchListing(input: LaunchListingInput): Listing {
  return {
    id: input.id,
    user_id: launchUserId,
    seller_id: launchSellerId,
    business_id: input.isBusiness ? launchBusinessId : null,
    title: input.title,
    description: input.description,
    category: input.category,
    price: input.price,
    negotiable: input.negotiable,
    condition: input.condition,
    status: 'active',
    location: input.location,
    media_urls: [],
    video_url: null,
    created_at: input.created_at,
    updated_at: input.created_at,
    sellerName: launchSellerName,
    sellerType: input.isBusiness ? 'business' : 'student',
    badgeType: 'blue',
  };
}

export const mockListings: Listing[] = [
  makeLaunchListing({
    id: 'mock-hp-elitebook-840-g5',
    title: 'HP EliteBook 840 G5',
    description:
      'Reliable student laptop for assignments, research, online classes, and light design work. Comes with charger. Good for business students and web development practice.',
    category: 'Electronics',
    price: 32000,
    negotiable: true,
    condition: 'Used',
    location: 'MUST Gate',
    created_at: '2026-05-05T08:00:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-scientific-calculator',
    title: 'Scientific Calculator',
    description:
      'Good condition scientific calculator suitable for accounting, economics, statistics, and finance units.',
    category: 'Electronics',
    price: 850,
    negotiable: false,
    condition: 'Used',
    location: 'Main Campus',
    created_at: '2026-05-05T07:45:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-bluetooth-speaker',
    title: 'Bluetooth Speaker',
    description:
      'Portable Bluetooth speaker for hostel use, small group study breaks, and outdoor hangouts. Battery still holds charge well.',
    category: 'Electronics',
    price: 1800,
    negotiable: true,
    condition: 'Used',
    location: 'Hostels',
    created_at: '2026-05-05T06:30:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-refurbished-samsung-a32',
    title: 'Refurbished Samsung A32',
    description:
      'Refurbished Samsung phone for everyday campus use, social media, browsing, and mobile payments. Clean body and tested battery.',
    category: 'Refurbished',
    price: 14500,
    negotiable: true,
    condition: 'Refurbished',
    location: 'Nchiru',
    created_at: '2026-05-05T06:10:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-refurbished-lenovo-thinkpad',
    title: 'Refurbished Lenovo ThinkPad',
    description:
      'Durable refurbished ThinkPad suitable for coding, class work, documents, and online jobs. Ideal for students who need a reliable work machine.',
    category: 'Refurbished',
    price: 28000,
    negotiable: true,
    condition: 'Refurbished',
    location: 'Meru Town',
    created_at: '2026-05-05T05:50:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-study-table',
    title: 'Study Table',
    description:
      'Compact study table suitable for hostel rooms. Good for reading, laptop work, and exam preparation.',
    category: 'Furniture',
    price: 2500,
    negotiable: true,
    condition: 'Used',
    location: 'Hostels',
    created_at: '2026-05-05T05:20:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-single-bed-frame',
    title: 'Single Bed Frame',
    description:
      'Strong single bed frame for students moving into hostels or rentals near campus.',
    category: 'Furniture',
    price: 4000,
    negotiable: true,
    condition: 'Used',
    location: 'Near MUST',
    created_at: '2026-05-05T04:55:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-financial-accounting-textbook',
    title: 'Financial Accounting Textbook',
    description:
      'Useful textbook for financial accounting units. Suitable for practice, revision, and examples.',
    category: 'Books',
    price: 1200,
    negotiable: false,
    condition: 'Used',
    location: 'Library Area',
    created_at: '2026-05-05T04:30:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-microeconomics-notes-pack',
    title: 'Microeconomics Notes Pack',
    description:
      'Organized Principles of Microeconomics notes covering demand, supply, elasticity, consumer theory, and market structures.',
    category: 'Books',
    price: 300,
    negotiable: false,
    condition: 'Used',
    location: 'Main Campus',
    created_at: '2026-05-05T04:00:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-chapati-beans-delivery',
    title: 'Chapati & Beans Delivery',
    description:
      'Affordable campus meal delivery around hostels and nearby student rentals. Good for lunch or supper.',
    category: 'Food',
    price: 120,
    negotiable: false,
    condition: 'Service',
    location: 'Hostels',
    created_at: '2026-05-04T19:30:00.000Z',
    isBusiness: true,
  }),
  makeLaunchListing({
    id: 'mock-fresh-juice-vendor',
    title: 'Fresh Juice Vendor',
    description:
      'Fresh fruit juice available near campus. Suitable for students looking for quick and healthy refreshment.',
    category: 'Food',
    price: 80,
    negotiable: false,
    condition: 'Service',
    location: 'MUST Gate',
    created_at: '2026-05-04T18:50:00.000Z',
    isBusiness: true,
  }),
  makeLaunchListing({
    id: 'mock-hair-braiding-service',
    title: 'Hair Braiding Service',
    description:
      'Student-friendly hair braiding service with neat finishing. Suitable for simple styles, protective styles, and weekend appointments.',
    category: 'Services',
    price: 800,
    negotiable: true,
    condition: 'Service',
    location: 'Nchiru',
    created_at: '2026-05-04T18:20:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-phone-screen-repair',
    title: 'Phone Screen Repair',
    description:
      'Phone screen replacement and minor phone repair service near campus. Diagnosis before repair recommended.',
    category: 'Services',
    price: 1500,
    negotiable: true,
    condition: 'Service',
    location: 'Meru Town',
    created_at: '2026-05-04T17:40:00.000Z',
    isBusiness: true,
  }),
  makeLaunchListing({
    id: 'mock-laundry-pickup-service',
    title: 'Laundry Pickup Service',
    description:
      'Laundry pickup and delivery service for students in hostels and nearby rentals. Convenient during busy school weeks.',
    category: 'Services',
    price: 250,
    negotiable: false,
    condition: 'Service',
    location: 'Hostels',
    created_at: '2026-05-04T17:10:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-printing-and-typing-services',
    title: 'Printing and Typing Services',
    description:
      'Typing, printing, photocopying, and document formatting services for assignments, reports, and class notes.',
    category: 'Services',
    price: 20,
    negotiable: false,
    condition: 'Service',
    location: 'Main Gate',
    created_at: '2026-05-04T16:40:00.000Z',
    isBusiness: true,
  }),
  makeLaunchListing({
    id: 'mock-mens-sneakers',
    title: 'Men’s Sneakers',
    description:
      'Clean second-hand sneakers suitable for daily campus wear. Comfortable and affordable.',
    category: 'Fashion',
    price: 1500,
    negotiable: true,
    condition: 'Used',
    location: 'Nchiru',
    created_at: '2026-05-04T16:05:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-graduation-suit-rental',
    title: 'Graduation Suit Rental',
    description:
      'Smart suit rental for presentations, interviews, events, and graduation-style photoshoots.',
    category: 'Fashion',
    price: 700,
    negotiable: false,
    condition: 'Service',
    location: 'Meru Town',
    created_at: '2026-05-04T15:40:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-hostel-moving-help',
    title: 'Hostel Moving Help',
    description:
      'Affordable help for students moving items between hostels, rentals, or campus pickup points.',
    category: 'Other',
    price: 500,
    negotiable: true,
    condition: 'Service',
    location: 'Around Campus',
    created_at: '2026-05-04T15:10:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-event-photography',
    title: 'Event Photography',
    description:
      'Photography for birthdays, club events, student campaigns, and small campus occasions.',
    category: 'Other',
    price: 2000,
    negotiable: true,
    condition: 'Service',
    location: 'MUST',
    created_at: '2026-05-04T14:35:00.000Z',
  }),
  makeLaunchListing({
    id: 'mock-baseball-glove',
    title: 'Baseball Glove',
    description:
      'Used baseball glove suitable for practice and beginners joining campus baseball sessions.',
    category: 'Other',
    price: 1200,
    negotiable: false,
    condition: 'Used',
    location: 'Sports Field',
    created_at: '2026-05-04T14:00:00.000Z',
  }),
];

export function getMockListings(limit?: number) {
  return typeof limit === 'number' ? mockListings.slice(0, limit) : mockListings;
}

export function getMockListingById(id: string) {
  return mockListings.find((listing) => listing.id === id) ?? null;
}
