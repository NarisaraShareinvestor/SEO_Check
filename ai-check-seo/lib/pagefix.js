// Page Fix — AI แก้หน้าเว็บแบบ "ถูกต้องพิสูจน์ได้"
// หลักการ: AI แก้ → rule engine ตรวจซ้ำทันที → ถ้ายังมีปัญหา ส่งกลับให้ AI แก้รอบสอง (self-repair loop)
// ผลลัพธ์มีหลักฐาน ก่อน/หลัง เป็นตัวเลข ไม่ใช่แค่ "AI บอกว่าแก้แล้ว"
import * as cheerio from 'cheerio';
import { extractPageData } from './crawler.js';
import { aiGenerateFixedPage, aiGenerateHeadFix, aiAvailable } from './ai.js';

const UA_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; AICheckSEO/1.0)', 'Accept': 'text/html' };

// ── ตรวจหน้าเดียวจาก HTML ตรงๆ (deterministic ใช้ซ้ำได้ทั้งก่อนและหลังแก้) ──
export function validatePageHtml(html, url) {
  const fakeHeaders = { get: () => '' };
  let p;
  try { p = extractPageData(html, url, fakeHeaders, 200, 0, []); }
  catch (e) { return [{ id: 'parse', sev: 'high', msg: 'HTML parse ไม่ได้: ' + e.message }]; }
  const issues = [];
  const add = (id, sev, msg) => issues.push({ id, sev, msg });

  if (!p.hasDoctype) add('doctype', 'low', 'ไม่มี <!DOCTYPE html>');
  if (!p.title) add('title', 'high', 'ไม่มี <title>');
  else if (p.title.length > 65 || p.title.length < 10) add('title-length', 'med', `title ยาว ${p.title.length} ตัวอักษร (ควร 10–65)`);
  if (!p.metas['description']) add('desc', 'high', 'ไม่มี meta description');
  else if (p.metas['description'].length > 175 || p.metas['description'].length < 40) add('desc-length', 'low', `description ยาว ${p.metas['description'].length} (ควร 40–175)`);
  if (!p.metas['viewport']) add('viewport', 'high', 'ไม่มี viewport meta');
  if (!p.charset) add('charset', 'med', 'ไม่ระบุ charset');
  if (!p.lang) add('lang', 'med', 'ไม่มี lang ใน <html>');
  if (!p.canonical) add('canonical', 'high', 'ไม่มี canonical tag');
  else if (p.canonicalCount > 1) add('canonical-multi', 'high', 'canonical ซ้ำหลายอัน');
  const h1s = p.headings.filter(h => h.tag === 'h1');
  if (!h1s.length) add('h1', 'high', 'ไม่มี H1' + (p.emptyRoot ? ' (SPA shell — ต้องมีเนื้อหา fallback ใน HTML)' : ''));
  else if (h1s.length > 1) add('h1-multi', 'low', `มี H1 ${h1s.length} อัน`);
  if (!p.metas['og:title']) add('og-title', 'med', 'ไม่มี og:title');
  if (!p.metas['og:image']) add('og-image', 'med', 'ไม่มี og:image');
  else if (!/^https?:\/\//.test(p.metas['og:image'])) add('og-image-rel', 'low', 'og:image ไม่ใช่ absolute URL');
  if (!p.jsonLd.length) add('jsonld', 'high', 'ไม่มี JSON-LD structured data');
  else if (p.jsonLd.some(j => !j.ok)) add('jsonld-invalid', 'high', 'JSON-LD parse ไม่ผ่าน');
  const noAlt = p.images.filter(i => i.src && (i.alt == null || i.alt === '')).length;
  if (noAlt) add('img-alt', 'med', `รูป ${noAlt} รูปไม่มี alt text`);
  if (/noindex/i.test(p.metas['robots'] || '')) add('noindex', 'high', 'มี noindex — หน้าจะหายจาก Google (AI ห้ามเพิ่มเอง)');
  // ตามหลัก SEO เพิ่มเติม
  const hlv = p.headings.map(h => +h.tag[1]);
  for (let i = 1; i < hlv.length; i++) if (hlv[i] - hlv[i - 1] > 1) { add('heading-order', 'low', 'heading ข้ามระดับ (เช่น H1 ไป H3)'); break; }
  if (!p.metas['og:description']) add('og-desc', 'low', 'ไม่มี og:description');
  if (!p.metas['twitter:card']) add('twitter-card', 'low', 'ไม่มี twitter:card');
  if (/maximum-scale\s*=\s*1(\.0)?\b|user-scalable\s*=\s*no/.test(p.metas['viewport'] || '')) add('viewport-noscale', 'low', 'viewport ห้ามผู้ใช้ซูม (กระทบ accessibility)');
  return issues;
}

const countHigh = (issues) => issues.filter(i => i.sev === 'high').length;

// ลบ comment ที่ AI เผลอใส่ในก้อน JSON-LD (ทำให้ JSON.parse พัง)
function sanitizeLdJson(html) {
  return html.replace(/(<script[^>]*application\/ld\+json[^>]*>)([\s\S]*?)(<\/script>)/gi, (_, open, body, close) => {
    let cleaned = body.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    try { JSON.parse(cleaned); } catch {
      // ลองซ่อม: ตัด // comment ท้ายบรรทัด (ไม่โดน http:// เพราะต้องมี whitespace นำ) + ตัด trailing comma
      const repaired = cleaned
        .replace(/[ \t]+\/\/[^"\n]*$/gm, '')
        .replace(/,\s*([}\]])/g, '$1')
        .trim();
      try { JSON.parse(repaired); cleaned = repaired; } catch { /* ซ่อมไม่ได้ — ปล่อยให้ validator จับ */ }
    }
    return open + '\n' + cleaned + '\n' + close;
  });
}

// ── Surgical patcher: patch เฉพาะ <head> + JSON-LD + alt ด้วย cheerio (deterministic) ──
// คง body เดิม 100% → ผ่าน content guard เสมอ เหมาะกับหน้าหนักที่ rewrite ทั้งหน้าไม่ไหว
export function applyHeadFix(html, fix, url) {
  const $ = cheerio.load(html, { decodeEntities: false });
  let head = $('head').first();
  if (!head.length) { $('html').prepend('<head></head>'); head = $('head').first(); }

  const setName = (name, content) => {
    if (content == null || content === '') return;
    let el = head.find(`meta[name="${name}"]`).first();
    if (!el.length) { head.append(`<meta name="${name}">`); el = head.find(`meta[name="${name}"]`).first(); }
    el.attr('content', content);
  };
  const setProp = (prop, content) => {
    if (content == null || content === '') return;
    let el = head.find(`meta[property="${prop}"]`).first();
    if (!el.length) { head.append(`<meta property="${prop}">`); el = head.find(`meta[property="${prop}"]`).first(); }
    el.attr('content', content);
  };

  if (!head.find('meta[charset]').length) head.prepend('<meta charset="UTF-8">');

  if (fix.title) {
    let t = head.find('title').first();
    if (!t.length) { head.append('<title></title>'); t = head.find('title').first(); }
    t.text(fix.title);
  }
  setName('description', fix.metaDescription);

  // viewport: ให้มี + ตัด user-scalable=no / maximum-scale ออก
  let vp = head.find('meta[name="viewport"]').first();
  if (!vp.length) head.append('<meta name="viewport" content="width=device-width, initial-scale=1">');
  else {
    const c = (vp.attr('content') || '').replace(/,?\s*(maximum-scale\s*=\s*[\d.]+|user-scalable\s*=\s*no)/gi, '').replace(/^,\s*/, '').trim();
    vp.attr('content', c || 'width=device-width, initial-scale=1');
  }

  if (fix.lang) $('html').attr('lang', fix.lang);

  if (fix.canonical) { head.find('link[rel="canonical"]').remove(); head.append(`<link rel="canonical" href="${fix.canonical}">`); }

  if (fix.og) { setProp('og:title', fix.og.title); setProp('og:description', fix.og.description); setProp('og:image', fix.og.image); setProp('og:url', fix.og.url); }
  setName('twitter:card', fix.twitterCard);

  // JSON-LD: ใส่เฉพาะเมื่อหน้ายังไม่มีก้อนที่ valid + เฉพาะ object ที่ JSON.parse ผ่าน
  const hasValidLd = $('script[type="application/ld+json"]').toArray().some(el => { try { JSON.parse($(el).text()); return true; } catch { return false; } });
  if (Array.isArray(fix.jsonLd) && fix.jsonLd.length && !hasValidLd) {
    for (const obj of fix.jsonLd) {
      let json;
      try { json = JSON.stringify(obj); JSON.parse(json); } catch { continue; }
      head.append(`<script type="application/ld+json">${json}</script>`);
    }
  }

  // alt: เติมเฉพาะรูปที่ยังไม่มี alt และ match src กับ key ที่ AI ให้มา
  if (fix.imageAlts && typeof fix.imageAlts === 'object') {
    $('img').each((_, el) => {
      const $img = $(el);
      const cur = $img.attr('alt');
      if (cur != null && cur !== '') return;
      const src = $img.attr('src') || $img.attr('data-src') || '';
      for (const [key, alt] of Object.entries(fix.imageAlts)) {
        if (key && alt && src.includes(key)) { $img.attr('alt', alt); break; }
      }
    });
  }

  return $.html();
}

// ── Surgical fix: AI คืน head fields → patch DOM → ตรวจซ้ำ (คง body 100%) ──
export async function aiFixPageSurgical(html, url, brand, onProgress = () => {}) {
  if (!aiAvailable()) throw new Error('ยังไม่ได้ตั้งค่า AI API key');
  const before = validatePageHtml(html, url);
  onProgress(`ตรวจหน้าเดิม: พบ ${before.length} ปัญหา (ร้ายแรง ${countHigh(before)})`);

  onProgress('AI วิเคราะห์ head + schema (surgical)...');
  const aiIssues = before.map(i => ({ severity: i.sev, title: i.id, detail: i.msg }));
  const fix = await aiGenerateHeadFix(html, url, aiIssues, brand);

  let patched = sanitizeLdJson(applyHeadFix(html, fix, url));
  const after = validatePageHtml(patched, url);
  onProgress(`ตรวจซ้ำ (surgical): เหลือ ${after.length} ปัญหา (ร้ายแรง ${countHigh(after)})`);

  // surgical ต้องคงเนื้อหา body — ถ้าเพี้ยนเกิน 10% แสดงว่า patch ผิดพลาด
  const fakeHeaders = { get: () => '' };
  const origText = extractPageData(html, url, fakeHeaders, 200, 0, []).textLength;
  const newText = extractPageData(patched, url, fakeHeaders, 200, 0, []).textLength;
  if (origText > 300 && newText < origText * 0.9) throw new Error('surgical patch ทำให้เนื้อหาเปลี่ยนผิดปกติ — ไม่รับ');

  return {
    fixedHtml: patched,
    before: { count: before.length, high: countHigh(before), issues: before },
    after: { count: after.length, high: countHigh(after), issues: after },
    passes: 1,
    verified: countHigh(after) === 0,
    mode: 'surgical',
  };
}

// ── แก้ + ตรวจซ้ำ + แก้ซ้ำจนผ่าน (สูงสุด maxPasses รอบ) ──
export async function aiFixPageVerified(html, url, brand, onProgress = () => {}, maxPasses = 2) {
  if (!aiAvailable()) throw new Error('ยังไม่ได้ตั้งค่า AI API key');
  const before = validatePageHtml(html, url);
  onProgress(`ตรวจหน้าเดิม: พบ ${before.length} ปัญหา (ร้ายแรง ${countHigh(before)})`);

  let current = html;
  let issues = before;
  let fixed = null, after = issues, passes = 0;

  for (let pass = 1; pass <= maxPasses; pass++) {
    passes = pass;
    onProgress(`AI กำลังแก้ (รอบที่ ${pass})...`);
    const aiIssues = issues.map(i => ({ severity: i.sev, title: i.id, detail: i.msg }));
    let candidate = await aiGenerateFixedPage(current, url, aiIssues, brand);
    if (!candidate || candidate.length < 200) { onProgress('AI ตอบกลับสั้นผิดปกติ — ใช้ผลรอบก่อนหน้า'); break; }
    candidate = sanitizeLdJson(candidate);

    const candIssues = validatePageHtml(candidate, url);
    onProgress(`ตรวจซ้ำรอบ ${pass}: เหลือ ${candIssues.length} ปัญหา (ร้ายแรง ${countHigh(candIssues)})`);

    // กัน AI เผลอตัดเนื้อหาทิ้ง — ถ้าเนื้อหาหดเกิน 50% ถือว่าผิดกติกา ไม่รับ
    const fakeHeaders = { get: () => '' };
    const origText = extractPageData(html, url, fakeHeaders, 200, 0, []).textLength;
    const candText = extractPageData(candidate, url, fakeHeaders, 200, 0, []).textLength;
    if (origText > 300 && candText < origText * 0.5) {
      onProgress('AI ตัดเนื้อหาหายเกินครึ่ง — ปฏิเสธผลรอบนี้');
      break;
    }

    fixed = candidate; after = candIssues; current = candidate; issues = candIssues;
    if (countHigh(candIssues) === 0) break; // ปัญหาร้ายแรงหมดแล้ว — จบ
  }

  if (!fixed) throw new Error('AI สร้างผลที่ผ่านการตรวจไม่ได้ — ลองใหม่อีกครั้ง');
  return {
    fixedHtml: fixed,
    before: { count: before.length, high: countHigh(before), issues: before },
    after: { count: after.length, high: countHigh(after), issues: after },
    passes,
    verified: countHigh(after) === 0,
  };
}

// ── แก้หลายหน้าต่อเนื่อง (batch) — ทีละหน้า กัน rate limit ──
export async function fixPagesBatch(urls, onProgress = () => {}, onPageDone = () => {}) {
  const results = [];
  for (const [i, url] of urls.entries()) {
    onProgress(`[${i + 1}/${urls.length}] ${url}`);
    try {
      const r = await fixLivePage(url, (m) => onProgress(`[${i + 1}/${urls.length}] ${m}`));
      results.push({ url, ok: true, ...r });
    } catch (e) {
      results.push({ url, ok: false, error: String(e.message || e) });
    }
    onPageDone(results[results.length - 1]);
  }
  return results;
}

// ── ดึง HTML สดจาก URL แล้วแก้ ──
export async function fixLivePage(url, onProgress = () => {}) {
  onProgress('กำลังดึง HTML ต้นฉบับ...');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let html;
  try {
    const res = await fetch(url, { headers: UA_HEADERS, redirect: 'follow', signal: ctrl.signal });
    if (!res.ok) throw new Error(`หน้าตอบ ${res.status}`);
    html = await res.text();
  } finally { clearTimeout(timer); }
  const brand = (() => { try { return new URL(url).hostname.replace(/^www\./, '').split('.')[0]; } catch { return ''; } })();
  // surgical เป็นค่าเริ่มต้น (คง body 100% — เหมาะกับหน้าหนัก); ถ้าพลาดค่อย fallback เป็น full rewrite
  try {
    return await aiFixPageSurgical(html.slice(0, 120_000), url, brand, onProgress);
  } catch (e) {
    onProgress(`surgical ไม่สำเร็จ (${String(e.message || e).slice(0, 60)}) — ลอง full rewrite`);
    return aiFixPageVerified(html.slice(0, 120_000), url, brand, onProgress);
  }
}
