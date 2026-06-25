// ดาวน์โหลด PDF ของรายงาน (16:9 / A4) จาก endpoint ฝั่งเซิร์ฟเวอร์
// fetch → blob → a[download] (เชื่อถือได้ทุกเบราว์เซอร์)
(function () {
  function setStatus(btn, txt, disabled) {
    if (!btn) return;
    btn.textContent = txt;
    btn.disabled = !!disabled;
    btn.style.opacity = disabled ? '0.7' : '1';
    btn.style.cursor = disabled ? 'wait' : 'pointer';
  }

  async function downloadExecPdf(btn) {
    var orig = btn ? btn.textContent : '';
    setStatus(btn, 'กำลังสร้าง PDF…', true);
    try {
      var p = location.pathname;
      if (p.charAt(p.length - 1) === '/') p = p.slice(0, -1);
      var res = await fetch(p + '/pdf' + location.search);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var blob = await res.blob();
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (p.split('/').pop() || 'report') + '-exec.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    } catch (e) {
      alert('สร้าง PDF ไม่สำเร็จ: ' + (e && e.message ? e.message : e) + ' — ลองใหม่อีกครั้ง');
    } finally {
      setStatus(btn, orig || 'ดาวน์โหลด PDF (16:9)', false);
    }
  }
  window.downloadExecPdf = downloadExecPdf;
})();
