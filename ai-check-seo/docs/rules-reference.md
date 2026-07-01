# AI SEO Audit Pro — คู่มือกฎทั้งหมด (Rule Reference)

> เอกสารนี้ generate จาก `public/skill-graph.json` (แหล่งข้อมูลเดียวกับกราฟในแอป) — แต่ละกฎมี What / Why / How / Decision Rule / Dependencies / References / Confidence เหมือน panel ที่คลิกในกราฟ

สรุป: **91 กฎ** · 31 entity · 8 หมวด · กฎที่ยืนยันความถูกต้องแล้ว **5** ตัว

---

## 🔷 Dependencies — ข้อมูลตั้งต้น (input ของกฎ)

ไม่ใช่กฎ (ไม่ให้ผล pass/fail เอง) แต่เป็นสัญญาณที่คำนวณครั้งเดียวแล้วหลายกฎดึงไปใช้ร่วมกัน — หน้าที่หลักคือ **กรอง "ซ้ำปลอม" ออกก่อนกฎตัดสิน**

### ◻︎ Final URL
หา URL ปลายทางจริงก่อนวิเคราะห์ — dependency กลางของ duplicate/canonical/per-page

**ทำงานยังไง:** GET → Follow 301/302 จนสุด → ได้ Final URL + status + redirect chain → ยุบ http→https · www→non-www · trailing slash · / → /en/home ที่ไปที่เดียวกัน

**ป้อนให้กฎ:** `นับหน้าจาก Final URL` · `หลาย URL → Final URL เดียวกัน = หน้าเดียว (dedupe)`

**กฎที่พึ่ง:** `<title> ซ้ำ` · `description ซ้ำ` · `ไม่มี <h1>` · `<h1> หลายตัว` · `<h1> ซ้ำหน้าอื่น` · `<h1> ถูกซ่อน` · `ไม่มี canonical` · `หน้าซ้ำใกล้เคียง`

อ้างอิง: [Google: Redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects) · [RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#name-redirection-3xx)

### ◻︎ Canonical

**กฎที่พึ่ง:** `<title> ซ้ำ` · `description ซ้ำ` · `<h1> ซ้ำหน้าอื่น` · `หน้าซ้ำใกล้เคียง`

### ◻︎ Language

**กฎที่พึ่ง:** `<title> ซ้ำ` · `description ซ้ำ` · `<h1> ซ้ำหน้าอื่น`

### ◻︎ Page Type

**กฎที่พึ่ง:** `<title> ซ้ำ` · `description ซ้ำ` · `<h1> ซ้ำหน้าอื่น`

---

## 📋 กฎทั้งหมด (จัดกลุ่ม หมวด → Entity → กฎ)

# On-Page

## Title

### ไม่มี <title>

`On-Page` · ความเชื่อมั่น 100% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 85-97)**

ตรวจ <title> tag ใน raw HTML, JS-rendered, หรือ SPA meta
- *อ่านจาก:* `p.title (raw), p.renderedTitle, p.metas['title'] (JS/SPA fallback)`

เงื่อนไขการตรวจ:
- ไม่มี raw + rendered + meta → fail/high
- raw ไม่มี แต่มี rendered/meta → warn/high (AI bot ไม่เห็น)
- มี raw ทั้งหมด → pass/high

ข้อสังเกต / ควรเพิ่ม:
- 3-state check: ผ้ายังประเมิน rendered title จาก JS/SPA ไม่ใช่ raw HTML ที่ Google crawl ถามครั้งแรก
- ยังไม่ validate length ที่นี่ — check อื่น title-length ทำ

**WHAT — ตรวจอะไร**

Title คือชื่อหน้าเว็บ — เป็นบรรทัดสีน้ำเงินตัวใหญ่ที่คนเห็นเป็นอันดับแรกบนหน้าผลการค้นหา Google และเป็นชื่อที่โชว์บนแท็บเบราว์เซอร์ ถ้าหน้าไหนไม่ใส่ Google จะเดาชื่อให้เอง ซึ่งมักออกมาไม่ตรงกับที่เราอยากสื่อ

**WHY — ทำไมต้องตรวจ**

นี่คือ "พาดหัวร้าน" บนหน้า Google — เป็นตัวตัดสินว่าคนจะคลิกเข้าเว็บเราหรือคลิกคู่แข่ง ถ้าปล่อยให้ Google เดาเอง พาดหัวอาจกลายเป็นข้อความมั่วๆ ที่ไม่มีใครอยากกด เท่ากับเสียลูกค้าตั้งแต่ยังไม่เข้าเว็บ

**อ้างอิง:** [Google: Influencing title links](https://developers.google.com/search/docs/appearance/title-link) · [HTML Standard: the title element](https://html.spec.whatwg.org/multipage/semantics.html#the-title-element)


### <title> สั้น/ยาว

`On-Page` · ความเชื่อมั่น 75% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 99-105)**

ตรวจความยาว <title> ว่าอยู่ในช่วง 15-60 ตัวอักษร
- *อ่านจาก:* `p.title.length`

เงื่อนไขการตรวจ:
- >60 หรือ >0 และ <15 → warn/med
- ทั้งหมด 15-60 → pass/med

ข้อสังเกต / ควรเพิ่ม:
- ใช้ hardcoded threshold 15-60 ไม่ปรับตามภาษา (ภาษาไทยอักษรไม่มีช่องว่างมี wordcount ต่อ byte แตกต่าง)
- ไม่ทำ de-duplicate ด้วย finalUrl หรือ redirect chain

**WHAT — ตรวจอะไร**

ความยาวของชื่อหน้า (Title) ที่เหมาะสมคือประมาณ 30–60 ตัวอักษร ถ้ายาวเกินไป Google จะตัดท้ายทิ้งแล้วต่อด้วย "…" ถ้าสั้นเกินไปก็ดูไม่น่าสนใจ

**WHY — ทำไมต้องตรวจ**

ชื่อที่โดนตัดกลางคันทำให้ข้อความขายที่สำคัญหายไปจากสายตาลูกค้าบนหน้า Google ลดโอกาสที่คนจะกดเข้ามา

**อ้างอิง:** [Google: Influencing title links](https://developers.google.com/search/docs/appearance/title-link) · [Moz: Title tag](https://moz.com/learn/seo/title-tag)


### <title> ซ้ำ  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 85% · Tier 2
> verify (เคส vgi) + backport exclusions/normalize เท่า h1 + unit test 130/130

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 126-133)**

ตรวจว่าหลายหน้าใช้ <title> ซ้ำกัน (เฉพาะหน้าเนื้อหาจริง)
- *อ่านจาก:* `p.title ผ่าน dupGroups → dupEligible (pageEligible = Final URL + ตัด noindex/canonical-away, แล้วตัด pagination/search/filter) + normDup + stripLocale`

เงื่อนไขการตรวจ:
- มีกลุ่ม title ซ้ำ (normalize NFC/zero-width/lowercase) ข้ามหน้า dupEligible และไม่ใช่คู่ /th vs /en → fail/high
- ไม่มีกลุ่มซ้ำ → pass/high

ข้อสังเกต / ควรเพิ่ม:
- backport แล้ว: dedupe Final URL + ตัด noindex/canonical/pagination/localization + normalize (เท่า h1-duplicate)
- key ด้วย finalUrl · groups โชว์ค่าจริง (ไม่ใช่ค่า normalize) ต่อกลุ่ม
- unit test ล็อก: fail จริง / ตัด noindex-canonical-ภาษา / normalize case (130/130)

**WHAT — ตรวจอะไร**

มีหลายหน้าใช้ชื่อหน้า (Title) เหมือนกันเป๊ะ เหมือนร้านในห้างที่แขวนป้ายชื่อร้านเดียวกัน 3-4 ป้าย ทั้งที่ขายของคนละอย่าง ทำให้ทั้งคนและ Google งงว่าหน้าไหนคือหน้าอะไร

**WHY — ทำไมต้องตรวจ**

เมื่อหลายหน้าชื่อซ้ำกัน Google ไม่รู้ว่าจะดันหน้าไหนขึ้นอันดับ เลยกระจายคะแนนหรือเลือกหน้าผิดมาแสดง ทำให้หน้าที่เราอยากให้ลูกค้าเจอจริงๆ ถูกกลบ อันดับโดยรวมตก

**HOW — ตรวจอย่างไร**

1. dupEligible (Final URL + ตัด noindex/canonical-away)
2. ตัด pagination/search/filter + localization (/th vs /en)
3. normalize NFC + zero-width + lowercase
4. group by title (finalUrl)

**DECISION RULE — เกณฑ์ตัดสิน**

- Final URL ต่าง + canonical ต่าง + ไม่ใช่ pagination/ภาษา + title ตรง (normalize) → fail/high  →  🔴 High

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL` · `Canonical` · `Language` · `Page Type`

**อ้างอิง:** [Google: Influencing title links](https://developers.google.com/search/docs/appearance/title-link) · [Moz: Title tag](https://moz.com/learn/seo/title-tag)


## Meta Description

### ไม่มี meta description

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 118-127)**

ตรวจ meta description ใน raw HTML, rendered, หรือ JS-created
- *อ่านจาก:* `p.metas['description'], p.renderedDescription`

เงื่อนไขการตรวจ:
- ไม่มี raw + rendered → fail/med
- raw ไม่มี แต่มี rendered → warn/med (AI bot ไม่เห็น)
- มี raw ทั้งหมด → pass/med

ข้อสังเกต / ควรเพิ่ม:
- 3-state เหมือน title-missing
- ไม่ validate length ที่นี่ — check อื่น desc-length ทำ

**WHAT — ตรวจอะไร**

Meta description คือข้อความสรุป 1-2 บรรทัดสีเทาที่อยู่ใต้ชื่อหน้าในผลการค้นหา Google เป็นเหมือน "คำโปรย" ที่ชวนคนกด ถ้าไม่ใส่ Google จะดึงข้อความท่อนไหนก็ได้จากหน้ามาแสดงแทน

**WHY — ทำไมต้องตรวจ**

นี่คือพื้นที่โฆษณาฟรีบนหน้า Google ที่เราเขียนเองได้ ถ้าปล่อยว่าง Google อาจหยิบข้อความที่ไม่เกี่ยวหรือไม่น่าสนใจมาโชว์ เท่ากับเสียโอกาสปิดการขายตั้งแต่หน้าค้นหา

**อ้างอิง:** [Google: Control your snippets](https://developers.google.com/search/docs/appearance/snippet) · [Moz: Meta description](https://moz.com/learn/seo/meta-description)


### description สั้น/ยาว

`On-Page` · ความเชื่อมั่น 75% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 129-130)**

ตรวจความยาว meta description ว่า 50-170 ตัวอักษร
- *อ่านจาก:* `p.metas['description'].length`

เงื่อนไขการตรวจ:
- >170 หรือ <50 → warn/low
- ทั้งหมด 50-170 → pass (implicit)

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold 50-170 ไม่ปรับตามภาษา
- ตรวจเฉพาะหน้าที่มี description (ถ้าไม่มีไม่ติด warn นี้ — ติด desc-missing แทน)

**WHAT — ตรวจอะไร**

คำโปรยใต้ชื่อหน้า (Meta description) ที่ดีควรยาวราว 80–160 ตัวอักษร สั้นไปก็ไม่พอเล่ารายละเอียด ยาวไปก็โดน Google ตัดท้าย

**WHY — ทำไมต้องตรวจ**

ความยาวพอดีทำให้คำโปรยเล่าจุดขายได้ครบและไม่โดนตัด เพิ่มโอกาสที่คนอ่านแล้วอยากกดเข้ามา

**อ้างอิง:** [Google: Control your snippets](https://developers.google.com/search/docs/appearance/snippet) · [Moz: Meta description](https://moz.com/learn/seo/meta-description)


### description ซ้ำ

`On-Page` · ความเชื่อมั่น 75% · Tier 3
> logic+exclusions เท่า h1-duplicate + unit test แล้ว · รอ verify เว็บจริง

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 149-154)**

ตรวจว่าหลายหน้าใช้ meta description ซ้ำกัน (เฉพาะหน้าเนื้อหาจริง)
- *อ่านจาก:* `p.metas['description'] ผ่าน dupGroups → dupEligible + normDup + stripLocale`

เงื่อนไขการตรวจ:
- มีกลุ่ม description ซ้ำ (normalize) ข้ามหน้า dupEligible และไม่ใช่คู่ /th vs /en → warn/med
- ไม่มีกลุ่มซ้ำ → ไม่ push (เงียบ)

ข้อสังเกต / ควรเพิ่ม:
- backport แล้ว: dedupe Final URL + ตัด noindex/canonical/pagination/localization + normalize (เท่า h1-duplicate)
- ยังไม่มี branch pass (เงียบเมื่อไม่ซ้ำ) — เหมือนเดิม
- รอ verify เว็บจริง (logic + unit test ครบแล้ว)

**WHAT — ตรวจอะไร**

มีหลายหน้าใช้คำโปรย (Meta description) ข้อความเดียวกัน ทั้งที่เนื้อหาแต่ละหน้าต่างกัน

**WHY — ทำไมต้องตรวจ**

คำโปรยที่ซ้ำกันทำให้ทุกหน้าดูเหมือนกันไปหมดบน Google ลูกค้าแยกไม่ออกว่าหน้าไหนตอบโจทย์ตัวเอง และ Google มองว่าเนื้อหาไม่มีเอกลักษณ์

**HOW — ตรวจอย่างไร**

1. dupEligible (Final URL + ตัด noindex/canonical-away)
2. ตัด pagination/search/filter + localization (/th vs /en)
3. normalize NFC + zero-width + lowercase
4. group by description (finalUrl)

**DECISION RULE — เกณฑ์ตัดสิน**

- Final URL ต่าง + canonical ต่าง + ไม่ใช่ pagination/ภาษา + description ตรง (normalize) → warn/med  →  🟠 Medium

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL` · `Canonical` · `Language` · `Page Type`

**อ้างอิง:** [Google: Control your snippets](https://developers.google.com/search/docs/appearance/snippet) · [Moz: Duplicate content](https://moz.com/learn/seo/duplicate-content)


## H1

### ไม่มี <h1>  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 95% · Tier 1
> verify: รวม Empty H1 = High

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 141-153)**

ตรวจ H1 tag ใน raw HTML, rendered, หรือ JS-created (H1 ว่างเปล่า = ไม่มี)
- *อ่านจาก:* `p.headings.filter(h => h.tag === 'h1' && h.text?.trim()), p.renderedH1`

เงื่อนไขการตรวจ:
- ไม่มี raw + rendered H1 ที่มีข้อความ → fail/high
- raw ไม่มี แต่ rendered มี → warn/high (AI bot ไม่เห็น)
- มี raw ทั้งหมด → pass/high

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ pageEligible เท่านั้น (ตัด noindex + canonical-away)
- H1 ว่างเปล่า (whitespace) นับเท่าไม่มี
- 3-state เหมือน title/desc

**WHAT — ตรวจอะไร**

H1 คือพาดหัวใหญ่สุดบนหน้าเว็บ (เหมือนหัวข้อข่าวตัวโตบนหน้าหนึ่งหนังสือพิมพ์) หน้านี้ไม่มีพาดหัวหลัก

**WHY — ทำไมต้องตรวจ**

พาดหัวหลักบอกทั้งคนและ Google ว่าหน้านี้เกี่ยวกับอะไร ถ้าไม่มี Google จับใจความหน้าได้ยากขึ้น และคนเข้ามาก็ไม่รู้ทันทีว่ามาถูกที่ไหม

**HOW — ตรวจอย่างไร**

1. หา <h1> ที่มีข้อความจริง (H1 ว่าง=ไม่มี)
2. ผ่าน pageEligible (Final URL + ตัด noindex/canonical)
3. ไม่มีใน raw แต่พบหลัง render = SPA

**DECISION RULE — เกณฑ์ตัดสิน**

- ไม่มี H1 ที่มีข้อความ ทั้ง raw+render → High  →  🔴 High
- พบเฉพาะหลัง render → Warn  →  🟡 Low/Warn

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL`

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [Google: SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)


### <h1> หลายตัว  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 75% · Tier 3
> verify: Info (เดิม fail)

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 163-175)**

ตรวจหน้าที่มี H1 มากกว่า 1 (HTML5 อนุญาต แต่เป็นข้อสังเกต)
- *อ่านจาก:* `p.headings.filter(h => h.tag === 'h1').length`

เงื่อนไขการตรวจ:
- >1 H1 → info/low (ไม่ใช่ error)

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ pageEligible
- ถือว่า pass/info ไม่ fail เพราะ HTML5 + Google ไม่ถือว่าผิด
- ไม่ validate เฉพาะเมื่อ H1 อยู่ใน <article>/<section> ของมันเอง (ถือว่า valid HTML pattern)

**WHAT — ตรวจอะไร**

หน้าเดียวมีพาดหัวใหญ่สุด (H1) หลายอัน เหมือนหน้าหนังสือพิมพ์ที่มีหัวข้อข่าวตัวโตเท่ากัน 5 ข่าวในหน้าเดียว ไม่รู้อันไหนคือข่าวเด่น

**WHY — ทำไมต้องตรวจ**

ทำให้ Google สับสนว่าประเด็นหลักของหน้าคืออะไร ลดความชัดเจนของหน้าในสายตา Google และอาจกระทบอันดับ

**HOW — ตรวจอย่างไร**

1. นับ H1 ต่อหน้า (pageEligible)

**DECISION RULE — เกณฑ์ตัดสิน**

- หลาย H1 = Info เสมอ — HTML5 อนุญาต Google ไม่ถือว่าผิด  →  ⚪ Info

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL`

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [Ahrefs: The H1 tag](https://ahrefs.com/blog/h1-tag/)


### <h1> ซ้ำหน้าอื่น  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 70% · Tier 3
> verify: + normalization + exclusions

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 655-673)**

ตรวจ H1 ที่ซ้ำกันข้ามหน้า (เฉพาะ dupEligible = content pages เท่านั้น)
- *อ่านจาก:* `p.headings, dupEligible (filter ตัด noindex/canonical/pagination), normH1 helper, stripLocale helper`

เงื่อนไขการตรวจ:
- มี H1 ซ้ำ (เปรียบเทียบหลัง normalize) → warn/med

ข้อสังเกต / ควรเพิ่ม:
- dupEligible = pageEligible - pagination/search/filter
- normalize H1: NFC + lowercase + remove control chars + collapse whitespace
- stripLocale = เอาส่วน /[a-z]{2}/ ก่อนเนื้อหา

**WHAT — ตรวจอะไร**

หลายหน้าใช้พาดหัวหลัก (H1) ข้อความเดียวกัน

**WHY — ทำไมต้องตรวจ**

ทำให้แต่ละหน้าดูไม่มีเอกลักษณ์ Google แยกประเด็นของแต่ละหน้าได้ยาก

**HOW — ตรวจอย่างไร**

1. pageEligible (Final URL + noindex/canonical)
2. ตัด pagination/search/filter + localization (/th vs /en)
3. normalize NFC + zero-width + lowercase
4. Group ตาม H1

**DECISION RULE — เกณฑ์ตัดสิน**

- Final URL ต่าง + canonical ต่าง + ไม่ใช่ pagination/ภาษา + H1 ตรง 100% → Medium  →  🟠 Medium

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL` · `Canonical` · `Language` · `Page Type`

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [Ahrefs: The H1 tag](https://ahrefs.com/blog/h1-tag/)


### <h1> ถูกซ่อน  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 80% · Tier 2
> verify: Medium

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 155-161)**

ตรวจ H1 ที่ซ่อนด้วย CSS (display:none, visibility:hidden)
- *อ่านจาก:* `p.hiddenH1 (raw inline style), p.renderedH1Hidden (computed style from Playwright)`

เงื่อนไขการตรวจ:
- มี H1 ซ่อน → warn/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ pageEligible
- ตรวจทั้ง raw inline style + rendered computed style แต่ยังไม่ cover ทั้ง CSS classes/media queries

**WHAT — ตรวจอะไร**

หน้ามีพาดหัวหลัก (H1) แต่ถูกซ่อนไว้ไม่ให้คนเห็น (เช่น ตั้งค่าให้มองไม่เห็นด้วยตา)

**WHY — ทำไมต้องตรวจ**

Google อาจมองว่าเป็นการพยายามหลอกระบบ และพาดหัวที่ซ่อนไว้ก็ไม่ช่วยลูกค้าเข้าใจหน้าอยู่ดี

**HOW — ตรวจอย่างไร**

1. inline + computed style
2. display:none/visibility:hidden/opacity:0/font-size:0

**DECISION RULE — เกณฑ์ตัดสิน**

- H1 มีแต่มองไม่เห็น → Medium  →  🟠 Medium

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL`

**อ้างอิง:** [Google: SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) · [WCAG 2.1: Headings and Labels (2.4.6)](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)


## Headings

### ลำดับ heading ข้ามระดับ

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 179-184)**

ตรวจลำดับ heading ว่าข้ามระดับหรือไม่ (H1→H3 = ข้ามH2)
- *อ่านจาก:* `p.headings.map(h => +h.tag[1]) (array ของ 1,2,3...)`

เงื่อนไขการตรวจ:
- มี jump >1 ระดับติดต่อกัน → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ไม่ distinguish H1-multiple จากข้าม (ถ้ามี H1 ใน <article> ตามหลัง H1 section = valid ไม่จับ)
- ตรวจ okPages ไม่ได้ filter dupEligible

**WHAT — ตรวจอะไร**

ลำดับหัวข้อในหน้าไม่เรียงตามขั้น เหมือนสารบัญที่กระโดดจากบทที่ 1 ไปหัวข้อย่อย 3.2 เลยโดยไม่มีบทที่ 2

**WHY — ทำไมต้องตรวจ**

โครงสร้างหัวข้อที่เป็นระเบียบช่วยให้ Google และโปรแกรมอ่านหน้าจอ (สำหรับผู้พิการ) เข้าใจลำดับเนื้อหา ทำให้หน้าอ่านง่ายและจัดอันดับดีขึ้น

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [WCAG 2.1: Headings and Labels (2.4.6)](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)


### heading ว่างเปล่า

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 676-677)**

ตรวจ heading (h1-h6) ที่ว่างเปล่า (ไม่มี text)
- *อ่านจาก:* `p.emptyHeadings (count)`

เงื่อนไขการตรวจ:
- >0 empty headings → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages

**WHAT — ตรวจอะไร**

มีช่องหัวข้อในหน้าที่ว่างเปล่า ไม่มีข้อความ เหมือนป้ายหัวข้อที่แขวนไว้แต่ไม่ได้เขียนอะไร

**WHY — ทำไมต้องตรวจ**

หัวข้อว่างทำให้โครงสร้างหน้าดูรกและสับสน ไม่ช่วยทั้งคนอ่านและ Google

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [WCAG 2.1: Headings and Labels (2.4.6)](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)


## Content

### เนื้อหาบาง (thin)

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 186-187)**

ตรวจว่าเนื้อหาน้อยกว่า 150 คำ (thin content)
- *อ่านจาก:* `p.wordCount`

เงื่อนไขการตรวจ:
- <150 คำ + ไม่ emptyRoot → warn/med

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold 150 ไม่ปรับตามหลัก 300+ Google แนะนำ
- ตัด emptyRoot (SPA shell) ออกจาก check

**WHAT — ตรวจอะไร**

หน้าที่มีเนื้อหาน้อยเกินไป (เนื้อความสั้นมาก เช่นไม่ถึง 150 คำ) เปรียบเหมือนโบรชัวร์ที่มีแต่หัวข้อ ไม่มีรายละเอียดให้อ่าน

**WHY — ทำไมต้องตรวจ**

Google ชอบหน้าที่ให้ข้อมูลครบและเป็นประโยชน์ หน้าที่เนื้อหาบางจะสู้คู่แข่งที่เขียนละเอียดกว่าไม่ได้ ทำให้ติดอันดับยาก และลูกค้าที่เข้ามาก็ได้ข้อมูลไม่พอจะตัดสินใจซื้อ

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)


### ปี copyright เก่า

`On-Page` · ความเชื่อมั่น 60% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 715-717)**

ตรวจปี copyright ใน footer/content ว่าเก่า >1 ปีก่อนปัจจุบัน
- *อ่านจาก:* `p.maxCopyrightYear (detected from text parsing), new Date().getFullYear()`

เงื่อนไขการตรวจ:
- maxCopyrightYear < (now - 1) → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages

**WHAT — ตรวจอะไร**

ปีลิขสิทธิ์ที่ท้ายเว็บ (เช่น © 2020) ยังเป็นปีเก่า ไม่อัปเดตเป็นปีปัจจุบัน

**WHY — ทำไมต้องตรวจ**

ลูกค้าที่เห็นปีเก่าๆ อาจคิดว่าเว็บนี้ถูกทิ้งร้างหรือบริษัทเลิกทำแล้ว ทำให้ขาดความน่าเชื่อถือ เป็นจุดเล็กๆ ที่ทำลายความมั่นใจในการซื้อ

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)


## HTML Document

### ไม่มี lang ใน <html>

`On-Page` · ความเชื่อมั่น 95% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 189-192)**

ตรวจ lang attribute ใน <html> tag
- *อ่านจาก:* `p.lang (from <html lang="...">)`

เงื่อนไขการตรวจ:
- ไม่มี lang → warn/low
- มี lang → pass/low

ข้อสังเกต / ควรเพิ่ม:
- check ค่า lang ว่าต้องหา BCP 47 code ไหม ไม่ได้ validate
- แสดง lang code ที่พบ (เช่น th, en)

**WHAT — ตรวจอะไร**

หน้าเว็บไม่ได้ระบุว่าเป็นภาษาอะไร (ไทยหรืออังกฤษ) ในโค้ด เหมือนหนังสือที่ไม่บอกว่าเขียนภาษาอะไรบนปก

**WHY — ทำไมต้องตรวจ**

Google และเบราว์เซอร์ใช้ข้อมูลนี้แสดงผลและแปลภาษาให้ถูกต้อง ถ้าไม่ระบุ อาจแสดงผลเพี้ยนหรือถูกเสนอให้คนผิดกลุ่มภาษา

**อ้างอิง:** [HTML Standard: the lang attribute](https://html.spec.whatwg.org/multipage/dom.html#the-lang-and-xml:lang-attributes) · [WCAG 2.1: Language of Page (3.1.1)](https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html)


### ไม่มี viewport

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 194-197)**

ตรวจ <meta name="viewport"> tag
- *อ่านจาก:* `p.metas['viewport']`

เงื่อนไขการตรวจ:
- ไม่มี viewport → fail/high
- มี → pass/high

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- Google mobile-first indexing → fail ไม่ pass/warn

**WHAT — ตรวจอะไร**

หน้าไม่ได้ตั้งค่าให้ปรับขนาดตามจอมือถือ (viewport) ทำให้เปิดบนมือถือแล้วหน้าเล็กจิ๋วต้องซูมเอง

**WHY — ทำไมต้องตรวจ**

ลูกค้าส่วนใหญ่เข้าเว็บผ่านมือถือ ถ้าหน้าไม่ปรับให้พอดีจอจะใช้งานยากมากและกดออกเร็ว ทั้ง Google ก็ลงโทษเว็บที่ไม่รองรับมือถือ

**อ้างอิง:** [Google: Mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing) · [MDN: Viewport meta tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)


### viewport ห้ามซูม

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 199-200)**

ตรวจว่า viewport ห้ามผู้ใช้ zoom (maximum-scale=1, user-scalable=no)
- *อ่านจาก:* `p.metas['viewport'] (regex test)`

เงื่อนไขการตรวจ:
- มี maximum-scale=1 หรือ user-scalable=no → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- regex simple ไม่ cover whitespace หลาย variants

**WHAT — ตรวจอะไร**

หน้าตั้งค่าห้ามผู้ใช้ซูมเข้า-ออกบนมือถือ

**WHY — ทำไมต้องตรวจ**

ผู้สูงอายุหรือคนสายตาไม่ดีจะซูมอ่านไม่ได้ เป็นอุปสรรคการเข้าถึงและทำให้เสียลูกค้ากลุ่มนี้

**อ้างอิง:** [WCAG 2.1: Resize Text (1.4.4)](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html) · [MDN: Viewport meta tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)


### ไม่มี favicon

`On-Page` · ความเชื่อมั่น 75% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 202)**

ตรวจ favicon link rel="icon" บนหน้าแรก
- *อ่านจาก:* `home.favicon (จาก link rel=icon parsing)`

เงื่อนไขการตรวจ:
- ไม่มี favicon → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจเฉพาะหน้าแรก (home) ไม่ได้ทั้งเว็บ
- ไม่ตรวจว่าไฟล์ favicon ตอบ 200 → check อื่น favicon-file ทำ

**WHAT — ตรวจอะไร**

Favicon คือไอคอนเล็กๆ ของเว็บที่โชว์บนแท็บเบราว์เซอร์และตอนบุ๊กมาร์ก เว็บนี้ยังไม่มี

**WHY — ทำไมต้องตรวจ**

เป็นรายละเอียดเล็กๆ ที่ทำให้แบรนด์ดูเป็นมืออาชีพและจำง่าย เวลาลูกค้าเปิดหลายแท็บจะหาเว็บเราเจอง่ายขึ้น

**อ้างอิง:** [Google: Define a favicon](https://developers.google.com/search/docs/appearance/favicon-in-search)


### favicon ไฟล์ผิด

`On-Page` · ความเชื่อมั่น 70% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 771)**

ตรวจว่า /favicon.ico ไฟล์ตอบ 200
- *อ่านจาก:* `site.faviconStatus (HTTP status from probe /favicon.ico)`

เงื่อนไขการตรวจ:
- faviconStatus >= 400 → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ site-level flag

**WHAT — ตรวจอะไร**

มีการอ้างถึงไอคอนเว็บ (favicon) แต่ไฟล์จริงหาไม่เจอหรือเปิดไม่ได้

**WHY — ทำไมต้องตรวจ**

ทำให้แท็บเบราว์เซอร์ขึ้นไอคอนว่างหรือแตก ดูไม่เรียบร้อย ควรอัปโหลดไฟล์ให้ถูกต้อง

**อ้างอิง:** [Google: Define a favicon](https://developers.google.com/search/docs/appearance/favicon-in-search)


### ไม่มี doctype

`On-Page` · ความเชื่อมั่น 100% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 638-639)**

ตรวจว่าหน้ามี <\!DOCTYPE html> บรรทัดแรก
- *อ่านจาก:* `p.hasDoctype (boolean from HTML parsing)`

เงื่อนไขการตรวจ:
- hasDoctype = false → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages

**WHAT — ตรวจอะไร**

หน้าเว็บไม่ได้ประกาศชนิดเอกสารมาตรฐาน (DOCTYPE) ที่บรรทัดแรกของโค้ด

**WHY — ทำไมต้องตรวจ**

อาจทำให้เบราว์เซอร์แสดงผลในโหมดเก่าที่เพี้ยน หน้าตาเว็บอาจผิดเพี้ยนในบางเครื่อง

**อ้างอิง:** [HTML Standard: the DOCTYPE](https://html.spec.whatwg.org/multipage/syntax.html#the-doctype)


### charset ไม่ใช่ UTF-8

`On-Page` · ความเชื่อมั่น 95% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 627-634)**

ตรวจ charset ไม่ใช่ UTF-8 (เช่น windows-874, TIS-620)
- *อ่านจาก:* `p.detectedCharset (regex /^utf-?8$/i)`

เงื่อนไขการตรวจ:
- ไม่ใช่ UTF-8 → warn/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- ตรวจ detected charset ไม่ได้ explicit meta charset

**WHAT — ตรวจอะไร**

หน้าไม่ได้ตั้งค่าระบบตัวอักษรเป็นมาตรฐานสากล (UTF-8) ทำให้ภาษาไทยเสี่ยงแสดงเป็นตัวอักษรเพี้ยนมั่วๆ

**WHY — ทำไมต้องตรวจ**

ถ้าภาษาไทยกลายเป็นตัวประหลาดอ่านไม่ออก ลูกค้าจะกดออกทันทีและ Google ก็อ่านเนื้อหาเราไม่รู้เรื่อง

**อ้างอิง:** [WHATWG: Encoding Standard](https://encoding.spec.whatwg.org/) · [HTML Standard: charset declaration](https://html.spec.whatwg.org/multipage/semantics.html#charset)


## Markup/Meta

### meta keywords (ล้าสมัย)

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 720-721)**

ตรวจว่ามี meta keywords (deprecated, ไม่มีผล)
- *อ่านจาก:* `p.metas['keywords'] (string)`

เงื่อนไขการตรวจ:
- มี meta keywords → info/low (ไม่ fail)

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- Google เลิกใช้ตั้งแต่ 2009

**WHAT — ตรวจอะไร**

แท็ก meta keywords คือการใส่คีย์เวิร์ดซ่อนไว้ในโค้ด เป็นเทคนิคยุคเก่าที่ Google เลิกใช้ไปนานแล้ว

**WHY — ทำไมต้องตรวจ**

ไม่ได้ช่วยอันดับเลย แถมบางทีไปบอกใบ้คู่แข่งว่าเราเล็งคำไหนอยู่ ควรเอาออกเพื่อความสะอาดของหน้า

**อ้างอิง:** [Google: We don't use the keywords meta tag](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag)


### แท็กเลิกใช้แล้ว

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 642-643)**

ตรวจใช้ HTML tag เลิกใช้แล้ว (<font>, <center>, <marquee>)
- *อ่านจาก:* `p.deprecatedTags (count from HTML parsing)`

เงื่อนไขการตรวจ:
- >0 deprecated tags → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages

**WHAT — ตรวจอะไร**

หน้าเว็บยังใช้โค้ดรูปแบบเก่าที่เลิกใช้แล้วตามมาตรฐานปัจจุบัน

**WHY — ทำไมต้องตรวจ**

โค้ดเก่าอาจแสดงผลเพี้ยนในเบราว์เซอร์รุ่นใหม่และดูแลยาก ควรปรับให้เป็นมาตรฐานปัจจุบัน

**อ้างอิง:** [HTML Standard: obsolete features](https://html.spec.whatwg.org/multipage/obsolete.html)


## URL

### URL ไม่สะอาด

`On-Page` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 682-685)**

ตรวจ URL ที่มีตัวพิมพ์ใหญ่ใน path หรือ URL ยาว >115 ตัวอักษร
- *อ่านจาก:* `URL.pathname (regex /[A-Z]/), pathname.length`

เงื่อนไขการตรวจ:
- มี uppercase OR >115 chars → warn/low

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold pathname >115 chars
- ตรวจ okPages

**WHAT — ตรวจอะไร**

ที่อยู่หน้าเว็บ (URL) บางหน้าดูรกหรืออ่านไม่รู้เรื่อง เช่นมีตัวอักษรแปลกๆ พารามิเตอร์ยาวเหยียด แทนที่จะเป็นคำที่สื่อความหมาย

**WHY — ทำไมต้องตรวจ**

ที่อยู่ที่สะอาดและอ่านเข้าใจ (เช่น /สินค้า/รองเท้าวิ่ง) ทั้งช่วยอันดับและทำให้ลูกค้ามั่นใจกดลิงก์มากกว่า ที่อยู่ที่ดูมั่วๆ ทำให้คนลังเลที่จะคลิก

**อ้างอิง:** [Google: URL structure best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure) · [RFC 3986: URI Generic Syntax](https://datatracker.ietf.org/doc/html/rfc3986)


# Indexing

## Canonical

### ไม่มี canonical

`Indexing` · ความเชื่อมั่น 100% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 330-352)**

ตรวจว่าหน้าที่ไม่มี canonical (risk ขึ้นกับว่ามี query param/dup title)
- *อ่านจาก:* `p.canonical (link rel=canonical), okPages list, hasQueryParam heuristic, hasDupTitle`

เงื่อนไขการตรวจ:
- ไม่มี canonical + (query param OR dup title) → fail/high
- ไม่มี canonical + (ไม่มี query param AND ไม่มี dup title) → warn/low

ข้อสังเกต / ควรเพิ่ม:
- evidence-based: severity ขึ้นกับความเสี่ยง duplicate
- hasQueryParam = ตรวจ okPages.some(p => URL.search) OR sitemap URLs มี ?
- hasDupTitle = ตรวจ titleCount > 1

**WHAT — ตรวจอะไร**

Canonical tag คือป้ายเล็กๆ ในโค้ดที่บอก Google ว่า "หน้าตัวจริงคือหน้านี้นะ" เพราะเว็บเดียวกันมักเข้าถึงได้หลาย URL (เช่น มี / , /home , ลิงก์ที่ต่อท้ายด้วย ?param ต่างๆ) ทั้งที่จริงเป็นหน้าเดียวกัน ถ้าไม่มีป้ายนี้ Google จะนับเป็นหลายหน้าแยกกัน

**WHY — ทำไมต้องตรวจ**

เมื่อ Google เห็นหน้าเดียวกันในหลายที่อยู่โดยไม่มีป้ายชี้ตัวจริง มันจะมองว่าเรา "ก๊อปเนื้อหาตัวเอง" คะแนนของหน้าถูกหารกระจาย ทำให้อันดับตก และอาจเลือกแสดง URL ที่ดูไม่สวยให้ลูกค้าเห็น

**HOW — ตรวจอย่างไร**

1. Final URL
2. อ่าน canonical
3. ดูเสี่ยง duplicate (query param/title ซ้ำ)

**DECISION RULE — เกณฑ์ตัดสิน**

- ไม่มี + เสี่ยง dup จริง → fail/high  →  🔴 High
- เว็บสะอาด → warn/low  →  🟡 Low/Warn

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL`

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [RFC 6596: The Canonical Link Relation](https://datatracker.ietf.org/doc/html/rfc6596)


### canonical ซ้ำ

`Indexing` · ความเชื่อมั่น 90% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 650-651)**

ตรวจว่ามี canonical หลายอันในหน้าเดียว
- *อ่านจาก:* `p.canonicalCount (integer)`

เงื่อนไขการตรวจ:
- >1 canonical → fail/high

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages

**WHAT — ตรวจอะไร**

หน้าเดียวกันใส่ป้ายชี้หน้าตัวจริง (Canonical) ไว้หลายอันและขัดแย้งกัน เหมือนป้ายบอกทางสองป้ายชี้คนละทาง

**WHY — ทำไมต้องตรวจ**

Google สับสนว่าจะเชื่อป้ายไหน สุดท้ายอาจเลือกหน้าผิดมาแสดงหรือไม่เก็บหน้าเราเข้าระบบเลย

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### canonical relative

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 652-653)**

ตรวจ canonical ว่าเป็น relative URL (ควรเป็น absolute)
- *อ่านจาก:* `p.canonical (regex test /^https?:\/\/)`

เงื่อนไขการตรวจ:
- canonical relative (ไม่ขึ้นต้น http://) → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages

**WHAT — ตรวจอะไร**

ป้ายชี้หน้าตัวจริง (Canonical) เขียนที่อยู่แบบไม่เต็ม (ไม่ได้ขึ้นต้นด้วย https://...) ซึ่งเสี่ยงตีความผิด

**WHY — ทำไมต้องตรวจ**

ที่อยู่ที่ไม่สมบูรณ์อาจทำให้ Google ชี้ไปผิดหน้า ส่งผลให้หน้าที่ถูกต้องไม่ถูกจัดอันดับ

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [RFC 6596: The Canonical Link Relation](https://datatracker.ietf.org/doc/html/rfc6596)


## Robots

### ไม่มี robots.txt

`Indexing` · ความเชื่อมั่น 100% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 220-221)**

ตรวจว่ามี robots.txt
- *อ่านจาก:* `site.robotsTxt (null/string), site.robotsStatus (HTTP status)`

เงื่อนไขการตรวจ:
- null (fetch ไม่ได้/404) → warn/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ site-level flag
- ไม่ validate syntax robots.txt ที่นี่ — ที่อื่นทำ

**WHAT — ตรวจอะไร**

ไฟล์ robots.txt คือคู่มือต้อนรับสำหรับ Google ที่วางไว้หน้าเว็บ บอกว่าหน้าไหนเข้าได้ หน้าไหนไม่ต้องเข้า เว็บนี้ยังไม่มีไฟล์นี้

**WHY — ทำไมต้องตรวจ**

ไม่ใช่เรื่องร้ายแรงมาก แต่การมีไฟล์นี้ช่วยให้ Google เก็บข้อมูลเว็บได้อย่างมีระเบียบและเร็วขึ้น

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### robots ไม่ชี้ sitemap

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 253-255)**

ตรวจว่า robots.txt อ้าง sitemap URL
- *อ่านจาก:* `site.robots.sitemaps (array of sitemap URLs)`

เงื่อนไขการตรวจ:
- มี sitemaps → pass/low
- ไม่มี → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ parsed robots.txt ไม่ raw text

**WHAT — ตรวจอะไร**

ในไฟล์คู่มือต้อนรับ (robots.txt) ควรมีบรรทัดบอกที่อยู่ของ "แผนผังเว็บ" (sitemap) ให้ Google แต่ตอนนี้ยังไม่ได้ใส่

**WHY — ทำไมต้องตรวจ**

การชี้ทางไปแผนผังเว็บช่วยให้ Google เจอทุกหน้าได้ครบและเร็วขึ้น โดยเฉพาะหน้าใหม่ๆ

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html) · [Google: Sitemaps overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)


### robots บล็อกทั้งเว็บ

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 223-227)**

ตรวจว่า robots.txt มี Disallow: / สำหรับทั้งเว็บ
- *อ่านจาก:* `site.robots.groups (parsed robots.txt), r.groups.some(g => g.agents.includes('*') && g.rules.some(x => x.path === '/'))`

เงื่อนไขการตรวจ:
- มี Disallow: / ใน User-agent: * → fail/high
- ไม่มี → pass/high

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ parsed robots.txt object ไม่ raw text
- ไม่ handle comment หรือ invalid syntax (อาจ parse ผิด)

**WHAT — ตรวจอะไร**

ไฟล์คู่มือต้อนรับ Google (robots.txt) ตั้งค่าเป็น "ห้ามเข้าทุกหน้า" — เท่ากับปิดประตูไม่ให้ Google เข้ามาดูเว็บเลย

**WHY — ทำไมต้องตรวจ**

นี่คือปัญหาร้ายแรงที่สุดอย่างหนึ่ง — ถ้าปิดประตูทั้งหมด เว็บจะค่อยๆ หายไปจาก Google ทั้งเว็บ ไม่มีใครค้นเจอเลย

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### robots บล็อกบางส่วน

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 231-252)**

ตรวจว่า robots.txt บล็อก Googlebot/AI crawler จาก section เนื้อหา
- *อ่านจาก:* `site.robots (parsed), candidateSections (regex match), robotsAllows(r, bot, path)`

เงื่อนไขการตรวจ:
- Googlebot บล็อก section สำคัญ → fail/high
- AI crawler บล็อก → warn/med
- ไม่บล็อก → pass/low

ข้อสังเกต / ควรเพิ่ม:
- ใช้ regex pattern สำหรับ detect section (/th/, /en/, /blog/, /product/ ฯลฯ)
- ตรวจ AI_SECTION_BOTS = GPTBot/ClaudeBot/PerplexityBot/OAI-SearchBot
- ใช้ robotsAllows helper ที่ implement most-specific match rule

**WHAT — ตรวจอะไร**

ไฟล์คู่มือต้อนรับ Google (robots.txt) สั่งห้าม Google เข้าบางส่วนของเว็บ

**WHY — ทำไมต้องตรวจ**

ถ้าส่วนที่ถูกห้ามคือหน้าสำคัญ (เช่น หน้าสินค้า/บริการ) หน้าเหล่านั้นจะไม่ขึ้น Google เลย ควรตรวจว่าห้ามถูกที่หรือเปล่า

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### meta robots ผิด

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 306-328)**

ตรวจ meta robots directive ที่ไม่ valid หรือ deprecated
- *อ่านจาก:* `p.metas['robots'].split(',').map(t => t.split(':')[0].trim())`

เงื่อนไขการตรวจ:
- มี invalid/deprecated directive → warn/med

ข้อสังเกต / ควรเพิ่ม:
- VALID_ROBOTS set มี index/noindex/follow/nofollow/none/all/etc
- DEPRECATED_ROBOTS: noodp, noydir
- ตรวจ token โดยเอาส่วน :value ออก

**WHAT — ตรวจอะไร**

คำสั่งควบคุม Google ที่ฝังในหน้าเขียนผิดรูปแบบหรือสะกดผิด (เช่นพิมพ์ผิดเป็นคำที่ Google ไม่รู้จัก)

**WHY — ทำไมต้องตรวจ**

คำสั่งที่เขียนผิดอาจไม่ทำงาน หรือทำงานผิดจากที่ตั้งใจ เสี่ยงทำให้หน้าหลุดจากระบบ Google โดยไม่ตั้งใจ

**อ้างอิง:** [Google: robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)


### ติด noindex

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 270-304)**

ตรวจว่าหน้าที่ดูเหมือน content มี noindex โดยไม่ตั้งใจ
- *อ่านจาก:* `p.metas['robots'], p.headers['x-robots-tag'] (regex /noindex/i), URL path (heuristic classify utility vs content)`

เงื่อนไขการตรวจ:
- หน้า content ที่ดูเหมือนไม่ตั้งใจ → warn/high หรือ fail/high (ถ้า homepage)
- หน้า utility ที่ตั้งใจ → pass/low

ข้อสังเกต / ควรเพิ่ม:
- classify intent จาก URL path pattern UTILITY_RE
- confidence 65-80% เพราะเดาเจตนาจาก path
- ไม่ตรวจ Link header หรือ CSP directive

**WHAT — ตรวจอะไร**

หน้านี้ติดคำสั่ง "ห้าม Google เก็บเข้าระบบ" (noindex) อยู่ เท่ากับสั่ง Google ว่า "อย่าเอาหน้านี้ไปแสดงในผลค้นหา"

**WHY — ทำไมต้องตรวจ**

ถ้าเป็นหน้าสำคัญที่อยากให้คนค้นเจอ การติดคำสั่งนี้คือการทำให้หน้าหายไปจาก Google ทั้งหน้า เสียทราฟฟิกทั้งหมดของหน้านั้น

**อ้างอิง:** [Google: Block indexing (noindex)](https://developers.google.com/search/docs/crawling-indexing/block-indexing) · [Google: robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)


## Sitemap

### ไม่มี sitemap

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 258-260)**

ตรวจว่ามี XML sitemap และจำนวน URLs
- *อ่านจาก:* `site.sitemapUrls.length, site.sitemaps (array of sitemap.xml paths)`

เงื่อนไขการตรวจ:
- มี URLs → pass/med
- ไม่มี → fail/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ site-level data จาก fetch sitemap.xml
- แสดงจาก path เช่น /sitemap.xml

**WHAT — ตรวจอะไร**

XML Sitemap คือ "แผนผังเว็บ" หรือสารบัญที่ลิสต์ทุกหน้าของเว็บไว้ให้ Google เปิดอ่านทีเดียวครบ เว็บนี้ยังไม่มีไฟล์นี้

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มีสารบัญ Google ต้องไล่คลำหาหน้าเองทีละลิงก์ ทำให้หน้าใหม่ๆ ถูกเก็บเข้าระบบช้ามาก กว่าจะขึ้น Google อาจใช้เวลาหลายสัปดาห์

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html) · [Google: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)


### sitemap ไม่ครอบคลุม

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 262-268)**

ตรวจว่า sitemap.xml ครอบคลุมหน้าทั้งหมด (>30% ไม่อยู่ = fail)
- *อ่านจาก:* `site.sitemapUrls (array), okPages (crawled pages), normalize(url) helper`

เงื่อนไขการตรวจ:
- >30% หน้า crawled ไม่อยู่ sitemap → warn/low

ข้อสังเกต / ควรเพิ่ม:
- normalize URL ลบ www + trailing slash + query ก่อนเทียบ
- ตัด 30% threshold hardcoded
- ไม่ handle gzip/compressed sitemap

**WHAT — ตรวจอะไร**

แผนผังเว็บ (sitemap) มีอยู่ แต่ลิสต์หน้าไม่ครบ — บางหน้าที่มีจริงไม่ได้ถูกใส่ในสารบัญ

**WHY — ทำไมต้องตรวจ**

หน้าที่ไม่อยู่ในสารบัญมีโอกาสถูก Google มองข้าม ทำให้หน้านั้นไม่ขึ้นผลค้นหา

**อ้างอิง:** [Google: Sitemaps overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)


### sitemap ไม่มี lastmod

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 774-775)**

ตรวจว่า sitemap.xml มี <lastmod> element
- *อ่านจาก:* `site.sitemapHasLastmod (boolean from sitemap parsing)`

เงื่อนไขการตรวจ:
- sitemapUrls.length > 0 + \!sitemapHasLastmod → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ site-level flag

**WHAT — ตรวจอะไร**

แผนผังเว็บ (sitemap) ไม่ได้ระบุวันที่อัปเดตล่าสุดของแต่ละหน้า

**WHY — ทำไมต้องตรวจ**

การบอกวันที่อัปเดตช่วยให้ Google รู้ว่าหน้าไหนมีของใหม่ ควรกลับมาดูซ้ำ ทำให้เนื้อหาใหม่ขึ้น Google เร็วขึ้น

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html)


## Hreflang

### hreflang ผิด/ไม่มี

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 373-394)**

ตรวจ hreflang alternate tags และ x-default (multi-language sites)
- *อ่านจาก:* `p.hreflang (array of {lang, href}), heuristic detect multi-lang (path /en/, /th/ OR query ?lang=)`

เงื่อนไขการตรวจ:
- มี hreflang แต่ไม่มี x-default → warn/low
- มี hreflang + x-default → pass/low
- ตรวจสัญญาณ multi-lang แต่ไม่มี hreflang → warn/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- heuristic detect multi-lang: regex สำหรับ /en/ /th/ ฯลฯ
- ไม่ validate hreflang href ว่าตรวจสัตย์

**WHAT — ตรวจอะไร**

hreflang คือป้ายบอก Google ว่าหน้าไหนเป็นเวอร์ชันภาษาไทย หน้าไหนเป็นภาษาอังกฤษ สำหรับเว็บที่มีหลายภาษา

**WHY — ทำไมต้องตรวจ**

ถ้าตั้งค่าไม่ถูก Google อาจเอาหน้าภาษาอังกฤษไปแสดงให้คนไทย หรือสลับกัน ทำให้ลูกค้าเจอหน้าผิดภาษาแล้วกดออก

**อ้างอิง:** [Google: Localized versions (hreflang)](https://developers.google.com/search/docs/specialty/international/localized-versions)


## Redirects

### redirect ซ้อน

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 354-355)**

ตรวจ redirect chain ที่ยาว >1 hop
- *อ่านจาก:* `p.redirectChain (array from crawl.js)`

เงื่อนไขการตรวจ:
- redirect chain > 1 hop → warn/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- ไม่ validate ว่า final target ตอบ 200

**WHAT — ตรวจอะไร**

การเด้งหน้าต่อกันหลายทอด เช่น หน้า A เด้งไป B, B เด้งไป C กว่าจะถึงปลายทางจริง เหมือนโทรหาเบอร์หนึ่งแล้วถูกโอนสายต่อ 3-4 ครั้ง

**WHY — ทำไมต้องตรวจ**

ทุกการเด้งทำให้หน้าโหลดช้าลงและคะแนนรั่วไหลทีละนิด ลูกค้าบนมือถือที่เน็ตช้าอาจกดออกก่อนหน้าจะโหลดเสร็จ

**อ้างอิง:** [Google: Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects) · [RFC 9110: Redirection 3xx](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4)


### trailing slash ไม่นิ่ง

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 688-697)**

ตรวจ URL ซ้ำจาก trailing slash (เช่น /about vs /about/)
- *อ่านจาก:* `URL.pathname (build alt pathname มี/ไม่มี /)`

เงื่อนไขการตรวจ:
- มี duplicate trailing-slash → warn/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- ตรวจเฉพาะ path ไม่ include query

**WHAT — ตรวจอะไร**

ที่อยู่หน้าเว็บมีทั้งแบบมีและไม่มีเครื่องหมาย / ต่อท้าย ชี้ไปหน้าเดียวกัน เช่น /about กับ /about/

**WHY — ทำไมต้องตรวจ**

Google อาจนับเป็นสองหน้าซ้ำกัน ควรเลือกใช้แบบเดียวให้สม่ำเสมอเพื่อไม่ให้คะแนนกระจาย

**อ้างอิง:** [Google: URL structure best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure) · [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### www/non-www ซ้ำ

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 746-768)**

ตรวจว่า www/http/https variants รวมร่างถูกต้อง (301 หรือ canonical)
- *อ่านจาก:* `site.variants (array: {variant, status, finalOrigin, error}), okPages.filter(p => p.canonical) (check if well-canonical)`

เงื่อนไขการตรวจ:
- variants ตอบ 200 แยกกัน + wellCanon → warn/med
- variants ตอบ 200 แยกกัน + \!wellCanon → fail/high
- variants dead (5xx/DNS/CERT) → warn/med
- ทั้งหมด redirect ถูก → pass/high

ข้อสังเกต / ควรเพิ่ม:
- wellCanon = okPages.length && okPages.filter(p => p.canonical).length >= okPages.length * 0.8

**WHAT — ตรวจอะไร**

เว็บเปิดได้หลายแบบที่อยู่ เช่นมีทั้งแบบมี www และไม่มี www หรือทั้ง http และ https ทั้งที่ควรเหลือแบบเดียว

**WHY — ทำไมต้องตรวจ**

Google อาจมองว่าเป็นหลายเว็บแยกกันที่เนื้อหาซ้ำ ทำให้คะแนนกระจาย ควรรวมให้เหลือที่อยู่หลักแบบเดียว

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### meta refresh redirect

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 646-647)**

ตรวจใช้ <meta http-equiv=refresh> redirect
- *อ่านจาก:* `p.metaRefresh (boolean)`

เงื่อนไขการตรวจ:
- metaRefresh = true → warn/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages

**WHAT — ตรวจอะไร**

หน้าใช้วิธีเด้งไปหน้าอื่นแบบเก่า (meta refresh) เช่นเปิดมาแล้วนับถอยหลังเด้งไปอีกหน้า

**WHY — ทำไมต้องตรวจ**

เป็นวิธีล้าสมัยที่ Google ไม่แนะนำ ทำให้การส่งต่อคะแนนระหว่างหน้าไม่สมบูรณ์ ควรเปลี่ยนเป็นการเด้งหน้าแบบมาตรฐาน

**อ้างอิง:** [Google: Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects) · [HTML Standard: meta http-equiv refresh](https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-refresh)


## Crawlability

### ถูกบล็อก crawl

`Indexing` · ความเชื่อมั่น 90% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 361-363)**

ตรวจหน้าที่ตอบ 4xx/5xx (ไม่ใช่ 404/410) — อาจชั่วคราว
- *อ่านจาก:* `site.pages, p.status (400-599 excluding 404/410)`

เงื่อนไขการตรวจ:
- มี error status → info/med

ข้อสังเกต / ควรเพิ่ม:
- 429 rate-limit, 403 blocked, 5xx = ชั่วคราว ไม่กระทบคะแนน

**อ้างอิง:** [Google: Overview of Google crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### soft 404

`Indexing` · ความเชื่อมั่น 90% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 365-366)**

ตรวจว่า 404 pages ตอบสถานะ HTTP ผิด (soft 404)
- *อ่านจาก:* `site.notFoundHandling (object: {ok, status})`

เงื่อนไขการตรวจ:
- notFoundHandling.ok = false → warn/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ site-level flag จากการ detect 404 handling heuristic

**WHAT — ตรวจอะไร**

หน้าที่ไม่มีอยู่จริง ควรตอบกลับว่า "ไม่พบหน้า (404)" แต่กลับตอบว่า "ปกติดี (200)" หรือเด้งไปหน้าแรกแทน เหมือนร้านที่ปิดไปแล้วแต่ป้ายยังเขียนว่าเปิด

**WHY — ทำไมต้องตรวจ**

Google จะเก็บหน้าขยะเหล่านี้เข้าระบบ ทำให้คุณภาพเว็บโดยรวมในสายตา Google ลดลง และเปลืองโควต้าที่ Google ใช้เก็บหน้าจริงที่สำคัญ

**อ้างอิง:** [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### หน้า error

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 360-362)**

ตรวจหน้าที่ตอบ 404/410 (หายจริง)
- *อ่านจาก:* `site.pages (all pages), p.status (HTTP status)`

เงื่อนไขการตรวจ:
- มี 404/410 → fail/high

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ site.pages ไม่ filter okPages

**WHAT — ตรวจอะไร**

พบหน้าที่เปิดแล้วเจอข้อผิดพลาด (error) ตอบกลับเป็นรหัสฝั่งเซิร์ฟเวอร์ผิดพลาด

**WHY — ทำไมต้องตรวจ**

หน้าที่พังทำให้ทั้งลูกค้าและ Google เจอทางตัน เสียประสบการณ์และเสียโอกาสขาย ควรรีบแก้ให้กลับมาใช้งานได้

**อ้างอิง:** [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110) · [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### เข้าหน้าเว็บไม่ได้

`Indexing` · ความเชื่อมั่น 100% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 77-81)**

ตรวจว่าหน้า HTTP 200 มีจำนวนเพียงพอสำหรับหล่อคะแนน
- *อ่านจาก:* `site.pages.filter(p => p.status === 200), site.fetchErrors.length`

เงื่อนไขการตรวจ:
- ไม่มีหน้า 200 เลย → fail/high

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ raw count เฉพาะเท่านั้น ไม่ได้หักเด้ง noindex/canonical-away หน้าก่อน

**อ้างอิง:** [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110) · [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


## Duplicate Content

### หน้าซ้ำใกล้เคียง

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 724-734)**

ตรวจเนื้อหาเกือบซ้ำกัน (Jaccard similarity >85%)
- *อ่านจาก:* `p.textSample (เฉพาะ >100 words, \!emptyRoot), split เป็น word set, Jaccard = intersection/(A+B-intersection)`

เงื่อนไขการตรวจ:
- Jaccard >0.85 → warn/med

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold 0.85 Jaccard
- filter เฉพาะ word length >2
- sample ตัว okPages.slice(0, 60)

**WHAT — ตรวจอะไร**

มีหลายหน้าที่เนื้อหาคล้ายกันมากจนเกือบเหมือนกัน เหมือนถ่ายเอกสารหน้าเดิมแล้วเปลี่ยนแค่หัวข้อนิดหน่อย

**WHY — ทำไมต้องตรวจ**

Google ไม่ชอบเนื้อหาซ้ำ และจะเลือกแสดงแค่หน้าเดียว หน้าที่เหลือถูกมองข้าม ทำให้เราเสียพื้นที่บนหน้าค้นหาไปเปล่าๆ

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL` · `Canonical`

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [Moz: Duplicate content](https://moz.com/learn/seo/duplicate-content)


## Internal Links

### ลิงก์เสีย (hard)

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 461-465)**

ตรวจลิงก์ที่ชี้ไปหน้า 404/410 (broken)
- *อ่านจาก:* `site.brokenLinks (array of {to, status, from})`

เงื่อนไขการตรวจ:
- มี 404/410 links → fail/high
- ไม่มี → pass/high

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ site.brokenLinks ทั้งหมด
- isGone = 404 OR 410

**WHAT — ตรวจอะไร**

ลิงก์ภายในเว็บที่กดแล้วพาไปหน้าที่พังหรือไม่มีอยู่จริง (เจอหน้า error) เหมือนป้ายบอกทางในห้างที่ชี้ไปร้านที่ปิดไปแล้ว

**WHY — ทำไมต้องตรวจ**

ลูกค้าที่กดแล้วเจอหน้าพังจะรู้สึกหงุดหงิดและอาจเลิกเที่ยวชมเว็บทันที ทั้งยังทำให้ Google มองว่าเว็บดูแลไม่ดี กระทบความน่าเชื่อถือโดยรวม

**อ้างอิง:** [RFC 9110: 404 Not Found](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.5) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### ลิงก์เสีย (soft)

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 462-466)**

ตรวจลิงก์ที่ตรวจไม่ติด (429/403/5xx) — อาจชั่วคราว
- *อ่านจาก:* `site.brokenLinks.filter(b => b.status >= 400 && \!isGone(b.status))`

เงื่อนไขการตรวจ:
- มี soft error → info/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ site.brokenLinks
- ไม่กระทบคะแนน

**อ้างอิง:** [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### หน้ากำพร้า

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 737-743)**

ตรวจหน้า orphan (ไม่มีลิงก์ภายในชี้เข้า แค่ sitemap)
- *อ่านจาก:* `inlinks map (build จาก link href normalize), p.url (URL canonicalization)`

เงื่อนไขการตรวจ:
- orphan pages → warn/med

ข้อสังเกต / ควรเพิ่ม:
- orphan = ตรวจ okPages, ไม่ใช่ startUrl, ไม่มี inlink

**WHAT — ตรวจอะไร**

หน้ากำพร้า คือหน้าที่มีอยู่จริงแต่ไม่มีลิงก์จากหน้าอื่นในเว็บชี้มาหาเลย เหมือนห้องลับที่ไม่มีประตูเข้า

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มีลิงก์ชี้มา ทั้งลูกค้าและ Google แทบจะหาหน้านี้ไม่เจอ เท่ากับทำหน้าไว้แต่ไม่มีใครได้ใช้

**อ้างอิง:** [Ahrefs: Orphan pages](https://ahrefs.com/blog/orphan-pages/) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### internal link น้อย

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 477-478)**

ตรวจว่าหน้ามี internal link น้อยกว่า 3
- *อ่านจาก:* `p.links.filter(l => l.href.startsWith('/') OR includes origin hostname)`

เงื่อนไขการตรวจ:
- <3 internal links → warn/med

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold = 3
- ตรวจ okPages

**WHAT — ตรวจอะไร**

หน้าต่างๆ ในเว็บเชื่อมโยงถึงกันด้วยลิงก์ภายในน้อยเกินไป เหมือนห้างที่แต่ละร้านไม่มีป้ายบอกทางไปร้านอื่น

**WHY — ทำไมต้องตรวจ**

ลิงก์ภายในช่วยทั้งลูกค้าเดินดูเว็บต่อ (เพิ่มโอกาสขาย) และช่วย Google ไหลคะแนนไปยังหน้าสำคัญ ยิ่งเชื่อมดีหน้าสำคัญยิ่งติดอันดับง่าย

**อ้างอิง:** [Ahrefs: Internal links for SEO](https://ahrefs.com/blog/internal-links-for-seo/) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### anchor ว่าง

`Indexing` · ความเชื่อมั่น 85% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 468-470)**

ตรวจลิงก์ที่ไม่มี anchor text
- *อ่านจาก:* `p.links.filter(l => \!l.text && \!/img/i.test(l.href))`

เงื่อนไขการตรวจ:
- มี empty anchor → warn/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- exclude links ที่ href มี 'img'

**WHAT — ตรวจอะไร**

มีลิงก์ที่กดได้แต่ไม่มีข้อความบอกว่าลิงก์ไปไหน (ลิงก์เปล่า เช่นเป็นแค่ไอคอนหรือช่องว่าง)

**WHY — ทำไมต้องตรวจ**

ทั้ง Google และผู้พิการที่ใช้โปรแกรมอ่านหน้าจอจะไม่รู้ว่าลิงก์นี้พาไปไหน เสียทั้งคะแนนและการเข้าถึง

**อ้างอิง:** [WCAG 2.1: Link Purpose (2.4.4)](https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### anchor กว้างไป

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 472-475)**

ตรวจลิงก์ที่มี anchor text generic (คลิกที่นี่, read more)
- *อ่านจาก:* `p.links.filter(l => genericWords.test(l.text))`

เงื่อนไขการตรวจ:
- >2 generic anchors/หน้า → warn/low

ข้อสังเกต / ควรเพิ่ม:
- genericWords regex pattern ของ common generic text
- hardcoded threshold = 2
- ตรวจ okPages

**WHAT — ตรวจอะไร**

ลิงก์ที่ใช้คำกำกวมอย่าง "คลิกที่นี่" หรือ "อ่านต่อ" ซ้ำๆ แทนที่จะบอกว่าลิงก์ไปเรื่องอะไร

**WHY — ทำไมต้องตรวจ**

คำลิงก์ที่สื่อความหมาย (เช่น "ดูรองเท้าวิ่งรุ่นใหม่") ช่วยให้ Google เข้าใจหน้าปลายทางและช่วยอันดับ ส่วน "คลิกที่นี่" ไม่ให้ข้อมูลอะไรเลย

**อ้างอิง:** [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) · [Ahrefs: Anchor text](https://ahrefs.com/blog/anchor-text/)


# Schema

## JSON-LD

### ไม่มี JSON-LD

`Schema` · ความเชื่อมั่น 100% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 399-402)**

ตรวจ JSON-LD structured data ใน HTML ดิบ
- *อ่านจาก:* `p.jsonLd (array of {ok, data} from <script type="application/ld+json">)`

เงื่อนไขการตรวจ:
- ไม่มี JSON-LD → fail/high
- มี แต่ <90% หน้า → warn/high
- มี >=90% หน้า → pass/high

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- ไม่ detect JSON-LD ที่สร้างจาก JS (render time) — เฉพาะ raw HTML

**WHAT — ตรวจอะไร**

Structured Data (JSON-LD) คือข้อมูลเสริมที่ฝังในหน้าแบบที่ "เครื่องอ่านได้" บอก Google ตรงๆ ว่าหน้านี้คือสินค้าอะไร ราคาเท่าไร ร้านชื่ออะไร มีรีวิวกี่ดาว เหมือนติดป้ายฉลากสินค้าที่เครื่องสแกนอ่านได้ทันที เว็บนี้ยังไม่มีเลยสักหน้า

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มีฉลากนี้ จะเสีย 2 อย่างใหญ่: (1) เสีย "ผลการค้นหาแบบพิเศษ" บน Google เช่น ดาวรีวิว ราคา รูปสินค้า ที่ทำให้ผลของเราเด่นกว่าคู่แข่งและคนกดเยอะกว่า (2) เมื่อมีคนถาม ChatGPT หรือ AI ต่างๆ เกี่ยวกับธุรกิจแบบเรา AI จะไม่มีข้อมูลที่เป็นระเบียบให้ดึงไปตอบ เลยไปอ้างอิงเว็บคู่แข่งที่ติดฉลากไว้แทน

**อ้างอิง:** [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) · [Schema.org](https://schema.org/) · [W3C: JSON-LD 1.1](https://www.w3.org/TR/json-ld11/)


### JSON-LD ผิดรูปแบบ

`Schema` · ความเชื่อมั่น 100% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 404-405)**

ตรวจ JSON-LD ที่ parse ไม่ได้ (syntax error)
- *อ่านจาก:* `p.jsonLd.filter(j => \!j.ok)`

เงื่อนไขการตรวจ:
- มี JSON-LD ที่ parse fail → fail/high

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- j.ok = false = parse fail

**WHAT — ตรวจอะไร**

มีการติดฉลากข้อมูลให้เครื่องอ่าน (Structured Data) แล้ว แต่เขียนผิดรูปแบบ ทำให้ Google อ่านไม่ได้

**WHY — ทำไมต้องตรวจ**

ฉลากที่เสียเท่ากับไม่ได้ติด — เสียโอกาสได้ผลค้นหาแบบพิเศษ (ดาว/ราคา/รูป) และอาจโดน Google เตือนว่าเว็บมีข้อผิดพลาด

**อ้างอิง:** [W3C: JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) · [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)


## Structured Data

### Organization schema

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 407-415)**

ตรวจว่ามี Organization/LocalBusiness/Corporation schema
- *อ่านจาก:* `p.jsonLd (parsed), ldTypes = set of @type values`

เงื่อนไขการตรวจ:
- มี Organization/LocalBusiness/Corporation → pass/med
- ไม่มี → fail/med

ข้อสังเกต / ควรเพิ่ม:
- collect @type จาก @graph recursively
- ตรวจ okPages

**WHAT — ตรวจอะไร**

Organization schema คือฉลากข้อมูลที่บอก Google และ AI ว่า "บริษัทเราคือใคร" ชื่อเต็ม โลโก้ ที่อยู่ ช่องทางติดต่อ โซเชียล เว็บนี้ยังไม่ได้ติดฉลากนี้

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มี Google และ AI จะไม่รู้จักตัวตนแบรนด์เรา ทำให้พลาดกล่องข้อมูลบริษัทด้านขวาของหน้า Google (Knowledge Panel) และเมื่อคนถาม AI ว่า "บริษัทนี้คือใคร" AI จะไม่มีข้อมูลยืนยันตัวตนของเรา

**อ้างอิง:** [Google: Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization) · [Schema.org: Organization](https://schema.org/Organization)


### Breadcrumb schema

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 416-418)**

ตรวจว่ามี BreadcrumbList schema
- *อ่านจาก:* `ldTypes (collected from jsonLd)`

เงื่อนไขการตรวจ:
- มี BreadcrumbList → pass/low
- ไม่มี → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages

**WHAT — ตรวจอะไร**

Breadcrumb schema คือฉลากบอกเส้นทางหน้า เช่น หน้าแรก › สินค้า › รองเท้า ให้ Google แสดงเส้นทางนี้ในผลค้นหา

**WHY — ทำไมต้องตรวจ**

ช่วยให้ผลค้นหาของเราดูเป็นระเบียบและน่ากดขึ้น และช่วยลูกค้าเข้าใจว่าหน้านี้อยู่ตรงไหนของเว็บ

**อ้างอิง:** [Google: Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) · [Schema.org: BreadcrumbList](https://schema.org/BreadcrumbList)


### schema ไม่ครบ field

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 421-446)**

ตรวจว่า structured data มี required/recommended property ครบตามเกณฑ์ Google
- *อ่านจาก:* `p.jsonLd (parsed), validateSchemaNodes(dataArr) function`

เงื่อนไขการตรวจ:
- มี error (required field ขาด) → fail/high
- มี warning (recommended field ขาด) → warn/low
- ครบ required → pass/high

ข้อสังเกต / ควรเพิ่ม:
- ใช้ validateSchemaNodes() จาก schema-validate.js
- ตรวจ okPages

**WHAT — ตรวจอะไร**

มีการติดฉลากข้อมูลให้เครื่องอ่าน (Structured Data) แล้ว แต่ใส่ข้อมูลไม่ครบตามที่ Google ต้องการ เช่น ติดฉลากสินค้าแต่ลืมใส่ราคา

**WHY — ทำไมต้องตรวจ**

ฉลากที่ข้อมูลไม่ครบ Google อาจไม่ยอมแสดงผลแบบพิเศษให้ เท่ากับลงแรงติดฉลากแล้วแต่ยังไม่ได้ประโยชน์เต็มที่

**อ้างอิง:** [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) · [Schema.org](https://schema.org/)


## Social Cards

### Open Graph

`Schema` · ความเชื่อมั่น 80% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 449-452)**

ตรวจ Open Graph tags (og:title, og:image)
- *อ่านจาก:* `p.metas['og:title'], p.metas['og:image']`

เงื่อนไขการตรวจ:
- ไม่มี og:title หรือ og:image → warn/med (ถ้า >0 หน้า) หรือ fail/med (ถ้า 100%)

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- ไม่ validate og:image ว่า URL valid หรือ size

**WHAT — ตรวจอะไร**

Open Graph คือข้อมูลที่กำหนดว่า "เวลาแชร์ลิงก์เว็บนี้ลง Facebook, LINE, X จะขึ้นรูปและข้อความอะไร" เว็บนี้ใส่ไม่ครบ ทำให้แชร์แล้วไม่มีรูปหรือหัวข้อ

**WHY — ทำไมต้องตรวจ**

เวลาลูกค้าหรือเพจแชร์ลิงก์เรา ถ้าขึ้นมาเป็นลิงก์เปล่าๆ ไม่มีรูป ไม่มีหัวข้อ จะดูไม่น่าเชื่อถือและแทบไม่มีใครกด เสียโอกาสกระจายผ่านโซเชียลฟรีๆ

**อ้างอิง:** [The Open Graph protocol](https://ogp.me/)


### og:image เป็น relative

`Schema` · ความเชื่อมั่น 80% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 778-779)**

ตรวจ og:image ว่าเป็น relative URL (ควรเป็น absolute)
- *อ่านจาก:* `p.metas['og:image'] (regex test /^https?:\/\/)`

เงื่อนไขการตรวจ:
- og:image relative → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages

**WHAT — ตรวจอะไร**

รูปที่จะโชว์ตอนแชร์ลิงก์ (Open Graph image) ใส่ที่อยู่แบบไม่เต็ม ทำให้บางแพลตฟอร์มหารูปไม่เจอ

**WHY — ทำไมต้องตรวจ**

แชร์ไปแล้วรูปอาจไม่ขึ้น ทำให้โพสต์ดูโล่งและน่ากดน้อยลง ควรใส่ที่อยู่รูปแบบเต็ม

**อ้างอิง:** [The Open Graph protocol](https://ogp.me/)


### Twitter Card

`Schema` · ความเชื่อมั่น 70% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 454-455)**

ตรวจ Twitter Card meta tag
- *อ่านจาก:* `p.metas['twitter:card']`

เงื่อนไขการตรวจ:
- ไม่มี twitter:card (ทั้งหมด) → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- เฉพาะเมื่อ 100% หน้าไม่มี

**WHAT — ตรวจอะไร**

Twitter Card คือการตั้งค่าให้ลิงก์ที่แชร์บน X (Twitter) แสดงเป็นการ์ดสวยๆ พร้อมรูปและหัวข้อ

**WHY — ทำไมต้องตรวจ**

ช่วยให้ลิงก์ที่แชร์บน X ดูเป็นมืออาชีพและน่ากดมากขึ้น เพิ่มทราฟฟิกจากโซเชียล

**อ้างอิง:** [X Developer Docs (Cards)](https://docs.x.com/overview)


# Security

## HTTPS / TLS

### ไม่ใช่ HTTPS

`Security` · ความเชื่อมั่น 100% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 207-209)**

ตรวจว่าเว็บใช้ HTTPS
- *อ่านจาก:* `site.https (boolean)`

เงื่อนไขการตรวจ:
- เป็น HTTP → fail/high
- HTTPS → pass/high

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ site-level flag ไม่ได้หน้า per-page

**WHAT — ตรวจอะไร**

HTTPS คือการเข้ารหัสเว็บให้ปลอดภัย (สังเกตจากรูปกุญแจหน้าที่อยู่เว็บ) หน้าบางส่วนของเว็บนี้ยังไม่ปลอดภัย

**WHY — ทำไมต้องตรวจ**

เบราว์เซอร์จะขึ้นเตือน "เว็บไม่ปลอดภัย" ตัวแดงๆ ทำให้ลูกค้าตกใจและไม่กล้ากรอกข้อมูลหรือชำระเงิน ทั้งยัง Google จัดอันดับเว็บปลอดภัยดีกว่า

**อ้างอิง:** [Google: HTTPS as a ranking signal](https://developers.google.com/search/blog/2014/08/https-as-ranking-signal) · [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110)


### SSL chain ไม่ครบ

`Security` · ความเชื่อมั่น 95% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 214-218)**

ตรวจว่า SSL certificate chain ส่งครบ (leaf + intermediate)
- *อ่านจาก:* `site.tlsInsecure (boolean), site.tlsErrorCode (string)`

เงื่อนไขการตรวจ:
- site.tlsInsecure = true → fail/high

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ site-level flag จาก TLS handshake เมื่อ crawl
- แอบ bypass TLS verify ถึงจะตรวจ → ผลอาจไม่เสมอปกติ

**อ้างอิง:** [RFC 8446: TLS 1.3](https://datatracker.ietf.org/doc/html/rfc8446) · [MDN: Transport Layer Security](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security)


### mixed content

`Security` · ความเชื่อมั่น 100% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 368-371)**

ตรวจหน้า HTTPS ที่โหลด resource ผ่าน HTTP
- *อ่านจาก:* `p.scripts, p.stylesheets, p.images.map(i => i.src) (array of URLs)`

เงื่อนไขการตรวจ:
- HTTPS page มี http resource → fail/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages ที่ url.startsWith('https://')
- ตรวจสคริปต์, stylesheet, รูป

**WHAT — ตรวจอะไร**

หน้าที่ปลอดภัย (HTTPS) แต่ยังดึงบางส่วน (เช่นรูปหรือสคริปต์) มาจากช่องทางที่ไม่ปลอดภัย เหมือนบ้านที่ล็อกประตูหน้าแต่เปิดหน้าต่างหลังทิ้งไว้

**WHY — ทำไมต้องตรวจ**

เบราว์เซอร์อาจขึ้นเตือนว่าหน้าไม่ปลอดภัยเต็มที่ หรือบล็อกบางส่วนไม่ให้แสดง ทำให้หน้าดูพังและลดความน่าเชื่อถือ

**อ้างอิง:** [W3C: Mixed Content](https://www.w3.org/TR/mixed-content/) · [MDN: Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)


## Security Headers

### ขาด security headers

`Security` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 568-579)**

ตรวจ security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- *อ่านจาก:* `home.headers (from homepage)`

เงื่อนไขการตรวจ:
- ขาด headers → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจเฉพาะ homepage (home) ไม่ได้ทั้งเว็บ
- ตรวจ: strict-transport-security, x-content-type-options, x-frame-options, referrer-policy

**WHAT — ตรวจอะไร**

เว็บยังตั้งค่าความปลอดภัยเสริมบางอย่างไม่ครบ (การ์ดป้องกันการโจมตีรูปแบบต่างๆ ที่เพิ่มได้ฝั่งเซิร์ฟเวอร์)

**WHY — ทำไมต้องตรวจ**

ช่วยป้องกันการโจมตีและเพิ่มความน่าเชื่อถือของเว็บ เป็นการบ้านพื้นฐานด้านความปลอดภัยที่ควรทำให้ครบ

**อ้างอิง:** [MDN: HTTP headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers) · [OWASP: Secure Headers Project](https://owasp.org/www-project-secure-headers/)


# Performance

## Speed

### TTFB ช้า

`Performance` · ความเชื่อมั่น 90% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 560-561)**

ตรวจหน้าที่ตอบช้า >3 วินาที
- *อ่านจาก:* `p.elapsed (ms)`

เงื่อนไขการตรวจ:
- >3000ms → warn/med

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold 3000ms
- ตรวจ okPages

**WHAT — ตรวจอะไร**

TTFB คือเวลาที่เซิร์ฟเวอร์ใช้ตอบสนองครั้งแรกหลังคนกดเข้าเว็บ (ก่อนหน้าจะเริ่มแสดงอะไรด้วยซ้ำ) ของเว็บนี้ช้ากว่าเกณฑ์

**WHY — ทำไมต้องตรวจ**

ถ้าเซิร์ฟเวอร์ตอบช้าตั้งแต่วินาทีแรก ทุกอย่างหลังจากนั้นก็ช้าตาม ลูกค้าบนมือถือมักใจร้อน รอเกิน 3 วินาทีก็กดออกแล้ว

**อ้างอิง:** [web.dev: Time to First Byte (TTFB)](https://web.dev/articles/ttfb) · [Google: Core Web Vitals report](https://developers.google.com/search/docs/appearance/core-web-vitals)


## Payload

### ไม่บีบอัด (gzip/br)

`Performance` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 555-558)**

ตรวจว่าเปิด content encoding (gzip/brotli)
- *อ่านจาก:* `p.headers['content-encoding']`

เงื่อนไขการตรวจ:
- ไม่มี encoding (ทั้งหมด okPages) → warn/med
- มี encoding → pass/med

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- ไม่ validate ว่า gzip ตัวจริง
- ไม่ cover proxy/CDN ที่ลบ header

**WHAT — ตรวจอะไร**

เว็บยังไม่ได้เปิดการบีบอัดไฟล์ก่อนส่งให้ผู้ใช้ (เหมือนส่งของโดยไม่ได้แพ็กให้กระชับ) ทำให้ไฟล์ที่ส่งใหญ่กว่าที่ควร

**WHY — ทำไมต้องตรวจ**

การเปิดบีบอัดเป็นวิธีง่ายๆ ที่ทำให้เว็บโหลดเร็วขึ้นทันทีโดยไม่ต้องแก้เนื้อหา ช่วยทั้งอันดับและประสบการณ์ลูกค้า

**อ้างอิง:** [Lighthouse: Enable text compression](https://developer.chrome.com/docs/lighthouse/performance/uses-text-compression)


### HTML ใหญ่เกิน

`Performance` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 549-550)**

ตรวจหน้าที่มี HTML ไฟล์ใหญ่ >500KB
- *อ่านจาก:* `p.htmlBytes`

เงื่อนไขการตรวจ:
- >500KB → warn/med

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold 500KB
- ตรวจ okPages

**WHAT — ตรวจอะไร**

โค้ดของหน้าเว็บมีขนาดใหญ่เกินไป ทำให้ดาวน์โหลดและประมวลผลช้า

**WHY — ทำไมต้องตรวจ**

หน้าที่หนักทำให้โหลดช้าโดยเฉพาะบนมือถือและเน็ตช้า ส่งผลให้ลูกค้ารอนานและ Google ให้คะแนนความเร็วต่ำ

**อ้างอิง:** [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


### inline CSS/JS เยอะ

`Performance` · ความเชื่อมั่น 70% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 563-564)**

ตรวจหน้าที่มี inline script/style >200KB รวม
- *อ่านจาก:* `p.inlineScriptBytes + p.inlineStyleBytes`

เงื่อนไขการตรวจ:
- >200KB → warn/low

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold 200KB
- ตรวจ okPages

**WHAT — ตรวจอะไร**

หน้ามีโค้ดตกแต่ง/สคริปต์เขียนปนอยู่ในตัวหน้าเยอะเกินไป แทนที่จะแยกเป็นไฟล์ต่างหากที่เบราว์เซอร์จำไว้ใช้ซ้ำได้

**WHY — ทำไมต้องตรวจ**

ทำให้ทุกหน้าหนักขึ้นและโหลดช้าซ้ำๆ เพราะเบราว์เซอร์เก็บไว้ใช้ซ้ำไม่ได้ กระทบความเร็วโดยรวม

**อ้างอิง:** [Lighthouse: Eliminate render-blocking resources](https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources) · [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


### script เยอะ

`Performance` · ความเชื่อมั่น 70% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 552-553)**

ตรวจหน้าที่โหลด JS >25 ไฟล์
- *อ่านจาก:* `p.scripts.length`

เงื่อนไขการตรวจ:
- >25 ไฟล์ → warn/med

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold 25
- ตรวจ okPages

**WHAT — ตรวจอะไร**

หน้าโหลดสคริปต์ (โปรแกรมเล็กๆ ที่ทำให้เว็บทำงาน) จำนวนมากเกินไป

**WHY — ทำไมต้องตรวจ**

ยิ่งสคริปต์เยอะ หน้ายิ่งใช้เวลาประมวลผลนานก่อนพร้อมใช้งาน ลูกค้าต้องรอนานขึ้นกว่าจะกดอะไรได้

**อ้างอิง:** [Lighthouse: Avoid an excessive DOM size](https://developer.chrome.com/docs/lighthouse/performance/dom-size)


### อัตรา text:HTML ต่ำ

`Performance` · ความเชื่อมั่น 60% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 711-712)**

ตรวจหน้าที่มี text-to-HTML ratio <8% (code bloat)
- *อ่านจาก:* `p.htmlBytes, p.textLength, (textLength / htmlBytes)`

เงื่อนไขการตรวจ:
- >60KB HTML + ratio <8% → warn/low

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold >60KB HTML + <0.08 ratio

**WHAT — ตรวจอะไร**

สัดส่วนระหว่าง "ตัวหนังสือจริงที่คนอ่าน" กับ "โค้ดเบื้องหลังหน้าเว็บ" ถ้าหน้ามีโค้ดเยอะแต่ตัวหนังสือน้อย แปลว่าหน้าหนักแต่เนื้อหาจริงนิดเดียว

**WHY — ทำไมต้องตรวจ**

หน้าที่มีเนื้อหาน้อยเมื่อเทียบกับขนาดไฟล์ มักโหลดช้าและให้คุณค่ากับผู้อ่านน้อย ส่งผลเสียทั้งต่ออันดับและประสบการณ์ลูกค้า

**อ้างอิง:** [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


## Render-blocking

### blocking ใน <head>

`Performance` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 707-708)**

ตรวจ <script src> ใน <head> ที่ block rendering >2 ตัว
- *อ่านจาก:* `p.headBlockingScripts (count)`

เงื่อนไขการตรวจ:
- >2 blocking scripts → warn/med

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold 2

**WHAT — ตรวจอะไร**

มีไฟล์ที่ "ขวางการแสดงผล" อยู่ส่วนบนของหน้า ทำให้เบราว์เซอร์ต้องโหลดไฟล์นั้นให้เสร็จก่อนถึงจะเริ่มแสดงเนื้อหาให้คนเห็น

**WHY — ทำไมต้องตรวจ**

ทำให้คนเห็นหน้าจอขาวๆ นานขึ้นก่อนเนื้อหาจะโผล่ ซึ่งเป็นช่วงวิกฤตที่ลูกค้าตัดสินใจว่าจะรอหรือกดออก

**อ้างอิง:** [Lighthouse: Eliminate render-blocking resources](https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources)


### third-party เยอะ

`Performance` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 700-704)**

ตรวจหน้าที่โหลด third-party scripts >8 โดเมน
- *อ่านจาก:* `p.scripts (array of URLs), extract hostname, filter non-origin`

เงื่อนไขการตรวจ:
- >8 third-party domains → warn/med

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold 8 domains
- ตรวจ okPages

**WHAT — ตรวจอะไร**

หน้าดึงโค้ดจากบริการภายนอกหลายเจ้า (เช่น แชท วิดเจ็ต โฆษณา ตัวติดตามสถิติ) มากเกินไป

**WHY — ทำไมต้องตรวจ**

โค้ดจากภายนอกแต่ละตัวเราคุมความเร็วไม่ได้ ถ้าเจ้าใดช้าก็ลากให้ทั้งหน้าเราช้าตาม ควรเก็บเท่าที่จำเป็น

**อ้างอิง:** [Lighthouse: Reduce third-party impact](https://developer.chrome.com/docs/lighthouse/performance/third-party-summary)


# Media / Links

## Images

### รูปไม่มี alt

`Media / Links` · ความเชื่อมั่น 100% · Tier 1

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 489-533)**

ตรวจรูปที่ไม่มี alt text (3-state: fail/warn/pass ขึ้นกับ % และ alt= vs null)
- *อ่านจาก:* `p.imageVis (rendered visible images) OR p.images (raw HTML) — {visible, ariaHidden, labeled, alt, src}`

เงื่อนไขการตรวจ:
- missing alt >50% → fail/med
- missing alt >0% → warn/med
- missing alt = 0 แต่มี alt= → warn/low (ควรยืนยัน)
- ครบ → pass/med

ข้อสังเกต / ควรเพิ่ม:
- prefer imageVis (rendered) ถ้ามี, fallback ไป p.images (raw)
- missing = i.alt == null + ไม่มี aria-label/role
- empty = i.alt === ''
- labeled = aria-label หรือ role
- confidence ขึ้นกับ usedRender

**WHAT — ตรวจอะไร**

Alt text คือคำบรรยายรูปภาพที่เขียนไว้ในโค้ด บอกว่ารูปนั้นเป็นรูปอะไร (เช่น "รองเท้าวิ่งสีแดงรุ่น X") รูปส่วนใหญ่ในเว็บนี้ไม่มีคำบรรยาย

**WHY — ทำไมต้องตรวจ**

เสีย 2 อย่าง: (1) รูปเราจะไม่ขึ้นใน Google Images ทำให้พลาดทราฟฟิกจากการค้นรูป (2) ผู้พิการทางสายตาที่ใช้โปรแกรมอ่านหน้าจอจะไม่รู้ว่ารูปคืออะไร ซึ่งเป็นทั้งเรื่องการเข้าถึงและบางองค์กรถือเป็นข้อกำหนดทางกฎหมาย

**HOW — ตรวจอย่างไร**

1. rendered DOM (รูปที่แสดงจริง)
2. รูป decorative → ข้าม

**DECISION RULE — เกณฑ์ตัดสิน**

- visible + ไม่มี alt → fail/warn  →  🟡 Low/Warn
- alt="" → conf ต่ำ
- ครบ → pass

**อ้างอิง:** [HTML Standard: alt text requirements](https://html.spec.whatwg.org/multipage/images.html#alt) · [WCAG 2.1: Non-text Content (1.1.1)](https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html)


### ไม่มีขนาดรูป

`Media / Links` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 540-543)**

ตรวจรูปที่ไม่ระบุ width/height attribute
- *อ่านจาก:* `p.images.filter(i => i.src && (\!i.width || \!i.height))`

เงื่อนไขการตรวจ:
- >50% รูป ไม่มี width/height (+ >5 รูป) → warn/low

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold >50% + >5 รูป
- ตรวจ okPages

**WHAT — ตรวจอะไร**

รูปภาพไม่ได้ระบุขนาด (กว้าง×สูง) ไว้ในโค้ด ทำให้เวลาหน้าโหลด เนื้อหากระตุกขยับไปมาตอนรูปค่อยๆ ขึ้น

**WHY — ทำไมต้องตรวจ**

หน้าที่เนื้อหากระโดดไปมาตอนโหลดทำให้ลูกค้ารำคาญ (บางทีกำลังจะกดปุ่มแล้วปุ่มเลื่อนหนี) และ Google นับเป็นคะแนนความเร็วที่แย่ลง

**อ้างอิง:** [HTML Standard: dimension attributes](https://html.spec.whatwg.org/multipage/embedded-content-other.html#dimension-attributes) · [Google: Core Web Vitals report](https://developers.google.com/search/docs/appearance/core-web-vitals)


### ไม่ lazy-load

`Media / Links` · ความเชื่อมั่น 75% · Tier 3

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 536-539)**

ตรวจรูปที่ไม่มี loading=lazy attribute
- *อ่านจาก:* `p.images.filter(i => i.src && \!i.loading).length`

เงื่อนไขการตรวจ:
- >70% รูป ไม่มี lazy loading (+ >5 รูป) → warn/low

ข้อสังเกต / ควรเพิ่ม:
- hardcoded threshold >70% + >5 รูป
- ตรวจ okPages
- ไม่ detect lazy loading ด้วย JS library

**WHAT — ตรวจอะไร**

รูปภาพยังไม่ได้ตั้งค่าให้ "โหลดเมื่อเลื่อนถึง" (lazy load) ทำให้ตอนเปิดหน้าต้องโหลดรูปทั้งหมดพร้อมกันแม้รูปที่อยู่ล่างสุด

**WHY — ทำไมต้องตรวจ**

การโหลดรูปทุกใบพร้อมกันทำให้หน้าเปิดช้าลง โดยเฉพาะบนมือถือ ลูกค้าที่รอนานอาจกดออกก่อน

**อ้างอิง:** [HTML Standard: lazy-loading attribute](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#lazy-loading-attributes) · [MDN: Lazy loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading)


## Rendering

### raw ≠ rendered

`Media / Links` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 596-622)**

ตรวจความต่างระหว่าง raw HTML vs rendered DOM (headless Chrome)
- *อ่านจาก:* `site.rendered.pages (object: {url: {h1, title, textLength, error}}), raw page data`

เงื่อนไขการตรวจ:
- raw \!= rendered (H1/title/text ต่าง) → fail/high
- raw = rendered → pass/high
- render ไม่สำเร็จ → warn/high (timeout/rate-limit)

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ site.rendered.available = true
- r.textLength / raw.textLength < 0.5 = เนื้อหา 50%+ โผล่หลัง render

**WHAT — ตรวจอะไร**

เปรียบเทียบสิ่งที่เห็น "ตอนเปิดหน้าครั้งแรก" กับ "หลังหน้าประกอบเสร็จ" แล้วพบว่าต่างกันมาก แปลว่าเนื้อหาสำคัญโผล่มาทีหลังด้วยโปรแกรม ไม่ได้อยู่ในหน้าตั้งแต่แรก

**WHY — ทำไมต้องตรวจ**

เนื้อหาที่โผล่ทีหลังมีความเสี่ยงที่ Google จะเก็บไม่ครบ และบอท AI ที่ไม่รอประกอบหน้าจะมองไม่เห็นเลย ทำให้เนื้อหาขายของเราหายไปจากทั้ง Google และ AI

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)


### SPA shell ว่าง

`Media / Links` · ความเชื่อมั่น 85% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 584-594)**

ตรวจว่าเว็บเป็น SPA client-side render เปลือกเปล่า (vs SSR/static)
- *อ่านจาก:* `p.emptyRoot (boolean), home.frameworkMarkers (object of framework names)`

เงื่อนไขการตรวจ:
- emptyRoot + เปลือก → fail/high
- emptyRoot = false + framework detected → pass/high
- emptyRoot = false + no framework → pass/high

ข้อสังเกต / ควรเพิ่ม:
- emptyRoot = HTML root container ว่าง
- framework markers = React/Vue/Angular/Svelte/Next/Nuxt detected
- ตรวจ okPages

**WHAT — ตรวจอะไร**

เว็บนี้สร้างแบบที่เนื้อหา "ค่อยประกอบขึ้นด้วยโปรแกรม (JavaScript) หลังเปิดหน้า" แทนที่จะส่งเนื้อหาสำเร็จรูปมาเลย ทำให้ตอนแรกที่เปิดมาหน้าแทบว่างเปล่า

**WHY — ทำไมต้องตรวจ**

นี่คือปัญหาใหญ่สำหรับยุค AI — Google พอจะรอประกอบหน้าได้บ้าง แต่บอทของ AI ทั้งหลาย (ChatGPT, Claude, Perplexity) ไม่รอประกอบหน้า มันเห็นแค่หน้าว่างๆ เท่ากับเว็บเราล่องหนในสายตา AI ทั้งหมด

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)


### ไม่มี noscript fallback

`Media / Links` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 620-621)**

ตรวจว่า SPA มี <noscript> fallback ระหว่างรอแก้ SSR
- *อ่านจาก:* `p.emptyRoot + p.hasNoscript (boolean)`

เงื่อนไขการตรวจ:
- emptyRoot + \!hasNoscript → warn/low

ข้อสังเกต / ควรเพิ่ม:
- ตรวจ okPages
- ตรวจเฉพาะ SPA shell (emptyRoot = true)

**WHAT — ตรวจอะไร**

สำหรับเว็บที่พึ่งพาโปรแกรม (JavaScript) ควรมีเนื้อหาสำรองเผื่อกรณีที่โปรแกรมไม่ทำงาน แต่เว็บนี้ไม่มี

**WHY — ทำไมต้องตรวจ**

ถ้าโปรแกรมโหลดไม่สำเร็จ (เน็ตช้า/บอทที่ไม่รันโปรแกรม) ผู้เข้าชมจะเจอหน้าว่างเปล่า เสียทั้งลูกค้าและการถูกเก็บข้อมูล

**อ้างอิง:** [HTML Standard: the noscript element](https://html.spec.whatwg.org/multipage/scripting.html#the-noscript-element) · [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)


# GEO (AI Search)

## llms.txt

### ไม่มี llms.txt

`GEO (AI Search)` · ความเชื่อมั่น 60% · Tier 4

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 84-89)**

ตรวจว่ามีไฟล์ /llms.txt (ไฟล์มาตรฐาน AI engines)
- *อ่านจาก:* `site.llmsTxt (boolean flag — true if file exists, false otherwise)`

เงื่อนไขการตรวจ:
- site.llmsTxt === true → severity low, status pass
- site.llmsTxt === false/missing → severity low, status info

ข้อสังเกต / ควรเพิ่ม:
- Purely checks existence: no validation of llms.txt content, format, or directives
- Both outcomes are low severity + non-blocking (pass vs. info) because Google officially does NOT crawl/use llms.txt
- Recommendation explicitly states this is 'nice-to-have' not a SEO factor per Gary Illyes/John Mueller (2025)
- LIMITATION: Does not check if llms.txt content matches any spec or contains valid directives
- Does not measure whether llms.txt is properly accessible (404, auth-blocked, etc.)

**WHAT — ตรวจอะไร**

llms.txt คือไฟล์มาตรฐานใหม่ (เหมือน robots.txt แต่สำหรับ AI) ที่สรุปให้ AI ฟังว่าเว็บเราคือใคร มีหน้าสำคัญอะไรบ้าง ให้ AI ดึงไปใช้ได้ถูกต้อง เว็บนี้ยังไม่มี

**WHY — ทำไมต้องตรวจ**

เป็นมาตรฐานที่เพิ่งเกิดและยังมีคนทำน้อยมาก โดยเฉพาะเว็บไทย — การทำก่อนคือโอกาสนำหน้าคู่แข่งในการถูก AI เข้าใจและอ้างอิงอย่างถูกต้อง

**อ้างอิง:** [The /llms.txt proposal](https://llmstxt.org/)


## AI Crawler

### AI bot เข้าได้ไหม

`GEO (AI Search)` · ความเชื่อมั่น 75% · Tier 4

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 49-82)**

ตรวจว่า robots.txt อนุญาตให้ AI bots (ChatGPT, Perplexity, Claude ฯลฯ) เข้าถึง path ที่สำคัญได้
- *อ่านจาก:* `site.robots (robots.txt parsed), AI_BOTS array (14 bots), pages.map(p.url) to extract pathnames, site.robots.groups[].rules[].path/type`

เงื่อนไขการตรวจ:
- robots.txt exists AND any AI_BOT blocked from root '/' → severity high, status fail
- robots.txt exists AND AI_BOT blocked from section paths (not '/') only → severity med, status warn
- robots.txt exists AND all AI_BOTS allowed from all tested paths → severity high, status pass
- robots.txt missing → severity med, status warn

ข้อสังเกต / ควรเพิ่ม:
- Detects blocklist by calling robotsAllows() for each bot on ~30 sampled paths (root + crawled pages + disallow sections from robots.txt)
- SECTION_RE regex catches specific directory patterns (/th, /en, /blog, /product, /service, /news, /article, /category, /shop) to infer blocked areas
- Distinguishes severity: root block = high/fail vs. section-only block = med/warn
- Does NOT validate the actual crawl behavior of each bot (only checks what robots.txt claims)
- Does NOT verify if bots are actually coming or checking crawl logs
- Does NOT handle Disallow: rules that use wildcards or complex patterns beyond simple path match

**WHAT — ตรวจอะไร**

ตรวจว่าเว็บเปิดให้บอทของ AI ต่างๆ (เช่น GPTBot ของ ChatGPT, ClaudeBot, PerplexityBot) เข้ามาอ่านเนื้อหาได้หรือไม่

**WHY — ทำไมต้องตรวจ**

ถ้าปิดกั้นบอท AI เวลาคนถาม ChatGPT/Perplexity เกี่ยวกับสิ่งที่เราขาย AI จะไม่มีข้อมูลเราไปตอบเลย เท่ากับหายไปจากช่องทางค้นหายุคใหม่ที่กำลังโตเร็ว

**อ้างอิง:** [OpenAI: Bots (GPTBot)](https://developers.openai.com/api/docs/bots) · [Anthropic: Does Anthropic crawl the web?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity: PerplexityBot](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)


### เสี่ยง SPA บัง AI bot

`GEO (AI Search)` · ความเชื่อมั่น 70% · Tier 4

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 91-99)**

ตรวจว่าเนื้อหาหลักอยู่ใน HTML ดิบ (Server-Side Rendered) หรือต้องรอ JavaScript render
- *อ่านจาก:* `pages[].emptyRoot (boolean — true if page sends empty/minimal HTML shell)`

เงื่อนไขการตรวจ:
- Any page with emptyRoot === true → severity high, status fail
- All pages have content in raw HTML (no emptyRoot) → severity high, status pass

ข้อสังเกต / ควรเพิ่ม:
- emptyRoot flag indicates crawler received HTML with minimal/no visible text nodes (SPA shell)
- Assumes AI bots (GPTBot, ClaudeBot, PerplexityBot) do NOT execute JavaScript — only read raw HTML
- Does NOT actually test whether each AI bot can fetch + render JavaScript (crawl simulation)
- Does NOT check for pre-rendering, hydration, or progressive enhancement
- Does NOT validate Googlebot's rendering capability (only notes it's 'slower & less stable')
- LIMITATION: Binary check — no gradient for 'some JS-dependent content' vs. 'all content is dynamic'

**WHAT — ตรวจอะไร**

ตรวจว่าเนื้อหาเว็บต้องอาศัยโปรแกรม (JavaScript) ประกอบหน้าหรือไม่ ซึ่งเป็นความเสี่ยงสำหรับ AI ที่ไม่รอประกอบหน้า

**WHY — ทำไมต้องตรวจ**

ถ้าเนื้อหาเราโผล่ด้วยโปรแกรมทีหลัง บอท AI จะมองไม่เห็นและดึงไปตอบไม่ได้ ทำให้เราหายไปจากผลการค้นหายุค AI

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) · [OpenAI: Bots (GPTBot)](https://developers.openai.com/api/docs/bots)


## Citability

### FAQ schema

`GEO (AI Search)` · ความเชื่อมั่น 60% · Tier 4

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 101-112)**

ตรวจว่ามี JSON-LD schema type FAQPage หรือ QAPage (Q&A structured data)
- *อ่านจาก:* `pages[].jsonLd[].data, iterate @type fields, accumulate ldTypes Set, check ldTypes.has('FAQPage') || ldTypes.has('QAPage')`

เงื่อนไขการตรวจ:
- ldTypes contains 'FAQPage' OR 'QAPage' → severity med, status pass
- Neither FAQPage nor QAPage found in pages → severity med, status warn

ข้อสังเกต / ควรเพิ่ม:
- Walks through all JSON-LD blocks on all pages and collects @type values (handling @graph nesting)
- Schema type match is presence-only: no validation that FAQPage/QAPage actually contains filled mainEntity/acceptedAnswer
- Does NOT check if Q&A blocks have valid data structure (e.g., mainEntity[].question, mainEntity[].acceptedAnswer.text populated)
- Does NOT verify Q&As match actual page content or are not fabricated
- Note in code: Google removed FAQ rich snippets from SERP (May 2026), so benefit now is AI engine citation only
- Does NOT validate whether QAPage is used for user-generated Q&A vs. false-marked FAQ

**WHAT — ตรวจอะไร**

FAQPage schema คือการติดฉลากให้ส่วนคำถาม-คำตอบในเว็บ เป็นรูปแบบที่ Google AI Overview และ ChatGPT ชอบหยิบไปตอบมากที่สุด เว็บนี้ยังไม่มีสักหน้า

**WHY — ทำไมต้องตรวจ**

นี่คือทางลัดที่ได้ผลที่สุดในการถูก AI อ้างถึง — ถ้าเราเตรียมคำถาม-คำตอบที่ลูกค้าถามบ่อยพร้อมติดฉลากไว้ มีโอกาสสูงที่ AI จะหยิบคำตอบของเราไปแสดงพร้อมเครดิตกลับมาหาเรา

**อ้างอิง:** [Google: Changes to FAQ rich results (2023)](https://developers.google.com/search/blog/2023/08/howto-faq-changes) · [Schema.org: FAQPage](https://schema.org/FAQPage)


### เนื้อหา Q&A

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 114-121)**

ตรวจว่าหน้าเว็บมี heading เชิงคำถาม (ไม่ใช่ h1) ที่ตรงกับรูปแบบถาม (?, 'คืออะไร', 'ทำไม', 'อย่างไร', 'what', 'how' ฯลฯ)
- *อ่านจาก:* `pages[].headings[].tag, pages[].headings[].text, qWords regex /[?|คืออะไร|...]/i`

เงื่อนไขการตรวจ:
- At least one page has h2/h3/h4+ heading matching qWords pattern → status pass, severity med
- No pages have question-style headings → status warn, severity med

ข้อสังเกต / ควรเพิ่ม:
- Pattern-based: regex matches literal '?' or Thai terms (คืออะไร, คือ, ทำไม, etc.) OR English (what, how, why, when, where, who)
- Only scans non-h1 headings (filters h1 to avoid matching site title)
- LIMITATION: No validation that heading is actually a question sentence — just pattern match (e.g., '? mark at end' could be false positive)
- Does NOT check if paragraph text below heading actually answers the question
- Does NOT measure quality or relevance of Q&A content
- Assumes headings reflect content structure; does not parse body text for implicit Q&A patterns

**WHAT — ตรวจอะไร**

ตรวจว่าเว็บมีเนื้อหารูปแบบถาม-ตอบ (หัวข้อที่ตั้งเป็นคำถามแล้วตามด้วยคำตอบ) ซึ่งเป็นโครงสร้างที่ AI ดึงไปตอบง่าย

**WHY — ทำไมต้องตรวจ**

AI ตอบคำถามคน ดังนั้นเนื้อหาที่จัดเป็นคำถาม-คำตอบตรงกับสิ่งที่ AI มองหาพอดี ยิ่งมีมาก ยิ่งมีโอกาสถูกเลือกไปเป็นคำตอบ

**อ้างอิง:** [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


### เนื้อหาอ้างอิงได้

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 140-146)**

ตรวจว่ามีเนื้อหาเชิงข้อมูล (ตาราง, ลิสต์) ที่ AI ชอบอ้างอิง
- *อ่านจาก:* `pages[].hasTables (boolean), pages[].listCount (number >= 3)`

เงื่อนไขการตรวจ:
- At least min(3, total_pages) pages have (hasTables === true OR listCount >= 3) → severity low, status pass
- Fewer than min(3, total_pages) pages with data blocks → severity low, status warn

ข้อสังเกต / ควรเพิ่ม:
- Threshold is dynamic: min(3, pages.length) — so if site has <3 pages, must have all with data
- Combines two types: hasTables (explicit table detection) and listCount (3+ list items, presumably <ul>/<ol> counting)
- Does NOT validate table quality, accessibility (headers, scope), or list relevance
- Does NOT check if data is original/useful vs. generic (e.g., boilerplate list)
- Does NOT measure citation patterns or confirm AI engines actually cite this site's tables
- LIMITATION: listCount threshold hardcoded to 3 with no weighting for list position or prominence

**WHAT — ตรวจอะไร**

ตรวจว่าเนื้อหาในเว็บอยู่ในรูปแบบที่ AI ชอบหยิบไปอ้างอิง เช่น มีตาราง มีลิสต์ มีคำตอบที่ชัดเจนตรงประเด็น

**WHY — ทำไมต้องตรวจ**

AI มักดึงคำตอบจากเนื้อหาที่เป็นระเบียบและตอบตรงคำถาม ยิ่งเนื้อหาเราจัดรูปแบบดี ยิ่งมีโอกาสถูก AI เลือกไปอ้างอิงพร้อมลิงก์กลับมาหาเรา

**อ้างอิง:** [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


## Authority / E-E-A-T

### E-E-A-T สัญญาณ

`GEO (AI Search)` · ความเชื่อมั่น 80% · Tier 2

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 123-138)**

ตรวจสัญญาณความน่าเชื่อถือ (Expertise, Experience, Authoritativeness, Trustworthiness) ที่อ่านได้ด้วยเครื่อง: author, datePublished, sameAs links
- *อ่านจาก:* `pages[].metas['author'], pages[].metas['article:published_time'], pages[].jsonLd (all blocks), ldTypes.has('Person'/'Organization'), jsonLdHasProp() for 'author'/'datePublished'/'dateModified'/'sameAs'`

เงื่อนไขการตรวจ:
- No pages have author signal (meta OR Person type OR author property in schema) → add 'ไม่มีข้อมูลผู้เขียน'
- No pages have date signal (meta OR datePublished/dateModified schema) → add 'ไม่มีวันที่เผยแพร่'
- No Organization schema has sameAs property → add 'ไม่มี sameAs ลิงก์'
- eat array empty → severity med, status pass
- eat array has missing signals → severity med, status warn, with eatMissingPages listed

ข้อสังเกต / ควรเพิ่ม:
- Author check: OR-logic across 3 sources (author meta, Person schema type, author property deep in JSON-LD)
- Date check: OR-logic across 2 sources (article:published_time meta, or datePublished/dateModified schema properties)
- sameAs check: checks if ANY page's Organization schema has sameAs field (social/Wikipedia entity links)
- Code warns this is SIGNAL not JUDGMENT: 'ตรวจเฉพาะสัญญาณ structured ที่ช่วยให้เชื่อมโยง... ไม่ตัดสินว่า E-E-A-T อ่อน'
- LIMITATION: No thresholds (e.g., 'at least 50% of pages must have author') — one page with author = passes author check
- Does NOT validate author name is real/notable or date is accurate
- jsonLdHasProp() validates property has non-empty value (avoids false positives like 'author: ""')

**WHAT — ตรวจอะไร**

E-E-A-T คือสัญญาณความน่าเชื่อถือที่ Google และ AI ใช้ดู เช่น ใครเป็นคนเขียน มีวันที่เผยแพร่/อัปเดตไหม มีลิงก์ยืนยันตัวตนแบรนด์ (โซเชียล/วิกิพีเดีย) หรือเปล่า เว็บนี้ยังขาดสัญญาณเหล่านี้

**WHY — ทำไมต้องตรวจ**

ทั้ง Google และ AI ให้คะแนนแหล่งที่ดูน่าเชื่อถือสูงกว่า ถ้าเว็บเราไม่มีคนเขียน ไม่มีวันที่ ไม่มีตัวตนชัด AI จะลังเลที่จะอ้างอิงเรา และเลือกแหล่งอื่นที่ดูน่าเชื่อถือกว่าแทน

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) · [Google: Search Quality Rater Guidelines (PDF)](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)


### entity ชัดเจน

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 166-176)**

ตรวจว่าหน้าแรก (home page) มี Organization หรือ LocalBusiness schema (เอกลักษณ์แบรนด์เป็น entity)
- *อ่านจาก:* `home page (pages[0] or URL with pathname '/'), ldTypes.has('Organization') || ldTypes.has('LocalBusiness')`

เงื่อนไขการตรวจ:
- ldTypes contains 'Organization' OR 'LocalBusiness' schema → severity med, status pass
- Neither schema type found → severity med, status warn

ข้อสังเกต / ควรเพิ่ม:
- Only checks home page (detected as pathname === '/' or first crawled page if home not found)
- Type detection is presence-only: does NOT validate Organization schema has required/recommended properties (name, logo, description, address, sameAs)
- Does NOT check if Organization name matches brand or is accurate
- Does NOT verify sameAs links exist or are valid (only warns if missing entirely in previous check 'geo-eeat')
- Does NOT confirm schema.org context is correct or JSON-LD is valid
- Scope: home page only — does NOT scan schema on other pages
- Note in code: 'Assumes AI can understand brand from text/links/knowledge graph but schema is a structured signal'

**WHAT — ตรวจอะไร**

ตรวจว่า AI "รู้จักตัวตนของแบรนด์เรา" ไหม ซึ่งต้องอาศัยฉลากข้อมูลองค์กร (Organization schema) ที่บอกว่าเราคือใคร เว็บนี้ยังไม่มี

**WHY — ทำไมต้องตรวจ**

เมื่อมีคนถาม AI ว่า "ธุรกิจประเภทนี้มีเจ้าไหนบ้าง" ถ้า AI ไม่มีข้อมูลตัวตนของแบรนด์เราที่ชัดเจน มันจะไม่นึกถึงเราและไปแนะนำคู่แข่งที่มีข้อมูลครบกว่าแทน

**อ้างอิง:** [Google: Introducing the Knowledge Graph](https://blog.google/products-and-platforms/products/search/introducing-knowledge-graph-things-not/) · [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


### หน้า trust (about/contact)

`GEO (AI Search)` · ความเชื่อมั่น 65% · Tier 4

**⚙ ในระบบวัดจริงตอนนี้ (จากโค้ด · line 148-164)**

ตรวจสัญญาณความน่าเชื่อถือของแบรนด์ (About, Contact, Privacy pages + contact info)
- *อ่านจาก:* `pages[].url lowercased + pages[].links[].href, regex scan for /about|เกี่ยวกับ|contact|ติดต่อ|privacy|นโยบาย/, pages[].hasPhone, pages[].hasMailto`

เงื่อนไขการตรวจ:
- Missing 0-2 signals → severity med, status warn
- Missing 3+ signals → severity med, status fail
- All signals present (About OR Contact OR Privacy found in href, AND hasPhone/hasMailto on some page) → status pass

ข้อสังเกต / ควรเพิ่ม:
- Regex scans page URLs and outgoing links (lowercased) for keyword presence: about/contact/privacy in English, Thai equivalents
- Checks 4 independent signals: About page link, Contact page link, Privacy policy link, AND (phone number OR mailto visible on pages)
- Severity threshold: fail if 3+ missing, warn if fewer
- Does NOT verify links actually point to functional pages (404, login-walled, broken anchors not caught)
- Does NOT validate Privacy policy content (just presence of link)
- Does NOT check Contact page form functionality
- Does NOT validate phone/email formats or reachability
- Uses .toLowerCase() on href only — regex match is case-insensitive but link text check may miss Chinese/mixed-case variants

**WHAT — ตรวจอะไร**

ตรวจว่าเว็บมีหน้าสร้างความน่าเชื่อถือพื้นฐานครบไหม เช่น หน้าเกี่ยวกับเรา ติดต่อเรา นโยบายความเป็นส่วนตัว

**WHY — ทำไมต้องตรวจ**

ทั้งลูกค้า Google และ AI ใช้หน้าเหล่านี้ประเมินว่าเป็นธุรกิจจริงน่าเชื่อถือ ขาดไปทำให้ดูไม่มั่นคงและลดโอกาสถูกอ้างอิง

**อ้างอิง:** [Google: Search Quality Rater Guidelines (PDF)](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf) · [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)


# Verify

## Verification

### เทียบ Lighthouse



### เทียบ raw ↔ rendered



### คำนวณ confidence



### ส่งคน / seo-geo-verify


