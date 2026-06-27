const APIFY_TOKEN = 'apify_api_6kWt9OKhI7BDKdooYzfCSyuuC9kbt62JLj7u';

export default async function handler(req) {
  const url = new URL(req.url);
  const runId = url.searchParams.get('runId');

  const res = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=10`
  );
  const data = await res.json();

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export const config = { runtime: 'edge' };
