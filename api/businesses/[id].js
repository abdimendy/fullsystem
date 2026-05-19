import { apiConfig, runVercelApi } from '../_vercel.mjs';

export const config = apiConfig;

export default async function handler(req, res) {
  const id = req.query.id;
  return runVercelApi(req, res, `businesses/${id}`);
}
