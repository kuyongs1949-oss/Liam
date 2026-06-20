const express = require('express');
const router = express.Router();

const NOMINATIM_UA = 'NoiseAssessmentSystem/1.0 (hyundai-engineering)';

// 간단한 메모리 캐시
const _cache = new Map();

async function nominatimFetch(url, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': NOMINATIM_UA } });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, (i + 1) * 2000));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }
  throw new Error('HTTP 429 (rate limited)');
}

/** GET /api/geocode/search?q=주소 */
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: '검색어가 필요합니다.' });

  const cacheKey = `search:${q}`;
  if (_cache.has(cacheKey)) return res.json(_cache.get(cacheKey));

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=kr&accept-language=ko`;
    const data = await nominatimFetch(url);
    _cache.set(cacheKey, data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: '주소 검색 실패', detail: e.message });
  }
});

/** GET /api/geocode/reverse?lat=...&lon=... */
router.get('/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat, lon 파라미터가 필요합니다.' });

  const cacheKey = `reverse:${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`;
  if (_cache.has(cacheKey)) return res.json(_cache.get(cacheKey));

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`;
    const data = await nominatimFetch(url);
    _cache.set(cacheKey, data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: '역지오코딩 실패', detail: e.message });
  }
});

module.exports = router;
