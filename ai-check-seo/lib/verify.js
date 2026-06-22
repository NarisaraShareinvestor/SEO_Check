// lib/verify.js — ตรวจสอบว่า audit ของเรา "ตรงกับผู้ตัดสินอิสระ" ไหม
// หลักการ: ห้ามใช้ engine ตัดสิน engine → เทียบกับ Google Lighthouse (เรนเดอร์จริง + เป็นเกณฑ์ของ Google เอง)
// ดึง Lighthouse SEO/Accessibility category จาก PageSpeed API (ใช้ PAGESPEED_API_KEY ที่มีอยู่)
const PSI = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// ดึงคำตัดสินของ Lighthouse ต่อ "ข้อเท็จจริงรายหน้า" (score 1=ผ่าน, 0=ตก, null=ไม่เกี่ยว)
export async function fetchLighthouse(url, key, strategy = 'mobile') {
  const cats = 'category=seo&category=accessibility&category=best-practices';
  const api = `${PSI}?url=${encodeURIComponent(url)}&strategy=${strategy}&${cats}${key ? `&key=${key}` : ''}`;
  const res = await fetch(api);
  const d = await res.json();
  if (d.error) return { error: d.error.message || 'psi-error' };
  const lr = d.lighthouseResult || {};
  const A = lr.audits || {};
  const verdict = (id) => !A[id] ? 'n/a' : (A[id].score === null ? 'n/a' : (A[id].score >= 0.9 ? 'pass' : 'fail'));
  return {
    finalUrl: lr.finalUrl || url,
    seoScore: lr.categories?.seo ? Math.round(lr.categories.seo.score * 100) : null,
    a11yScore: lr.categories?.accessibility ? Math.round(lr.categories.accessibility.score * 100) : null,
    audits: {
      title: verdict('document-title'),
      description: verdict('meta-description'),
      canonical: verdict('canonical'),
      hreflang: verdict('hreflang'),
      imageAlt: verdict('image-alt'),
      viewport: verdict('viewport'),
      lang: verdict('html-has-lang'),
      crawlable: verdict('is-crawlable'),
      robotsTxt: verdict('robots-txt'),
      httpStatus: verdict('http-status-code'),
      linkText: verdict('link-text'),
    },
  };
}

// แต่ละมิติ: (Lighthouse audit, ค่าของเรา) — ใช้ rendered fact ก่อน (กัน SPA ทำให้ raw เพี้ยนจาก LH ที่ render)
function ourVerdicts(audit) {
  const pages = (audit.pages || []).filter(p => p.status === 200);
  const home = pages.find(p => { try { return new URL(p.finalUrl || p.url).pathname === '/'; } catch { return false; } }) || pages[0] || {};
  const checkFail = (id) => { const c = (audit.checks || []).find(x => x.id === id); return c ? (c.status === 'fail' || c.status === 'warn') : null; };
  const has = (v) => v ? 'pass' : 'fail';
  return {
    title: has((home.renderedTitle || home.title || '').trim()),
    description: has((home.renderedDescription || home.description || '').trim()),
    canonical: has(home.canonical),
    imageAlt: home.imagesNoAlt != null ? has(home.imagesNoAlt === 0) : 'n/a',
    httpStatus: has(home.status === 200),
    // มิติที่เก็บรายหน้าไม่ครบ → ใช้คำตัดสินระดับ check ของทั้งเว็บแทน (fail check = เราฟันธงว่ามีปัญหา)
    viewport: checkFail('viewport-missing') == null ? 'n/a' : (checkFail('viewport-missing') ? 'fail' : 'pass'),
    lang: checkFail('lang-missing') == null ? 'n/a' : (checkFail('lang-missing') ? 'fail' : 'pass'),
    hreflang: checkFail('hreflang') == null ? 'n/a' : (checkFail('hreflang') ? 'fail' : 'pass'),
    robotsTxt: (checkFail('robots-missing') || checkFail('robots-blocks-all') || checkFail('robots-blocks-section')) ? 'fail' : 'pass',
    crawlable: home.noindex ? 'fail' : 'pass',
  };
}

// FACT = ข้อเท็จจริง objective (เราใช้ rendered fact เทียบ LH-rendered) → ต่าง = น่าจะบั๊ก extraction ของเรา
// CRITERIA = เราเช็คต่าง/เข้มกว่า LH (hreflang/robots/crawlable) หรือ raw-vs-rendered (viewport/lang บน SPA) → ต่างได้
const FACT_DIMS = ['title', 'description', 'canonical', 'imageAlt', 'httpStatus'];
const CRITERIA_DIMS = ['hreflang', 'robotsTxt', 'crawlable', 'viewport', 'lang'];

// เทียบ → ตรง/ไม่ตรง ต่อมิติ + อัตราความตรงเฉพาะ FACT (= สัญญาณความแม่นจริง)
export function crossCheck(audit, lh) {
  const ours = ourVerdicts(audit);
  const rows = [];
  for (const d of [...FACT_DIMS, ...CRITERIA_DIMS]) {
    const o = ours[d], l = lh.audits?.[d];
    if (o === 'n/a' || l === 'n/a' || l == null) continue; // เทียบเฉพาะที่ทั้งสองฝ่ายมีคำตัดสิน
    rows.push({ dim: d, kind: FACT_DIMS.includes(d) ? 'fact' : 'criteria', ours: o, lighthouse: l, agree: o === l });
  }
  const facts = rows.filter(r => r.kind === 'fact');
  const factAgree = facts.filter(r => r.agree).length;
  // ธงเตือน admin: FACT ไม่ตรงกับ Google = อาจตรวจผิด ต้องรีวิวก่อนส่งลูกค้า
  const factMismatches = facts.filter(r => !r.agree).map(r => `${r.dim}(เรา:${r.ours}/Google:${r.lighthouse})`);
  return {
    rows, seoScore: lh.seoScore, a11yScore: lh.a11yScore,
    factComparable: facts.length, factAgree, factPct: facts.length ? Math.round(factAgree / facts.length * 100) : null,
    factMismatches,
    flag: factMismatches.length > 0, // true = ควรรีวิวก่อนส่งลูกค้า
    criteria: rows.filter(r => r.kind === 'criteria' && !r.agree).map(r => `${r.dim}(เรา:${r.ours}/Google:${r.lighthouse})`),
  };
}
