// Deep Crawler — ดึงหน้าเว็บแบบ raw HTML + (ถ้ามี Playwright) rendered DOM
// เคารพ robots.txt, ไล่ตาม sitemap + internal links, เก็บ headers/redirects ครบ
import * as cheerio from 'cheerio';

// ใช้ browser UA จริง — WAF หลายเจ้าบล็อกชื่อ bot แปลกหน้าทั้งที่ robots.txt อนุญาต (เรายังเคารพ robots.txt เสมอ)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FETCH_TIMEOUT = 20000;
const CONCURRENCY = 5;

// Proxy (optional) — เว็บไทยหลายเจ้า (irplus IR, ราชการ) บล็อก IP ดาต้าเซ็นเตอร์/ต่างประเทศ
// สองรูปแบบ:
//   CRAWL_PROXY=https://xxx.workers.dev  → Cloudflare Worker relay (ฟรี, ใช้กับ fetch เท่านั้น)
//   CRAWL_PROXY=http://user:pass@host:port → Standard HTTP proxy (ใช้กับทั้ง fetch + Playwright)
const PROXY_URL = process.env.CRAWL_PROXY || process.env.PROXY_URL || '';
const workerRelay = PROXY_URL.startsWith('https://') ? PROXY_URL : '';

// standard http:// proxy ไม่รองรับตอนนี้ — ใช้ Worker relay (https://) แทน
const proxyDispatcher = null;

// แปลง PROXY_URL เป็นรูปแบบที่ Playwright ต้องการ — Worker relay ใช้กับ Playwright ไม่ได้
function playwrightProxy() {
  if (!PROXY_URL || workerRelay) return undefined;
  try {
    const u = new URL(PROXY_URL);
    const p = { server: `${u.protocol}//${u.host}` };
    if (u.username) p.username = decodeURIComponent(u.username);
    if (u.password) p.password = decodeURIComponent(u.password);
    return p;
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

async function fetchWithMeta(url, { method = 'GET', redirect = 'manual' } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  const started = Date.now();
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
      ...(proxyDispatcher ? { dispatcher: proxyDispatcher } : {}),
    });
    const elapsed = Date.now() - started;
    return { res, elapsed };
  } finally { clearTimeout(timer); }
}

// ตาม redirect เองเพื่อเก็บ chain ทั้งหมด — retry เมื่อเจอ error ชั่วคราว
// (เว็บหลายเจ้า flap/throttle: drop connection หรือ 5xx เป็นพักๆ — retry กันผลหลอกตา 0/F)
async function fetchFollowing(url, maxHops = 8, retries = 2) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 600 * attempt)); // backoff
    const chain = [];
    let current = url;
    try {
      for (let hop = 0; hop <= maxHops; hop++) {
        const { res, elapsed } = await fetchWithMeta(current);
        const status = res.status;
        if (status >= 300 && status < 400) {
          const loc = res.headers.get('location');
          chain.push({ url: current, status, location: loc, elapsed });
          if (!loc) return { finalUrl: current, status, chain, res: null };
          try { res.body?.cancel?.(); } catch {}
          current = new URL(loc, current).toString();
          continue;
        }
        // 5xx = ชั่วคราว → retry; 4xx/2xx = ถาวร → คืนเลย
        if (status >= 500 && attempt < retries) { try { res.body?.cancel?.(); } catch {} lastErr = `http-${status}`; break; }
        return { finalUrl: current, status, chain, res, elapsed };
      }
      if (chain.length > maxHops) return { finalUrl: current, status: 0, chain, res: null, error: 'redirect-loop' };
    } catch (e) {
      lastErr = String(e.message || e); // network error / timeout → retry
    }
  }
  return { finalUrl: url, status: 0, chain: [], res: null, error: lastErr || 'fetch-failed' };
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
    const { res } = await fetchWithMeta(sitemapUrl, { redirect: 'follow' });
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
  const results = [];
  for (const v of candidates) {
    try {
      const { finalUrl, status, chain } = await fetchFollowing(v, 8);
      results.push({ variant: v, status, finalOrigin: (() => { try { return new URL(finalUrl).origin; } catch { return finalUrl; } })(), hops: chain.length });
    } catch (e) { results.push({ variant: v, status: 0, error: String(e.message || e) }); }
  }
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
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    headings.push({ tag: el.tagName.toLowerCase(), text: $(el).text().replace(/\s+/g, ' ').trim().slice(0, 200) });
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
    const { res } = await fetchWithMeta(new URL('/robots.txt', origin).toString(), { redirect: 'follow' });
    site.robotsStatus = res.status;
    if (res.ok) {
      site.robotsTxt = await res.text();
      site.robots = parseRobots(site.robotsTxt);
    }
  } catch (e) { site.fetchErrors.push({ what: 'robots.txt', error: String(e.message || e) }); }

  // 2. llms.txt (GEO) — ต้องเป็น text จริง ไม่ใช่หน้า HTML จาก soft-404
  try {
    const { res } = await fetchWithMeta(new URL('/llms.txt', origin).toString(), { redirect: 'follow' });
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
    (async () => { try { const { res } = await fetchWithMeta(new URL('/favicon.ico', origin).toString(), { redirect: 'follow' }); try { res.body?.cancel?.(); } catch {} return res.status; } catch { return 0; } })(),
  ]);
  site.variants = variants;
  site.faviconStatus = faviconStatus;

  // 4. BFS crawl
  const queue = [normalizeUrl(startUrl)];
  // เติม URL จาก sitemap (same-site เท่านั้น)
  for (const u of site.sitemapUrls) {
    const n = normalizeUrl(u);
    if (n && sameSite(n, origin)) queue.push(n);
  }
  const seen = new Set();
  const externalChecked = new Map();
  let active = 0, idx = 0;

  const MAX_HTML_BYTES = 600_000;

  const crawlOne = async (url) => {
    // ป้องกัน race condition: ถ้าถึง maxPages แล้ว ไม่เพิ่มอีก
    if (site.pages.length >= maxPages) return;
    onProgress(`กำลังตรวจหน้า (${site.pages.length + 1}/${maxPages}): ${url}`);
    try {
      const path = new URL(url).pathname + new URL(url).search;
      if (site.robots && !robotsAllows(site.robots, 'AICheckSEO', path)) {
        site.pages.push({ url, status: 'blocked-by-robots', blocked: true });
        return;
      }
      const { finalUrl, status, chain, res, error } = await fetchFollowing(url);
      if (!res) { site.fetchErrors.push({ what: url, error: error || 'no-response', status }); return; }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html')) {
        site.pages.push({ url, finalUrl, status, redirectChain: chain, nonHtml: true, contentType: ct });
        try { res.body?.cancel?.(); } catch {}
        return;
      }
      const rawHtml = await res.text();
      // ตัด HTML ที่ใหญ่เกินไป — ป้องกัน stack overflow ใน cheerio recursive traversal
      const html = rawHtml.length > MAX_HTML_BYTES ? rawHtml.slice(0, MAX_HTML_BYTES) : rawHtml;
      const page = extractPageData(html, url, res.headers, status, 0, chain);
      page.finalUrl = finalUrl;
      if (site.pages.length >= maxPages) return; // ตรวจอีกครั้งหลัง await
      site.pages.push(page);

      // เก็บ HTML ต้นฉบับของหน้าแรกไว้ให้ AI สร้าง "หน้าฉบับแก้แล้ว"
      if (!site.homeHtml && status === 200) { site.homeHtml = html.slice(0, 120_000); site.homeHtmlUrl = url; }

      // เก็บลิงก์ภายในเข้า queue
      if (status === 200) {
        for (const l of page.links) {
          const n = normalizeUrl(l.href, finalUrl);
          if (n && sameSite(n, origin) && !seen.has(n) && queue.length + seen.size < maxPages * 4) {
            queue.push(n);
          }
        }
      }
    } catch (e) {
      site.fetchErrors.push({ what: url, error: String(e.message || e) });
    }
  };

  while ((queue.length || active > 0) && site.pages.length < maxPages) {
    if (!queue.length) { await new Promise(r => setTimeout(r, 100)); continue; }
    const url = queue.shift();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    while (active >= CONCURRENCY) await new Promise(r => setTimeout(r, 50));
    active++;
    crawlOne(url).finally(() => { active--; });
  }
  while (active > 0) await new Promise(r => setTimeout(r, 100));

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
  const toCheck = [...linkTargets.entries()].filter(([u]) => !crawledStatus.has(u)).slice(0, 40);
  for (let i = 0; i < toCheck.length; i += CONCURRENCY) {
    await Promise.all(toCheck.slice(i, i + CONCURRENCY).map(async ([u, from]) => {
      try {
        const { res } = await fetchWithMeta(u, { method: 'HEAD', redirect: 'follow' });
        let st = res.status;
        if (st === 405 || st === 403) { const r2 = await fetchWithMeta(u, { redirect: 'follow' }); st = r2.res.status; try { r2.res.body?.cancel?.(); } catch {} }
        if (st >= 400) site.brokenLinks.push({ from, to: u, status: st });
      } catch { site.brokenLinks.push({ from, to: u, status: 0 }); }
    }));
  }
  for (const p of site.pages) {
    if (p.status >= 400) site.brokenLinks.push({ from: linkTargets.get(p.url) || '(crawl)', to: p.url, status: p.status });
  }

  // 6. ทดสอบหน้า 404
  try {
    const { res } = await fetchWithMeta(new URL('/ai-check-seo-404-test-' + 'x'.repeat(8), origin).toString(), { redirect: 'follow' });
    site.notFoundHandling = { status: res.status, ok: res.status === 404 || res.status === 410 };
    try { res.body?.cancel?.(); } catch {}
  } catch { site.notFoundHandling = null; }

  // 7. Rendered crawl (ถ้ามี playwright) — render หน้าแรก + อีก 2 หน้าสำคัญ
  const htmlPages = site.pages.filter(p => p.title !== undefined && p.status === 200);
  const renderTargets = htmlPages.slice(0, 3).map(p => p.finalUrl || p.url);
  if (renderTargets.length) {
    onProgress('กำลังลอง render ด้วย headless Chrome (เทียบ raw vs rendered)...');
    site.rendered = await tryRenderPages(renderTargets, onProgress);
  }

  return site;
}
