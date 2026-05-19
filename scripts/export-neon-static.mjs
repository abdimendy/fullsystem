/**
 * Export Neon DB → frontend/public/_data/live/*.json
 * Used at Netlify build so GET /api works even when function quota is exceeded.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'frontend', 'public', '_data', 'live');
const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.log('[export-neon-static] DATABASE_URL not set — skip live export');
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const db = neon(url);

const BIZ_FROM = `FROM "Businesses" b INNER JOIN "Categories" c ON c."Id" = b."CategoryId"`;
const BIZ_COLS = `b."Id", b."Name", b."Phone", b."Email", b."Address", b."Description",
  b."CategoryId", c."Name" AS "CategoryName", b."LogoUrl", b."Website", b."City",
  b."Rating", b."IsFeatured", b."IsApproved", b."ImageUrlsJson", b."OpeningHoursJson",
  b."Latitude", b."Longitude", b."CreatedAt"`;

function mapBusiness(row) {
  let imageUrls = [];
  let openingHours = {};
  try {
    if (row.ImageUrlsJson) imageUrls = JSON.parse(row.ImageUrlsJson);
  } catch {
    /* ignore */
  }
  try {
    if (row.OpeningHoursJson) openingHours = JSON.parse(row.OpeningHoursJson);
  } catch {
    /* ignore */
  }
  return {
    id: row.Id,
    name: row.Name,
    phone: row.Phone,
    email: row.Email,
    address: row.Address,
    description: row.Description,
    categoryId: row.CategoryId,
    categoryName: row.CategoryName || '',
    logoUrl: row.LogoUrl,
    website: row.Website,
    city: row.City,
    rating: Number(row.Rating),
    isFeatured: row.IsFeatured,
    isApproved: row.IsApproved,
    imageUrls,
    openingHours,
    latitude: row.Latitude,
    longitude: row.Longitude,
    createdAt: row.CreatedAt,
  };
}

const write = (name, data) => writeFileSync(join(outDir, name), JSON.stringify(data));

try {
  await db`SELECT 1`;

  const categories = await db`
    SELECT c."Id", c."Name", c."Description", c."Icon",
      COUNT(b."Id") FILTER (WHERE b."IsApproved" = true)::int AS business_count
    FROM "Categories" c
    LEFT JOIN "Businesses" b ON b."CategoryId" = c."Id"
    GROUP BY c."Id", c."Name", c."Description", c."Icon"
    ORDER BY c."Name"`;

  const businesses = await db(
    `SELECT ${BIZ_COLS} ${BIZ_FROM} WHERE b."IsApproved" = true ORDER BY b."Name"`,
  );
  const mapped = businesses.map(mapBusiness);

  const featured = await db(
    `SELECT ${BIZ_COLS} ${BIZ_FROM} WHERE b."IsApproved" = true AND b."IsFeatured" = true ORDER BY b."Rating" DESC LIMIT 12`,
  );

  const payments = await db`
    SELECT p."Id", p."BusinessId", b."Name" AS "BusinessName", p."PayerName",
      p."Amount", p."PaymentMethod", p."TransactionNumber", p."CreatedAt"
    FROM "Payments" p
    INNER JOIN "Businesses" b ON b."Id" = p."BusinessId"
    ORDER BY p."CreatedAt" DESC`;

  const payMapped = payments.map((p) => ({
    id: p.Id,
    businessId: p.BusinessId,
    businessName: p.BusinessName || '',
    payerName: p.PayerName,
    amount: Number(p.Amount),
    paymentMethod: p.PaymentMethod,
    transactionNumber: p.TransactionNumber,
    createdAt: p.CreatedAt,
  }));

  const catMapped = categories.map((c) => ({
    id: c.Id,
    name: c.Name,
    description: c.Description,
    icon: c.Icon,
    businessCount: Number(c.business_count ?? 0),
  }));

  write(
    'health.json',
    { status: 'healthy', database: true, provider: 'netlify-static-live' },
  );
  write('categories.json', catMapped);
  write('businesses.json', mapped);
  write('featured.json', featured.map(mapBusiness));
  write('payments.json', payMapped);

  const pending = await db(
    `SELECT ${BIZ_COLS} ${BIZ_FROM} WHERE b."IsApproved" = false ORDER BY b."CreatedAt" DESC`,
  );
  write('pending.json', pending.map(mapBusiness));
  write('search.json', {
    items: mapped,
    totalCount: mapped.length,
    page: 1,
    pageSize: 12,
    totalPages: Math.max(1, Math.ceil(mapped.length / 12)),
  });

  const byCat = catMapped.map((c) => ({
    categoryName: c.name,
    count: c.businessCount,
  }));
  write('stats.json', {
    totalBusinesses: mapped.length,
    totalCategories: catMapped.length,
    totalReviews: Number((await db`SELECT COUNT(*)::int AS c FROM "Reviews"`)[0]?.c ?? 0),
    totalPayments: payMapped.length,
    totalPaymentAmount: payMapped.reduce((s, p) => s + p.amount, 0),
    pendingBusinesses: Number(
      (await db`SELECT COUNT(*)::int AS c FROM "Businesses" WHERE "IsApproved" = false`)[0]?.c ?? 0,
    ),
    businessesByCategory: byCat,
    recentBusinesses: mapped.slice(0, 5),
  });

  for (const b of mapped) {
    write(`business-${b.id}.json`, b);
  }

  const publicData = join(root, 'frontend', 'public', '_data');
  for (const name of [
    'health.json',
    'categories.json',
    'businesses.json',
    'featured.json',
    'payments.json',
    'pending.json',
    'search.json',
    'stats.json',
  ]) {
    writeFileSync(join(publicData, name), readFileSync(join(outDir, name)));
  }
  for (const b of mapped) {
    writeFileSync(join(publicData, `business-${b.id}.json`), readFileSync(join(outDir, `business-${b.id}.json`)));
  }

  console.log(`[export-neon-static] wrote ${mapped.length} businesses to _data/live/ and public/_data/`);
} catch (err) {
  console.error('[export-neon-static] failed:', err.message || err);
  process.exit(1);
}
