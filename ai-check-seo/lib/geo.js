// GEO Module — Generative Engine Optimization readiness
// ตรวจความพร้อมของเว็บต่อ AI Search: ChatGPT, Google AI Overview, Perplexity, Claude
import { robotsAllows } from './crawler.js';

function mk(id, severity, status, title, detail, recommendation = '', pages = [], fixable = false) {
  return { id, category: 'geo', severity, status, title, detail, recommendation, pages: pages.slice(0, 50), affectedCount: pages.length, fixable };
}

// ตรวจว่า JSON-LD มี property ที่มีค่าจริง (ไม่ใช่ค่าว่าง) — เลี่ยง false positive จาก substring match
// เช่น JSON.stringify().includes('"author"') ที่จับ "author":"" หรือคำในฟิลด์อื่นก็เป็น true
function jsonLdHasProp(data, prop) {
  let found = false;
  const valid = v => Array.isArray(v) ? v.length > 0 : (typeof v === 'object' ? v != null && Object.keys(v).length > 0 : v != null && String(v).trim() !== '');
  const walk = d => {
    if (found || d == null) return;
    if (Array.isArray(d)) return d.forEach(walk);
    if (typeof d === 'object') {
      if (Object.prototype.hasOwnProperty.call(d, prop) && valid(d[prop])) { found = true; return; }
      for (const k in d) walk(d[k]);
    }
  };
  walk(data);
  return found;
}

const AI_BOTS = [
  { ua: 'GPTBot', who: 'OpenAI / ChatGPT (เทรนโมเดล + เก็บข้อมูล)' },
  { ua: 'OAI-SearchBot', who: 'ChatGPT Search (ผลค้นหาเรียลไทม์)' },
  { ua: 'ChatGPT-User', who: 'ChatGPT browse ตอนผู้ใช้ถาม' },
  { ua: 'ClaudeBot', who: 'Anthropic / Claude' },
  { ua: 'anthropic-ai', who: 'Anthropic (legacy)' },
  { ua: 'PerplexityBot', who: 'Perplexity AI' },
  { ua: 'Perplexity-User', who: 'Perplexity ตอนผู้ใช้ถาม' },
  { ua: 'Google-Extended', who: 'Google Gemini / AI Overview (เทรน)' },
  { ua: 'Bingbot', who: 'Bing → ป้อน ChatGPT Search ด้วย' },
  { ua: 'CCBot', who: 'Common Crawl (ชุดข้อมูลเทรน AI หลายเจ้า)' },
  { ua: 'Applebot-Extended', who: 'Apple Intelligence / Siri' },
  { ua: 'meta-externalagent', who: 'Meta AI (Llama)' },
  { ua: 'Amazonbot', who: 'Amazon Alexa / Rufus' },
  { ua: 'Bytespider', who: 'ByteDance / Doubao' },
];

export function runGeoChecks(site) {
  const checks = [];
  const pages = site.pages.filter(p => p.title !== undefined && !p.nonHtml && !p.blocked && p.status === 200);
  if (!pages.length) return { checks };
  const home = pages.find(p => { try { return new URL(p.url).pathname === '/'; } catch { return false; } }) || pages[0];

  // ── 1. AI bot access ผ่าน robots.txt ──
  if (site.robots) {
    // ทดสอบทั้ง '/' · path เนื้อหาจริงที่ crawl เจอ · และ section เนื้อหาที่ robots ประกาศ disallow
    // (สำคัญ: section ที่ถูกบล็อกมักไม่ถูก crawl เลย จึงต้องดึงจากกฎ robots ตรงๆ ด้วย — กันเคส /th/ ที่มองไม่เห็น)
    const SECTION_RE = /^\/(th|en|blog|product|service|news|article|category|shop)s?\/?$/i;
    const robotsSections = (site.robots.groups || []).flatMap(g => g.rules)
      .filter(x => x.type === 'disallow' && x.path && SECTION_RE.test(x.path)).map(x => x.path);
    const samplePaths = [...new Set([
      '/',
      ...pages.map(p => { try { return new URL(p.url).pathname || '/'; } catch { return '/'; } }),
      ...robotsSections,
    ])].slice(0, 30);
    const blocked = [], allowed = [];
    for (const bot of AI_BOTS) {
      const blockedPaths = samplePaths.filter(path => !robotsAllows(site.robots, bot.ua, path));
      if (blockedPaths.length) blocked.push({ ...bot, paths: blockedPaths }); else allowed.push(bot);
    }
    const rootBlocked = blocked.filter(b => b.paths.includes('/'));   // โดนทั้งเว็บ
    const sectionOnly = blocked.filter(b => !b.paths.includes('/'));  // โดนเฉพาะบาง section
    if (blocked.length) {
      const desc = blocked.map(b => b.paths.includes('/')
        ? `${b.ua} (ทั้งเว็บ)`
        : `${b.ua} (เฉพาะ ${[...new Set(b.paths)].slice(0, 3).join(', ')})`).join(' · ');
      checks.push(mk('geo-bot-access', rootBlocked.length ? 'high' : 'med', rootBlocked.length ? 'fail' : 'warn',
        rootBlocked.length ? 'robots.txt บล็อก AI bots' : 'robots.txt บล็อก AI bots จากบาง section',
        `บล็อก: ${desc} — AI crawler เหล่านี้ถูกห้ามตาม robots.txt จึงมีโอกาสน้อยลงที่เนื้อหา${rootBlocked.length ? '' : 'ในส่วนนั้น'}จะถูกอ้างถึงใน AI answers`,
        'ถ้าอยากให้แบรนด์ปรากฏใน ChatGPT/Perplexity/AI Overview ให้อนุญาต bot เหล่านี้ (อย่างน้อย OAI-SearchBot, PerplexityBot, ClaudeBot) ในทุก path ที่เป็นเนื้อหาหลัก', [], true));
    } else {
      checks.push(mk('geo-bot-access', 'high', 'pass', 'AI bots เข้าถึงได้ทั้งหมด',
        `${allowed.length} AI crawler หลักเข้าได้ทุก path ที่ตรวจ: ${allowed.map(b => b.ua).join(', ')}`));
    }
  } else {
    checks.push(mk('geo-bot-access', 'med', 'warn', 'ไม่มี robots.txt — AI bots เข้าได้แต่ไม่มีไกด์', 'ควรมี robots.txt ที่อนุญาต AI bot อย่างชัดเจน + ระบุ sitemap', '', [], true));
  }

  // ── 2. llms.txt ──
  checks.push(site.llmsTxt
    ? mk('geo-llms-txt', 'low', 'pass', 'มี llms.txt แล้ว', 'ไฟล์ llms.txt ช่วยสรุปโครงสร้าง/เนื้อหาสำคัญให้ LLM (เป็น convention ใหม่ — มีไว้ดีกว่าไม่มี)')
    : mk('geo-llms-txt', 'low', 'warn', 'ยังไม่มี llms.txt',
      'llms.txt เป็น convention ที่เสนอใหม่ (เหมือน robots.txt สำหรับ LLM) — สรุปว่าเว็บคุณคือใคร มีหน้าสำคัญอะไร · หมายเหตุ: AI engine รายใหญ่ยังไม่ยืนยันว่ารองรับอย่างเป็นทางการ แต่ต้นทุนทำต่ำและไม่มี downside',
      'สร้าง /llms.txt (ระบบ Auto-Fix สร้างให้ได้)', [], true));

  // ── 3. SPA = AI มองไม่เห็น ──
  const spaPages = pages.filter(p => p.emptyRoot);
  if (spaPages.length) {
    checks.push(mk('geo-spa-risk', 'high', 'fail', 'เนื้อหาพึ่งพา JavaScript — AI crawler มีแนวโน้มอ่านไม่ครบ',
      `${spaPages.length} หน้าส่ง HTML ดิบมาเป็น shell ว่าง (เนื้อหา render ด้วย JS) — AI crawler หลัก (GPTBot, ClaudeBot, PerplexityBot) ปัจจุบัน**ไม่รัน JavaScript** จึงมีแนวโน้มสูงที่จะเห็นเนื้อหาไม่ครบ · ส่วน Googlebot ยัง render ได้ในรอบสอง (ช้ากว่าและไม่เสถียรเท่า raw HTML)`,
      'ทำ SSR/pre-render ให้เนื้อหาหลักอยู่ใน HTML ดิบ — ช่วยทั้ง AI search และความเสถียรของการ index ฝั่ง Google', spaPages.map(p => p.url)));
  } else {
    checks.push(mk('geo-spa-risk', 'high', 'pass', 'เนื้อหาอ่านได้โดย AI bots', 'เนื้อหาอยู่ใน HTML ดิบ — AI crawler ทุกตัวอ่านได้ทันที'));
  }

  // ── 4. FAQ / Q&A schema ──
  const ldTypes = new Set();
  pages.forEach(p => p.jsonLd.forEach(j => {
    if (!j.ok) return;
    const collect = (d) => { if (Array.isArray(d)) return d.forEach(collect); if (d && typeof d === 'object') { if (d['@type']) [].concat(d['@type']).forEach(t => ldTypes.add(t)); if (d['@graph']) collect(d['@graph']); } };
    collect(j.data);
  }));
  checks.push((ldTypes.has('FAQPage') || ldTypes.has('QAPage'))
    ? mk('geo-faq-schema', 'med', 'pass', 'มี FAQ/QA schema', 'AI engines ดึง Q&A ที่มี schema ไปตอบได้ตรงที่สุด')
    : mk('geo-faq-schema', 'med', 'warn', 'ยังไม่มี FAQ schema',
      `ไม่พบ FAQPage/QAPage schema ใน ${pages.length} หน้าที่ตรวจ — เป็น format ที่ AI Overview และ ChatGPT ดึงไปตอบได้ดี (เป็นส่วนเสริม ไม่ใช่สิ่งจำเป็นพื้นฐาน)`,
      'เพิ่ม FAQPage schema เฉพาะหน้าที่มีคำถาม-คำตอบจริงเท่านั้น — หมายเหตุ: ตั้งแต่ปี 2023 Google จำกัด FAQ rich result เฉพาะเว็บภาครัฐ/สุขภาพ และการมาร์กอัป Q&A ปลอมผิดแนวทางอาจโดน manual action จึงห้ามใส่ schema กับเนื้อหาที่ไม่ใช่ Q&A จริง', pages.map(p => p.url), true));

  // ── 5. Q&A content blocks (heading เป็นคำถาม) ──
  const qWords = /(\?|คืออะไร|คือ\s|ทำไม|อย่างไร|ยังไง|เท่าไหร่|ที่ไหน|เมื่อไหร่|^(what|how|why|when|where|who)\b)/i;
  const qaPages = pages.filter(p => p.headings.some(h => h.tag !== 'h1' && qWords.test(h.text)));
  checks.push(qaPages.length
    ? mk('geo-qa-content', 'med', 'pass', 'มีเนื้อหาแบบถาม-ตอบ', `${qaPages.length}/${pages.length} หน้ามี heading เชิงคำถาม — โครงสร้างที่ AI ดึงคำตอบง่าย`)
    : mk('geo-qa-content', 'med', 'warn', 'ไม่มีเนื้อหาโครงสร้างถาม-ตอบ',
      'AI engines สกัด "คำตอบตรงๆ ใต้คำถาม" ได้ดี — เว็บนี้ยังไม่มี heading เชิงคำถาม (เช่น "นักลงทุนสัมพันธ์คืออะไร")',
      'เพิ่มหัวข้อเชิงคำถาม + คำตอบกระชับ 2–3 ประโยคแรกใต้หัวข้อ', [], true));

  // ── 6. สัญญาณความน่าเชื่อถือที่ "อ่านได้ด้วยเครื่อง" (machine-readable trust signals) ──
  // หมายเหตุ: E-E-A-T เป็นกรอบแนวคิดของ Google ไม่ใช่ tag ที่ตรวจตรงๆ ได้ — เราตรวจเฉพาะ
  // สัญญาณ structured ที่ช่วยให้เครื่องเชื่อมโยง (author/date/sameAs) จึงรายงานตามนั้น ไม่ตัดสินว่า "E-E-A-T อ่อน"
  const authorOf = p => !!(p.metas['author'] || ldTypes.has('Person') || p.jsonLd.some(j => j.ok && jsonLdHasProp(j.data, 'author')));
  const dateOf = p => !!(p.metas['article:published_time'] || p.jsonLd.some(j => j.ok && (jsonLdHasProp(j.data, 'datePublished') || jsonLdHasProp(j.data, 'dateModified'))));
  const eat = [];
  if (!pages.some(authorOf)) eat.push('ไม่มีข้อมูลผู้เขียน (author meta/schema)');
  if (!pages.some(dateOf)) eat.push('ไม่มีวันที่เผยแพร่/อัปเดต (datePublished)');
  const sameAs = pages.some(p => p.jsonLd.some(j => j.ok && jsonLdHasProp(j.data, 'sameAs')));
  if (!sameAs) eat.push('Organization ไม่มี sameAs ลิงก์ไป social/Wikipedia (สัญญาณ entity)');
  const eatMissingPages = pages.filter(p => !authorOf(p) || !dateOf(p)).map(p => p.url);
  checks.push(eat.length
    ? mk('geo-eeat', 'med', 'warn', 'สัญญาณความน่าเชื่อถือที่อ่านได้ด้วยเครื่องไม่ครบ',
      eat.join(' · ') + ' — เป็นสัญญาณ structured ที่ช่วยให้ Google/AI เชื่อมโยงผู้เขียน/แบรนด์ได้ชัดขึ้น (ตัวเสริม ไม่ใช่ตัวตัดสิน E-E-A-T โดยตรง)',
      'เพิ่ม author byline + วันที่ + Organization.sameAs (Auto-Fix ช่วยสร้าง schema ได้)', eatMissingPages, true)
    : mk('geo-eeat', 'med', 'pass', 'สัญญาณความน่าเชื่อถือครบ', 'มี author, dates และ entity links (sameAs)'));

  // ── 7. Citation-worthy content ──
  const hasData = pages.filter(p => p.hasTables || p.listCount >= 3);
  checks.push(hasData.length >= Math.min(3, pages.length)
    ? mk('geo-citable', 'low', 'pass', 'มีเนื้อหาที่ AI ชอบอ้างอิง', `${hasData.length} หน้ามีตาราง/ลิสต์ข้อมูล — format ที่ถูก cite บ่อย`)
    : mk('geo-citable', 'low', 'warn', 'เนื้อหาขาดข้อมูลเชิงอ้างอิง',
      'AI ชอบ cite ตาราง สถิติ ตัวเลข benchmark — เว็บนี้มีน้อย',
      'สร้าง "ข้อมูลต้นฉบับ" เช่น benchmark อุตสาหกรรม สถิติที่รวบรวมเอง — จะถูก AI อ้างถึงซ้ำๆ', [], true));

  // ── 7.5 Trust pages (E-E-A-T / ความน่าเชื่อถือต่อ AI) ──
  {
    const allHrefs = new Set();
    pages.forEach(p => { allHrefs.add(p.url.toLowerCase()); (p.links || []).forEach(l => allHrefs.add((l.href || '').toLowerCase())); });
    const hrefStr = [...allHrefs].join(' ');
    const missing = [];
    if (!/about|เกี่ยวกับ/.test(hrefStr)) missing.push('หน้าเกี่ยวกับเรา (About)');
    if (!/contact|ติดต่อ/.test(hrefStr)) missing.push('หน้าติดต่อ (Contact)');
    if (!/privacy|นโยบาย/.test(hrefStr)) missing.push('นโยบายความเป็นส่วนตัว (Privacy)');
    const hasContactSignal = pages.some(p => p.hasPhone || p.hasMailto);
    if (!hasContactSignal) missing.push('เบอร์โทร/อีเมลบนหน้าเว็บ');
    checks.push(missing.length
      ? mk('geo-trust-pages', 'med', missing.length >= 3 ? 'fail' : 'warn', 'หน้าความน่าเชื่อถือไม่ครบ (Trust signals)',
        `ไม่พบ: ${missing.join(' · ')} — ทั้ง Google (E-E-A-T) และ AI engines ใช้สิ่งเหล่านี้ตัดสินว่าธุรกิจมีตัวตนจริง`,
        'เพิ่มหน้า About/Contact/Privacy และแสดงข้อมูลติดต่อจริงบนเว็บ', [], true)
      : mk('geo-trust-pages', 'med', 'pass', 'Trust signals ครบ', 'มีหน้า About/Contact/Privacy และข้อมูลติดต่อ'));
  }

  // ── 8. Brand entity บน raw HTML ──
  if (home) {
    const brandInTitle = home.title && home.title.length > 0;
    const orgSchema = ldTypes.has('Organization') || ldTypes.has('LocalBusiness');
    if (!orgSchema)
      checks.push(mk('geo-entity', 'med', 'warn', 'ยังไม่มี Organization schema (entity ของแบรนด์)',
        'ไม่พบ Organization/LocalBusiness schema — AI ยังเข้าใจแบรนด์ได้จากข้อความ/ลิงก์ภายนอก/knowledge graph แต่ schema เป็นสัญญาณ structured ที่ช่วยให้เชื่อมโยง entity ได้ชัดและถูกต้องขึ้น (ตัวเสริม ไม่ใช่เงื่อนไขบังคับ)',
        'เพิ่ม Organization schema: name, logo, description, address, sameAs — ช่วยให้ AI/Google ระบุแบรนด์ได้แม่นขึ้น', [], true));
    else
      checks.push(mk('geo-entity', 'med', 'pass', 'มี entity data ของแบรนด์', 'Organization schema พร้อมให้ AI/Google เชื่อมโยงแบรนด์'));
  }

  return { checks };
}

export { AI_BOTS };
