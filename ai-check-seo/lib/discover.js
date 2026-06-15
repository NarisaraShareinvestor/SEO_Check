// Competitor Discovery — หาคู่แข่งอุตสาหกรรมเดียวกันแบบอัตโนมัติ
// วิธี: อ่านว่าเว็บทำอะไร (render ด้วย Chrome ถ้าเป็น SPA) → ค้นเว็บจริงด้วยคีย์เวิร์ดเดียวกัน
//       → กรองโดเมนที่ไม่ใช่คู่แข่ง → ตรวจว่าออนไลน์ → AI จัดอันดับพร้อมเหตุผล
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiAvailable, callLLM } from './ai.js';

// cache ผลค้นหาที่สำเร็จ — เสิร์ฟแทนเมื่อ search engine ถูกจำกัดชั่วคราว
const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'discoveries');
function cacheFile(siteUrl) {
  const key = registrableDomain(new URL(siteUrl).hostname).replace(/[^a-z0-9.-]/g, '');
  return join(CACHE_DIR, key + '.json');
}
function saveDiscoveryCache(siteUrl, result) {
  try { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(cacheFile(siteUrl), JSON.stringify({ savedAt: new Date().toISOString(), result })); } catch {}
}
function loadDiscoveryCache(siteUrl) {
  try { const f = cacheFile(siteUrl); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; } catch { return null; }
}
// คืนผลจาก cache ถ้ามี ไม่มีจึง throw
function cachedOrThrow(siteUrl, message) {
  const cached = loadDiscoveryCache(siteUrl);
  if (cached?.result?.candidates?.length) {
    return {
      ...cached.result,
      notice: `ตัวค้นหาเว็บถูกจำกัดชั่วคราว — แสดงผลที่ระบบค้นเจอจริงล่าสุดเมื่อ ${new Date(cached.savedAt).toLocaleString('th-TH')} (กดใหม่ภายหลังเพื่ออัปเดต)`,
      fromCache: true,
    };
  }
  throw new Error(message);
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// โดเมนที่ไม่มีทางเป็น "คู่แข่งธุรกิจ" — portal, social, marketplace, ข่าว
const BLOCK = [
  'google.', 'facebook.', 'youtube.', 'linkedin.', 'instagram.', 'twitter.', 'x.com',
  'wikipedia.', 'wiktionary.', 'pantip.', 'shopee.', 'lazada.', 'tiktok.', 'line.me',
  'apple.com', 'medium.com', 'blogspot.', 'wordpress.', 'wix.com', 'pinterest.', 'reddit.',
  'duckduckgo.', 'bing.com', 'yahoo.', 'amazon.', 'play.google', 'github.', 'canva.',
  'glassdoor', 'jobsdb', 'jobthai', 'indeed.', 'tripadvisor', 'booking.com', 'agoda.',
  'sanook.', 'kapook.', 'thairath.', 'matichon.', 'bangkokpost.', 'posttoday.', 'prachachat.',
  'mgronline.', 'dailynews.', 'khaosod.', 'springnews.', 'thansettakij.', 'moneybuffalo.',
  'finnomena.', 'longtunman.', 'youtu.be', 'archive.org', 'slideshare', 'scribd.',
  // เว็บ directory / company profile — ไม่ใช่คู่แข่ง
  'refrens.', 'contactout.', 'zoominfo.', 'crunchbase.', 'dnb.com', 'rocketreach.',
  'kompass.', 'yellowpages', 'dataforthai.', 'creden.co', 'opencorporates.', 'similarweb.',
  'owler.', 'signalhire.', 'apollo.io', 'lusha.', 'leadiq.', 'b2bhint.', 'globaldata.',
  'bloomberg.', 'reuters.', 'set.or.th', 'sec.or.th', 'trustpilot.', 'clutch.co', 'g2.com',
  'beamstart.', 'techinasia.', 'dealstreetasia.', 'startupblink.', 'f6s.com', 'pitchbook.',
  // dictionary / หางาน — noise จาก search
  'longdo.', 'wiktionary.', 'hujiang.', 'enghero.', 'thaijob.', 'jobbkk.', 'workventure.', 'dict.',
];

function registrableDomain(hostname) {
  const parts = hostname.toLowerCase().replace(/^www\./, '').split('.');
  const twoLevelTlds = ['co.th', 'or.th', 'in.th', 'ac.th', 'go.th', 'net.th', 'co.uk', 'com.sg', 'com.my', 'com.au'];
  const lastTwo = parts.slice(-2).join('.');
  if (twoLevelTlds.includes(lastTwo) && parts.length >= 3) return parts.slice(-3).join('.');
  return lastTwo;
}

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

// ── ค้นเว็บผ่าน DuckDuckGo HTML (ไม่ต้องใช้ API key) ──
export async function searchWeb(query) {
  const u = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  const res = await fetchWithTimeout(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'th,en;q=0.8' } });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const out = [];
  $('a.result__a').each((_, el) => {
    let href = $(el).attr('href') || '';
    const m = href.match(/uddg=([^&]+)/);
    if (m) { try { href = decodeURIComponent(m[1]); } catch {} }
    if (/^https?:\/\//.test(href)) out.push({ url: href, title: $(el).text().replace(/\s+/g, ' ').trim() });
  });
  return out;
}

// ── สำรอง 1: Bing — URL จริงถูกซ่อนใน /ck/a?...u=a1<base64url> ต้องถอดเอง ──
function decodeBingUrl(href) {
  if (!/bing\.com\/ck\/a/.test(href)) return /^https?:\/\//.test(href) ? href : null;
  const m = href.match(/u=a1([A-Za-z0-9_-]{16,})/);
  if (!m) return null;
  try {
    let b = m[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    const u = Buffer.from(b, 'base64').toString('utf8');
    return /^https?:\/\//.test(u) ? u : null;
  } catch { return null; }
}
export async function searchBing(query) {
  const u = 'https://www.bing.com/search?q=' + encodeURIComponent(query) + '&setlang=th&count=20';
  const res = await fetchWithTimeout(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'th,en;q=0.8' } });
  if (!res.ok) throw new Error(`bing ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const out = [];
  $('li.b_algo').each((_, li) => {
    const a = $(li).find('h2 a').first().length ? $(li).find('h2 a').first() : $(li).find('a[href]').first();
    const url = decodeBingUrl(a.attr('href') || '');
    if (url) out.push({ url, title: a.text().replace(/\s+/g, ' ').trim() });
  });
  return out;
}

// ── สำรอง 2: Mojeek (เปิดให้ scrape ง่ายสุด แต่ดัชนีไทยบางกว่า) ──
export async function searchMojeek(query) {
  const u = 'https://www.mojeek.com/search?q=' + encodeURIComponent(query);
  const res = await fetchWithTimeout(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'th,en;q=0.8' } });
  if (!res.ok) throw new Error(`mojeek ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const out = [];
  $('a.title').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/^https?:\/\//.test(href)) out.push({ url: href, title: $(el).text().replace(/\s+/g, ' ').trim() });
  });
  return out;
}

// ผลค้นหาต้อง "เกี่ยวข้องกับ query จริง" — กัน engine ที่โดนแฟล็กแล้วเสิร์ฟผลมั่ว (เคส Bing เสิร์ฟลิงก์ Baidu/Microsoft)
function relevantResults(results, query) {
  const toks = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  return results.filter(r => { const s = (r.title + ' ' + r.url).toLowerCase(); return toks.some(t => s.includes(t)); });
}

// ── ค้นแบบหลายเครื่องยนต์: DDG → Bing → Mojeek (รับเฉพาะผลที่เกี่ยวข้องจริง) ──
async function multiSearch(query, onProgress = () => {}) {
  try {
    const r = relevantResults(await searchWeb(query), query);
    if (r.length >= 2) return { engine: 'ddg', results: r };
  } catch {}
  try {
    onProgress('ตัวค้นหาหลักถูกจำกัดชั่วคราว — สลับไปใช้ Bing...');
    const r = relevantResults(await searchBing(query), query);
    if (r.length >= 2) return { engine: 'bing', results: r };
  } catch {}
  try {
    onProgress('Bing ไม่ให้ผลที่เกี่ยวข้อง — สลับไปใช้ Mojeek...');
    const r = relevantResults(await searchMojeek(query), query);
    if (r.length >= 1) return { engine: 'mojeek', results: r };
  } catch {}
  return { engine: null, results: [] };
}

// ── อ่านว่าเว็บนี้ทำธุรกิจอะไร (รองรับ SPA ด้วย headless Chrome) ──
async function extractTopic(siteUrl) {
  let title = '', desc = '', h1 = '', text = '';
  try {
    const res = await fetchWithTimeout(siteUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    const html = await res.text();
    const $ = cheerio.load(html);
    $('script,style,noscript').remove();
    title = $('title').first().text().trim();
    desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
    text = $('body').text().replace(/\s+/g, ' ').trim();
  } catch {}

  // SPA shell → render ด้วย Playwright เพื่อให้ได้เนื้อหาจริง
  if ((text.length < 200 || (!title && !desc))) {
    try {
      const pw = await import('playwright');
      const browser = await pw.chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ userAgent: UA });
        await page.goto(siteUrl, { waitUntil: 'networkidle', timeout: 30000 });
        const d = await page.evaluate(() => ({
          title: document.title,
          desc: document.querySelector('meta[name="description"]')?.content || '',
          h1: document.querySelector('h1')?.innerText?.trim() || '',
          text: document.body?.innerText?.replace(/\s+/g, ' ').slice(0, 3000) || '',
        }));
        title = title || d.title; desc = desc || d.desc; h1 = h1 || d.h1;
        if (d.text.length > text.length) text = d.text;
      } finally { await browser.close(); }
    } catch {}
  }
  return { title, desc, h1, textSample: text.slice(0, 1200) };
}

// ── สร้างชุดคำค้นจากข้อมูลธุรกิจ ──
function buildQueries(topic, hostname) {
  const hostCore = hostname.replace(/^www\./, '').split('.')[0]; // เช่น shareinvestorthailand
  // จับคำแบรนด์รวมถึงรูป possessive ("ShareInvestor's") และพหูพจน์
  const isBrandWord = (w) => {
    const t = w.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
    return t.length > 2 && (hostCore.includes(t) || (t.length > 4 && hostCore.includes(t.slice(0, -1))));
  };
  const stripBrand = (s) => (s || '').split(/\s+/).filter(w => !isBrandWord(w))
    .join(' ').replace(/[|–—:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const hasBrand = (s) => (s || '').split(/\s+/).some(isBrandWord);

  const qs = [];
  // วลีบริการจาก description ที่คั่นด้วย , | • — แม่นที่สุดเพราะคือสิ่งที่ธุรกิจขายจริง
  // segment ที่มีชื่อแบรนด์ตัดทิ้งทั้งท่อน (มักเป็นประโยคโฆษณาตัวเอง ไม่ใช่ชื่อบริการ)
  const segs = (topic.desc || '').split(/[,|•·;]/)
    .filter(s => !hasBrand(s))
    .map(s => s.replace(/^[^:]{0,20}:/, '').trim())
    .map(s => stripBrand(s))
    .filter(s => s.length > 5);
  if (segs.length >= 2) qs.push(segs.slice(0, 3).join(' ').split(' ').slice(0, 9).join(' '));
  const h1c = stripBrand(topic.h1), titlec = stripBrand(topic.title), descc = stripBrand(topic.desc);
  if (h1c.length > 8) qs.push(h1c.split(' ').slice(0, 8).join(' '));
  if (titlec.length > 8) qs.push(titlec.split(' ').slice(0, 8).join(' '));
  if (descc.length > 15) qs.push(descc.split(' ').slice(0, 10).join(' '));
  return [...new Set(qs)].slice(0, 3);
}

// ── AI แนะนำคู่แข่งจากความรู้ (ใช้ควบคู่กับ SERP เสมอ เพื่อไม่ให้พลาดเจ้าสำคัญ) ──
async function aiSuggestCompetitors(siteUrl, topic) {
  if (!aiAvailable()) return [];
  const sys = 'คุณคือนักวิเคราะห์ตลาดที่รู้จักธุรกิจในไทยและเอเชียดี แนะนำคู่แข่งทางธุรกิจ "ตัวจริง" (สินค้า/บริการเดียวกัน ตลาดเดียวกัน) เป็นโดเมนจริงที่มีอยู่ ตอบ JSON เท่านั้น';
  const usr = `เว็บลูกค้า: ${siteUrl}
ธุรกิจ: ${topic.title} | ${topic.desc} | ${topic.h1}
เนื้อหา: ${topic.textSample.slice(0, 600)}

ตอบ JSON: {"competitors":[{"domain":"เช่น example.co.th (โดเมนล้วน ไม่มี http)","reason":"ทำไมเป็นคู่แข่ง สั้นๆ"}]} แนะนำ 5-8 ราย เรียงจากตรงที่สุด เฉพาะที่มั่นใจว่าโดเมนถูกต้อง`;
  // ใช้ gpt-4o ก่อน (ความรู้ตลาดลึกกว่า) ถ้าพลาด retry ด้วยโมเดล default
  for (const model of [process.env.OPENAI_API_KEY ? 'gpt-4o' : null, null]) {
    try {
      const text = await callLLM(sys, usr, 1200, model);
      const list = JSON.parse(text.match(/\{[\s\S]*\}/)[0]).competitors || [];
      if (list.length) return list;
    } catch { /* ลองโมเดลถัดไป */ }
  }
  return [];
}

// ── main: ค้นหาคู่แข่ง ──
export async function discoverCompetitors(siteUrl, onProgress = () => {}) {
  const myDomain = registrableDomain(new URL(siteUrl).hostname);

  onProgress('กำลังอ่านว่าเว็บนี้ทำธุรกิจอะไร...');
  const topic = await extractTopic(siteUrl);
  // ยิง AI แนะนำคู่ขนานไปกับการค้นเว็บ — สองแหล่งช่วยกันไม่ให้พลาดคู่แข่งสำคัญ
  const aiSuggestPromise = aiSuggestCompetitors(siteUrl, topic);
  const queries = buildQueries(topic, new URL(siteUrl).hostname);
  if (!queries.length) {
    // เว็บไม่มีข้อมูลพอ — ให้ AI ช่วยตั้งคำค้นจากชื่อโดเมน
    if (topic.textSample) queries.push(topic.textSample.split(' ').slice(0, 8).join(' '));
    else return cachedOrThrow(siteUrl, 'อ่านข้อมูลธุรกิจจากเว็บไม่ได้ (เว็บอาจบล็อก bot) — กรุณาใส่ URL คู่แข่งเอง');
  }

  // ค้นหา (ทีละ query กันโดน rate limit)
  const found = new Map(); // domain → {score, urls:Set, titles:Set}
  let serpHits = 0;
  for (const [qi, q] of queries.entries()) {
    onProgress(`กำลังค้นหาเว็บอุตสาหกรรมเดียวกัน (${qi + 1}/${queries.length}): "${q.slice(0, 60)}"`);
    const { results } = await multiSearch(q, onProgress);
    if (!results.length) continue;
    serpHits += results.length;
    const hostCore = new URL(siteUrl).hostname.replace(/^www\./, '').split('.')[0];
    results.slice(0, 20).forEach((r, idx) => {
      let host;
      try { host = new URL(r.url).hostname; } catch { return; }
      const dom = registrableDomain(host);
      if (dom === myDomain) return;
      if (BLOCK.some(b => host.includes(b) || dom.includes(b))) return;
      // ตัดโดเมนเครือ/แบรนด์เดียวกัน (เช่น shareinvestor.com ของบริษัทแม่)
      const domCore = dom.split('.')[0];
      if (domCore.length >= 5 && (hostCore.includes(domCore) || domCore.includes(hostCore))) return;
      const entry = found.get(dom) || { score: 0, urls: new Set(), titles: new Set() };
      entry.score += Math.max(1, 20 - idx);
      entry.urls.add('https://' + dom);
      entry.titles.add(r.title.slice(0, 90));
      found.set(dom, entry);
    });
    await new Promise(r => setTimeout(r, 800));
  }
  // รวมคำแนะนำจาก AI เข้ากับผล SERP (สองแหล่งช่วยกัน)
  const aiSuggestions = await aiSuggestPromise;
  if (aiSuggestions.length) onProgress(`AI แนะนำเพิ่ม ${aiSuggestions.length} ราย — กำลังรวมกับผลค้นหา...`);
  const hostCore2 = new URL(siteUrl).hostname.replace(/^www\./, '').split('.')[0];
  for (const s of aiSuggestions) {
    const dom = String(s.domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!dom || !dom.includes('.') || dom === myDomain) continue;
    if (BLOCK.some(b => dom.includes(b))) continue;
    const domCore = dom.split('.')[0];
    if (domCore.length >= 5 && (hostCore2.includes(domCore) || domCore.includes(hostCore2))) continue;
    const entry = found.get(dom) || { score: 0, urls: new Set(), titles: new Set() };
    entry.score += 12; // ถูกทั้ง AI และ SERP เลือก = สัญญาณแรง
    entry.urls.add('https://' + dom);
    if (s.reason) entry.titles.add(s.reason.slice(0, 90));
    entry.aiSuggested = true;
    found.set(dom, entry);
  }

  if (!found.size) return cachedOrThrow(siteUrl, 'ตัวค้นหาเว็บถูกจำกัดชั่วคราวและ AI แนะนำไม่สำเร็จ — รอสักครู่แล้วลองใหม่ หรือใส่ URL คู่แข่งเอง');

  // เรียงตามคะแนน เอา top 10 ไปตรวจว่ายังออนไลน์
  const ranked = [...found.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 10);
  onProgress('กำลังตรวจว่าเว็บผู้สมัครยังออนไลน์...');
  const live = [];
  await Promise.all(ranked.map(async ([dom, info]) => {
    try {
      const res = await fetchWithTimeout('https://' + dom, { method: 'GET', headers: { 'User-Agent': UA }, redirect: 'follow' }, 10000);
      if (res.ok) { try { res.body?.cancel?.(); } catch {} live.push({ domain: dom, url: 'https://' + dom, score: info.score, aiSuggested: !!info.aiSuggested, snippet: [...info.titles][0] || '' }); }
    } catch {}
  }));
  if (!live.length) return cachedOrThrow(siteUrl, 'ผู้สมัครทั้งหมดเข้าไม่ได้ — ลองใส่ URL คู่แข่งเอง');
  live.sort((a, b) => b.score - a.score);

  // AI จัดอันดับ + ให้เหตุผล (ถ้ามี key) — ไม่มีก็ใช้คะแนน SERP
  let candidates = live.slice(0, 5).map(c => ({ ...c, reason: c.aiSuggested ? `${c.snippet || c.domain} (AI แนะนำ + ยืนยันออนไลน์)` : `ติดอันดับการค้นหาเดียวกัน: ${c.snippet || c.domain}` }));
  if (aiAvailable()) {
    onProgress('กำลังให้ AI คัดกรองว่าใครคือคู่แข่งตัวจริง...');
    try {
      const sys = 'คุณคือนักวิเคราะห์ตลาด คัดเลือกว่าโดเมนไหนเป็น "คู่แข่งทางธุรกิจตัวจริง" (ขายสินค้า/บริการประเภทเดียวกัน กลุ่มลูกค้าเดียวกัน ตลาด/ประเทศเดียวกัน) ตัดทิ้ง: เว็บข่าว เว็บหน่วยงาน และเว็บต่างประเทศที่ไม่ได้ทำตลาดเดียวกับลูกค้า ตอบเหตุผลเป็นภาษาไทยเท่านั้น ตอบ JSON เท่านั้น';
      const usr = `เว็บของลูกค้า: ${siteUrl}
ธุรกิจ: ${topic.title} | ${topic.desc} | ${topic.h1}
เนื้อหา: ${topic.textSample.slice(0, 500)}

ผู้สมัคร: ${JSON.stringify(live.map(c => ({ domain: c.domain, snippet: c.snippet })))}

ตอบ JSON: {"competitors":[{"domain":"...","reason":"เหตุผลสั้นๆ ว่าเป็นคู่แข่งยังไง","confidence":"high|medium|low"}]} เรียงจากคู่แข่งตรงที่สุด เอาเฉพาะที่เป็นคู่แข่งจริง (ตัดเว็บข่าว/หน่วยงาน/ไม่เกี่ยวออก)`;
      const text = await callLLM(sys, usr, 1200, process.env.OPENAI_API_KEY ? 'gpt-4o' : null);
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
      if (parsed.competitors?.length) {
        // AI จัดอันดับ+ให้เหตุผล แต่ "ห้ามทิ้ง" ผู้สมัครที่ SERP คะแนนสูง —
        // เว็บที่ติดอันดับคำค้นเดียวกันสูงๆ คือคู่แข่งตัวจริงแม้ AI จะไม่รู้จักแบรนด์
        const aiPicked = parsed.competitors
          .filter(c => live.some(l => l.domain === c.domain))
          .map(c => ({ ...live.find(l => l.domain === c.domain), reason: c.reason, confidence: c.confidence }));
        const pickedSet = new Set(aiPicked.map(c => c.domain));
        // เก็บเฉพาะที่ยืนยันจากหลาย query (score สูง) — กันผลมั่วจาก engine ที่ดัชนีอ่อน
        const serpKeep = live
          .filter(l => !pickedSet.has(l.domain) && l.score >= 25)
          .map(l => ({ ...l, reason: `ติดอันดับสูงในผลค้นหาคำเดียวกับธุรกิจคุณ: ${l.snippet || l.domain}` }));
        const merged = [...aiPicked, ...serpKeep];
        if (merged.length) candidates = merged.slice(0, 6);
      }
    } catch { /* ใช้ผล SERP ตามเดิม */ }
  }

  // ตัวกรองตลาด: เว็บลูกค้าเป็นตลาดไทย → คู่แข่งต้องมีสัญญาณไทยอย่างน้อยหนึ่งอย่าง
  // (.th / snippet หรือเหตุผลมีภาษาไทย / มาจาก AI ที่รู้บริบทธุรกิจ) — กันเอเจนซี่ต่างประเทศที่บังเอิญชื่อคล้าย
  const isThaiMarket = /[ก-๙]/.test(topic.title + topic.desc + topic.textSample);
  if (isThaiMarket) {
    const thaiSignal = (c) => /\.th$/.test(c.domain) || /[ก-๙]/.test(c.snippet || '') || !!c.aiSuggested;
    let filtered = candidates.filter(thaiSignal);
    // ถ้าตัวที่ AI เลือกไม่มีสัญญาณไทยเลย → ถอยไปดึงจากรายชื่อเต็มที่ผ่าน liveness (รวมตัวที่ AI แนะนำเช่นโดเมน .th)
    if (!filtered.length) {
      filtered = live.filter(thaiSignal).slice(0, 5).map(c => ({
        ...c,
        reason: c.aiSuggested ? `${c.snippet || c.domain} (AI แนะนำ + ยืนยันออนไลน์)` : `ติดอันดับการค้นหาเดียวกัน: ${c.snippet || c.domain}`,
      }));
    }
    // ไม่มีตัวไหนเข้าตลาดไทยเลย = ผลที่มีคือ noise — ใช้ cache ผลจริงล่าสุด หรือบอกตรงๆ
    if (!filtered.length) return cachedOrThrow(siteUrl, 'ตัวค้นหาเว็บถูกจำกัดชั่วคราว ทำให้ยังไม่พบคู่แข่งในตลาดเดียวกัน — ลองกดใหม่ใน 5-10 นาที หรือใส่ URL คู่แข่งเอง');
    candidates = filtered;
  }

  const finalResult = {
    topic: { title: topic.title, desc: topic.desc.slice(0, 160), h1: topic.h1 },
    queries,
    candidates,
    aiRanked: aiAvailable(),
    notice: serpHits === 0
      ? 'ตัวค้นหาเว็บถูกจำกัดชั่วคราว — รายชื่อนี้มาจากความรู้ AI (ยืนยันว่าเว็บออนไลน์แล้ว) แนะนำกดค้นหาใหม่ใน 5-10 นาที จะได้ผลจากการค้นหาเว็บจริงที่ครบกว่า'
      : null,
  };
  if (serpHits > 0 && candidates.length) saveDiscoveryCache(siteUrl, finalResult); // เก็บเฉพาะผลจากการค้นเว็บจริง
  return finalResult;
}
