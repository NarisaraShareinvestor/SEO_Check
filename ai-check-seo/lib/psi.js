// PageSpeed Insights — ดึง Core Web Vitals จริง (Lighthouse lab + CrUX field data) จาก Google
// ฟรี ไม่ต้องมี key (quota ต่ำ) — ใส่ PAGESPEED_API_KEY ใน .env เพื่อ quota สูงขึ้น

function mk(id, severity, status, title, detail, recommendation = '') {
  return { id, category: 'performance', severity, status, title, detail, recommendation, pages: [], affectedCount: 0, fixable: false };
}

export async function fetchCWV(url) {
  try {
    const host = new URL(url).hostname;
    if (/^(localhost|127\.|192\.168\.|10\.)/.test(host)) return { ok: false, skip: true, reason: 'local URL — PageSpeed ทดสอบได้เฉพาะเว็บสาธารณะ' };
  } catch { return { ok: false, skip: true, reason: 'invalid url' }; }

  const key = process.env.PAGESPEED_API_KEY;
  const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance${key ? `&key=${key}` : ''}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 75000);
    const res = await fetch(api, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, status: res.status, error: (await res.text()).slice(0, 200) };
    const d = await res.json();
    const audits = d.lighthouseResult?.audits || {};
    const crux = d.loadingExperience?.metrics || {};
    return {
      ok: true,
      perfScore: Math.round((d.lighthouseResult?.categories?.performance?.score || 0) * 100),
      lab: {
        lcpMs: audits['largest-contentful-paint']?.numericValue,
        cls: audits['cumulative-layout-shift']?.numericValue,
        tbtMs: audits['total-blocking-time']?.numericValue,
        fcpMs: audits['first-contentful-paint']?.numericValue,
        ttfbMs: audits['server-response-time']?.numericValue,
      },
      field: {
        lcpMs: crux.LARGEST_CONTENTFUL_PAINT_MS?.percentile,
        inpMs: crux.INTERACTION_TO_NEXT_PAINT?.percentile,
        cls: crux.CUMULATIVE_LAYOUT_SHIFT?.percentile != null ? crux.CUMULATIVE_LAYOUT_SHIFT.percentile / 100 : undefined,
        overall: d.loadingExperience?.overall_category, // FAST | AVERAGE | SLOW
      },
      topOpportunities: Object.values(audits)
        .filter(a => a.details?.type === 'opportunity' && a.numericValue > 150)
        .sort((a, b) => b.numericValue - a.numericValue)
        .slice(0, 5)
        .map(a => ({ title: a.title, savingMs: Math.round(a.numericValue) })),
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

const fmt = (ms) => ms == null ? '–' : ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : Math.round(ms) + 'ms';

export function buildPsiChecks(psi) {
  const checks = [];
  if (!psi || psi.skip) {
    checks.push(mk('cwv', 'low', 'info', 'Core Web Vitals (PageSpeed) — ข้ามการทดสอบ', psi?.reason || 'ไม่ได้รัน', ''));
    return checks;
  }
  if (!psi.ok) {
    checks.push(mk('cwv', 'low', 'info', 'เชื่อมต่อ Google PageSpeed ไม่สำเร็จ', `${psi.status || ''} ${psi.error || ''}`.trim().slice(0, 200), 'ลองใหม่ภายหลัง หรือใส่ PAGESPEED_API_KEY เพื่อเพิ่ม quota'));
    return checks;
  }

  // คะแนน Lighthouse Performance
  checks.push(mk('cwv-score', 'high', psi.perfScore >= 80 ? 'pass' : psi.perfScore >= 50 ? 'warn' : 'fail',
    `Lighthouse Performance: ${psi.perfScore}/100 (มือถือ)`,
    `วัดจริงโดย Google PageSpeed — LCP ${fmt(psi.lab.lcpMs)}, TBT ${fmt(psi.lab.tbtMs)}, CLS ${psi.lab.cls?.toFixed(3) ?? '–'}, TTFB ${fmt(psi.lab.ttfbMs)}`,
    psi.topOpportunities?.length ? 'จุดที่ลดเวลาได้มากสุด: ' + psi.topOpportunities.map(o => `${o.title} (~${fmt(o.savingMs)})`).join(' · ') : ''));

  // Field data (ผู้ใช้จริงจาก CrUX) — มีเฉพาะเว็บที่ traffic พอ
  if (psi.field.overall) {
    const f = psi.field;
    const cat = f.overall;
    checks.push(mk('cwv-field', 'high', cat === 'FAST' ? 'pass' : cat === 'AVERAGE' ? 'warn' : 'fail',
      `Core Web Vitals จากผู้ใช้จริง: ${cat === 'FAST' ? 'ผ่าน' : cat === 'AVERAGE' ? 'ปานกลาง' : 'ไม่ผ่าน'} (CrUX 28 วัน)`,
      `LCP ${fmt(f.lcpMs)} (เกณฑ์ ≤2.5s) · INP ${fmt(f.inpMs)} (เกณฑ์ ≤200ms) · CLS ${f.cls?.toFixed(2) ?? '–'} (เกณฑ์ ≤0.1) — CWV เป็น ranking signal ของ Google โดยตรง`,
      cat !== 'FAST' ? 'ไล่แก้ตามรายการ opportunity ของ Lighthouse ด้านบน เริ่มจาก LCP ก่อน' : ''));
  } else {
    checks.push(mk('cwv-field', 'low', 'info', 'ไม่มี field data จากผู้ใช้จริง (CrUX)', 'เว็บมี traffic ไม่พอให้ Google เก็บสถิติ CWV — ใช้ค่า lab จาก Lighthouse แทน', ''));
  }
  return checks;
}
