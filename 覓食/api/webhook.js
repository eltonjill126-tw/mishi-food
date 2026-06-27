import crypto from 'crypto';

export const config = { runtime: 'edge' };

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const MOOD_MAP = {
  '慶祝': ['日式料理', '牛排', '法式料理', '高級餐廳'],
  '約會': ['義大利麵', '法式料理', '日式料理', '浪漫餐廳'],
  '聚餐': ['火鍋', '燒烤', '熱炒', '合菜'],
  '療癒': ['拉麵', '甜點', '日式定食', '湯品'],
  '快速': ['便當', '滷肉飯', '牛肉麵', '自助餐'],
  '健康': ['沙拉', '蔬食', '輕食', '日式定食'],
  '週五': ['居酒屋', '燒烤', '火鍋', '熱炒'],
  '週末': ['brunch', '早午餐', '咖啡廳', '下午茶'],
  '生日': ['日式料理', '牛排', '法式料理', '高級餐廳'],
  '一個人': ['拉麵', '丼飯', '便當', '日式定食'],
};

function parseMessage(text) {
  let query = '';
  let location = '';
  for (const [mood, cuisines] of Object.entries(MOOD_MAP)) {
    if (text.includes(mood)) {
      query = cuisines[Math.floor(Math.random() * cuisines.length)];
      break;
    }
  }
  const locationMatch = text.match(/(台北|台中|高雄|台南|新北|桃園|信義|大安|中山|松山|內湖|士林|南港|文山|大同|萬華|中正|北投)/);
  if (locationMatch) location = locationMatch[1];
  if (!query) query = text.split(/\s+/)[0] || '餐廳';
  return { query, location: location || '台北' };
}

const COORDS = {
  '台北': [25.0330, 121.5654], '信義': [25.0330, 121.5654],
  '大安': [25.0265, 121.5435], '中山': [25.0629, 121.5238],
  '松山': [25.0497, 121.5771], '內湖': [25.0831, 121.5935],
  '士林': [25.0936, 121.5292], '南港': [25.0553, 121.6066],
  '文山': [24.9984, 121.5700], '大同': [25.0636, 121.5128],
  '萬華': [25.0336, 121.4995], '中正': [25.0326, 121.5198],
  '北投': [25.1317, 121.4980], '台中': [24.1477, 120.6736],
  '高雄': [22.6273, 120.3014], '台南': [22.9999, 120.2269],
};

async function searchRestaurants(query, location) {
  const [lat, lon] = COORDS[location] || COORDS['台北'];
  const q = '[out:json][timeout:20];(node["amenity"="restaurant"]["name"~"' + query + '",i](around:2000,' + lat + ',' + lon + ');node["amenity"="restaurant"](around:1500,' + lat + ',' + lon + '););out body 6;';
  for (const server of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']) {
    try {
      const res = await fetch(server, { method: 'POST', body: q, signal: AbortSignal.timeout(18000) });
      if (res.ok) return (await res.json()).elements || [];
    } catch (_) {}
  }
  return [];
}

function buildFlex(restaurants, query, location) {
  if (!restaurants.length) {
    return { type: 'text', text: '😔 找不到「' + query + '」在「' + location + '」附近的餐廳\n\n試試其他關鍵字，或直接上覓食網站：\nhttps://mishi-food.vercel.app' };
  }
  const bubbles = restaurants.slice(0, 5).map(r => {
    const name = r.tags?.['name:zh'] || r.tags?.name || '無名餐廳';
    const cuisine = (r.tags?.cuisine || query).replace(';', ' #');
    const addr = r.tags?.['addr:full'] || r.tags?.['addr:street'] || location + '附近';
    const phone = r.tags?.phone || r.tags?.['contact:phone'] || '';
    const mapsUrl = 'https://www.google.com/maps?q=' + r.lat + ',' + r.lon;
    const footerBtns = [{ type: 'button', style: 'primary', color: '#8B3A2A', height: 'sm', action: { type: 'uri', label: '📍 Google Maps 導航', uri: mapsUrl } }];
    if (phone) footerBtns.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: '📞 ' + phone, uri: 'tel:' + phone } });
    return {
      type: 'bubble', size: 'kilo',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#F5EFE6', paddingBottom: '6px', contents: [{ type: 'text', text: '🍽 覓食推薦', size: 'xs', color: '#8B3A2A', weight: 'bold' }] },
      body: { type: 'box', layout: 'vertical', spacing: 'sm', backgroundColor: '#FDFAF6', contents: [
        { type: 'text', text: name, weight: 'bold', size: 'md', wrap: true, color: '#2C1810' },
        { type: 'text', text: '📍 ' + addr, size: 'xs', color: '#666666', wrap: true },
        { type: 'text', text: '#' + cuisine, size: 'xs', color: '#8B3A2A' },
      ]},
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', backgroundColor: '#FDFAF6', contents: footerBtns },
    };
  });
  return { type: 'flex', altText: '覓食找到 ' + restaurants.length + ' 間「' + query + '」附近餐廳！', contents: { type: 'carousel', contents: bubbles } };
}

async function verify(body, sig) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(CHANNEL_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(signed))) === sig;
}

async function lineReply(token, messages) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    body: JSON.stringify({ replyToken: token, messages: Array.isArray(messages) ? messages : [messages] }),
  });
}

async function linePush(userId, messages) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    body: JSON.stringify({ to: userId, messages: Array.isArray(messages) ? messages : [messages] }),
  });
}

const GUIDE = {
  '搜尋：': '請直接告訴我你想吃什麼和在哪裡 😊\n\n例如：\n• 火鍋 台北信義\n• 拉麵 大安\n• 週五想慶祝 中山',
  '我想吃：': '請直接告訴我你想吃什麼和在哪裡 😊\n\n例如：\n• 火鍋 台北信義\n• 拉麵 大安\n• 週五想慶祝 中山',
  '我的心情是…': '告訴我你現在的心情，我幫你找最對味的餐廳 🎭\n\n試試：\n• 慶祝\n• 療癒\n• 週五放鬆\n• 約會\n• 快速解決\n• 健康養生',
  '場合：': '什麼場合呢？🎉\n\n• 生日慶祝\n• 情侶約會\n• 家人聚餐\n• 朋友聚會\n• 商務宴客\n• 一個人吃飯',
};

export default async function handler(req) {
  if (req.method === 'GET') return new Response('覓食 LINE Bot is running! 🍽', { status: 200 });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') || '';
  if (!(await verify(rawBody, signature))) return new Response('Unauthorized', { status: 401 });

  const { events = [] } = JSON.parse(rawBody);
  await Promise.all(events.map(async event => {
    if (event.type !== 'message' || event.message.type !== 'text') return;
    const text = event.message.text.trim();
    const userId = event.source.userId;
    const token = event.replyToken;

    if (GUIDE[text]) {
      await lineReply(token, { type: 'text', text: GUIDE[text] });
      return;
    }

    const { query, location } = parseMessage(text);
    await lineReply(token, { type: 'text', text: '🔍 正在幫你找「' + query + '」在「' + location + '」附近的餐廳…' });
    const restaurants = await searchRestaurants(query, location);
    await linePush(userId, buildFlex(restaurants, query, location));
  }));

  return new Response('OK', { status: 200 });
}
