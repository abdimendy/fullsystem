/** Live API via Neon PostgreSQL — same database as localhost .NET API. */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { handleUpload } from './neon-upload.mjs';

const JWT_DEFAULT = 'YellowBook-Super-Secret-Key-Change-In-Production-2026!';

const BIZ_FROM = `
  FROM "Businesses" b
  INNER JOIN "Categories" c ON c."Id" = b."CategoryId"`;

const BIZ_COLS = `
  b."Id", b."Name", b."Phone", b."Email", b."Address", b."Description",
  b."CategoryId", c."Name" AS "CategoryName", b."LogoUrl", b."Website", b."City",
  b."Rating", b."IsFeatured", b."IsApproved", b."ImageUrlsJson", b."OpeningHoursJson",
  b."Latitude", b."Longitude", b."CreatedAt",
  (SELECT COUNT(*)::int FROM "Reviews" r WHERE r."BusinessId" = b."Id") AS review_count`;

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  return neon(url);
}

function jwtSecret() {
  const key =
    process.env.JWT_KEY ||
    process.env.Jwt__Key ||
    process.env['Jwt:Key'] ||
    JWT_DEFAULT;
  return new TextEncoder().encode(key);
}

function jwtIssuer() {
  return process.env.JWT_ISSUER || process.env.Jwt__Issuer || 'YellowBookAPI';
}

function jwtAudience() {
  return process.env.JWT_AUDIENCE || process.env.Jwt__Audience || 'YellowBookClient';
}

function adminCreds() {
  return {
    user: process.env.ADMIN_USER_USERNAME || process.env.AdminUser__Username || 'admin',
    pass: process.env.ADMIN_USER_PASSWORD || process.env.AdminUser__Password || 'Admin@123',
  };
}

function parseJson(val) {
  if (!val) return [];
  try {
    const p = JSON.parse(val);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function parseHours(val) {
  if (!val) return {};
  try {
    const p = JSON.parse(val);
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function mapBusiness(row) {
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
    imageUrls: parseJson(row.ImageUrlsJson),
    openingHours: parseHours(row.OpeningHoursJson),
    latitude: row.Latitude,
    longitude: row.Longitude,
    createdAt: row.CreatedAt,
    reviewCount: row.review_count != null ? Number(row.review_count) : undefined,
  };
}

function mapPayment(row) {
  return {
    id: row.Id,
    businessId: row.BusinessId,
    businessName: row.BusinessName || '',
    payerName: row.PayerName,
    amount: Number(row.Amount),
    paymentMethod: row.PaymentMethod,
    transactionNumber: row.TransactionNumber,
    createdAt: row.CreatedAt,
  };
}

function mapCategory(row) {
  return {
    id: row.Id,
    name: row.Name,
    description: row.Description,
    icon: row.Icon,
    businessCount: Number(row.business_count ?? 0),
  };
}

async function signToken(username) {
  const expiresMinutes = Number(process.env.JWT_EXPIRES_MINUTES || 480);
  const exp = Math.floor(Date.now() / 1000) + expiresMinutes * 60;
  const token = await new SignJWT({ sub: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(jwtIssuer())
    .setAudience(jwtAudience())
    .setExpirationTime(exp)
    .sign(jwtSecret());
  return {
    token,
    username,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

async function verifyAuth(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (token.startsWith('demo.') || token.startsWith('offline.')) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), {
      issuer: jwtIssuer(),
      audience: jwtAudience(),
    });
    return payload.sub || null;
  } catch {
    return null;
  }
}

async function categoryExists(db, categoryId) {
  const rows = await db`SELECT "Id" FROM "Categories" WHERE "Id" = ${Number(categoryId)} LIMIT 1`;
  return !!rows[0];
}

async function insertBusiness(db, body, { approved }) {
  const categoryId = Number(body.categoryId);
  if (!categoryId || !(await categoryExists(db, categoryId))) {
    return { error: 'Selected category does not exist.', status: 400 };
  }
  const rows = await db`
    INSERT INTO "Businesses" (
      "Name", "Phone", "Email", "Address", "Description", "CategoryId", "LogoUrl", "Website",
      "City", "Rating", "IsFeatured", "IsApproved", "ImageUrlsJson", "OpeningHoursJson",
      "Latitude", "Longitude", "CreatedAt"
    ) VALUES (
      ${String(body.name ?? '').trim()},
      ${String(body.phone ?? '').trim()},
      ${String(body.email ?? '').trim()},
      ${String(body.address ?? '').trim()},
      ${body.description?.trim() || null},
      ${categoryId},
      ${body.logoUrl?.trim() || null},
      ${body.website?.trim() || null},
      ${body.city?.trim() || 'Mogadishu'},
      ${Number(body.rating) || 4.5},
      ${!!body.isFeatured},
      ${!!approved},
      ${body.imageUrls ? JSON.stringify(body.imageUrls) : null},
      ${body.openingHours ? JSON.stringify(body.openingHours) : null},
      ${body.latitude ?? null},
      ${body.longitude ?? null},
      NOW()
    ) RETURNING "Id"`;
  const full = await selectBusinesses(db, { id: rows[0].Id });
  return { business: mapBusiness(full[0]) };
}

async function selectBusinesses(db, { approvedOnly = true, featured = false, limit, id, pending = false } = {}) {
  if (id != null) {
    const rows = await db(
      `SELECT ${BIZ_COLS} ${BIZ_FROM} WHERE b."Id" = $1 LIMIT 1`,
      [id],
    );
    return rows;
  }
  if (pending) {
    return db(`SELECT ${BIZ_COLS} ${BIZ_FROM} WHERE b."IsApproved" = false ORDER BY b."CreatedAt" DESC`);
  }
  if (featured) {
    return db(
      `SELECT ${BIZ_COLS} ${BIZ_FROM} WHERE b."IsApproved" = true AND b."IsFeatured" = true ORDER BY b."Rating" DESC LIMIT $1`,
      [limit || 6],
    );
  }
  if (approvedOnly) {
    return db(`SELECT ${BIZ_COLS} ${BIZ_FROM} WHERE b."IsApproved" = true ORDER BY b."Name"`);
  }
  return db(`SELECT ${BIZ_COLS} ${BIZ_FROM} ORDER BY b."Name"`);
}

export async function handleNeon(event, { json, empty204, getPathname, getSearchParams, parseBody }) {
  const db = getSql();
  if (!db) return null;

  const pathname = getPathname(event);
  const method = (event.httpMethod || 'GET').toUpperCase();
  const sp = getSearchParams(event);
  const body = parseBody(event);

  try {
    const uploadRes = await handleUpload(event, { json, verifyAuth, getPathname });
    if (uploadRes) return uploadRes;

    const bizId = pathname.match(/^\/?businesses\/(\d+)$/);

    if (method === 'GET' && pathname === '/health') {
      await db`SELECT 1`;
      return json(200, { status: 'healthy', database: true, provider: 'netlify-neon' });
    }

    if (method === 'POST' && pathname === '/auth/login') {
      const user = String(body.username ?? body.Username ?? '').trim();
      const pass = String(body.password ?? body.Password ?? '');
      const { user: adminUser, pass: adminPass } = adminCreds();
      let ok = false;
      try {
        const rows = await db`SELECT "Username", "PasswordHash" FROM "Users" WHERE LOWER("Username") = LOWER(${user}) LIMIT 1`;
        if (rows[0] && (await bcrypt.compare(pass, rows[0].PasswordHash))) ok = true;
      } catch {
        /* admin fallback */
      }
      if (!ok && user.toLowerCase() === adminUser.toLowerCase() && pass === adminPass) ok = true;
      if (!ok) return json(401, { message: 'Invalid username or password.' });
      return json(200, await signToken(user || adminUser));
    }

    if (method === 'GET' && pathname === '/auth/me') {
      const u = await verifyAuth(event);
      if (!u) return json(401, { message: 'Unauthorized' });
      return json(200, { username: u });
    }

    if (method === 'GET' && pathname === '/categories') {
      const rows = await db`
        SELECT c."Id", c."Name", c."Description", c."Icon",
          COUNT(b."Id") FILTER (WHERE b."IsApproved" = true)::int AS business_count
        FROM "Categories" c
        LEFT JOIN "Businesses" b ON b."CategoryId" = c."Id"
        GROUP BY c."Id", c."Name", c."Description", c."Icon"
        ORDER BY c."Name"`;
      return json(200, rows.map(mapCategory));
    }

    if (method === 'GET' && pathname === '/businesses') {
      const admin = sp.get('admin') === 'true';
      if (admin && !(await verifyAuth(event))) return json(401, { message: 'Unauthorized' });
      const rows = await selectBusinesses(db, { approvedOnly: !admin });
      return json(200, rows.map(mapBusiness));
    }

    if (method === 'GET' && pathname === '/businesses/pending') {
      if (!(await verifyAuth(event))) return json(401, { message: 'Unauthorized' });
      const rows = await selectBusinesses(db, { pending: true });
      return json(200, rows.map(mapBusiness));
    }

    if (method === 'GET' && pathname === '/businesses/featured') {
      const count = Math.max(1, Number(sp.get('count')) || 6);
      const rows = await selectBusinesses(db, { featured: true, limit: count });
      return json(200, rows.map(mapBusiness));
    }

    if (method === 'GET' && pathname === '/businesses/search') {
      const page = Math.max(1, Number(sp.get('page')) || 1);
      const pageSize = Math.max(1, Number(sp.get('pageSize')) || 12);
      const offset = (page - 1) * pageSize;
      const name = sp.get('name')?.trim() || '';
      const categoryId = sp.get('categoryId') ? Number(sp.get('categoryId')) : null;
      const city = sp.get('city')?.trim() || '';
      const namePat = name ? `%${name}%` : null;
      const cityPat = city ? `%${city}%` : null;

      const rows = await db(
        `SELECT ${BIZ_COLS} ${BIZ_FROM}
         WHERE b."IsApproved" = true
           AND ($1::text IS NULL OR b."Name" ILIKE $1 OR COALESCE(b."Description", '') ILIKE $1)
           AND ($2::int IS NULL OR b."CategoryId" = $2)
           AND ($3::text IS NULL OR b."City" ILIKE $3)
         ORDER BY b."Name"
         LIMIT $4 OFFSET $5`,
        [namePat, categoryId, cityPat, pageSize, offset],
      );
      const countRows = await db(
        `SELECT COUNT(*)::int AS c FROM "Businesses" b
         WHERE b."IsApproved" = true
           AND ($1::text IS NULL OR b."Name" ILIKE $1 OR COALESCE(b."Description", '') ILIKE $1)
           AND ($2::int IS NULL OR b."CategoryId" = $2)
           AND ($3::text IS NULL OR b."City" ILIKE $3)`,
        [namePat, categoryId, cityPat],
      );
      const totalCount = countRows[0]?.c ?? 0;
      return json(200, {
        items: rows.map(mapBusiness),
        totalCount,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      });
    }

    if (method === 'GET' && bizId) {
      const rows = await selectBusinesses(db, { id: Number(bizId[1]) });
      if (!rows[0]) return json(404, { message: 'Business not found.' });
      return json(200, mapBusiness(rows[0]));
    }

    if (method === 'GET' && pathname === '/payments') {
      const rows = await db`
        SELECT p."Id", p."BusinessId", b."Name" AS "BusinessName", p."PayerName",
          p."Amount", p."PaymentMethod", p."TransactionNumber", p."CreatedAt"
        FROM "Payments" p
        INNER JOIN "Businesses" b ON b."Id" = p."BusinessId"
        ORDER BY p."CreatedAt" DESC`;
      return json(200, rows.map(mapPayment));
    }

    const payId = pathname.match(/^\/?payments\/(\d+)$/);
    if (method === 'GET' && payId) {
      const id = Number(payId[1]);
      const rows = await db`
        SELECT p."Id", p."BusinessId", b."Name" AS "BusinessName", p."PayerName",
          p."Amount", p."PaymentMethod", p."TransactionNumber", p."CreatedAt"
        FROM "Payments" p
        INNER JOIN "Businesses" b ON b."Id" = p."BusinessId"
        WHERE p."Id" = ${id} LIMIT 1`;
      if (!rows[0]) return json(404, { message: 'Payment not found.' });
      return json(200, mapPayment(rows[0]));
    }

    if (method === 'POST' && pathname === '/payments') {
      if (body.companyWebsite) return json(400, { message: 'Invalid submission.' });
      const businessId = Number(body.businessId ?? body.BusinessId);
      const biz = await db`SELECT "Id" FROM "Businesses" WHERE "Id" = ${businessId} AND "IsApproved" = true LIMIT 1`;
      if (!biz[0]) return json(400, { message: 'Business not found.' });
      const rows = await db`
        INSERT INTO "Payments" ("BusinessId", "PayerName", "Amount", "PaymentMethod", "TransactionNumber", "CreatedAt")
        VALUES (
          ${businessId},
          ${String(body.payerName ?? body.PayerName ?? '').trim()},
          ${Number(body.amount ?? body.Amount)},
          ${String(body.paymentMethod ?? body.PaymentMethod ?? '').trim()},
          ${String(body.transactionNumber ?? body.TransactionNumber ?? '').trim()},
          NOW()
        )
        RETURNING "Id", "BusinessId", "PayerName", "Amount", "PaymentMethod", "TransactionNumber", "CreatedAt"`;
      const bn = await db`SELECT "Name" FROM "Businesses" WHERE "Id" = ${businessId}`;
      return json(201, mapPayment({ ...rows[0], BusinessName: bn[0]?.Name || '' }));
    }

    if (method === 'PUT' && payId) {
      const id = Number(payId[1]);
      const rows = await db`
        UPDATE "Payments" SET
          "PayerName" = ${String(body.payerName ?? body.PayerName ?? '').trim()},
          "Amount" = ${Number(body.amount ?? body.Amount)},
          "PaymentMethod" = ${String(body.paymentMethod ?? body.PaymentMethod ?? '').trim()},
          "TransactionNumber" = ${String(body.transactionNumber ?? body.TransactionNumber ?? '').trim()}
        WHERE "Id" = ${id}
        RETURNING "Id", "BusinessId", "PayerName", "Amount", "PaymentMethod", "TransactionNumber", "CreatedAt"`;
      if (!rows[0]) return json(404, { message: 'Payment not found.' });
      const bn = await db`SELECT "Name" FROM "Businesses" WHERE "Id" = ${rows[0].BusinessId}`;
      return json(200, mapPayment({ ...rows[0], BusinessName: bn[0]?.Name || '' }));
    }

    if (method === 'DELETE' && payId) {
      const id = Number(payId[1]);
      const rows = await db`DELETE FROM "Payments" WHERE "Id" = ${id} RETURNING "Id"`;
      if (!rows[0]) return json(404, { message: 'Payment not found.' });
      return { statusCode: 204, headers: { 'access-control-allow-origin': '*' }, body: '' };
    }

    if (method === 'GET' && (pathname === '/dashboard/stats' || pathname === '/dashboard')) {
      const [biz, cats, rev, pay, pending] = await Promise.all([
        db`SELECT COUNT(*)::int AS c FROM "Businesses" WHERE "IsApproved" = true`,
        db`SELECT COUNT(*)::int AS c FROM "Categories"`,
        db`SELECT COUNT(*)::int AS c FROM "Reviews"`,
        db`SELECT COUNT(*)::int AS c, COALESCE(SUM("Amount"), 0)::float AS s FROM "Payments"`,
        db`SELECT COUNT(*)::int AS c FROM "Businesses" WHERE "IsApproved" = false`,
      ]);
      const byCat = await db`
        SELECT c."Name" AS "CategoryName", COUNT(b."Id")::int AS "Count"
        FROM "Categories" c
        LEFT JOIN "Businesses" b ON b."CategoryId" = c."Id" AND b."IsApproved" = true
        GROUP BY c."Name" ORDER BY c."Name"`;
      const recent = await db(
        `SELECT ${BIZ_COLS} ${BIZ_FROM} WHERE b."IsApproved" = true ORDER BY b."CreatedAt" DESC LIMIT 5`,
      );
      return json(200, {
        totalBusinesses: biz[0]?.c ?? 0,
        totalCategories: cats[0]?.c ?? 0,
        totalReviews: rev[0]?.c ?? 0,
        totalPayments: pay[0]?.c ?? 0,
        totalPaymentAmount: Number(pay[0]?.s ?? 0),
        pendingBusinesses: pending[0]?.c ?? 0,
        businessesByCategory: byCat.map((r) => ({ categoryName: r.CategoryName, count: r.Count })),
        recentBusinesses: recent.map(mapBusiness),
      });
    }

    if (method === 'POST' && pathname === '/analytics/track') return empty204();

    if (method === 'GET' && pathname === '/analytics/summary') {
      if (!(await verifyAuth(event))) return json(401, { message: 'Unauthorized' });
      const pending = await db`SELECT COUNT(*)::int AS c FROM "Businesses" WHERE "IsApproved" = false`;
      return json(200, {
        totalPageViews: 0,
        totalBusinessViews: 0,
        totalSearches: 0,
        unreadMessages: 0,
        pendingBusinesses: pending[0]?.c ?? 0,
        popularBusinesses: [],
      });
    }

    const revBiz = pathname.match(/^\/?reviews\/business\/(\d+)$/);
    if (method === 'GET' && revBiz) {
      const id = Number(revBiz[1]);
      const rows = await db`
        SELECT "Id", "BusinessId", "UserName", "Rating", "Comment", "CreatedAt"
        FROM "Reviews" WHERE "BusinessId" = ${id} ORDER BY "CreatedAt" DESC`;
      return json(200, rows.map((r) => ({
        id: r.Id,
        businessId: r.BusinessId,
        userName: r.UserName,
        rating: r.Rating,
        comment: r.Comment,
        createdAt: r.CreatedAt,
      })));
    }

    if (method === 'POST' && pathname.match(/^\/?businesses\/\d+\/approve$/)) {
      if (!(await verifyAuth(event))) return json(401, { message: 'Unauthorized' });
      const id = Number(pathname.match(/(\d+)/)[1]);
      await db`UPDATE "Businesses" SET "IsApproved" = true WHERE "Id" = ${id}`;
      const rows = await selectBusinesses(db, { id });
      if (!rows[0]) return json(404, { message: 'Business not found.' });
      return json(200, mapBusiness(rows[0]));
    }

    if (method === 'POST' && pathname === '/businesses') {
      if (!(await verifyAuth(event))) return json(401, { message: 'Unauthorized' });
      const result = await insertBusiness(db, body, { approved: true });
      if (result.error) return json(result.status, { message: result.error });
      return json(201, result.business);
    }

    if (method === 'PUT' && bizId) {
      if (!(await verifyAuth(event))) return json(401, { message: 'Unauthorized' });
      const id = Number(bizId[1]);
      const existing = await db`SELECT "Id" FROM "Businesses" WHERE "Id" = ${id} LIMIT 1`;
      if (!existing[0]) return json(404, { message: 'Business not found.' });
      const categoryId = Number(body.categoryId);
      if (!categoryId || !(await categoryExists(db, categoryId))) {
        return json(400, { message: 'Selected category does not exist.' });
      }
      await db`
        UPDATE "Businesses" SET
          "Name" = ${String(body.name ?? '').trim()},
          "Phone" = ${String(body.phone ?? '').trim()},
          "Email" = ${String(body.email ?? '').trim()},
          "Address" = ${String(body.address ?? '').trim()},
          "Description" = ${body.description?.trim() || null},
          "CategoryId" = ${categoryId},
          "LogoUrl" = ${body.logoUrl?.trim() || null},
          "Website" = ${body.website?.trim() || null},
          "City" = ${body.city?.trim() || 'Mogadishu'},
          "Rating" = ${Number(body.rating) || 4.5},
          "IsFeatured" = ${!!body.isFeatured},
          "IsApproved" = ${body.isApproved !== false},
          "ImageUrlsJson" = ${body.imageUrls ? JSON.stringify(body.imageUrls) : null},
          "OpeningHoursJson" = ${body.openingHours ? JSON.stringify(body.openingHours) : null},
          "Latitude" = ${body.latitude ?? null},
          "Longitude" = ${body.longitude ?? null}
        WHERE "Id" = ${id}`;
      const rows = await selectBusinesses(db, { id });
      return json(200, mapBusiness(rows[0]));
    }

    if (method === 'DELETE' && bizId) {
      if (!(await verifyAuth(event))) return json(401, { message: 'Unauthorized' });
      const id = Number(bizId[1]);
      const rows = await db`DELETE FROM "Businesses" WHERE "Id" = ${id} RETURNING "Id"`;
      if (!rows[0]) return json(404, { message: 'Business not found.' });
      return { statusCode: 204, headers: { 'access-control-allow-origin': '*' }, body: '' };
    }

    if (method === 'POST' && pathname === '/businesses/submit') {
      if (body.companyWebsite) return json(400, { message: 'Invalid submission.' });
      const result = await insertBusiness(db, body, { approved: false });
      if (result.error) return json(result.status, { message: result.error });
      return json(202, result.business);
    }
  } catch (err) {
    console.error('[neon-api]', err);
    return json(503, { message: 'Database error', detail: String(err?.message || err) });
  }

  return null;
}
