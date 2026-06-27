const APIFY_TOKEN = 'apify_api_6kWt9OKhI7BDKdooYzfCSyuuC9kbt62JLj7u';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const { query, lat, lng, radius } = await req.json();

  // Map radius to Google Maps zoom level
  const zoom = radius >= 4000 ? 12 : radius >= 2000 ? 13 : radius >= 1000 ? 14 : 15;

  // Use Google Maps search URL with exact coordinates for precise location
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat},${lng},${zoom}z`;

  const input = {
    startUrls: [{ url: mapsUrl }],
    maxCrawledPlacesPerSearch: 10,
    language: 'zh-TW',
    countryCode: 'tw',
    skipClosedPlaces: false,
  };

  const res = await fetch(
    `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${APIFY_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
  );

  const data = await res.json();
  const runId = data?.data?.id;

  if (!runId) return new Response(JSON.stringify({ error: 'Failed to start run' }), {
    status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });

  return new Response(JSON.stringify({ runId }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export const config = { runtime: 'edge' };
