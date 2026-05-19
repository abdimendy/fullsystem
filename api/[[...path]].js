import { apiConfig, runVercelApi } from './_vercel.mjs';

export const config = apiConfig;

export default async function handler(req, res) {
  const host = req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const subPath = new URL(req.url || '/', `${proto}://${host}`).pathname.replace(/^\/api\/?/i, '');
  return runVercelApi(req, res, subPath);
}
