/** PDF reports from Neon data (pdf-lib — works on Netlify serverless). */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const BIZ_FROM = `
  FROM "Businesses" b
  INNER JOIN "Categories" c ON c."Id" = b."CategoryId"`;

const BIZ_COLS = `
  b."Id", b."Name", b."Phone", b."Email", b."Address", b."Description",
  b."CategoryId", c."Name" AS "CategoryName", b."LogoUrl", b."Website", b."City",
  b."Rating", b."IsFeatured", b."IsApproved", b."CreatedAt"`;

const amber = rgb(0.71, 0.33, 0.04);
const dark = rgb(0.06, 0.09, 0.16);
const body = rgb(0.2, 0.25, 0.33);
const muted = rgb(0.39, 0.45, 0.55);

export function pdfResponse(buffer, filename) {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
    body: Buffer.from(buffer).toString('base64'),
    isBase64Encoded: true,
  };
}

function wrapText(text, maxLen = 90) {
  const words = String(text || '-').split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxLen) {
      if (line) lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
}

export function toPdfBusinessRow(b) {
  return {
    Name: b.name ?? b.Name,
    Phone: b.phone ?? b.Phone,
    Email: b.email ?? b.Email,
    Address: b.address ?? b.Address,
    City: b.city ?? b.City,
    Description: b.description ?? b.Description,
    CategoryName: b.categoryName ?? b.CategoryName,
    Website: b.website ?? b.Website,
    Rating: b.rating ?? b.Rating,
  };
}

function filterDemoForReport(list, { name, categoryId, city }) {
  let out = [...list];
  const n = name?.trim().toLowerCase();
  if (n) {
    out = out.filter(
      (b) =>
        String(b.name || b.Name || '').toLowerCase().includes(n) ||
        String(b.description || b.Description || '').toLowerCase().includes(n),
    );
  }
  if (categoryId) {
    const cid = Number(categoryId);
    out = out.filter((b) => Number(b.categoryId ?? b.CategoryId) === cid);
  }
  if (city?.trim()) {
    const c = city.trim().toLowerCase();
    out = out.filter((b) => String(b.city || b.City || '').toLowerCase().includes(c));
  }
  return out.map(toPdfBusinessRow);
}

export async function generateBusinessPdf(b) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  let y = 780;

  page.drawText('YellowBook Directory', { x: 40, y, size: 22, font: bold, color: amber });
  y -= 36;
  page.drawText(b.Name || 'Business', { x: 40, y, size: 18, font: bold, color: dark });
  y -= 28;
  page.drawText(`Category: ${b.CategoryName || '-'}`, { x: 40, y, size: 11, font: regular, color: body });
  y -= 16;
  page.drawText(`Rating: ${Number(b.Rating || 0).toFixed(1)} / 5`, { x: 40, y, size: 11, font: regular, color: body });
  y -= 28;
  page.drawText('Contact', { x: 40, y, size: 12, font: bold, color: dark });
  y -= 18;
  for (const line of [
    `Phone: ${b.Phone || '-'}`,
    `Email: ${b.Email || '-'}`,
    `Address: ${b.Address || '-'}, ${b.City || 'Mogadishu'}`,
    ...(b.Website ? [`Website: ${b.Website}`] : []),
  ]) {
    page.drawText(line, { x: 40, y, size: 11, font: regular, color: body });
    y -= 16;
  }
  y -= 12;
  page.drawText('Description', { x: 40, y, size: 12, font: bold, color: dark });
  y -= 18;
  for (const line of wrapText(b.Description || 'No description provided.', 85)) {
    page.drawText(line, { x: 40, y, size: 11, font: regular, color: body });
    y -= 14;
  }
  const stamp = `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  page.drawText(stamp, { x: 40, y: 40, size: 9, font: regular, color: muted });

  return doc.save();
}

export async function generateReportPdf(businesses) {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const date = new Date().toISOString().slice(0, 10);

  let page = doc.addPage([595.28, 841.89]);
  let y = 800;

  const newPage = () => {
    page = doc.addPage([595.28, 841.89]);
    y = 800;
  };

  page.drawText('YellowBook — Telephone Directory', { x: 40, y, size: 18, font: bold, color: dark });
  y -= 22;
  page.drawText(`${businesses.length} businesses · ${date}`, { x: 40, y, size: 10, font: regular, color: muted });
  y -= 28;

  const headers = ['Name', 'Phone', 'Category', 'City', 'Email'];
  const xs = [40, 175, 265, 345, 415];

  const drawRow = (cells, isHeader = false) => {
    if (y < 60) newPage();
    const font = isHeader ? bold : regular;
    const color = isHeader ? amber : body;
    const size = isHeader ? 9 : 8;
    for (let i = 0; i < headers.length; i++) {
      page.drawText(String(cells[i] || '-').slice(0, isHeader ? 20 : 28), {
        x: xs[i],
        y,
        size,
        font,
        color,
      });
    }
    y -= isHeader ? 16 : 13;
  };

  drawRow(headers, true);
  for (const b of businesses) {
    drawRow([b.Name, b.Phone, b.CategoryName, b.City, b.Email]);
  }

  page.drawText('Yellow Book — Somalia Business Directory', {
    x: 120,
    y: 30,
    size: 9,
    font: regular,
    color: muted,
  });

  return doc.save();
}

async function fetchBusiness(db, id) {
  const rows = await db(
    `SELECT ${BIZ_COLS} ${BIZ_FROM} WHERE b."Id" = $1 LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

async function fetchReportList(db, { name, categoryId, city }) {
  const namePat = name?.trim() ? `%${name.trim()}%` : null;
  const cityPat = city?.trim() ? `%${city.trim()}%` : null;
  const cat = categoryId ? Number(categoryId) : null;
  return db(
    `SELECT ${BIZ_COLS} ${BIZ_FROM}
     WHERE b."IsApproved" = true
       AND ($1::text IS NULL OR b."Name" ILIKE $1 OR COALESCE(b."Description", '') ILIKE $1)
       AND ($2::int IS NULL OR b."CategoryId" = $2)
       AND ($3::text IS NULL OR b."City" ILIKE $3)
     ORDER BY b."Name"`,
    [namePat, cat, cityPat],
  );
}

export async function handlePdf(event, { getPathname, getSearchParams, db, demoBusinessList }) {
  if (!db && !demoBusinessList?.length) return null;
  const pathname = getPathname(event);
  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method !== 'GET') return null;

  const bizPdf = pathname.match(/^\/?pdf\/business\/(\d+)$/);
  if (bizPdf) {
    try {
      const id = Number(bizPdf[1]);
      let b = null;
      if (db) {
        b = await fetchBusiness(db, id);
      } else {
        const found = demoBusinessList.find((x) => Number(x.id ?? x.Id) === id);
        b = found ? toPdfBusinessRow(found) : null;
      }
      if (!b) {
        return {
          statusCode: 404,
          headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
          body: JSON.stringify({ message: 'Business not found.' }),
        };
      }
      const bytes = await generateBusinessPdf(b);
      return pdfResponse(bytes, `yellowbook-business-${id}.pdf`);
    } catch (err) {
      console.error('[neon-pdf] business', err);
      return {
        statusCode: 500,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ message: 'Could not generate PDF.', detail: String(err?.message || err) }),
      };
    }
  }

  if (pathname === '/pdf/report') {
    try {
      const sp = getSearchParams(event);
      const filters = {
        name: sp.get('name'),
        categoryId: sp.get('categoryId'),
        city: sp.get('city'),
      };
      const list = db
        ? await fetchReportList(db, filters)
        : filterDemoForReport(demoBusinessList, filters);
      const bytes = await generateReportPdf(list);
      return pdfResponse(bytes, 'yellowbook-directory.pdf');
    } catch (err) {
      console.error('[neon-pdf] report', err);
      return {
        statusCode: 500,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ message: 'Could not generate PDF.', detail: String(err?.message || err) }),
      };
    }
  }

  return null;
}
