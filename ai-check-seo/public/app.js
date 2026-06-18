// SEO Audit — frontend logic (clean SaaS edition)
let currentAudit = null;
let pollTimer = null;
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
  $('#view-' + btn.dataset.view).classList.add('active');
  if (btn.dataset.view === 'history') loadHistory();
  if (btn.dataset.view === 'dashboard') loadDashboard();
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

function poll(id) {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/audit/' + id);
      const job = await res.json();
      const box = $('#progress');
      box.innerHTML = (job.progress || []).slice(-12).map(p => `<div>· ${esc(p.msg)}</div>`).join('');
      box.scrollTop = box.scrollHeight;
      if (job.status === 'done') {
        clearInterval(pollTimer);
        $('#startBtn').disabled = false;
        $('#progress').style.display = 'none';
        render(job.result);
        $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (job.status === 'error') {
        clearInterval(pollTimer);
        $('#startBtn').disabled = false;
        box.innerHTML += `<div>ผิดพลาด — ${esc(job.error)}</div>`;
      }
    } catch {}
  }, 900);
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
    ['#deltaBox', '#aibox', '#checksList', '#filterbar', '#pagesBody', '#compareBox', '#fixesList'].forEach(id => { const el = $(id); if (el) el.innerHTML = ''; });
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

  renderDelta(audit);
  renderAi(audit.analysis);
  renderChecks(audit, 'issues');
  renderPages(audit);
  renderCompare(audit);
  renderFixes(audit);
  loadHistory();
  refreshWatch();
}

// ── เทียบก่อน/หลังแก้ (delta) ──
function renderDelta(audit) {
  const d = audit.delta;
  const box = $('#deltaBox');
  if (!d) { box.innerHTML = ''; return; }
  const col = d.scoreDelta > 0 ? 'var(--green)' : d.scoreDelta < 0 ? 'var(--red)' : '#a1a1aa';
  const badCount = d.regressed.length + d.newIssues.length;
  box.innerHTML = `
    <div class="card" style="border-left:4px solid ${col}">
      <div class="chead">
        <h3>เทียบกับการตรวจครั้งก่อน (${new Date(d.prevDate).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })})</h3>
        <span class="meta">คะแนน ${d.prevScore} &rarr; <b style="color:${col};font-size:16px">${d.currScore}</b> (${d.scoreDelta >= 0 ? '+' : ''}${d.scoreDelta})</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        ${chip('pass', 'แก้สำเร็จ ' + d.fixed.length + ' ข้อ')}
        ${badCount ? chip('fail', 'แย่ลง/ปัญหาใหม่ ' + badCount + ' ข้อ') : chip('gray', 'ไม่มีปัญหาใหม่')}
      </div>
      ${d.fixed.length ? `<div style="font-size:12.5px;color:#16a34a;margin-top:10px">แก้สำเร็จ: ${d.fixed.map(f => esc(stripEmoji(f.title))).join(' · ')}</div>` : ''}
      ${badCount ? `<div style="font-size:12.5px;color:var(--red);margin-top:6px">ต้องตรวจสอบ: ${[...d.regressed, ...d.newIssues].map(f => esc(stripEmoji(f.title))).join(' · ')}</div>` : ''}
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
    ${cats.map(cat => `<button class="fbtn ${checkFilter === cat ? 'on' : ''}" onclick="renderChecks(currentAudit,'${cat}')">${esc(audit.categories[cat] || cat)}</button>`).join('')}`;

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
      </summary>
      <div class="body">
        <div>${esc(stripEmoji(ch.detail))}</div>
        ${ch.recommendation ? `<div class="rec"><b>วิธีแก้</b> — ${esc(stripEmoji(ch.recommendation))}</div>` : ''}
        ${(ch.pages || []).length ? `<div class="plist">${ch.pages.map(p => esc(p)).join('<br>')}</div>` : ''}
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
