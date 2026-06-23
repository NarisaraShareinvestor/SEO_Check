// Export สไลด์ทั้งเล่มเป็น PowerPoint (.pptx) ฝั่งเบราว์เซอร์
// ถ่ายภาพแต่ละ .slide ด้วย html2canvas แล้วฝังลง pptxgenjs หนึ่งภาพต่อหนึ่งสไลด์ (16:9 widescreen)
// ต้องโหลด html2canvas + pptxgenjs (ผ่าน CDN) มาก่อนหน้านี้
(function () {
  // 16:9 widescreen (นิ้ว) — ตรงกับ @page 13.333in × 7.5in และสัดส่วน .slide 1280×720 ของรายงาน
  const PAGE_W = 13.333, PAGE_H = 7.5;

  function setStatus(btn, txt, disabled) {
    if (!btn) return;
    btn.textContent = txt;
    btn.disabled = !!disabled;
    btn.style.opacity = disabled ? '0.7' : '1';
    btn.style.cursor = disabled ? 'wait' : 'pointer';
  }

  async function exportPPTX(fileName, btn) {
    if (typeof window.PptxGenJS === 'undefined' || typeof window.html2canvas === 'undefined') {
      alert('โหลดไลบรารีสร้าง PowerPoint ไม่สำเร็จ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง');
      return;
    }
    // เฉพาะสไลด์ที่มองเห็น (กันปกที่ซ่อนอยู่ตาม theme ถูกถ่ายเป็นหน้าว่าง)
    const slides = Array.from(document.querySelectorAll('.slide')).filter(el => el.getClientRects().length > 0);
    if (!slides.length) return;

    const toolbar = document.querySelector('.toolbar');
    if (toolbar) toolbar.style.visibility = 'hidden'; // กันปุ่มติดในภาพ
    const origLabel = btn ? btn.textContent : '';
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      const pptx = new window.PptxGenJS();
      pptx.defineLayout({ name: 'W169', width: PAGE_W, height: PAGE_H });
      pptx.layout = 'W169';

      for (let i = 0; i < slides.length; i++) {
        setStatus(btn, `กำลังสร้าง PowerPoint… ${i + 1}/${slides.length}`, true);
        const el = slides[i];
        const canvas = await window.html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: null,   // ใช้พื้นหลังของสไลด์เอง (มีทั้งขาว/น้ำเงินเข้ม)
          logging: false,
          windowWidth: el.scrollWidth,
          windowHeight: el.scrollHeight,
        });
        const data = canvas.toDataURL('image/png');
        const slide = pptx.addSlide();
        slide.addImage({ data, x: 0, y: 0, w: PAGE_W, h: PAGE_H });
      }

      setStatus(btn, 'กำลังบันทึกไฟล์…', true);
      await pptx.writeFile({ fileName: (fileName || 'report') + '.pptx' });
    } catch (e) {
      console.error(e);
      alert('สร้าง PowerPoint ไม่สำเร็จ: ' + (e && e.message ? e.message : e));
    } finally {
      if (toolbar) toolbar.style.visibility = '';
      setStatus(btn, origLabel || 'บันทึกเป็น PowerPoint', false);
    }
  }

  window.exportPPTX = exportPPTX;
})();
