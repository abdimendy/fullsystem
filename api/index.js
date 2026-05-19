import { apiConfig, runVercelApi } from './_vercel.mjs';

export const config = apiConfig;

/** Resolve API sub-path from rewrite (?path=) or direct URL (/api/...). */
function resolveSubPath(req) {
  const q = req.query?.path;
  if (q != null && q !== '') {
    if (Array.isArray(q)) return q.filter(Boolean).join('/');
    return String(q).replace(/^\/+/, '');
  }

  const host = req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const url = new URL(req.url || '/', `${proto}://${host}`);
  return url.pathname.replace(/^\/api\/?/i, '');
}

export default async function handler(req, res) {
  return runVercelApi(req, res, resolveSubPath(req));
}
