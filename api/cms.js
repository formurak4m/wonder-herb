// Vercel Serverless Function for CMS Data Persistence
// Handles GET and POST for cases, products, faq, and homepage data

let memoryStore = {};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type } = req.query;

  if (req.method === 'GET') {
    if (type && memoryStore[type]) {
      return res.status(200).json(memoryStore[type]);
    }
    return res.status(200).json(memoryStore);
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (type && body) {
        memoryStore[type] = body;
        return res.status(200).json({ success: true, type, count: Array.isArray(body) ? body.length : 1 });
      }
      if (body && typeof body === 'object') {
        memoryStore = { ...memoryStore, ...body };
        return res.status(200).json({ success: true, updated: Object.keys(body) });
      }
      return res.status(400).json({ error: 'Invalid payload' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
