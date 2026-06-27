const APIFY_TOKEN = 'apify_api_6kWt9OKhI7BDKdooYzfCSyuuC9kbt62JLj7u';

export default async function handler(req) {
  const url = new URL(req.url);
  const runId = url.searchParams.get('runId');

  const res = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
  );
  const data = await res.json();
  const status = data?.data?.status;

  return new Response(JSON.stringify({ status }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export const config = { runtime: 'edge' };
