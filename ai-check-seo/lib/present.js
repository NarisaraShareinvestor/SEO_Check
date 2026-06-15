// Presentation Mode — รายงาน SEO รูปแบบสไลด์นำเสนอ 16:9 (ไม่ใช่ PDF A4)
// เลื่อนทีละสไลด์ด้วยคีย์บอร์ด/คลิก · เต็มจอได้ · กราฟ SVG จริง · มุมทแยงแบรนด์ · print เป็น PDF ได้
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripEmoji = (s) => String(s ?? '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
const trunc = (s, n) => { s = stripEmoji(s); return s.length > n ? s.slice(0, n) + '…' : s; };
const ST_TH = { fail: 'Fail', warn: 'Warn', pass: 'Pass', info: 'Info' };
const chip = (st, label) => `<span class="chip ${st}">${esc(label)}</span>`;

const FLAG_LABELS = {
  ssr: 'เนื้อหาใน HTML ดิบ (SSR)', jsonld: 'Structured Data', orgSchema: 'Organization schema',
  faq: 'FAQ schema', aiBots: 'เปิดรับ AI bots', llms: 'llms.txt', canonical: 'Canonical',
  sitemap: 'XML Sitemap', h1: 'H1 ครบทุกหน้า', desc: 'Meta description', og: 'Open Graph',
  trust: 'Trust pages', eeat: 'E-E-A-T', cwv: 'Core Web Vitals',
};

// ── กราฟ SVG ──
const tone = (v) => v >= 75 ? 'var(--good)' : v >= 50 ? 'var(--mid)' : 'var(--bad)';

// วงแหวนคะแนน (donut gauge) — ตัวเลขใหญ่กลางวง
function gauge(value, label, size = 230) {
  const r = size / 2 - 16, c = 2 * Math.PI * r, off = c * (1 - value / 100);
  const col = tone(value);
  return `<div class="gauge">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="14"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"
        style="transition:stroke-dashoffset 1s ease"/>
      <text x="50%" y="47%" text-anchor="middle" dominant-baseline="middle" font-size="${size * 0.30}" font-weight="800" fill="#fff">${value}</text>
      <text x="50%" y="65%" text-anchor="middle" font-size="${size * 0.072}" fill="#9fb0c9">/ 100</text>
    </svg>
    ${label ? `<div class="gauge-lb">${esc(label)}</div>` : ''}
  </div>`;
}

// แท่งแนวนอนรายหมวด
function barChart(entries) {
  return `<div class="bars">${entries.map(([label, v]) => `
    <div class="bar-row">
      <span class="bar-lb">${esc(label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${v}%;background:${tone(v)}"></div></div>
      <b class="bar-v">${v}</b>
    </div>`).join('')}</div>`;
}

// เทียบคู่แข่งแบบแท่งคู่
function vsBars(entries) {
  return `<div class="vsbars">${entries.map(([label, us, them]) => `
    <div class="vsbar-row">
      <span class="vsbar-lb">${esc(label)}</span>
      <div class="vsbar-pair">
        <div class="vsbar-side"><div class="vsbar-fill us" style="width:${us}%"></div><i>${us}</i></div>
        <div class="vsbar-side"><div class="vsbar-fill them" style="width:${them}%"></div><i>${them}</i></div>
      </div>
    </div>`).join('')}</div>`;
}

// gauge เล็กแนวนอน (CWV)
function miniGauge(value, label, sub) {
  return `<div class="mini">${gauge(value, '', 150)}<div class="mini-lb"><b>${esc(label)}</b><span>${esc(sub)}</span></div></div>`;
}

export function renderPresentation(audit, brand = {}) {
  const host = audit.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const dateTh = new Date(audit.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  const brandName = brand.name || 'AI SEO Audit Pro';
  const brandLogo = brand.logo || '';
  const brandColor = brand.color || '';
  const s = audit.score;
  const byId = (id) => audit.checks.find(c => c.id === id);
  const fails = audit.checks.filter(c => c.status === 'fail');
  const geoChecks = audit.checks.filter(c => c.category === 'geo');
  const cwv = byId('cwv-score'), cwvField = byId('cwv-field');
  const renderDiff = byId('render-diff'), spaShell = byId('spa-shell');
  const a = audit.analysis || {};
  const g = audit.growth || {};
  const lh = audit.linkHealth || {};
  const comp = audit.competitor && !audit.competitor.error ? audit.competitor : null;
  const slides = [];

  // มุมทแยง + เลขหน้า (ใส่ทุกสไลด์เนื้อหา)
  const corner = `<div class="corner"><div class="corner-badge">${brandLogo ? `<img src="${esc(brandLogo)}" alt="">` : 'SEO<br><small>AUDIT</small>'}</div></div>`;
  const head = (kick, title) => `<div class="s-head"><div class="kick">${esc(kick)}</div><h2>${title}</h2></div>`;

  // ── 1. ปก ──
  slides.push(`<section class="slide cover">
    <div class="cover-tri"></div>
    <div class="cover-body">
      ${brandLogo ? `<img class="cover-logo" src="${esc(brandLogo)}" alt="">` : `<div class="kick gold">${esc(brandName)}</div>`}
      <div class="kick" style="margin-top:6px">SEO &amp; GEO Audit Report</div>
      <h1>${esc(host)}</h1>
      <p class="cover-sub">Technical SEO · Generative Engine Optimization · Core Web Vitals · เทียบคู่แข่ง<br>ตรวจ ${audit.pagesAnalyzed} หน้า · ${esc(dateTh)}</p>
    </div>
    <div class="cover-badge"><b>${s.overall}</b><span>/100 · เกรด ${s.grade}</span></div>
  </section>`);

  // ── 2. สารบัญ ──
  const agenda = [
    ['01', 'ภาพรวม & บทสรุปผู้บริหาร', 'Health Score · ปัญหาเรียงตามผลกระทบ'],
    ['02', 'Technical SEO Audit', 'On-site health · Rendered crawl · Core Web Vitals'],
    ['03', 'GEO Readiness', 'ความพร้อมบน ChatGPT / AI Overview / Perplexity'],
    ['04', 'เทียบคู่แข่ง', 'ตำแหน่งของคุณในตลาด'],
    ['05', 'โอกาสเติบโต', 'Keyword เป้าหมาย · ประมาณการ 3/6/12 เดือน'],
    ['06', 'แผนปฏิบัติ & การรายงาน', 'Roadmap · Workstreams · จังหวะรายงาน'],
  ];
  slides.push(`<section class="slide">${corner}${head('Agenda', 'หัวข้อการนำเสนอ')}
    <div class="agenda">${agenda.map(([n, t, d]) => `<div class="ag-item"><b>${n}</b><div><span class="ag-t">${esc(t)}</span><span class="ag-d">${esc(d)}</span></div></div>`).join('')}</div>
  </section>`);

  // ── ทำไม SEO + GEO ยังสำคัญปี 2026 (สถิติอุตสาหกรรม) ──
  slides.push(`<section class="slide">${corner}${head('Why SEO & GEO', 'ทำไมยังสำคัญที่สุดในปี 2026')}
    <div class="statgrid">
      <div class="statbox"><b>68%</b><span>ของประสบการณ์ออนไลน์ เริ่มจากการค้นหา</span></div>
      <div class="statbox"><b>60%</b><span>ของลีด B2B มาจาก organic search</span></div>
      <div class="statbox"><b>1B+</b><span>คนใช้ ChatGPT — การค้นหากำลังย้ายไป AI</span></div>
      <div class="statbox"><b>0 คลิก</b><span>AI Overview ตอบในหน้าผลเลย — ต้องเป็นแหล่งที่ AI อ้างถึง</span></div>
    </div>
    <div class="callout"><b>สองสนามต้องชนะพร้อมกัน:</b> Search Engine (Google) ที่ยังเป็นทราฟฟิกหลัก และ Generative Engine (ChatGPT, AI Overview, Perplexity) ที่กำลังกินส่วนแบ่ง — รายงานนี้ตรวจทั้งสองสนาม</div>
  </section>`);

  // ── 3. ภาพรวมคะแนน: gauge + bar chart ──
  slides.push(`<section class="slide">${corner}${head('Overview', 'ภาพรวมสุขภาพ SEO')}
    <div class="split">
      <div class="split-l">
        ${gauge(s.overall, `เกรด ${s.grade}`)}
        <div class="countrow">
          <div class="cnt bad"><b>${s.counts.fail}</b><span>Fail</span></div>
          <div class="cnt mid"><b>${s.counts.warn}</b><span>Warn</span></div>
          <div class="cnt good"><b>${s.counts.pass}</b><span>Pass</span></div>
        </div>
      </div>
      <div class="split-r">
        <div class="sub-h">คะแนนรายหมวด (0–100)</div>
        ${barChart(Object.entries(s.categoryScores).map(([k, v]) => [audit.categories[k] || k, v]))}
      </div>
    </div>
  </section>`);

  // ── 4. บทสรุปผู้บริหาร ──
  const keyFinds = fails.filter(c => c.severity === 'high').slice(0, 5);
  slides.push(`<section class="slide">${corner}${head('Executive Summary', 'เว็บไซต์ยืนอยู่ตรงไหนวันนี้')}
    <p class="lede">${esc(stripEmoji(a.executiveSummary || `เว็บได้คะแนน ${s.overall}/100 (เกรด ${s.grade}) — พบปัญหาร้ายแรง ${s.counts.fail} ข้อที่ควรเร่งแก้`))}</p>
    <div class="findgrid">
      ${keyFinds.map(c => `<div class="find"><span class="find-x">!</span><div><b>${esc(stripEmoji(c.title))}</b><span>${esc(trunc(c.detail, 95))}</span></div></div>`).join('')}
    </div>
  </section>`);

  // ── 5. ปัญหาเรียงตามผลกระทบ ──
  if ((a.topPriorities || []).length) {
    slides.push(`<section class="slide">${corner}${head('Priority Action Plan', 'ปัญหาเรียงตามผลกระทบต่อธุรกิจ')}
      <table class="ptab">
        <tr><th>#</th><th>ปัญหา</th><th>ผลกระทบต่อธุรกิจ</th><th>ความยาก</th><th>ช่วงเวลา</th></tr>
        ${a.topPriorities.slice(0, 6).map(p => `<tr><td class="rk">${p.rank}</td><td><b>${esc(stripEmoji(p.title))}</b></td><td>${esc(trunc(p.businessImpact, 90))}</td><td>${esc(p.effort)}</td><td>${esc(p.timeline)}</td></tr>`).join('')}
      </table>
      ${(a.quickWins || []).length ? `<div class="qrow"><b>Quick wins วันนี้:</b> ${a.quickWins.slice(0, 4).map(q => `<span class="qw">${esc(stripEmoji(q))}</span>`).join('')}</div>` : ''}
    </section>`);
  }

  // ── 6. Rendered Crawl Evidence ──
  if (renderDiff?.status === 'fail' || spaShell?.status === 'fail') {
    slides.push(`<section class="slide">${corner}${head('Rendered Crawl Evidence', 'สิ่งที่ Google และ AI bots เห็นจริง')}
      <p class="lede">AI bots (GPTBot, ClaudeBot, PerplexityBot) <b>ไม่รัน JavaScript</b> — เทียบ HTML ดิบกับหน้าหลัง render ด้วย headless Chrome</p>
      ${spaShell?.status === 'fail' ? `<div class="alert"><b>${esc(stripEmoji(spaShell.title))}</b> — ${esc(trunc(spaShell.detail, 200))}</div>` : ''}
      ${renderDiff?.status === 'fail' ? `<div class="evid">${(renderDiff.pages || []).slice(0, 4).map(p => `<div class="evid-row">${esc(p)}</div>`).join('')}</div>` : ''}
    </section>`);
  }

  // ── 7. Core Web Vitals ──
  if (cwv && !/ข้าม|ไม่สำเร็จ/.test(cwv.title)) {
    const lh = +(cwv.title.match(/(\d+)\/100/)?.[1] ?? 0);
    slides.push(`<section class="slide">${corner}${head('Performance · วัดจริงโดย Google', 'Core Web Vitals')}
      <div class="cwv-row">
        ${miniGauge(lh, 'Lighthouse', 'มือถือ')}
        <div class="cwv-detail">
          <p class="lede">${esc(stripEmoji(cwv.detail))}</p>
          ${cwvField && !/ไม่มี field/.test(cwvField.title) ? `<div class="cwv-field">${chip(cwvField.status, ST_TH[cwvField.status])} <span>${esc(stripEmoji(cwvField.detail))}</span></div>` : ''}
        </div>
      </div>
      ${cwv.recommendation ? `<div class="callout"><b>ลดเวลาโหลดได้มากสุด:</b> ${esc(stripEmoji(cwv.recommendation))}</div>` : ''}
    </section>`);
  }

  // ── 8. GEO Readiness ──
  if (geoChecks.length) {
    const geoScore = s.categoryScores.geo ?? 0;
    slides.push(`<section class="slide">${corner}${head('GEO Readiness · ยุค AI Search', 'ความพร้อมบน ChatGPT / AI Overview / Perplexity')}
      <div class="split">
        <div class="split-l">${gauge(geoScore, 'GEO Score')}</div>
        <div class="split-r">
          <div class="geo-grid">
            ${geoChecks.slice(0, 8).map(c => `<div class="geo-item ${c.status}"><span class="geo-dot"></span>${esc(trunc(c.title, 42))}</div>`).join('')}
          </div>
        </div>
      </div>
    </section>`);
  }

  // ── Link & Off-Page Health ──
  {
    const diversityColor = lh.diversity >= 70 ? 'var(--good)' : lh.diversity >= 40 ? 'var(--mid)' : 'var(--bad)';
    const divScore = lh.diversity || 0;
    const anchors = lh.topAnchors || [];
    const hasData = lh.totalInternal > 0;
    slides.push(`<section class="slide">${corner}${head('Link Health', 'Internal Link Graph &amp; Off-Page Authority')}
      <div class="split">
        <div class="split-l" style="gap:18px;min-width:220px">
          <div class="lhstat"><span>Internal Links</span><b>${(lh.totalInternal || 0).toLocaleString()}</b></div>
          <div class="lhstat"><span>Unique Anchors</span><b>${(lh.uniqueAnchors || 0).toLocaleString()}</b></div>
          <div class="lhstat"><span>Nofollow %</span><b>${lh.nofollowPct ?? '–'}%</b></div>
          <div class="lhstat"><span>Orphan Pages</span><b style="color:${(lh.orphans||[]).length ? 'var(--mid)' : 'var(--good)'}">${(lh.orphans||[]).length}</b></div>
          <div class="lhstat-full">
            <span>Anchor Diversity</span>
            <div class="lhbar-track"><div class="lhbar-fill" style="width:${divScore}%;background:${diversityColor}"></div></div>
            <b style="color:${diversityColor}">${divScore}/100</b>
          </div>
          ${(lh.overOptimized||[]).length ? `<div class="lhwarn">⚠ anchor ซ้ำกันเกิน 40% — เสี่ยง over-optimization<br><small>${esc(lh.overOptimized[0]?.text?.slice(0,50)||'')}</small></div>` : ''}
        </div>
        <div class="split-r">
          ${anchors.length ? `<div class="sub-h">Top Anchor Texts (internal)</div>
          <div class="anchor-table">
            ${anchors.slice(0,7).map(a => `<div class="anchor-row"><span class="anchor-txt">${esc(trunc(a.text,45))}</span><div class="anchor-bar-track"><div class="anchor-bar-fill" style="width:${Math.round((a.count/(anchors[0]?.count||1))*100)}%"></div></div><b>${a.count}</b></div>`).join('')}
          </div>` : `<p class="lede" style="color:var(--mut)">ไม่พบข้อมูล internal links (${hasData ? 'กำลังประมวลผล' : 'crawl หน้าแรกเท่านั้น'})</p>`}
          <div class="offpage-note">
            <div class="offpage-icon">🔗</div>
            <div>
              <b>External Backlinks &amp; Referring Domains</b>
              <p>ต้องการ DataForSEO หรือ Ahrefs API — เชื่อมต่อเพื่อดู referring domains, toxic anchors, disavow candidates</p>
              <div style="display:flex;gap:8px;margin-top:8px">
                <span class="chip info">DataForSEO ~0.02฿/query</span>
                <span class="chip info">Ahrefs API</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>`);
  }

  // ── 9. เทียบคู่แข่ง ──
  if (comp) {
    const { ours, theirs, commentary } = comp;
    const them = theirs.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const catRows = Object.keys(ours.categoryScores || {}).filter(k => theirs.categoryScores?.[k] != null)
      .map(k => [audit.categories[k] || k, ours.categoryScores[k], theirs.categoryScores[k]]);
    slides.push(`<section class="slide">${corner}${head('Competitor Comparison', `${esc(host)} <span class="vs">vs</span> ${esc(them)}`)}
      <div class="vshead">
        <div class="vshead-box us ${ours.overall >= theirs.overall ? 'win' : ''}"><span>เรา</span><b>${ours.overall}</b><i>เกรด ${ours.grade}</i></div>
        <div class="vshead-box them ${theirs.overall > ours.overall ? 'win' : ''}"><span>คู่แข่ง</span><b>${theirs.overall}</b><i>เกรด ${theirs.grade}</i></div>
      </div>
      ${vsBars(catRows.slice(0, 6))}
      ${commentary?.battlePlan?.length ? `<div class="callout"><b>แผนแซง:</b> ${esc(stripEmoji(commentary.battlePlan[0]))}</div>` : ''}
    </section>`);
  }

  // ── Keyword Opportunities (AI เสนอตาม intent) ──
  if ((g.keywordTargets || []).length) {
    const intentTone = { Transactional: 'pass', Commercial: 'pass', Brand: 'warn', Informational: 'info' };
    slides.push(`<section class="slide">${corner}${head('Keyword Opportunities', 'คีย์เวิร์ดเป้าหมายที่ควรชิง')}
      <div class="est-badge">AI ประมาณการ — volume/KD/CPC จริงต้อง DataForSEO API</div>
      <table class="ptab">
        <tr><th>คีย์เวิร์ด</th><th>Search Intent</th><th>เหตุผลที่ควรชิง</th><th>ความยาก (ประมาณ)</th></tr>
        ${g.keywordTargets.slice(0, 8).map(k => `<tr><td><b>${esc(k.keyword)}</b></td><td>${chip(intentTone[k.intent] || 'info', k.intent || '–')}</td><td>${esc(trunc(k.rationale || '', 80))}</td><td><span class="est-val">${esc(k.difficulty || '–')}</span></td></tr>`).join('')}
      </table>
      <div class="callout">คีย์เวิร์ดเสนอโดย AI วิเคราะห์จาก business context — <b>ตัวเลข volume/KD/CPC ยังไม่มี</b> ต้องเชื่อม DataForSEO หรือ Ahrefs API เพื่อได้ข้อมูลจริง</div>
    </section>`);
  }

  // ── Projected Results 3/6/12 เดือน + กราฟแนวโน้ม ──
  if (g.projections?.rows?.length) {
    const cols = ['now', 'm3', 'm6', 'm12'], colLb = ['วันนี้', 'เดือน 3', 'เดือน 6', 'เดือน 12'];
    // หาแถวคะแนนเพื่อวาดกราฟ
    const scoreRow = g.projections.rows.find(r => /คะแนน/.test(r.metric));
    const pts = scoreRow ? cols.map(c => parseInt(String(scoreRow[c]).replace(/\D/g, '')) || 0) : [s.overall, 0, 0, 0];
    const W = 460, H = 200, pad = 30, maxV = 100;
    const xy = (idx, v) => [pad + idx * (W - 2 * pad) / 3, H - pad - (v / maxV) * (H - 2 * pad)];
    const path = pts.map((v, idx) => { const [x, y] = xy(idx, v); return (idx ? 'L' : 'M') + x.toFixed(0) + ',' + y.toFixed(0); }).join(' ');
    slides.push(`<section class="slide">${corner}${head('Estimated Results', 'ประมาณการ 3 / 6 / 12 เดือน (อนุรักษ์นิยม)')}
      <div class="est-badge">AI ประมาณการ — ยังไม่ calibrate ด้วย GSC / Analytics จริง ใช้เป็นเป้าหมายเบื้องต้นเท่านั้น</div>
      <div class="split">
        <div class="split-r">
          <table class="ptab">
            <tr><th>ตัวชี้วัด</th>${colLb.map(c => `<th>${c}</th>`).join('')}</tr>
            ${g.projections.rows.map(r => `<tr><td><b>${esc(r.metric)}</b></td>${cols.map((c, idx) => `<td${idx === 3 ? ' style="color:var(--good);font-weight:800"' : ''}>${esc(String(r[c] ?? '–'))}</td>`).join('')}</tr>`).join('')}
          </table>
        </div>
        <div class="split-l" style="flex:0 0 auto">
          <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
            ${[0, 25, 50, 75, 100].map(v => { const y = H - pad - (v / maxV) * (H - 2 * pad); return `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="#eef1f6"/><text x="6" y="${y + 4}" font-size="10" fill="#9fb0c9">${v}</text>`; }).join('')}
            <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
            ${pts.map((v, idx) => { const [x, y] = xy(idx, v); return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="5" fill="var(--accent)"/>`; }).join('')}
            ${colLb.map((c, idx) => { const [x] = xy(idx, 0); return `<text x="${x}" y="${H - 8}" font-size="10" fill="#5b6c85" text-anchor="middle">${c}</text>`; }).join('')}
          </svg>
          <div class="gauge-lb">แนวโน้มคะแนน SEO (ประมาณการ)</div>
        </div>
      </div>
      <div class="callout">${g.projections.note ? esc(stripEmoji(g.projections.note)) + ' · ' : ''}<b>หมายเหตุ:</b> ตัวเลข traffic/revenue เป็น AI ประมาณการ จะแม่นขึ้นเมื่อเชื่อม Google Search Console และ DataForSEO</div>
    </section>`);
  }

  // ── 10. Roadmap timeline ──
  const wk1 = (a.topPriorities || []).filter(p => /1/.test(p.timeline || '')).map(p => p.title);
  slides.push(`<section class="slide">${corner}${head('Implementation Roadmap', 'แผนลงมือ 30 วันแรก')}
    <div class="timeline">
      <div class="tl"><div class="tl-dot">1</div><b>สัปดาห์ที่ 1</b><i>หยุดเลือดไหล</i><p>${esc(stripEmoji((wk1.length ? wk1 : fails.slice(0, 2).map(c => c.title)).slice(0, 2).join(' · ')))}</p></div>
      <div class="tl"><div class="tl-dot">2</div><b>สัปดาห์ที่ 2</b><i>โครงสร้าง</i><p>Structured Data · canonical · security headers</p></div>
      <div class="tl"><div class="tl-dot">3</div><b>สัปดาห์ที่ 3</b><i>GEO</i><p>FAQ schema · llms.txt · เปิดรับ AI bots</p></div>
      <div class="tl"><div class="tl-dot">4</div><b>สัปดาห์ที่ 4</b><i>วัดผล</i><p>ตรวจซ้ำ เทียบคะแนนก่อน/หลัง · ติดตาม CWV</p></div>
    </div>
    ${(audit.fixes || []).length ? `<div class="callout"><b>พร้อมส่งมอบแล้ว:</b> ไฟล์แก้ ${audit.fixes.length} ชุดที่ AI สร้างจากข้อมูลจริง — นำไปใช้ได้ทันที</div>` : ''}
  </section>`);

  // ── Six Workstreams ──
  if ((g.workstreams || []).length) {
    slides.push(`<section class="slide">${corner}${head('Workstreams', 'งานหลัก 6 สายที่ต้องเดินขนานกัน')}
      <div class="wsgrid">
        ${g.workstreams.slice(0, 6).map(w => `<div class="ws"><div class="ws-n">${esc(w.n)}</div><div><b>${esc(w.title)}</b><span>${esc(trunc(w.detail || '', 70))}</span></div></div>`).join('')}
      </div>
    </section>`);
  }

  // ── Reporting cadence (ผูกกับ watchlist อัตโนมัติของเรา) ──
  slides.push(`<section class="slide">${corner}${head('Reporting', 'เราจะรายงานความคืบหน้าอย่างไร')}
    <div class="cadgrid">
      <div class="cad"><b>ทันที</b><i>แจ้งเตือน LINE อัตโนมัติ</i><p>คะแนนตก เว็บล่ม หรือมีปัญหาร้ายแรงใหม่ — ระบบเฝ้าระวังส่งเข้า LINE ทันที</p></div>
      <div class="cad"><b>รายสัปดาห์</b><i>Pulse</i><p>คะแนนเทียบครั้งก่อน · แก้อะไรไปแล้ว · ปัญหาใหม่ · งานสัปดาห์หน้า</p></div>
      <div class="cad"><b>รายเดือน</b><i>Performance</i><p>เทรนด์คะแนน · CWV · ความพร้อม GEO · โฟกัสเดือนถัดไป</p></div>
      <div class="cad"><b>รายไตรมาส</b><i>Strategy</i><p>Full Audit Deck · เทียบคู่แข่งใหม่ · ปรับแผนและงบ</p></div>
    </div>
    <div class="callout"><b>ต่างจากเอเจนซี่:</b> การเฝ้าระวังและตรวจซ้ำเป็น<u>อัตโนมัติ</u> — ไม่ต้องรอรอบรายงาน เห็นทุกการเปลี่ยนแปลงทันที</div>
  </section>`);

  // ── ทำไมต้องเรา: เอเจนซี่แบบเดิม vs AI SEO Audit Pro ──
  slides.push(`<section class="slide">${corner}${head('Why This Audit', 'ลึกกว่า · เร็วกว่า · พิสูจน์ได้')}
    <table class="cmptab">
      <tr><th>มิติ</th><th>เอเจนซี่ / เครื่องมือทั่วไป</th><th class="uscol">รายงานฉบับนี้</th></tr>
      <tr><td>ความเร็ว</td><td>2–4 สัปดาห์</td><td class="uscol">5 นาที</td></tr>
      <tr><td>หลักฐาน Rendered Crawl</td><td>อยู่ใน appendix (ถ้ามี)</td><td class="uscol">ตัวเลข raw vs rendered รายหน้าจริง</td></tr>
      <tr><td>Core Web Vitals</td><td>ประเมินคร่าวๆ</td><td class="uscol">ดึงจาก Google PageSpeed จริง</td></tr>
      <tr><td>Technical SEO (200+ checks)</td><td>เช็คด้วยมือบางส่วน</td><td class="uscol">อัตโนมัติ verified ทุก check</td></tr>
      <tr><td>Keyword Volume / KD / CPC</td><td>Ahrefs / SEMrush API จริง</td><td class="uscol"><span class="est-inline">AI ประมาณการ</span> — ต่อ DataForSEO เพื่อข้อมูลจริง</td></tr>
      <tr><td>Traffic Projection</td><td>ประสบการณ์ + industry data</td><td class="uscol"><span class="est-inline">AI ประมาณการ</span> — calibrate ด้วย GSC ได้แม่นขึ้น</td></tr>
      <tr><td>การแก้ปัญหา</td><td>เขียนข้อเสนอแนะ</td><td class="uscol">AI สร้างโค้ด/หน้าเว็บฉบับแก้ พร้อมใช้</td></tr>
      <tr><td>พิสูจน์ผล</td><td>รอดูเดือนหน้า</td><td class="uscol">ตรวจซ้ำ โชว์ delta ก่อน/หลังเป็นตัวเลข</td></tr>
    </table>
  </section>`);

  // ── 11. ปิดท้าย ──
  slides.push(`<section class="slide cover end">
    <div class="cover-tri"></div>
    <div class="cover-body">
      <div class="kick gold">ขั้นตอนถัดไป</div>
      <h1>พร้อมเริ่มแก้<br>ภายในสัปดาห์นี้</h1>
      <p class="cover-sub">รับไฟล์ Auto-Fix · ลงมือตามแผน 30 วัน · ตรวจซ้ำเพื่อพิสูจน์ผลด้วยตัวเลข<br>จัดทำโดย ${esc(brandName)} · ${esc(dateTh)}</p>
    </div>
    <div class="cover-badge"><b>${s.overall}</b><span>เป้าหมาย 85+</span></div>
  </section>`);

  const accent = brandColor || '#f5c242';
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SEO Presentation — ${esc(host)}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--navy:#0e2240;--navy2:#16305a;--accent:${accent};--good:#19b394;--mid:#f0a92e;--bad:#e74c5e;--ink:#1c2b40;--mut:#5b6c85}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter','Noto Sans Thai',sans-serif;background:#0a0f18;overflow:hidden;color:var(--ink)}
#stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.slide{position:absolute;width:1280px;height:720px;background:#fff;overflow:hidden;opacity:0;pointer-events:none;transition:opacity .35s;display:flex;flex-direction:column;padding:62px 70px}
.slide.on{opacity:1;pointer-events:auto}
/* มุมทแยงแบรนด์ (แบบ UFG INF) */
.corner{position:absolute;top:0;right:0;width:150px;height:150px;overflow:hidden}
.corner::before{content:'';position:absolute;top:-75px;right:-75px;width:210px;height:210px;background:var(--navy);transform:rotate(45deg)}
.corner-badge{position:absolute;top:20px;right:18px;color:#fff;font-weight:800;font-size:17px;line-height:1;text-align:center;z-index:1}
.corner-badge small{font-size:9px;letter-spacing:.1em;font-weight:600;color:var(--accent)}
.corner-badge img{height:34px;width:auto;object-fit:contain}
.kick{font-size:13px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--mut)}
.kick.gold{color:var(--accent)}
.s-head{margin-bottom:24px}
.s-head .kick{color:var(--accent);margin-bottom:8px}
h2{font-size:34px;font-weight:800;letter-spacing:-.01em;color:var(--navy)}
h2 .vs{color:var(--accent);font-size:24px;margin:0 6px} h2 small{font-size:18px;color:var(--mut)}
h2::after{content:'';display:block;width:60px;height:5px;background:var(--accent);border-radius:3px;margin-top:14px}
.lede{font-size:17px;color:#3b4d68;line-height:1.65;max-width:1050px;margin-bottom:18px}
.sub-h{font-size:14px;font-weight:700;color:var(--navy);margin-bottom:16px;letter-spacing:.02em}
/* ปก */
.cover{background:var(--navy);padding:0;justify-content:center}
.cover-tri{position:absolute;inset:0;background:var(--accent);clip-path:polygon(100% 26%,100% 100%,12% 100%)}
.cover-tri::after{content:'';position:absolute;inset:0;background:var(--navy2);clip-path:polygon(100% 31%,100% 100%,19% 100%)}
.cover-body{position:relative;z-index:2;padding:0 90px}
.cover .kick{color:#8fa3c2}
.cover-logo{height:50px;width:auto;margin-bottom:18px}
.cover h1{font-size:62px;font-weight:800;color:#fff;letter-spacing:-.02em;line-height:1.1;margin:10px 0 18px}
.cover-sub{font-size:17px;color:#b9c4d6;line-height:1.7}
.cover-badge{position:absolute;top:64px;right:80px;z-index:2;text-align:center;background:var(--accent);color:var(--navy);border-radius:18px;padding:22px 30px}
.cover-badge b{font-size:54px;font-weight:800;display:block;line-height:1} .cover-badge span{font-size:13px;font-weight:700}
.cover.end h1{font-size:54px}
/* agenda */
.agenda{display:grid;grid-template-columns:1fr 1fr;gap:16px 40px;margin-top:6px}
.ag-item{display:flex;gap:18px;align-items:baseline;border-bottom:1px solid #eef1f6;padding-bottom:14px}
.ag-item b{font-size:26px;font-weight:800;color:var(--accent);min-width:42px}
.ag-t{display:block;font-size:18px;font-weight:700;color:var(--navy)}
.ag-d{display:block;font-size:13px;color:var(--mut)}
/* split layout */
.split{display:flex;gap:50px;align-items:center;flex:1}
.split-l{display:flex;flex-direction:column;align-items:center;gap:24px}
.split-r{flex:1}
/* gauge */
.gauge{text-align:center} .gauge-lb{font-size:15px;font-weight:700;color:var(--navy);margin-top:6px}
.split-l .gauge svg circle:first-child{stroke:#eef1f6}
.split-l .gauge text{fill:var(--navy)!important}
.split-l .gauge text:last-child{fill:var(--mut)!important}
.countrow{display:flex;gap:14px}
.cnt{text-align:center;border-radius:12px;padding:10px 20px;min-width:74px}
.cnt b{font-size:28px;font-weight:800;display:block;line-height:1}
.cnt span{font-size:12px;font-weight:700}
.cnt.bad{background:#fdecee;color:var(--bad)} .cnt.mid{background:#fff6e6;color:#b9821a} .cnt.good{background:#e8f7f3;color:#0f8a72}
/* bars */
.bars{display:flex;flex-direction:column;gap:13px}
.bar-row{display:grid;grid-template-columns:170px 1fr 38px;align-items:center;gap:14px}
.bar-lb{font-size:14px;color:#3b4d68}
.bar-track{height:14px;background:#eef1f6;border-radius:99px;overflow:hidden}
.bar-fill{height:100%;border-radius:99px;transition:width 1s ease}
.bar-v{font-weight:800;color:var(--navy);text-align:right}
/* exec finds */
.findgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}
.find{display:flex;gap:14px;align-items:flex-start;background:#fafbfd;border:1px solid #eef1f6;border-left:4px solid var(--bad);border-radius:12px;padding:16px 18px}
.find-x{flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--bad);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center}
.find b{display:block;font-size:15px;color:var(--navy);margin-bottom:3px} .find span{font-size:12.5px;color:var(--mut);line-height:1.5}
/* priority table */
.ptab{width:100%;border-collapse:collapse;font-size:14px}
.ptab th{background:var(--navy);color:#fff;text-align:left;padding:11px 14px;font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.ptab td{padding:11px 14px;border-bottom:1px solid #eef1f6;color:#3b4d68;vertical-align:top}
.ptab .rk{font-weight:800;color:var(--accent);font-size:16px}
.ptab b{color:var(--navy)}
.qrow{margin-top:16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:14px}
.qw{background:#e8f7f3;color:#0f8a72;font-size:12.5px;font-weight:700;padding:4px 14px;border-radius:99px}
/* evidence */
.alert{background:#fdecee;border-left:5px solid var(--bad);border-radius:10px;padding:16px 22px;font-size:15px;color:#7a2030;margin-bottom:16px}
.alert b{color:var(--bad)}
.evid{display:flex;flex-direction:column;gap:8px}
.evid-row{font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#0f1115;color:#7ee0c0;padding:12px 18px;border-radius:8px}
/* cwv */
.cwv-row{display:flex;gap:44px;align-items:center;margin-bottom:10px}
.mini{display:flex;align-items:center;gap:8px} .mini-lb b{display:block;font-size:16px;color:var(--navy)} .mini-lb span{font-size:12px;color:var(--mut)}
.mini .gauge text{fill:var(--navy)!important} .mini .gauge svg circle:first-child{stroke:#eef1f6}
.mini .gauge text:last-child{fill:var(--mut)!important}
.cwv-detail{flex:1} .cwv-field{margin-top:10px;font-size:14px;color:#3b4d68;display:flex;gap:10px;align-items:flex-start}
/* geo */
.geo-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.geo-item{display:flex;align-items:center;gap:10px;font-size:14px;color:#3b4d68;background:#fafbfd;border:1px solid #eef1f6;border-radius:10px;padding:11px 14px}
.geo-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.geo-item.pass .geo-dot{background:var(--good)} .geo-item.warn .geo-dot{background:var(--mid)} .geo-item.fail .geo-dot{background:var(--bad)} .geo-item.info .geo-dot{background:#9fb0c9}
/* vs */
.vshead{display:flex;gap:20px;margin-bottom:22px}
.vshead-box{flex:1;border:1px solid #eef1f6;border-top:4px solid #cfd9e6;border-radius:12px;padding:14px 22px;background:#fafbfd}
.vshead-box.win{border-top-color:var(--accent);background:#fffdf4}
.vshead-box span{font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:.08em;font-weight:700}
.vshead-box b{font-size:38px;font-weight:800;color:var(--navy);display:block;line-height:1.1} .vshead-box i{font-style:normal;font-size:13px;color:var(--mut)}
.vsbars{display:flex;flex-direction:column;gap:11px}
.vsbar-row{display:grid;grid-template-columns:170px 1fr;align-items:center;gap:16px}
.vsbar-lb{font-size:13.5px;color:#3b4d68}
.vsbar-pair{display:flex;flex-direction:column;gap:4px}
.vsbar-side{position:relative;height:13px;background:#eef1f6;border-radius:99px}
.vsbar-fill{height:100%;border-radius:99px} .vsbar-fill.us{background:var(--navy)} .vsbar-fill.them{background:var(--accent)}
.vsbar-side i{position:absolute;right:-26px;top:-3px;font-style:normal;font-size:11px;font-weight:700;color:var(--mut)}
/* timeline */
.timeline{display:flex;gap:0;flex:1;align-items:center;position:relative}
.timeline::before{content:'';position:absolute;top:50px;left:11%;right:11%;height:3px;background:var(--accent);z-index:0}
.tl{flex:1;text-align:center;padding:0 12px;position:relative;z-index:1}
.tl-dot{width:50px;height:50px;border-radius:50%;background:var(--accent);color:var(--navy);font-weight:800;font-size:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 0 0 7px #fff}
.tl b{display:block;font-size:15px;color:var(--navy)} .tl i{font-style:italic;font-size:12px;color:#2a9db8;display:block;margin-bottom:8px} .tl p{font-size:12.5px;color:var(--mut);line-height:1.5}
/* callout / chip */
.callout{background:#fafbfd;border:1px solid #eef1f6;border-left:4px solid var(--accent);border-radius:10px;padding:14px 20px;font-size:14px;color:#3b4d68;margin-top:16px}
.callout b{color:var(--navy)}
.est-badge{background:#fff8e1;border:1px solid #f5c242;border-left:4px solid #f5c242;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:#7a5b1e;margin-bottom:14px;letter-spacing:.03em}
.est-inline{display:inline-block;background:#fff3cd;color:#7a5b1e;font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;border:1px solid #f5c242;margin-right:4px}
.chip{display:inline-block;padding:2px 11px;border-radius:5px;font-size:11px;font-weight:800;text-transform:uppercase;color:#fff}
.chip.fail{background:var(--bad)} .chip.warn{background:var(--mid)} .chip.pass{background:var(--good)} .chip.info{background:#9fb0c9}
/* why-seo stat grid */
.statgrid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;margin-bottom:8px}
.statbox{border:1px solid #eef1f6;border-top:4px solid var(--accent);border-radius:12px;padding:22px 20px;background:#fafbfd}
.statbox b{font-size:40px;font-weight:800;color:var(--navy);display:block;line-height:1}
.statbox span{font-size:13px;color:var(--mut);display:block;margin-top:8px;line-height:1.45}
/* workstreams */
.wsgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px 22px}
.ws{display:flex;gap:16px;align-items:flex-start;border:1px solid #eef1f6;border-radius:12px;padding:16px 20px;background:#fafbfd}
.ws-n{flex-shrink:0;width:42px;height:42px;border-radius:50%;background:var(--accent);color:var(--navy);font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center}
.ws b{display:block;font-size:15px;color:var(--navy)} .ws span{font-size:12.5px;color:var(--mut);line-height:1.45}
/* reporting cadence */
.cadgrid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px;margin-bottom:6px}
.cad{border:1px solid #eef1f6;border-top:4px solid var(--accent);border-radius:12px;padding:16px 18px;background:#fafbfd}
.cad b{font-size:17px;color:var(--navy);display:block} .cad i{font-style:italic;font-size:12px;color:#2a9db8;display:block;margin:2px 0 10px} .cad p{font-size:12px;color:var(--mut);line-height:1.5}
/* link health */
.lhstat{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #eef1f6;padding:9px 0;font-size:14px;color:var(--mut)}
.lhstat b{font-size:24px;font-weight:800;color:var(--navy)}
.lhstat-full{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #eef1f6;font-size:14px;color:var(--mut)}
.lhstat-full span{min-width:130px}
.lhbar-track{flex:1;height:12px;background:#eef1f6;border-radius:99px;overflow:hidden}
.lhbar-fill{height:100%;border-radius:99px;transition:width 1s ease}
.lhstat-full b{min-width:52px;text-align:right;font-weight:800;font-size:14px}
.lhwarn{background:#fff6e6;border-left:4px solid var(--mid);border-radius:8px;padding:10px 14px;font-size:12.5px;color:#7a4a00;margin-top:6px}
.lhwarn small{display:block;margin-top:3px;color:#b9821a}
.anchor-table{display:flex;flex-direction:column;gap:7px;margin-bottom:14px}
.anchor-row{display:grid;grid-template-columns:160px 1fr 30px;align-items:center;gap:10px;font-size:13px}
.anchor-txt{color:#3b4d68;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.anchor-bar-track{height:10px;background:#eef1f6;border-radius:99px;overflow:hidden}
.anchor-bar-fill{height:100%;background:var(--navy);border-radius:99px;transition:width 1s ease}
.anchor-row b{font-weight:700;color:var(--mut);font-size:12px;text-align:right}
.offpage-note{display:flex;gap:16px;align-items:flex-start;background:#f5f9ff;border:1px dashed #9fb0c9;border-radius:12px;padding:16px 18px;margin-top:6px}
.offpage-icon{font-size:28px;flex-shrink:0}
.offpage-note b{display:block;font-size:15px;color:var(--navy);margin-bottom:5px}
.offpage-note p{font-size:12.5px;color:var(--mut);line-height:1.5}
/* comparison table */
.cmptab{width:100%;border-collapse:collapse;font-size:14px}
.cmptab th{background:var(--navy);color:#fff;text-align:left;padding:12px 16px;font-size:12px}
.cmptab th.uscol{background:var(--accent);color:var(--navy)}
.cmptab td{padding:11px 16px;border-bottom:1px solid #eef1f6;color:var(--mut)}
.cmptab td:first-child{color:var(--navy);font-weight:600}
.cmptab td.uscol{background:#fffdf4;color:var(--navy);font-weight:700}
/* controls */
#bar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:50;display:flex;align-items:center;gap:16px;background:rgba(15,17,21,.85);backdrop-filter:blur(8px);padding:9px 18px;border-radius:99px;color:#fff;font-size:13px;font-family:Inter,sans-serif}
#bar button{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;width:28px;height:28px;border-radius:50%;transition:background .15s}
#bar button:hover{background:rgba(255,255,255,.15)}
#dots{display:flex;gap:6px}
.dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.3);cursor:pointer;transition:all .2s}
.dot.on{background:var(--accent);width:22px;border-radius:99px}
#cnt{min-width:46px;text-align:center;font-variant-numeric:tabular-nums}
#hint{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:50;color:rgba(255,255,255,.5);font-family:Inter,sans-serif;font-size:12px}
@media print{
  body{overflow:visible;background:#fff}
  #bar,#hint{display:none}
  #stage{position:static;display:block}
  .slide{position:relative;opacity:1!important;pointer-events:auto;page-break-after:always;box-shadow:none;margin:0 auto}
  .corner::before,.corner-badge,.cover,.cover-tri,.cover-tri::after,.cover-badge,.bar-fill,.chip,.tl-dot,.cnt,.find-x,.ptab th,.geo-dot,.vsbar-fill,.cover-badge b{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:1280px 720px;margin:0}
}
</style></head>
<body>
<div id="hint">← → เลื่อนสไลด์ · F เต็มจอ · P พิมพ์ PDF</div>
<div id="stage">${slides.join('\n')}</div>
<div id="bar">
  <button onclick="go(-1)" title="ก่อนหน้า">‹</button>
  <div id="dots"></div>
  <span id="cnt"></span>
  <button onclick="go(1)" title="ถัดไป">›</button>
  <button onclick="fs()" title="เต็มจอ" style="font-size:14px">⛶</button>
</div>
<script>
const slides=[...document.querySelectorAll('.slide')];
let i=0;const N=slides.length;
const stage=document.getElementById('stage');
const dots=document.getElementById('dots');
slides.forEach((_,k)=>{const d=document.createElement('div');d.className='dot';d.onclick=()=>set(k);dots.appendChild(d);});
function scale(){const s=Math.min(innerWidth/1280,innerHeight/720);stage.style.transform='scale('+s+')';}
function set(k){i=Math.max(0,Math.min(N-1,k));slides.forEach((s,n)=>s.classList.toggle('on',n===i));[...dots.children].forEach((d,n)=>d.classList.toggle('on',n===i));document.getElementById('cnt').textContent=(i+1)+' / '+N;}
function go(d){set(i+d);}
function fs(){if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen();}
addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){go(1);e.preventDefault();}
  else if(e.key==='ArrowLeft'||e.key==='PageUp'){go(-1);e.preventDefault();}
  else if(e.key==='f'||e.key==='F')fs();
  else if(e.key==='p'||e.key==='P'){e.preventDefault();window.print();}
  else if(e.key==='Home')set(0);else if(e.key==='End')set(N-1);
});
stage.addEventListener('click',e=>{if(e.clientX>innerWidth*0.6)go(1);else if(e.clientX<innerWidth*0.4)go(-1);});
addEventListener('resize',scale);scale();set(0);
</script>
</body></html>`;
}
