/** Vercel serverless /api — demo data, or proxy to BACKEND_URL (tunnel / Render) when set. */

const U = (id) => `https://images.unsplash.com/photo-${id}?w=800&h=400&fit=crop&q=80`;

const demoCategories = [
  { id: 1, name: "Restaurants", description: "Dining", icon: "restaurant", businessCount: 2 },
  { id: 2, name: "Hotels", description: "Hotels", icon: "hotel", businessCount: 1 },
  { id: 3, name: "Healthcare", description: "Healthcare", icon: "hospital", businessCount: 1 },
  { id: 4, name: "Retail", description: "Retail", icon: "supermarket", businessCount: 1 },
  { id: 5, name: "Services", description: "Services", icon: "telecom", businessCount: 1 },
  { id: 7, name: "school", description: "Education", icon: "school", businessCount: 1 },
];

const demoBusinessList = [
  { id: 1, name: "Hormuud Telecom", phone: "+252 61 5000000", email: "info@hormuud.com", address: "Howlwadaag, Mogadishu", city: "Mogadishu", description: "Leading mobile, internet and digital services across Somalia.", categoryId: 5, categoryName: "Services", rating: 4.9, website: "https://www.hormuud.com", logoUrl: U("1556742049-0cfed4f6a45d"), reviewCount: 4 },
  { id: 2, name: "Mogadishu Serena Hotel", phone: "+252 61 2000000", email: "reservations@serena.co", address: "Airport Road, Wadajir", city: "Mogadishu", description: "Luxury hotel with conference halls and waterfront views.", categoryId: 2, categoryName: "Hotels", rating: 4.8, website: null, logoUrl: U("1566073771259-6a8506099945"), reviewCount: 3 },
  { id: 3, name: "Lido Seafood Restaurant", phone: "+252 61 7700000", email: "hello@lidoseafood.so", address: "Lido Beach, Mogadishu", city: "Mogadishu", description: "Fresh seafood and traditional Somali cuisine by the beach.", categoryId: 1, categoryName: "Restaurants", rating: 4.7, website: null, logoUrl: U("1517248135467-4c7edcad34c4"), reviewCount: 5 },
  { id: 4, name: "Beco Supermarket", phone: "+252 61 8800000", email: "info@beco.so", address: "KM4, Hodan District", city: "Mogadishu", description: "Groceries, household goods and fresh produce.", categoryId: 4, categoryName: "Retail", rating: 4.6, website: null, logoUrl: U("1604719312566-8912e9227c6a"), reviewCount: 2 },
  { id: 5, name: "SIMAD University", phone: "+252 61 4444444", email: "info@simad.edu.so", address: "Afgooye Road, Mogadishu", city: "Mogadishu", description: "Private university offering business, IT and health sciences.", categoryId: 7, categoryName: "school", rating: 4.7, website: "https://www.simad.edu.so", logoUrl: U("1523050854058-8df90110c9f1"), reviewCount: 4 },
  { id: 6, name: "Golden Fork Restaurant", phone: "+252 61 7800001", email: "info@goldenfork.so", address: "Hodan District", city: "Mogadishu", description: "Popular dining spot for families and groups.", categoryId: 1, categoryName: "Restaurants", rating: 4.5, website: null, logoUrl: U("1517248135467-4c7edcad34c4"), reviewCount: 3 },
  { id: 7, name: "Sunrise Medical Center", phone: "+252 61 1500001", email: "care@sunrisemedical.so", address: "Wadajir District", city: "Mogadishu", description: "Outpatient care, diagnostics and emergency services.", categoryId: 3, categoryName: "Healthcare", rating: 4.4, website: null, logoUrl: U("1519494026892-80bbd2d6fd0d"), reviewCount: 2 },
];

const demoReviews = [
  { id: 1, businessId: 1, userName: "Ahmed H.", rating: 5, comment: "Excellent network coverage." },
  { id: 2, businessId: 3, userName: "Fatima M.", rating: 5, comment: "Best seafood in Mogadishu." },
  { id: 3, businessId: 2, userName: "Omar K.", rating: 5, comment: "Beautiful hotel stay." },
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

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("access-control-allow-origin", "*");
  res.end(JSON.stringify(data));
}

function getPathname(req) {
  const parts = req.query.path;
  if (parts !== undefined) {
    const segs = Array.isArray(parts) ? parts : [parts];
    return "/" + segs.filter(Boolean).join("/");
  }
  const host = req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const url = new URL(req.url || "/", `${proto}://${host}`);
  return url.pathname.replace(/^\/api/, "") || "/";
}

function getSearchParams(req) {
  const host = req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "https";
  return new URL(req.url || "/", `${proto}://${host}`).searchParams;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
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

async function handleDemo(req, res) {
  const pathname = getPathname(req);
  const sp = getSearchParams(req);
  const method = (req.method || "GET").toUpperCase();

  if (method === "GET" && pathname === "/health") return send(res, 200, { status: "healthy", database: true, provider: "vercel-demo" });
  if (method === "GET" && pathname === "/categories") return send(res, 200, demoCategories);
  if (method === "GET" && pathname === "/businesses") return send(res, 200, demoBusinessList);
  if (method === "GET" && pathname === "/businesses/featured") return send(res, 200, demoBusinessList.slice(0, Number(sp.get("count")) || 6));
  if (method === "GET" && pathname === "/businesses/search") return send(res, 200, paginate(filterBusinesses({ name: sp.get("name"), categoryId: sp.get("categoryId"), city: sp.get("city") }), sp.get("page"), sp.get("pageSize")));
  if (method === "GET" && pathname === "/dashboard/stats") return send(res, 200, demoStats);
  if (method === "GET" && pathname === "/dashboard") return send(res, 200, demoStats);
  if (method === "GET" && pathname === "/payments") return send(res, 200, []);
  if (method === "GET" && pathname === "/reviews") return send(res, 200, demoReviews);
  if (method === "GET" && pathname === "/businesses/pending") return send(res, 200, []);

  if (method === "POST" && pathname === "/auth/login") {
    let body = {};
    try {
      const buf = await readBody(req);
      body = JSON.parse(buf?.length ? buf.toString("utf8") : "{}");
    } catch { /* empty */ }
    const user = String(body.username ?? body.Username ?? "").trim().toLowerCase();
    const pass = String(body.password ?? body.Password ?? "");
    if (user === "admin" && pass === "Admin@123") {
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      return send(res, 200, {
        token: `demo.${Buffer.from(user).toString("base64")}`,
        username: "admin",
        expiresAt,
      });
    }
    return send(res, 401, { message: "Invalid username or password." });
  }

  if (method === "GET" && pathname === "/auth/me") {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return send(res, 401, { message: "Unauthorized" });
    const token = auth.slice(7);
    if (token.startsWith("demo.") || token.startsWith("offline.")) {
      return send(res, 200, { username: "admin" });
    }
    return send(res, 401, { message: "Unauthorized" });
  }

  const biz = pathname.match(/^\/businesses\/(\d+)$/);
  if (method === "GET" && biz) {
    const b = demoBusinessList.find((x) => x.id === Number(biz[1]));
    return send(res, b ? 200 : 404, b || { message: "Business not found." });
  }

  const rev = pathname.match(/^\/reviews\/business\/(\d+)$/);
  if (method === "GET" && rev) return send(res, 200, demoReviews.filter((r) => r.businessId === Number(rev[1])));

  send(res, 404, { message: "Not found", path: pathname });
}

async function proxyToBackend(req, res) {
  const backend = (process.env.BACKEND_URL || "").trim().replace(/\/$/, "");
  if (!backend) return false;

  const pathname = getPathname(req);
  const sp = getSearchParams(req);
  const qs = sp.toString();
  const target = `${backend}/api${pathname}${qs ? `?${qs}` : ""}`;

  const headers = { accept: "application/json" };
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
  if (backend.includes("loca.lt")) headers["bypass-tunnel-reminder"] = "true";

  let body;
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await readBody(req);
    } catch {
      body = undefined;
    }
  }

  try {
    const upstream = await fetch(target, { method, headers, body: body?.length ? body : undefined });
    const text = await upstream.text();
    if (upstream.ok) {
      res.statusCode = upstream.status;
      const ct = upstream.headers.get("content-type");
      if (ct) res.setHeader("content-type", ct);
      res.setHeader("access-control-allow-origin", "*");
      res.end(text);
      return true;
    }
    if (method === "GET" || method === "HEAD") return false;
    send(res, upstream.status, { message: "Backend error", status: upstream.status });
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("access-control-allow-headers", "Content-Type, Authorization");
    return res.end();
  }

  const proxied = await proxyToBackend(req, res);
  if (proxied) return;

  await handleDemo(req, res);
}
