// Cloudflare Worker — Proxy relay สำหรับ crawl เว็บที่บล็อก IP ต่างประเทศ
// Deploy ผ่าน dashboard.cloudflare.com → Workers & Pages → Create Worker → วาง code นี้ → Deploy
// แล้วตั้ง CRAWL_PROXY=https://<worker-name>.<account>.workers.dev ใน VPS .env

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const RELAY_HEADERS = [
  'location','cache-control','content-encoding','content-type',
  'strict-transport-security','x-frame-options','content-security-policy',
  'x-content-type-options','referrer-policy','x-robots-tag','server',
];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response('', { status: 204 });
    if (request.method !== 'POST') return new Response('POST only', { status: 405 });

    // ป้องกันเบื้องต้นด้วย optional secret — ตั้ง env variable PROXY_SECRET ใน Worker dashboard
    const secret = env.PROXY_SECRET || '';
    if (secret && request.headers.get('x-secret') !== secret) {
      return new Response('Unauthorized', { status: 401 });
    }

    let body;
    try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
    const { url, method = 'GET' } = body;
    if (!url || !/^https?:\/\//.test(url)) return new Response('Invalid url', { status: 400 });

    try {
      const upstream = await fetch(url, {
        method,
        headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'th,en;q=0.8' },
        redirect: 'manual',
      });

      const out = new Headers();
      out.set('content-type', upstream.headers.get('content-type') || 'text/html; charset=utf-8');
      out.set('x-ps', String(upstream.status)); // proxy status
      for (const h of RELAY_HEADERS) {
        const v = upstream.headers.get(h);
        if (v) out.set('x-ph-' + h, v);
      }

      return new Response(upstream.body, { status: 200, headers: out });
    } catch (e) {
      return new Response('', { status: 502, headers: { 'x-proxy-error': String(e.message).slice(0, 200) } });
    }
  }
}
