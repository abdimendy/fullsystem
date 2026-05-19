import { handler as netlifyHandler } from '../netlify/functions/api.mjs';

export const apiConfig = { api: { bodyParser: false } };

export function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function toNetlifyEvent(req, rawBody, subPathOverride) {
  const host = req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const url = new URL(req.url || '/', `${proto}://${host}`);

  let subPath = subPathOverride ?? url.pathname.replace(/^\/api\/?/i, '') ?? '';

  const qs = new URLSearchParams(url.search);
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path' || key === 'id') continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else if (value != null) qs.set(key, value);
  }

  const query = qs.toString();
  const fullUrl = `${proto}://${host}/api${subPath ? `/${subPath}` : ''}${query ? `?${query}` : ''}`;

  return {
    httpMethod: req.method || 'GET',
    path: `/api${subPath ? `/${subPath}` : ''}`,
    rawUrl: fullUrl,
    headers: req.headers,
    queryStringParameters: Object.fromEntries(qs.entries()),
    pathParameters: { proxy: subPath, splat: subPath },
    body: rawBody?.length ? rawBody.toString('utf8') : undefined,
    isBase64Encoded: false,
  };
}

function applyNetlifyResponse(res, result) {
  res.statusCode = result.statusCode || 500;
  for (const [key, value] of Object.entries(result.headers || {})) {
    if (value != null) res.setHeader(key, value);
  }
  if (!res.getHeader('access-control-allow-origin')) {
    res.setHeader('access-control-allow-origin', '*');
  }
  res.end(result.body ?? '');
}

export async function runVercelApi(req, res, subPath) {
  try {
    const rawBody = await readRawBody(req);
    const event = toNetlifyEvent(req, rawBody, subPath);
    const result = await netlifyHandler(event);
    applyNetlifyResponse(res, result);
  } catch (err) {
    console.error('[vercel-api]', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('access-control-allow-origin', '*');
    res.end(JSON.stringify({ message: 'API error', detail: String(err?.message || err) }));
  }
}
