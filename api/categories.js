import { apiConfig, runVercelApi } from './_vercel.mjs';

export const config = apiConfig;

export default async function handler(req, res) {
  return runVercelApi(req, res, 'categories');
}
