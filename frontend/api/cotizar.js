// Serverless function — Vercel
// Requiere variables de entorno: ML_CLIENT_ID, ML_CLIENT_SECRET

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
    }),
  });

  if (!res.ok) throw new Error(`Token error ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { marca, modelo, anio } = req.query;
  if (!marca || !modelo || !anio) {
    return res.status(400).json({ error: "Se requieren marca, modelo y anio" });
  }

  try {
    const token = await getAccessToken();
    const q = encodeURIComponent(`${marca} ${modelo} ${anio}`);
    // Sin filtro de categoría (MLA1744 requiere permisos adicionales)
    // condition=used para enfocarse en usados
    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${q}&condition=used&limit=30`;

    const mlRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!mlRes.ok) {
      cachedToken = null; // forzar refresh si el token expiró
      return res.status(mlRes.status).json({ error: `ML error ${mlRes.status}` });
    }

    const data = await mlRes.json();
    const results = data.results || [];

    // Filtrar precios razonables (descartar outliers < $500k y > $2000M)
    const precios = results
      .map((r) => r.price)
      .filter((p) => p >= 500000 && p <= 2000000000);

    if (!precios.length) {
      return res.json({ found: false, count: 0 });
    }

    const med = median(precios);
    const min = Math.min(...precios);
    const max = Math.max(...precios);

    // Top 5 publicaciones ordenadas por precio más cercano a la mediana
    const sample = results
      .filter((r) => r.price >= 500000 && r.price <= 2000000000)
      .sort((a, b) => Math.abs(a.price - med) - Math.abs(b.price - med))
      .slice(0, 5)
      .map((r) => ({ titulo: r.title, precio: r.price, link: r.permalink }));

    return res.json({ found: true, count: precios.length, mediana: med, min, max, muestra: sample });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
