/** POST /api/auth/login — demo admin (public directory); live JWT when BACKEND_URL is set. */

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyLogin(req, res) {
  const backend = (process.env.BACKEND_URL || '').trim().replace(/\/$/, '');
  if (!backend) return false;
  try {
    const body = await readBody(req);
    const headers = {
      accept: 'application/json',
      'content-type': req.headers['content-type'] || 'application/json',
    };
    if (backend.includes('loca.lt')) headers['bypass-tunnel-reminder'] = 'true';
    const upstream = await fetch(`${backend}/api/auth/login`, {
      method: 'POST',
      headers,
      body: body?.length ? body : undefined,
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    res.setHeader('access-control-allow-origin', '*');
    res.end(text);
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
    return res.end();
  }

  if (req.method !== 'POST') {
    return send(res, 405, { message: 'Method not allowed' });
  }

  if (await proxyLogin(req, res)) return;

  let body = {};
  try {
    const buf = await readBody(req);
    body = JSON.parse(buf?.length ? buf.toString('utf8') : '{}');
  } catch {
    /* empty */
  }

  const user = String(body.username ?? body.Username ?? '')
    .trim()
    .toLowerCase();
  const pass = String(body.password ?? body.Password ?? '');

  if (user === 'admin' && pass === 'Admin@123') {
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    return send(res, 200, {
      token: `demo.${Buffer.from(user).toString('base64')}`,
      username: 'admin',
      expiresAt,
    });
  }

  return send(res, 401, { message: 'Invalid username or password.' });
}
