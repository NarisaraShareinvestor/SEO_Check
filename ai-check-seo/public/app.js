// SEO Audit — frontend logic (clean SaaS edition)
let currentAudit = null;
let pollTimer = null;
let evidenceMap = {};   // url → {raw, rendered} ของ HTML snapshot ที่เก็บไว้ตอนตรวจ (Evidence Drawer)
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripEmoji = (s) => String(s ?? '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();

// ── สถานะ AI ──
fetch('/api/health').then(r => r.json()).then(h => {
  $('#aiStatus').textContent = h.aiAvailable ? 'AI วิเคราะห์เชิงลึก — พร้อม' : 'AI — ยังไม่ได้ใส่ API key';
  $('#aiDot').classList.toggle('off', !h.aiAvailable);
}).catch(() => { $('#aiStatus').textContent = 'ออฟไลน์'; });

// ── sidebar views ──
function showView(btn) {
  document.querySelectorAll('.nitem[data-view]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  btn.classList.add('active');
  const view = $('#view-' + btn.dataset.view);
  view.classList.add('active');
  // doc pages render full-bleed (main fills the whole area); other views stay in the 1240 column
  const isDoc = ['methodology', 'architecture', 'knowledge'].includes(btn.dataset.view);
  document.querySelector('main').classList.toggle('docmode', isDoc);
  // lazy-load embedded doc pages (methodology / architecture) on first open
  const frame = view.querySelector('iframe.docframe[data-src]');
  if (frame && !frame.src) frame.src = frame.dataset.src;
  if (btn.dataset.view === 'history') loadHistory();
  if (btn.dataset.view === 'dashboard') loadDashboard();
  if (btn.dataset.view === 'quality') loadQuality();
}

// ── เริ่ม audit ──
async function startAudit(url) {
  url = url || $('#urlInput').value.trim();
  if (!url) { $('#urlInput').focus(); return; }
  $('#startBtn').disabled = true;
  $('#progress').style.display = 'block';
  $('#progress').innerHTML = '<div>กำลังส่งงาน…</div>';
  $('#result').style.display = 'none';
  try {
    const res = await fetch('/api/audit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, maxPages: +$('#maxPages').value, competitorUrl: $('#compInput').value.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'เริ่มตรวจไม่สำเร็จ');
    poll(data.id);
  } catch (e) {
    $('#progress').innerHTML = `<div>ผิดพลาด — ${esc(e.message)}</div>`;
    $('#startBtn').disabled = false;
  }
}

// Agent Run Tracker — แสดงทุก step ทำงาน real-time + ลิงก์ evidence (ไม่ใช่กล่องดำ)
function renderRunSteps(steps, progress) {
  const ICON = { done: '✓', error: '✕', run: '◌' }, COL = { done: '#15803d', error: '#b91c1c', run: '#b45309' };
  const fmt = ms => ms == null ? '…' : ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms';
  const rows = (steps || []).map(s => {
    const ic = ICON[s.status] || '·', col = COL[s.status] || '#888';
    const spin = s.status === 'run' ? ' style="display:inline-block;animation:rspin 1s linear infinite"' : '';
    const ev = s.evidence ? ` · <a href="${s.evidence}" target="_blank" rel="noopener" style="color:#c2410c;text-decoration:none">หลักฐาน ↗</a>` : '';
    return `<div style="display:flex;gap:9px;align-items:baseline;padding:5px 0;border-bottom:1px solid #f0ece6">
      <span${spin} style="color:${col};font-family:monospace;font-weight:700;width:14px;flex:none;text-align:center">${ic}</span>
      <span><b>${esc(s.name)}</b>${s.out ? ' — ' + esc(s.out) : ''} <span style="opacity:.55;font-family:monospace;font-size:.85em">${fmt(s.ms)}</span>${ev}</span></div>`;
  }).join('');
  const tail = (progress || []).slice(-3).map(p => `<div style="opacity:.45;font-size:.82em;padding-top:2px">· ${esc(p.msg)}</div>`).join('');
  return rows + tail;
}

function poll(id) {
  clearInterval(pollTimer);
  let es = null, finished = false;
  const box = () => $('#progress');
  const renderState = (job) => {
    const steps = job.steps || job.result?.run;
    box().innerHTML = steps && steps.length
      ? renderRunSteps(steps, job.progress)
      : (job.progress || []).slice(-12).map(p => `<div>· ${esc(p.msg)}</div>`).join('');
    box().scrollTop = box().scrollHeight;
  };
  const finish = async () => {
    if (finished) return; finished = true;
    if (es) es.close(); clearInterval(pollTimer);
    $('#startBtn').disabled = false;
    let job; try { job = await (await fetch('/api/audit/' + id)).json(); } catch { return; }
    if (job.status === 'done') {
      // คงแถบ run tracker ไว้ (evidence link ใช้ได้หลังเซฟ) เพื่อติดตามย้อนหลัง
      box().innerHTML = `<div style="font-weight:650;color:#15803d;margin-bottom:6px">✓ รันครบ ${(job.result?.run || []).length} step — คลิก “หลักฐาน” ดูผลแต่ละขั้นได้</div>` + renderRunSteps(job.result?.run || [], []);
      render(job.result);
      $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (job.status === 'error') {
      box().innerHTML += `<div style="color:#b91c1c">ผิดพลาด — ${esc(job.error)}</div>`;
    }
  };
  const onState = (job) => { renderState(job); if (job.status === 'done' || job.status === 'error') finish(); };
  const startPolling = () => {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => { try { onState(await (await fetch('/api/audit/' + id)).json()); } catch {} }, 900);
  };
  // SSE ก่อน (push real-time) · ถ้าเปิดไม่ได้/พังกลางคัน → fallback polling
  if (window.EventSource) {
    try {
      es = new EventSource('/api/audit/' + id + '/stream');
      es.onmessage = (e) => { try { onState(JSON.parse(e.data)); } catch {} };
      es.onerror = () => { if (!finished) { try { es.close(); } catch {} es = null; startPolling(); } };
    } catch { startPolling(); }
  } else startPolling();
}

function rescan() { if (currentAudit) { $('#urlInput').value = currentAudit.url; startAudit(currentAudit.url); window.scrollTo({ top: 0, behavior: 'smooth' }); } }

// ── ค้นหาคู่แข่งอัตโนมัติ ──
async function discoverComp() {
  const url = $('#urlInput').value.trim();
  if (!url) { $('#urlInput').focus(); $('#compSuggest').innerHTML = '<div class="hint">ใส่ URL เว็บของคุณก่อน แล้วกดหาคู่แข่งอีกครั้ง</div>'; return; }
  const btn = $('#discoverBtn');
  btn.disabled = true; btn.textContent = 'กำลังค้นหา…';
  $('#compSuggest').innerHTML = '<div class="hint">กำลังวิเคราะห์ธุรกิจและค้นหาเว็บอุตสาหกรรมเดียวกัน (~15-30 วินาที)…</div>';
  try {
    const res = await fetch('/api/discover', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
    const { id, error } = await res.json();
    if (!res.ok) throw new Error(error || 'เริ่มค้นหาไม่สำเร็จ');
    const timer = setInterval(async () => {
      try {
        const job = await (await fetch('/api/discover/' + id)).json();
        if (job.status === 'running') {
          const last = job.progress[job.progress.length - 1];
          if (last) $('#compSuggest').innerHTML = `<div class="hint">${esc(last)}</div>`;
          return;
        }
        clearInterval(timer);
        btn.disabled = false; btn.textContent = 'หาคู่แข่งอัตโนมัติ';
        if (job.status === 'error') { $('#compSuggest').innerHTML = `<div class="hint">${esc(job.error)}</div>`; return; }
        renderCandidates(job.result);
      } catch {}
    }, 1200);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'หาคู่แข่งอัตโนมัติ';
    $('#compSuggest').innerHTML = `<div class="hint">${esc(e.message)}</div>`;
  }
}

function renderCandidates(result) {
  const cands = result.candidates || [];
  if (!cands.length) { $('#compSuggest').innerHTML = '<div class="hint">ไม่พบคู่แข่งที่ชัดเจน — ลองใส่ URL เอง</div>'; return; }
  $('#compSuggest').innerHTML = `
    ${result.notice ? `<div class="hint" style="color:#b45309">${esc(result.notice)}</div>` : ''}
    <div class="hint">พบผู้สมัคร ${cands.length} ราย${result.aiRanked ? ' (AI คัดกรองแล้ว)' : ''} — คลิกเพื่อเลือกเป็นคู่เทียบ:</div>
    ${cands.map(c => `
      <div class="cand" data-url="${esc(c.url)}" onclick="pickCandidate(this)">
        <span class="dom">${esc(c.domain)}</span>
        <span class="why">${esc(c.reason || c.snippet || '')}</span>
        <span class="pick">เลือก</span>
      </div>`).join('')}`;
}

function pickCandidate(el) {
  $('#compInput').value = el.dataset.url;
  document.querySelectorAll('.cand').forEach(c => c.classList.remove('picked'));
  el.classList.add('picked');
  el.querySelector('.pick').textContent = 'เลือกแล้ว — กด "เริ่มตรวจ" ได้เลย';
}

// ตรวจเว็บตัวอย่างที่จงใจฝังปัญหา SEO ไว้ — ไว้เดโม่ระบบให้ลูกค้าดู
function runDemo() {
  document.querySelectorAll('.nitem[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'scan'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('#view-scan').classList.add('active');
  const demoUrl = location.origin + '/demo/index.html';
  $('#urlInput').value = demoUrl;
  $('#maxPages').value = '10';
  startAudit(demoUrl);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── render ──
function render(audit) {
  currentAudit = audit;
  $('#result').style.display = 'block';
  $('#resultTitle').textContent = audit.url.replace(/^https?:\/\//, '');
  $('#resultDate').textContent = `ตรวจ ${audit.pagesAnalyzed} หน้า · ${new Date(audit.createdAt).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}`;

  // เข้าเว็บไม่ได้ — โชว์ card แจ้งชัด + ปุ่มลองใหม่ ไม่โชว์เกรด F หลอกตา
  if (audit.unreachable) {
    const info = audit.unreachableInfo || {};
    // โชว์วิธีตั้ง relay ทั้งกรณี geo-block และกรณีโดน WAF/rate-limit (403/429/503/401) — วิธีแก้เดียวกัน
    const wafBlock = (info.statuses || []).some(s => s === 403 || s === 429 || s === 503 || s === 401);
    const geoHint = (info.geoBlock || wafBlock) ? `
          <div class="unreachable-geo">
            <b>วิธีแก้: ตั้ง Cloudflare Worker relay</b>
            <ol>
              <li>ไปที่ <code>dashboard.cloudflare.com</code> &rarr; Workers &amp; Pages &rarr; Create Worker</li>
              <li>วางโค้ดจากไฟล์ <code>cloudflare-worker/worker.js</code> ในโปรเจคนี้ แล้วกด Deploy</li>
              <li>เพิ่มบรรทัดนี้ใน <code>.env</code>:<br><code>CRAWL_PROXY=https://&lt;worker-name&gt;.&lt;account&gt;.workers.dev</code></li>
              <li>รีสตาร์ทเซิร์ฟเวอร์ แล้วลองตรวจใหม่</li>
            </ol>
            <p class="unreachable-meta">Worker รันบน edge Cloudflare ใกล้กับเซิร์ฟเวอร์เป้าหมาย — ใช้ฟรีได้ถึง 100,000 req/วัน</p>
          </div>` : '';
    $('#statRow').innerHTML = `
      <div class="unreachable-card">
        <div class="unreachable-icon">&#9888;</div>
        <div class="unreachable-body">
          <b>${info.geoBlock ? 'บล็อก IP ต่างประเทศ (geo-block) — ยังไม่ได้ประเมิน SEO' : wafBlock ? 'เว็บบล็อกการตรวจ (WAF/rate-limit) — ยังไม่ได้ประเมิน SEO' : 'เข้าถึงเว็บไซต์ไม่ได้ — ยังไม่ได้ประเมิน SEO'}</b>
          <p>${esc(info.message || 'crawl ไม่พบหน้าที่ตอบ 200')}</p>
          <p class="unreachable-meta">พยายามเชื่อมต่อ ${info.errors || 0} ครั้ง · ไม่ได้หน้าเลย${info.statuses?.length ? ` · สถานะที่เจอ: ${info.statuses.join(', ')}` : ''}</p>
          ${geoHint}
          <button class="btn-retry" onclick="startAudit('${esc(audit.url)}');window.scrollTo({top:0,behavior:'smooth'});">ลองตรวจใหม่อีกครั้ง</button>
        </div>
      </div>`;
    $('#catBars').innerHTML = '';
    ['#verifyBox', '#deltaBox', '#aibox', '#checksList', '#filterbar', '#pagesBody', '#compareBox', '#fixesList'].forEach(id => { const el = $(id); if (el) el.innerHTML = ''; });
    loadHistory();
    return;
  }

  const s = audit.score;
  const scoreColor = s.overall >= 75 ? 'green' : s.overall >= 50 ? 'amber' : 'red';
  $('#statRow').innerHTML = `
    <div class="stat"><div class="lb">คะแนนรวม</div><div class="v ${scoreColor}">${s.overall}<small> /100</small></div></div>
    <div class="stat"><div class="lb">เกรด</div><div class="v">${s.grade}</div></div>
    <div class="stat"><div class="lb">Fail</div><div class="v red">${s.counts.fail}</div></div>
    <div class="stat"><div class="lb">Warn</div><div class="v amber">${s.counts.warn}</div></div>
    <div class="stat"><div class="lb">Pass</div><div class="v green">${s.counts.pass}</div></div>`;

  $('#catBars').innerHTML = Object.entries(s.categoryScores).map(([cat, sc]) => `
    <div class="cat">
      <span>${esc(audit.categories[cat] || cat)}</span>
      <div class="track"><div class="fill ${sc < 50 ? 'low' : sc < 75 ? 'mid' : ''}" style="width:${sc}%"></div></div>
      <b>${sc}</b>
    </div>`).join('');

  renderVerify(audit);
  // SPA ที่ render ไม่สำเร็จ → ได้แค่โครงเปล่า ผลไม่สะท้อนของจริง เตือนดังๆ (แม้ไม่มี audit ครั้งก่อนเทียบ)
  if (audit.renderFailedSpa) {
    const vb = $('#verifyBox');
    if (vb) vb.insertAdjacentHTML('afterbegin', `<div class="card" style="border-left:4px solid #b91c1c;background:#fef2f2;margin-bottom:12px"><b style="color:#b91c1c">🛑 ผลตรวจไม่สมบูรณ์</b> <span style="font-size:13px;color:var(--mut)">เว็บนี้เป็น SPA (เนื้อหา render ด้วย JS) แต่ครั้งนี้ render ไม่สำเร็จ (อาจโดน rate-limit/timeout) — ได้แค่ ${audit.pagesAnalyzed} หน้าโครงเปล่า คะแนนจึงไม่สะท้อนของจริง <b>กรุณาตรวจใหม่อีกครั้ง</b></span></div>`);
  }
  renderDelta(audit);
  renderAi(audit.analysis);
  renderChecks(audit);
  loadEvidenceMap(audit.id);   // async — เมื่อโหลด index เสร็จ จะ re-render checks พร้อมลิงก์ HTML snapshot
  renderPages(audit);
  renderCompare(audit);
  renderFixes(audit);
  loadHistory();
  refreshWatch();
}

// ── Audit Quality: โชว์ผล cross-check กับ Google + flag ต้องรีวิว (#7) ──
function renderVerify(audit) {
  const box = $('#verifyBox'); if (!box) return;
  const v = audit.verify, needs = audit.verifyMeta?.needsVerify || 0;
  if (!v) { box.innerHTML = ''; return; }
  if (v.flag) {
    box.innerHTML = `<div style="background:#fff4e5;border:1px solid #f0b67a;border-radius:10px;padding:12px 16px;margin:10px 0;font-size:14px">
      <b style="color:#b45309">⚠️ Audit Quality — ควรรีวิวก่อนส่งลูกค้า</b>
      <div style="margin-top:4px">ผลตรวจ ${v.factMismatches.length} จุดต่างจาก Google Lighthouse: ${v.factMismatches.map(esc).join(' · ')}</div>
      ${needs ? `<div style="margin-top:2px;color:#777">${needs} check ความเชื่อมั่นต่ำ — ดูป้าย ⚠️ ในรายการตรวจด้านล่าง</div>` : ''}</div>`;
  } else {
    box.innerHTML = `<div style="background:#eef9f0;border:1px solid #a8d8b0;border-radius:10px;padding:12px 16px;margin:10px 0;font-size:14px">
      <b style="color:#15803d">✓ ตรวจสอบความถูกต้องกับ Google Lighthouse แล้ว</b>
      <div style="margin-top:4px;color:#555">ข้อเท็จจริงหลักตรงกับ Google ${v.factAgree}/${v.factComparable} จุด${v.seoScore != null ? ` · Lighthouse SEO: ${v.seoScore}` : ''}${v.criteria?.length ? ` · เกณฑ์ที่เราเข้มกว่า: ${v.criteria.map(esc).join(', ')}` : ''}</div></div>`;
  }
}
const confBadge = (ch) => ch._confidence == null ? '' : `<span title="ความเชื่อมั่น ${ch._confidence}% · ${ch._type}${ch._needsVerify ? ' — ต่างจาก Google ควรรีวิว' : ''}" style="font-size:11px;margin-left:6px;padding:1px 6px;border-radius:6px;background:${ch._needsVerify ? '#fde2e2;color:#c0392b' : ch._confidence >= 95 ? '#e6f4ea;color:#15803d' : '#f0f0f0;color:#888'}">${ch._needsVerify ? '⚠️ รีวิว ' : ''}${ch._confidence}%</span>`;
// Evidence-Based engine: confidence (0–1) + reasoning ต่อ finding → โชว์ให้คนติดตามได้ว่า "ทำไมตัดสินแบบนี้"
const evConfChip = (ch) => {
  if (ch.confidence == null) return '';
  const c = Math.round(ch.confidence * 100);
  const col = c >= 80 ? '#e6f4ea;color:#15803d' : c >= 60 ? '#fff4e0;color:#b26b00' : '#fde2e2;color:#c0392b';
  return `<span title="ความเชื่อมั่นจากหลักฐาน ${c}%${c < 60 ? ' — ควรเปิดหน้าเว็บดูยืนยัน' : ''}" style="font-size:11px;margin-left:6px;padding:1px 6px;border-radius:6px;background:${col}">conf ${c}%</span>`;
};
const reasonBlock = (ch) => {
  if (!ch.reasoning) return '';
  const r = ch.reasoning;
  const sig = r.signals ? Object.entries(r.signals).map(([k, v]) => `<code>${esc(k)}=${esc(String(v))}</code>`).join(' ') : '';
  return `<div class="reasonln"><b>ทำไมตัดสินแบบนี้</b> ${sig}${r.standard ? `<div class="rstd">เกณฑ์: ${esc(r.standard)}</div>` : ''}${r.note ? `<div class="rnote">${esc(r.note)}</div>` : ''}</div>`;
};
// Evidence Drawer: ลิงก์ไป HTML snapshot จริงที่เซิร์ฟเวอร์เก็บไว้ตอนตรวจ → "นี่คือหลักฐานที่เราเห็น ไม่ได้มั่ว"
// pageStr อาจมี suffix เช่น "https://… (8 รูป)" → จับ url ที่ขึ้นต้นแทน match ตรงตัว
// map check id → field ที่จะ focus ใน Evidence View (กด finding ไหน เห็นเฉพาะข้อมูลที่เกี่ยว)
const focusForCheck = (id = '') => {
  if (/^title-h1/.test(id)) return 'titleh1';
  if (/^title/.test(id)) return 'title';
  if (/^h1|^heading|empty-headings/.test(id)) return 'h1';
  if (/desc|description/.test(id)) return 'desc';
  if (/canonical/.test(id)) return 'canonical';
  if (/noindex|robots/.test(id)) return 'robots';
  if (/^img|image/.test(id)) return 'images';
  if (/schema|jsonld/.test(id)) return 'schema';
  if (/content-thin|text-ratio/.test(id)) return 'content';
  if (/lang/.test(id)) return 'lang';
  return '';
};
const evidenceLink = (pageStr, ch) => {
  const id = currentAudit && currentAudit.id;
  if (!id || !pageStr) return '';
  const url = Object.keys(evidenceMap).find(u => pageStr === u || pageStr.startsWith(u));
  const e = url && evidenceMap[url];
  if (!e) return '';
  const f = ch ? focusForCheck(ch.id) : '';
  // ส่งทั้ง field (focus) + หน้านี้ (p) → Evidence View โชว์เฉพาะหน้านี้+field ที่เกี่ยว ไม่ปนหน้าที่ไม่เกี่ยว
  const params = [];
  if (f) params.push('focus=' + f);
  if (typeof e.i === 'number') params.push('p=' + e.i);
  const q = params.length ? '?' + params.join('&') : '';
  return `<span class="evsnap"> · <a href="/evidence/${id}${q}" target="_blank" rel="noopener" title="ข้อมูลที่ระบบดึงจากหน้านี้ เฉพาะส่วนที่เกี่ยวกับ finding นี้">🔎 หลักฐาน</a></span>`;
};
async function loadEvidenceMap(id) {
  evidenceMap = {};
  if (!id) return;
  try {
    const idx = await (await fetch('/api/evidence/' + id)).json();
    (idx.pages || []).forEach((p, i) => { if (p.url) evidenceMap[p.url] = { raw: p.raw, rendered: p.rendered, i }; });
    if (Object.keys(evidenceMap).length && currentAudit && currentAudit.id === id) renderChecks(currentAudit);
  } catch { /* audit เก่าไม่มี evidence — ไม่เป็นไร ลิงก์ไม่ขึ้น */ }
}

// ── เทียบก่อน/หลังแก้ (delta) — แยก "แก้/แย่จริง" ออกจาก "เปลี่ยนเพราะตรวจไม่เท่ากัน/อัปเกรด/ค่าผันผวน" ──
function renderDelta(audit) {
  const d = audit.delta;
  const box = $('#deltaBox');
  if (!d) { box.innerHTML = ''; return; }
  const col = d.scoreDelta > 0 ? 'var(--green)' : d.scoreDelta < 0 ? 'var(--red)' : '#a1a1aa';
  const stTH = (s) => ({ '—': 'ไม่มี', 'pass': 'ผ่าน', 'ok': 'ผ่าน', 'warn': 'เตือน', 'fail': 'ตก', 'info': 'ข้อมูล' }[s] || s);
  const arrow = (f, t) => `<span style="color:var(--mut)">${stTH(f)}</span> → <b>${stTH(t)}</b>`;
  const real = [...(d.fixed || []), ...(d.regressed || []), ...(d.newIssues || [])];
  const badReal = (d.regressed || []).length + (d.newIssues || []).length;
  const exp = d.explained || [];
  // เหตุผลของ explained → ข้อความภาษาคน
  const reasonTH = (e) => {
    if (e.reason === 'scope') return `เพิ่งตรวจถึง (ตรวจ ${d.scope?.prevPages}→${d.scope?.currPages} หน้า)`;
    if (e.reason === 'unstable') return e.id === 'cwv-score' ? 'ค่าความเร็วผันผวนจาก Google' : 'ผลตรวจไม่เสถียร (เน็ต/ค่าวัด) — ควรยืนยันเอง';
    if (e.reason === 'engine') return 'ระบบอัปเกรดวิธีตรวจ';
    return 'เปลี่ยนจากการตรวจที่ต่างกัน';
  };
  const line = (e, c) => `<div style="font-size:12.5px;color:${c};margin-top:4px">• ${esc(stripEmoji(e.title))} <span style="color:var(--mut)">(${arrow(e.from, e.to ?? e.status)})</span></div>`;
  box.innerHTML = `
    <div class="card" style="border-left:4px solid ${col}">
      <div class="chead">
        <h3>เทียบกับการตรวจครั้งก่อน (${new Date(d.prevDate).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })})</h3>
        <span class="meta">คะแนน ${d.prevScore} &rarr; <b style="color:${col};font-size:16px">${d.currScore}</b> (${d.scoreDelta >= 0 ? '+' : ''}${d.scoreDelta})</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        ${chip('pass', 'แก้สำเร็จจริง ' + (d.fixed || []).length + ' ข้อ')}
        ${badReal ? chip('fail', 'แย่ลงจริง ' + badReal + ' ข้อ') : chip('gray', 'ไม่มีปัญหาใหม่จริง')}
      </div>
      ${d.scope?.degraded ? `<div style="font-size:12.5px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:8px 11px;border-radius:7px;margin-top:8px">🛑 ครั้งนี้ตรวจได้แค่ <b>${d.scope.currPages} หน้า</b> (ปกติ ${d.scope.prevPages} หน้า) — น่าจะ render ไม่สำเร็จ/โดน rate-limit <b>ผลไม่สมบูรณ์ ควรตรวจใหม่</b> · การเปลี่ยนแปลงด้านล่างมาจากตรวจไม่ครบ ไม่ใช่เว็บแย่ลง</div>` : ''}
      ${!d.scope?.degraded && d.scoreDelta !== 0 && !real.length && exp.length ? `<div style="font-size:12.5px;color:#a16207;background:#fffbeb;border:1px solid #fde68a;padding:7px 11px;border-radius:7px;margin-top:8px">⚠️ คะแนนต่าง ${Math.abs(d.scoreDelta)} แต้ม มาจากผลตรวจที่ไม่เสถียร/ตรวจไม่เท่ากัน (${exp.map(e => esc(stripEmoji(e.title))).join(', ')}) — <b>ไม่ใช่เว็บเปลี่ยนจริง</b></div>` : ''}
      ${(d.fixed || []).length ? `<div style="margin-top:8px"><div style="font-size:12px;font-weight:600;color:#16a34a">✓ แก้สำเร็จจริง</div>${d.fixed.map(e => line(e, '#16a34a')).join('')}</div>` : ''}
      ${badReal ? `<div style="margin-top:8px"><div style="font-size:12px;font-weight:600;color:var(--red)">✗ แย่ลง/ปัญหาใหม่จริง</div>${[...d.regressed, ...d.newIssues].map(e => line(e, 'var(--red)')).join('')}</div>` : ''}
      ${!real.length && !exp.length ? `<div style="font-size:12.5px;color:var(--mut);margin-top:8px">ไม่มีอะไรเปลี่ยนแปลง</div>` : ''}
      ${exp.length ? `
        <details style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
          <summary style="cursor:pointer;font-size:12.5px;color:var(--mut);font-weight:500">ℹ️ ทำไม ${exp.length} อย่างเปลี่ยน ทั้งที่อาจไม่ได้แก้เว็บ ▾</summary>
          <div style="margin-top:6px">
            ${(d.scope?.grew || d.scope?.shrank) ? `<div style="font-size:11.5px;color:var(--mut);margin-bottom:4px">การตรวจ 2 ครั้งครอบคลุมหน้าไม่เท่ากัน (${d.scope.prevPages} → ${d.scope.currPages} หน้า)</div>` : ''}
            ${d.engineChanged ? `<div style="font-size:11.5px;color:var(--mut);margin-bottom:4px">ระบบมีการอัปเกรดวิธีตรวจระหว่าง 2 ครั้งนี้</div>` : ''}
            ${exp.map(e => `<div style="font-size:12px;color:var(--mut);margin-top:3px">• ${esc(stripEmoji(e.title))} <span style="opacity:.8">(${arrow(e.from, e.to)})</span> — <span style="color:#a16207">${reasonTH(e)}</span></div>`).join('')}
          </div>
        </details>` : ''}
    </div>`;
}

// ── Watchlist เฝ้าระวังอัตโนมัติ ──
let watchState = { list: [], lineReady: false };
const wNorm = (u) => String(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
async function refreshWatch() {
  try { watchState = await (await fetch('/api/watchlist')).json(); } catch { return; }
  updateWatchBtn(); renderWatchPanel();
}
const isWatched = (url) => watchState.list.some(w => wNorm(w.url) === wNorm(url));
function updateWatchBtn() {
  const btn = $('#watchBtn');
  if (!btn || !currentAudit) return;
  const on = isWatched(currentAudit.url);
  btn.textContent = on ? 'กำลังเฝ้าระวังทุก 7 วัน — กดเพื่อยกเลิก' : 'เฝ้าระวังอัตโนมัติ';
  btn.style.borderColor = on ? 'var(--green)' : '';
  btn.style.color = on ? 'var(--green)' : '';
}
async function toggleWatch() {
  if (!currentAudit) return;
  await fetch('/api/watchlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: currentAudit.url, intervalDays: 7, remove: isWatched(currentAudit.url) }) });
  refreshWatch();
}
async function removeWatch(url) {
  await fetch('/api/watchlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, remove: true }) });
  refreshWatch();
}
function renderWatchPanel() {
  const el = $('#watchPanel');
  if (!el) return;
  if (!watchState.list.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="card">
      <div class="chead">
        <h3>เฝ้าระวังอัตโนมัติ (${watchState.list.length} เว็บ)</h3>
        <span class="meta">${watchState.lineReady ? 'แจ้งเตือน LINE: เชื่อมต่อแล้ว' : 'แจ้งเตือน LINE: ใส่ LINE_CHANNEL_ACCESS_TOKEN และ LINE_USER_ID ใน .env เพื่อเปิดใช้'}</span>
      </div>
      ${watchState.list.map(w => `
        <div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-top:1px solid #f4f4f5;font-size:13.5px">
          <b style="flex:1">${esc(wNorm(w.url))}</b>
          <span style="color:var(--mut);font-size:12px">ตรวจทุก ${w.intervalDays} วัน · ครั้งล่าสุด: ${w.lastRun ? new Date(w.lastRun).toLocaleDateString('th-TH') + ' (' + (w.lastScore ?? '–') + ' คะแนน)' : 'รอรอบแรก'}</span>
          ${w.lastId ? `<button class="btn ghost sm" onclick="openAudit('${esc(w.lastId)}')">ดูผล</button>` : ''}
          <button class="btn ghost sm" onclick="removeWatch('${esc(w.url)}')">ยกเลิก</button>
        </div>`).join('')}
    </div>`;
}

// ── White-label (เก็บใน localStorage ของเครื่องนี้) ──
const brandGet = () => { try { return JSON.parse(localStorage.getItem('wl-brand')) || {}; } catch { return {}; } };
function saveBrand(btn) {
  localStorage.setItem('wl-brand', JSON.stringify({ name: $('#wlName').value.trim(), logo: $('#wlLogo').value.trim(), color: $('#wlColor').value.trim() }));
  btn.textContent = 'บันทึกแล้ว'; setTimeout(() => btn.textContent = 'บันทึก', 1500);
}
function loadBrandInputs() {
  const b = brandGet();
  if ($('#wlName')) { $('#wlName').value = b.name || ''; $('#wlLogo').value = b.logo || ''; $('#wlColor').value = b.color || ''; }
}
function brandQuery() {
  const b = brandGet(); const q = new URLSearchParams();
  if (b.name) q.set('bn', b.name);
  if (b.logo) q.set('bl', b.logo);
  if (b.color) q.set('bc', b.color);
  const qs = q.toString();
  return qs ? '?' + qs : '';
}
function reportUrl(id) { return '/report/' + id + brandQuery(); }
function saleReportUrl(id) { return '/report-sale/' + id + brandQuery(); }
function execReportUrl(id) { return '/report-exec/' + id + brandQuery(); }
function qaUrl(id) { return '/report-qa/' + id + brandQuery(); }
function presentUrl(id) { return '/present/' + id + brandQuery(); }

// ── ส่ง Action Items เข้า ClickUp (เฟส 1) ──
async function sendToClickUp() {
  if (!currentAudit) return;
  const btn = document.getElementById('clickupBtn');
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = 'กำลังส่ง…';
  try {
    const res = await fetch('/api/clickup/' + currentAudit.id, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'ส่งไม่สำเร็จ');
    if (d.dryRun) {
      const lines = (d.preview || []).map(p => `• [${p.priority}] ${p.name} → ${p.group}`).join('\n');
      alert(`ตัวอย่างแผนงาน (ยังไม่ได้ยิงเข้า ClickUp จริง)\n\nParent: ${d.parent}\nจะสร้าง ${d.subtasks} subtask\n\n${lines}${d.subtasks > 8 ? '\n…' : ''}\n\n${d.note}`);
    } else {
      const errTxt = (d.errors && d.errors.length) ? `\n⚠️ พลาด ${d.errors.length} รายการ` : '';
      alert(`ส่งเข้า ClickUp สำเร็จ ✅\n\nสร้าง Task เว็บ + ${d.created}/${d.total} subtask${errTxt}\n\nเปิดดู: ${d.parentUrl || '(ClickUp)'}`);
      if (d.parentUrl) window.open(d.parentUrl, '_blank');
    }
  } catch (e) {
    alert('ส่งเข้า ClickUp ไม่สำเร็จ: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

// ── เทียบคู่แข่ง ──
const FLAG_LABELS = {
  ssr: 'เนื้อหาอยู่ใน HTML ดิบ (SSR)', jsonld: 'Structured Data (JSON-LD)', orgSchema: 'Organization schema',
  faq: 'FAQ schema (GEO)', aiBots: 'เปิดรับ AI bots', llms: 'llms.txt',
  canonical: 'Canonical tags', sitemap: 'XML Sitemap', h1: 'H1 ครบทุกหน้า',
  desc: 'Meta description', og: 'Open Graph', trust: 'Trust pages (About/Contact)',
  eeat: 'E-E-A-T signals', cwv: 'Core Web Vitals',
};
function renderCompare(audit) {
  const comp = audit.competitor;
  $('#compTabBtn').style.display = comp ? '' : 'none';
  if (!comp) { $('#compareBox').innerHTML = ''; return; }
  if (comp.error) {
    $('#compareBox').innerHTML = `<div class="card"><div class="ai-label"><span class="spark"></span>เทียบคู่แข่ง</div><div class="hint">${esc(comp.error)}</div></div>`;
    return;
  }
  const { ours, theirs, commentary } = comp;
  const host = (u) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const rank = { pass: 0, warn: 1, fail: 2 };
  const stTh = { fail: 'Fail', warn: 'Warn', pass: 'Pass' };

  const rows = Object.entries(FLAG_LABELS).map(([k, label]) => {
    const u = ours.flags[k], t = theirs.flags[k];
    if (!u && !t) return '';
    const verdict = (u && t) ? (rank[u] < rank[t] ? chip('pass', 'เราชนะ') : rank[u] > rank[t] ? chip('fail', 'เราแพ้') : chip('gray', 'เสมอ')) : chip('gray', '–');
    return `<tr><td>${label}</td><td>${u ? chip(u, stTh[u]) : '–'}</td><td>${t ? chip(t, stTh[t]) : '–'}</td><td>${verdict}</td></tr>`;
  }).join('');

  const catRows = Object.entries(audit.categories).filter(([k]) => ours.categoryScores[k] != null || theirs.categoryScores[k] != null).map(([k, label]) => {
    const u = ours.categoryScores[k] ?? '–', t = theirs.categoryScores[k] ?? '–';
    const verdict = (typeof u === 'number' && typeof t === 'number') ? (u > t ? chip('pass', '+' + (u - t)) : u < t ? chip('fail', String(u - t)) : chip('gray', '0')) : '';
    return `<tr><td>${label}</td><td><b>${u}</b></td><td><b>${t}</b></td><td>${verdict}</td></tr>`;
  }).join('');

  const weWin = ours.overall >= theirs.overall;
  $('#compareBox').innerHTML = `
    <div class="vsrow">
      <div class="vscard ${weWin ? 'win' : ''}">
        <div class="who">เว็บของเรา</div>
        <div class="host">${esc(host(ours.url))}</div>
        <div class="big">${ours.overall}<small> /100 · เกรด ${ours.grade}</small></div>
        <div style="margin-top:6px">${chip('fail', 'Fail ' + ours.counts.fail)} ${chip('warn', 'Warn ' + ours.counts.warn)} ${chip('pass', 'Pass ' + ours.counts.pass)}</div>
      </div>
      <div class="vsmid">VS</div>
      <div class="vscard ${!weWin ? 'win' : ''}">
        <div class="who">คู่แข่ง</div>
        <div class="host">${esc(host(theirs.url))}</div>
        <div class="big">${theirs.overall}<small> /100 · เกรด ${theirs.grade}</small></div>
        <div style="margin-top:6px">${chip('fail', 'Fail ' + theirs.counts.fail)} ${chip('warn', 'Warn ' + theirs.counts.warn)} ${chip('pass', 'Pass ' + theirs.counts.pass)}</div>
      </div>
    </div>

    ${commentary ? `<div class="card cmt">
      <div class="ai-label"><span class="spark"></span>${commentary.source === 'ai' ? 'บทวิเคราะห์การแข่งขันโดย AI' : 'สรุปการแข่งขันอัตโนมัติ'}</div>
      <div class="ai-summary" style="font-size:14px">${esc(stripEmoji(commentary.summary))}</div>
      ${(commentary.battlePlan || []).length ? `<div style="margin-top:12px;font-weight:600;font-size:13.5px">แผนแซง</div><ol>${commentary.battlePlan.map(b => `<li>${esc(stripEmoji(b))}</li>`).join('')}</ol>` : ''}
    </div>` : ''}

    <div class="tcard" style="margin-bottom:18px">
      <table class="ptable">
        <thead><tr><th>ความสามารถ</th><th>เรา</th><th>คู่แข่ง</th><th>ผล</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="tcard">
      <table class="ptable">
        <thead><tr><th>คะแนนรายหมวด</th><th>เรา</th><th>คู่แข่ง</th><th>ต่าง</th></tr></thead>
        <tbody>${catRows}</tbody>
      </table>
    </div>`;
}

function renderAi(a) {
  if (!a) { $('#aibox').innerHTML = ''; return; }
  $('#aibox').innerHTML = `
    <div class="ai-label"><span class="spark"></span>${a.source === 'ai' ? 'บทวิเคราะห์โดย AI' : 'บทสรุปอัตโนมัติ — เพิ่ม API key เพื่อการวิเคราะห์เชิงลึก'}</div>
    <div class="ai-summary">${esc(stripEmoji(a.executiveSummary))}</div>
    ${(a.topPriorities || []).length ? `
    <table class="prio">
      <tr><th style="width:36px">#</th><th>ปัญหา</th><th>ผลกระทบต่อธุรกิจ</th><th style="width:80px">ความยาก</th><th style="width:110px">ช่วงเวลา</th></tr>
      ${a.topPriorities.map(p => `<tr><td><b>${p.rank}</b></td><td><b>${esc(stripEmoji(p.title))}</b></td><td>${esc(stripEmoji(p.businessImpact))}</td><td>${esc(p.effort)}</td><td>${esc(p.timeline)}</td></tr>`).join('')}
    </table>` : ''}
    ${(a.quickWins || []).length ? `<div class="qwins">${a.quickWins.map(q => `<span class="qwin">${esc(stripEmoji(q))}</span>`).join('')}</div>` : ''}
    ${a.strategicAdvice ? `<div class="strategy"><b>กลยุทธ์</b> — ${esc(stripEmoji(a.strategicAdvice))}</div>` : ''}`;
}

let statusFilter = 'all', catFilter = '', KG = {};
async function loadSkillGraph() {
  if (Object.keys(KG).length) return;
  try {
    const d = await (await fetch('/skill-graph.json')).json();
    (d.nodes || []).forEach(n => { if (n.type === 'rule') KG[n.id] = n; });
    if (currentAudit) renderChecks(currentAudit);
  } catch { /* ไม่มีก็ข้าม */ }
}
const SEV_ICON = { fail: '✕', warn: '!', pass: '✓', info: 'ⓘ' };
const ST_TH = { fail: 'Fail', warn: 'Warning', pass: 'Pass', info: 'Info' };
const clsOf = st => (st === 'fail' || st === 'warn' || st === 'pass') ? st : 'info';
function confPctOf(ch) {
  if (ch.confidence != null) return Math.round(ch.confidence * 100);
  if (ch._confidence != null) return ch._confidence;
  const k = KG[ch.id]; return k && k.conf != null ? k.conf : null;
}
function countOf(ch) {
  if (ch.affectedCount != null) return ch.affectedCount;
  if ((ch.groups || []).length) return ch.groups.reduce((s, g) => s + (g.pages || []).length, 0);
  return (ch.pages || []).length;
}
function firstPageOf(ch) {
  if ((ch.groups || []).length) return (ch.groups[0].pages || [])[0];
  if ((ch.evidence || []).length) return ch.evidence[0].url;
  return (ch.pages || [])[0];
}
function entityWord(ch) {
  const id = ch.id || '';
  if (/title/.test(id)) return 'title'; if (/desc/.test(id)) return 'description';
  if (/h1|heading/.test(id)) return 'H1'; return 'ค่า';
}
function setStatusFilter(k) { statusFilter = k; renderChecks(currentAudit); }
function setCatFilter(k) { catFilter = (catFilter === k ? '' : k); renderChecks(currentAudit); }
function toggleFinding(bar) { bar.closest('.finding').classList.toggle('open'); }

function evPageRow(u, ch) {
  return `<div class="evrow"><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a><span style="display:flex;gap:8px;align-items:center">${evidenceLink(u, ch)}<a class="seebtn" href="${esc(u)}" target="_blank" rel="noopener">ดูหน้า</a></span></div>`;
}
function evGroupsHTML(ch) {
  const g = ch.groups || [];
  const totalPages = g.reduce((s, x) => s + (x.pages || []).length, 0);
  const head = `<div class="eh"><b>${esc(entityWord(ch))}</b> ที่ซ้ำกัน — <b>${g.length} ค่า</b> (รวม ${totalPages} หน้า) · คลิกแต่ละค่าเพื่อกาง/พับ</div>`;
  const body = g.map((grp, i) => `<details class="dgroup" ${i === 0 ? 'open' : ''}><summary><span class="dchev">▾</span><span class="dval" title="${esc(String(grp.value || ''))}">"${esc(stripEmoji(String(grp.value || '(ว่าง)')))}"</span><span class="dn">ซ้ำ ${grp.pages.length} หน้า</span></summary><div class="dgb">${grp.pages.map(u => evPageRow(u, ch)).join('')}</div></details>`).join('');
  return `<div class="evbox">${head}${body}</div>`;
}
function evPagesHTML(ch) {
  const rows = (ch.evidence || []).length
    ? ch.evidence.map(e => `<div class="evrow"><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.url)}</a><span style="display:flex;gap:8px;align-items:center">${e.note ? `<span style="font-size:11px;color:var(--mut)">${esc(e.note)}</span>` : ''}${evidenceLink(e.url, ch)}<a class="seebtn" href="${esc(e.url)}" target="_blank" rel="noopener">ดูหน้า</a></span></div>`).join('')
    : (ch.pages || []).map(p => evPageRow(p, ch)).join('');
  if (!rows) return '<div class="dbody-empty">— ไม่มีรายการหน้า —</div>';
  const label = ch.status === 'pass' ? 'หน้าที่ตรวจ' : 'หน้าที่พบ';
  return `<div class="evbox"><div class="eh">${label} (${(ch.evidence || ch.pages || []).length})</div>${rows}</div>`;
}
function evidenceInline(ch) {
  return (ch.groups || []).length ? evGroupsHTML(ch) : evPagesHTML(ch);
}

function findingCard(ch) {
  const st = ch.status, cls = clsOf(st), open = false;
  const cp = confPctOf(ch), n = countOf(ch), fp = firstPageOf(ch);
  const sub = st === 'pass' ? 'ที่ตรวจ' : 'ที่พบปัญหา';
  const acts = `<div class="factions"><button class="abtn primary" onclick="event.stopPropagation();openDrawer('${esc(ch.id)}','evidence')">ดูหลักฐาน</button>${fp ? `<a class="abtn" href="${esc(fp)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">เปิดหน้าที่พบ ↗</a>` : ''}${ch.recommendation ? `<button class="abtn" onclick="event.stopPropagation();openDrawer('${esc(ch.id)}','fix')">วิธีแก้ไข</button>` : ''}</div>`;
  const body = `<div class="fbody">${evidenceInline(ch)}${ch.fixable ? '<div class="detected">มีไฟล์แก้ในแท็บ Auto-Fix</div>' : ''}</div>`;
  return `<div class="finding ${cls} ${open ? 'open' : ''}"><div class="fbar" onclick="toggleFinding(this)"><div class="fico">${SEV_ICON[st] || 'ⓘ'}</div><div class="fmain"><div class="ftop"><span class="ftitle">${esc(stripEmoji(ch.title))}</span><span class="fbadge ${cls}">${ST_TH[st] || st}</span></div><div class="fdesc">${esc(stripEmoji(ch.detail || ''))}</div><span class="frelate">เกี่ยวข้องกับ SEO</span></div><div class="fright"><div class="big">${n} หน้า</div><div class="sub">${sub}</div>${cp != null ? `<div class="conf ${cp < 80 ? 'warn' : ''}">${cp}%</div>` : ''}</div><span class="chev">▾</span></div>${acts}${body}</div>`;
}

function renderChecks(audit) {
  if (!audit) return;
  const checks = audit.checks || [];
  const cnt = { fail: 0, warn: 0, pass: 0, info: 0 };
  checks.forEach(c => { if (cnt[c.status] != null) cnt[c.status]++; });
  const chip = (key, cls, ic, lbl, num) => `<span class="rstat ${cls} ${statusFilter === key ? 'on' : ''}" onclick="setStatusFilter('${key}')"><span class="ic">${ic}</span><span class="num">${num}</span> <span class="lbl">${lbl}</span></span>`;
  const sumrow = `<div class="sumrow">${chip('all', 'all', '⊕', 'ทั้งหมด', checks.length)}${chip('fail', 'crit', '⚠', 'สำคัญ', cnt.fail)}${chip('warn', 'fix', '◑', 'ต้องแก้ไข', cnt.warn)}${chip('pass', 'pass2', '✓', 'ผ่านแล้ว', cnt.pass)}${chip('info', 'info2', 'ⓘ', 'ข้อมูล', cnt.info)}</div>`;
  const cats = Object.keys(audit.categories || {}).filter(cat => checks.some(c => c.category === cat));
  const pills = `<div class="pills"><span class="pill ${!catFilter ? 'on' : ''}" onclick="setCatFilter('')">ทั้งหมด</span>${cats.map(cat => `<span class="pill ${catFilter === cat ? 'on' : ''}" onclick="setCatFilter('${cat}')">${esc(audit.categories[cat] || cat)}</span>`).join('')}</div>`;
  const evAll = (currentAudit && currentAudit.id && Object.keys(evidenceMap).length) ? `<a class="sel" href="/evidence/${currentAudit.id}" target="_blank" rel="noopener" style="text-decoration:none">🔎 หลักฐานรวมทุกหน้า</a>` : '';
  const sortbar = `<div class="sortbar"><span>เรียงตาม:</span><span class="sel">ความรุนแรง</span>${evAll}</div>`;
  $('#filterbar').innerHTML = sumrow + pills + sortbar;

  let list = checks.filter(c => (statusFilter === 'all' || c.status === statusFilter) && (!catFilter || c.category === catFilter));
  const order = { fail: 0, warn: 1, info: 2, pass: 3 }, sevO = { high: 0, med: 1, low: 2 };
  list.sort((a, b) => (order[a.status] - order[b.status]) || ((sevO[a.severity] ?? 1) - (sevO[b.severity] ?? 1)));

  const shownCats = cats.filter(cat => list.some(c => c.category === cat));
  const html = shownCats.map(cat => {
    const items = list.filter(c => c.category === cat);
    const issues = items.filter(c => c.status === 'fail' || c.status === 'warn').length;
    const cntBadge = issues ? `<span class="cnt">พบ ${issues} ปัญหา</span>` : `<span class="cnt ok">ผ่าน</span>`;
    return `<div class="sechead"><h3>${esc(audit.categories[cat] || cat)}</h3>${cntBadge}</div>${items.map(findingCard).join('')}`;
  }).join('');
  $('#checksList').innerHTML = html || '<div class="emptyfind">ไม่มีรายการตามตัวกรองนี้</div>';
}

// ── Detail Drawer ──
let drawerId = null, drawerTab = 'evidence';
function openDrawer(id, tab) {
  drawerId = id; drawerTab = tab || 'evidence';
  renderDrawer();
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBd').classList.add('open');
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerBd').classList.remove('open');
}
function setDrawerTab(t) { drawerTab = t; renderDrawer(); }
function renderDrawer() {
  const ch = ((currentAudit && currentAudit.checks) || []).find(c => c.id === drawerId); if (!ch) return;
  const k = KG[ch.id] || {}; const cls = clsOf(ch.status); const cp = confPctOf(ch);
  const tabs = [['evidence', 'หลักฐาน'], ['reason', 'เหตุผล'], ['rule', 'กฎที่ใช้ตรวจ'], ['fix', 'วิธีแก้ไข']];
  let body = drawerTab === 'reason' ? drawerReason(ch, k) : drawerTab === 'rule' ? drawerRule(ch, k) : drawerTab === 'fix' ? drawerFix(ch, k) : drawerEvidence(ch, k);
  document.getElementById('drawer').innerHTML =
    `<div class="dhead"><h2>${esc(stripEmoji(ch.title))} <span class="fbadge ${cls}" style="vertical-align:middle">${ST_TH[ch.status] || ch.status}</span></h2><button class="dclose" onclick="closeDrawer()">✕</button></div>` +
    `<div class="dsum"><div class="txt">${esc(stripEmoji(ch.detail || ''))}</div>${cp != null ? `<div><div class="conflab">ความมั่นใจ</div><span class="confnum ${cp < 80 ? 'warn' : ''}">${cp}%</span></div>` : ''}</div>` +
    `<div class="drelate">เกี่ยวข้องกับ <b>SEO</b></div>` +
    (ch.reasoning && ch.reasoning.note ? `<div class="dwhy"><b>ทำไมถึงยังนับว่าเป็นปัญหา:</b> ${esc(ch.reasoning.note)}</div>` : '') +
    `<div class="dtabs">${tabs.map(([t, l]) => `<button class="dtab ${drawerTab === t ? 'on' : ''}" onclick="setDrawerTab('${t}')">${l}</button>`).join('')}</div>` +
    body;
  if (drawerTab === 'evidence') loadDrawerCode(ch);
}
// Evidence Locator — เฉพาะ rule ที่พิสูจน์ด้วย HTML/ไฟล์จุดเดียวได้ (ไม่รวม duplicate/analysis/CWV)
function evidLocator(ch) {
  const id = ch.id || '';
  let origin = ''; try { origin = new URL(firstPageOf(ch) || (currentAudit && currentAudit.url) || '').origin; } catch { /* */ }
  if (/^title-(missing|length)/.test(id)) return { kind: 'html', ctrlF: '<title', selector: 'head > title', xpath: '/html/head/title', matchRe: /<title[^>]*>[\s\S]*?<\/title>/i };
  if (/^desc-(missing|length)/.test(id)) return { kind: 'html', ctrlF: 'name="description"', selector: 'head > meta[name=description]', xpath: '//meta[@name="description"]', matchRe: /<meta[^>]*name=["']description["'][^>]*>/i };
  if (/^h1-(missing|multiple|hidden)/.test(id)) return { kind: 'html', ctrlF: '<h1', selector: 'h1', xpath: '//h1', matchRe: /<h1[^>]*>[\s\S]*?<\/h1>/i };
  if (/^canonical-/.test(id)) return { kind: 'html', ctrlF: 'rel="canonical"', selector: 'head > link[rel=canonical]', xpath: '//link[@rel="canonical"]', matchRe: /<link[^>]*rel=["']canonical["'][^>]*>/i };
  if (/^og-/.test(id)) return { kind: 'html', ctrlF: 'property="og:', selector: 'head > meta[property^="og:"]', xpath: '//meta[starts-with(@property,"og:")]', matchRe: /<meta[^>]*property=["']og:[^>]*>/i };
  if (/robots-meta|^noindex/.test(id)) return { kind: 'html', ctrlF: 'name="robots"', selector: 'head > meta[name=robots]', xpath: '//meta[@name="robots"]', matchRe: /<meta[^>]*name=["']robots["'][^>]*>/i };
  if (/jsonld|^schema-/.test(id)) return { kind: 'html', ctrlF: 'application/ld+json', selector: 'script[type="application/ld+json"]', xpath: '//script[@type="application/ld+json"]', matchRe: /<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/i };
  if (/hreflang/.test(id)) return { kind: 'html', ctrlF: 'hreflang', selector: 'link[hreflang]', xpath: '//link[@hreflang]', matchRe: /<link[^>]*hreflang[^>]*>/i };
  if (/^lang-/.test(id)) return { kind: 'html', ctrlF: '<html', selector: 'html[lang]', xpath: '/html', matchRe: /<html[^>]*>/i };
  if (/charset/.test(id)) return { kind: 'html', ctrlF: 'charset', selector: 'meta[charset]', xpath: '//meta[@charset]', matchRe: /<meta[^>]*charset[^>]*>/i };
  if (/viewport/.test(id)) return { kind: 'html', ctrlF: 'name="viewport"', selector: 'meta[name=viewport]', xpath: '//meta[@name="viewport"]', matchRe: /<meta[^>]*name=["']viewport["'][^>]*>/i };
  if (/favicon/.test(id)) return { kind: 'html', ctrlF: 'rel="icon"', selector: 'link[rel~=icon]', xpath: '//link[contains(@rel,"icon")]', matchRe: /<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*>/i };
  if (/twitter/.test(id)) return { kind: 'html', ctrlF: 'name="twitter:', selector: 'meta[name^="twitter:"]', xpath: '//meta[starts-with(@name,"twitter:")]', matchRe: /<meta[^>]*name=["']twitter:[^>]*>/i };
  if (/meta-keywords/.test(id)) return { kind: 'html', ctrlF: 'name="keywords"', selector: 'meta[name=keywords]', xpath: '//meta[@name="keywords"]', matchRe: /<meta[^>]*name=["']keywords["'][^>]*>/i };
  if (/^robots-(missing|blocks|sitemap)/.test(id) && origin) return { kind: 'file', fileUrl: origin + '/robots.txt', ctrlF: 'User-agent' };
  if (/^sitemap-/.test(id) && origin) return { kind: 'file', fileUrl: origin + '/sitemap.xml', ctrlF: '<url>' };
  if (/llms/.test(id) && origin) return { kind: 'file', fileUrl: origin + '/llms.txt', ctrlF: '' };
  return null;
}
function copyText(el) { try { navigator.clipboard.writeText(el.dataset.copy || ''); const t = el.textContent; el.textContent = 'คัดลอกแล้ว ✓'; setTimeout(() => { el.textContent = t; }, 1200); } catch { /* */ } }
function locRow(k, code, copy) { return `<div class="locrow"><span class="lk">${k}</span><code class="lc">${esc(code)}</code>${copy ? `<button class="cpy" data-copy="${esc(code)}" onclick="copyText(this)">คัดลอก</button>` : ''}</div>`; }
function renderLocator(ch, loc) {
  const fp = firstPageOf(ch) || (currentAudit && currentAudit.url) || '';
  // ลิงก์ Source Viewer (เปิด HTML ดิบ + ไฮไลต์จุดที่เจอ อัตโนมัติ)
  const aid = currentAudit && currentAudit.id;
  let ek = Object.keys(evidenceMap).find(u => fp === u || fp.startsWith(u)); if (!ek) ek = Object.keys(evidenceMap)[0];
  const em2 = ek && evidenceMap[ek];
  const srcHref = (aid && em2 && loc.kind === 'html') ? `/source/${aid}?p=${em2.i}&focus=${focusForCheck(ch.id)}` : '';
  if (loc.kind === 'file') {
    return `<div class="evloc"><div class="st">🔎 ตรวจสอบเอง (5 วินาที)</div><div class="locrow"><span class="lk">เปิดไฟล์</span><a class="lv" href="${esc(loc.fileUrl)}" target="_blank" rel="noopener">${esc(loc.fileUrl)}</a></div>${loc.ctrlF ? locRow('Ctrl+F หา', loc.ctrlF, true) : ''}<a class="abtn" href="${esc(loc.fileUrl)}" target="_blank" rel="noopener" style="margin-top:9px">เปิดไฟล์ ↗</a></div>`;
  }
  return `<div class="evloc"><div class="st">🔎 ตรวจสอบเอง (5 วินาที) <span class="muted">— ${firstPageOf(ch) ? 'หน้าแรกในกลุ่ม' : 'หน้าตัวอย่าง'}</span></div>` +
    locRow('เปิดหน้าแล้ว Ctrl+F หา', loc.ctrlF, true) +
    locRow('CSS Selector', loc.selector, true) +
    locRow('XPath', loc.xpath, false) +
    `<div class="locrow"><span class="lk">HTML ที่ระบบเห็น</span><span class="lv" id="locStatus">กำลังดึง…</span></div><pre class="dcode" id="locSlot" style="display:none;margin-top:6px"></pre>` +
    `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">${srcHref ? `<a class="abtn primary" href="${esc(srcHref)}" target="_blank" rel="noopener">🔍 ดู Source + ไฮไลต์</a>` : ''}<a class="abtn" href="${esc(fp)}" target="_blank" rel="noopener">เปิดหน้าเว็บ ↗</a><button class="abtn" id="locCopyHtml" data-copy="" onclick="copyText(this)" style="display:none">Copy HTML</button></div></div>`;
}
function drawerEvidence(ch, k) {
  const loc = evidLocator(ch);
  const code = loc ? '' : `<div class="dsec" id="dcodeSec" style="display:none"><div class="codehead"><div class="st">ตัวอย่างโค้ดจากหน้าเว็บ <span class="muted">(หน้าแรกในกลุ่มนี้)</span></div></div><pre class="dcode" id="dcodeSlot"></pre></div>`;
  return `${loc ? renderLocator(ch, loc) : ''}<div class="dsec">${evidenceInline(ch)}</div>${code}${verifyTiles(ch)}<div class="dnote"><b>หมายเหตุ:</b> การตรวจสอบยึดตาม HTML ที่ระบบเก็บได้ตอน crawl อาจต่างจากที่เห็นในเบราว์เซอร์</div>`;
}
function drawerReason(ch, k) {
  return `<div class="dsec"><div class="st">ทำไมต้องตรวจ</div><div style="font-size:13.5px;line-height:1.75;color:#374151">${esc(k.why || stripEmoji(ch.detail || '—'))}</div></div>` +
    (k.what ? `<div class="dsec"><div class="st">ตรวจอะไร</div><div style="font-size:13.5px;line-height:1.75;color:#374151">${esc(k.what)}</div></div>` : '') +
    (ch.reasoning ? `<div class="dsec">${reasonBlock(ch)}</div>` : '');
}
function drawerRule(ch, k) {
  const m = k.measure;
  if (!m) return `<div class="dbody-empty">ยังไม่มีรายละเอียดวิธีตรวจของกฎนี้</div>`;
  const how = (m.how || []).map(s => { const d = typeof s === 'string' ? s : (s.do || ''); const w = (s && typeof s === 'object' && s.why) || ''; return `<li style="margin:5px 0">${esc(d)}${w ? ` <span style="color:var(--mut)">— ${esc(w)}</span>` : ''}</li>`; }).join('');
  const dec = (m.decision || []).map(s => `<li style="margin:3px 0;color:#374151">${esc(s)}</li>`).join('');
  return `<div class="dsec"><div class="st">ตรวจอย่างไร (ตอนนี้)${m.line ? ` <span class="muted">· โค้ด line ${esc(m.line)}</span>` : ''}</div><ol style="padding-left:20px;font-size:13.5px;margin:0">${how}</ol></div>` +
    (dec ? `<div class="dsec"><div class="st">เกณฑ์ตัดสิน</div><ul style="padding-left:18px;font-size:13px;margin:0">${dec}</ul></div>` : '') +
    (m.gap ? `<div class="dsec"><div class="st">ข้อสังเกต</div><div style="font-size:13px;color:var(--mut)">${esc(m.gap)}</div></div>` : '');
}
function drawerFix(ch, k) {
  const refs = (ch.reference && ch.reference.sources) || (k.refs ? k.refs.map(r => ({ label: r[0], url: r[1] })) : []);
  return `<div class="dsec"><div class="st">วิธีแก้ไข</div><div style="font-size:13.5px;line-height:1.75;color:#374151">${ch.recommendation ? esc(stripEmoji(ch.recommendation)) : '—'}</div></div>` +
    (refs && refs.length ? `<div class="dsec"><div class="st">มาตรฐานอ้างอิง</div>${refs.map(s => `<div style="margin:5px 0"><a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:var(--f-slate);font-size:13px;text-decoration:none">${esc(s.label)} ↗</a></div>`).join('')}</div>` : '') +
    (ch.fixable ? `<div class="dnote">ไฟล์แก้อัตโนมัติมีในแท็บ Auto-Fix</div>` : '');
}
function verifyTiles(ch) {
  const fp = firstPageOf(ch); if (!fp) return '';
  const id = currentAudit && currentAudit.id;
  const key = Object.keys(evidenceMap).find(u => fp === u || fp.startsWith(u));
  const em = key && evidenceMap[key];
  const rawHref = (id && em && em.raw) ? `/api/evidence/${id}/${em.raw}` : ('view-source:' + fp);
  const evBase = (id && em) ? `/evidence/${id}?p=${em.i}` : '';
  const tile = (href, ic, nm) => `<a class="tile" href="${esc(href)}" target="_blank" rel="noopener"><div class="tic">${ic}</div><div class="tn">${nm}</div></a>`;
  return `<div class="verifybox"><div class="vh">ตรวจสอบบนเว็บไซต์</div><div class="vsub">คลิกเพื่อเปิดหน้าเว็บและตรวจสอบด้วยตนเอง</div><div class="tiles">${tile(fp, '🌐', 'เปิดหน้าเว็บ')}${tile(rawHref, '&lt;/&gt;', 'ดู Source')}${evBase ? tile(evBase + '&focus=title', 'T', 'ตรวจ Title') : ''}${evBase ? tile(evBase + '&focus=h1', 'H1', 'ตรวจ H1') : ''}${evBase ? tile(evBase + '&focus=canonical', '🔗', 'ตรวจ Canonical') : ''}</div></div>`;
}
function _hlCode(s) {
  return esc(s).replace(/([a-zA-Z-]+)=("[^"]*")/g, '<span class="at">$1</span>=<span class="st2">$2</span>').replace(/(&lt;\/?[a-zA-Z0-9]+)/g, '<span class="tg">$1</span>');
}
async function loadDrawerCode(ch) {
  const loc = evidLocator(ch);
  const setLoc = h => { const s = document.getElementById('locStatus'); if (s && drawerTab === 'evidence') s.innerHTML = h; };
  const id = currentAudit && currentAudit.id;
  // หน้าอ้างอิง: หน้าที่พบปัญหาก่อน · ถ้าไม่มี (เช่น PASS) ใช้หน้าที่มี snapshot ใดหน้าหนึ่งเป็นตัวอย่าง
  const fp = firstPageOf(ch);
  let key = fp && Object.keys(evidenceMap).find(u => fp === u || fp.startsWith(u));
  if (!key) key = Object.keys(evidenceMap)[0];
  const em = key && evidenceMap[key];
  if (!id || !em || !em.raw) { if (loc && loc.kind === 'html') setLoc('<span class="lstat" style="color:var(--faint)">— audit นี้ไม่มี snapshot · กดเปิดหน้าเว็บแล้ว Ctrl+F ตรวจเอง</span>'); return; }
  try {
    const html = await (await fetch(`/api/evidence/${id}/${em.raw}`)).text();
    if (drawerTab !== 'evidence') return;
    if (loc && loc.kind === 'html' && loc.matchRe) {
      const m = html.match(loc.matchRe);
      const slot = document.getElementById('locSlot'), cpy = document.getElementById('locCopyHtml');
      if (m) {
        const snippet = m[0].replace(/\s+/g, ' ').trim();
        setLoc('<span class="lstat ok">✓ พบในหน้านี้</span>');
        if (slot) { slot.innerHTML = `<span class="row">${_hlCode(snippet.slice(0, 500))}</span>`; slot.style.display = ''; }
        if (cpy) { cpy.dataset.copy = snippet; cpy.style.display = ''; }
      } else setLoc('<span class="lstat no">❌ ไม่พบในหน้านี้ (จาก HTML ที่ระบบเก็บ)</span>');
      return;
    }
    // ไม่มี locator (analysis) → snippet รวมแบบเดิม
    const pick = []; const grab = re => { const mm = html.match(re); if (mm) pick.push(mm[0]); };
    grab(/<title[^>]*>[\s\S]*?<\/title>/i);
    grab(/<link[^>]*rel=["']canonical["'][^>]*>/i);
    grab(/<meta[^>]*name=["']description["'][^>]*>/i);
    grab(/<h1[^>]*>[\s\S]*?<\/h1>/i);
    if (!pick.length) return;
    const slot = document.getElementById('dcodeSlot'), sec = document.getElementById('dcodeSec');
    if (slot) { slot.innerHTML = pick.map(l => `<span class="row">${_hlCode(l.replace(/\s+/g, ' ').trim().slice(0, 300))}</span>`).join(''); sec.style.display = ''; }
  } catch { if (loc && loc.kind === 'html') setLoc('<span class="lstat no">โหลดหลักฐานไม่สำเร็จ · กดเปิดหน้าเว็บตรวจเอง</span>'); }
}
loadSkillGraph();

const chip = (cls, text) => `<span class="chip ${cls}">${text}</span>`;
function renderPages(audit) {
  $('#pagesBody').innerHTML = (audit.pages || []).map(p => `
    <tr>
      <td class="u" title="${esc(p.url)}">${esc(p.url.replace(/^https?:\/\/[^/]+/, '') || '/')}</td>
      <td>${p.status === 200 ? chip('pass', '200') : chip('fail', p.status)}</td>
      <td>${p.title ? (p.titleLength > 60 || p.titleLength < 15 ? chip('warn', esc(p.title.slice(0, 38))) : esc(p.title.slice(0, 38))) : chip('fail', 'ไม่มี')}</td>
      <td>${p.description ? chip('pass', 'มี') : chip('fail', 'ไม่มี')}</td>
      <td>${p.h1.length === 1 ? chip('pass', '1') : p.h1.length === 0 ? chip('fail', '0') : chip('warn', p.h1.length)}</td>
      <td>${p.canonical ? chip('pass', 'มี') : chip('fail', 'ไม่มี')}</td>
      <td>${p.wordCount}</td>
      <td>${p.images}${p.imagesNoAlt ? ' ' + chip('fail', p.imagesNoAlt) : ''}</td>
      <td>${p.jsonLdCount ? chip('pass', p.jsonLdCount) : chip('fail', '0')}</td>
      <td>${p.emptyRoot ? chip('fail', 'ใช่') : chip('gray', '—')}</td>
      <td><button class="btn ghost sm" onclick="fixPageRun('${esc(p.url)}', this)">AI แก้</button></td>
    </tr>`).join('');
}

// ── AI แก้รายหน้า: แก้ → ตรวจซ้ำ → แก้รอบสอง — โชว์หลักฐานก่อน/หลัง ──
let lastFixResult = null;
async function fixPageRun(url, btn) {
  btn.disabled = true; btn.textContent = 'กำลังแก้…';
  const panel = $('#fixPagePanel');
  panel.innerHTML = `<div class="card"><div class="ai-label"><span class="spark"></span>AI กำลังแก้หน้า</div><div class="hint" id="fixProg">กำลังเริ่ม… (ใช้เวลา ~1-2 นาที เพราะมีการตรวจซ้ำเพื่อพิสูจน์ผล)</div></div>`;
  try {
    const res = await fetch('/api/fixpage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
    const { id, error } = await res.json();
    if (!res.ok) throw new Error(error || 'เริ่มไม่สำเร็จ');
    const timer = setInterval(async () => {
      try {
        const job = await (await fetch('/api/fixpage/' + id)).json();
        if (job.status === 'running') {
          const el = $('#fixProg');
          if (el && job.progress.length) el.textContent = job.progress[job.progress.length - 1];
          return;
        }
        clearInterval(timer);
        btn.disabled = false; btn.textContent = 'AI แก้';
        if (job.status === 'error') { panel.innerHTML = `<div class="card"><div class="hint">ผิดพลาด — ${esc(job.error)}</div></div>`; return; }
        renderFixPageResult(url, job.result);
      } catch {}
    }, 1500);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'AI แก้';
    panel.innerHTML = `<div class="card"><div class="hint">${esc(e.message)}</div></div>`;
  }
}

function renderFixPageResult(url, r) {
  lastFixResult = r;
  const fname = (url.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'index') + '.fixed.html';
  $('#fixPagePanel').innerHTML = `
    <div class="card">
      <div class="ai-label"><span class="spark"></span>ผลการแก้ — พิสูจน์ด้วยการตรวจซ้ำ (${r.passes} รอบ)</div>
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin:8px 0 4px">
        <div><div style="font-size:12px;color:#6b7280">ก่อนแก้</div><div style="font-size:24px;font-weight:700">${r.before.count} <small style="font-size:12px;color:#9ca3af">ปัญหา (ร้ายแรง ${r.before.high})</small></div></div>
        <div style="font-size:18px;color:#9ca3af">&rarr;</div>
        <div><div style="font-size:12px;color:#6b7280">หลังแก้</div><div style="font-size:24px;font-weight:700;color:${r.after.high === 0 ? 'var(--green)' : 'var(--amber)'}">${r.after.count} <small style="font-size:12px;color:#9ca3af">ปัญหา (ร้ายแรง ${r.after.high})</small></div></div>
        <div>${r.verified ? chip('pass', 'ผ่านเกณฑ์ — ไม่เหลือปัญหาร้ายแรง') : chip('warn', 'ยังเหลือบางจุด')}</div>
      </div>
      ${r.after.issues.length ? `<div class="hint" style="margin-top:4px">ที่เหลือ: ${r.after.issues.map(i => esc(i.msg)).join(' · ')}</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn sm" onclick="previewFixResult()">เปิดดูตัวอย่างหน้าเว็บ</button>
        <button class="btn ghost sm" onclick="downloadFixResult('${esc(fname)}')">ดาวน์โหลด ${esc(fname)}</button>
        <button class="btn ghost sm" onclick="copyFixResult(this)">คัดลอก HTML</button>
      </div>
    </div>`;
}
// ── AI แก้ทุกหน้าตามหลัก SEO (batch + ZIP) ──
async function fixAllPages(btn) {
  if (!currentAudit) return;
  btn.disabled = true; btn.textContent = 'กำลังแก้ทุกหน้า…';
  const panel = $('#fixPagePanel');
  panel.innerHTML = `<div class="card"><div class="ai-label"><span class="spark"></span>AI กำลังแก้ทุกหน้าตามหลัก SEO</div><div class="hint" id="fixProg">เริ่มงาน… (หน้าละ ~1 นาที เพราะมีการตรวจซ้ำพิสูจน์ผลทุกหน้า)</div><div id="fixRows"></div></div>`;
  try {
    const res = await fetch('/api/fixpages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ auditId: currentAudit.id }) });
    const { id, error } = await res.json();
    if (!res.ok) throw new Error(error || 'เริ่มไม่สำเร็จ');
    const timer = setInterval(async () => {
      try {
        const job = await (await fetch('/api/fixpages/' + id)).json();
        const prog = $('#fixProg'), rows = $('#fixRows');
        if (prog && job.progress.length) prog.textContent = job.progress[job.progress.length - 1] + ` (เสร็จแล้ว ${job.results.length}/${job.total})`;
        if (rows) rows.innerHTML = renderBatchRows(job);
        if (job.status === 'done' || job.status === 'error') {
          clearInterval(timer);
          btn.disabled = false; btn.textContent = 'AI แก้ทุกหน้าตามหลัก SEO';
          if (job.status === 'error') { if (prog) prog.textContent = 'ผิดพลาด — ' + (job.error || ''); return; }
          if (prog) prog.innerHTML = `เสร็จสิ้น — แก้สำเร็จ ${job.results.filter(r => r.ok).length}/${job.total} หน้า ` +
            (job.zipReady ? `<button class="btn sm" style="margin-left:10px" onclick="location.href='/api/fixpages/${id}/zip'">ดาวน์โหลดทั้งหมด (ZIP)</button>` : '');
        }
      } catch {}
    }, 2000);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'AI แก้ทุกหน้าตามหลัก SEO';
    panel.innerHTML = `<div class="card"><div class="hint">${esc(e.message)}</div></div>`;
  }
}
function renderBatchRows(job) {
  if (!job.results.length) return '';
  return `<table class="ptable" style="margin-top:12px"><thead><tr><th>หน้า</th><th>ก่อน</th><th>หลัง</th><th>สถานะ</th></tr></thead><tbody>
    ${job.results.map(r => r.ok
      ? `<tr><td class="u">${esc(r.url.replace(/^https?:\/\/[^/]+/, '') || '/')}</td><td>${r.before} ปัญหา (ร้ายแรง ${r.beforeHigh})</td><td><b>${r.after}</b> (ร้ายแรง ${r.afterHigh})</td><td>${r.verified ? chip('pass', 'ผ่านเกณฑ์') : chip('warn', 'เหลือบางจุด')}</td></tr>`
      : `<tr><td class="u">${esc(r.url)}</td><td colspan="3">${chip('fail', 'ไม่สำเร็จ')} <span class="dim">${esc(r.error || '')}</span></td></tr>`).join('')}
  </tbody></table>`;
}

function previewFixResult() { const b = new Blob([lastFixResult.fixedHtml], { type: 'text/html;charset=utf-8' }); window.open(URL.createObjectURL(b), '_blank'); }
function downloadFixResult(fname) { const b = new Blob([lastFixResult.fixedHtml], { type: 'text/html;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname; a.click(); URL.revokeObjectURL(a.href); }
function copyFixResult(btn) { navigator.clipboard.writeText(lastFixResult.fixedHtml).then(() => { btn.textContent = 'คัดลอกแล้ว'; setTimeout(() => btn.textContent = 'คัดลอก HTML', 1500); }); }

function renderFixes(audit) {
  const fixes = audit.fixes || [];
  $('#fixesList').innerHTML = (fixes.length ? `
    <p style="margin-bottom:16px;color:#6b7280;font-size:13.5px">ระบบสร้างไฟล์แก้ ${fixes.length} ชุดจากปัญหาที่พบจริง — คัดลอกหรือดาวน์โหลดไปใช้ แล้วกด "ตรวจซ้ำหลังแก้" เพื่อยืนยันคะแนนที่ดีขึ้น</p>` : '<div class="empty">ไม่มีปัญหาที่สร้างไฟล์แก้อัตโนมัติได้</div>')
    + fixes.map((f, i) => `
    <div class="fix">
      <div class="head">
        <b>${esc(stripEmoji(f.title))}</b>
        <span class="file">${esc(f.filename)}</span>
      </div>
      <div class="desc">${esc(stripEmoji(f.description))}</div>
      <div class="howto"><b>วิธีใช้</b> — ${esc(stripEmoji(f.howTo))}</div>
      <pre id="fixcode-${i}">${esc(f.content)}</pre>
      <div class="acts">
        ${f.preview ? `<button class="btn sm" onclick="previewFix(${i})">เปิดดูตัวอย่างหน้าเว็บ</button>` : ''}
        <button class="btn ghost sm" onclick="copyFix(${i}, this)">คัดลอก</button>
        <button class="btn ${f.preview ? 'ghost ' : ''}sm" onclick="downloadFix(${i})">ดาวน์โหลด ${esc(f.filename)}</button>
      </div>
    </div>`).join('');
}

function previewFix(i) {
  const blob = new Blob([currentAudit.fixes[i].content], { type: 'text/html;charset=utf-8' });
  window.open(URL.createObjectURL(blob), '_blank');
}

function copyFix(i, btn) {
  navigator.clipboard.writeText(currentAudit.fixes[i].content).then(() => {
    btn.textContent = 'คัดลอกแล้ว'; setTimeout(() => btn.textContent = 'คัดลอก', 1500);
  });
}
function downloadFix(i) {
  const f = currentAudit.fixes[i];
  const blob = new Blob([f.content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = f.filename; a.click();
  URL.revokeObjectURL(a.href);
}

async function loadHistory() {
  try {
    const list = await (await fetch('/api/audits')).json();
    $('#histCount').textContent = list.length || '';
    const prevOf = (h, i) => list.slice(i + 1).find(x => wNorm(x.url) === wNorm(h.url));
    $('#historyList').innerHTML = list.map((h, i) => {
      const prev = prevOf(h, i);
      const dl = prev && h.overall != null && prev.overall != null ? h.overall - prev.overall : null;
      const dlHtml = dl == null ? '' : dl > 0 ? `<span style="color:var(--green);font-weight:700;font-size:13px">&#9650;+${dl}</span>` : dl < 0 ? `<span style="color:var(--red);font-weight:700;font-size:13px">&#9660;${dl}</span>` : `<span style="color:var(--faint);font-size:13px">&#8722;</span>`;
      return `
      <div class="hrow" onclick="openAudit('${h.id}')">
        <div class="score-mini ${h.overall >= 75 ? 'good' : h.overall >= 50 ? 'mid' : 'bad'}">${h.overall ?? '–'} ${dlHtml}</div>
        <div class="u2">
          <b>${esc(h.url)}</b>
          <div class="d">${h.pages} หน้า · เกรด ${h.grade} · ${chip('fail', 'Fail ' + h.fails)}</div>
        </div>
        <div class="when">${h.createdAt ? new Date(h.createdAt).toLocaleString('th-TH') : ''}</div>
      </div>`; }).join('') || '<div class="empty">ยังไม่มีประวัติการตรวจ</div>';
  } catch {}
}

async function openAudit(id) {
  const job = await (await fetch('/api/audit/' + id)).json();
  if (job.result) {
    document.querySelectorAll('.nitem[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'scan'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $('#view-scan').classList.add('active');
    render(job.result);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function showTab(btn) {
  document.querySelectorAll('.seg button').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tabpane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  $('#pane-' + btn.dataset.pane).classList.add('active');
}

$('#urlInput').addEventListener('keydown', e => { if (e.key === 'Enter') startAudit(); });
loadHistory();
loadBrandInputs();
refreshWatch();

// ── Dashboard & ค่าใช้จ่าย AI ──
const THB_RATE = 36; // USD → THB

function fmtUsd(v) { return v == null ? '—' : '$' + v.toFixed(4); }
function fmtThb(v) { return v == null ? '—' : '฿' + (v * THB_RATE).toFixed(2); }
function fmtNum(v) { return v == null ? '—' : v.toLocaleString(); }

// Audit Quality dashboard — precision/recall/FP/FN + เว็บที่ต้องรีวิว (อิง audit.verify ทุกตัว)
async function loadQuality() {
  const box = $('#db-quality'); if (!box) return;
  try {
    const q = await (await fetch('/api/quality')).json();
    const badge = $('#qualBadge'); if (badge) badge.textContent = q.flaggedCount || '';
    if (!q.withVerify) { box.innerHTML = '<div style="font-size:13px;color:var(--mut)">ยังไม่มีข้อมูล cross-check (audit ใหม่จะเริ่มเก็บอัตโนมัติ)</div>'; return; }
    const o = q.accuracy?.overall || {};
    const pct = (v) => v == null ? '—' : v + '%';
    const fpOk = o.fpr != null && o.fpr <= 3;
    const card = (label, val, color, hint) => `<div style="border:1px solid var(--border);border-radius:14px;padding:16px 18px;background:var(--panel)">
      <div style="font-size:11px;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${label}</div>
      <div style="font-size:22px;font-weight:700;color:${color}">${val}</div>${hint ? `<div style="font-size:11px;color:var(--mut);margin-top:3px">${hint}</div>` : ''}</div>`;
    const trustColor = (t) => /เราแม่น|เราเข้ม|เราถูก/.test(t) ? '#15803d' : /bug|รีวิว/.test(t) ? '#c0392b' : '#b45309';
    const flaggedRows = (q.flagged || []).slice(0, 12).map(f => {
      const expl = (f.explained || []).map(e => e.raw ? `<div style="font-size:12px;color:var(--mut)">${esc(e.raw)}</div>` : `
        <div style="margin-top:8px;padding:10px 12px;background:var(--hover);border-radius:8px;font-size:12.5px;line-height:1.55">
          <div><b>${esc(e.dim)}</b> — เรา: <span style="color:#c0392b">${esc(e.ours)}</span> · Google: <span style="color:#15803d">${esc(e.google)}</span></div>
          <div style="margin-top:4px"><span style="color:var(--mut)">ต่างกันยังไง:</span> ${esc(e.diff)}</div>
          <div style="margin-top:4px">👉 <span style="color:var(--mut)">ควรเชื่อ:</span> <b style="color:${trustColor(e.trust)}">${esc(e.trust)}</b></div>
          ${e.detail ? `<div style="margin-top:3px;color:var(--mut)">${esc(e.detail)}</div>` : ''}
        </div>`).join('');
      return `<details style="padding:9px 0;border-top:1px solid var(--border)">
        <summary style="display:flex;justify-content:space-between;gap:10px;font-size:13px;cursor:pointer">
          <a href="#" onclick="event.stopPropagation();openAudit('${f.id}');return false" style="color:#3b82f6;text-decoration:none;font-weight:500">${esc(f.url.replace(/^https?:\/\//, ''))} ↗</a>
          <span style="color:#c0392b">${(f.mismatches || []).map(esc).join(', ')} ▾</span>
        </summary>${expl}</details>`;
    }).join('') || '<div style="color:var(--mut);font-size:13px;padding:6px 0">— ไม่มีเว็บที่ต้องรีวิว ✓</div>';
    const needsRows = (q.topNeeds || []).map(n => `<span style="display:inline-block;background:#fde2e2;color:#c0392b;border-radius:6px;padding:2px 8px;margin:2px;font-size:12px">${esc(n.id)} ×${n.n}</span>`).join('') || '<span style="color:var(--mut);font-size:13px">— ไม่มี</span>';
    // ตารางความแม่น "รายเว็บ" (เพราะจะตรวจหลายเว็บ)
    const siteRows = (q.perSite || []).map(s => `<tr style="border-top:1px solid var(--border);font-size:13px">
      <td style="padding:8px 10px"><a href="#" onclick="openAudit('${s.id}');return false" style="color:#3b82f6;text-decoration:none">${esc(s.url.replace(/^https?:\/\//, ''))}</a></td>
      <td style="padding:8px 6px;text-align:center;color:var(--mut)">${s.score ?? '—'}${s.grade ? ' ' + s.grade : ''}</td>
      <td style="padding:8px 6px;text-align:center">${s.precision != null ? s.precision + '%' : '—'}</td>
      <td style="padding:8px 6px;text-align:center">${s.recall != null ? s.recall + '%' : '—'}</td>
      <td style="padding:8px 6px;text-align:center;font-weight:600;color:${s.fp ? '#c0392b' : 'var(--mut)'}">${s.fp}</td>
      <td style="padding:8px 6px;text-align:center;font-weight:600;color:${s.fn ? '#c0392b' : 'var(--mut)'}">${s.fn}</td>
      <td style="padding:8px 10px;font-size:12px">${s.flag ? `<span style="color:#b45309">⚠️ ${esc((s.mismatches || []).join(', '))}</span>` : '<span style="color:#15803d">✓ ตรง Google</span>'}</td></tr>`).join('');
    const siteTable = (q.perSite || []).length ? `<div class="card" style="padding:0;overflow:hidden;margin-bottom:14px">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);font-weight:600">ความแม่นรายเว็บ (${q.perSite.length} เว็บ) — คลิกเปิดผลตรวจ</div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:var(--hover);text-align:left;font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em">
          <th style="padding:9px 10px">เว็บ</th><th style="padding:9px 6px;text-align:center">คะแนน</th><th style="padding:9px 6px;text-align:center">Precision</th><th style="padding:9px 6px;text-align:center">Recall</th><th style="padding:9px 6px;text-align:center">FP</th><th style="padding:9px 6px;text-align:center">FN</th><th style="padding:9px 10px">เทียบ Google</th></tr></thead>
        <tbody>${siteRows}</tbody></table></div></div>` : '';
    box.innerHTML = `
      <div style="font-size:12px;color:var(--mut);margin-bottom:12px">วัดจาก ${q.withVerify}/${q.sites ?? q.withVerify} เว็บ (ใช้ผลล่าสุดต่อเว็บ ไม่นับซ้ำ) · Google = ground truth (เฉพาะ FACT dims)</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px">
        ${card('Precision', pct(o.precision), '#10b981', 'แจ้งแล้วถูกจริง · เป้า >95%')}
        ${card('Recall', pct(o.recall), '#3b82f6', 'ปัญหาจริงจับได้ · เป้า >90%')}
        ${card('False Positive', pct(o.fpr), fpOk ? '#10b981' : '#ef4444', 'แจ้งผิด · เป้า <3%')}
        ${card('False Negative', pct(o.fnr), '#8b5cf6', 'พลาด')}
        ${card('ต้องรีวิว', q.flaggedCount + ' เว็บ', '#f59e0b', 'ผลต่างจาก Google')}
      </div>
      <details style="margin-bottom:14px">
        <summary style="cursor:pointer;font-size:13px;color:var(--mut);font-weight:500">▸ ระบบเรา กับ Google ต่างกันยังไง? (เวลาผลไม่ตรง ควรเชื่ออันไหน)</summary>
        <div style="font-size:12.5px;color:var(--mut);padding:10px 2px 0;line-height:1.8">
          <b style="color:var(--fg,#222)">ระบบเรา</b> — ดูที่ "โค้ดดิบ" คือสิ่งที่ Google รอบแรกและ AI (ChatGPT/Claude) เห็นทันที · ตรวจ 200+ จุด รวมความพร้อมด้าน AI<br>
          <b style="color:var(--fg,#222)">Google Lighthouse</b> — ดูหน้าเว็บ "หลังโหลดเสร็จ" · เช็ค SEO ประมาณ 12 ข้อ · ข้ามรูป/ส่วนที่ซ่อนอยู่<br><br>
          <b style="color:var(--fg,#222)">เวลาผลต่างกัน มักเป็น 3 แบบ:</b><br>
          (ก) <b>เราตรวจละเอียดกว่า</b> (เช่น robots เผลอบล็อกเว็บ, ลิงก์ภาษาไม่ครบ) → <b style="color:#15803d">เชื่อเรา</b> (Google แค่ไม่ได้เช็คข้อนั้น)<br>
          (ข) <b>เว็บที่เนื้อหาขึ้นด้วยสคริปต์</b> (เช่น ตั้งภาษา/จอมือถือด้วย JS) → <b style="color:#15803d">เชื่อเรา</b> (AI ไม่รันสคริปต์ เลยมองไม่เห็น)<br>
          (ค) <b>ต้องเปิดหน้าเว็บดูจริง</b> (เช่น รูปที่ซ่อนอยู่) → กดดูแต่ละเว็บด้านล่างว่าควรเชื่ออันไหน
        </div>
      </details>
      ${siteTable}
      <div class="card" style="padding:16px 20px">
        <div style="font-weight:600;margin-bottom:4px">⚠️ เว็บที่ควรรีวิวก่อนส่งลูกค้า — กดดูว่าควรเชื่ออันไหน</div>
        ${flaggedRows}
        <div style="font-weight:600;margin:14px 0 6px">check ที่ต่างจาก Google บ่อยสุด (Most Incorrect)</div>
        <div>${needsRows}</div>
      </div>`;
  } catch (e) { box.innerHTML = ''; }
}

async function loadDashboard() {
  try {
    const list = await (await fetch('/api/audits')).json();
    const THB = THB_RATE;

    // คำนวณ KPI
    const withCost = list.filter(h => h.aiCost);
    const totalUsd = withCost.reduce((s, h) => s + (h.aiCost?.usd || 0), 0);
    const totalIn   = withCost.reduce((s, h) => s + (h.aiCost?.inputTokens || 0), 0);
    const totalOut  = withCost.reduce((s, h) => s + (h.aiCost?.outputTokens || 0), 0);
    const avgUsd    = withCost.length ? totalUsd / withCost.length : 0;

    const kpis = [
      { label: 'ตรวจทั้งหมด',      val: list.length + ' ครั้ง',             color: '#6366f1' },
      { label: 'ค่าใช้จ่ายรวม (USD)', val: '$' + totalUsd.toFixed(4),         color: '#f59e0b' },
      { label: 'ค่าใช้จ่ายรวม (฿)',  val: '฿' + (totalUsd * THB).toFixed(2),  color: '#10b981' },
      { label: 'เฉลี่ย/ครั้ง (USD)',  val: '$' + avgUsd.toFixed(4),            color: '#3b82f6' },
      { label: 'Input tokens รวม',   val: totalIn.toLocaleString(),            color: '#8b5cf6' },
      { label: 'Output tokens รวม',  val: totalOut.toLocaleString(),           color: '#ec4899' },
    ];

    $('#db-kpi').innerHTML = kpis.map(k => `
      <div style="border:1px solid var(--border);border-radius:14px;padding:18px 20px;background:var(--panel)">
        <div style="font-size:11px;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${k.label}</div>
        <div style="font-size:22px;font-weight:700;color:${k.color}">${k.val}</div>
      </div>`).join('');

    $('#db-updated').textContent = 'อัพเดต ' + new Date().toLocaleTimeString('th-TH');

    const gradeColor = g => ({'A':'#16a34a','B':'#2563eb','C':'#b45309','D':'#dc2626','F':'#7f1d1d'}[g] || '#6b7280');

    $('#db-tbody').innerHTML = list.map((h, i) => {
      const c = h.aiCost;
      const rowBg = i % 2 === 1 ? 'background:var(--hover)' : '';
      const usd = c?.usd ?? null;
      return `<tr style="${rowBg};border-top:1px solid var(--border)">
        <td style="padding:10px 16px;white-space:nowrap;color:var(--mut);font-size:12.5px">${h.createdAt ? new Date(h.createdAt).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}) : '—'}</td>
        <td style="padding:10px 16px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          <a href="/report/${h.id}" target="_blank" style="color:var(--text);text-decoration:none;font-weight:500" title="${esc(h.url)}">${esc(h.url.replace(/^https?:\/\/(www\.)?/, ''))}</a>
        </td>
        <td style="padding:10px 8px;text-align:center">
          <span style="font-weight:700;color:${gradeColor(h.grade)}">${h.overall ?? '—'}</span>
          <span style="font-size:11px;color:${gradeColor(h.grade)}"> ${h.grade || ''}</span>
        </td>
        <td style="padding:10px 8px;text-align:center;color:var(--mut)">${h.pages ?? '—'}</td>
        <td style="padding:10px 8px;text-align:right;color:var(--mut);font-size:12.5px">${c ? fmtNum(c.inputTokens) : '—'}</td>
        <td style="padding:10px 8px;text-align:right;color:var(--mut);font-size:12.5px">${c ? fmtNum(c.outputTokens) : '—'}</td>
        <td style="padding:10px 8px;text-align:center;color:var(--mut)">${c ? c.calls : '—'}</td>
        <td style="padding:10px 16px;text-align:right;font-weight:600;color:${usd != null ? '#b45309' : 'var(--mut)'}">${fmtUsd(usd)}</td>
        <td style="padding:10px 16px;text-align:right;font-weight:600;color:${usd != null ? '#b45309' : 'var(--mut)'}">${fmtThb(usd)}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="9" style="padding:32px;text-align:center;color:var(--mut)">ยังไม่มีประวัติการตรวจ</td></tr>`;
  } catch (e) {
    $('#db-kpi').innerHTML = `<div style="color:var(--mut)">โหลดไม่สำเร็จ: ${e.message}</div>`;
  }
}
