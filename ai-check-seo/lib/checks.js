// Rule Engine — ตรวจ Technical SEO ด้วยกฎ deterministic (ไม่ใช้ AI → ผลนิ่ง เร็ว ฟรี)
// ผลแต่ละข้อ: { id, category, severity, status: pass|warn|fail|info, title, detail, recommendation, pages, fixable }
import { normalizeUrl, robotsAllows } from './crawler.js';
import { validateSchemaNodes } from './schema-validate.js';

// เวอร์ชันของ "วิธีตรวจ" — bump เมื่อ logic ของ check เปลี่ยน (เช่น img-alt 3-state)
// ใช้ตอนเทียบก่อน/หลัง: ถ้า audit 2 ครั้งคนละเวอร์ชัน → การเปลี่ยนบางอย่างมาจากการอัปเกรดระบบ ไม่ใช่การแก้เว็บ
export const ENGINE_VERSION = 8;

const CATS = {
  onpage: 'Meta & เนื้อหา',
  index: 'Indexability',
  schema: 'Structured Data & Social',
  links: 'ลิงก์',
  images: 'รูปภาพ',
  performance: 'ความเร็ว',
  security: 'ความปลอดภัย',
  rendering: 'JS Rendering',
};
export { CATS };

function mk(id, category, severity, status, title, detail, recommendation = '', pages = [], fixable = false) {
  return { id, category, severity, status, title, detail, recommendation, pages: pages.slice(0, 50), affectedCount: pages.length, fixable };
}

const trunc = (s, n = 80) => (s || '').length > n ? s.slice(0, n) + '…' : (s || '');
const pageList = (pages) => pages.map(p => p.url);

// ── หลักฐานรายหน้า (per-page evidence) ──
// คำนวณ "ข้อเท็จจริงที่ตรวจพบจริง" จาก page object (จาก HTML ที่ crawl มา) ต่อ checkId
// → พิสูจน์ได้ว่า "หน้านี้ไม่มีจริง" ไม่ใช่แค่บอกลอยๆ (ลูกค้า/AI engine เปิด view-source ยืนยันได้)
const h1Count = (p) => (p.headings || []).filter(h => h.tag === 'h1').length;
const EVIDENCE_FN = {
  'h1-missing': (p) => `ตรวจ HTML แล้วพบแท็ก <h1> จำนวน ${h1Count(p)} รายการ`,
  'h1-multiple': (p) => `พบแท็ก <h1> จำนวน ${h1Count(p)} รายการ (ควรมี 1)`,
  'h1-duplicate': (p) => { const h1 = (p.headings || []).find(h => h.tag === 'h1'); return h1 ? `ข้อความ H1: "${trunc(h1.text, 60)}"` : 'พบ H1 ซ้ำกับหน้าอื่น'; },
  'title-missing': (p) => p.title ? `แท็ก <title> = "${trunc(p.title, 60)}"` : (p.renderedTitle || p.metas?.['title'] ? `Raw HTML ไม่มี <title> · พบจาก JS/SPA: "${trunc(p.renderedTitle || p.metas?.['title'], 50)}"` : 'ไม่พบ <title> ทั้งใน raw และหลัง render'),
  'title-length': (p) => `ความยาว <title> = ${(p.title || '').length} ตัวอักษร: "${trunc(p.title, 60)}"`,
  'title-duplicate': (p) => `ข้อความ <title>: "${trunc(p.title, 60)}"`,
  'desc-missing': (p) => 'ไม่พบ <meta name="description"> ในหน้า',
  'desc-length': (p) => `ความยาว description = ${(p.metas?.description || '').length} ตัวอักษร`,
  'canonical-missing': (p) => 'ไม่พบ <link rel="canonical"> ในหน้า',
  'viewport-missing': (p) => 'ไม่พบ <meta name="viewport"> ในหน้า',
  'lang-missing': (p) => 'แอตทริบิวต์ lang ใน <html> ว่างเปล่า/ไม่มี',
  'content-thin': (p) => `จำนวนคำในหน้า ≈ ${p.wordCount} คำ (ต่ำกว่าเกณฑ์ 150)`,
  'img-alt': (p) => { const imgs = (p.images || []).filter(i => i.src); const miss = imgs.filter(i => i.labeled != null ? !i.labeled : i.alt == null).length; return `รูปภาพไม่มี alt ${miss}/${imgs.length} รูป`; },
  'noindex': () => 'พบคำสั่ง noindex (meta robots หรือ X-Robots-Tag)',
  'heading-order': (p) => `ลำดับหัวข้อข้ามระดับ (พบ ${(p.headings || []).map(h => h.tag).join(' → ') || '—'})`,
  'jsonld-missing': () => 'ไม่พบ <script type="application/ld+json"> ในหน้า',
  'og-tags': (p) => { const m = p.metas || {}; const have = ['og:title', 'og:description', 'og:image'].filter(k => m[k]); return `พบ Open Graph: ${have.length ? have.join(', ') : 'ไม่พบเลย'}`; },
};
// แนบหลักฐานรายหน้าเข้า check (เรียกก่อน return) — จับคู่ check.pages (URL) กับ page object จริง
function attachEvidence(checks, pages) {
  const byUrl = new Map(pages.map(p => [p.url, p]));
  for (const c of checks) {
    const fn = EVIDENCE_FN[c.id];
    if (!fn || !c.pages?.length) continue;
    c.evidence = c.pages.slice(0, 50).map(u => {
      const p = byUrl.get(u);
      let note = ''; try { note = p ? fn(p) : ''; } catch { note = ''; }
      return { url: u, note };
    });
  }
}

export function runChecks(site) {
  const checks = [];
  const pages = site.pages.filter(p => p.title !== undefined && !p.nonHtml && !p.blocked);
  const okPages = pages.filter(p => p.status === 200);
  const home = okPages.find(p => { try { return new URL(p.url).pathname === '/'; } catch { return false; } }) || okPages[0];

  if (!okPages.length) {
    checks.push(mk('no-pages', 'index', 'high', 'fail', 'เข้าถึงหน้าเว็บไม่ได้',
      `crawl แล้วไม่พบหน้า HTML ที่ตอบ 200 เลย (พบ ${site.pages.length} URL, ข้อผิดพลาด ${site.fetchErrors.length} รายการ)`,
      'ตรวจสอบว่าเว็บออนไลน์อยู่ และไม่ได้บล็อก bot ทั้งหมด'));
    return { checks, categories: CATS, pagesAnalyzed: 0 };
  }

  // ════════ 1. META & CONTENT ════════
  {
    // title 3-state: raw มี <title> = PASS · raw ไม่มีแต่ JS/SPA สร้างให้ (มี renderedTitle หรือ meta title) = WARNING
    // (Googlebot เห็นหลัง render แต่ AI bot ที่ไม่รัน JS จะไม่เห็น) · ไม่มีทั้ง raw และ rendered = FAIL จริง
    const rawNoTitle = okPages.filter(p => !p.title);
    const softTitle = (p) => p.renderedTitle || p.metas?.['title'];
    const trulyNo = rawNoTitle.filter(p => !softTitle(p));     // ไม่มีทั้ง raw และ rendered/meta → ไม่มีจริง
    const jsOnly = rawNoTitle.filter(p => softTitle(p));        // raw ไม่มี แต่มาจาก JS/SPA → AI bot ไม่เห็น
    if (trulyNo.length)
      checks.push(mk('title-missing', 'onpage', 'high', 'fail', 'หน้าที่ไม่มี <title>', `${trulyNo.length} หน้าไม่มี <title> ทั้งใน HTML ดิบและหลัง render — Search Engine ต้องเดาชื่อหน้าเอง`, 'ใส่ <title> ไม่เกิน 60 ตัวอักษร มีคีย์เวิร์ดหลักของหน้านั้น', pageList(trulyNo), true));
    else if (jsOnly.length)
      checks.push(mk('title-missing', 'onpage', 'high', 'warn', '<title> มาจาก JavaScript (ไม่อยู่ใน HTML ดิบ)', `${jsOnly.length} หน้าไม่มี <title> ใน HTML ดิบ แต่พบหลัง render (เช่น "${trunc(jsOnly[0].renderedTitle || jsOnly[0].metas?.['title'] || '', 50)}") — เว็บเป็น SPA/CSR · Googlebot เห็นหลัง render แต่ AI bot ที่ไม่รัน JS (GPTBot/ClaudeBot/PerplexityBot) จะไม่เห็น`, 'ทำ SSR/SSG ให้ <title> อยู่ใน HTML ดิบตั้งแต่แรก เพื่อให้ทั้ง Google และ AI bot เห็น', pageList(jsOnly), true));
    else
      checks.push(mk('title-missing', 'onpage', 'high', 'pass', 'ทุกหน้ามี <title>', `ตรวจ ${okPages.length} หน้า มี <title> ครบใน HTML ดิบ`));

    const longT = okPages.filter(p => p.title && p.title.length > 60);
    const shortT = okPages.filter(p => p.title && p.title.length > 0 && p.title.length < 15);
    if (longT.length || shortT.length)
      checks.push(mk('title-length', 'onpage', 'med', 'warn', 'ความยาว title ไม่เหมาะสม',
        `${longT.length} หน้า title ยาวเกิน 60 ตัวอักษร (โดนตัดใน SERP), ${shortT.length} หน้าสั้นเกินไป (<15)`,
        'title ที่ดี: 30–60 ตัวอักษร ขึ้นต้นด้วยคีย์เวิร์ด ลงท้ายด้วยแบรนด์', pageList([...longT, ...shortT]), true));
    else checks.push(mk('title-length', 'onpage', 'med', 'pass', 'ความยาว title เหมาะสม', 'ทุกหน้าอยู่ในช่วง 15–60 ตัวอักษร'));

    const titleMap = new Map();
    okPages.forEach(p => { if (p.title) titleMap.set(p.title, [...(titleMap.get(p.title) || []), p.url]); });
    const dupT = [...titleMap.entries()].filter(([, v]) => v.length > 1);
    if (dupT.length) {
      const c = mk('title-duplicate', 'onpage', 'high', 'fail', 'title ซ้ำกันหลายหน้า',
        `พบ title ซ้ำ ${dupT.length} ค่า (รวม ${dupT.reduce((s, [, v]) => s + v.length, 0)} หน้า) — Google สับสนว่าจะจัดอันดับหน้าไหน · ดูด้านล่างว่าค่าไหนซ้ำที่หน้าใดบ้าง`,
        'หน้าที่เป็นคนละเรื่อง: เขียน title เฉพาะของแต่ละหน้า · หน้าที่ต่างกันแค่ query param (เช่น ?page=, ?year=): ใส่ canonical ชี้หน้าหลัก หรือ noindex แทนการเขียน title ใหม่', dupT.flatMap(([, v]) => v), true);
      c.groups = dupT.map(([value, pages]) => ({ value, pages }));
      checks.push(c);
    } else checks.push(mk('title-duplicate', 'onpage', 'high', 'pass', 'ไม่มี title ซ้ำ', 'แต่ละหน้ามี title ไม่ซ้ำกัน'));

    // desc 3-state เหมือน title: raw มี = PASS · JS/SPA สร้าง = WARNING · ไม่มีทั้ง raw+render = FAIL
    const rawNoDesc = okPages.filter(p => !p.metas['description']);
    const descTrulyNo = rawNoDesc.filter(p => !p.renderedDescription);
    const descJsOnly = rawNoDesc.filter(p => p.renderedDescription);
    if (descTrulyNo.length)
      checks.push(mk('desc-missing', 'onpage', 'med', 'fail', 'หน้าที่ไม่มี meta description', `${descTrulyNo.length}/${okPages.length} หน้าไม่มีทั้งใน HTML ดิบและหลัง render — Search Engine จะตัดข้อความจากหน้ามาแสดงเอง คุมข้อความสรุปได้ยาก`, 'เขียน description 80–160 ตัวอักษร มี call-to-action', pageList(descTrulyNo), true));
    else if (descJsOnly.length)
      checks.push(mk('desc-missing', 'onpage', 'med', 'warn', 'meta description มาจาก JavaScript (ไม่อยู่ใน HTML ดิบ)', `${descJsOnly.length} หน้าไม่มี description ใน HTML ดิบ แต่พบหลัง render — เว็บเป็น SPA · Googlebot เห็นหลัง render แต่ AI bot ที่ไม่รัน JS จะไม่เห็น`, 'ทำ SSR/SSG ให้ meta description อยู่ใน HTML ดิบ', pageList(descJsOnly), true));
    else
      checks.push(mk('desc-missing', 'onpage', 'med', 'pass', 'ทุกหน้ามี meta description', 'ครบทุกหน้าใน HTML ดิบ'));

    const badDesc = okPages.filter(p => { const d = p.metas['description']; return d && (d.length > 170 || d.length < 50); });
    if (badDesc.length) checks.push(mk('desc-length', 'onpage', 'low', 'warn', 'ความยาว meta description ไม่เหมาะสม', `${badDesc.length} หน้าสั้นกว่า 50 หรือยาวกว่า 170 ตัวอักษร`, 'ช่วงที่เหมาะสม: 80–160 ตัวอักษร', pageList(badDesc), true));

    const descMap = new Map();
    okPages.forEach(p => { const d = p.metas['description']; if (d) descMap.set(d, [...(descMap.get(d) || []), p.url]); });
    const dupD = [...descMap.entries()].filter(([, v]) => v.length > 1);
    if (dupD.length) {
      const c = mk('desc-duplicate', 'onpage', 'med', 'warn', 'meta description ซ้ำกัน', `พบ description ซ้ำ ${dupD.length} ค่า (รวม ${dupD.reduce((s, [, v]) => s + v.length, 0)} หน้า) — ดูด้านล่างว่าค่าไหนซ้ำที่หน้าใดบ้าง`, 'เขียน description เฉพาะของแต่ละหน้า', dupD.flatMap(([, v]) => v), true);
      c.groups = dupD.map(([value, pages]) => ({ value, pages }));
      checks.push(c);
    }

    // h1 3-state เหมือน title: raw มี = PASS · JS/SPA สร้าง = WARNING · ไม่มีทั้ง raw+render = FAIL
    const rawNoH1 = okPages.filter(p => !p.headings.some(h => h.tag === 'h1'));
    const h1TrulyNo = rawNoH1.filter(p => !(p.renderedH1 && p.renderedH1.length));
    const h1JsOnly = rawNoH1.filter(p => p.renderedH1 && p.renderedH1.length);
    if (h1TrulyNo.length)
      checks.push(mk('h1-missing', 'onpage', 'high', 'fail', 'หน้าที่ไม่มี H1', `${h1TrulyNo.length}/${okPages.length} หน้าไม่มี H1 ทั้งใน HTML ดิบและหลัง render`, 'ทุกหน้าควรมี H1 เดียว ใส่คีย์เวิร์ดหลัก และอยู่ใน HTML ดิบ', pageList(h1TrulyNo), true));
    else if (h1JsOnly.length)
      checks.push(mk('h1-missing', 'onpage', 'high', 'warn', 'H1 มาจาก JavaScript (ไม่อยู่ใน HTML ดิบ)', `${h1JsOnly.length} หน้าไม่มี H1 ใน HTML ดิบ แต่พบหลัง render — เว็บเป็น SPA · Googlebot เห็นหลัง render แต่ AI bot ที่ไม่รัน JS จะไม่เห็น`, 'ทำ SSR/SSG ให้ H1 อยู่ใน HTML ดิบ', pageList(h1JsOnly), true));
    else
      checks.push(mk('h1-missing', 'onpage', 'high', 'pass', 'ทุกหน้ามี H1', 'ครบทุกหน้าใน HTML ดิบ'));

    // H1 ซ่อนด้วย CSS — inline style (raw) หรือ computed style (Playwright)
    const hiddenH1Pages = okPages.filter(p => (p.hiddenH1 || 0) + (p.renderedH1Hidden || 0) > 0);
    if (hiddenH1Pages.length) checks.push(mk('h1-hidden', 'onpage', 'high', 'warn',
      'H1 ถูกซ่อนด้วย CSS (hidden text)',
      `${hiddenH1Pages.length} หน้ามี H1 ใน HTML แต่ผู้ใช้มองไม่เห็น (visibility:hidden / display:none) — Google อาจตีว่าเป็น hidden text manipulation`,
      'เปลี่ยนเป็น H1 ที่มองเห็นได้จริง หรือลบออกถ้าซ้ำกับ visual element อื่น',
      pageList(hiddenH1Pages), true));

    const h1Count = p => p.headings.filter(h => h.tag === 'h1').length;
    const multiH1 = okPages.filter(p => h1Count(p) > 1);
    if (multiH1.length) {
      // Evidence-Based: หลาย H1 "ผิดหรือไม่" ขึ้นกับบริบท ไม่ใช่แค่จำนวน
      // เก็บหลักฐานหลายมิติ (จำนวน / ข้อความซ้ำ / keyword similarity / อยู่ใน <article>,<section>) → reasoning → confidence
      const normH = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const toks = s => new Set(normH(s).split(/[\s/|·–—-]+/).filter(w => w.length > 1));
      const avgSim = (texts) => {
        const sets = texts.map(toks).filter(s => s.size); if (sets.length < 2) return 0;
        let tot = 0, n = 0;
        for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
          let inter = 0; for (const w of sets[i]) if (sets[j].has(w)) inter++;
          const uni = new Set([...sets[i], ...sets[j]]).size; tot += uni ? inter / uni : 0; n++;
        }
        return n ? tot / n : 0;
      };
      const classify = (p) => {
        const h1s = p.headings.filter(h => h.tag === 'h1');
        const texts = h1s.map(h => h.text);
        const count = texts.length;
        const dup = new Set(texts.map(normH)).size < count;
        const sim = avgSim(texts);
        const sectionedAll = h1s.length > 0 && h1s.every(h => h.sectioned);
        let rank, status, severity, reason;
        if (sectionedAll && sim < 0.6 && !dup) { rank = 0; status = 'pass'; severity = 'low'; reason = `H1 แต่ละตัวอยู่ใน <article>/<section> ตาม HTML5 sectioning · ข้อความต่างกัน (similarity ${sim.toFixed(2)}) → Google ยอมรับหลาย H1 กรณีนี้`; }
        else if (count > 3 && sim >= 0.6) { rank = 3; status = 'fail'; severity = 'med'; reason = `H1 ${count} ตัวที่คีย์เวิร์ดคล้ายกันสูง (similarity ${sim.toFixed(2)}) → เข้าข่าย keyword stuffing`; }
        else if (count > 3) { rank = 3; status = 'fail'; severity = 'high'; reason = `H1 ${count} ตัวต่อหน้า ไม่ได้อยู่ใน sectioning — Google สับสนว่าหน้านี้เกี่ยวกับอะไร (มักเอา H1 ไปครอบ slider/section)`; }
        else if (dup) { rank = 1; status = 'warn'; severity = 'low'; reason = 'H1 ข้อความซ้ำกัน → เจือจางสัญญาณคีย์เวิร์ด (มักมาจาก template)'; }
        else { rank = 1; status = 'warn'; severity = 'low'; reason = `H1 ${count} ตัว — ไม่ผิดร้ายแรงแต่เจือจางสัญญาณคีย์เวิร์ด`; }
        return { p, count, dup, sim, sectionedAll, rank, status, severity, reason };
      };
      const classed = multiH1.map(classify).sort((a, b) => b.rank - a.rank);
      const w = classed[0];
      const affected = classed.filter(c => c.status !== 'pass').map(c => c.p.url);
      const title = w.status === 'pass' ? 'หลาย H1 แต่ถูกต้องตาม HTML5 sectioning'
        : w.status === 'fail' ? (w.severity === 'med' ? `H1 ซ้ำคีย์เวิร์ด (สูงสุด ${w.count} ตัว/หน้า)` : `H1 มากเกินไป (สูงสุด ${w.count} ตัว/หน้า)`)
        : 'หน้าที่มี H1 มากกว่า 1';
      const chk = mk('h1-multiple', 'onpage', w.severity, w.status, title, w.reason,
        'เหลือ H1 หลักเดียวต่อ section · ถ้ามีหลาย topic ใช้ <article>/<section> ครอบแต่ละ H1',
        w.status === 'pass' ? [] : (affected.length ? affected : pageList(multiH1)), w.status === 'fail');
      chk.confidence = w.status === 'pass' ? 0.85 : w.status === 'fail' ? (w.severity === 'med' ? 0.78 : 0.85) : 0.8;
      chk.reasoning = { signals: { maxCount: w.count, duplicate: w.dup, keyword_similarity: +w.sim.toFixed(2), all_in_section: w.sectionedAll }, standard: 'HTML Living Standard (sectioning) · Google: หลาย H1 ไม่ผิดถ้าโครงสร้างถูก', verdict: w.status };
      checks.push(chk);
    }

    // title-h1-align (Evidence-Based): <title> กับ H1 ควรพูดหัวข้อเดียวกัน — ใช้ titleH1Sim (Jaccard) จาก crawler
    // เตือนเฉพาะหน้าที่ "ไม่มีคำร่วมเลย" (sim===0) · confidence ปานกลาง เพราะ title มักมี brand ต่อท้าย → ไม่ฟันธง
    const alignChecked = okPages.filter(p => p.title && typeof p.titleH1Sim === 'number');
    if (alignChecked.length) {
      const noOverlap = alignChecked.filter(p => p.titleH1Sim < 0.1);   // overlap ต่ำมาก = น่าจะคนละเรื่องจริง
      if (noOverlap.length) {
        const c = mk('title-h1-align', 'onpage', 'low', 'warn', 'title กับ H1 ไม่มีคำร่วมกัน',
          `${noOverlap.length}/${alignChecked.length} หน้าที่ <title> กับ H1 ไม่มีคำสำคัญร่วมกันเลย — อาจสื่อคนละเรื่อง ทำให้สัญญาณหัวข้อของหน้าไม่ชัด (บางครั้งปกติถ้า title ใส่แต่ชื่อแบรนด์ ควรเปิดดูยืนยัน)`,
          'ให้ <title> กับ H1 พูดถึงหัวข้อหลักเดียวกัน (title = หัวข้อ + แบรนด์, H1 = หัวข้อ)', pageList(noOverlap), true);
        c.confidence = 0.55;
        c.reasoning = { signals: { pages_no_overlap: noOverlap.length, pages_checked: alignChecked.length }, standard: 'Google Search Central: เขียน title/heading ที่สื่อหัวข้อหน้าให้ชัด', verdict: 'warn', note: 'sim=0 อาจเกิดจาก title มีแต่ brand — เปิดหน้าดูยืนยัน ไม่ฟันธง' };
        checks.push(c);
      } else {
        const c = mk('title-h1-align', 'onpage', 'low', 'pass', 'title กับ H1 สอดคล้องกัน', `ทุกหน้าที่ตรวจ (${alignChecked.length}) มีคำสำคัญร่วมระหว่าง <title> กับ H1`);
        c.confidence = 0.7;
        c.reasoning = { signals: { pages_checked: alignChecked.length }, standard: 'Google Search Central', verdict: 'pass' };
        checks.push(c);
      }
    }

    const skipHeading = okPages.filter(p => {
      const order = p.headings.map(h => +h.tag[1]);
      for (let i = 1; i < order.length; i++) if (order[i] - order[i - 1] > 1) return true;
      return false;
    });
    if (skipHeading.length) checks.push(mk('heading-order', 'onpage', 'low', 'warn', 'ลำดับ heading กระโดดข้าม', `${skipHeading.length} หน้ามี heading ข้ามระดับ (เช่น H1 → H3)`, 'เรียงลำดับ H1→H2→H3 เพื่อโครงสร้างที่ AI และ screen reader เข้าใจ', pageList(skipHeading)));

    const thin = okPages.filter(p => p.wordCount < 150 && !p.emptyRoot);
    if (thin.length) checks.push(mk('content-thin', 'onpage', 'med', 'warn', 'เนื้อหาบางเกินไป (thin content)', `${thin.length} หน้ามีคำน้อยกว่า 150 คำ — แข่งอันดับยาก`, 'เพิ่มเนื้อหาที่ตอบ search intent อย่างน้อย 300+ คำ', pageList(thin)));

    const noLang = okPages.filter(p => !p.lang);
    checks.push(noLang.length
      ? mk('lang-missing', 'onpage', 'low', 'warn', 'ไม่ระบุ lang ใน <html>', `${noLang.length} หน้า — กระทบ accessibility และการเข้าใจภาษาของ search engine`, 'ใส่ <html lang="th"> (หรือภาษาหลักของหน้า)', pageList(noLang), true)
      : mk('lang-missing', 'onpage', 'low', 'pass', 'ระบุ lang ครบ', `ภาษา: ${[...new Set(okPages.map(p => p.lang))].join(', ')}`));

    const noViewport = okPages.filter(p => !p.metas['viewport']);
    checks.push(noViewport.length
      ? mk('viewport-missing', 'onpage', 'high', 'fail', 'ไม่มี viewport meta (ไม่ mobile-friendly)', `${noViewport.length} หน้า — Google ใช้ mobile-first indexing`, 'ใส่ <meta name="viewport" content="width=device-width, initial-scale=1">', pageList(noViewport), true)
      : mk('viewport-missing', 'onpage', 'high', 'pass', 'Mobile viewport ครบ', 'ทุกหน้ามี viewport meta'));

    const badScale = okPages.filter(p => /maximum-scale\s*=\s*1(\.0)?\b|user-scalable\s*=\s*no/.test(p.metas['viewport'] || ''));
    if (badScale.length) checks.push(mk('viewport-noscale', 'onpage', 'low', 'warn', 'viewport ห้ามผู้ใช้ซูม', `${badScale.length} หน้าตั้ง maximum-scale=1 หรือ user-scalable=no — กระทบ accessibility`, 'เอา maximum-scale/user-scalable ออก', pageList(badScale)));

    if (home && !home.favicon) checks.push(mk('favicon-missing', 'onpage', 'low', 'warn', 'ไม่มี favicon', 'ไม่พบ link rel="icon" — favicon แสดงใน SERP มือถือ', 'เพิ่ม favicon และ apple-touch-icon'));
  }

  // ════════ 2. INDEXABILITY ════════
  {
    checks.push(site.https
      ? mk('https', 'security', 'high', 'pass', 'ใช้ HTTPS', 'เว็บเสิร์ฟผ่าน HTTPS')
      : mk('https', 'security', 'high', 'fail', 'ไม่ใช้ HTTPS', 'HTTP ธรรมดาเป็น negative ranking factor และเบราว์เซอร์ขึ้นเตือน "ไม่ปลอดภัย"', 'ติดตั้ง SSL certificate (Let\'s Encrypt ฟรี) และ redirect ทั้งเว็บไป https'));

    // SSL certificate chain ไม่ครบ — origin ส่งแค่ leaf cert ไม่ส่ง intermediate
    // (เราต้อง bypass TLS verify ถึงจะ crawl ได้ → ตรวจเจอตอน crawl, เก็บใน site.tlsInsecure)
    // เบราว์เซอร์เดสก์ท็อปมัก "เดา" intermediate ผ่าน AIA จึงดูปกติ แต่ Node/บอท/มือถือบางตัว/Cloudflare ปฏิเสธ
    if (site.tlsInsecure) {
      checks.push(mk('ssl-chain-incomplete', 'security', 'high', 'fail', 'ใบรับรอง SSL ส่งไม่ครบสาย (ขาด intermediate)',
        `เซิร์ฟเวอร์ส่งเฉพาะ leaf certificate ไม่แนบ intermediate CA${site.tlsErrorCode ? ` (${site.tlsErrorCode})` : ''} — ไคลเอนต์ที่ตรวจเข้ม (บอท SEO, มือถือบางรุ่น, Cloudflare, API) จะมองว่าใบรับรองใช้ไม่ได้และเชื่อมต่อล้มเหลว ทั้งที่เบราว์เซอร์เดสก์ท็อปอาจเปิดได้ปกติ`,
        'ตั้งค่า full certificate chain บนเซิร์ฟเวอร์ (แนบ intermediate CA ต่อท้าย leaf เช่น fullchain.pem ของ Let\'s Encrypt หรือ bundle ของผู้ออกใบรับรอง) แล้วเช็คด้วย SSL Labs ให้ขึ้น chain ครบ'));
    }

    if (site.robotsTxt == null)
      checks.push(mk('robots-missing', 'index', 'med', 'warn', 'ไม่มี robots.txt', `สถานะ: ${site.robotsStatus ?? 'fetch ไม่ได้'} — bot จะ crawl ทุกอย่างโดยไม่มีไกด์`, 'สร้าง robots.txt ระบุ sitemap และส่วนที่ไม่ต้อง crawl', [], true));
    else {
      const r = site.robots;
      const blocksAll = r.groups.some(g => g.agents.includes('*') && g.rules.some(x => x.type === 'disallow' && x.path === '/'));
      checks.push(blocksAll
        ? mk('robots-blocks-all', 'index', 'high', 'fail', 'robots.txt บล็อกทั้งเว็บ!', 'พบ "Disallow: /" สำหรับ User-agent: * — เว็บล่องหนจาก Google ทั้งหมด', 'เอา Disallow: / ออกทันที', [], true)
        : mk('robots-blocks-all', 'index', 'high', 'pass', 'robots.txt ไม่ได้บล็อกทั้งเว็บ', 'ไม่มี Disallow: / แบบเหมารวม'));
      // section สำคัญที่อาจถูกบล็อก — ตรวจ "ตามจริง" ว่า agent ที่มีผลต่อ SEO/AI โดนบล็อกไหม
      // (robots.txt ใช้กฎ most-specific match: Googlebot/AI ใช้ group ของตัวเองถ้ามี ไม่งั้น fallback ไป * —
      //  ดังนั้น Disallow ที่อยู่ในกลุ่มบอตขยะอย่างเดียว ไม่กระทบ Google/AI)
      const SECTION_RE = /^\/(th|en|blog|product|service|news|article|category|shop)s?\/?$/i;
      const candidateSections = [...new Set(
        r.groups.flatMap(g => g.rules)
          .filter(x => x.type === 'disallow' && x.path && SECTION_RE.test(x.path))
          .map(x => x.path)
      )];
      const AI_SECTION_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot'];
      const googleBlocked = candidateSections.filter(p => !robotsAllows(r, 'Googlebot', p));
      const aiBlocked = candidateSections.filter(p => AI_SECTION_BOTS.some(b => !robotsAllows(r, b, p)));
      if (googleBlocked.length)
        checks.push(mk('robots-blocks-section', 'index', 'high', 'fail', 'robots.txt บล็อก Googlebot จาก section สำคัญ',
          `Googlebot ถูกห้าม crawl: ${googleBlocked.map(p => `"${p}"`).join(', ')} — หน้าในส่วนนี้อาจไม่ถูก crawl และเนื้อหาอาจไม่ถูกจัดทำดัชนีตามปกติ (Google ยังอาจรู้จัก URL จาก sitemap/ลิงก์ แต่จะอ่านเนื้อหาไม่ได้) — ตรวจว่าตั้งใจบล็อกหรือไม่`,
          `ถ้าไม่ได้ตั้งใจ: ลบบรรทัด Disallow ของ section นี้ออกจากกลุ่ม "User-agent: *" หรือเพิ่มกลุ่มเฉพาะ "User-agent: Googlebot" + "Allow: ${googleBlocked[0]}" — แก้เฉพาะจุด ไม่ต้องเขียน robots.txt ใหม่ทั้งไฟล์`, [], true));
      else if (aiBlocked.length)
        checks.push(mk('robots-blocks-section', 'index', 'med', 'warn', 'robots.txt บล็อก AI crawler จาก section สำคัญ',
          `Googlebot เข้าถึงได้ปกติ แต่ AI crawler (เช่น ${AI_SECTION_BOTS.join(', ')}) ถูกห้าม crawl: ${aiBlocked.map(p => `"${p}"`).join(', ')} — มักเกิดจากกฎใน "User-agent: *" ที่ครอบ AI bot ไปด้วย ทำให้ AI ดึงเนื้อหาส่วนนี้ไปตอบไม่ได้ (กระทบ GEO ไม่กระทบอันดับ Google โดยตรง)`,
          `ถ้าต้องการให้ AI เข้าถึง section นี้ ให้เพิ่มกลุ่มเฉพาะ เช่น "User-agent: GPTBot" + "Allow: ${aiBlocked[0]}" (ทำเหมือนกันกับ ClaudeBot/PerplexityBot)`, [], true));
      else
        checks.push(mk('robots-blocks-section', 'index', 'low', 'pass', 'robots.txt ไม่ได้บล็อก Googlebot/AI จาก section เนื้อหาหลัก',
          candidateSections.length
            ? `พบ Disallow บาง section (${candidateSections.join(', ')}) แต่จำกัดเฉพาะบอตที่ไม่กระทบ SEO/AI (เช่น scraper / SEO-tool bots) — ถือว่าตั้งใจ ไม่เป็นปัญหา`
            : 'ไม่พบการบล็อก section เนื้อหาหลัก'));
      checks.push(r.sitemaps.length
        ? mk('robots-sitemap', 'index', 'low', 'pass', 'robots.txt อ้างถึง sitemap', r.sitemaps.join(', '))
        : mk('robots-sitemap', 'index', 'low', 'warn', 'robots.txt ไม่ได้อ้าง sitemap', 'ควรใส่บรรทัด Sitemap: เพื่อช่วย bot หา URL ครบ', '', [], true));
    }

    checks.push(site.sitemapUrls.length
      ? mk('sitemap-exists', 'index', 'med', 'pass', `มี XML sitemap (${site.sitemapUrls.length} URLs)`, `จาก: ${site.sitemaps.join(', ') || '/sitemap.xml'}`)
      : mk('sitemap-exists', 'index', 'med', 'fail', 'ไม่พบ XML sitemap', 'ไม่มี sitemap.xml — Google หา URL ครบช้าลงมาก โดยเฉพาะหน้าใหม่', 'สร้าง sitemap.xml และ submit ใน Search Console', [], true));

    if (site.sitemapUrls.length) {
      const crawledSet = new Set(okPages.map(p => p.url));
      const notInSitemap = okPages.filter(p => !site.sitemapUrls.some(u => normalize(u) === normalize(p.url)));
      function normalize(u) { try { const x = new URL(u); return x.origin.replace('//www.', '//') + x.pathname.replace(/\/$/, ''); } catch { return u; } }
      if (notInSitemap.length > okPages.length * 0.3)
        checks.push(mk('sitemap-coverage', 'index', 'low', 'warn', 'sitemap ครอบคลุมไม่ครบ', `${notInSitemap.length}/${okPages.length} หน้าที่ crawl เจอ ไม่อยู่ใน sitemap`, 'อัปเดต sitemap ให้ครบทุกหน้า indexable', pageList(notInSitemap), true));
    }

    const noindexed = okPages.filter(p => /noindex/i.test(p.metas['robots'] || '') || /noindex/i.test(p.headers?.['x-robots-tag'] || ''));
    if (noindexed.length) {
      // Evidence-Based: noindex บนหน้า utility (login/cart/search) = ตั้งใจ ปกติ
      //   แต่บนหน้า "เนื้อหา" (homepage/about/สินค้า/ข่าว) = มักพลาด → ค่อยเตือนหนัก
      // ใช้ URL pattern เป็นหลักฐาน (เดาเจตนาจาก path) → confidence ไม่เต็ม เพราะอ่านใจไม่ได้ 100%
      const UTILITY_RE = /\/(login|signin|sign-in|logout|register|signup|sign-up|cart|checkout|basket|account|profile|dashboard|admin|wp-admin|wp-login|thank-?you|thanks|confirm(ation)?|search|results?|preview|print|staging|tag\/|author\/|filter|compare|wishlist|unsubscribe|404|error)/i;
      const classifyNi = (p) => {
        let path = '', search = '';
        try { const u = new URL(p.url); path = u.pathname; search = u.search; } catch { path = p.url || ''; }
        const utility = (path !== '/' && (UTILITY_RE.test(path) || /[?&](page|year|sort|filter|q|s|tag|ref)=/i.test(search)));
        return { p, path, utility };
      };
      const classed = noindexed.map(classifyNi);
      const accidental = classed.filter(c => !c.utility);
      const intentional = classed.filter(c => c.utility);
      const signals = { total_noindexed: noindexed.length, content_pages: accidental.length, utility_pages: intentional.length };
      const std = 'Google Search Central: robots meta tag (noindex)';
      if (accidental.length) {
        const homepageHit = accidental.some(c => c.path === '/' || c.path === '');
        const extra = intentional.length ? ` · อีก ${intentional.length} หน้าเป็น utility (login/cart/search) ถือว่าตั้งใจ` : '';
        const c = mk('noindex', 'index', 'high', 'warn', homepageHit ? 'หน้าหลัก/หน้าเนื้อหาติด noindex' : 'หน้าเนื้อหาอาจติด noindex โดยไม่ตั้งใจ',
          `${accidental.length} หน้าที่ดูเหมือน "หน้าเนื้อหา" มี noindex → จะไม่ถูกจัดทำดัชนีใน Google${homepageHit ? ' (รวมหน้าหลัก — ควรรีบตรวจ)' : ''}${extra}`,
          'เปิดดูว่าตั้งใจไหม — ถ้าเป็นหน้าที่อยากให้ติดอันดับ ให้เอา noindex ออก', pageList(accidental.map(c => c.p)));
        c.confidence = homepageHit ? 0.8 : 0.65;
        c.reasoning = { signals, standard: std, verdict: 'warn', note: 'จำแนกจาก URL path (เดาเจตนา) — ควรยืนยันกับเจ้าของเว็บ' };
        checks.push(c);
      } else {
        const c = mk('noindex', 'index', 'low', 'pass', 'หน้า noindex ดูเหมือนตั้งใจทั้งหมด',
          `${intentional.length} หน้ามี noindex แต่ทั้งหมดเป็นหน้า utility (login/cart/search/print) → ปกติ ไม่ใช่ปัญหา`,
          'ถ้ามั่นใจว่าไม่มีหน้าเนื้อหาสำคัญติด noindex ก็ไม่ต้องแก้', pageList(intentional.map(c => c.p)));
        c.confidence = 0.6;
        c.reasoning = { signals, standard: std, verdict: 'pass', note: 'จำแนกจาก URL path — ทั้งหมดเข้าเกณฑ์หน้า utility' };
        checks.push(c);
      }
    }

    // robots meta directive ที่ไม่ valid หรือ deprecated (เช่น "nodiy", "noodp", "noydir")
    const VALID_ROBOTS = new Set(['index','noindex','follow','nofollow','none','all','noarchive','nosnippet','notranslate','noimageindex','nocache','indexifembedded','max-snippet','max-image-preview','max-video-preview','unavailable_after']);
    const DEPRECATED_ROBOTS = new Set(['noodp','noydir']);
    const badRobotsMeta = [];
    for (const p of okPages) {
      const content = (p.metas['robots'] || '').trim();
      if (!content) continue;
      const tokens = content.toLowerCase().split(',').map(t => t.split(':')[0].trim()).filter(Boolean);
      const bad = tokens.filter(t => !VALID_ROBOTS.has(t) && !DEPRECATED_ROBOTS.has(t));
      const dep = tokens.filter(t => DEPRECATED_ROBOTS.has(t));
      if (bad.length || dep.length) badRobotsMeta.push({ p, bad, dep, content });
    }
    if (badRobotsMeta.length) {
      const allBad = [...new Set(badRobotsMeta.flatMap(x => x.bad))];
      const allDep = [...new Set(badRobotsMeta.flatMap(x => x.dep))];
      const parts = [];
      if (allBad.length) parts.push(`directive ที่ไม่มีจริง: "${allBad.join('", "')}" (Google ไม่รู้จัก อาจ ignore ทั้งบรรทัด)`);
      if (allDep.length) parts.push(`directive ที่เลิกใช้แล้ว: "${allDep.join('", "')}" (deprecated ตั้งแต่ปี 2019)`);
      checks.push(mk('robots-meta-invalid', 'index', 'med', 'warn', 'meta robots มี directive ที่ไม่ valid',
        `${badRobotsMeta.length} หน้า — ${parts.join(' · ')}`,
        'ใช้เฉพาะ directive มาตรฐาน เช่น index, noindex, follow, nofollow, noarchive, max-snippet — เอา token ที่ไม่รู้จัก/deprecated ออก',
        pageList(badRobotsMeta.map(x => x.p)), true));
    }

    const noCanonical = okPages.filter(p => !p.canonical);
    if (noCanonical.length) {
      // Evidence-Based: ไม่มี canonical "ร้ายแรงแค่ไหน" ขึ้นกับว่ามีความเสี่ยง duplicate จริงไหม
      // Google self-canonical ให้โดยปริยาย → ถ้าเว็บสะอาด (ไม่มี query param / title ไม่ซ้ำ) = ความเสี่ยงต่ำ ไม่ใช่ fail/high
      const hasQueryParam = okPages.some(p => { try { return new URL(p.url).search.length > 0; } catch { return false; } })
        || (site.sitemapUrls || []).some(u => typeof u === 'string' && u.includes('?'));
      const titleCount = {};
      okPages.forEach(p => { const t = (p.title || '').trim(); if (t) titleCount[t] = (titleCount[t] || 0) + 1; });
      const hasDupTitle = Object.values(titleCount).some(n => n > 1);
      const dupRisk = hasQueryParam || hasDupTitle;
      const riskWhy = [hasQueryParam ? 'พบ URL ที่มี query param' : null, hasDupTitle ? 'พบ title ซ้ำข้ามหน้า' : null].filter(Boolean).join(' · ');
      const c = mk('canonical-missing', 'index', dupRisk ? 'high' : 'low', dupRisk ? 'fail' : 'warn',
        dupRisk ? 'หน้าที่ไม่มี canonical (มีความเสี่ยง duplicate)' : 'หน้าที่ไม่มี canonical (ความเสี่ยงต่ำ)',
        dupRisk
          ? `${noCanonical.length}/${okPages.length} หน้าไม่มี canonical และเว็บนี้มีสัญญาณ duplicate (${riskWhy}) → หน้าซ้ำอาจถูก index แยกกัน แย่งสัญญาณกันเอง`
          : `${noCanonical.length}/${okPages.length} หน้าไม่มี canonical — Google จะ self-canonical ให้โดยปริยาย และยังไม่พบสัญญาณ duplicate (ไม่มี query param/title ซ้ำ) จึงไม่เร่งด่วน แต่ใส่ให้ชัดช่วยกันปัญหาในอนาคต`,
        'ใส่ <link rel="canonical"> ทุกหน้า ชี้ URL หลักของตัวเอง', pageList(noCanonical), true);
      c.confidence = dupRisk ? 0.8 : 0.6;
      c.reasoning = { signals: { missing: noCanonical.length, total: okPages.length, has_query_param: hasQueryParam, has_dup_title: hasDupTitle }, standard: 'Google Search Central: consolidate duplicate URLs (rel=canonical)', verdict: dupRisk ? 'fail' : 'warn' };
      checks.push(c);
    } else {
      checks.push(mk('canonical-missing', 'index', 'low', 'pass', 'canonical tag ครบ', 'ทุกหน้ามี canonical'));
    }

    const chains = okPages.filter(p => (p.redirectChain || []).length > 1);
    if (chains.length) checks.push(mk('redirect-chain', 'index', 'med', 'warn', 'redirect ต่อกันหลายชั้น', `${chains.length} หน้ามี redirect chain เกิน 1 hop — เสีย crawl budget และ link equity`, 'แก้ให้ redirect ตรงไปปลายทางใน hop เดียว (301)', pageList(chains)));

    // แยก "หน้าหายจริง" (404/410 = ถาวร ตรวจกี่ครั้งก็เหมือนเดิม) ออกจาก "ตรวจไม่ติดตอน crawl"
    // (429 rate-limit / 403 บล็อกบอท / 5xx เซิร์ฟเวอร์ error = ชั่วคราว/เกิดจากตรวจถี่ → info ไม่กระทบคะแนน กันคะแนนเด้ง)
    const isGone = (s) => s === 404 || s === 410;
    const errGone = site.pages.filter(p => isGone(p.status));
    const errSoft = site.pages.filter(p => p.status >= 400 && !isGone(p.status));
    if (errGone.length) checks.push(mk('error-pages', 'index', 'high', 'fail', 'หน้าที่หายจริง (404/410)', `${errGone.length} URL ตอบ ${[...new Set(errGone.map(p => p.status))].join(', ')} — หน้าเหล่านี้หายจริง หากเป็นหน้าหลักหรือหน้าบริการจะกระทบต่อการมองเห็นค่อนข้างมาก`, 'แก้ origin/CDN ให้ตอบ 200 หรือ redirect ไปหน้าที่ถูกต้อง', errGone.map(p => `${p.url} → ${p.status}`)));
    if (errSoft.length) checks.push(mk('crawl-blocked', 'index', 'med', 'info', 'บางหน้าตรวจไม่ติดตอน crawl (อาจชั่วคราว/บล็อกบอท)', `${errSoft.length} URL ตอบ ${[...new Set(errSoft.map(p => p.status))].join(', ')} — เช่น 429 (เซิร์ฟเวอร์จำกัด rate เพราะตรวจถี่) / 403 (บล็อกบอท) / 5xx (เซิร์ฟเวอร์ error ชั่วคราว) · ไม่กระทบคะแนนเพราะหน้าจริงอาจปกติ ควรตรวจซ้ำเพื่อยืนยัน`, 'ถ้าตรวจซ้ำแล้วยัง error = ปัญหาจริงต้องแก้ · ถ้า 429 = ปกติ (เซิร์ฟเวอร์กันบอทถี่)', errSoft.map(p => `${p.url} → ${p.status}`)));

    if (site.notFoundHandling && !site.notFoundHandling.ok)
      checks.push(mk('soft-404', 'index', 'med', 'warn', 'หน้า 404 ตอบสถานะผิด', `URL ที่ไม่มีจริงตอบ ${site.notFoundHandling.status} แทนที่จะเป็น 404 (soft 404) — Google จะ index ขยะ`, 'ให้หน้าไม่พบตอบ HTTP 404 จริง', [], false));

    const httpsPages = okPages.filter(p => p.url.startsWith('https://'));
    const mixed = httpsPages.filter(p =>
      [...p.scripts, ...p.stylesheets, ...p.images.map(i => i.src)].some(u => typeof u === 'string' && u.startsWith('http://')));
    if (mixed.length) checks.push(mk('mixed-content', 'security', 'med', 'fail', 'Mixed content (โหลด http บนหน้า https)', `${mixed.length} หน้าโหลด resource ผ่าน http:// — เบราว์เซอร์บล็อก/เตือน`, 'เปลี่ยนทุก resource เป็น https://', pageList(mixed), true));

    const hreflangPages = okPages.filter(p => p.hreflang.length);
    if (hreflangPages.length) {
      const badHreflang = hreflangPages.filter(p => !p.hreflang.some(h => h.lang === 'x-default'));
      checks.push(mk('hreflang', 'index', 'low', badHreflang.length ? 'warn' : 'pass', 'hreflang',
        badHreflang.length ? `มี hreflang แต่ ${badHreflang.length} หน้าไม่มี x-default` : `พบ hreflang บน ${hreflangPages.length} หน้า`,
        badHreflang.length ? 'เพิ่ม hreflang="x-default"' : '', pageList(badHreflang), true));
    } else {
      // ตรวจหาสัญญาณว่าเว็บมีหลายภาษา ทั้งแบบ path (/en/, /th/) และ query (?language=en, ?lang=en, ?hl=en)
      const langPath = /\/(en|th|zh|ja|ko)(\/|$)/i;
      const langQuery = /[?&](lang|language|locale|hl)=([a-z]{2})/i;
      const isLangUrl = u => langPath.test(u) || langQuery.test(u);
      const crawledMulti = okPages.some(p => isLangUrl(p.url));
      const sitemapMulti = (site.sitemapUrls || []).some(isLangUrl);
      if (crawledMulti || sitemapMulti) {
        const where = sitemapMulti && !crawledMulti
          ? 'sitemap มี URL หลายภาษา (เช่น ?language=en) แต่หน้าที่ตรวจไม่มี hreflang tags เลย'
          : 'พบ URL หลายภาษา (path /en/ หรือ query ?language=en) แต่ไม่มี hreflang tags';
        checks.push(mk('hreflang', 'index', 'med', 'warn', 'มีหลายภาษาแต่ไม่มี hreflang',
          `${where} — Google อาจเสิร์ฟภาษาผิดให้ผู้ใช้ และ index หน้าซ้ำข้ามภาษา`,
          'ใส่ <link rel="alternate" hreflang="..."> ครบทุกคู่ภาษา + x-default ในทุกหน้า', [], true));
      }
    }
  }

  // ════════ 3. STRUCTURED DATA & SOCIAL ════════
  {
    const withLd = okPages.filter(p => p.jsonLd.length);
    checks.push(withLd.length === 0
      ? mk('jsonld-missing', 'schema', 'high', 'fail', 'ไม่มี Structured Data (JSON-LD) ใน HTML ดิบ', `0/${okPages.length} หน้า — เสียโอกาส rich results และ AI engines ไม่มีข้อมูลแบบมีโครงสร้างให้ดึง (หากเว็บเป็น SPA และสร้าง schema ด้วย JS ก็ยังควรย้ายมาไว้ใน HTML ดิบ เพราะ AI bot ไม่รัน JS)`, 'เพิ่ม Organization, WebSite, BreadcrumbList และ Service/FAQ schema', [], true)
      : mk('jsonld-missing', 'schema', 'high', withLd.length < okPages.length * 0.9 ? 'warn' : 'pass', 'Structured Data (JSON-LD)', `${withLd.length}/${okPages.length} หน้ามี JSON-LD`, withLd.length < okPages.length ? 'เพิ่มให้ครบทุกหน้า indexable' : '', pageList(okPages.filter(p => !p.jsonLd.length)), true));

    const badLd = okPages.filter(p => p.jsonLd.some(j => !j.ok));
    if (badLd.length) checks.push(mk('jsonld-invalid', 'schema', 'high', 'fail', 'JSON-LD รูปแบบไม่ถูกต้อง (parse ไม่ได้)', `${badLd.length} หน้ามี JSON-LD ที่ไวยากรณ์ JSON ไม่สมบูรณ์ — Search Engine จะไม่นำ structured data ก้อนนั้นไปใช้`, 'ตรวจ syntax ด้วย Rich Results Test', pageList(badLd), true));

    const ldTypes = new Set();
    okPages.forEach(p => p.jsonLd.forEach(j => {
      if (!j.ok) return;
      const collect = (d) => { if (Array.isArray(d)) return d.forEach(collect); if (d && typeof d === 'object') { if (d['@type']) [].concat(d['@type']).forEach(t => ldTypes.add(t)); if (d['@graph']) collect(d['@graph']); } };
      collect(j.data);
    }));
    checks.push(ldTypes.has('Organization') || ldTypes.has('LocalBusiness') || ldTypes.has('Corporation')
      ? mk('schema-org', 'schema', 'med', 'pass', 'มี Organization schema', `พบ types: ${[...ldTypes].slice(0, 10).join(', ')}`)
      : mk('schema-org', 'schema', 'med', 'fail', 'ไม่มี Organization/LocalBusiness schema', `ไม่พบใน ${okPages.length} หน้าที่ตรวจ — ช่วยให้ Google/AI ระบุได้ชัดขึ้นว่าธุรกิจนี้คือใคร อยู่ที่ไหน (กระทบโอกาสได้ Knowledge Panel) · แก้ครั้งเดียวที่ template/หน้าแรกก็ครอบคลุมทั้งเว็บ`, 'เพิ่ม Organization schema พร้อม logo, address, sameAs (social links)', home ? [home.url] : okPages.slice(0, 1).map(p => p.url), true));
    checks.push(ldTypes.has('BreadcrumbList')
      ? mk('schema-breadcrumb', 'schema', 'low', 'pass', 'มี BreadcrumbList schema', '')
      : mk('schema-breadcrumb', 'schema', 'low', 'warn', 'ไม่มี BreadcrumbList schema', 'breadcrumb ใน SERP ช่วย CTR', 'เพิ่ม BreadcrumbList ทุกหน้า', [], true));

    // ── ความสมบูรณ์ของ schema (เทียบเกณฑ์ rich-result ของ Google เหมือน Rich Results Test) ──
    {
      const errPages = [], warnPages = [];
      const errSet = new Set(), warnSet = new Set();
      let anyValidatable = false;
      for (const p of okPages) {
        const dataArr = p.jsonLd.filter(j => j.ok).map(j => j.data);
        if (!dataArr.length) continue;
        const v = validateSchemaNodes(dataArr);
        if (v.hasValidatableType) anyValidatable = true;
        if (v.errors.length) { errPages.push(p); v.errors.forEach(e => errSet.add(`${e.type}.${e.prop}`)); }
        else if (v.warnings.length) { warnPages.push(p); v.warnings.forEach(w => warnSet.add(`${w.type}.${w.prop}`)); }
      }
      if (errPages.length) {
        checks.push(mk('schema-incomplete', 'schema', 'high', 'fail', 'Structured Data ขาด required property',
          `${errPages.length} หน้ามี schema ที่ขาด property จำเป็นตามเกณฑ์ Google — จะไม่ได้ rich result. ขาด: ${[...errSet].slice(0, 8).join(', ')}`,
          'เติม property ที่จำเป็นให้ครบ แล้วทดสอบใน Rich Results Test ของ Google',
          pageList(errPages), true));
      } else if (warnPages.length) {
        checks.push(mk('schema-incomplete', 'schema', 'low', 'warn', 'Structured Data ขาด recommended property',
          `${warnPages.length} หน้ามี schema valid แต่ขาด property แนะนำ — rich result จะสมบูรณ์น้อยลง. ขาด: ${[...warnSet].slice(0, 8).join(', ')}`,
          'เติม property แนะนำ (เช่น logo, image, datePublished, sameAs) เพื่อ rich result ที่สมบูรณ์',
          pageList(warnPages), true));
      } else if (anyValidatable) {
        checks.push(mk('schema-incomplete', 'schema', 'high', 'pass', 'Structured Data ครบตามเกณฑ์ Google',
          `schema ที่ตรวจได้ (${[...new Set(okPages.flatMap(p => p.jsonLd.filter(j => j.ok).flatMap(j => validateSchemaNodes([j.data]).types)))].slice(0, 8).join(', ')}) มี required property ครบ`));
      }
    }

    const noOg = okPages.filter(p => !p.metas['og:title'] || !p.metas['og:image']);
    checks.push(noOg.length
      ? mk('og-tags', 'schema', 'med', noOg.length === okPages.length ? 'fail' : 'warn', 'Open Graph ไม่ครบ', `${noOg.length} หน้าไม่มี og:title หรือ og:image — แชร์ใน social/LINE แล้วไม่มีรูป`, 'ใส่ og:title, og:description, og:image (1200×630) ทุกหน้า', pageList(noOg), true)
      : mk('og-tags', 'schema', 'med', 'pass', 'Open Graph ครบ', 'ทุกหน้ามี og:title + og:image'));

    const noTw = okPages.filter(p => !p.metas['twitter:card']);
    if (noTw.length === okPages.length) checks.push(mk('twitter-card', 'schema', 'low', 'warn', 'ไม่มี Twitter Card', 'แชร์บน X/Twitter จะไม่มี preview สวย', 'ใส่ twitter:card = summary_large_image', [], true));
  }

  // ════════ 4. LINKS ════════
  {
    // เสียจริง = ชี้ไปหน้า 404/410 (ถาวร) · 429/403/5xx = ตรวจไม่ติดชั่วคราว/บล็อกบอท → info ไม่กระทบคะแนน
    const brokenGone = site.brokenLinks.filter(b => b.status === 404 || b.status === 410);
    const brokenSoft = site.brokenLinks.filter(b => b.status >= 400 && !(b.status === 404 || b.status === 410));
    checks.push(brokenGone.length
      ? mk('broken-links', 'links', 'high', 'fail', 'ลิงก์ภายในเสีย (broken links)', `พบ ${brokenGone.length} ลิงก์ชี้ไปหน้าที่หายจริง (404/410)`, 'แก้หรือลบลิงก์ที่เสีย', brokenGone.map(b => `${b.to} (${b.status}) ← จาก ${b.from}`), false)
      : mk('broken-links', 'links', 'high', 'pass', 'ไม่พบลิงก์ภายในเสีย', `ตรวจลิงก์ภายในจาก ${okPages.length} หน้า`));
    if (brokenSoft.length) checks.push(mk('broken-links-soft', 'links', 'low', 'info', 'บางลิงก์ตรวจไม่ติดตอน crawl (อาจชั่วคราว/บล็อกบอท)', `${brokenSoft.length} ลิงก์ตอบ ${[...new Set(brokenSoft.map(b => b.status))].join(', ')} (429 rate-limit / 403 บล็อกบอท / 5xx) — ไม่กระทบคะแนน ควรตรวจซ้ำเพื่อยืนยัน`, 'ถ้าตรวจซ้ำยัง error = ลิงก์เสียจริงต้องแก้', brokenSoft.map(b => `${b.to} (${b.status})`)));

    const emptyAnchor = [];
    okPages.forEach(p => { const n = p.links.filter(l => !l.text && !/img/i.test(l.href)).length; if (n > 0) emptyAnchor.push({ url: p.url, n }); });
    if (emptyAnchor.length) checks.push(mk('empty-anchor', 'links', 'med', 'warn', 'ลิงก์ที่ไม่มี anchor text', `${emptyAnchor.reduce((s, x) => s + x.n, 0)} ลิงก์ใน ${emptyAnchor.length} หน้า — เสียสัญญาณ relevance และ accessibility`, 'ใส่ข้อความหรือ aria-label ให้ทุกลิงก์', emptyAnchor.map(x => `${x.url} (${x.n} ลิงก์)`)));

    const genericWords = /^(คลิกที่นี่|อ่านต่อ|ดูเพิ่มเติม|click here|read more|learn more|more|here)$/i;
    const generic = [];
    okPages.forEach(p => { const n = p.links.filter(l => genericWords.test(l.text)).length; if (n > 2) generic.push({ url: p.url, n }); });
    if (generic.length) checks.push(mk('generic-anchor', 'links', 'low', 'warn', 'anchor text แบบ generic เยอะ', `"คลิกที่นี่ / read more" ไม่บอก search engine ว่าหน้าปลายทางเกี่ยวกับอะไร`, 'เปลี่ยนเป็นข้อความที่มีคีย์เวิร์ดของหน้าปลายทาง', generic.map(x => x.url)));

    const fewInternal = okPages.filter(p => p.links.filter(l => { const n2 = l.href.startsWith('/') || l.href.includes(new URL(site.origin).hostname); return n2; }).length < 3);
    if (fewInternal.length) checks.push(mk('internal-links-few', 'links', 'med', 'warn', 'หน้าที่มี internal link น้อย', `${fewInternal.length} หน้ามีลิงก์ภายในน้อยกว่า 3 — โครงสร้างเว็บบาง, link equity ไหลไม่ทั่ว`, 'เพิ่ม internal links เชื่อมหน้าที่เกี่ยวข้องกัน', pageList(fewInternal)));
  }

  // ════════ 5. IMAGES ════════
  {
    // img-alt 3-state (มาตรฐาน enterprise/a11y) — ลด false positive จากรูปที่คนมองไม่เห็น:
    //   FAIL    = รูปที่ "มองเห็นจริง" แต่ไม่มี alt attribute เลย → เสีย SEO + accessibility แน่นอน
    //   WARNING = รูปที่มองเห็นจริงแต่ alt="" → อ้างเป็นรูปประดับ ต้องเปิดดูยืนยันว่าใช่จริง (ไม่ใช่รูปเนื้อหา)
    //   PASS    = alt มีความหมาย / มี aria-label / role=presentation / รูปที่ถูกซ่อน (ไม่ต้องมี alt)
    //   ข้าม    = รูปที่ไม่โชว์ (display:none / visibility:hidden / 0px / aria-hidden) — Google/AI ไม่สนใจ
    // ใช้ "รูปที่มองเห็นจริง" จาก rendered DOM (p.imageVis) เมื่อมี · ถ้าไม่มี → heuristic จาก raw HTML (เดิม)
    let totalImg = 0, missingAlt = 0, emptyAlt = 0, usedRender = false;
    const missingPages = [], emptyPages = [];
    okPages.forEach(p => {
      if (Array.isArray(p.imageVis) && p.imageVis.length) {
        usedRender = true;
        const shown = p.imageVis.filter(i => i.visible && !i.ariaHidden);
        totalImg += shown.length;
        const cand = shown.filter(i => !i.labeled);        // มี aria-label/role=presentation = ผ่าน
        const miss = cand.filter(i => i.alt == null).length;   // โชว์จริง + ไม่มี alt attribute → FAIL
        const empt = cand.filter(i => i.alt === '').length;    // โชว์จริง + alt="" → WARNING
        missingAlt += miss; emptyAlt += empt;
        if (miss) missingPages.push(`${p.url} (${miss} รูป)`);
        if (empt) emptyPages.push(`${p.url} (${empt} รูป)`);
      } else {
        const imgs = p.images.filter(i => i.src);
        totalImg += imgs.length;
        const miss = imgs.filter(i => i.labeled != null ? !i.labeled : i.alt == null).length;
        missingAlt += miss;
        if (miss) missingPages.push(`${p.url} (${miss}/${imgs.length} รูป)`);
      }
    });
    if (totalImg > 0) {
      const srcNote = usedRender ? ' (ตรวจจากรูปที่แสดงจริงบนหน้าเว็บ)' : '';
      // Evidence-Based: confidence ขึ้นกับว่าใช้ rendered DOM (เห็นรูปจริง) หรือ heuristic จาก raw HTML
      // และเคส alt="" จงใจให้ confidence ต่ำ = ซื่อสัตย์ว่าต้องเปิดดูยืนยันว่าเป็นรูปประดับจริง ไม่ฟันธง
      const imgSignals = { visible_images: totalImg, missing_alt: missingAlt, empty_alt: emptyAlt, used_rendered_dom: usedRender };
      const imgStd = 'WCAG 2.1 §1.1.1 Non-text Content · Google Image SEO best practices';
      if (missingAlt > 0) {
        const pct = Math.round(missingAlt / totalImg * 100);
        const extra = emptyAlt ? ` · อีก ${emptyAlt} รูปใช้ alt="" (รูปประดับ — ควรเปิดดูยืนยัน)` : '';
        const c = mk('img-alt', 'images', 'med', pct > 50 ? 'fail' : 'warn', 'รูปที่ไม่มี alt text', `${missingAlt}/${totalImg} รูป (${pct}%) ไม่มี alt — เสียโอกาส Google Images และ accessibility${extra}${srcNote}`, 'ใส่ alt บรรยายรูปสั้นๆ มีคีย์เวิร์ดเมื่อเกี่ยวข้อง', missingPages, true);
        c.confidence = usedRender ? 0.9 : 0.7;
        c.reasoning = { signals: imgSignals, standard: imgStd, verdict: pct > 50 ? 'fail' : 'warn' };
        checks.push(c);
      } else if (emptyAlt > 0) {
        const c = mk('img-alt', 'images', 'low', 'warn', 'รูปที่ใช้ alt="" (ควรยืนยันว่าเป็นรูปประดับ)', `${emptyAlt}/${totalImg} รูปที่แสดงจริงใช้ alt="" — ถ้าเป็นรูปประดับ (ไอคอน/เส้นคั่น) ถูกแล้ว แต่ถ้าเป็นรูปเนื้อหา (โลโก้/สินค้า/ภาพข่าว) ควรใส่คำอธิบาย${srcNote}`, 'เปิดหน้าเว็บดู: รูปที่สื่อความหมายต้องมี alt บรรยาย · รูปประดับล้วนๆ ใช้ alt="" ได้', emptyPages, true);
        c.confidence = usedRender ? 0.6 : 0.45;   // ambiguous โดยธรรมชาติ — ต้องคนยืนยัน
        c.reasoning = { signals: imgSignals, standard: imgStd, verdict: 'warn-needs-human' };
        checks.push(c);
      } else {
        const c = mk('img-alt', 'images', 'med', 'pass', 'รูปมี alt text ครบ', `${totalImg} รูปที่แสดงจริงมี alt ครบ${srcNote}`);
        c.confidence = usedRender ? 0.92 : 0.75;
        c.reasoning = { signals: imgSignals, standard: imgStd, verdict: 'pass' };
        checks.push(c);
      }
      let rawTotalImg = 0;
      okPages.forEach(p => { rawTotalImg += p.images.filter(i => i.src).length; });
      let noLazy = 0;
      okPages.forEach(p => { noLazy += p.images.filter(i => i.src && !i.loading).length; });
      if (noLazy > rawTotalImg * 0.7 && rawTotalImg > 5)
        checks.push(mk('img-lazy', 'images', 'low', 'warn', 'รูปส่วนใหญ่ไม่มี lazy loading', `${noLazy}/${rawTotalImg} รูปไม่มี loading="lazy" — โหลดหนักตอนเปิดหน้า`, 'ใส่ loading="lazy" กับรูปใต้ fold', [], true));
      let noDim = 0;
      okPages.forEach(p => { noDim += p.images.filter(i => i.src && (!i.width || !i.height)).length; });
      if (noDim > rawTotalImg * 0.5 && rawTotalImg > 5)
        checks.push(mk('img-dimensions', 'images', 'low', 'warn', 'รูปไม่ระบุ width/height', `${noDim}/${rawTotalImg} รูป — ทำให้เกิด layout shift (CLS แย่)`, 'ระบุ width/height ทุกรูป', []));
    }
  }

  // ════════ 6. PERFORMANCE ════════
  {
    const bigHtml = okPages.filter(p => p.htmlBytes > 500_000);
    if (bigHtml.length) checks.push(mk('html-size', 'performance', 'med', 'warn', 'HTML ใหญ่เกินไป', `${bigHtml.length} หน้าใหญ่กว่า 500KB`, 'ลด inline data/SVG, แยก critical CSS', pageList(bigHtml)));

    const manyScripts = okPages.filter(p => p.scripts.length > 25);
    if (manyScripts.length) checks.push(mk('script-count', 'performance', 'med', 'warn', 'สคริปต์เยอะเกินไป', `${manyScripts.length} หน้าโหลดมากกว่า 25 ไฟล์ JS (สูงสุด ${Math.max(...manyScripts.map(p => p.scripts.length))} ไฟล์) — กระทบ LCP/INP โดยเฉพาะบน 4G`, 'รวม bundle, ใช้ defer/async, ตัด third-party ที่ไม่จำเป็น', pageList(manyScripts)));

    const noCompress = okPages.filter(p => !p.headers['content-encoding']);
    if (noCompress.length === okPages.length && okPages.length > 0)
      checks.push(mk('compression', 'performance', 'med', 'warn', 'ไม่ได้เปิด compression', 'ไม่พบ header content-encoding (gzip/brotli) ในทุกหน้าที่ตรวจ — การเปิด compression ช่วยลดขนาดที่ต้องดาวน์โหลดและทำให้หน้าโหลดเร็วขึ้น (บางกรณี header อาจถูก proxy/CDN ตัด — ตรวจยืนยันที่ฝั่ง origin)', 'เปิด brotli หรือ gzip ที่ web server/CDN', [], true));
    else checks.push(mk('compression', 'performance', 'med', 'pass', 'เปิด compression แล้ว', `ใช้ ${[...new Set(okPages.map(p => p.headers['content-encoding']).filter(Boolean))].join(', ')}`));

    const slow = okPages.filter(p => p.elapsed > 3000);
    if (slow.length) checks.push(mk('ttfb-slow', 'performance', 'med', 'warn', 'หน้าที่ตอบช้า', `${slow.length} หน้าใช้เวลาเกิน 3 วินาที`, 'ตรวจ hosting/cache/database query', slow.map(p => `${p.url} (${(p.elapsed / 1000).toFixed(1)}s)`)));

    const bigInline = okPages.filter(p => p.inlineScriptBytes + p.inlineStyleBytes > 200_000);
    if (bigInline.length) checks.push(mk('inline-bloat', 'performance', 'low', 'warn', 'inline script/style ใหญ่มาก', `${bigInline.length} หน้ามี inline JS/CSS รวมเกิน 200KB — มักเป็น hydration payload ของ SPA`, 'ลด payload หรือใช้ partial hydration', pageList(bigInline)));
  }

  // ════════ 7. SECURITY HEADERS ════════
  if (home) {
    const h = home.headers;
    const sec = [
      ['strict-transport-security', 'HSTS', 'บังคับ HTTPS กันคนถูก downgrade attack', 'Strict-Transport-Security: max-age=31536000; includeSubDomains'],
      ['x-content-type-options', 'X-Content-Type-Options', 'กัน MIME sniffing', 'X-Content-Type-Options: nosniff'],
      ['x-frame-options', 'X-Frame-Options / CSP frame-ancestors', 'กัน clickjacking', 'X-Frame-Options: SAMEORIGIN'],
      ['referrer-policy', 'Referrer-Policy', 'คุมข้อมูล referrer ที่หลุดออก', 'Referrer-Policy: strict-origin-when-cross-origin'],
    ];
    const missing = sec.filter(([key]) => !h[key] && !(key === 'x-frame-options' && /frame-ancestors/.test(h['content-security-policy'] || '')));
    checks.push(missing.length
      ? mk('security-headers', 'security', 'low', 'warn', 'Security headers ไม่ครบ', `ขาด: ${missing.map(m => m[1]).join(', ')} — ไม่กระทบอันดับโดยตรง แต่สะท้อนคุณภาพเว็บและความเชื่อมั่น`, 'เพิ่ม headers: ' + missing.map(m => m[3]).join(' | '), [], true)
      : mk('security-headers', 'security', 'low', 'pass', 'Security headers ครบ', 'HSTS, nosniff, frame protection, referrer policy ครบ'));
  }

  // ════════ 8. JS RENDERING (raw vs rendered) ════════
  {
    const spa = okPages.filter(p => p.emptyRoot);
    const fw = home ? Object.entries(home.frameworkMarkers || {}).filter(([, v]) => v).map(([k]) => k) : [];
    if (spa.length) {
      checks.push(mk('spa-shell', 'rendering', 'high', 'fail', 'หน้าเว็บเป็น SPA เปลือกเปล่า (client-side render เท่านั้น)',
        `${spa.length}/${okPages.length} หน้ามี root container ว่างใน HTML ดิบ${fw.length ? ` (framework: ${fw.join(', ')})` : ''} — เนื้อหา, H1, ลิงก์ ไม่อยู่ใน HTML ดิบ · Googlebot ยัง render ได้ในรอบสอง (ช้ากว่าและไม่เสถียรเท่า) แต่ AI bot (GPTBot, ClaudeBot, PerplexityBot) ปัจจุบันไม่รัน JS จึงมีแนวโน้มสูงที่จะเห็นเนื้อหาไม่ครบ`,
        'เปิด SSR (Nuxt: ssr:true / Next: ใช้ server components) หรือ pre-render เป็น static HTML — ช่วยทั้ง AI search และความเสถียรของการ index ฝั่ง Google', pageList(spa)));
    } else if (fw.length) {
      checks.push(mk('spa-shell', 'rendering', 'high', 'pass', 'ใช้ JS framework แต่ render ฝั่ง server แล้ว', `พบ ${fw.join(', ')} แต่เนื้อหาอยู่ใน HTML ดิบครบ — ดีมาก`));
    } else {
      checks.push(mk('spa-shell', 'rendering', 'high', 'pass', 'เนื้อหาอยู่ใน HTML ดิบครบ', 'crawler และ AI bot เห็นเนื้อหาทันทีไม่ต้อง render JS'));
    }

    if (site.rendered?.available) {
      const diffs = [];
      for (const [url, r] of Object.entries(site.rendered.pages)) {
        if (r.error) continue;
        const raw = okPages.find(p => (p.finalUrl || p.url) === url);
        if (!raw) continue;
        const rawH1 = raw.headings.filter(h => h.tag === 'h1').length;
        const txtRatio = raw.textLength / Math.max(r.textLength, 1);
        if ((r.h1?.length || 0) > rawH1 || txtRatio < 0.5 || (r.title && r.title !== raw.title)) {
          diffs.push(`${url} — raw: H1=${rawH1}, text=${raw.textLength} ตัวอักษร | rendered: H1=${r.h1?.length || 0}, text=${r.textLength} (เนื้อหา ${Math.round((1 - txtRatio) * 100)}% โผล่หลัง render เท่านั้น)`);
        }
      }
      checks.push(diffs.length
        ? mk('render-diff', 'rendering', 'high', 'fail', 'หลักฐาน: เนื้อหาต่างกันระหว่าง raw กับ rendered', `เทียบด้วย headless Chrome แล้วพบความต่างชัดเจน — สิ่งที่ Googlebot รอบแรกเห็น ≠ สิ่งที่ผู้ใช้เห็น`, 'เปิด SSR/pre-render เพื่อให้ raw HTML มีเนื้อหาครบ', diffs)
        : mk('render-diff', 'rendering', 'high', 'pass', 'Raw และ rendered ตรงกัน', `เทียบ ${Object.keys(site.rendered.pages).length} หน้าด้วย headless Chrome — เนื้อหาตรงกัน`));
    } else if (site.renderFailedSpa) {
      // SPA แต่ render ไม่สำเร็จทั้ง 2 รอบ (rate-limit/timeout) → ได้แค่ shell เปล่า ผลไม่สมบูรณ์ — เตือนชัด (ไม่ใช่ "ไม่ได้ติดตั้ง")
      checks.push(mk('render-diff', 'rendering', 'high', 'warn', 'render ไม่สำเร็จรอบนี้ — ผลตรวจอาจไม่สมบูรณ์', 'เว็บนี้เป็น SPA (เนื้อหา render ด้วย JS) แต่เปิดด้วย headless Chrome ไม่สำเร็จ (อาจโดน rate-limit/timeout ชั่วคราว) จึงตรวจได้แค่โครงหน้า', 'ตรวจใหม่อีกครั้ง — ถ้ายังล้มซ้ำ แปลว่าเว็บจำกัดบอทเข้มงวด ต้องตรวจตอนคนน้อย'));
    } else if (!site.rendered || site.rendered.skipped === 'worker-relay') {
      // ใช้ raw HTML ผ่าน relay หรือไม่จำเป็นต้อง render (non-SPA เนื้อหาครบ) — ไม่ใช่ปัญหา ไม่ต้องอ้างว่า "ไม่ได้ติดตั้ง"
    } else {
      checks.push(mk('render-diff', 'rendering', 'low', 'info', 'ไม่ได้เทียบ raw vs rendered รอบนี้', 'ระบบจะเทียบ raw vs rendered อัตโนมัติเมื่อ render ได้ (ถ้ารันเองในเครื่องที่ไม่มี Chromium: npm i playwright && npx playwright install chromium)', ''));
    }

    const noNoscript = okPages.filter(p => p.emptyRoot && !p.hasNoscript);
    if (noNoscript.length) checks.push(mk('noscript-fallback', 'rendering', 'low', 'warn', 'SPA ไม่มี noscript fallback', `${noNoscript.length} หน้า`, 'เพิ่มเนื้อหาสรุปใน <noscript> ระหว่างรอแก้ SSR', pageList(noNoscript)));
  }

  // ════════ 9. DEEP CHECKS — ชุดตรวจเชิงลึก ════════
  {
    // charset ไม่ใช่ UTF-8 — เว็บไทยเก่าหลายเจ้าใช้ windows-874/TIS-620
    const nonUtf8 = okPages.filter(p => p.detectedCharset && !/^utf-?8$/i.test(p.detectedCharset));
    if (nonUtf8.length) {
      const charsets = [...new Set(nonUtf8.map(p => p.detectedCharset))].join(', ');
      checks.push(mk('charset-not-utf8', 'technical', 'med', 'warn',
        'Encoding ไม่ใช่ UTF-8',
        `${nonUtf8.length} หน้าใช้ ${charsets} — Google แนะนำ UTF-8 เป็น encoding หลัก; อาจทำให้ข้อความแสดงผิดเพี้ยนในบางบริบทและ indexing ไม่สมบูรณ์`,
        'เปลี่ยน server/CMS ให้ serve ด้วย UTF-8 และเพิ่ม <meta charset="UTF-8"> เป็นบรรทัดแรกใน <head>',
        pageList(nonUtf8), true));
    }

    // doctype
    const noDoctype = okPages.filter(p => p.hasDoctype === false);
    if (noDoctype.length) checks.push(mk('doctype-missing', 'onpage', 'low', 'warn', 'ไม่มี <!DOCTYPE html>', `${noDoctype.length} หน้า — เบราว์เซอร์เข้า quirks mode ผล render เพี้ยนได้`, 'เพิ่ม <!DOCTYPE html> บรรทัดแรกของทุกหน้า', pageList(noDoctype), true));

    // deprecated tags
    const oldTags = okPages.filter(p => p.deprecatedTags > 0);
    if (oldTags.length) checks.push(mk('deprecated-tags', 'onpage', 'low', 'warn', 'ใช้ HTML tag ที่เลิกใช้แล้ว', `${oldTags.length} หน้ามี <font>/<center>/<marquee> — สัญญาณเว็บเก่าไม่ดูแล`, 'เปลี่ยนเป็น CSS สมัยใหม่', pageList(oldTags)));

    // meta refresh
    const refresh = okPages.filter(p => p.metaRefresh);
    if (refresh.length) checks.push(mk('meta-refresh', 'index', 'med', 'warn', 'ใช้ meta refresh redirect', `${refresh.length} หน้า — Google ไม่แนะนำ ใช้ 301 แทน`, 'เปลี่ยนเป็น server-side 301 redirect', pageList(refresh)));

    // canonical ผิดรูปแบบ
    const multiCanon = okPages.filter(p => p.canonicalCount > 1);
    if (multiCanon.length) checks.push(mk('canonical-multiple', 'index', 'high', 'fail', 'มี canonical หลายอันในหน้าเดียว', `${multiCanon.length} หน้า — Google จะทิ้งทั้งหมดเมื่อขัดแย้งกัน`, 'เหลือ canonical เดียวต่อหน้า', pageList(multiCanon), true));
    const relCanon = okPages.filter(p => p.canonical && !/^https?:\/\//.test(p.canonical));
    if (relCanon.length) checks.push(mk('canonical-relative', 'index', 'low', 'warn', 'canonical เป็น relative URL', `${relCanon.length} หน้า — ควรเป็น absolute URL เต็มเพื่อกันความกำกวม`, 'ใช้ URL เต็ม https://... ใน canonical', pageList(relCanon), true));

    // H1 ซ้ำข้ามหน้า
    const h1Map = new Map();
    okPages.forEach(p => { const h1 = p.headings.find(h => h.tag === 'h1')?.text; if (h1) h1Map.set(h1, [...(h1Map.get(h1) || []), p.url]); });
    const dupH1 = [...h1Map.entries()].filter(([, v]) => v.length > 1);
    if (dupH1.length) {
      const c = mk('h1-duplicate', 'onpage', 'med', 'warn', 'H1 ซ้ำกันหลายหน้า', `พบ H1 ซ้ำ ${dupH1.length} ค่า (รวม ${dupH1.reduce((s, [, v]) => s + v.length, 0)} หน้า) — ดูด้านล่างว่าค่าไหนซ้ำที่หน้าใดบ้าง`, 'H1 ควรเฉพาะของแต่ละหน้าเหมือน title', dupH1.flatMap(([, v]) => v), true);
      c.groups = dupH1.map(([value, pages]) => ({ value, pages }));
      checks.push(c);
    }

    // heading ว่างเปล่า
    const emptyH = okPages.filter(p => p.emptyHeadings > 0);
    if (emptyH.length) checks.push(mk('empty-headings', 'onpage', 'low', 'warn', 'มี heading ว่างเปล่า', `${emptyH.length} หน้ามี h1–h6 ที่ไม่มีข้อความ — มักเกิดจาก template`, 'ลบ heading เปล่าหรือใส่ข้อความ', pageList(emptyH)));

    // URL hygiene
    // เน้นเฉพาะที่กระทบ SEO จริง: ตัวพิมพ์ใหญ่ใน path หรือ URL ยาวผิดปกติ
    // (ตัด underscore + parameter เยอะ ออก — เป็นเรื่องปกติ/ถูกต้องตามใช้งาน ไม่ใช่ปัญหา SEO)
    const badUrl = okPages.filter(p => {
      try { const u = new URL(p.url); return /[A-Z]/.test(u.pathname) || u.pathname.length > 115; } catch { return false; }
    });
    if (badUrl.length) checks.push(mk('url-hygiene', 'onpage', 'low', 'warn', 'URL ไม่เป็นมิตรกับ SEO', `${badUrl.length} หน้ามีตัวพิมพ์ใหญ่ใน path หรือ URL ยาวเกินไป`, 'ใช้ตัวพิมพ์เล็ก คั่นด้วย hyphen สั้นกระชับ', pageList(badUrl)));

    // trailing slash duplicates
    const pathSet = new Map(okPages.map(p => { try { const u = new URL(p.url); return [u.origin + u.pathname, p.url]; } catch { return [p.url, p.url]; } }));
    const slashDups = [];
    for (const p of okPages) {
      try {
        const u = new URL(p.url);
        const alt = u.pathname.endsWith('/') && u.pathname !== '/' ? u.origin + u.pathname.slice(0, -1) : u.origin + u.pathname + '/';
        if (pathSet.has(alt) && pathSet.get(alt) !== p.url) slashDups.push(`${p.url} ↔ ${pathSet.get(alt)}`);
      } catch {}
    }
    if (slashDups.length) checks.push(mk('trailing-slash', 'index', 'med', 'warn', 'URL ซ้ำจาก trailing slash', `${Math.ceil(slashDups.length / 2)} คู่ตอบ 200 ทั้งแบบมีและไม่มี / ท้าย — duplicate content`, 'redirect 301 ให้เหลือรูปแบบเดียว + canonical', [...new Set(slashDups)].slice(0, 20)));

    // third-party scripts
    const hostOf = (u, base) => { try { return new URL(u, base).hostname; } catch { return ''; } };
    const originHost = (() => { try { return new URL(site.origin).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    const tp = okPages.map(p => ({ url: p.url, n: [...new Set(p.scripts.map(s => hostOf(s, p.url)).filter(h => h && !h.endsWith(originHost)))].length }));
    const heavyTp = tp.filter(x => x.n > 8);
    if (heavyTp.length) checks.push(mk('third-party', 'performance', 'med', 'warn', 'Third-party scripts เยอะเกินไป', `${heavyTp.length} หน้าโหลดสคริปต์จากโดเมนภายนอกมากกว่า 8 โดเมน (สูงสุด ${Math.max(...heavyTp.map(x => x.n))}) — แต่ละตัวหน่วง INP และเป็นความเสี่ยง privacy`, 'ตัด tracker ที่ไม่ใช้ โหลดที่เหลือแบบ defer/lazy', heavyTp.map(x => `${x.url} (${x.n} โดเมน)`)));

    // render-blocking ใน head
    const blockJs = okPages.filter(p => p.headBlockingScripts > 2);
    if (blockJs.length) checks.push(mk('head-blocking', 'performance', 'med', 'warn', 'สคริปต์ block การ render ใน <head>', `${blockJs.length} หน้ามี <script src> ใน head เกิน 2 ตัวโดยไม่มี defer/async — เบราว์เซอร์ต้องหยุดรอทุกตัว`, 'เพิ่ม defer ให้ทุกสคริปต์ใน head หรือย้ายลงท้าย body', pageList(blockJs), true));

    // text-to-HTML ratio
    const lowRatio = okPages.filter(p => p.htmlBytes > 60_000 && !p.emptyRoot && p.textLength / p.htmlBytes < 0.08);
    if (lowRatio.length) checks.push(mk('text-ratio', 'performance', 'low', 'warn', 'สัดส่วนเนื้อหาต่อโค้ดต่ำมาก', `${lowRatio.length} หน้ามีข้อความจริงไม่ถึง 8% ของ HTML — โค้ดบวมเกิน`, 'ลด markup ที่ไม่จำเป็น แยก CSS/JS ออกจากไฟล์', pageList(lowRatio)));

    // copyright เก่า
    const nowYear = new Date().getFullYear();
    const stale = okPages.filter(p => p.maxCopyrightYear && p.maxCopyrightYear < nowYear - 1);
    if (stale.length) checks.push(mk('copyright-stale', 'onpage', 'low', 'warn', 'ปี copyright เก่า', `${stale.length} หน้าแสดงปี ${[...new Set(stale.map(p => p.maxCopyrightYear))].join(', ')} — สัญญาณ "เว็บร้าง" ต่อทั้งผู้ใช้และ AI`, 'อัปเดตเป็นปีปัจจุบันอัตโนมัติด้วยโค้ด', pageList(stale), true));

    // meta keywords (ล้าสมัย)
    const mkw = okPages.filter(p => p.metas['keywords']);
    if (mkw.length) checks.push(mk('meta-keywords', 'onpage', 'low', 'info', 'มี meta keywords (ไม่มีผลแล้ว)', `${mkw.length} หน้า — Google เลิกใช้ตั้งแต่ 2009 ไม่เสียหายแต่ไม่ควรไปลงแรงกับมัน`, '', pageList(mkw)));

    // near-duplicate content (Jaccard)
    const cand = okPages.filter(p => p.wordCount > 100 && !p.emptyRoot).slice(0, 60);
    const sets = cand.map(p => new Set((p.textSample || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2)));
    const dupPairs = [];
    for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) {
      const a = sets[i], b = sets[j];
      if (a.size < 30 || b.size < 30) continue;
      let inter = 0; for (const w of a) if (b.has(w)) inter++;
      const jac = inter / (a.size + b.size - inter);
      if (jac > 0.85) dupPairs.push(`${cand[i].url} ↔ ${cand[j].url} (เหมือนกัน ~${Math.round(jac * 100)}%)`);
    }
    if (dupPairs.length) checks.push(mk('near-duplicate', 'index', 'med', 'warn', 'เนื้อหาเกือบซ้ำกันระหว่างหน้า', `${dupPairs.length} คู่มีเนื้อหาเหมือนกันเกิน 85% — Google เลือก index แค่หน้าเดียวและอาจเลือกผิดหน้า`, 'รวมหน้าเข้าด้วยกัน + 301 หรือเขียนเนื้อหาให้ต่างกันจริง', dupPairs.slice(0, 20)));

    // orphan pages (ไม่มีลิงก์ภายในชี้เข้า)
    const inlinks = new Map();
    for (const p of okPages) for (const l of (p.links || [])) {
      const n = normalizeUrl(l.href, p.finalUrl || p.url);
      if (n) inlinks.set(n, (inlinks.get(n) || 0) + 1);
    }
    const orphans = okPages.filter(p => p.url !== site.startUrl && !inlinks.has(p.url) && !inlinks.has(p.finalUrl));
    if (orphans.length) checks.push(mk('orphan-pages', 'links', 'med', 'warn', 'หน้า orphan (ไม่มีลิงก์ภายในชี้เข้า)', `${orphans.length} หน้าเข้าถึงได้จาก sitemap เท่านั้น — ได้ link equity เป็นศูนย์ อันดับขึ้นยาก`, 'เพิ่มลิงก์จากเมนู/หน้าเกี่ยวข้องชี้เข้าหาหน้าเหล่านี้', pageList(orphans)));

    // origin variants (www/https รวมร่างถูกไหม)
    if (site.variants?.length) {
      const live = site.variants.filter(v => v.status === 200 && v.finalOrigin !== site.origin);
      // แยก "ตายจริง" (DNS ไม่มี/cert พัง/refused/5xx = ผู้ใช้เข้าไม่ได้แน่นอน) ออกจาก "ตรวจไม่ติดชั่วคราว"
      // probe variant ไม่ retry → timeout ครั้งเดียว = สรุปไม่ได้ (อาจเน็ตเซิร์ฟเวอร์เราเอง) → ไม่ลงโทษคะแนน กันคะแนนเด้งจาก noise
      const definiteFail = (v) => v.status >= 500 || (v.status === 0 && /ENOTFOUND|getaddrinfo|ECONNREFUSED|ERR_TLS|CERT|SELF_SIGNED|UNABLE_TO_|DEPTH_ZERO|altname/i.test(v.error || ''));
      const trulyDead = site.variants.filter(definiteFail);
      const shaky = site.variants.filter(v => v.status === 0 && !definiteFail(v)); // timeout/unknown = ตรวจไม่ติดชั่วคราว ไม่ฟันธง
      // ถ้าหน้าส่วนใหญ่มี rel=canonical อยู่แล้ว Google มักรวม host variants ให้ (canonical ชี้โดเมนหลัก) → ลดเป็น warn ไม่ฟันธง "แบ่งคะแนน"
      const wellCanon = okPages.length && okPages.filter(p => p.canonical).length >= okPages.length * 0.8;
      if (live.length) checks.push(mk('host-variants', 'index', wellCanon ? 'med' : 'high', wellCanon ? 'warn' : 'fail',
        wellCanon ? 'โดเมนหลายเวอร์ชันตอบ 200 (มี canonical ช่วยรวมอยู่)' : 'โดเมนหลายเวอร์ชันตอบ 200 พร้อมกัน',
        `${live.map(v => v.variant).join(', ')} ไม่ได้ 301 มาที่ ${site.origin}` + (wellCanon
          ? ` — แต่หน้าส่วนใหญ่มี rel=canonical อยู่แล้ว ถ้า canonical ชี้โดเมนหลักถูกต้องและ variant ส่ง canonical เดียวกัน Google มักรวมให้ (ควรยืนยัน) — วิธีชัวร์สุดยังคือ 301`
          : ` — ถ้าไม่มี 301 หรือ canonical ที่ถูกต้อง Google อาจมองเป็นคนละเว็บและแบ่งสัญญาณกันเอง`),
        'ตั้ง 301 redirect ทุก variant (http/https, www/non-www) มาที่เวอร์ชันหลักเดียว (ชัดเจนสุด) หรืออย่างน้อยต้องมี rel=canonical ชี้โดเมนหลักทุกหน้า', live.map(v => `${v.variant} → ${v.finalOrigin} (${v.status})`)));
      else if (trulyDead.length) checks.push(mk('host-variants', 'index', 'med', 'warn', 'บาง variant ของโดเมนเข้าไม่ได้',
        `${trulyDead.map(v => v.variant).join(', ')} เข้าไม่ได้ (DNS/certificate/server error) — ผู้ใช้ที่พิมพ์ www (หรือไม่พิมพ์) จะเข้าเว็บไม่ได้`,
        'ชี้ DNS + certificate ให้ครบทุก variant แล้ว 301 มาที่หลัก', trulyDead.map(v => `${v.variant} (${v.status || v.error || 'error'})`)));
      else checks.push(mk('host-variants', 'index', 'high', 'pass', 'www/https variants รวมร่างถูกต้อง',
        shaky.length
          ? `ทุกเวอร์ชัน redirect ถูกต้อง · หมายเหตุ: ${shaky.map(v => v.variant).join(', ')} ตรวจไม่ติดชั่วคราว (timeout) — ไม่กระทบคะแนน ควรลองเปิดเองอีกครั้งเพื่อยืนยัน`
          : 'ทุกเวอร์ชัน redirect มาที่ origin หลักเดียว'));
    }

    // favicon.ico ตอบ 200 ไหม
    if (site.faviconStatus >= 400) checks.push(mk('favicon-file', 'onpage', 'low', 'warn', '/favicon.ico ตอบ ' + site.faviconStatus, 'เบราว์เซอร์และ crawler บางตัวเรียกไฟล์นี้ตรงๆ เสมอ', 'วางไฟล์ favicon.ico ที่ root', [], true));

    // sitemap lastmod
    if (site.sitemapUrls.length && !site.sitemapHasLastmod)
      checks.push(mk('sitemap-lastmod', 'index', 'low', 'warn', 'sitemap ไม่มี <lastmod>', 'Google ใช้ lastmod ตัดสินใจว่าจะ crawl หน้าไหนซ้ำ — ไม่มีแล้วหน้าอัปเดตถูกเก็บช้า', 'เพิ่ม lastmod ที่อัปเดตจริงทุก URL', [], true));

    // og:image ต้องเป็น absolute
    const relOg = okPages.filter(p => p.metas['og:image'] && !/^https?:\/\//.test(p.metas['og:image']));
    if (relOg.length) checks.push(mk('og-image-relative', 'schema', 'low', 'warn', 'og:image เป็น relative URL', `${relOg.length} หน้า — Facebook/LINE ต้องการ absolute URL รูปจะไม่ขึ้นตอนแชร์`, 'ใช้ URL เต็ม https://... ใน og:image', pageList(relOg), true));
  }

  attachEvidence(checks, site.pages || []);
  return { checks, categories: CATS, pagesAnalyzed: okPages.length };
}
