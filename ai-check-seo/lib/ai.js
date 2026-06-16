// AI Layer — ตีความผลตรวจด้วย LLM: สรุปผู้บริหารภาษาไทย, จัดลำดับ, เขียนคำแนะนำรายเคส
// รองรับ OpenRouter, Anthropic (Claude) และ OpenAI — ถ้าไม่มี key จะ fallback เป็นสรุปแบบ template
const OPENROUTER_KEY = () => process.env.OPENROUTER_API_KEY;
const ANTHROPIC_KEY = () => process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY = () => process.env.OPENAI_API_KEY;

// โมเดล "พรีเมียม" ตาม provider ที่ active (ใช้สำหรับงานที่ต้องการคุณภาพสูง เช่น growth plan / หาคู่แข่ง)
// คืน null = ให้ใช้โมเดล default ของ provider นั้น
export function premiumModel() {
  if (OPENROUTER_KEY()) return process.env.OPENROUTER_MODEL_PREMIUM || 'openai/gpt-4o';
  if (OPENAI_KEY())     return 'gpt-4o';
  return null; // Anthropic → ใช้ default (sonnet)
}

// ราคา USD ต่อ 1M tokens (อัพเดต 2025) — รองรับทั้งชื่อโมเดลตรงและแบบ OpenRouter (provider/model)
const MODEL_PRICING = {
  'gpt-4o-mini':              { input: 0.15,  output: 0.60  },
  'gpt-4o':                   { input: 2.50,  output: 10.00 },
  'gpt-4o-2024-11-20':        { input: 2.50,  output: 10.00 },
  'openai/gpt-4o-mini':       { input: 0.15,  output: 0.60  },
  'openai/gpt-4o':            { input: 2.50,  output: 10.00 },
  'claude-sonnet-4-6':        { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':         { input: 0.80,  output: 4.00  },
  'claude-haiku-4-5-20251001':{ input: 0.80,  output: 4.00  },
  'claude-opus-4-8':          { input: 15.00, output: 75.00 },
  'anthropic/claude-sonnet-4':{ input: 3.00,  output: 15.00 },
};

function calcUsd(model, inputTokens, outputTokens) {
  const p = MODEL_PRICING[model] || { input: 0.15, output: 0.60 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

// module-level cost accumulator — drain ก่อนเริ่ม audit แต่ละครั้ง
const _costLog = [];
export function drainAiCost() {
  const snap = [..._costLog];
  _costLog.length = 0;
  return snap; // [{model, inputTokens, outputTokens, usd}]
}

export function aiAvailable() {
  return !!(OPENROUTER_KEY() || ANTHROPIC_KEY() || OPENAI_KEY());
}

export async function callLLM(system, user, maxTokens = 3000, modelOverride = null) {
  if (OPENROUTER_KEY()) {
    // OpenRouter ใช้ API แบบ OpenAI-compatible — โมเดลต้องอยู่ในรูป provider/model เช่น openai/gpt-4o-mini
    let model = modelOverride || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    if (!model.includes('/')) model = `openai/${model}`; // เผื่อ override ที่ส่งมาเป็นชื่อ OpenAI ล้วน
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY()}`,
        'content-type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://localhost',
        'X-Title': 'AI SEO Audit Pro',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const inp = data.usage?.prompt_tokens || 0;
    const out = data.usage?.completion_tokens || 0;
    _costLog.push({ model, inputTokens: inp, outputTokens: out, usd: calcUsd(model, inp, out) });
    return data.choices?.[0]?.message?.content || '';
  }
  if (ANTHROPIC_KEY()) {
    const model = modelOverride || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const inp = data.usage?.input_tokens || 0;
    const out = data.usage?.output_tokens || 0;
    _costLog.push({ model, inputTokens: inp, outputTokens: out, usd: calcUsd(model, inp, out) });
    return data.content?.map(c => c.text || '').join('') || '';
  }
  if (OPENAI_KEY()) {
    const model = modelOverride || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const inp = data.usage?.prompt_tokens || 0;
    const out = data.usage?.completion_tokens || 0;
    _costLog.push({ model, inputTokens: inp, outputTokens: out, usd: calcUsd(model, inp, out) });
    return data.choices?.[0]?.message?.content || '';
  }
  throw new Error('no-api-key');
}

function extractJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in LLM output');
  return JSON.parse(m[0]);
}

// สรุปผู้บริหาร + จัดลำดับปัญหาตาม business impact
// ── Guardrail: บังคับให้ output ของ AI อ้างได้เฉพาะ check ที่ rule engine ผลิตจริง ──
// AI เป็นส่วน non-deterministic เดียวที่เหลือ — ถ้ามันกุ checkId ที่ไม่มี หรือชี้ไป
// check ที่ status=pass (กุปัญหาที่ไม่มีจริง) เราจะตัดทิ้ง ไม่ให้ถึงตาผู้ใช้
// ฟังก์ชันนี้ deterministic 100% → fixture-test ได้ (ชั้น 3 ของการ verify)
export function guardAiAnalysis(parsed, audit) {
  const checks = audit?.checks || [];
  const validId = new Set(checks.map(c => c.id));
  const issueId = new Set(checks.filter(c => c.status === 'fail' || c.status === 'warn').map(c => c.id));

  const prios = Array.isArray(parsed?.topPriorities) ? parsed.topPriorities : [];
  const kept = [], droppedUnknown = [], droppedNonIssue = [];
  for (const p of prios) {
    const id = p?.checkId;
    if (!id || !validId.has(id)) { droppedUnknown.push(id ?? '(ว่าง)'); continue; }   // กุ ID ที่ไม่มีจริง
    if (!issueId.has(id)) { droppedNonIssue.push(id); continue; }                       // ชี้ไป check ที่ผ่านแล้ว
    kept.push(p);
  }
  kept.forEach((p, i) => { p.rank = i + 1; });                                          // จัดอันดับใหม่หลังตัด

  const dropped = droppedUnknown.length + droppedNonIssue.length;
  return {
    ...parsed,
    topPriorities: kept,
    _guardrail: {
      ok: dropped === 0,
      kept: kept.length,
      droppedHallucinated: droppedUnknown,   // checkId ที่ไม่มีใน audit เลย
      droppedNonIssue,                        // checkId ที่มีจริงแต่ status=pass
    },
  };
}

export async function aiAnalyze(audit) {
  const issues = audit.checks
    .filter(c => c.status === 'fail' || c.status === 'warn')
    .map(c => ({ id: c.id, severity: c.severity, status: c.status, title: c.title, detail: c.detail.slice(0, 250), affected: c.affectedCount }));
  const passes = audit.checks.filter(c => c.status === 'pass').map(c => c.title);

  const system = `คุณคือหัวหน้าที่ปรึกษา SEO + GEO ระดับซีเนียร์ของเอเจนซี่ชั้นนำในไทย วิเคราะห์ผลตรวจเว็บไซต์แล้วเขียนรายงานภาษาไทยที่ "ผู้บริหารอ่านรู้เรื่อง เจ้าของเว็บอยากรีบแก้" — เน้นผลกระทบทางธุรกิจ (traffic, ลูกค้า, ยอดขาย) ไม่ใช่ศัพท์เทคนิคล้วน ตอบเป็น JSON เท่านั้น`;
  const user = `เว็บไซต์: ${audit.url}
คะแนนรวม: ${audit.score.overall}/100 (เกรด ${audit.score.grade})
คะแนนรายหมวด: ${JSON.stringify(audit.score.categoryScores)}
จำนวนหน้า: ${audit.pagesAnalyzed}

ปัญหาที่พบ (${issues.length} ข้อ):
${JSON.stringify(issues, null, 1)}

สิ่งที่ทำดีแล้ว: ${passes.join(', ') || '-'}

ตอบเป็น JSON รูปแบบนี้เท่านั้น:
{
  "executiveSummary": "สรุปผู้บริหาร 3-5 ประโยค ภาพรวมสุขภาพเว็บ + ปัญหาใหญ่สุด + โอกาสที่เสียอยู่ เขียนแบบมือโปรที่ตรงไปตรงมา",
  "topPriorities": [
    {"rank": 1, "checkId": "id ของ check", "title": "ชื่อปัญหาสั้นๆ", "businessImpact": "กระทบธุรกิจยังไง 1-2 ประโยค", "effort": "ง่าย|ปานกลาง|ยาก", "timeline": "เช่น สัปดาห์ที่ 1"}
  ],
  "quickWins": ["สิ่งที่แก้ได้ใน 1 วันแล้วเห็นผล 2-4 ข้อ"],
  "strategicAdvice": "คำแนะนำเชิงกลยุทธ์ 2-3 ประโยค มองไกลกว่าการแก้บั๊ก เช่น content/GEO opportunity"
}
topPriorities เอาแค่ 5-7 ข้อที่สำคัญจริง เรียงตาม impact ต่อธุรกิจ`;

  try {
    const text = await callLLM(system, user, 3500);
    const parsed = extractJson(text);
    return { source: 'ai', ...guardAiAnalysis(parsed, audit) };
  } catch (e) {
    return { source: 'template', error: String(e.message || e), ...guardAiAnalysis(templateAnalysis(audit), audit) };
  }
}

// Fallback ไม่มี API key — สรุปจากกฎ
function templateAnalysis(audit) {
  const fails = audit.checks.filter(c => c.status === 'fail').sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1));
  const warns = audit.checks.filter(c => c.status === 'warn');
  const sevTh = { high: 'สูง', med: 'กลาง', low: 'ต่ำ' };
  return {
    executiveSummary: `เว็บไซต์ได้คะแนน ${audit.score.overall}/100 (เกรด ${audit.score.grade}) จากการตรวจ ${audit.pagesAnalyzed} หน้า พบปัญหาระดับร้ายแรง ${fails.length} ข้อ และจุดที่ควรปรับปรุง ${warns.length} ข้อ ${fails.length ? `ปัญหาเร่งด่วนที่สุดคือ "${fails[0].title}" ซึ่งกระทบการมองเห็นบน Google และ AI search โดยตรง` : 'ภาพรวมอยู่ในเกณฑ์ดี ควรเก็บรายละเอียดที่เหลือเพื่อทิ้งห่างคู่แข่ง'} (หมายเหตุ: สรุปนี้สร้างจากกฎอัตโนมัติ — ใส่ API key เพื่อให้ AI วิเคราะห์เชิงลึกแบบรายเคส)`,
    topPriorities: fails.slice(0, 7).map((c, i) => ({
      rank: i + 1, checkId: c.id, title: c.title,
      businessImpact: c.detail.slice(0, 180),
      effort: c.fixable ? 'ง่าย' : 'ปานกลาง',
      timeline: i < 3 ? 'สัปดาห์ที่ 1' : 'สัปดาห์ที่ 2–3',
    })),
    quickWins: fails.filter(c => c.fixable).slice(0, 4).map(c => c.title),
    strategicAdvice: 'แก้ปัญหาเชิงเทคนิคให้จบก่อน แล้วลงทุนกับเนื้อหาแบบถาม-ตอบ + FAQ schema เพื่อชิงพื้นที่บน AI search ที่คู่แข่งส่วนใหญ่ยังไม่เริ่มทำ',
  };
}

// เปรียบเทียบกับคู่แข่ง — สรุปว่าแพ้/ชนะตรงไหน + แผนแซง
export async function aiCompare(ours, theirs) {
  const system = `คุณคือนักกลยุทธ์ SEO ระดับซีเนียร์ เปรียบเทียบผลตรวจเว็บของลูกค้ากับคู่แข่ง แล้วสรุปแบบตรงไปตรงมา เน้น action ที่ทำให้แซงได้จริง ตอบ JSON เท่านั้น`;
  const user = `เว็บของเรา: ${JSON.stringify(ours)}
เว็บคู่แข่ง: ${JSON.stringify(theirs)}

ตอบ JSON:
{
  "summary": "สรุป 3-4 ประโยค: ใครเหนือกว่าโดยรวม เราแพ้หนักสุดตรงไหน และจุดที่เราได้เปรียบ",
  "battlePlan": ["แผนแซง 3-5 ข้อ เรียงตามผลลัพธ์ต่อการแซงอันดับ แต่ละข้อสั้น กระชับ ลงมือได้เลย"]
}`;
  try {
    const text = await callLLM(system, user, 1500);
    return { source: 'ai', ...extractJson(text) };
  } catch (e) {
    return { source: 'template', ...templateCompare(ours, theirs) };
  }
}

function templateCompare(ours, theirs) {
  const diff = ours.overall - theirs.overall;
  const rank = { pass: 0, warn: 1, fail: 2 };
  const losing = Object.entries(ours.flags || {}).filter(([k, v]) => v && theirs.flags?.[k] && rank[v] > rank[theirs.flags[k]]).map(([k]) => k);
  const winning = Object.entries(ours.flags || {}).filter(([k, v]) => v && theirs.flags?.[k] && rank[v] < rank[theirs.flags[k]]).map(([k]) => k);
  const labels = { ssr: 'การ render ฝั่ง server (SSR)', jsonld: 'Structured Data', orgSchema: 'Organization schema', faq: 'FAQ schema', aiBots: 'การเปิดรับ AI bots', llms: 'llms.txt', canonical: 'Canonical', sitemap: 'Sitemap', h1: 'H1', desc: 'Meta description', og: 'Open Graph', trust: 'Trust pages', eeat: 'E-E-A-T', cwv: 'Core Web Vitals' };
  return {
    summary: `คะแนนรวม: เรา ${ours.overall} vs คู่แข่ง ${theirs.overall} (${diff >= 0 ? 'นำอยู่ +' + diff : 'ตามอยู่ ' + diff} คะแนน) ${losing.length ? 'จุดที่เราแพ้ชัดเจน: ' + losing.map(k => labels[k] || k).join(', ') : 'ไม่มีหมวดที่แพ้ขาด'}${winning.length ? ' ส่วนที่เราได้เปรียบ: ' + winning.map(k => labels[k] || k).join(', ') : ''} (สรุปอัตโนมัติ — ใส่ AI key เพื่อแผนเชิงกลยุทธ์)`,
    battlePlan: losing.slice(0, 5).map(k => `ปิดช่องว่างเรื่อง ${labels[k] || k} ให้เท่าหรือดีกว่าคู่แข่ง`),
  };
}

// แผนเติบโต: keyword เป้าหมาย + projection 3/6/12 เดือน + workstreams (พลังให้สไลด์เชิงกลยุทธ์)
export async function aiGrowthPlan(audit) {
  const topics = (audit.pages || []).slice(0, 8).map(p => p.title || p.h1).filter(Boolean);
  const comp = audit.competitor && !audit.competitor.error ? audit.competitor : null;
  const system = `คุณคือนักกลยุทธ์ SEO + Content ระดับซีเนียร์ในไทย วางแผนเติบโตจากผลตรวจเว็บไซต์ — เสนอ keyword เป้าหมายตาม search intent จริงของธุรกิจ, ประมาณการผลลัพธ์แบบ "อนุรักษ์นิยม" (ไม่โม้), และ workstream ที่ทีมจะ own ตอบ JSON เท่านั้น เป็นภาษาไทย`;
  const user = `เว็บไซต์: ${audit.url}
คะแนนปัจจุบัน: ${audit.score.overall}/100 (เกรด ${audit.score.grade}) · ปัญหาร้ายแรง ${audit.score.counts.fail} ข้อ
หัวข้อหน้าเว็บที่มี: ${JSON.stringify(topics)}
${comp ? `คู่แข่ง: ${comp.theirs.url} คะแนน ${comp.theirs.overall}` : ''}

ตอบ JSON:
{
  "keywordTargets": [
    {"keyword": "คีย์เวิร์ดเป้าหมายภาษาไทย/อังกฤษตาม intent ธุรกิจนี้", "intent": "Informational|Commercial|Transactional|Brand", "rationale": "ทำไมควรชิง สั้นๆ", "difficulty": "ง่าย|ปานกลาง|ยาก"}
  ],
  "projections": {
    "note": "สมมติฐานสั้นๆ ว่าประมาณการนี้ตั้งอยู่บนอะไร",
    "rows": [
      {"metric": "คะแนน SEO รวม", "now": "${audit.score.overall}", "m3": "...", "m6": "...", "m12": "..."},
      {"metric": "อันดับคีย์เวิร์ดที่ติด (ประมาณ)", "now": "...", "m3": "...", "m6": "...", "m12": "..."},
      {"metric": "การถูกอ้างถึงบน AI (AI Overview/ChatGPT)", "now": "...", "m3": "...", "m6": "...", "m12": "..."},
      {"metric": "ทราฟฟิก organic (แนวโน้ม)", "now": "...", "m3": "...", "m6": "...", "m12": "..."}
    ]
  },
  "workstreams": [
    {"n": "01", "title": "ชื่อ workstream", "detail": "ทำอะไร สั้นๆ"}
  ]
}
keywordTargets เอา 6-9 ตัว · workstreams เอา 6 ตัว · projections ต้องสมจริง อนุรักษ์นิยม`;
  try {
    const text = await callLLM(system, user, 2500, premiumModel());
    return { source: 'ai', ...extractJson(text) };
  } catch (e) {
    return { source: 'template', ...templateGrowth(audit) };
  }
}

function templateGrowth(audit) {
  const o = audit.score.overall;
  const proj = (base, m3, m6, m12) => ({ now: base, m3, m6, m12 });
  return {
    keywordTargets: [
      { keyword: 'คีย์เวิร์ดหลักของธุรกิจ', intent: 'Commercial', rationale: 'ชิงลูกค้าที่พร้อมซื้อ', difficulty: 'ปานกลาง' },
    ],
    projections: {
      note: 'ประมาณการอัตโนมัติจากคะแนนปัจจุบัน — ใส่ AI key เพื่อประมาณการรายเคส',
      rows: [
        { metric: 'คะแนน SEO รวม', ...proj(String(o), String(Math.min(o + 15, 80)), String(Math.min(o + 25, 88)), '90+') },
        { metric: 'การถูกอ้างถึงบน AI', ...proj('0', 'เริ่ม', '5+ หัวข้อ', '15+ หัวข้อ') },
      ],
    },
    workstreams: [
      { n: '01', title: 'Technical SEO Foundation', detail: 'SSR/render, robots, canonical, status, schema' },
      { n: '02', title: 'Structured Data & GEO', detail: 'JSON-LD, FAQ, llms.txt, เปิดรับ AI bots' },
      { n: '03', title: 'Content Architecture', detail: 'pillar + cluster ตาม intent ธุรกิจ' },
      { n: '04', title: 'Performance & CWV', detail: 'ไล่แก้ตาม opportunity ของ Lighthouse' },
      { n: '05', title: 'Authority Building', detail: 'ลิงก์จากสื่อ/พันธมิตรในอุตสาหกรรม' },
      { n: '06', title: 'Monitor & Report', detail: 'เฝ้าระวังอัตโนมัติ + รายงานก่อน/หลัง' },
    ],
  };
}

// AI สร้าง "เฉพาะค่าใน <head> + JSON-LD + alt" เป็น JSON (สำหรับ surgical fix)
// — output เล็ก ไม่ชน token cap, ใช้กับหน้าหนัก (100KB+) ได้ เพราะไม่ rewrite ทั้งหน้า
export async function aiGenerateHeadFix(html, url, issues, brand) {
  const system = `คุณคือ senior SEO engineer หน้าที่: ดู HTML ต้นฉบับ + ปัญหาที่พบ แล้วคืน "ค่าที่ถูกต้องสำหรับส่วน head" เป็น JSON เท่านั้น (เราจะเอาไป patch DOM เอง ไม่ต้องส่ง HTML กลับ)

กฎ:
- title 30-60 ตัวอักษร ขึ้นต้นคีย์เวิร์ดหลัก ลงท้ายแบรนด์ ภาษาเดียวกับเนื้อหา
- metaDescription 80-160 ตัวอักษร ประโยคธรรมชาติ มีเหตุผลให้คลิก
- canonical absolute URL ชี้ตัวเอง ตัด query/tracking ออก
- og ครบ (title/description/image absolute/url), twitterCard = summary_large_image
- jsonLd: array ของ schema.org object ที่ JSON.parse ผ่าน — อย่างน้อย Organization (name,url,logo) + WebSite; ถ้าหน้ามีถาม-ตอบใส่ FAQPage; ห้ามแต่งข้อเท็จจริง (เบอร์/ที่อยู่/ราคา) ที่ไม่มีในหน้า
- imageAlts: map จาก "ส่วนหนึ่งของ src (เช่นชื่อไฟล์)" → alt บรรยายรูปจริง เลือกเฉพาะรูปเนื้อหาสำคัญ (ข้ามไอคอน/รูปตกแต่ง) ไม่เกิน 15 รายการ
- lang = รหัสภาษาเนื้อหาจริง (เช่น th)

ตอบ JSON นี้เท่านั้น:
{"title":"","metaDescription":"","canonical":"","lang":"th","og":{"title":"","description":"","image":"","url":""},"twitterCard":"summary_large_image","jsonLd":[],"imageAlts":{}}`;
  const user = `URL: ${url}
แบรนด์: ${brand}
ปัญหา:
${issues.map(i => `- [${i.severity}] ${i.title}: ${i.detail}`).join('\n')}

HTML ต้นฉบับ (ตัดท้ายได้):
${html.slice(0, 45000)}`;
  const text = await callLLM(system, user, 3000);
  return extractJson(text);
}

// AI สร้าง "หน้าเว็บฉบับแก้แล้ว" ทั้งหน้า จาก HTML จริง + ปัญหาที่ตรวจพบ
export async function aiGenerateFixedPage(html, url, issues, brand) {
  const system = `คุณคือ senior web engineer + SEO specialist หน้าที่: รับ HTML ต้นฉบับและรายการปัญหา แล้วส่งคืน HTML ฉบับแก้สมบูรณ์ทั้งไฟล์ ตามมาตรฐาน Google Search Essentials

ธรรมนูญ SEO ที่ต้องทำตามทุกข้อ:
1. <title> 30-60 ตัวอักษร ขึ้นต้นด้วยคีย์เวิร์ดหลักของหน้า ลงท้ายด้วยชื่อแบรนด์ ห้าม keyword stuffing — ภาษาเดียวกับเนื้อหาหน้า
2. meta description 80-160 ตัวอักษร สรุปคุณค่าของหน้า + เหตุผลให้คลิก เขียนเป็นประโยคธรรมชาติ
3. H1 ต้องมี "หนึ่งอันเท่านั้น" สื่อหัวเรื่องหลัก และลำดับ heading ห้ามข้ามระดับ (H1→H2→H3)
4. canonical เป็น absolute URL ชี้ตัวเอง (ตัด query/tracking params ออก) มีอันเดียว
5. <html lang> ตรงกับภาษาเนื้อหาจริง, มี <meta charset> เป็น tag แรกๆ ใน head, มี viewport มาตรฐาน (ห้าม maximum-scale/user-scalable=no)
6. Open Graph ครบ: og:title, og:description, og:image (absolute URL), og:url + twitter:card=summary_large_image
7. JSON-LD ตาม schema.org: Organization (name, url, logo) + WebSite และถ้าหน้ามีเนื้อหาถาม-ตอบให้ใส่ FAQPage ด้วย — เนื้อใน script ต้อง JSON.parse ผ่าน 100% ห้ามมี comment ใดๆ ในก้อน JSON
8. ทุก <img> ต้องมี alt บรรยายรูปจริง (เดาจากบริบท/ชื่อไฟล์ ถ้าเป็นรูปตกแต่งใช้ alt="")
9. ลิงก์ anchor text ห้ามเป็น "คลิกที่นี่/read more" เปล่าๆ — ถ้าแก้ได้โดยไม่เปลี่ยนความหมาย ให้ใส่ข้อความสื่อปลายทาง
10. ถ้าเนื้อหาหลักถูก render ด้วย JS (SPA shell) ให้เพิ่มเนื้อหา fallback แบบ static HTML ใน body จากข้อมูลที่มี

กติกาเหล็ก:
- คงเนื้อหา ข้อความ โครงสร้าง และ asset เดิมไว้ทั้งหมด ห้ามตัดทิ้ง ห้ามแต่งข้อเท็จจริงใหม่ (เบอร์โทร ที่อยู่ ราคา ห้ามมโน)
- ห้ามใส่ noindex, ห้ามเปลี่ยน URL ของลิงก์/รูปเดิม
- ใส่ comment <!-- FIXED: ... --> ตรงทุกจุดที่แก้ (ยกเว้นในก้อน JSON-LD — วาง comment ก่อนเปิด tag แทน)
- ตอบกลับเป็น HTML ล้วนทั้งไฟล์ ห้ามมีคำอธิบายนอก HTML ห้ามใช้ markdown code fence`;
  const user = `URL: ${url}
แบรนด์: ${brand}
ปัญหาที่ตรวจพบ:
${issues.map(i => `- [${i.severity}] ${i.title}: ${i.detail}`).join('\n')}

HTML ต้นฉบับ (อาจถูกตัดท้าย):
${html.slice(0, 45000)}`;
  const text = await callLLM(system, user, 16000);
  // กัน LLM เผลอใส่ code fence
  return text.replace(/^```html?\s*/i, '').replace(/```\s*$/, '').trim();
}

// สร้าง meta title/description ใหม่รายหน้า (ใช้ใน Auto-Fix)
export async function aiGenerateMeta(pages, siteUrl) {
  const items = pages.slice(0, 15).map(p => ({
    url: p.url, currentTitle: p.title || '(ไม่มี)',
    currentDesc: p.metas?.['description'] || '(ไม่มี)',
    h1: p.headings?.find(h => h.tag === 'h1')?.text || '',
    contentSample: (p.textSample || '').slice(0, 400),
  }));
  const system = `คุณคือ SEO copywriter มืออาชีพ เขียน meta title/description ภาษาเดียวกับเนื้อหาหน้านั้น (ไทยหรืออังกฤษ) ที่ทั้งติดอันดับและคนอยากคลิก ตอบ JSON เท่านั้น`;
  const user = `เว็บ: ${siteUrl}
หน้าที่ต้องเขียนใหม่:
${JSON.stringify(items, null, 1)}

กติกา: title 30-60 ตัวอักษร ขึ้นต้นคีย์เวิร์ดหลักของหน้า, description 80-160 ตัวอักษร มี benefit + call-to-action
ตอบ JSON: {"pages":[{"url":"...","title":"...","description":"...","reason":"ทำไมเขียนแบบนี้ 1 ประโยค"}]}`;
  try {
    const text = await callLLM(system, user, 4000);
    return { source: 'ai', ...extractJson(text) };
  } catch (e) {
    // fallback: สร้างจาก H1 + ชื่อโดเมน
    const brand = (() => { try { return new URL(siteUrl).hostname.replace(/^www\./, '').split('.')[0]; } catch { return ''; } })();
    return {
      source: 'template', error: String(e.message || e),
      pages: items.map(p => ({
        url: p.url,
        title: p.h1 ? `${p.h1.slice(0, 45)} | ${brand}` : `(ต้องเขียนเอง — ไม่มี H1 ให้อ้างอิง)`,
        description: p.contentSample ? p.contentSample.slice(0, 150) : '(ต้องเขียนเอง)',
        reason: 'สร้างจาก H1/เนื้อหาอัตโนมัติ (ไม่มี AI key)',
      })),
    };
  }
}
