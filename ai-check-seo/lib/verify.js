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

// ── ประเภท check (ตาม roadmap): deterministic (parser) / rule (เกณฑ์) / ai (ประเมิน) ──
const CHECK_TYPE = {
  // deterministic — parser ตรวจ มี/ไม่มี (ความเชื่อมั่นสูงสุด)
  'title-missing': 'deterministic', 'desc-missing': 'deterministic', 'h1-missing': 'deterministic',
  'canonical-missing': 'deterministic', 'jsonld-missing': 'deterministic', 'schema-org': 'deterministic',
  'schema-breadcrumb': 'deterministic', 'geo-faq-schema': 'deterministic', 'geo-entity': 'deterministic',
  'robots-missing': 'deterministic', 'robots-blocks-all': 'deterministic', 'robots-blocks-section': 'deterministic',
  'sitemap-exists': 'deterministic', 'sitemap-coverage': 'deterministic', 'sitemap-lastmod': 'deterministic',
  'viewport-missing': 'deterministic', 'viewport-noscale': 'deterministic', 'lang-missing': 'deterministic',
  'favicon-missing': 'deterministic', 'hreflang': 'deterministic', 'og-tags': 'deterministic', 'twitter-card': 'deterministic',
  'geo-llms-txt': 'deterministic', 'geo-bot-access': 'deterministic', 'security-headers': 'deterministic',
  'charset-not-utf8': 'deterministic', 'spa-shell': 'deterministic', 'soft-404': 'deterministic', 'noscript-fallback': 'deterministic',
  'jsonld-invalid': 'deterministic', 'schema-incomplete': 'deterministic', 'robots-meta-invalid': 'deterministic', 'canonical-self': 'deterministic',
  // rule — เกณฑ์/threshold
  'title-length': 'rule', 'title-duplicate': 'rule', 'desc-length': 'rule', 'desc-duplicate': 'rule',
  'content-thin': 'rule', 'near-duplicate': 'rule', 'text-ratio': 'rule', 'h1-multiple': 'rule', 'h1-hidden': 'rule',
  'heading-order': 'rule', 'img-alt': 'rule', 'broken-links': 'rule', 'internal-links-few': 'rule',
  'orphan-pages': 'rule', 'cwv-score': 'rule', 'render-diff': 'rule', 'copyright-stale': 'rule',
  // ai assessment — ดุลพินิจ (แสดงเป็น Assessment/Opportunity ไม่ใช่ Error)
  'geo-eeat': 'ai', 'geo-citable': 'ai', 'geo-qa-content': 'ai', 'geo-trust-pages': 'ai', 'geo-spa-risk': 'ai',
};
const typeOf = (c) => CHECK_TYPE[c.id] || ({ schema: 'deterministic', index: 'deterministic', security: 'deterministic', geo: 'ai', performance: 'rule', images: 'rule', links: 'rule' }[c.category]) || 'rule';
const BASE_CONF = { deterministic: 0.97, rule: 0.88, ai: 0.65 };
// check ↔ มิติของ Lighthouse (ไว้ boost/ลด confidence เมื่อ Google ยืนยัน/ขัดแย้ง)
const CHECK_TO_DIM = { 'title-missing': 'title', 'title-length': 'title', 'title-duplicate': 'title', 'desc-missing': 'description', 'desc-length': 'description', 'desc-duplicate': 'description', 'canonical-missing': 'canonical', 'img-alt': 'imageAlt' };

// ใส่ _type / _confidence / _needsVerify ให้ทุก check (อิงผล cross-check Google)
export function annotateChecks(audit) {
  const v = audit.verify;
  const dimAgree = {}; // dim -> true/false จากผล Lighthouse
  if (v?.rows) for (const r of v.rows) dimAgree[r.dim] = r.agree;
  let needs = 0; const byType = { deterministic: 0, rule: 0, ai: 0 };
  for (const c of audit.checks || []) {
    const t = typeOf(c); byType[t] = (byType[t] || 0) + 1;
    let conf = BASE_CONF[t] ?? 0.85, needsVerify = false;
    const dim = CHECK_TO_DIM[c.id];
    if (dim && dim in dimAgree) {
      if (dimAgree[dim]) conf = Math.max(conf, 0.99);       // Google ยืนยันตรงกับเรา
      else { conf = 0.5; needsVerify = true; }              // Google ขัดแย้ง → ต้องรีวิว
    }
    // SPA: check ที่อิง raw HTML แต่เว็บ render ด้วย JS → ความเชื่อมั่นลดลงเล็กน้อย (raw อาจไม่ใช่ภาพจริง)
    c._type = t; c._confidence = Math.round(conf * 100); c._needsVerify = needsVerify;
    if (needsVerify) needs++;
  }
  return { byType, needsVerify: needs };
}
