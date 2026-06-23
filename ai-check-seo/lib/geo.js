// GEO Module — Generative Engine Optimization readiness
// ตรวจความพร้อมของเว็บต่อ AI Search: ChatGPT, Google AI Overview, Perplexity, Claude
import { robotsAllows } from './crawler.js';

function mk(id, severity, status, title, detail, recommendation = '', pages = [], fixable = false) {
  return { id, category: 'geo', severity, status, title, detail, recommendation, pages: pages.slice(0, 50), affectedCount: pages.length, fixable };
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
    const blocked = [], allowed = [];
    for (const bot of AI_BOTS) {
      (robotsAllows(site.robots, bot.ua, '/') ? allowed : blocked).push(bot);
    }
    checks.push(blocked.length
      ? mk('geo-bot-access', 'high', 'fail', 'robots.txt บล็อก AI bots',
        `บล็อก: ${blocked.map(b => `${b.ua} (${b.who})`).join(' · ')} — ทำให้เนื้อหามีโอกาสน้อยที่จะถูกอ้างถึงหรือแนะนำใน AI answers`,
        'ถ้าอยากให้แบรนด์ปรากฏใน ChatGPT/Perplexity/AI Overview ให้อนุญาต bot เหล่านี้ (อย่างน้อย OAI-SearchBot, PerplexityBot, ClaudeBot)', [], true)
      : mk('geo-bot-access', 'high', 'pass', 'AI bots เข้าถึงได้ทั้งหมด',
        `${allowed.length} AI crawler หลักเข้าได้: ${allowed.map(b => b.ua).join(', ')}`));
  } else {
    checks.push(mk('geo-bot-access', 'med', 'warn', 'ไม่มี robots.txt — AI bots เข้าได้แต่ไม่มีไกด์', 'ควรมี robots.txt ที่อนุญาต AI bot อย่างชัดเจน + ระบุ sitemap', '', [], true));
  }

  // ── 2. llms.txt ──
  checks.push(site.llmsTxt
    ? mk('geo-llms-txt', 'low', 'pass', 'มี llms.txt แล้ว', 'ไฟล์ llms.txt ช่วย AI เข้าใจโครงสร้างและเนื้อหาสำคัญของเว็บ — นำหน้าคู่แข่ง 99%')
    : mk('geo-llms-txt', 'low', 'warn', 'ยังไม่มี llms.txt',
      'llms.txt คือมาตรฐานใหม่ (เหมือน robots.txt สำหรับ LLM) — สรุปว่าเว็บคุณคือใคร มีหน้าสำคัญอะไร ให้ AI ดึงไปใช้ถูกต้อง เว็บไทยแทบไม่มีใครทำ = โอกาสนำคู่แข่ง',
      'สร้าง /llms.txt (ระบบ Auto-Fix สร้างให้ได้)', [], true));

  // ── 3. SPA = AI มองไม่เห็น ──
  const spaPages = pages.filter(p => p.emptyRoot);
  if (spaPages.length) {
    checks.push(mk('geo-spa-risk', 'high', 'fail', 'AI engines มองไม่เห็นเนื้อหา (JS-only rendering)',
      `${spaPages.length} หน้าเป็น SPA shell — GPTBot, ClaudeBot, PerplexityBot **ไม่ render JavaScript** ต่างจาก Googlebot — สำหรับ AI search เว็บนี้คือหน้าว่าง`,
      'นี่คือเหตุผลอันดับ 1 ที่แบรนด์ไม่ถูก ChatGPT อ้างถึง — ต้องทำ SSR/pre-render', spaPages.map(p => p.url)));
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
    : mk('geo-faq-schema', 'med', 'fail', 'ยังไม่มี FAQ schema',
      `ไม่พบ FAQPage/QAPage schema ใน ${pages.length} หน้าที่ตรวจ — เป็น format ที่ AI Overview และ ChatGPT ดึงไปตอบได้ดี`,
      'เพิ่ม FAQ section + FAQPage schema ในหน้าบริการหลัก (ไม่จำเป็นทุกหน้า) — Auto-Fix สร้าง template ให้', pages.map(p => p.url), true));

  // ── 5. Q&A content blocks (heading เป็นคำถาม) ──
  const qWords = /(\?|คืออะไร|คือ\s|ทำไม|อย่างไร|ยังไง|เท่าไหร่|ที่ไหน|เมื่อไหร่|^(what|how|why|when|where|who)\b)/i;
  const qaPages = pages.filter(p => p.headings.some(h => h.tag !== 'h1' && qWords.test(h.text)));
  checks.push(qaPages.length
    ? mk('geo-qa-content', 'med', 'pass', 'มีเนื้อหาแบบถาม-ตอบ', `${qaPages.length}/${pages.length} หน้ามี heading เชิงคำถาม — โครงสร้างที่ AI ดึงคำตอบง่าย`)
    : mk('geo-qa-content', 'med', 'warn', 'ไม่มีเนื้อหาโครงสร้างถาม-ตอบ',
      'AI engines สกัด "คำตอบตรงๆ ใต้คำถาม" ได้ดี — เว็บนี้ยังไม่มี heading เชิงคำถาม (เช่น "นักลงทุนสัมพันธ์คืออะไร")',
      'เพิ่มหัวข้อเชิงคำถาม + คำตอบกระชับ 2–3 ประโยคแรกใต้หัวข้อ', [], true));

  // ── 6. E-E-A-T signals ──
  const eat = [];
  const hasAuthor = pages.some(p => p.metas['author'] || ldTypes.has('Person') || p.jsonLd.some(j => j.ok && JSON.stringify(j.data).includes('"author"')));
  if (!hasAuthor) eat.push('ไม่มีข้อมูลผู้เขียน (author meta/schema)');
  const hasDates = pages.some(p => p.metas['article:published_time'] || p.jsonLd.some(j => j.ok && /datePublished|dateModified/.test(JSON.stringify(j.data))));
  if (!hasDates) eat.push('ไม่มีวันที่เผยแพร่/อัปเดต (datePublished)');
  let sameAs = false;
  pages.forEach(p => p.jsonLd.forEach(j => { if (j.ok && /"sameAs"/.test(JSON.stringify(j.data))) sameAs = true; }));
  if (!sameAs) eat.push('Organization ไม่มี sameAs ลิงก์ไป social/Wikipedia (สัญญาณ entity)');
  // list หน้าที่ขาดสัญญาณรายหน้า (author/วันที่) — sameAs เป็นระดับเว็บ ไม่ list รายหน้า
  const eatMissingPages = pages.filter(p => {
    const a = p.metas['author'] || p.jsonLd.some(j => j.ok && JSON.stringify(j.data).includes('"author"'));
    const d = p.metas['article:published_time'] || p.jsonLd.some(j => j.ok && /datePublished|dateModified/.test(JSON.stringify(j.data)));
    return !a || !d;
  }).map(p => p.url);
  checks.push(eat.length
    ? mk('geo-eeat', 'med', eat.length >= 2 ? 'fail' : 'warn', 'สัญญาณ E-E-A-T ไม่ครบ',
      eat.join(' · ') + ' — AI engines ใช้สัญญาณเหล่านี้ตัดสินว่าควรเชื่อและอ้างถึงเว็บไหน',
      'เพิ่ม author bio + วันที่ + Organization.sameAs (Auto-Fix ช่วยสร้าง schema ได้)', eatMissingPages, true)
    : mk('geo-eeat', 'med', 'pass', 'สัญญาณ E-E-A-T ครบ', 'มี author, dates และ entity links'));

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
      checks.push(mk('geo-entity', 'high', 'fail', 'AI ไม่รู้ว่าแบรนด์นี้คือใคร (ไม่มี entity data)',
        'ไม่มี Organization schema — เมื่อมีคนถาม AI ถึงธุรกิจประเภทนี้ AI ไม่มีข้อมูล structured ของแบรนด์ให้เชื่อมโยง จะไปอ้างเว็บอื่นแทน',
        'เพิ่ม Organization schema เต็มรูปแบบ: name, logo, description, address, sameAs', [], true));
    else
      checks.push(mk('geo-entity', 'high', 'pass', 'มี entity data ของแบรนด์', 'Organization schema พร้อมให้ AI เชื่อมโยงแบรนด์'));
  }

  return { checks };
}

export { AI_BOTS };
