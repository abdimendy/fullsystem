/** GET /api/auth/me */

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
    return res.end();
  }

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return send(res, 401, { message: 'Unauthorized' });
  }

  const token = auth.slice(7);
  if (token.startsWith('demo.') || token.startsWith('offline.')) {
    return send(res, 200, { username: 'admin' });
  }

  return send(res, 401, { message: 'Unauthorized' });
}
