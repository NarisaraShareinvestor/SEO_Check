// Deep Crawler — ดึงหน้าเว็บแบบ raw HTML + (ถ้ามี Playwright) rendered DOM
// เคารพ robots.txt, ไล่ตาม sitemap + internal links, เก็บ headers/redirects ครบ
import * as cheerio from 'cheerio';

// Decode response body ด้วย charset ที่ถูกต้อง
// — ถ้าไม่ทำ: เว็บ windows-874/TIS-620 (เว็บไทยเก่า) จะได้ข้อความเพี้ยนทั้งหมด
// export เพื่อให้ golden-fixture test เรียก decode byte-level ได้ตรงๆ
export async function decodeHtmlFromResponse(res) {
  // 1. ลอง charset จาก HTTP Content-Type header ก่อน (reliable ที่สุด)
  const ct = res.headers.get('content-type') || '';
  let charset = ct.match(/charset=([\w-]+)/i)?.[1] || '';
  // 2. อ่าน raw bytes
  const buf = await res.arrayBuffer();
  // 3. ถ้าไม่มีใน header ให้ peek ส่วนต้นของ HTML หา <meta charset> (ASCII-safe อ่าน latin1 ได้)
  if (!charset) {
    const peek = new TextDecoder('latin1').decode(new Uint8Array(buf).slice(0, 2048));
    charset = peek.match(/charset=["']?([\w-]+)/i)?.[1] || '';
  }
  charset = (charset || 'utf-8').toLowerCase().replace(/\s/g, '');
  try {
    return { html: new TextDecoder(charset, { fatal: false }).decode(buf), charset };
  } catch {
    // charset ไม่รู้จัก (เช่น ชื่อแปลก) → fallback utf-8
    return { html: new TextDecoder('utf-8', { fatal: false }).decode(buf), charset: 'utf-8' };
  }
}

// ใช้ browser UA จริง — WAF หลายเจ้าบล็อกชื่อ bot แปลกหน้าทั้งที่ robots.txt อนุญาต (เรายังเคารพ robots.txt เสมอ)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FETCH_TIMEOUT = 12000; // หน้าจริงตอบใน 1-2 วิ; ที่นานกว่านี้คือ origin ค้าง (เช่น IRPlus flap) — ตัดไว ๆ
const CONCURRENCY = 5;

// Dispatcher ผ่อน TLS verify — ใช้เฉพาะ fallback ตอน origin ส่ง cert chain ไม่ครบ (ขาด intermediate)
// โหลดครั้งเดียวตอน import; ถ้า undici ไม่มีก็ปล่อย null (จะ fallback ไม่ได้แต่ไม่ crash)
// scope แคบ: ใช้กับ fetch ที่ขอ insecure เท่านั้น ไม่แตะ TLS ของ request อื่น (ต่างจาก NODE_TLS_REJECT_UNAUTHORIZED ที่ global)
let INSECURE_DISPATCHER = null;
try { const { Agent } = await import('undici'); INSECURE_DISPATCHER = new Agent({ connect: { rejectUnauthorized: false } }); } catch {}
// error code ของ TLS/cert ที่ "ผ่อน verify แล้วยังดึงเนื้อหาได้" — ใช้ตัดสินว่าควร fallback insecure
const TLS_ERROR_RE = /UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT|SELF_SIGNED_CERT|DEPTH_ZERO|CERT_HAS_EXPIRED|ERR_TLS_CERT_ALTNAME|CERT_UNTRUSTED|UNABLE_TO_GET_CRL/i;
function isTlsChainError(e) {
  const code = e?.cause?.code || e?.code || '';
  return TLS_ERROR_RE.test(code) || TLS_ERROR_RE.test(String(e?.message || ''));
}

// Proxy (optional) — เว็บไทยหลายเจ้า (irplus IR, ราชการ) บล็อก IP ดาต้าเซ็นเตอร์/ต่างประเทศ
// สองรูปแบบ:
//   CRAWL_PROXY=https://xxx.workers.dev  → Cloudflare Worker relay (ฟรี, ใช้กับ fetch เท่านั้น)
//   CRAWL_PROXY=http://user:pass@host:port → Standard HTTP proxy (ใช้กับทั้ง fetch + Playwright)
// อ่าน dynamic ทุกครั้ง — ES module imports hoisted ก่อน server.js parse .env เสร็จ ถ้าใช้ค่า module-level จะได้ค่าว่างเสมอ
function getProxyUrl() { return process.env.CRAWL_PROXY || process.env.PROXY_URL || ''; }
function getWorkerRelay() { const p = getProxyUrl(); return p.startsWith('https://') ? p : ''; }

// แปลง PROXY_URL เป็นรูปแบบที่ Playwright ต้องการ — Worker relay ใช้กับ Playwright ไม่ได้
function playwrightProxy() {
  const p = getProxyUrl(); const wr = getWorkerRelay();
  if (!p || wr) return undefined;
  try {
    const u = new URL(p);
    const r = { server: `${u.protocol}//${u.host}` };
    if (u.username) r.username = decodeURIComponent(u.username);
    if (u.password) r.password = decodeURIComponent(u.password);
    return r;
  } catch { return undefined; }
}

export function normalizeUrl(raw, base) {
  try {
    const u = new URL(raw, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    // ตัด tracking params ที่ทำให้ URL ซ้ำ
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(p => u.searchParams.delete(p));
    let s = u.toString();
    return s;
  } catch { return null; }
}

function sameSite(url, origin) {
  try {
    const a = new URL(url), b = new URL(origin);
    const strip = h => h.replace(/^www\./, '');
    return strip(a.hostname) === strip(b.hostname);
  } catch { return false; }
}

async function fetchWithMeta(url, { method = 'GET', redirect = 'manual', direct = false, insecure = false } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  const started = Date.now();
  // direct=true → ข้าม relay บังคับต่อตรง (ใช้ตอน relay เจอ Cloudflare 52x = ปัญหา relay↔origin)
  // insecure=true → ต่อตรงแบบผ่อน TLS verify (ใช้ตอน cert chain origin ไม่ครบ) — บังคับ direct เสมอ
  if (insecure) direct = true;
  const workerRelay = direct ? '' : getWorkerRelay();
  try {
    if (workerRelay) {
      // ส่งผ่าน Cloudflare Worker relay — Worker fetch ด้วย IP ของ Cloudflare (ใกล้ target)
      const wr = await fetch(workerRelay, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, method }),
        signal: ctrl.signal,
      });
      const elapsed = Date.now() - started;
      if (!wr.ok) return { res: null, elapsed, error: `worker-${wr.status}` };
      // สร้าง Response จำลองจาก metadata ที่ Worker ส่งกลับมาใน header
      const status = parseInt(wr.headers.get('x-ps') || '200');
      const fakeHeaders = new Headers();
      for (const [k, v] of wr.headers) {
        if (k.startsWith('x-ph-')) fakeHeaders.set(k.slice(5), v);
      }
      fakeHeaders.set('content-type', wr.headers.get('content-type') || '');
      return { res: new Response(wr.body, { status, headers: fakeHeaders }), elapsed };
    }
    const res = await fetch(url, {
      method, redirect,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'th,en;q=0.8' },
      signal: ctrl.signal,
      ...(insecure && INSECURE_DISPATCHER ? { dispatcher: INSECURE_DISPATCHER } : {}),
    });
    const elapsed = Date.now() - started;
    return { res, elapsed };
  } finally { clearTimeout(timer); }
}

// ตาม redirect เองเพื่อเก็บ chain ทั้งหมด — retry เมื่อเจอ error ชั่วคราว
// (เว็บหลายเจ้า flap/throttle: drop connection หรือ 5xx เป็นพักๆ — retry กันผลหลอกตา 0/F)
async function fetchFollowing(url, maxHops = 8, retries = 2) {
  let lastErr = null;
  const relayActive = !!getWorkerRelay();
  let forceDirect = false;   // relay เจอ Cloudflare 52x หรือ worker error → สลับมาต่อตรงสำหรับ URL นี้
  let forceInsecure = false; // origin ส่ง cert chain ไม่ครบ → ต่อตรงแบบผ่อน TLS verify (ยัง analyze ได้ + รายงานเป็น finding)
  let tlsErrorCode = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 600 * attempt)); // backoff
    const chain = [];
    let current = url;
    try {
      for (let hop = 0; hop <= maxHops; hop++) {
        let { res, elapsed, error } = await fetchWithMeta(current, { direct: forceDirect, insecure: forceInsecure });
        // relay ตอบ error (worker ล่ม/บล็อก = res null) → ลองต่อตรงทันที (origin มักต่อตรงได้)
        if (!res && relayActive && !forceDirect) {
          forceDirect = true;
          ({ res, elapsed, error } = await fetchWithMeta(current, { direct: true, insecure: forceInsecure }));
        }
        if (!res) throw new Error(error || 'no-response');
        let status = res.status;
        // Cloudflare 52x (520–527) ผ่าน relay = ปัญหา relay(CF)↔origin (มัก TLS/526) ไม่ใช่ origin ล่มจริง
        // → ต่อตรงทันทีในรอบเดียวกัน แล้วใช้ direct ต่อทั้ง URL นี้ (เคยทำให้ VGI ขึ้น 526 หลอกตา)
        if (relayActive && !forceDirect && status >= 520 && status <= 527) {
          try { res.body?.cancel?.(); } catch {}
          forceDirect = true;
          ({ res, elapsed, error } = await fetchWithMeta(current, { direct: true, insecure: forceInsecure }));
          if (!res) throw new Error(error || 'no-response');
          status = res.status;
        }
        if (status >= 300 && status < 400) {
          const loc = res.headers.get('location');
          chain.push({ url: current, status, location: loc, elapsed });
          if (!loc) return { finalUrl: current, status, chain, res: null, insecure: forceInsecure, tlsErrorCode };
          try { res.body?.cancel?.(); } catch {}
          current = new URL(loc, current).toString();
          continue;
        }
        // 5xx = ชั่วคราว → retry; 4xx/2xx = ถาวร → คืนเลย
        if (status >= 500 && attempt < retries) { try { res.body?.cancel?.(); } catch {} lastErr = `http-${status}`; break; }
        return { finalUrl: current, status, chain, res, elapsed, insecure: forceInsecure, tlsErrorCode };
      }
      if (chain.length > maxHops) return { finalUrl: current, status: 0, chain, res: null, error: 'redirect-loop' };
    } catch (e) {
      lastErr = String(e.message || e); // network error / timeout → retry
      // cert chain ของ origin ไม่ครบ (ขาด intermediate ฯลฯ) → รอบหน้าต่อตรงแบบผ่อน TLS verify
      if (!forceInsecure && INSECURE_DISPATCHER && isTlsChainError(e)) {
        forceInsecure = true; forceDirect = true;
        tlsErrorCode = e?.cause?.code || e?.code || 'TLS_CHAIN_INCOMPLETE';
        if (attempt >= retries) retries = attempt + 1; // ให้โอกาส retry แบบ insecure อย่างน้อยหนึ่งครั้ง
      }
    }
  }
  return { finalUrl: url, status: 0, chain: [], res: null, error: lastErr || 'fetch-failed', insecure: forceInsecure, tlsErrorCode };
}

// fetch เดี่ยว (ไม่ไล่ redirect chain เอง) พร้อม fallback ชุดเดียวกับ fetchFollowing:
// relay 52x → ต่อตรง, worker error → ต่อตรง, cert chain พัง → ผ่อน TLS verify
// ใช้กับ robots/llms/sitemap/favicon/404/broken-link ที่เดิมเรียก fetchWithMeta ตรงๆ —
// กัน false negative บนเว็บ cert พัง/relay มีปัญหา (เช่น www.vgi.co.th: robots/sitemap เคยได้ 526 → รายงานว่า "ไม่มี")
async function tryFetch(url, { method = 'GET', redirect = 'follow' } = {}) {
  const relay = !!getWorkerRelay();
  let direct = false, insecure = false;
  for (let pass = 0; pass < 4; pass++) {
    try {
      const { res, elapsed, error } = await fetchWithMeta(url, { method, redirect, direct, insecure });
      if (!res) { if (relay && !direct) { direct = true; continue; } return { res: null, error, insecure }; }
      if (relay && !direct && res.status >= 520 && res.status <= 527) { try { res.body?.cancel?.(); } catch {} direct = true; continue; }
      return { res, elapsed, insecure };
    } catch (e) {
      if (!insecure && INSECURE_DISPATCHER && isTlsChainError(e)) { insecure = true; direct = true; continue; }
      return { res: null, error: String(e.message || e), insecure };
    }
  }
  return { res: null, error: 'fetch-failed', insecure };
}

export function parseRobots(txt) {
  const groups = []; // {agents:[], rules:[{type, path}]}
  let cur = null;
  const sitemaps = [];
  for (const lineRaw of (txt || '').split(/\r?\n/)) {
    const line = lineRaw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
    } else if (key === 'disallow' || key === 'allow') {
      if (cur) cur.rules.push({ type: key, path: val });
    } else if (key === 'sitemap') {
      sitemaps.push(val);
    }
  }
  return { groups, sitemaps };
}

export function robotsAllows(robots, userAgent, path) {
  if (!robots) return true;
  const ua = userAgent.toLowerCase();
  let group = robots.groups.find(g => g.agents.some(a => a !== '*' && ua.includes(a)));
  if (!group) group = robots.groups.find(g => g.agents.includes('*'));
  if (!group) return true;
  let best = null; // longest match wins, allow beats disallow on tie
  for (const r of group.rules) {
    if (!r.path) { if (r.type === 'disallow' && best === null) best = { len: 0, allow: true }; continue; }
    const pattern = r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const re = new RegExp('^' + pattern);
    if (re.test(path)) {
      const len = r.path.length;
      if (!best || len > best.len || (len === best.len && r.type === 'allow')) {
        best = { len, allow: r.type === 'allow' };
      }
    }
  }
  return best ? best.allow : true;
}

const SITEMAP_URL_LIMIT = 2000;

async function fetchSitemapUrls(sitemapUrl, seen = new Set(), depth = 0, stats = null) {
  if (depth > 2 || seen.has(sitemapUrl)) return [];
  seen.add(sitemapUrl);
  try {
    const { res } = await tryFetch(sitemapUrl, { redirect: 'follow' });
    if (!res?.ok) return [];
    // ตัด XML ที่ใหญ่เกิน 2MB — sitemap บางเจ้ามีแสน URL
    const rawXml = await res.text();
    const xml = rawXml.length > 2_000_000 ? rawXml.slice(0, 2_000_000) : rawXml;
    if (stats && /<lastmod>/i.test(xml)) stats.hasLastmod = true;
    const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(m => m[1].trim());
    if (/<sitemapindex/i.test(xml)) {
      const nested = [];
      for (const loc of locs.slice(0, 10)) {
        // ใช้ for...of แทน push(...arr) เพื่อป้องกัน call stack overflow กับ array ใหญ่
        const sub = await fetchSitemapUrls(loc, seen, depth + 1, stats);
        for (const u of sub) {
          nested.push(u);
          if (nested.length >= SITEMAP_URL_LIMIT) return nested;
        }
      }
      return nested;
    }
    return locs.slice(0, SITEMAP_URL_LIMIT);
  } catch { return []; }
}

// ตรวจ origin variants: http/https × www/non-www ควร redirect มารวมที่เดียว
async function checkOriginVariants(origin) {
  const u = new URL(origin);
  if (/^(localhost|127\.|192\.168\.|10\.)/.test(u.hostname)) return []; // เว็บ local ไม่มี variants
  const bare = u.hostname.replace(/^www\./, '');
  const candidates = [
    `https://${bare}/`, `https://www.${bare}/`,
    `http://${bare}/`, `http://www.${bare}/`,
  ].filter(v => new URL(v).origin !== origin);
  // ตรวจคู่ขนาน + ไม่ retry: เป็นแค่ diagnostic — variant ที่ค้างไม่ควรหน่วงทั้ง audit
  const results = await Promise.all(candidates.map(async (v) => {
    try {
      const { finalUrl, status, chain } = await fetchFollowing(v, 8, 0);
      return { variant: v, status, finalOrigin: (() => { try { return new URL(finalUrl).origin; } catch { return finalUrl; } })(), hops: chain.length };
    } catch (e) { return { variant: v, status: 0, error: String(e.message || e) }; }
  }));
  return results;
}

export function extractPageData(html, url, headers, status, elapsed, chain) {
  let $;
  try { $ = cheerio.load(html); }
  catch { $ = cheerio.load(''); } // HTML ผิดรูป fallback เป็นเปล่า
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try { jsonLd.push({ ok: true, data: JSON.parse(raw) }); }
    catch (e) { jsonLd.push({ ok: false, error: String(e.message || e), raw: raw.slice(0, 200) }); }
  });
  const links = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/^(javascript:|mailto:|tel:|#)/i.test(href.trim())) return;
    links.push({
      href: href.trim(),
      text: $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120),
      rel: $(el).attr('rel') || '',
      target: $(el).attr('target') || '',
    });
  });
  const images = [];
  $('img').each((_, el) => {
    images.push({
      src: ($(el).attr('src') || $(el).attr('data-src') || '').slice(0, 300),
      alt: $(el).attr('alt'),
      loading: $(el).attr('loading') || '',
      width: $(el).attr('width') || '', height: $(el).attr('height') || '',
    });
  });
  const headings = [];
  let hiddenH1 = 0;
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    headings.push({ tag: el.tagName.toLowerCase(), text: $(el).text().replace(/\s+/g, ' ').trim().slice(0, 200) });
  });
  // ตรวจ H1 ที่ถูกซ่อนด้วย inline style — CSS class ต้องใช้ Playwright computed style
  $('h1').each((_, el) => {
    const style = ($(el).attr('style') || '').toLowerCase();
    if (/visibility\s*:\s*hidden|display\s*:\s*none|opacity\s*:\s*0(?!\.)|(^|\s|;)font-size\s*:\s*0/.test(style)) hiddenH1++;
  });
  const metas = {};
  $('meta').each((_, el) => {
    const name = ($(el).attr('name') || $(el).attr('property') || '').toLowerCase();
    if (name) metas[name] = $(el).attr('content') ?? '';
  });
  const scripts = $('script[src]').map((_, el) => $(el).attr('src')).get();
  const stylesheets = $('link[rel="stylesheet"]').map((_, el) => $(el).attr('href')).get();
  let inlineScriptBytes = 0;
  $('script:not([src])').each((_, el) => { inlineScriptBytes += ($(el).contents().text() || '').length; });
  let inlineStyleBytes = 0;
  $('style').each((_, el) => { inlineStyleBytes += ($(el).contents().text() || '').length; });
  const hasNoscript = !!$('noscript').length;

  // ข้อมูลเชิงลึกเพิ่มเติม
  const hasDoctype = /^\s*<!doctype\s+html/i.test(html);
  const headBlockingScripts = $('head script[src]:not([defer]):not([async]):not([type="module"])').length;
  const headStylesheets = $('head link[rel="stylesheet"]').length;
  const deprecatedTags = $('font, center, marquee, blink, frameset').length;
  const metaRefresh = !!$('meta[http-equiv="refresh" i]').length;
  const canonicalCount = $('link[rel="canonical"]').length;
  const emptyHeadings = $('h1,h2,h3,h4,h5,h6').filter((_, el) => !$(el).text().trim()).length;
  const hasMailto = !!$('a[href^="mailto:"]').length;
  let bodyTextForSignals = '';
  try { bodyTextForSignals = $('body').text(); } catch { bodyTextForSignals = ''; }
  const hasPhone = /(\+66|0\d{1,2})[\s-]?\d{3}[\s-]?\d{3,4}/.test(bodyTextForSignals);
  const copyrightYears = [...bodyTextForSignals.matchAll(/(?:©|&copy;|copyright)[^\n]{0,40}?((?:19|20)\d{2})/gi)].map(m => +m[1]);
  const maxCopyrightYear = copyrightYears.length ? copyrightYears.reduce((a, b) => a > b ? a : b) : null;

  // ── ดึงข้อมูลจริงสำหรับ schema/E-E-A-T: social profiles (sameAs), logo, author ──
  const abs = (h) => { try { return new URL(h, url).toString(); } catch { return ''; } };
  // match จาก "host" จริง (ไม่ใช่ substring — กัน poscothaino x.com ไป match x.com)
  const SOCIAL_HOSTS = ['facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'tiktok.com', 'pinterest.com', 'threads.net', 'line.me', 'lin.ee'];
  const isSocial = (h) => { try { const host = new URL(h, url).hostname.replace(/^www\./, '').toLowerCase(); return SOCIAL_HOSTS.some(d => host === d || host.endsWith('.' + d)); } catch { return false; } };
  const socials = [...new Set($('a[href]').map((_, el) => $(el).attr('href') || '').get()
    .filter(isSocial).map(abs).filter(u => /^https?:\/\//.test(u))
    .map(u => u.replace(/[?#].*$/, '').replace(/\/$/, '')))].slice(0, 12);
  // logo ต้องเป็น "ไฟล์รูปจริง" (มีนามสกุลรูป) — ไม่งั้น src ว่าง/"/" จะถูกเก็บผิด
  const isImg = (u) => /\.(png|jpe?g|svg|webp|gif|avif|ico)(\?|#|$)/i.test(u || '');
  let logo = '';
  for (const j of jsonLd) { if (!j.ok) continue; const m = JSON.stringify(j.data).match(/"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*?"url"\s*:\s*"([^"]+)")/); if (m && isImg(m[1] || m[2])) { logo = abs(m[1] || m[2]); break; } }
  if (!logo) { const li = $('img[src*="logo" i], img[alt*="logo" i], img[class*="logo" i], [class*="logo" i] img').first(); const src = abs(li.attr('src') || li.attr('data-src') || ''); if (isImg(src)) logo = src; }
  if (!logo && isImg(metas['og:image'])) logo = abs(metas['og:image']);
  let author = (metas['author'] || '').trim();
  if (!author) for (const j of jsonLd) { if (!j.ok) continue; const m = JSON.stringify(j.data).match(/"author"\s*:\s*(?:"([^"]+)"|\{[^}]*?"name"\s*:\s*"([^"]+)")/); if (m && (m[1] || m[2])) { author = (m[1] || m[2]).trim(); break; } }
  if (!author) { const ra = $('a[rel~="author" i], [class*="author" i] a, .byline a').first().text().replace(/\s+/g, ' ').trim(); if (ra && ra.length < 60) author = ra; }

  // ตัด script/style ออกก่อนสกัดข้อความ — ไม่ให้โค้ดปนใน text/wordCount
  $('script, style, noscript, template').remove();
  let text = '';
  try { text = $('body').text().replace(/\s+/g, ' ').trim(); } catch { text = ''; }

  // ตรวจ SPA shell: root container ว่างเปล่า + framework marker
  const rootSelectors = ['#app', '#root', '#__next', '#__nuxt', '[data-reactroot]'];
  let emptyRoot = false;
  for (const sel of rootSelectors) {
    const el = $(sel);
    if (el.length && el.text().replace(/\s+/g, '').length < 50) { emptyRoot = true; break; }
  }
  const frameworkMarkers = {
    nuxt: /__NUXT__|\/_nuxt\//.test(html),
    next: /__NEXT_DATA__|\/_next\//.test(html),
    react: /data-reactroot|react-dom/.test(html),
    vue: /__vue__|vue\.runtime/.test(html),
    angular: /ng-version=/.test(html),
  };

  return {
    url, status, elapsed,
    redirectChain: chain || [],
    headers: {
      'content-type': headers.get('content-type') || '',
      'content-encoding': headers.get('content-encoding') || '',
      'cache-control': headers.get('cache-control') || '',
      'strict-transport-security': headers.get('strict-transport-security') || '',
      'content-security-policy': headers.get('content-security-policy') || '',
      'x-frame-options': headers.get('x-frame-options') || '',
      'x-content-type-options': headers.get('x-content-type-options') || '',
      'referrer-policy': headers.get('referrer-policy') || '',
      'x-robots-tag': headers.get('x-robots-tag') || '',
      'server': headers.get('server') || '',
    },
    htmlBytes: html.length,
    title: $('title').first().text().trim(),
    metas,
    lang: $('html').attr('lang') || '',
    charset: $('meta[charset]').attr('charset') || (metas['content-type'] || '').match(/charset=([\w-]+)/)?.[1] || '',
    canonical: $('link[rel="canonical"]').attr('href') || '',
    ampHtml: $('link[rel="amphtml"]').attr('href') || '',
    favicon: !!$('link[rel*="icon"]').length,
    hreflang: $('link[rel="alternate"][hreflang]').map((_, el) => ({ lang: $(el).attr('hreflang'), href: $(el).attr('href') })).get(),
    headings, links, images, jsonLd,
    scripts, stylesheets, inlineScriptBytes, inlineStyleBytes,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    textLength: text.length,
    textSample: text.slice(0, 1500),
    hasNoscript,
    emptyRoot, frameworkMarkers,
    hasTables: !!$('table').length,
    listCount: $('ul,ol').length,
    hasDoctype, headBlockingScripts, headStylesheets, deprecatedTags,
    metaRefresh, canonicalCount, emptyHeadings, hasMailto, hasPhone, maxCopyrightYear,
    hiddenH1,
    socials, logo, author,
  };
}

// ── Rendered crawl (optional — ใช้ได้เมื่อติดตั้ง playwright) ──
async function tryRenderPages(urls, onProgress) {
  let pw;
  try { pw = await import('playwright'); }
  catch { return { available: false, pages: {} }; }
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true, proxy: playwrightProxy() });
    const ctx = await browser.newContext({ userAgent: UA, locale: 'th-TH' });
    const out = {};
    for (const url of urls) {
      try {
        onProgress?.(`กำลัง render ด้วย headless Chrome: ${url}`);
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        const data = await page.evaluate(() => ({
          title: document.title,
          h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()),
          h1Hidden: [...document.querySelectorAll('h1')].filter(h => {
            const s = window.getComputedStyle(h);
            return s.visibility === 'hidden' || s.display === 'none' ||
                   parseFloat(s.opacity) === 0 || parseFloat(s.fontSize) < 1;
          }).length,
          textLength: document.body?.innerText?.replace(/\s+/g, ' ').trim().length || 0,
          metaDescription: document.querySelector('meta[name="description"]')?.content || '',
          linkCount: document.querySelectorAll('a[href]').length,
        }));
        out[url] = data;
        await page.close();
      } catch (e) { out[url] = { error: String(e.message || e) }; }
    }
    return { available: true, pages: out };
  } catch (e) {
    return { available: false, error: String(e.message || e), pages: {} };
  } finally {
    try { await browser?.close(); } catch {}
  }
}

// ── Rendered crawl สำหรับเว็บ SPA — render ด้วย chromium เพื่อค้นลิงก์ JS + เก็บ raw shell ไว้ครบ ──
// ใช้เมื่อ raw HTML เป็น shell (เนื้อหา/ลิงก์ถูก render ด้วย JS) ที่ raw crawl หาหน้าไม่ครบ
// กลไก: ต่อ 1 ครั้ง/หน้า ได้ทั้ง raw (response.text() = สิ่งที่ Google รอบแรก/AI bot เห็น) และ rendered (page.content())
//   → page data ใช้ "raw" (คง emptyRoot/spa-shell/render-diff) · ค้นลิงก์ใช้ "rendered" (เจอหน้า JS ครบ)
// ต่อตรงเสมอ (Playwright ใช้ Cloudflare Worker relay ไม่ได้) — เว็บที่ block IP เซิร์ฟเวอร์จะ render ไม่ได้ แล้ว fallback ไป raw
// NOTE (อนาคต/ถ้ามีงบ): ย้าย render ไป Cloudflare Browser Rendering ผ่าน worker relay → render เว็บที่ geo-block IP ได้ด้วย
//   ดู getWorkerRelay()/playwrightProxy() — จุดที่จะสลับ engine คือ browser launch ด้านล่าง
async function renderedCrawl(startUrl, seedUrls, { maxPages, onProgress }) {
  let pw;
  try { pw = await import('playwright'); } catch { return { available: false, reason: 'no-playwright', pages: [] }; }
  let browser;
  try { browser = await pw.chromium.launch({ headless: true, proxy: playwrightProxy() }); }
  catch (e) { return { available: false, reason: 'launch-failed: ' + String(e.message || e), pages: [] }; }

  const origin = new URL(startUrl).origin;
  const FILE_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|gz|tar|jpe?g|png|gif|svg|webp|avif|ico|bmp|mp[34]|m4a|wav|mov|avi|mkv|webm|css|mjs|json|rss|csv|woff2?|ttf|eot|otf|dmg|exe|apk)(\?|#|$)/i;
  const PARAM_CAP = 3, paramCount = new Map();
  const queued = new Set(), frontier = [];
  const depthOf = (u) => { try { return new URL(u).pathname.replace(/\/+$/, '').split('/').filter(Boolean).length; } catch { return 99; } };
  const enqueue = (raw, base) => {
    const n = normalizeUrl(raw, base);
    if (!n || !sameSite(n, origin) || queued.has(n) || FILE_EXT.test(n)) return;
    if (queued.size >= maxPages * 50) return;
    try { const u = new URL(n); if (u.search) { const c = paramCount.get(u.pathname) || 0; if (c >= PARAM_CAP) return; paramCount.set(u.pathname, c + 1); } } catch {}
    queued.add(n); frontier.push(n);
  };
  enqueue(startUrl);
  for (const u of seedUrls) enqueue(u);

  const RENDER_TIMEOUT = 25000, RENDER_CONCURRENCY = 3;
  const pages = [], renderedDiff = {};
  let claimed = 0, active = 0;
  const ctx = await browser.newContext({ userAgent: UA, locale: 'th-TH' });

  const renderOne = async (url, num) => {
    onProgress(`กำลัง render หน้า (${num}/${maxPages}): ${url}`);
    const page = await ctx.newPage();
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: RENDER_TIMEOUT });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      if (!resp) { pages.push({ url, status: 0, error: 'no-response' }); return; }
      const status = resp.status();
      // Playwright รวม header ซ้ำด้วย \n (เช่น "Accept-Encoding\nAccept-Encoding") → new Headers() reject
      // ต้อง sanitize ก่อน ไม่งั้น throw แล้ว render ทุกหน้าจะกลายเป็น error (ค้นลิงก์ไม่ได้เลย)
      const headers = new Headers();
      for (const [k, v] of Object.entries(resp.headers())) { try { headers.set(k, String(v).replace(/[\r\n]+/g, ', ')); } catch {} }
      const ct = headers.get('content-type') || '';
      const finalUrl = page.url();
      if (!ct.includes('text/html')) { pages.push({ url, finalUrl, status, nonHtml: true, contentType: ct }); return; }
      let rawHtml = ''; try { rawHtml = await resp.text(); } catch {}
      const renderedHtml = await page.content();
      // page data = raw (สิ่งที่ Google รอบแรก/AI bot เห็น) — ถ้าดึง raw ไม่ได้ใช้ rendered แทน
      const data = extractPageData((rawHtml || renderedHtml).slice(0, 600_000), url, headers, status, 0, []);
      const rd = extractPageData(renderedHtml.slice(0, 600_000), url, headers, status, 0, []);
      data.finalUrl = finalUrl;
      // เก็บเนื้อหา "ฉบับ render แล้ว" ไว้กับ page (persist ใน audit) — ใช้เสนอ H1/Title จริงที่มีอยู่ใน DOM
      // (SPA: H1/title เขียนไว้แล้วใน JS แค่ไม่อยู่ raw HTML → รายงานเสนอค่าจริงได้เลย ไม่ต้องเดา)
      const renH1 = (rd.headings || []).filter(h => h.tag === 'h1').map(h => h.text);
      data.renderedTitle = rd.title || '';
      data.renderedH1 = renH1;
      data.renderedDescription = rd.metas?.['description'] || '';
      data.renderedTextLength = rd.textLength || 0;
      // social/logo/author จาก rendered DOM (SPA: raw ว่าง ต้องเอาจาก rendered)
      if (rd.socials?.length) data.socials = rd.socials;
      if (rd.logo) data.logo = rd.logo;
      if (rd.author) data.author = rd.author;
      pages.push(data);
      // render-diff (เทียบ raw vs rendered)
      renderedDiff[finalUrl] = { title: rd.title, h1: renH1, textLength: rd.textLength };
      // ค้นลิงก์จาก rendered (เจอลิงก์ JS ครบ)
      for (const l of (rd.links || [])) enqueue(l.href, finalUrl);
    } catch (e) {
      pages.push({ url, status: 0, error: String(e.message || e) });
    } finally { try { await page.close(); } catch {} }
  };

  try {
    while (claimed < maxPages && frontier.length) {
      let minDepth = Infinity;
      for (const u of frontier) { const d = depthOf(u); if (d < minDepth) minDepth = d; }
      const levelUrls = [], rest = [];
      for (const u of frontier) (depthOf(u) === minDepth ? levelUrls : rest).push(u);
      frontier.length = 0; frontier.push(...rest);
      levelUrls.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      for (const url of levelUrls) {
        if (claimed >= maxPages) break;
        claimed++; const num = claimed;
        while (active >= RENDER_CONCURRENCY) await new Promise(r => setTimeout(r, 50));
        active++;
        renderOne(url, num).finally(() => { active--; });
      }
      while (active > 0) await new Promise(r => setTimeout(r, 50));
      // early-abort: ชั้นแรกแล้วยังไม่ได้หน้าที่ render สำเร็จเลย → เว็บน่าจะ block IP เซิร์ฟเวอร์ (เลิก กัน timeout ยาว)
      if (!pages.some(p => p.title !== undefined && p.status === 200)) break;
    }
  } finally { try { await browser.close(); } catch {} }

  return { available: true, pages, renderedDiff };
}

export async function crawlSite(startUrl, { maxPages = 30, onProgress = () => {} } = {}) {
  const origin = new URL(startUrl).origin;
  const site = {
    startUrl, origin,
    https: startUrl.startsWith('https://'),
    robots: null, robotsTxt: null, robotsStatus: null,
    llmsTxt: null,
    sitemaps: [], sitemapUrls: [],
    pages: [], // page data
    fetchErrors: [],
    brokenLinks: [], // {from, to, status}
    notFoundHandling: null,
    rendered: { available: false, pages: {} },
  };

  // 1. robots.txt
  onProgress('กำลังอ่าน robots.txt...');
  try {
    const { res, insecure } = await tryFetch(new URL('/robots.txt', origin).toString(), { redirect: 'follow' });
    if (insecure) site.tlsInsecure = true;
    site.robotsStatus = res.status;
    if (res.ok) {
      site.robotsTxt = await res.text();
      site.robots = parseRobots(site.robotsTxt);
    }
  } catch (e) { site.fetchErrors.push({ what: 'robots.txt', error: String(e.message || e) }); }

  // 2. llms.txt (GEO) — ต้องเป็น text จริง ไม่ใช่หน้า HTML จาก soft-404
  try {
    const { res } = await tryFetch(new URL('/llms.txt', origin).toString(), { redirect: 'follow' });
    if (res.ok) {
      const txt = await res.text();
      const looksHtml = /^\s*<(!doctype|html|head|body)/i.test(txt) || (res.headers.get('content-type') || '').includes('text/html');
      site.llmsTxt = looksHtml ? null : txt.slice(0, 5000);
    } else site.llmsTxt = null;
  } catch { site.llmsTxt = null; }

  // 3. sitemap
  onProgress('กำลังอ่าน sitemap.xml...');
  const smStats = { hasLastmod: false };
  const sitemapCandidates = [...(site.robots?.sitemaps || [])];
  if (!sitemapCandidates.length) sitemapCandidates.push(new URL('/sitemap.xml', origin).toString());
  for (const sm of sitemapCandidates.slice(0, 5)) {
    const urls = await fetchSitemapUrls(sm, new Set(), 0, smStats);
    if (urls.length) site.sitemaps.push(sm);
    site.sitemapUrls.push(...urls);
  }
  site.sitemapUrls = [...new Set(site.sitemapUrls)];
  site.sitemapHasLastmod = smStats.hasLastmod;

  // 3.5 ตรวจ origin variants + favicon (คู่ขนาน)
  onProgress('กำลังตรวจ www/https variants และ favicon...');
  const [variants, faviconStatus] = await Promise.all([
    checkOriginVariants(origin).catch(() => []),
    (async () => { try { const { res } = await tryFetch(new URL('/favicon.ico', origin).toString(), { redirect: 'follow' }); const st = res?.status ?? 0; try { res?.body?.cancel?.(); } catch {} return st; } catch { return 0; } })(),
  ]);
  site.variants = variants;
  site.faviconStatus = faviconStatus;

  // 4. BFS crawl — เลือกหน้าแบบ deterministic เพื่อให้ตรวจเว็บเดิมได้ "ชุดหน้าเดิม" ทุกครั้ง
  //    (เดิมเลือกหน้าตามลำดับที่ fetch เสร็จ ซึ่งขึ้นกับ network timing → ชุดหน้า/คะแนนไม่นิ่ง)
  // ข้ามลิงก์ไฟล์ (PDF/รูป/zip ฯลฯ) — ไม่ใช่หน้า HTML ที่ตรวจ SEO ได้ และทำให้ชุดหน้าไม่นิ่ง + เปลือง budget
  const FILE_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|gz|tar|jpe?g|png|gif|svg|webp|avif|ico|bmp|mp[34]|m4a|wav|mov|avi|mkv|webm|css|mjs|json|rss|csv|woff2?|ttf|eot|otf|dmg|exe|apk)(\?|#|$)/i;
  const queued = new Set();          // URL ที่เคยถูกเพิ่มเข้า frontier (กันซ้ำ — แต่ละ URL crawl ครั้งเดียว)
  const frontier = [];               // คิวหน้า (จัดเรียง deterministic ก่อน shift ทุกครั้ง)
  const depthOf = (u) => { try { return new URL(u).pathname.replace(/\/+$/, '').split('/').filter(Boolean).length; } catch { return 99; } };
  // จำกัด URL ที่มี query string ต่อ "path เดียวกัน" — เก็บ path เปล่าเสมอ + query ได้ไม่เกิน PARAM_CAP
  // กันหน้า filter/pagination (เช่น /calendar?page=&year=&category_id=) บาน crawl budget
  // และทำให้ตัวเลข duplicate-title / canonical-missing / desc ไม่พองหลอกตาจาก URL param ของหน้าเดียว
  const PARAM_CAP = 3;
  const paramCount = new Map(); // pathname -> จำนวน URL ที่มี query ที่ queue แล้ว
  const enqueue = (raw, base) => {
    const n = normalizeUrl(raw, base);
    if (!n || !sameSite(n, origin) || queued.has(n) || FILE_EXT.test(n)) return;
    if (queued.size >= maxPages * 50) return; // กันบวมบนเว็บใหญ่มาก
    try {
      const u = new URL(n);
      if (u.search) {
        const c = paramCount.get(u.pathname) || 0;
        if (c >= PARAM_CAP) return; // เกินโควต้า param ของ path นี้แล้ว
        paramCount.set(u.pathname, c + 1);
      }
    } catch {}
    queued.add(n);
    frontier.push(n);
  };
  // จัดเรียง frontier: หน้าตื้นก่อน แล้วเรียงตามตัวอักษร → ลำดับเดิมทุกครั้ง ไม่ขึ้นกับ timing
  const sortFrontier = () => frontier.sort((a, b) => (depthOf(a) - depthOf(b)) || (a < b ? -1 : a > b ? 1 : 0));
  enqueue(startUrl);
  for (const u of site.sitemapUrls) enqueue(u);
  const externalChecked = new Map();
  let active = 0, claimed = 0;

  const MAX_HTML_BYTES = 600_000;

  const crawlOne = async (url, num) => {
    onProgress(`กำลังตรวจหน้า (${num}/${maxPages}): ${url}`);
    try {
      const path = new URL(url).pathname + new URL(url).search;
      if (site.robots && !robotsAllows(site.robots, 'AICheckSEO', path)) {
        site.pages.push({ url, status: 'blocked-by-robots', blocked: true });
        return;
      }
      const { finalUrl, status, chain, res, error, insecure, tlsErrorCode } = await fetchFollowing(url);
      // origin cert chain ไม่ครบ → ดึงเนื้อหาได้ผ่าน fallback ผ่อน TLS แต่ต้องรายงานเป็นปัญหา security
      if (insecure) { site.tlsInsecure = true; if (tlsErrorCode) site.tlsErrorCode = tlsErrorCode; }
      if (!res) { site.fetchErrors.push({ what: url, error: error || 'no-response', status }); return; }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html')) {
        site.pages.push({ url, finalUrl, status, redirectChain: chain, nonHtml: true, contentType: ct });
        try { res.body?.cancel?.(); } catch {}
        return;
      }
      const { html: rawHtml, charset: detectedCharset } = await decodeHtmlFromResponse(res);
      // ตัด HTML ที่ใหญ่เกินไป — ป้องกัน stack overflow ใน cheerio recursive traversal
      const html = rawHtml.length > MAX_HTML_BYTES ? rawHtml.slice(0, MAX_HTML_BYTES) : rawHtml;
      const page = extractPageData(html, url, res.headers, status, 0, chain);
      if (detectedCharset && !/^utf-?8$/i.test(detectedCharset)) page.detectedCharset = detectedCharset;
      page.finalUrl = finalUrl;
      site.pages.push(page);

      // เก็บ HTML ต้นฉบับของหน้าแรกไว้ให้ AI สร้าง "หน้าฉบับแก้แล้ว"
      if (!site.homeHtml && status === 200) { site.homeHtml = html.slice(0, 120_000); site.homeHtmlUrl = url; }

      // เก็บลิงก์ภายในเข้า frontier (กรองไฟล์ + กันซ้ำใน enqueue)
      if (status === 200) {
        for (const l of page.links) enqueue(l.href, finalUrl);
      }
    } catch (e) {
      site.fetchErrors.push({ what: url, error: String(e.message || e) });
    }
  };

  // เลือกหน้าแบบ deterministic: BFS ไล่ "ทีละชั้นความลึก" — crawl ครบทั้งชั้นก่อนลงชั้นถัดไป
  // → ชุดหน้านิ่ง 100% แม้ไม่มี sitemap เพราะลิงก์ของชั้นถัดไปถูกค้นพบครบก่อนเลือกเสมอ (ไม่ขึ้นกับ timing)
  while (claimed < maxPages && frontier.length) {
    // ความลึกน้อยสุดที่ยังเหลือใน frontier
    let minDepth = Infinity;
    for (const u of frontier) { const d = depthOf(u); if (d < minDepth) minDepth = d; }
    // แยก URL ของชั้นนี้ออกมา (เรียงตัวอักษร deterministic) — ที่เหลือคืน frontier ไว้ทำชั้นถัดไป
    const levelUrls = [], rest = [];
    for (const u of frontier) (depthOf(u) === minDepth ? levelUrls : rest).push(u);
    frontier.length = 0; frontier.push(...rest);
    levelUrls.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    // crawl ทั้งชั้น (ขนานภายในชั้น) จนครบ budget
    for (const url of levelUrls) {
      if (claimed >= maxPages) break;
      claimed++;
      const num = claimed;
      while (active >= CONCURRENCY) await new Promise(r => setTimeout(r, 50));
      active++;
      crawlOne(url, num).finally(() => { active--; });
    }
    // barrier: รอชั้นนี้เสร็จทั้งหมด (ลิงก์ชั้นถัดไปถูกค้นพบครบ) ก่อนเลือกชั้นถัดไป
    while (active > 0) await new Promise(r => setTimeout(r, 50));
  }

  // 4.5 SPA rendered crawl — ถ้า raw HTML เป็น shell (เนื้อหา/ลิงก์ render ด้วย JS) raw crawl จะหาหน้าไม่ครบ
  //      (เช่น Nuxt/Next/Vue SPA: sitemap มีไม่กี่หน้า + ลิงก์อยู่ใน JS) → render ด้วย chromium เพื่อค้นหน้าให้ครบ
  const rawHtmlPages = site.pages.filter(p => p.title !== undefined && p.status === 200);
  const isSpa = rawHtmlPages.length > 0 && rawHtmlPages.filter(p => p.emptyRoot).length >= rawHtmlPages.length * 0.5;
  if (isSpa) {
    onProgress('ตรวจพบ SPA (เนื้อหา/ลิงก์ render ด้วย JS) — กำลัง crawl ด้วย headless Chrome เพื่อหาหน้าให้ครบ...');
    const rc = await renderedCrawl(startUrl, site.sitemapUrls, { maxPages, onProgress })
      .catch(e => ({ available: false, reason: String(e?.message || e), pages: [] }));
    const rcValid = (rc.pages || []).filter(p => p.title !== undefined && p.status === 200);
    if (rc.available && rcValid.length > rawHtmlPages.length) {
      // เจอหน้ามากกว่าเดิม → ใช้ชุด rendered (page data ยังเป็น raw shell คง spa-shell/render-diff)
      site.pages = rc.pages;
      site.renderedCrawl = true;
      site.rendered = { available: true, pages: rc.renderedDiff || {} };
      onProgress(`Rendered crawl เจอ ${rcValid.length} หน้า (เดิม ${rawHtmlPages.length})`);
    } else {
      site.renderedCrawl = false;
      site.renderedCrawlReason = rc.reason || 'no-extra-pages'; // ต่อตรงไม่ได้ (geo-block?) → คง raw
    }
  }

  // 5. ตรวจ broken internal links (sample จากลิงก์ที่ยังไม่ crawl)
  onProgress('กำลังตรวจหา broken links...');
  const linkTargets = new Map();
  for (const p of site.pages) {
    if (!p.links) continue;
    for (const l of p.links) {
      const n = normalizeUrl(l.href, p.finalUrl || p.url);
      if (n && sameSite(n, origin)) {
        if (!linkTargets.has(n)) linkTargets.set(n, p.url);
      }
    }
  }
  const crawledStatus = new Map(site.pages.map(p => [p.url, p.status]));
  // เรียง deterministic ก่อน sample เพื่อให้ได้ชุดลิงก์เดิมทุกครั้ง
  const toCheck = [...linkTargets.entries()]
    .filter(([u]) => !crawledStatus.has(u))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, 40);
  // ดึงสถานะลิงก์ — คืน status จริง (4xx/5xx) หรือ 0 ถ้าเชื่อมไม่ติด/timeout
  const probe = async (u) => {
    try {
      const { res } = await tryFetch(u, { method: 'HEAD', redirect: 'follow' });
      let st = res?.status ?? 0;
      try { res?.body?.cancel?.(); } catch {}
      if (st === 405 || st === 403 || st === 0) { const r2 = await tryFetch(u, { redirect: 'follow' }); st = r2.res?.status ?? 0; try { r2.res?.body?.cancel?.(); } catch {} }
      return st;
    } catch { return 0; }
  };
  for (let i = 0; i < toCheck.length; i += CONCURRENCY) {
    await Promise.all(toCheck.slice(i, i + CONCURRENCY).map(async ([u, from]) => {
      let st = await probe(u);
      // status 0 = เชื่อมไม่ติด/timeout (ไม่ใช่ลิงก์เสียจริง) → retry หนึ่งครั้ง ถ้ายัง 0 ก็ไม่ฟันธงว่าเสีย
      if (st === 0) { await new Promise(r => setTimeout(r, 400)); st = await probe(u); }
      // นับเป็น broken เฉพาะที่ยืนยันได้ว่าเสียจริง (4xx/5xx) เท่านั้น — กัน false positive จาก network
      if (st >= 400) site.brokenLinks.push({ from, to: u, status: st });
    }));
  }
  for (const p of site.pages) {
    if (p.status >= 400) site.brokenLinks.push({ from: linkTargets.get(p.url) || '(crawl)', to: p.url, status: p.status });
  }

  // 6. ทดสอบหน้า 404
  try {
    const { res } = await tryFetch(new URL('/ai-check-seo-404-test-' + 'x'.repeat(8), origin).toString(), { redirect: 'follow' });
    site.notFoundHandling = res ? { status: res.status, ok: res.status === 404 || res.status === 410 } : null;
    try { res?.body?.cancel?.(); } catch {}
  } catch { site.notFoundHandling = null; }

  // 7. Render-diff (ถ้ามี playwright) — render หน้าแรก + อีก 2 หน้าสำคัญ เทียบ raw vs rendered
  //    ข้ามถ้า: (ก) ทำ SPA rendered crawl ใน 4.5 แล้ว (site.rendered ตั้งค่าครบแล้ว)
  //            (ข) ใช้ Worker relay บนเว็บที่ไม่ใช่ SPA — Playwright ต่อตรงโดน geo-block → ค้าง timeout
  if (!site.renderedCrawl) {
    const htmlPages = site.pages.filter(p => p.title !== undefined && p.status === 200);
    const renderTargets = htmlPages.slice(0, 3).map(p => p.finalUrl || p.url);
    if (getWorkerRelay()) {
      onProgress('ข้าม render-diff (ใช้ Worker relay — วิเคราะห์จาก raw HTML)');
      site.rendered = { available: false, skipped: 'worker-relay', pages: {} };
    } else if (renderTargets.length) {
      onProgress('กำลังลอง render ด้วย headless Chrome (เทียบ raw vs rendered)...');
      site.rendered = await tryRenderPages(renderTargets, onProgress);
    }
  }

  // 8. รวม social profiles + logo ระดับเว็บ (sameAs/logo จริงสำหรับ schema) — เอาจากหน้าแรกก่อน
  const homePage = site.pages.find(p => { try { return new URL(p.finalUrl || p.url).pathname === '/'; } catch { return false; } });
  const orderedPages = homePage ? [homePage, ...site.pages.filter(p => p !== homePage)] : site.pages;
  site.socials = [...new Set(orderedPages.flatMap(p => p.socials || []))].slice(0, 12);
  site.logo = orderedPages.map(p => p.logo).find(Boolean) || '';

  return site;
}
