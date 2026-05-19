/** Netlify serverless /api — demo data, or proxy to BACKEND_URL (Render) when set. */

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

const demoReviews = [
  { id: 1, businessId: 1, userName: 'Ahmed H.', rating: 5, comment: 'Excellent network coverage.' },
  { id: 2, businessId: 3, userName: 'Fatima M.', rating: 5, comment: 'Best seafood in Mogadishu.' },
  { id: 3, businessId: 2, userName: 'Omar K.', rating: 5, comment: 'Beautiful hotel stay.' },
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

function json(status, data) {
  return {
    statusCode: status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
    body: JSON.stringify(data),
  };
}

function getPathname(event) {
  const splat = event.pathParameters?.splat ?? event.pathParameters?.proxy;
  if (splat != null && splat !== '') {
    const p = String(splat).replace(/^\/+/, '');
    return p.startsWith('api/') ? `/${p.slice(4)}` : `/${p}`;
  }
  const raw = event.rawUrl || event.path || '';
  try {
    const pathname = raw.startsWith('http') ? new URL(raw).pathname : raw;
    const fromFn = pathname.match(/\/\.netlify\/functions\/api(\/.*)?$/i);
    if (fromFn) return fromFn[1] || '/';
    const fromApi = pathname.replace(/^\/api/i, '') || '/';
    return fromApi.startsWith('/') ? fromApi : `/${fromApi}`;
  } catch {
    return '/';
  }
}

function empty204() {
  return {
    statusCode: 204,
    headers: { 'access-control-allow-origin': '*' },
    body: '',
  };
}

const demoAnalyticsSummary = {
  totalPageViews: 128,
  totalBusinessViews: 64,
  totalSearches: 42,
  unreadMessages: 0,
  pendingBusinesses: 0,
  popularBusinesses: demoBusinessList.slice(0, 5).map((b, i) => ({
    businessId: b.id,
    name: b.name,
    views: 20 - i,
  })),
};

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getSearchParams(event) {
  const raw = event.rawUrl || '';
  try {
    return new URL(raw.startsWith('http') ? raw : `https://x${raw}`).searchParams;
  } catch {
    return new URLSearchParams(event.queryStringParameters || {});
  }
}

function filterBusinesses({ name, categoryId, city }) {
  let list = [...demoBusinessList];
  const n = name?.trim().toLowerCase();
  if (n) list = list.filter((b) => b.name.toLowerCase().includes(n) || b.description?.toLowerCase().includes(n));
  if (categoryId) list = list.filter((b) => b.categoryId === Number(categoryId));
  if (city?.trim()) list = list.filter((b) => b.city?.toLowerCase().includes(city.trim().toLowerCase()));
  return list;
}

function paginate(list, page = 1, pageSize = 12) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || 12);
  const totalCount = list.length;
  return { items: list.slice((p - 1) * size, p * size), totalCount, page: p, pageSize: size, totalPages: Math.max(1, Math.ceil(totalCount / size)) };
}

function handleDemo(event) {
  const pathname = getPathname(event);
  const sp = getSearchParams(event);
  const method = (event.httpMethod || 'GET').toUpperCase();

  if (method === 'GET' && pathname === '/health') {
    return json(200, {
      status: 'healthy',
      database: true,
      provider: process.env.BACKEND_URL ? 'netlify-proxy' : 'netlify-demo',
    });
  }
  if (method === 'GET' && pathname === '/categories') return json(200, demoCategories);
  if (method === 'GET' && pathname === '/businesses') return json(200, demoBusinessList);
  if (method === 'GET' && pathname === '/businesses/featured') return json(200, demoBusinessList.slice(0, Number(sp.get('count')) || 6));
  if (method === 'GET' && pathname === '/businesses/search') return json(200, paginate(filterBusinesses({ name: sp.get('name'), categoryId: sp.get('categoryId'), city: sp.get('city') }), sp.get('page'), sp.get('pageSize')));
  if (method === 'GET' && pathname === '/dashboard/stats') return json(200, demoStats);
  if (method === 'GET' && pathname === '/dashboard') return json(200, demoStats);
  if (method === 'GET' && pathname === '/payments') return json(200, []);
  if (method === 'GET' && pathname === '/reviews') return json(200, demoReviews);
  if (method === 'GET' && pathname === '/businesses/pending') return json(200, []);

  if (method === 'POST' && pathname === '/analytics/track') return empty204();
  if (method === 'GET' && pathname === '/analytics/summary') return json(200, demoAnalyticsSummary);

  if (method === 'POST' && pathname === '/contact') return json(201, { id: 1, message: 'Message received.' });
  if (method === 'GET' && pathname === '/contact') return json(200, []);
  if (method === 'GET' && pathname === '/upload/status') return json(200, { cloudinary: false, local: true });

  if (method === 'POST' && pathname === '/auth/login') {
    const body = parseBody(event);
    const user = String(body.username ?? body.Username ?? '').trim().toLowerCase();
    const pass = String(body.password ?? body.Password ?? '');
    if (user === 'admin' && pass === 'Admin@123') {
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      return json(200, {
        token: `demo.${Buffer.from(user).toString('base64')}`,
        username: 'admin',
        expiresAt,
      });
    }
    return json(401, { message: 'Invalid username or password.' });
  }

  if (method === 'GET' && pathname === '/auth/me') {
    const auth = event.headers?.authorization || event.headers?.Authorization || '';
    if (!auth.startsWith('Bearer ')) return json(401, { message: 'Unauthorized' });
    const token = auth.slice(7);
    if (token.startsWith('demo.') || token.startsWith('offline.')) {
      return json(200, { username: 'admin' });
    }
    return json(401, { message: 'Unauthorized' });
  }

  const biz = pathname.match(/^\/?businesses\/(\d+)$/);
  if (method === 'GET' && biz) {
    const b = demoBusinessList.find((x) => x.id === Number(biz[1]));
    return json(b ? 200 : 404, b || { message: 'Business not found.', path: pathname });
  }

  if (method === 'POST' && pathname.match(/^\/?businesses\/\d+\/approve$/)) {
    return json(200, { message: 'Approved (demo).' });
  }

  const rev = pathname.match(/^\/reviews\/business\/(\d+)$/);
  if (method === 'GET' && rev) return json(200, demoReviews.filter((r) => r.businessId === Number(rev[1])));

  return json(404, { message: 'Not found', path: pathname });
}

function requestBody(event) {
  if (!event.body) return undefined;
  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return undefined;
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function proxyToBackend(event) {
  const backend = (process.env.BACKEND_URL || '').trim().replace(/\/$/, '');
  if (!backend) return null;

  const pathname = getPathname(event);
  const sp = getSearchParams(event);
  const qs = sp.toString();
  const target = `${backend}/api${pathname}${qs ? `?${qs}` : ''}`;
  const method = (event.httpMethod || 'GET').toUpperCase();
  const body = requestBody(event);

  const headers = { accept: 'application/json' };
  if (event.headers?.authorization) headers.authorization = event.headers.authorization;
  if (event.headers?.['content-type']) headers['content-type'] = event.headers['content-type'];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const upstream = await fetch(target, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(25000),
      });
      const text = await upstream.text();
      if (upstream.ok) {
        return {
          statusCode: upstream.status,
          headers: {
            'content-type': upstream.headers.get('content-type') || 'application/json',
            'access-control-allow-origin': '*',
          },
          body: text,
        };
      }
      // Render asleep / unauthorized / missing route — fall through to demo for GET
      if (method === 'GET' || method === 'HEAD') {
        if (upstream.status === 401 || upstream.status === 403 || upstream.status === 404 || upstream.status >= 502) {
          break;
        }
      } else if (upstream.status === 404 || upstream.status >= 502) {
        break;
      }
      return json(upstream.status, { message: 'Backend error', status: upstream.status });
    } catch {
      if (attempt < 2) await sleep(3000);
    }
  }
  return null;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }

  const proxied = await proxyToBackend(event);
  if (proxied) return proxied;

  return handleDemo(event);
}
