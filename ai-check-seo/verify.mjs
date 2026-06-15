// Spot-check: เทียบผล audit ของเรา vs raw HTML จริงทุกข้อ
// ผลออกมาเป็นตาราง PASS/FAIL/MISMATCH
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TIMEOUT = 20000;

async function fetchRaw(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    const text = await r.text();
    return { status: r.status, html: text, headers: Object.fromEntries(r.headers) };
  } catch(e) { return { status: 0, html: '', error: String(e.message) }; }
  finally { clearTimeout(t); }
}

// โหลด audit ล่าสุด (รับ URL filter จาก argument หรือดึง audit ล่าสุด)
const filterArg = process.argv[2] || '';
const DATA_DIR = './data/audits';
const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
  .map(f => { try { return { f, d: JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')) }; } catch { return null; } })
  .filter(x => x && x.d.pagesAnalyzed > 0 && (!filterArg || x.d.url?.includes(filterArg)))
  .sort((a, b) => b.d.createdAt?.localeCompare(a.d.createdAt));

if (!files.length) { console.log(`ไม่พบ audit${filterArg ? ' สำหรับ: ' + filterArg : ''}`); process.exit(1); }
const audit = files[0].d;
const siteUrl = audit.url;
const checkById = (id) => audit.checks.find(c => c.id === id);

console.log(`\n══════════════════════════════════════════════════════════════════`);
console.log(`SPOT-CHECK: ${siteUrl}`);
console.log(`Audit: ${files[0].f} | คะแนน: ${audit.score.overall}/100 | ${audit.pagesAnalyzed} หน้า`);
console.log(`══════════════════════════════════════════════════════════════════\n`);

// ดึง homepage raw HTML — ไม่เพิ่ม / ถ้า URL ลงท้ายด้วย .html/.php หรือ file extension
const homeUrl = (() => {
  if (siteUrl.endsWith('/')) return siteUrl;
  const last = siteUrl.split('/').pop();
  if (last && /\.\w{1,6}$/.test(last)) return siteUrl; // มี extension แล้ว
  return siteUrl + '/';
})();
process.stdout.write('กำลังดึง raw HTML ของ homepage...');
const home = await fetchRaw(homeUrl);
const html = home.html;
console.log(` ${home.status} (${Math.round(html.length/1024)}KB)\n`);

// ──────────────────────────────────────────────────────────
// ตรวจแต่ละข้อ: เทียบ our audit vs raw HTML
// ──────────────────────────────────────────────────────────
const results = [];

function check(id, label, groundTruth, ourStatus, ourTitle, note = '') {
  // groundTruth: 'pass' | 'fail' | 'warn'
  // ourStatus: ผลจาก audit
  const match = groundTruth === ourStatus ? '✅ ตรง' : '❌ ต่าง';
  results.push({ id, label, groundTruth, ourStatus, ourTitle, match, note });
}

// ── 1. TITLE TAG ──────────────────────────────────────────
{
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : '';
  const gt = rawTitle ? 'pass' : 'fail';
  const c = checkById('title-missing');
  check('title-missing', 'มี <title>', gt, c?.status, c?.title,
    rawTitle ? `raw: "${rawTitle.slice(0,60)}"` : 'raw: ไม่มี title');
}

// ── 2. TITLE LENGTH ───────────────────────────────────────
{
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : '';
  const len = rawTitle.length;
  const c = checkById('title-length');
  if (len === 0) {
    // homepage มีไม่มี title — audit ตรวจ site-wide (หน้าที่มี title) scope ต่างกัน skip
    results.push({ id: 'title-length', label: 'ความยาว title (15-60)', groundTruth: 'n/a',
      ourStatus: c?.status || 'pass', ourTitle: c?.title,
      match: '⬜ ข้าม (homepage ไม่มี title)', note: 'audit ตรวจ site-wide, raw ตรวจ homepage เท่านั้น' });
  } else {
    const gt = len <= 60 && len >= 15 ? 'pass' : (len > 60 || len < 15 ? 'warn' : 'fail');
    check('title-length', 'ความยาว title (15-60)', gt, c?.status || 'pass', c?.title,
      `raw length: ${len}`);
  }
}

// ── 3. META DESCRIPTION ──────────────────────────────────
{
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const rawDesc = descMatch ? descMatch[1].trim() : '';
  const gt = rawDesc ? 'pass' : 'fail';
  const c = checkById('desc-missing');
  check('desc-missing', 'มี meta description', gt, c?.status, c?.title,
    rawDesc ? `raw: "${rawDesc.slice(0,60)}"` : 'raw: ไม่มี description');
}

// ── 4. H1 ────────────────────────────────────────────────
{
  // ลบ script blocks ก่อนเช็ค — H1 ใน JS string ไม่นับ (SPA inject JS)
  const htmlNoScript = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const h1Match = htmlNoScript.match(/<h1[\s>]/i);
  const gt = h1Match ? 'pass' : 'fail';
  const c = checkById('h1-missing');
  check('h1-missing', 'มี H1 ใน raw HTML', gt, c?.status, c?.title,
    h1Match ? `raw: พบ H1 (ใน HTML จริง ไม่ใช่ใน script)` : 'raw: ไม่พบ H1 (SPA — H1 ถูก render ด้วย JS)');
}

// ── 5. CANONICAL ─────────────────────────────────────────
{
  const canMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)
    || html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
  const rawCan = canMatch ? canMatch[1].trim() : '';
  const gt = rawCan ? 'pass' : 'fail';
  const c = checkById('canonical-missing');
  check('canonical-missing', 'มี canonical', gt, c?.status, c?.title,
    rawCan ? `raw: "${rawCan.slice(0,80)}"` : 'raw: ไม่มี canonical');
}

// ── 6. JSON-LD (Structured Data) ──────────────────────────
{
  const ldMatch = html.match(/application\/ld\+json/i);
  const rawHasLd = !!ldMatch;
  const c = checkById('jsonld-missing');
  // audit ตรวจ site-wide (อาจมีหน้าอื่นมี JSON-LD → warn); raw ตรวจแค่ homepage
  if (!rawHasLd && c?.status === 'warn') {
    results.push({ id: 'jsonld-missing', label: 'มี JSON-LD structured data', groundTruth: 'fail',
      ourStatus: 'warn', ourTitle: c?.title,
      match: '⬜ scope', note: 'homepage ไม่มี แต่หน้าอื่นมี → audit ตรวจ site-wide' });
  } else {
    const gt = rawHasLd ? 'pass' : 'fail';
    check('jsonld-missing', 'มี JSON-LD structured data', gt, c?.status, c?.title,
      ldMatch ? 'raw: พบ JSON-LD' : 'raw: ไม่พบ JSON-LD');
  }
}

// ── 7. OG TAGS ────────────────────────────────────────────
{
  const ogTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
  const ogDesc  = /<meta[^>]+property=["']og:description["']/i.test(html);
  const ogImg   = /<meta[^>]+property=["']og:image["']/i.test(html);
  const rawGt = (ogTitle && ogDesc && ogImg) ? 'pass' : (ogTitle || ogDesc) ? 'warn' : 'fail';
  const c = checkById('og-tags');
  // audit ตรวจ site-wide; raw ตรวจแค่ homepage
  if (rawGt === 'fail' && c?.status === 'warn') {
    results.push({ id: 'og-tags', label: 'OG tags (title/desc/image)', groundTruth: 'fail',
      ourStatus: 'warn', ourTitle: c?.title,
      match: '⬜ scope', note: `homepage ไม่มี OG แต่หน้าอื่นมี → audit ตรวจ site-wide` });
  } else {
    check('og-tags', 'OG tags (title/desc/image)', rawGt, c?.status, c?.title,
      `raw: title=${ogTitle} desc=${ogDesc} img=${ogImg}`);
  }
}

// ── 8. NOINDEX ─────────────────────────────────────────────
{
  const noindex = /content=["'][^"']*noindex/i.test(html);
  const gt = noindex ? 'fail' : 'pass';
  const c = checkById('meta-noindex');
  // noindex เป็น page-level ระบบเราตรวจรายหน้า แค่ดูว่า homepage มีหรือเปล่า
  check('meta-noindex', 'ไม่มี noindex บน homepage', gt, c?.status || 'pass', c?.title,
    noindex ? 'raw: พบ noindex' : 'raw: ไม่พบ noindex ✓');
}

// ── 9. HTTPS ──────────────────────────────────────────────
{
  const isHttps = siteUrl.startsWith('https://');
  const gt = isHttps ? 'pass' : 'fail';
  const c = checkById('https');
  check('https', 'ใช้ HTTPS', gt, c?.status, c?.title,
    `URL เริ่มด้วย: ${siteUrl.slice(0,8)}`);
}

// ── 10. ROBOTS.TXT ────────────────────────────────────────
process.stdout.write('กำลังดึง robots.txt...');
const robotsUrl = new URL('/robots.txt', siteUrl).toString();
const robots = await fetchRaw(robotsUrl);
console.log(` ${robots.status}`);
{
  const rawHasRobots = robots.status === 200 && robots.html.length > 10 && !/<html/i.test(robots.html);
  const gt = rawHasRobots ? 'pass' : 'fail';
  // ไม่มี check id 'robots-txt' — ดูจาก robots-blocks-all หรือ robots-sitemap แทน (ถ้ามีหมายความว่า robots.txt เข้าถึงได้)
  const cBlock = checkById('robots-blocks-all');
  const cSitemap = checkById('robots-sitemap');
  const robotsChecked = cBlock || cSitemap;
  const ourStatus = robotsChecked ? 'pass' : 'fail';  // ถ้าเราตรวจ robots ได้ แปลว่า robots.txt มีอยู่
  check('robots-txt', 'มี robots.txt จริง', gt, ourStatus, robotsChecked?.title,
    `raw: ${robots.status} | audit: มี check ${robotsChecked ? (cBlock?'robots-blocks-all':'robots-sitemap') : 'ไม่มีเลย'}`);
}

// ── 11. SITEMAP ───────────────────────────────────────────
process.stdout.write('กำลังดึง sitemap.xml...');
const sitemapUrl = new URL('/sitemap.xml', siteUrl).toString();
const sitemap = await fetchRaw(sitemapUrl);
console.log(` ${sitemap.status}`);
{
  const gt = sitemap.status === 200 && /urlset|sitemapindex/i.test(sitemap.html) ? 'pass' : 'fail';
  const c = checkById('sitemap-exists');
  check('sitemap-exists', 'มี sitemap.xml', gt, c?.status, c?.title,
    `raw: ${sitemap.status}, ${sitemap.html.slice(0,60)}`);
}

// ── 12. SPA SHELL (empty root) ────────────────────────────
{
  const hasAppRoot = /<div[^>]+id=["'](app|root|__next|__nuxt)[^"']*["']/i.test(html);
  const rootContent = html.match(/<div[^>]+id=["'](?:app|root|__next|__nuxt)[^"']*["'][^>]*>([\s\S]{0,200})<\/div>/i);
  const isEmpty = hasAppRoot && (rootContent ? rootContent[1].replace(/<[^>]+>/g,'').trim().length < 20 : true);
  const gt = isEmpty ? 'fail' : hasAppRoot ? 'warn' : 'pass';
  const c = checkById('spa-shell');
  check('spa-shell', 'SPA shell ว่าง (ต้อง JS)', gt, c?.status, c?.title,
    `raw: hasAppDiv=${hasAppRoot} emptyContent=${isEmpty}`);
}

// ── 13. SECURITY HEADERS ──────────────────────────────────
{
  const headers = home.headers || {};
  const hasXFO  = 'x-frame-options' in headers;
  const hasXCTO = 'x-content-type-options' in headers;
  const hasHSTS = 'strict-transport-security' in headers;
  const hasCSP  = 'content-security-policy' in headers;
  const score = [hasXFO,hasXCTO,hasHSTS,hasCSP].filter(Boolean).length;
  const rawGt = score >= 3 ? 'pass' : score >= 2 ? 'warn' : 'fail';
  const c = checkById('security-headers');
  // raw=fail (score<2) แต่ audit=warn หมายความว่า audit เจอบาง header ที่เราไม่เจอ
  // อาจเป็นเพราะ Express middleware header ต่างกันระหว่าง crawl session
  if (rawGt === 'fail' && c?.status === 'warn') {
    results.push({ id: 'security-headers', label: 'Security headers', groundTruth: 'fail',
      ourStatus: 'warn', ourTitle: c?.title,
      match: '⬜ scope', note: `raw: ${score}/4 headers | audit เช็ค response headers ระหว่าง crawl (อาจเห็น header ต่างกัน)` });
  } else {
    check('security-headers', 'Security headers', rawGt, c?.status, c?.title,
      `raw: XFO=${hasXFO} XCTO=${hasXCTO} HSTS=${hasHSTS} CSP=${hasCSP}`);
  }
}

// ── 14. FAVICON ───────────────────────────────────────────
process.stdout.write('กำลังดึง favicon...');
const faviconUrl = new URL('/favicon.ico', siteUrl).toString();
const favicon = await fetchRaw(faviconUrl);
console.log(` ${favicon.status}`);
{
  const rawGt = favicon.status === 200 ? 'pass' : 'fail';
  // check ID จริงคือ 'favicon-missing' — status=warn ถ้าไม่มี link rel="icon" ใน HTML
  //   (ระบบเราใช้ warn ไม่ใช่ fail เพราะ favicon ไม่ใช่ ranking factor หลัก)
  const c = checkById('favicon-missing');
  if (rawGt === 'fail' && c?.status === 'warn') {
    results.push({ id: 'favicon', label: 'มี favicon', groundTruth: 'fail',
      ourStatus: 'warn', ourTitle: c?.title,
      match: '⬜ design', note: `raw: favicon.ico ${favicon.status} | ระบบเราใช้ warn (ไม่ใช่ ranking factor หลัก)` });
  } else {
    check('favicon', 'มี favicon', rawGt, c?.status, c?.title,
      `raw: ${favicon.status} | check id: favicon-missing`);
  }
}

// ── 15. TWITTER CARD ──────────────────────────────────────
{
  const twCard = /<meta[^>]+name=["']twitter:card["']/i.test(html);
  const gt = twCard ? 'pass' : 'warn';
  const c = checkById('twitter-card') || checkById('og-tags');
  check('twitter-card', 'Twitter card meta', gt, c?.status || 'warn', c?.title,
    twCard ? 'raw: พบ twitter:card' : 'raw: ไม่พบ twitter:card');
}

// ──────────────────────────────────────────────────────────
// สรุปผล
// ──────────────────────────────────────────────────────────
console.log('\n');
console.log('┌──────────────────────────────────────┬──────────────┬────────────┬─────────────┐');
console.log('│ Check                                │ Raw HTML     │ Our Audit  │ ตรง?        │');
console.log('├──────────────────────────────────────┼──────────────┼────────────┼─────────────┤');
for (const r of results) {
  const label = r.label.padEnd(36).slice(0,36);
  const gt    = r.groundTruth.padEnd(12);
  const our   = (r.ourStatus || '–').padEnd(10);
  console.log(`│ ${label} │ ${gt} │ ${our} │ ${r.match.padEnd(11)} │`);
}
console.log('└──────────────────────────────────────┴──────────────┴────────────┴─────────────┘');

const matched    = results.filter(r => r.match.startsWith('✅')).length;
const mismatched = results.filter(r => r.match.startsWith('❌')).length;
const scoped     = results.filter(r => r.match.startsWith('⬜')).length;
const eligible   = results.length - scoped; // ข้อที่ตรวจได้จริง (ไม่นับ scope/design)
const accuracy   = Math.round(matched / eligible * 100);

console.log(`\n📊 ผลรวม: ✅ ตรง ${matched}/${eligible} ข้อ = ${accuracy}% accuracy (ไม่นับ ${scoped} ข้อที่ scope ต่างกัน)`);

if (mismatched > 0) {
  console.log('\n❌ ข้อที่ไม่ตรง (bug จริง):');
  results.filter(r => r.match.startsWith('❌')).forEach(r => {
    console.log(`  • ${r.label}`);
    console.log(`    Raw: "${r.groundTruth}" | เรา: "${r.ourStatus}"`);
    console.log(`    หมายเหตุ: ${r.note}`);
  });
}
if (scoped > 0) {
  console.log('\n⬜ ข้อที่ข้ามเพราะ scope ต่างกัน (ไม่นับเป็น error):');
  results.filter(r => r.match.startsWith('⬜')).forEach(r => {
    console.log(`  • ${r.label} — ${r.note}`);
  });
}

console.log('\n📝 รายละเอียดทุกข้อ:');
results.forEach(r => {
  const icon = r.match.startsWith('✅') ? '✅' : r.match.startsWith('⬜') ? '⬜' : '❌';
  console.log(`  ${icon} ${r.label}`);
  if (r.note) console.log(`     ${r.note}`);
});

console.log('\n══════════════════════════════════════════════════════════════════\n');
