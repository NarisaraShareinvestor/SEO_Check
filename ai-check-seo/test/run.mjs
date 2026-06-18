// Golden Fixture Test Runner
// ──────────────────────────────────────────────────────────────────────
// ป้อน fixture HTML (ที่จงใจฝังปัญหาที่รู้คำตอบแน่นอน) ผ่าน rule engine จริง
// (crawler.extractPageData + checks.runChecks) แล้ว assert ผลตรงกับที่ "คน
// ประกาศไว้ล่วงหน้า" — ไม่ใช่ derive จาก regex ใหม่ จึงหลุดกับดักวงกลม
//
// รัน:  npm test        (offline, deterministic, ~0.3s)
// exit code 1 ถ้ามีข้อไหนไม่ตรง → ใช้เป็น regression gate ได้
// ──────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPageData, decodeHtmlFromResponse, parseRobots, crawlSite } from '../lib/crawler.js';
import { runChecks } from '../lib/checks.js';
import { validateSchemaNodes } from '../lib/schema-validate.js';
import { guardAiAnalysis } from '../lib/ai.js';
import { applyHeadFix, validatePageHtml } from '../lib/pagefix.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const FIX = join(DIR, 'fixtures');

// สร้าง site object ที่ "สุขภาพดี" เป็น baseline — fixture แต่ละอันจะ override
// เฉพาะส่วนที่จงใจทำพัง ทำให้ check อื่นไม่ false-fire ปนมา
function healthySite(page, { origin = 'https://example.com', siteOverrides = {} } = {}) {
  const robotsTxt = `User-agent: *\nDisallow:\nSitemap: ${origin}/sitemap.xml`;
  return {
    startUrl: origin + '/',
    origin,
    https: origin.startsWith('https://'),
    robots: parseRobots(robotsTxt),
    robotsTxt,
    robotsStatus: 200,
    sitemaps: [origin + '/sitemap.xml'],
    sitemapUrls: [page.url],
    sitemapHasLastmod: true,
    pages: [page],
    fetchErrors: [],
    brokenLinks: [],
    faviconStatus: 200,
    notFoundHandling: { ok: true, status: 404 },
    rendered: { available: false, pages: {} },
    variants: [],
    ...siteOverrides,
  };
}

function pageFromFixture(file, url, pageOverrides = {}) {
  const html = readFileSync(join(FIX, file), 'utf8');
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
  const page = extractPageData(html, url, headers, 200, 100, []);
  return { ...page, ...pageOverrides };
}

// ── Manifest: ground truth ที่ "คน" ประกาศไว้ ──────────────────────────
// expect:  checkId → status ที่ต้องได้ (pass|warn|fail)
// absent:  checkId ที่ต้อง "ไม่โผล่" (กัน false-positive / cross-contamination)
const FIXTURES = [
  {
    name: 'หน้าสะอาด — ต้องไม่มี false positive',
    file: 'clean.html', url: 'https://example.com/clean',
    expect: {},
    absent: ['h1-multiple', 'h1-hidden', 'charset-not-utf8', 'robots-meta-invalid', 'hreflang'],
  },
  {
    name: 'H1 abuse (6 ตัว/หน้า) → ต้อง FAIL',
    file: 'h1-abuse.html', url: 'https://example.com/h1-abuse',
    expect: { 'h1-multiple': 'fail' },
    absent: ['h1-hidden', 'charset-not-utf8', 'robots-meta-invalid'],
  },
  {
    name: 'H1 ซ่อนด้วย visibility:hidden → ต้อง WARN',
    file: 'hidden-h1.html', url: 'https://example.com/hidden-h1',
    expect: { 'h1-hidden': 'warn' },
    absent: ['h1-multiple', 'charset-not-utf8', 'robots-meta-invalid'],
  },
  {
    name: 'หลายภาษาผ่าน ?language= ใน sitemap แต่ไม่มี hreflang → ต้อง WARN',
    file: 'hreflang-query.html', url: 'https://example.com/home',
    siteOverrides: { sitemapUrls: ['https://example.com/home?language=en', 'https://example.com/home?language=th'] },
    expect: { 'hreflang': 'warn' },
    absent: ['h1-multiple', 'h1-hidden', 'charset-not-utf8', 'robots-meta-invalid'],
  },
  {
    name: 'meta robots = "nodiy,noodp" → ต้อง WARN',
    file: 'robots-nodiy.html', url: 'https://example.com/robots-nodiy',
    expect: { 'robots-meta-invalid': 'warn' },
    absent: ['h1-multiple', 'h1-hidden', 'charset-not-utf8'],
  },
  {
    name: 'charset windows-874 (page.detectedCharset) → ต้อง WARN',
    file: 'clean.html', url: 'https://example.com/charset-874',
    pageOverrides: { detectedCharset: 'windows-874' },
    expect: { 'charset-not-utf8': 'warn' },
    absent: ['h1-multiple', 'h1-hidden', 'robots-meta-invalid'],
  },
  {
    name: 'schema ครบตามเกณฑ์ Google → schema-incomplete PASS',
    file: 'schema-valid.html', url: 'https://example.com/schema-valid',
    expect: { 'schema-incomplete': 'pass' },
    absent: ['h1-multiple', 'h1-hidden', 'robots-meta-invalid', 'charset-not-utf8'],
  },
  {
    name: 'Product/Offer ขาด price + FAQ ขาด answer → schema-incomplete FAIL',
    file: 'schema-incomplete.html', url: 'https://example.com/schema-incomplete',
    expect: { 'schema-incomplete': 'fail' },
    absent: ['h1-multiple', 'h1-hidden', 'robots-meta-invalid'],
  },
];

// ── Runner ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function assert(cond, label, detail = '') {
  if (cond) { passed++; }
  else { failed++; failures.push({ label, detail }); }
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  GOLDEN FIXTURE TEST — rule engine จริง (offline)');
console.log('══════════════════════════════════════════════════════════════\n');

for (const fx of FIXTURES) {
  const page = pageFromFixture(fx.file, fx.url, fx.pageOverrides || {});
  const site = healthySite(page, { siteOverrides: fx.siteOverrides });
  const { checks } = runChecks(site);
  const byId = Object.fromEntries(checks.map(c => [c.id, c]));

  console.log(`▸ ${fx.name}`);

  for (const [id, want] of Object.entries(fx.expect)) {
    const got = byId[id]?.status;
    const ok = got === want;
    assert(ok, `${fx.file} :: ${id}`, `คาดหวัง "${want}" แต่ได้ "${got ?? '(ไม่โผล่)'}"`);
    console.log(`    ${ok ? '✅' : '❌'} ${id} = ${got ?? '(absent)'}  (want ${want})`);
  }
  for (const id of (fx.absent || [])) {
    const got = byId[id]?.status;
    const ok = got === undefined;
    assert(ok, `${fx.file} :: ${id} ต้องไม่โผล่`, `แต่กลับโผล่เป็น "${got}"`);
    if (!ok) console.log(`    ❌ ${id} ไม่ควรโผล่ แต่ได้ "${got}"`);
  }
  console.log('');
}

// ── Byte-level decode test: windows-874 (ต้นเหตุ richsport.co.th) ────────
console.log('▸ decode byte-level: windows-874 → ข้อความไทยต้องไม่เพี้ยน');
{
  // bytes 0xA1 0xA2 0xA3 0xA4 ใน TIS-620/windows-874 = "กขฃค"
  const head = Buffer.from('<html><body>', 'latin1');
  const thai = Buffer.from([0xA1, 0xA2, 0xA3, 0xA4]);
  const tail = Buffer.from('</body></html>', 'latin1');
  const buf = Buffer.concat([head, thai, tail]);
  const fakeRes = {
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'text/html; charset=windows-874' : '') },
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
  const { html, charset } = await decodeHtmlFromResponse(fakeRes);
  const okCharset = charset === 'windows-874';
  const okThai = html.includes('กขฃค');
  assert(okCharset, 'decode :: charset detect', `ได้ "${charset}"`);
  assert(okThai, 'decode :: Thai text', `ถอดได้: "${html.replace(/<[^>]+>/g, '')}"`);
  console.log(`    ${okCharset ? '✅' : '❌'} charset = ${charset}`);
  console.log(`    ${okThai ? '✅' : '❌'} ข้อความไทยถอดถูก: "${html.replace(/<[^>]+>/g, '')}"`);
  console.log('');
}

// ── Schema validator unit tests (เทียบเกณฑ์ Google ตรงๆ ระดับ node) ─────
console.log('▸ schema validator: required/recommended ตามเกณฑ์ Google');
{
  // Offer ขาด priceCurrency → error
  const r1 = validateSchemaNodes([{ '@type': 'Offer', price: '100' }]);
  const e1 = r1.errors.some(e => e.prop === 'priceCurrency');
  assert(e1, 'schema :: Offer ขาด priceCurrency', JSON.stringify(r1.errors));
  console.log(`    ${e1 ? '✅' : '❌'} Offer ขาด priceCurrency → error`);

  // AggregateRating ขาดทั้ง reviewCount และ ratingCount → error
  const r2 = validateSchemaNodes([{ '@type': 'AggregateRating', ratingValue: '4.5' }]);
  const e2 = r2.errors.some(e => e.prop.includes('reviewCount'));
  assert(e2, 'schema :: AggregateRating ขาด count', JSON.stringify(r2.errors));
  console.log(`    ${e2 ? '✅' : '❌'} AggregateRating ขาด reviewCount|ratingCount → error`);

  // LocalBusiness subtype (Restaurant) → ใช้กฎ LocalBusiness, ขาด address → error
  const r3 = validateSchemaNodes([{ '@type': 'Restaurant', name: 'ร้านอาหาร' }]);
  const e3 = r3.errors.some(e => e.prop === 'address');
  assert(e3, 'schema :: Restaurant ใช้กฎ LocalBusiness', JSON.stringify(r3.errors));
  console.log(`    ${e3 ? '✅' : '❌'} Restaurant (subtype) ขาด address → error`);

  // Organization ครบ required + recommended → ไม่มี error/warning
  const r4 = validateSchemaNodes([{ '@type': 'Organization', name: 'X', url: 'https://x.com', logo: 'https://x.com/l.png', sameAs: ['https://fb.com/x'] }]);
  const e4 = r4.errors.length === 0 && r4.warnings.length === 0 && r4.hasValidatableType;
  assert(e4, 'schema :: Organization สมบูรณ์', `errors=${r4.errors.length} warnings=${r4.warnings.length}`);
  console.log(`    ${e4 ? '✅' : '❌'} Organization ครบ → ไม่มี error/warning`);

  // @graph + nested type → ต้องเดินเข้าไปเจอ
  const r5 = validateSchemaNodes([{ '@graph': [{ '@type': 'Product', name: 'P', offers: { '@type': 'Offer', price: '1' } }] }]);
  const e5 = r5.errors.some(e => e.type === 'Offer' && e.prop === 'priceCurrency');
  assert(e5, 'schema :: เดินเข้า @graph + nested Offer', JSON.stringify(r5.errors));
  console.log(`    ${e5 ? '✅' : '❌'} @graph + nested Offer ตรวจเจอ`);

  // type ที่ไม่รู้จัก → ไม่ false-positive
  const r6 = validateSchemaNodes([{ '@type': 'SomethingWeird', foo: 'bar' }]);
  const e6 = r6.errors.length === 0 && r6.warnings.length === 0 && !r6.hasValidatableType;
  assert(e6, 'schema :: type ไม่รู้จัก ไม่ false-positive', JSON.stringify(r6));
  console.log(`    ${e6 ? '✅' : '❌'} type ไม่รู้จัก → เงียบ`);
  console.log('');
}

// ── Layer 3: AI guardrail (กัน AI กุปัญหา / อ้าง check ที่ไม่มี) ─────────
console.log('▸ AI guardrail: ตัด priority ที่อ้าง check ผิด');
{
  const fakeAudit = {
    checks: [
      { id: 'h1-multiple', status: 'fail' },
      { id: 'canonical-missing', status: 'fail' },
      { id: 'https', status: 'pass' },
    ],
  };
  const aiOutput = {
    executiveSummary: 'สรุป',
    topPriorities: [
      { rank: 1, checkId: 'h1-multiple', title: 'H1 เยอะ' },        // valid issue → keep
      { rank: 2, checkId: 'made-up-check', title: 'ปัญหาที่กุขึ้น' }, // hallucinated → drop
      { rank: 3, checkId: 'https', title: 'HTTPS' },                 // pass → drop (กุปัญหาที่ไม่มี)
      { rank: 4, checkId: 'canonical-missing', title: 'canonical' }, // valid issue → keep
    ],
  };
  const g = guardAiAnalysis(aiOutput, fakeAudit);
  const keptOk = g.topPriorities.length === 2 && g.topPriorities.every(p => ['h1-multiple', 'canonical-missing'].includes(p.checkId));
  assert(keptOk, 'guardrail :: เก็บเฉพาะ valid issue', JSON.stringify(g.topPriorities.map(p => p.checkId)));
  console.log(`    ${keptOk ? '✅' : '❌'} เก็บเฉพาะ check ที่มีจริง+เป็นปัญหา (${g.topPriorities.map(p => p.checkId).join(', ')})`);

  const hallOk = g._guardrail.droppedHallucinated.includes('made-up-check');
  assert(hallOk, 'guardrail :: จับ hallucinated id', JSON.stringify(g._guardrail));
  console.log(`    ${hallOk ? '✅' : '❌'} จับ checkId ที่กุขึ้น: ${g._guardrail.droppedHallucinated.join(', ')}`);

  const nonIssueOk = g._guardrail.droppedNonIssue.includes('https');
  assert(nonIssueOk, 'guardrail :: จับ check ที่ status=pass', JSON.stringify(g._guardrail));
  console.log(`    ${nonIssueOk ? '✅' : '❌'} จับ check ที่ผ่านแล้ว (AI กุปัญหา): ${g._guardrail.droppedNonIssue.join(', ')}`);

  // จัด rank ใหม่ต่อเนื่อง 1,2 หลังตัด
  const rankOk = g.topPriorities.map(p => p.rank).join(',') === '1,2';
  assert(rankOk, 'guardrail :: re-rank หลังตัด', g.topPriorities.map(p => p.rank).join(','));
  console.log(`    ${rankOk ? '✅' : '❌'} จัดอันดับใหม่ต่อเนื่อง: ${g.topPriorities.map(p => p.rank).join(',')}`);

  // output ปกติ (ไม่มี hallucination) → _guardrail.ok = true
  const clean = guardAiAnalysis({ topPriorities: [{ rank: 1, checkId: 'h1-multiple' }] }, fakeAudit);
  const cleanOk = clean._guardrail.ok === true;
  assert(cleanOk, 'guardrail :: output สะอาด → ok=true', JSON.stringify(clean._guardrail));
  console.log(`    ${cleanOk ? '✅' : '❌'} output สะอาด → _guardrail.ok = true`);
  console.log('');
}

// ── Layer 3: determinism — rule engine ต้องให้ผลเดิมเป๊ะทุกครั้ง ─────────
console.log('▸ determinism: runChecks ซ้ำต้องได้ผลเหมือนเดิม 100%');
{
  const snap = () => {
    const page = pageFromFixture('h1-abuse.html', 'https://example.com/h1-abuse');
    const { checks } = runChecks(healthySite(page, {}));
    return checks.map(c => `${c.id}:${c.status}:${c.severity}`).sort().join('|');
  };
  const a = snap(), b = snap(), c = snap();
  const deterministic = a === b && b === c;
  assert(deterministic, 'determinism :: 3 รัน identical', deterministic ? '' : 'ผลต่างกันระหว่างรัน!');
  console.log(`    ${deterministic ? '✅' : '❌'} รัน 3 ครั้งได้ผล identical (${a.split('|').length} checks)`);
  console.log('');
}

// ── Surgical patcher: แก้ head ได้จริง + คง body 100% (deterministic) ────
console.log('▸ surgical patcher: patch head + คง body เดิม');
{
  const heavy = `<!DOCTYPE html><html><head><title>เดิม</title></head>` +
    `<body><h1>หัวข้อ</h1>` + '<p>เนื้อหาภาษาไทยยาวๆ ที่ต้องคงไว้ทั้งหมด</p>'.repeat(40) +
    `<img src="/img/hero-house.jpg"><img src="/img/icon.svg" alt="ไอคอน"></body></html>`;
  const beforeText = validatePageHtml(heavy, 'https://ex.com/p');

  const fix = {
    title: 'บ้านเดี่ยวคุณภาพ ทำเลดี | Example',
    metaDescription: 'ค้นหาบ้านเดี่ยวคุณภาพบนทำเลศักยภาพ พร้อมข้อมูลครบ ราคา โปรโมชั่น และแบบบ้านให้เลือกครบในที่เดียว',
    canonical: 'https://ex.com/p',
    lang: 'th',
    og: { title: 'บ้านเดี่ยว', description: 'บ้านคุณภาพ', image: 'https://ex.com/og.jpg', url: 'https://ex.com/p' },
    twitterCard: 'summary_large_image',
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'Organization', name: 'Example', url: 'https://ex.com', logo: 'https://ex.com/l.png' }],
    imageAlts: { 'hero-house': 'บ้านเดี่ยวตัวอย่างหน้าโครงการ' },
  };
  const patched = applyHeadFix(heavy, fix, 'https://ex.com/p');
  const after = validatePageHtml(patched, 'https://ex.com/p');

  const afterIds = new Set(after.map(i => i.id));
  // head issues ที่ต้องหายไป
  const fixedHead = ['title-length', 'desc', 'canonical', 'og-title', 'og-image', 'jsonld', 'twitter-card'].every(id => !afterIds.has(id));
  assert(fixedHead, 'surgical :: head issues หาย', [...afterIds].join(','));
  console.log(`    ${fixedHead ? '✅' : '❌'} head fixed (title/desc/canonical/og/jsonld/twitter)`);

  // body ต้องคงครบ (จำนวน <p> + ข้อความเดิม)
  const bodyKept = patched.includes('เนื้อหาภาษาไทยยาวๆ') && (patched.match(/<p>/g) || []).length === 40 && patched.includes('<h1>หัวข้อ</h1>');
  assert(bodyKept, 'surgical :: body คงครบ', `p count=${(patched.match(/<p>/g)||[]).length}`);
  console.log(`    ${bodyKept ? '✅' : '❌'} body คงเดิม 100% (40 <p> + H1 + ข้อความ)`);

  // alt เติมเฉพาะรูปที่ match + ไม่ทับ alt เดิม
  const altOk = patched.includes('alt="บ้านเดี่ยวตัวอย่างหน้าโครงการ"') && patched.includes('alt="ไอคอน"');
  assert(altOk, 'surgical :: เติม alt ถูกรูป ไม่ทับของเดิม', '');
  console.log(`    ${altOk ? '✅' : '❌'} เติม alt รูป hero + คง alt เดิมของ icon`);

  // valid JSON-LD ที่ inject ต้อง parse ผ่าน
  const ldOk = /application\/ld\+json/.test(patched);
  assert(ldOk, 'surgical :: inject JSON-LD', '');
  console.log(`    ${ldOk ? '✅' : '❌'} inject Organization JSON-LD`);
  console.log('');
}

// ── relay 526 → direct fallback (stub fetch, ไม่แตะเน็ตจริง) ───────────────
// พิสูจน์: เมื่อ Cloudflare Worker relay รายงาน x-ps 52x (TLS/origin flake)
// crawler ต้อง fall back ไป fetch ตรง แล้วตรวจได้ปกติ — กัน regression อาการ VGI 526
{
  console.log('▸ relay 52x → direct fallback');
  const RELAY = 'https://fake-worker.example.workers.dev';
  const prevProxy = process.env.CRAWL_PROXY;
  process.env.CRAWL_PROXY = RELAY;
  const HTML = '<!doctype html><html lang="th"><head><title>VGI Test</title>' +
    '<meta name="description" content="หน้าทดสอบ fallback"></head>' +
    '<body><h1>VGI</h1><a href="/th/contact">ติดต่อ</a></body></html>';
  let relayCalls = 0, directCalls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === RELAY && init.method === 'POST') {
      relayCalls++;
      return new Response('cf 526', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'x-ps': '526' } });
    }
    directCalls++;
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /admin', { status: 200, headers: { 'content-type': 'text/plain' } });
    if (url.endsWith('/llms.txt') || url.endsWith('/sitemap.xml') || url.endsWith('/favicon.ico')) return new Response('', { status: 404 });
    return new Response(HTML, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } });
  };
  try {
    const site = await crawlSite('https://investor.vgi.co.th/th/home', { maxPages: 3, onProgress: () => {} });
    const analyzed = runChecks(site).pagesAnalyzed;
    const statuses = [...new Set(site.pages.map(p => p.status))];
    const okStatus = statuses.length === 1 && statuses[0] === 200;
    assert(relayCalls > 0, 'fallback :: relay ถูกเรียกก่อน', `relayCalls=${relayCalls}`);
    assert(directCalls > 0, 'fallback :: fall back ไป direct', `directCalls=${directCalls}`);
    assert(okStatus, 'fallback :: ทุกหน้าได้ 200 หลัง fallback', `statuses=${JSON.stringify(statuses)}`);
    assert(analyzed >= 1, 'fallback :: ตรวจได้อย่างน้อย 1 หน้า', `pagesAnalyzed=${analyzed}`);
    console.log(`    ${relayCalls > 0 ? '✅' : '❌'} relay ถูกเรียก (${relayCalls})`);
    console.log(`    ${directCalls > 0 ? '✅' : '❌'} fall back ไป direct (${directCalls})`);
    console.log(`    ${okStatus ? '✅' : '❌'} ทุกหน้า 200 หลัง fallback`);
    console.log(`    ${analyzed >= 1 ? '✅' : '❌'} ตรวจได้ ${analyzed} หน้า\n`);
  } finally {
    globalThis.fetch = realFetch;
    if (prevProxy === undefined) delete process.env.CRAWL_PROXY; else process.env.CRAWL_PROXY = prevProxy;
  }
}

// ── Summary ─────────────────────────────────────────────────────────────
console.log('══════════════════════════════════════════════════════════════');
if (failed === 0) {
  console.log(`  ✅ ผ่านทั้งหมด ${passed}/${passed} assertion`);
  console.log('══════════════════════════════════════════════════════════════\n');
  process.exit(0);
} else {
  console.log(`  ❌ ไม่ผ่าน ${failed}/${passed + failed} assertion`);
  console.log('──────────────────────────────────────────────────────────────');
  for (const f of failures) console.log(`  • ${f.label}\n    ${f.detail}`);
  console.log('══════════════════════════════════════════════════════════════\n');
  process.exit(1);
}
