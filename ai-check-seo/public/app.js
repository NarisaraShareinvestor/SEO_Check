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
  renderChecks(audit, 'issues');
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
    if (Object.keys(evidenceMap).length && currentAudit && currentAudit.id === id) renderChecks(currentAudit, checkFilter);
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

let checkFilter = 'issues';
function renderChecks(audit, filter) {
  checkFilter = filter || checkFilter;
  const cats = [...new Set(audit.checks.map(ch => ch.category))];
  $('#filterbar').innerHTML = `
    <button class="fbtn ${checkFilter === 'issues' ? 'on' : ''}" onclick="renderChecks(currentAudit,'issues')">เฉพาะปัญหา</button>
    <button class="fbtn ${checkFilter === 'all' ? 'on' : ''}" onclick="renderChecks(currentAudit,'all')">ทั้งหมด</button>
    ${cats.map(cat => `<button class="fbtn ${checkFilter === cat ? 'on' : ''}" onclick="renderChecks(currentAudit,'${cat}')">${esc(audit.categories[cat] || cat)}</button>`).join('')}
    ${(currentAudit && currentAudit.id && Object.keys(evidenceMap).length) ? `<a class="evidence-all" href="/evidence/${currentAudit.id}" target="_blank" rel="noopener" title="ข้อมูล SEO ที่ดึงได้ครบทุก field ทุกหน้า">🔎 หลักฐานรวมทุกหน้า</a>` : ''}`;

  const order = { fail: 0, warn: 1, info: 2, pass: 3 };
  const sevOrder = { high: 0, med: 1, low: 2 };
  let list = [...audit.checks].sort((a, b) => (order[a.status] - order[b.status]) || (sevOrder[a.severity] - sevOrder[b.severity]));
  if (checkFilter === 'issues') list = list.filter(ch => ch.status === 'fail' || ch.status === 'warn');
  else if (checkFilter !== 'all') list = list.filter(ch => ch.category === checkFilter);

  const stTh = { fail: 'Fail', warn: 'Warn', pass: 'Pass', info: 'Info' };
  const sevTh = { high: 'สำคัญสูง', med: 'กลาง', low: 'ต่ำ' };
  $('#checksList').innerHTML = list.map(ch => `
    <details class="check" ${ch.status === 'fail' ? 'open' : ''}>
      <summary>
        <span class="chip ${ch.status}">${stTh[ch.status]}</span>
        <b>${esc(stripEmoji(ch.title))}</b>
        ${ch.affectedCount ? `<span class="n">${ch.affectedCount} รายการ</span>` : ''}
        <span class="sev">${sevTh[ch.severity] || ch.severity}</span>
        ${confBadge(ch)}${evConfChip(ch)}
      </summary>
      <div class="body">
        <div>${esc(stripEmoji(ch.detail))}</div>
        ${ch.recommendation ? `<div class="rec"><b>วิธีแก้</b> — ${esc(stripEmoji(ch.recommendation))}</div>` : ''}
        ${ch.reference ? `<div class="refln"><span class="reftier t${ch.reference.tier}">${esc(ch.reference.type)}</span> <b>อ้างอิง:</b> ${ch.reference.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join(' · ')}</div>` : ''}
        ${reasonBlock(ch)}
        ${(ch.groups || []).length
          ? `<div class="plist"><b>ค่าที่ซ้ำ — แยกแต่ละจุด:</b>${ch.groups.map(g => `<div class="dupgrp"><div class="dupval">🔁 <b>"${esc(stripEmoji(String(g.value || '(ว่าง)')))}"</b> <span class="n">ซ้ำ ${g.pages.length} หน้า</span></div>${g.pages.map(u => `<div class="evrow"><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>${evidenceLink(u, ch)}</div>`).join('')}</div>`).join('')}</div>`
          : (ch.evidence || []).length
          ? `<div class="plist"><b>หลักฐานรายหน้า:</b>${ch.evidence.map(e => `<div class="evrow"><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.url)}</a>${e.note ? `<span class="evnote"> — ${esc(e.note)}</span>` : ''}${evidenceLink(e.url, ch)}</div>`).join('')}</div>`
          : (ch.pages || []).length ? `<div class="plist">${ch.pages.map(p => `<div class="evrow"><a href="${esc(p)}" target="_blank" rel="noopener">${esc(p)}</a>${evidenceLink(p, ch)}</div>`).join('')}</div>` : ''}
        ${ch.fixable ? `<div class="note">มีไฟล์แก้ในแท็บ Auto-Fix</div>` : ''}
      </div>
    </details>`).join('') || '<div class="empty">ไม่มีรายการในหมวดนี้</div>';
}

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
