import { apiConfig, runVercelApi } from './_vercel.mjs';

export const config = apiConfig;

export default async function handler(req, res) {
  const parts = req.query.path;
  const subPath = Array.isArray(parts) ? parts.join('/') : (parts ?? '');
  return runVercelApi(req, res, subPath);
}
