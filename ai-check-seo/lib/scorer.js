// Scorer — คำนวณคะแนน 0–100 รายหมวดและรวม ถ่วงน้ำหนักตาม severity
const SEV_WEIGHT = { high: 10, med: 5, low: 2 };
const STATUS_PENALTY = { fail: 1.0, warn: 0.45, pass: 0, info: 0 };

const CAT_WEIGHT = { // น้ำหนักหมวดต่อคะแนนรวม
  onpage: 18, index: 20, schema: 12, links: 8, images: 5,
  performance: 10, security: 5, rendering: 12, geo: 10,
};

export const CAT_LABELS = {
  onpage: 'Meta & เนื้อหา', index: 'Indexability', schema: 'Structured Data',
  links: 'ลิงก์', images: 'รูปภาพ', performance: 'ความเร็ว',
  security: 'ความปลอดภัย', rendering: 'JS Rendering', geo: 'GEO (AI Search)',
};

export function scoreAudit(allChecks) {
  const byCat = {};
  for (const c of allChecks) {
    if (c.status === 'info') continue;
    (byCat[c.category] ||= []).push(c);
  }
  const categoryScores = {};
  for (const [cat, checks] of Object.entries(byCat)) {
    let possible = 0, lost = 0;
    for (const c of checks) {
      const w = SEV_WEIGHT[c.severity] || 2;
      possible += w;
      lost += w * (STATUS_PENALTY[c.status] || 0);
    }
    categoryScores[cat] = possible ? Math.round((1 - lost / possible) * 100) : 100;
  }
  let totalW = 0, totalS = 0;
  for (const [cat, score] of Object.entries(categoryScores)) {
    const w = CAT_WEIGHT[cat] || 5;
    totalW += w; totalS += score * w;
  }
  const overall = totalW ? Math.round(totalS / totalW) : 0;
  const counts = {
    fail: allChecks.filter(c => c.status === 'fail').length,
    warn: allChecks.filter(c => c.status === 'warn').length,
    pass: allChecks.filter(c => c.status === 'pass').length,
  };
  const grade = overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : overall >= 45 ? 'D' : 'F';
  return { overall, grade, categoryScores, counts };
}
