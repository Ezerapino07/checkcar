export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

  try {
    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${q}&limit=50`;
    const mlRes = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!mlRes.ok) {
      return res.status(mlRes.status).json({ error: `MercadoLibre devolvió error ${mlRes.status}` });
    }

    const data = await mlRes.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
