import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

if (process.env.DATABASE_URL?.trim()) {
  console.log('[write-api-static] DATABASE_URL set — keeping Neon export in public/_data');
  process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', '_data');
mkdirSync(outDir, { recursive: true });

const U = (id) => `https://images.unsplash.com/photo-${id}?w=800&h=400&fit=crop&q=80`;

const demoCategories = [
  { id: 1, name: 'Restaurants', description: 'Dining', icon: 'restaurant', businessCount: 2 },
  { id: 2, name: 'Hotels', description: 'Hotels', icon: 'hotel', businessCount: 1 },
  { id: 3, name: 'Healthcare', description: 'Healthcare', icon: 'hospital', businessCount: 1 },
  { id: 4, name: 'Retail', description: 'Retail', icon: 'supermarket', businessCount: 1 },
  { id: 5, name: 'Services', description: 'Services', icon: 'telecom', businessCount: 1 },
  { id: 7, name: 'school', description: 'Education', icon: 'school', businessCount: 1 },
];

const demoBusinessList = [
  { id: 1, name: 'Hormuud Telecom', phone: '+252 61 5000000', email: 'info@hormuud.com', address: 'Howlwadaag, Mogadishu', city: 'Mogadishu', description: 'Leading mobile, internet and digital services across Somalia.', categoryId: 5, categoryName: 'Services', rating: 4.9, website: 'https://www.hormuud.com', logoUrl: U('1556742049-0cfed4f6a45d'), reviewCount: 4 },
  { id: 2, name: 'Mogadishu Serena Hotel', phone: '+252 61 2000000', email: 'reservations@serena.co', address: 'Airport Road, Wadajir', city: 'Mogadishu', description: 'Luxury hotel with conference halls and waterfront views.', categoryId: 2, categoryName: 'Hotels', rating: 4.8, website: null, logoUrl: U('1566073771259-6a8506099945'), reviewCount: 3 },
  { id: 3, name: 'Lido Seafood Restaurant', phone: '+252 61 7700000', email: 'hello@lidoseafood.so', address: 'Lido Beach, Mogadishu', city: 'Mogadishu', description: 'Fresh seafood and traditional Somali cuisine by the beach.', categoryId: 1, categoryName: 'Restaurants', rating: 4.7, website: null, logoUrl: U('1517248135467-4c7edcad34c4'), reviewCount: 5 },
  { id: 4, name: 'Beco Supermarket', phone: '+252 61 8800000', email: 'info@beco.so', address: 'KM4, Hodan District', city: 'Mogadishu', description: 'Groceries, household goods and fresh produce.', categoryId: 4, categoryName: 'Retail', rating: 4.6, website: null, logoUrl: U('1604719312566-8912e9227c6a'), reviewCount: 2 },
  { id: 5, name: 'SIMAD University', phone: '+252 61 4444444', email: 'info@simad.edu.so', address: 'Afgooye Road, Mogadishu', city: 'Mogadishu', description: 'Private university offering business, IT and health sciences.', categoryId: 7, categoryName: 'school', rating: 4.7, website: 'https://www.simad.edu.so', logoUrl: U('1523050854058-8df90110c9f1'), reviewCount: 4 },
  { id: 6, name: 'Golden Fork Restaurant', phone: '+252 61 7800001', email: 'info@goldenfork.so', address: 'Hodan District', city: 'Mogadishu', description: 'Popular dining spot for families and groups.', categoryId: 1, categoryName: 'Restaurants', rating: 4.5, website: null, logoUrl: U('1517248135467-4c7edcad34c4'), reviewCount: 3 },
  { id: 7, name: 'Sunrise Medical Center', phone: '+252 61 1500001', email: 'care@sunrisemedical.so', address: 'Wadajir District', city: 'Mogadishu', description: 'Outpatient care, diagnostics and emergency services.', categoryId: 3, categoryName: 'Healthcare', rating: 4.4, website: null, logoUrl: U('1519494026892-80bbd2d6fd0d'), reviewCount: 2 },
];

const demoStats = {
  totalBusinesses: demoBusinessList.length,
  totalCategories: demoCategories.length,
  totalReviews: 24,
  totalPayments: 8,
  averageRating: 4.7,
  businessesByCategory: demoCategories.map((c) => ({ categoryName: c.name, count: c.businessCount })),
  recentBusinesses: demoBusinessList.slice(0, 4),
};

const write = (name, data) => writeFileSync(join(outDir, name), JSON.stringify(data));

write('categories.json', demoCategories);
write('businesses.json', demoBusinessList);
write('featured.json', demoBusinessList.slice(0, 6));
write('stats.json', demoStats);
write('health.json', { status: 'healthy', database: true, provider: 'netlify-static' });
write('search.json', {
  items: demoBusinessList,
  totalCount: demoBusinessList.length,
  page: 1,
  pageSize: 12,
  totalPages: 1,
});
write('payments.json', []);
write('pending.json', []);
write('reviews.json', []);
write('analytics-summary.json', {
  totalPageViews: 0,
  totalBusinessViews: 0,
  totalSearches: 0,
  unreadMessages: 0,
  pendingBusinesses: 0,
  popularBusinesses: [],
});
write('upload-status.json', { cloudinary: false, local: true });

for (const b of demoBusinessList) {
  write(`business-${b.id}.json`, b);
}

console.log('Wrote public/_data/*.json');
