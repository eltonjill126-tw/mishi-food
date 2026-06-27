export const config = { runtime: 'edge' };

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const query = await req.text();

  for (const server of SERVERS) {
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) continue;
      const data = await res.text();
      return new Response(data, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (_) {
      // try next server
    }
  }

  return new Response(JSON.stringify({ error: 'All servers failed' }), {
    status: 502,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
