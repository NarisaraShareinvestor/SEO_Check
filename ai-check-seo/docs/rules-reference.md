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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 103-115)**

1. หา <title> แท็ก ใน HTML ดิบ — *Google อ่านจาก HTML ดิบก่อน render JS*
2. ถ้าไม่มี ให้หา title ที่ render ด้วย JS — *SPA อาจสร้าง title ด้วย JavaScript*
3. ถ้ามี title ใน HTML ดิบ ให้ผ่าน — *เป็นสถานะที่ดี*

เกณฑ์ตัดสิน:
- ไม่มี raw และ render → ผิด | มี render แต่ไม่มี raw → ควรแก้ | มี raw → ผ่าน

**WHAT — ตรวจอะไร**

<title> คือชื่อหน้าที่กำหนดในโค้ด HTML ปรากฏบนแท็บเบราว์เซอร์ และใช้เป็นชื่อผลการค้นหาใน Google เมื่อไม่มี Search Engine ต้องสร้างชื่อจากองค์ประกอบอื่น

**WHY — ทำไมต้องตรวจ**

Search Engine ใช้ <title> ทำความเข้าใจหัวข้อหน้าเว็บ ความไม่มีหรือชื่อที่ไม่เกี่ยวข้องลดความสัมพันธ์ระหว่างข้อความค้นหาและผลลัพธ์

**อ้างอิง:** [Google: Influencing title links](https://developers.google.com/search/docs/appearance/title-link) · [HTML Standard: the title element](https://html.spec.whatwg.org/multipage/semantics.html#the-title-element)


### <title> สั้น/ยาว

`On-Page` · ความเชื่อมั่น 75% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 117-123)**

1. วัดความยาว <title> ที่มีอยู่ — *เพื่อให้ title แสดงครบในผลค้นหา Google*
2. ตรวจว่าติดช่วง 15-60 ตัวอักษร — *เกิน 60 ตัด ต่ำกว่า 15 อ่านไม่ชัด*

เกณฑ์ตัดสิน:
- ยาวเกิน 60 หรือสั้นเกิน 15 → ควรแก้

**WHAT — ตรวจอะไร**

ความยาวอุดมคติของ <title> คือ 30-60 ตัวอักษร ไม่เกิน 60 ตัวเพื่อหลีกเลี่ยงการถูกตัดในผลการค้นหา

**WHY — ทำไมต้องตรวจ**

<title> ที่ถูกตัดทำให้คำสำคัญหายไปจากการแสดงผล ลดความเกี่ยวข้องในสายตาผู้ค้นหา

**อ้างอิง:** [Google: Influencing title links](https://developers.google.com/search/docs/appearance/title-link) · [Moz: Title tag](https://moz.com/learn/seo/title-tag)


### <title> ซ้ำ  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 85% · Tier 2
> verify (เคส vgi) + backport exclusions/normalize เท่า h1 + unit test 130/130

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 125-133)**

1. เก็บเฉพาะหน้า indexable (ไม่มี noindex/canonical ชี้ออก) — *หน้า noindex ไม่ควรส่ง ranking signal*
2. ปรับ title ให้เปรียบเทียบกันได้ — *Test กับ test ไม่ควรนับว่าต่างกัน*
3. ตัด localization variants ออก — *เว็บหลายภาษา แต่แต่ละหน้า native ควรมี title เฉพาะ*

เกณฑ์ตัดสิน:
- พบ title ซ้ำข้าม 2 หน้า → ควรแก้

**WHAT — ตรวจอะไร**

มีหลายหน้าใช้ <title> เดียวกันแม้เนื้อหาต่างกัน ทำให้ Search Engine ไม่สามารถแยกแต่ละหน้า

**WHY — ทำไมต้องตรวจ**

Duplicate <title> ทำให้ Search Engine ไม่รู้หน้าใดตอบสนองข้อความค้นหาที่สำคัญ ส่งผลให้คะแนนและตำแหน่งการจัดอันดับกระจายไปในหลายหน้า

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 135-144)**

1. หา meta name description ใน HTML ดิบ — *Google ใช้ description ในผล SERP*
2. ถ้าไม่มี ให้หา description ที่ render ด้วย JS — *เช่นเดียวกับ title SPA อาจสร้าง*

เกณฑ์ตัดสิน:
- ไม่มีเลย → ผิด | มี render แต่ไม่มี raw → ควรแก้

**WHAT — ตรวจอะไร**

meta description คือย่อขนาด 1-2 บรรทัดที่อยู่ใต้ <title> ในผลการค้นหา เมื่อไม่มี Google ใช้ข้อความท่อนสุ่มจากเนื้อหาแทน

**WHY — ทำไมต้องตรวจ**

meta description ช่วยให้ผู้ค้นหาเข้าใจเนื้อหาก่อนเข้าเว็บ ไม่มีส่วนนี้อาจให้ข้อความที่ไม่เกี่ยวข้องขึ้นในผลการค้นหา

**อ้างอิง:** [Google: Control your snippets](https://developers.google.com/search/docs/appearance/snippet) · [Moz: Meta description](https://moz.com/learn/seo/meta-description)


### description สั้น/ยาว

`On-Page` · ความเชื่อมั่น 75% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 146-147)**

1. วัดความยาว meta description — *description แสดงในผลค้นหา*
2. ตรวจว่าอยู่ในช่วง 80-160 ตัวอักษร — *เกิน 160 ตัดใน SERP ต่ำกว่า 50 ดูแรง*

เกณฑ์ตัดสิน:
- > 170 หรือ < 50 → ควรแก้

**WHAT — ตรวจอะไร**

meta description ที่เหมาะสมยาว 80-160 ตัวอักษร พอพูดถึงหลัก แต่ไม่ยาวถึงขั้นถูกตัด

**WHY — ทำไมต้องตรวจ**

ความยาวพอดีเพิ่มโอกาสให้ Search Engine และผู้ค้นหาเห็นข้อมูลครบ สนับสนุนการตัดสินใจคลิก

**อ้างอิง:** [Google: Control your snippets](https://developers.google.com/search/docs/appearance/snippet) · [Moz: Meta description](https://moz.com/learn/seo/meta-description)


### description ซ้ำ

`On-Page` · ความเชื่อมั่น 75% · Tier 3
> logic+exclusions เท่า h1-duplicate + unit test แล้ว · รอ verify เว็บจริง

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 149-154)**

1. หา description ซ้ำๆ เหมือน title-duplicate — *หน้าต่างเรื่องควรมี description ต่างกัน*
2. ใช้ dupGroups helper เดียวกัน — *ความสม่ำเสมอ*

เกณฑ์ตัดสิน:
- พบซ้ำ → ควรแก้

**WHAT — ตรวจอะไร**

หลายหน้าใช้ meta description ข้อความเดียวกัน ทั้งที่เนื้อหาแต่ละหน้าต่างกัน

**WHY — ทำไมต้องตรวจ**

meta description ที่ซ้ำกันลบเลือนความแตกต่างระหว่างหน้า ทำให้ Search Engine และผู้ค้นหาไม่มองเห็นมูลค่าเฉพาะของแต่ละหน้า

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 156-168)**

1. หา h1 ใน HTML ดิบ ที่มีข้อความจริง — *H1 บอก Google ว่าหน้านี้เกี่ยวกับเรื่องไหน*
2. ถ้าไม่มี ให้หา H1 ที่ render ด้วย JS — *จำแนก AI bot ไม่สามารถเห็น JS-generated H1*
3. H1 ว่างเปล่า = ไม่มี — *ไม่มีข้อมูล*

เกณฑ์ตัดสิน:
- ไม่มี raw และ render → ผิด | มี render แต่ไม่มี raw → ควรแก้

**WHAT — ตรวจอะไร**

<h1> คือพาดหัวระดับสูงสุดของหน้า ควรมี 1 อันต่อหน้า เพื่อเน้นหัวข้อหลัก หน้านี้ไม่มี

**WHY — ทำไมต้องตรวจ**

Search Engine ใช้ <h1> เข้าใจโครงสร้างและเนื้อหาหลักของหน้า การไม่มีอาจทำให้ Search Engine และโปรแกรมอ่านหน้าจอเข้าใจหัวข้อได้ยาก

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 178-189)**

1. นับจำนวน h1 ในหน้า — *HTML5 อนุญาต multi-H1*
2. เช็คว่ามี section/article คั่น — *Multi-H1 ใช้ได้เมื่ออยู่ใน article/section เอง*

เกณฑ์ตัดสิน:
- มากกว่า 1 แต่เป็นเนื้อหาถูกต้อง → แจ้งเพื่อทราบ

**WHAT — ตรวจอะไร**

หน้ามี <h1> มากกว่า 1 อัน โดยที่หัวข้อต่างกัน ขัดแย้งกับความเป็นหัวข้อหลักเพียงอัน

**WHY — ทำไมต้องตรวจ**

จำนวน <h1> หลายอันทำให้ Search Engine สับสนว่าเนื้อหาหลักของหน้าคืออะไร ลดความชัดเจนในทำความเข้าใจ

**HOW — ตรวจอย่างไร**

1. นับ H1 ต่อหน้า (pageEligible)

**DECISION RULE — เกณฑ์ตัดสิน**

- หลาย H1 = Info เสมอ — HTML5 อนุญาต Google ไม่ถือว่าผิด  →  ⚪ Info

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL`

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [Ahrefs: The H1 tag](https://ahrefs.com/blog/h1-tag/)


### <h1> ซ้ำหน้าอื่น  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 70% · Tier 3
> verify: + normalization + exclusions

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 671-677)**

1. หา H1 ซ้ำข้าม dupEligible — *เหมือน title-duplicate*
2. ใช้ dupGroups helper — *ความสม่ำเสมอ*

เกณฑ์ตัดสิน:
- H1 ซ้ำ → ควรแก้

**WHAT — ตรวจอะไร**

หลายหน้าใช้ <h1> เดียวกัน ทั้งที่เนื้อหาแต่ละหน้าต่างกัน

**WHY — ทำไมต้องตรวจ**

Duplicate <h1> ส่งสัญญาณว่าหน้าไม่มีตัวตนเฉพาะ ลดความสามารถของ Search Engine ในการแยกหน้า

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 170-176)**

1. ตรวจว่า H1 มี CSS ซ่อน (display:none / visibility:hidden) — *Google ตัดสิน hidden text = manipulation*

เกณฑ์ตัดสิน:
- พบ H1 ซ่อน → ควรแก้

**WHAT — ตรวจอะไร**

<h1> มีอยู่แต่ถูกซ่อนจากการมองเห็นด้วยตา (ใช้ display:none หรือ visibility:hidden)

**WHY — ทำไมต้องตรวจ**

Search Engine อาจมองว่าเป็นการพยายามหลอก hidden <h1> ไม่ช่วยผู้ใช้หรือความเข้าใจระดับเครื่องจักร

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 194-199)**

1. ตรวจลำดับ heading: H1→H2→H3 — *Screen reader และ AI อ่านโครงสร้างจากนี้*

เกณฑ์ตัดสิน:
- ข้ามระดับ → ควรแก้

**WHAT — ตรวจอะไร**

ลำดับพาดหัว (heading hierarchy) ไม่เรียงตามระดับ เช่นมี <h1> แล้ว <h3> โดยข้าม <h2>

**WHY — ทำไมต้องตรวจ**

ลำดับพาดหัวที่สมเหตุสมผลช่วยให้ Search Engine และผู้ใช้พิการเข้าใจโครงสร้างเนื้อหา ลำดับผิดอาจทำให้อ่านและจัดอันดับยากขึ้น

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [WCAG 2.1: Headings and Labels (2.4.6)](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)


### heading ว่างเปล่า

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 680-681)**

1. ตรวจ h1-h6 tag ว่างเปล่า — *ไม่มีข้อมูล*

เกณฑ์ตัดสิน:
- มี heading ว่าง → ควรแก้

**WHAT — ตรวจอะไร**

มีพาดหัว (<h1>, <h2> ฯลฯ) ที่ว่างเปล่า ไม่มีข้อความ

**WHY — ทำไมต้องตรวจ**

พาดหัวว่างไม่ได้บอกข้อมูลใด ทำให้โครงสร้างเนื้อหาดูขาดการเชื่อมโยง ลดคุณภาพ HTML semantic

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [WCAG 2.1: Headings and Labels (2.4.6)](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)


## Content

### เนื้อหาบาง (thin)

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 201-202)**

1. นับจำนวนคำทั้งหมดในหน้า — *เนื้อหาหนา = ลุ้นลงชัดกว่า*
2. ตรวจว่าต่ำกว่า 150 คำ — *หน้า 100-150 คำถูกถือว่าบาง*

เกณฑ์ตัดสิน:
- < 150 คำ → ควรแก้

**WHAT — ตรวจอะไร**

หน้าที่มีเนื้อความน้อยกว่า 150 คำ ขาดข้อมูลที่ลึกลงไปในหัวข้อ

**WHY — ทำไมต้องตรวจ**

Search Engine ชอบเนื้อหาที่ครอบคลุมหัวข้อได้อย่างสมบูรณ์ เนื้อหาเบามักอยู่ด้านล่างสุดในอันดับผลการค้นหา

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)


### ปี copyright เก่า

`On-Page` · ความเชื่อมั่น 60% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 719-721)**

1. หาปี copyright ล่าสุด — *ปีเก่า = สัญญาณ เว็บร้าง*
2. หากปี < ปัจจุบัน - 1 = stale — *พอ 1 ปี OK*

เกณฑ์ตัดสิน:
- ปี < ปัจจุบัน - 1 → ควรแก้

**WHAT — ตรวจอะไร**

ปีลิขสิทธิ์ (copyright year) เก่าเกินวันที่โดดเด่น ตัวอย่างเช่น © 2020 อยู่ปี 2025

**WHY — ทำไมต้องตรวจ**

ปีลิขสิทธิ์เก่าส่งสัญญาณว่าเว็บถูกทิ้งร้างหรืออัปเดตไม่บ่อย ลดความเชื่อถือและ E-E-A-T (Expertise-Authoritativeness-Trustworthiness) ในสายตา Search Engine

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)


## HTML Document

### ไม่มี lang ใน <html>

`On-Page` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 204-207)**

1. หา attribute lang ใน html — *Google และ accessibility ใช้ระบุภาษา*

เกณฑ์ตัดสิน:
- ไม่มี lang → ควรแก้

**WHAT — ตรวจอะไร**

หน้า HTML ไม่ได้ระบุรหัสภาษา (lang attribute) เช่น lang='th' สำหรับภาษาไทย

**WHY — ทำไมต้องตรวจ**

Search Engine และเบราว์เซอร์ใช้ lang attribute เพื่อแสดงผลถูกต้อง และเสนอแปลภาษาหากจำเป็น การไม่ระบุอาจนำไปสู่การแสดงผลผิดพลาด

**อ้างอิง:** [HTML Standard: the lang attribute](https://html.spec.whatwg.org/multipage/dom.html#the-lang-and-xml:lang-attributes) · [WCAG 2.1: Language of Page (3.1.1)](https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html)


### ไม่มี viewport

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 209-212)**

1. หา meta name viewport — *Google ใช้ mobile-first indexing*

เกณฑ์ตัดสิน:
- ไม่มี → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

หน้าไม่มี <meta name='viewport'> mobile หน้าดูเล็กต้องซูม

**WHY — ทำไมต้องตรวจ**

Viewport meta ช่วยให้หน้า responsive ขาด user ต้องซูม ยาก mobile search arank ลด

**อ้างอิง:** [Google: Mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing) · [MDN: Viewport meta tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)


### viewport ห้ามซูม

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 214-215)**

1. ตรวจค่า viewport มี maximum-scale=1 หรือ user-scalable=no — *ค่าเหล่านี้ห้ามผู้ใช้ซูม = เสีย accessibility*

เกณฑ์ตัดสิน:
- มี restriction → ควรแก้

**WHAT — ตรวจอะไร**

<meta name='viewport'> ขีด user-scalable=no ห้ามผู้ใช้ zoom

**WHY — ทำไมต้องตรวจ**

Prohibit zoom ทำให้สายตาแย่ ผู้สูงอายุไม่อ่านได้ accessibility fail

**อ้างอิง:** [WCAG 2.1: Resize Text (1.4.4)](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html) · [MDN: Viewport meta tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)


### ไม่มี favicon

`On-Page` · ความเชื่อมั่น 75% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 217)**

1. หา link rel="icon" ที่ homepage — *Favicon แสดงใน SERP มือถือ*

เกณฑ์ตัดสิน:
- ไม่มี → ควรแก้

**WHAT — ตรวจอะไร**

เว็บไม่มี favicon.ico icon เล็ก tab browser bookmark

**WHY — ทำไมต้องตรวจ**

Favicon เล็กบอกมือ branding multi-tab user หาเว็บเราเจอ ขาด UX polish

**อ้างอิง:** [Google: Define a favicon](https://developers.google.com/search/docs/appearance/favicon-in-search)


### favicon ไฟล์ผิด

`On-Page` · ความเชื่อมั่น 70% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 775)**

1. ตรวจ /favicon.ico ตอบ status — *crawler บางตัว request favicon*

เกณฑ์ตัดสิน:
- >= 400 → ควรแก้

**WHAT — ตรวจอะไร**

หน้า link favicon แต่ file ไม่มี 404 หรือ path ผิด

**WHY — ทำไมต้องตรวจ**

Favicon broken icon tab แตกหรือว่าง ลด UX polish

**อ้างอิง:** [Google: Define a favicon](https://developers.google.com/search/docs/appearance/favicon-in-search)


### ไม่มี doctype

`On-Page` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 653-654)**

1. ตรวจ DOCTYPE html บรรทัดแรก — *ไม่มี = quirks mode ผล render เพี้ยน*

เกณฑ์ตัดสิน:
- ไม่มี doctype → ควรแก้

**WHAT — ตรวจอะไร**

HTML ไม่มี <!DOCTYPE html> ประกาศบรรทัดแรก

**WHY — ทำไมต้องตรวจ**

DOCTYPE หายเบราว์เซอร์อาจ quirks mode render เพี้ยน ซ่อน CSS JS ไม่ทำงาน

**อ้างอิง:** [HTML Standard: the DOCTYPE](https://html.spec.whatwg.org/multipage/syntax.html#the-doctype)


### charset ไม่ใช่ UTF-8

`On-Page` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 642-649)**

1. ตรวจ charset ที่ detect — *Google แนะนำ UTF-8*

เกณฑ์ตัดสิน:
- ไม่ใช่ UTF-8 → ควรแก้

**WHAT — ตรวจอะไร**

หน้า <meta charset> ไม่ UTF-8 หรือไม่ set ไทย render mojibake

**WHY — ทำไมต้องตรวจ**

Charset ผิด ภาษาไทยกลายตัวประหลาด user ไม่อ่าน Google ไม่เข้าใจ

**อ้างอิง:** [WHATWG: Encoding Standard](https://encoding.spec.whatwg.org/) · [HTML Standard: charset declaration](https://html.spec.whatwg.org/multipage/semantics.html#charset)


## Markup/Meta

### meta keywords (ล้าสมัย)

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 724-725)**

1. หา meta name keywords — *Google เลิกใช้ตั้งแต่ 2009*

เกณฑ์ตัดสิน:
- มี meta keywords → แจ้งเพื่อทราบ

**WHAT — ตรวจอะไร**

meta keywords คือป้ายรหัสเก่า (deprecated) ที่ใช้ชั่วกับคำหลักเพื่อจัดอันดับ Search Engine ไม่ใช้แล้ว

**WHY — ทำไมต้องตรวจ**

meta keywords ไม่มีผลต่ออันดับหรือความเกี่ยวข้อง ควรเอาออกเพื่อลดสัญญาณรบกวน

**อ้างอิง:** [Google: We don't use the keywords meta tag](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag)


### แท็กเลิกใช้แล้ว

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 657-658)**

1. ตรวจ font, center, marquee — *สัญญาณเว็บเก่า*

เกณฑ์ตัดสิน:
- พบ deprecated tag → ควรแก้

**WHAT — ตรวจอะไร**

HTML ยังใช้ old tag <b> <i> <center> <font> ที่ deprecated

**WHY — ทำไมต้องตรวจ**

Deprecated tag เบราว์เซอร์ใหม่อาจ render เพี้ยน code maintenance ยาก semantic ไม่ชัด

**อ้างอิง:** [HTML Standard: obsolete features](https://html.spec.whatwg.org/multipage/obsolete.html)


## URL

### URL ไม่สะอาด

`On-Page` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 686-689)**

1. ตรวจ URL path มี CamelCase หรือยาวเกิน 115 ตัว — *ไม่เป็นมิตร SEO*

เกณฑ์ตัดสิน:
- มี CapitalLetter หรือ > 115 → ควรแก้

**WHAT — ตรวจอะไร**

URL มีตัวอักษรแปลก parameter ยาว query string ซ้ำซ้อน แล้วไม่อธิบายหัวข้อหน้า

**WHY — ทำไมต้องตรวจ**

URL ที่สะอาด (ตรงสรุป) ช่วยให้ Search Engine เข้าใจหน้า ลดความเสี่ยง duplicate parameter ทำให้ crawl ซ้ำ

**อ้างอิง:** [Google: URL structure best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure) · [RFC 3986: URI Generic Syntax](https://datatracker.ietf.org/doc/html/rfc3986)


# Indexing

## Canonical

### ไม่มี canonical

`Indexing` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 345-367)**

1. หา link rel canonical — *บอก Google ว่าหน้านี้ canonical ของตัวเอง*
2. ถ้าไม่มี canonical ตรวจว่ามี query param หรือ title ซ้ำ — *สัญญาณ duplicate = ต้องแก้*
3. ถ้าไม่มี risk = ต่ำ (Google self-canonical) — *Google ให้ canonical โดยอัตโนมัติ*

เกณฑ์ตัดสิน:
- ไม่มี + มี risk → ผิดร้ายแรง | ไม่มี + ไม่มี risk → ควรแก้

**WHAT — ตรวจอะไร**

rel='canonical' คือป้ายระบุหน้า 'canonical' (ตัวจริง) เมื่อหลาย URL ชี้หน้าเดียว เว็บนี้ไม่มีป้ายนี้

**WHY — ทำไมต้องตรวจ**

Search Engine อาจนับหน้าซ้ำเป็นหน้าหลายหน้า ทำให้คะแนนกระจาย canonical ช่วยให้ Search Engine รวมคะแนนไปยังหน้าจริง

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 665-666)**

1. นับจำนวน link rel canonical — *ต้องเป็น 1 เดียว*

เกณฑ์ตัดสิน:
- > 1 canonical → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

หน้ามี rel='canonical' มากกว่า 1 อัน ชี้ไปต่างหน้า ขัดแย้งต่อ Search Engine

**WHY — ทำไมต้องตรวจ**

Canonical ที่ขัดแย้งกันทำให้ Search Engine ลังเลว่าจะเชื่อป้ายไหน อาจนำไปสู่การจัดอันดับหน้าผิด

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### canonical relative

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 667-668)**

1. ตรวจ canonical value เป็น relative หรือ absolute — *ต้อง absolute เต็ม*

เกณฑ์ตัดสิน:
- relative URL → ควรแก้

**WHAT — ตรวจอะไร**

rel='canonical' ใช้ URL สัมพัทธ์ (เช่น /page.html) แล้วไม่ใช่เต็ม URL (https://example.com/page.html)

**WHY — ทำไมต้องตรวจ**

URL สัมพัทธ์ใน canonical อาจถูกตีความผิดเป็น URL คนละอัน ทำให้ Search Engine ชี้ไปผิดหน้า

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [RFC 6596: The Canonical Link Relation](https://datatracker.ietf.org/doc/html/rfc6596)


## Robots

### ไม่มี robots.txt

`Indexing` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 235-270)**

1. หา robots.txt ที่ URL root — *ช่วยบอก bot ว่าไหนต้อง crawl*

เกณฑ์ตัดสิน:
- ไม่มี robots.txt → ควรแก้

**WHAT — ตรวจอะไร**

robots.txt ไม่มีอยู่ที่รูตของเว็บ ไฟล์นี้บอกวิธี crawling ที่ Google ควรใช้

**WHY — ทำไมต้องตรวจ**

robots.txt ช่วยให้ Search Engine crawl เข้าใจนโยบาย ขาดไปอาจ crawl ไม่มีประสิทธิ

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### robots ไม่ชี้ sitemap

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 268-270)**

1. ตรวจว่า robots.txt มี Sitemap: URL — *ช่วยให้ bot หา URL ครบ*

เกณฑ์ตัดสิน:
- ไม่มี → ควรแก้

**WHAT — ตรวจอะไร**

robots.txt ไม่มี Sitemap: URL บอกที่อยู่ของ XML sitemap ให้ Google

**WHY — ทำไมต้องตรวจ**

Sitemap ช่วยให้ Search Engine หา crawl ครบทุกหน้าเร็วขึ้น ไม่มีอาจ crawl ช้า หน้าใหม่ขึ้นช้า

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html) · [Google: Sitemaps overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)


### robots บล็อกทั้งเว็บ

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 240-242)**

1. ตรวจ robots.txt มี Disallow: / แบบเหมารวม — *ถ้ามี bot จะไม่ crawl อะไรเลย*

เกณฑ์ตัดสิน:
- มี Disallow: / → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

robots.txt มี 'User-agent: * Disallow: /' ห้ามสัญญา Google เข้า crawl เว็บทั้งหมด

**WHY — ทำไมต้องตรวจ**

robots.txt ที่ block ทั้งหมดจะทำให้ Search Engine ไม่เก็บเนื้อหา เว็บจะหายไปจากผลการค้นหา

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### robots บล็อกบางส่วน

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 244-267)**

1. ตรวจว่า robots.txt บล็อก Googlebot หรือ AI crawler จาก /blog, /shop, /service — *หน้าเนื้อหาสำคัญต้องให้ bot เข้าได้*
2. หากบล็อก Googlebot จริง = ร้ายแรง หากบล็อกแค่ AI = ปานกลาง — *Googlebot = traffic หาก AI = GEO*

เกณฑ์ตัดสิน:
- บล็อก Googlebot → ผิดร้ายแรง | บล็อก AI → ควรแก้

**WHAT — ตรวจอะไร**

robots.txt ห้าม Search Engine เข้า crawl บางส่วนของเว็บ (เช่น /admin/, /images/)

**WHY — ทำไมต้องตรวจ**

ถ้าส่วนที่ block คือหน้าสินค้า/บริการสำคัญ หน้าเหล่านั้นจะไม่ขึ้นผลการค้นหา ต้องตรวจสิ่งที่ block อยู่

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### meta robots ผิด

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 321-343)**

1. ตรวจค่า robots meta ใช้ directive ถูกต้องหรือไม่ — *directive ไม่มีจริง Google อาจ ignore*
2. เช่น noindex, nodiy → nodiy ไม่มีจริง — *directive invalid*

เกณฑ์ตัดสิน:
- มี invalid/deprecated directive → ควรแก้

**WHAT — ตรวจอะไร**

meta robots ในหน้ามี syntax ผิดหรือคำสั่งไม่ถูกรู้จัก เช่น 'nondex' แทน 'noindex'

**WHY — ทำไมต้องตรวจ**

Search Engine อาจ ignore หรือตีความผิดคำสั่ง ทำให้หน้าไม่ได้ control ตามต้องการ

**อ้างอิง:** [Google: robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)


### ติด noindex

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 285-319)**

1. หา meta name robots content noindex หรือ X-Robots-Tag header — *บอก Google ห้ามจัดทำดัชนีหน้านี้*
2. จำแนก: utility (login/cart/search) vs เนื้อหา (about/product) — *ตั้งใจบล็อก utility ปกติ แต่เนื้อหาติด noindex = อาจพลาด*
3. ใช้ URL path เป็นเหตุผล — *เดาจาก path pattern*

เกณฑ์ตัดสิน:
- หน้าเนื้อหามี noindex → ควรแก้

ข้อสังเกต: heuristic เดา path pattern อาจผิด.

**WHAT — ตรวจอะไร**

หน้ามี meta robots='noindex' หรือ X-Robots-Tag: noindex ห้ามให้ Search Engine จัดเก็บหน้าในดัชนี

**WHY — ทำไมต้องตรวจ**

noindex ระบายหน้าออกจากผลการค้นหา หากตั้งโดยไม่จำเป็นจะสูญเสียทราฟฟิก

**อ้างอิง:** [Google: Block indexing (noindex)](https://developers.google.com/search/docs/crawling-indexing/block-indexing) · [Google: robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)


## Sitemap

### ไม่มี sitemap

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 273-275)**

1. ตรวจว่ามี sitemap.xml หรือ URL ที่เป็น sitemap — *Google ใช้ sitemap เพื่อหา URL ครบ*

เกณฑ์ตัดสิน:
- ไม่มี sitemap → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

XML Sitemap ไม่มีอยู่ ไฟล์นี้เป็น index รวมทุกหน้า ช่วยให้ Search Engine crawl ครบ

**WHY — ทำไมต้องตรวจ**

Search Engine ต้อง crawl ตามลิงก์แนวหนึ่งหากไม่มี sitemap หน้าใหม่ขึ้นผลการค้นหานาน

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html) · [Google: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)


### sitemap ไม่ครอบคลุม

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 277-283)**

1. เทียบ URL ใน sitemap กับหน้าที่ crawl — *ต้องให้ Google รู้ทุกหน้า*
2. ถ้าหน้า crawl > 30% ไม่อยู่ใน sitemap = ปัญหา — *sitemap ครอบคลุมไม่ได้*

เกณฑ์ตัดสิน:
- ครอบคลุม < 70% → ควรแก้

**WHAT — ตรวจอะไร**

XML Sitemap มีอยู่แต่ไม่รวมหน้าทั้งหมดที่ต้องการจัดอันดับ บางหน้าที่มีจริงไม่อยู่ใน sitemap

**WHY — ทำไมต้องตรวจ**

หน้าที่ไม่อยู่ใน sitemap มีความเสี่ยงถูก Search Engine มองข้าม อาจไม่ขึ้นผลการค้นหา

**อ้างอิง:** [Google: Sitemaps overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)


### sitemap ไม่มี lastmod

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 778-779)**

1. ตรวจ sitemap.xml มี lastmod — *Google ใช้ decide ว่าจะ crawl หน้าไหน*

เกณฑ์ตัดสิน:
- sitemap มี URL แต่ไม่มี lastmod → ควรแก้

**WHAT — ตรวจอะไร**

<lastmod> ใน sitemap ไม่มี (หรือไม่ถูกต้อง) Search Engine ไม่รู้เนื้อหา update เมื่อไหร่

**WHY — ทำไมต้องตรวจ**

lastmod ช่วยให้ Search Engine รู้ว่าหน้าไหน update อยากให้ crawl ซ้ำ เนื้อหาใหม่ขึ้นผลการค้นหาเร็วขึ้น

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html)


## Hreflang

### hreflang ผิด/ไม่มี

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 388-409)**

1. ตรวจ link rel alternate hreflang — *บอก Google ว่าหน้าคู่ภาษา*
2. หากพบ hreflang ตรวจ x-default | หากไม่พบแต่หลายภาษา = ควรใส่ — *x-default บอก ถ้า user ไม่แน่ของภาษา ให้หน้านี้*

เกณฑ์ตัดสิน:
- มี hreflang ไม่มี x-default → ควรแก้ | หลายภาษาไม่มี hreflang → ควรแก้

**WHAT — ตรวจอะไร**

rel='alternate' hreflang ไม่ระบุวิธี Search Engine เลือกรุ่นภาษา/ประเทศสำหรับเว็บ

**WHY — ทำไมต้องตรวจ**

Search Engine อาจเสนอเวอร์ชันผิดภาษา/ประเทศให้ผู้ค้นหา hreflang ช่วย route ให้ถูก

**อ้างอิง:** [Google: Localized versions (hreflang)](https://developers.google.com/search/docs/specialty/international/localized-versions)


## Redirects

### redirect ซ้อน

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 369-370)**

1. ตรวจ redirect chain: A→B→C — *Hop เยอะ = เสีย crawl budget*

เกณฑ์ตัดสิน:
- Chain > 1 hop → ควรแก้

**WHAT — ตรวจอะไร**

URL A → B → C → D ผู้ใช้ต้องตามเด้งหลายขั้น ก่อนถึงเนื้อหาจริง

**WHY — ทำไมต้องตรวจ**

Redirect chain ทำให้ load ช้า crawl เสียเวลา ส่วนน้ำหนัก redirect ลดไปทีละขั้น ควรเด้งตรงไปจุดหมายสุดท้าย

**อ้างอิง:** [Google: Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects) · [RFC 9110: Redirection 3xx](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4)


### trailing slash ไม่นิ่ง

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 691-701)**

1. ตรวจ URL คู่ต่างแค่ trailing slash ตอบ 200 ทั้งคู่ — *duplicate content*

เกณฑ์ตัดสิน:
- พบคู่ → ควรแก้

**WHAT — ตรวจอะไร**

URL มีทั้งแบบมี trailing slash (/path/) และไม่มี (/path) ชี้หน้าเดียวกัน

**WHY — ทำไมต้องตรวจ**

Search Engine อาจนับเป็น 2 URL ต่างกัน ทำให้ duplicate content canonical หรือ redirect แก้ไขต้อง

**อ้างอิง:** [Google: URL structure best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure) · [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### www/non-www ซ้ำ

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 750-772)**

1. ตรวจ www/non-www, http/https variant ตอบ 200 หรือ redirect — *ต้อง consolidate ไป 1 origin*
2. หลาย variant 200 = ต้อง 301 หรือ canonical — *ไม่งั้น Google เสียสัญญาณ*
3. variant ไม่ได้เลย = ผู้ใช้เข้าไม่ได้ — *ต้องแก้*

เกณฑ์ตัดสิน:
- หลาย variant 200 ไม่มี 301 → ผิดร้ายแรง | ขาด variant → ควรแก้

**WHAT — ตรวจอะไร**

เว็บเข้าถึงได้หลาย host variant เช่น example.com, www.example.com, http/https mixed

**WHY — ทำไมต้องตรวจ**

Search Engine อาจมองว่าเป็นเว็บแตกต่างกันที่มี duplicate content คะแนนกระจาย ต้องรวม variant เหลือเพียงหนึ่ง

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### meta refresh redirect

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 661-662)**

1. ตรวจ meta http-equiv refresh redirect — *Google ไม่แนะนำ ใช้ 301*

เกณฑ์ตัดสิน:
- มี meta refresh → ควรแก้

**WHAT — ตรวจอะไร**

<meta http-equiv='refresh'> ใช้ redirect หน้าแบบดั้งเดิม (deprecated)

**WHY — ทำไมต้องตรวจ**

Meta refresh ส่งสัญญาณ redirect ไม่สมบูรณ์ต่อ Search Engine และโหลดช้า ควรใช้ HTTP redirect (301/302) แทน

**อ้างอิง:** [Google: Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects) · [HTML Standard: meta http-equiv refresh](https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-refresh)


## Crawlability

### ถูกบล็อก crawl

`Indexing` · ความเชื่อมั่น 90% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 376-378)**

1. ตรวจ HTTP status 429/403/5xx ที่ crawl — *บ่งชี้บล็อกชั่วคราว/rate-limit*

เกณฑ์ตัดสิน:
- พบ error ชั่วคราว → แจ้งเพื่อทราบ

**อ้างอิง:** [Google: Overview of Google crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### soft 404

`Indexing` · ความเชื่อมั่น 90% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 380-381)**

1. หา URL ที่ไม่มีจริง ตอบ status เท่าไร — *ต้อง 404 ไม่ใช่ 200*

เกณฑ์ตัดสิน:
- ตอบ != 404 (soft 404) → ควรแก้

**WHAT — ตรวจอะไร**

หน้าที่ไม่มี (404) ตอบกลับ HTTP 200 OK หรือ redirect ไปหน้าแรก ไม่บอก Search Engine ว่าหน้าตาย

**WHY — ทำไมต้องตรวจ**

Search Engine crawl เก็บหน้า 404 soft เข้าดัชนีเสียเวลา ใช้ crawl quota ไปเปล่า ลดคุณภาพดัชนี

**อ้างอิง:** [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### หน้า error

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 372-378)**

1. ตรวจ HTTP status บน URL ที่ crawl — *status บอกสถานะ URL*
2. 404/410 = หาย (ถาวร) | 429/403/5xx = ชั่วคราว — *ต้องแยก ก่ายจริง vs ข้อผิดพลาดชั่วคราว*

เกณฑ์ตัดสิน:
- 404/410 → ผิดร้ายแรง | 429/403/5xx → แจ้งเพื่อทราบ

**WHAT — ตรวจอะไร**

หน้าที่ open ได้ แต่ return HTTP 5xx (Server Error) ลูกค้าและ Search Engine เจอข้อผิดพลาด

**WHY — ทำไมต้องตรวจ**

หน้าพัง (5xx) ทำให้ user experience แย่ Search Engine อาจ crawl ตั้งนานและ crawl ซ้ำเพื่อหวัง recover

**อ้างอิง:** [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110) · [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### เข้าหน้าเว็บไม่ได้

`Indexing` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 95-99)**

1. พยายาม crawl หน้า HTML จากเว็บ — *เป็นขั้นแรก ต้องเข้าไปในเว็บได้*
2. ตรวจสอบว่าได้หน้าไหนที่ตอบ HTTP 200 — *หน้า 200 คือหน้าที่เปิดมาได้ปกติ*

เกณฑ์ตัดสิน:
- เมื่อหน้า 200 เป็นศูนย์ → ผิดร้ายแรง

**อ้างอิง:** [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110) · [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


## Duplicate Content

### หน้าซ้ำใกล้เคียง

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 728-738)**

1. เปรียบหน้า 2 หน้า ใช้ Jaccard similarity — *หา content เกือบซ้ำกัน*
2. ถ้า > 85% เหมือน = near-duplicate — *threshold*

เกณฑ์ตัดสิน:
- เปอร์เซ็นต์ > 85% → ควรแก้

ข้อสังเกต: ตรวจแค่ 60 หน้า ไม่ครบทั้งเว็บ.

**WHAT — ตรวจอะไร**

หลายหน้ามีเนื้อหาที่คล้ายกันมากจนแทบไม่แตกต่าง แม้มีความเหลื่อมแตกต่างเล็กน้อย

**WHY — ทำไมต้องตรวจ**

Search Engine ลงโทษ near-duplicate content โดยเลือกแสดงเพียงหน้าเดียว หน้าอื่นๆ จะลดความมองเห็นหรือไม่ขึ้นเลย

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL` · `Canonical`

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [Moz: Duplicate content](https://moz.com/learn/seo/duplicate-content)


## Internal Links

### ลิงก์เสีย (hard)

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 476-480)**

1. ตรวจ internal link (href) ชี้ไปที่ URL ไหน — *ลิงก์เสีย = ไม่มีหน้า landing*
2. 404/410 = เสียจริง | 429/403/5xx = ชั่วคราว — *ต้องแยก permanent vs temporary*

เกณฑ์ตัดสิน:
- 404/410 → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

ลิงก์ internal ที่ชี้ไปหน้า 404 หรือหน้าที่ error user กดแล้วเจอหน้าพัง

**WHY — ทำไมต้องตรวจ**

Broken link ส่งสัญญาณให้ Search Engine ว่าเว็บดูแลไม่ดี เสียประสบการณ์ user broken link ยังเปลืองความพยายาม crawl

**อ้างอิง:** [RFC 9110: 404 Not Found](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.5) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### ลิงก์เสีย (soft)

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 481)**

1. ตรวจลิงก์ที่ตอบ 429/403/5xx — *อาจชั่วคราว*

เกณฑ์ตัดสิน:
- พบ soft error → แจ้งเพื่อทราบ

**อ้างอิง:** [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### หน้ากำพร้า

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 741-747)**

1. หาหน้าที่ไม่มี internal link ชี้เข้า — *เข้าได้จาก sitemap เท่านั้น = ไม่ได้ link equity*
2. crawled page มี internal link ไป = มี inlink — *กลับกัน*

เกณฑ์ตัดสิน:
- พบ orphan → ควรแก้

**WHAT — ตรวจอะไร**

หน้ามีอยู่แต่ไม่มีลิงก์อื่นในเว็บชี้มา isolated orphan หน้า

**WHY — ทำไมต้องตรวจ**

ไม่มีลิงก์ internal ทำให้ Search Engine และผู้ใช้หาหน้าได้ยาก ควรเชื่อมลิงก์ internal

**อ้างอิง:** [Ahrefs: Orphan pages](https://ahrefs.com/blog/orphan-pages/) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### internal link น้อย

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 492-493)**

1. นับ internal link ในแต่ละหน้า — *ต้อง 3 ลิงก์ขึ้นไป เพื่อ crawl budget*

เกณฑ์ตัดสิน:
- < 3 internal link → ควรแก้

**WHAT — ตรวจอะไร**

เว็บมีลิงก์ internal น้อยโดยเป็นไป หน้าต่างๆ แยกตัวไม่เชื่อมกัน

**WHY — ทำไมต้องตรวจ**

Internal linking ช่วยให้ user browse ต่อ เพิ่มโอกาสแปลง ช่วยให้ Search Engine ไหลคะแนนไปหน้าสำคัญ

**อ้างอิง:** [Ahrefs: Internal links for SEO](https://ahrefs.com/blog/internal-links-for-seo/) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### anchor ว่าง

`Indexing` · ความเชื่อมั่น 85% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 483-485)**

1. ตรวจ a tag ไม่มี text ไม่มี aria-label — *AI และ screen reader ต้องรู้ลิงก์ไปไหน*

เกณฑ์ตัดสิน:
- พบ anchor ว่างเปล่า → ควรแก้

**WHAT — ตรวจอะไร**

ลิงก์ <a> tag มี href แต่ <a> ว่างเปล่า หรือบอกเพียง icon ไม่มีข้อความ

**WHY — ทำไมต้องตรวจ**

User ที่ใช้ screen reader ไม่รู้ลิงก์ไปไหน Search Engine ไม่รู้ context ลิงก์ ลิงก์ไม่ช่วยอันดับ

**อ้างอิง:** [WCAG 2.1: Link Purpose (2.4.4)](https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### anchor กว้างไป

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 487-490)**

1. ตรวจ anchor text ใช้คำ generic: read more, click here — *Google ไม่รู้ลิงก์ไปเอกสารอะไร*

เกณฑ์ตัดสิน:
- หน้ามี generic anchor > 2 → ควรแก้

**WHAT — ตรวจอะไร**

Anchor text เป็นคำกำกวม เช่น 'click here' 'more' 'read more' ซ้ำๆ ไม่บอก content หน้าปลายทาง

**WHY — ทำไมต้องตรวจ**

Anchor text ให้บริบท Search Engine เกี่ยวกับหน้าปลายทาง generic anchor ไม่ให้ข้อมูล ลดคะแนนลิงก์

**อ้างอิง:** [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) · [Ahrefs: Anchor text](https://ahrefs.com/blog/anchor-text/)


# Schema

## JSON-LD

### ไม่มี JSON-LD

`Schema` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 414-417)**

1. หา script type application/ld+json — *Structured data ช่วย Google เข้าใจ*

เกณฑ์ตัดสิน:
- 0 หน้า → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

Structured Data (JSON-LD) ไม่มีบอกว่า องค์ประกอบคือสินค้า องค์กร รีวิว ฯลฯ

**WHY — ทำไมต้องตรวจ**

Structured Data ช่วยให้ Search Engine เข้าใจ content type เพื่อเสนอรูปแบบผลค้นหาพิเศษ (ดาว ราคา รูป) ส่วน AI ต้องใช้ structured data เพื่อตอบเฉพาะเจาะจง

**อ้างอิง:** [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) · [Schema.org](https://schema.org/) · [W3C: JSON-LD 1.1](https://www.w3.org/TR/json-ld11/)


### JSON-LD ผิดรูปแบบ

`Schema` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 419-420)**

1. ตรวจ syntax JSON — *Google ต้อง parse JSON ได้*

เกณฑ์ตัดสิน:
- JSON ไม่ valid → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

Structured Data (JSON-LD) มีแต่ syntax ผิด ข้อมูลไม่ตรงรูปแบบ Google อ่านไม่ได้

**WHY — ทำไมต้องตรวจ**

JSON-LD ที่ผิด Search Engine ignore และอาจ warn เสียโอกาสผลค้นหาพิเศษ

**อ้างอิง:** [W3C: JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) · [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)


## Structured Data

### Organization schema

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 428-430)**

1. ตรวจ JSON-LD มี @type Organization/LocalBusiness/Corporation — *Google ใช้ระบุธุรกิจ + Knowledge Panel*

เกณฑ์ตัดสิน:
- ไม่มี → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

Organization schema ไม่มี บอก Google/AI เกี่ยวกับชื่อบริษัท โลโก้ ที่อยู่ ติดต่อ media โซเชียล

**WHY — ทำไมต้องตรวจ**

Search Engine และ AI ใช้ Organization schema รู้จักตัวตนแบรนด์ แสดง Knowledge Panel ตอบ AI ถามเกี่ยวกับบริษัท

**อ้างอิง:** [Google: Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization) · [Schema.org: Organization](https://schema.org/Organization)


### Breadcrumb schema

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 431-433)**

1. ตรวจ JSON-LD มี @type BreadcrumbList — *Breadcrumb ใน SERP ช่วย CTR*

เกณฑ์ตัดสิน:
- ไม่มี → ควรแก้

**WHAT — ตรวจอะไร**

Breadcrumb schema ไม่มี บอก Search Engine เส้นทางลำดับชั้น (หน้าแรก › หมวด › เพจปัจจุบัน)

**WHY — ทำไมต้องตรวจ**

Breadcrumb schema ช่วยให้ Search Engine เข้าใจโครงสร้างเว็บ ผลค้นหาอาจแสดง breadcrumb ช่วย UX

**อ้างอิง:** [Google: Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) · [Schema.org: BreadcrumbList](https://schema.org/BreadcrumbList)


### schema ไม่ครบ field

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 436-461)**

1. ตรวจ JSON-LD ไม่มี required property — *ถ้าขาด required = Google ไม่ยอมใช้ rich result*
2. หากขาด recommended property = warn — *ช่วยให้ rich result ต่างกว่า*

เกณฑ์ตัดสิน:
- ขาด required → ผิดร้ายแรง | ขาด recommended → ควรแก้

**WHAT — ตรวจอะไร**

Structured Data มีแต่ข้อมูลไม่ครบตามรูปแบบ เช่น Product schema แต่ขาด price availability

**WHY — ทำไมต้องตรวจ**

Incomplete schema Google อาจ ignore ผลค้นหาพิเศษ ต้อง complete schema ตามมาตรฐาน

**อ้างอิง:** [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) · [Schema.org](https://schema.org/)


## Social Cards

### Open Graph

`Schema` · ความเชื่อมั่น 80% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 464-467)**

1. หา meta property og:title และ og:image — *เมื่อแชร์บน social/LINE ต้องมีรูปและชื่อ*

เกณฑ์ตัดสิน:
- ไม่มี og:title หรือ og:image → ควรแก้

**WHAT — ตรวจอะไร**

Open Graph meta tags ไม่ครบ (og:title og:description og:image) เมื่อ share ลิงก์บน Facebook LINE X ขึ้นไม่ดี

**WHY — ทำไมต้องตรวจ**

Open Graph ควบคุมรูป ชื่อ คำอธิบายเมื่อ share ไม่มี/ผิดจะขึ้นรูปหรือข้อความแบบ default นำไปสู่ลดการกดจาก social share

**อ้างอิง:** [The Open Graph protocol](https://ogp.me/)


### og:image เป็น relative

`Schema` · ความเชื่อมั่น 80% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 782-783)**

1. ตรวจ og:image value เป็น absolute หรือ relative — *Facebook/LINE ต้อง absolute*

เกณฑ์ตัดสิน:
- relative URL → ควรแก้

**WHAT — ตรวจอะไร**

og:image ใช้ URL สัมพัทธ์ (/image.jpg) ไม่เต็ม (https://example.com/image.jpg) platform social หารูปไม่เจอ

**WHY — ทำไมต้องตรวจ**

Social platform ต้อง URL เต็มหารูป URL สัมพัทธ์ทำให้รูปไม่ขึ้นเมื่อ share

**อ้างอิง:** [The Open Graph protocol](https://ogp.me/)


### Twitter Card

`Schema` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 469-470)**

1. หา meta name twitter:card — *Twitter preview ของ URL*

เกณฑ์ตัดสิน:
- ไม่มี → ควรแก้

**WHAT — ตรวจอะไร**

Twitter Card meta tags ไม่มีหรือไม่สมบูรณ์ (twitter:card twitter:image) เมื่อ share บน X (Twitter) ไม่ขึ้นเป็นการ์ด

**WHY — ทำไมต้องตรวจ**

Twitter Card ทำให้ link บน X ดูเป็นมืออาชีพ เพิ่มอัตราการกดจาก social

**อ้างอิง:** [X Developer Docs (Cards)](https://docs.x.com/overview)


# Security

## HTTPS / TLS

### ไม่ใช่ HTTPS

`Security` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 222-224)**

1. ตรวจว่า origin ใช้ https:// ไหม — *Google ต้องการเว็บปลอดภัย*

เกณฑ์ตัดสิน:
- HTTP ธรรมดา → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

เว็บใช้ HTTP บางหน้าไม่มี SSL certificate ไม่เข้ารหัส ไม่ปลอดภัย

**WHY — ทำไมต้องตรวจ**

HTTPS ป้องกัน man-in-the-middle browser ยื่นเตือน red user ไม่กล้ากรอก data Google ลดอันดับ HTTP

**อ้างอิง:** [Google: HTTPS as a ranking signal](https://developers.google.com/search/blog/2014/08/https-as-ranking-signal) · [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110)


### SSL chain ไม่ครบ

`Security` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 229-232)**

1. ตรวจว่า certificate ส่งมาครบ chain — *ไคลเอนต์เข้มงวด (bot/มือถือ) จะปฏิเสธ*

เกณฑ์ตัดสิน:
- ขาด intermediate → ผิดร้ายแรง

**อ้างอิง:** [RFC 8446: TLS 1.3](https://datatracker.ietf.org/doc/html/rfc8446) · [MDN: Transport Layer Security](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security)


### mixed content

`Security` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 383-386)**

1. ตรวจ HTTPS page มี resource แบบ http:// — *เบราว์เซอร์บล็อก mixed content*

เกณฑ์ตัดสิน:
- พบ http resource → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

หน้า HTTPS แต่ load บาง resource (image script style) จาก HTTP source ไม่ปลอดภัย

**WHY — ทำไมต้องตรวจ**

Mixed content browser block ส่วน HTTP page พังแสดง trust ลด arank ลด

**อ้างอิง:** [W3C: Mixed Content](https://www.w3.org/TR/mixed-content/) · [MDN: Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)


## Security Headers

### ขาด security headers

`Security` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 583-594)**

1. ตรวจหมดหน้าแรก มี security headers — *ปกป้อง downgrade attack / MIME sniffing / clickjacking*

เกณฑ์ตัดสิน:
- ขาด header > 0 → ควรแก้

**WHAT — ตรวจอะไร**

Server ไม่ set security header (CSP X-Frame-Options X-Content-Type-Options HSTS) ป้องกัน attack แพท

**WHY — ทำไมต้องตรวจ**

Security header ป้องกัน XSS clickjacking MIME sniffing threat เพิ่ม trust signal

**อ้างอิง:** [MDN: HTTP headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers) · [OWASP: Secure Headers Project](https://owasp.org/www-project-secure-headers/)


# Performance

## Speed

### TTFB ช้า

`Performance` · ความเชื่อมั่น 90% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 575-576)**

1. วัด time to first byte (TTFB) — *ถ้า > 3 วินาที = slow*

เกณฑ์ตัดสิน:
- > 3 วินาที → ควรแก้

**WHAT — ตรวจอะไร**

TTFB (Time To First Byte) ช้า server ตอบกลับนาน ก่อนเบราว์เซอร์เริ่ม download resource

**WHY — ทำไมต้องตรวจ**

TTFB ช้า ส่ง signal ว่า server หรือ infrastructure อ่อนแอ load นานๆ เสื่อมอันดับ user กดออก

**อ้างอิง:** [web.dev: Time to First Byte (TTFB)](https://web.dev/articles/ttfb) · [Google: Core Web Vitals report](https://developers.google.com/search/docs/appearance/core-web-vitals)


## Payload

### ไม่บีบอัด (gzip/br)

`Performance` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 570-573)**

1. ตรวจ content-encoding header (gzip/brotli) — *ลดขนาด data = หน้าโหลดเร็ว*

เกณฑ์ตัดสิน:
- ทุกหน้าไม่มี compression → ควรแก้

**WHAT — ตรวจอะไร**

Server ไม่เปิด gzip/brotli compression โดยส่ง HTML CSS JS ขนาดเต็ม

**WHY — ทำไมต้องตรวจ**

Compression ลด file size ส่ง 50-80% เทียบจากดั้งเดิม เพิ่มความเร็ว ประหยัด bandwidth ไม่ต้องเปลี่ยน code

**อ้างอิง:** [Lighthouse: Enable text compression](https://developer.chrome.com/docs/lighthouse/performance/uses-text-compression)


### HTML ใหญ่เกิน

`Performance` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 564-565)**

1. วัด HTML file size — *HTML > 500KB = เสีย download*

เกณฑ์ตัดสิน:
- > 500KB → ควรแก้

**WHAT — ตรวจอะไร**

HTML document ขนาดใหญ่มากจนมีหลักเมกะไบต์ ส่งผลให้ download parse ช้า

**WHY — ทำไมต้องตรวจ**

หน้าหนักทำให้ load ช้า โดยเฉพาะ slow network ลด Core Web Vitals score ลดอันดับ

**อ้างอิง:** [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


### inline CSS/JS เยอะ

`Performance` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 578-579)**

1. วัด inline script และ style รวมกัน — *inline > 200KB = payload ใหญ่*

เกณฑ์ตัดสิน:
- > 200KB inline → ควรแก้

**WHAT — ตรวจอะไร**

CSS JavaScript เขียนผสมในหน้า HTML (<style> <script> inline) เยอะมาก ไม่แยกเป็นไฟล์ต่างหาก

**WHY — ทำไมต้องตรวจ**

Inline code ให้เบราว์เซอร์ cache ไม่ได้ทุกหน้า inline ทำให้หน้าหนักเพิ่ม ลดสิ่ง cache ประโยชน์

**อ้างอิง:** [Lighthouse: Eliminate render-blocking resources](https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources) · [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


### script เยอะ

`Performance` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 567-568)**

1. นับจำนวน script src — *สคริปต์เยอะ = เสีย LCP/INP*

เกณฑ์ตัดสิน:
- > 25 script → ควรแก้

**WHAT — ตรวจอะไร**

หน้า load script จำนวนมากติดต่อกัน ผู้ใช้ต้องรอ parse execute script ก่อน interact

**WHY — ทำไมต้องตรวจ**

Script เยอะทำให้ main thread ยุ่ง load ช้า INP สูง page ใช้งานได้ช้า

**อ้างอิง:** [Lighthouse: Avoid an excessive DOM size](https://developer.chrome.com/docs/lighthouse/performance/dom-size)


### อัตรา text:HTML ต่ำ

`Performance` · ความเชื่อมั่น 60% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 715-716)**

1. คำนวณ text / HTML size ratio เมื่อ HTML > 60KB — *ratio < 8% = โค้ดบวม*

เกณฑ์ตัดสิน:
- < 8% ratio + > 60KB → ควรแก้

**WHAT — ตรวจอะไร**

สัดส่วนเนื้อความที่มนุษย์อ่านได้ต่อโค้ดรวมของหน้า (HTML, CSS, JavaScript) เนื้อความต่ำมากแม้ขนาดไฟล์หนัก

**WHY — ทำไมต้องตรวจ**

หน้าที่มีสัดส่วนเนื้อความต่ำ Load ช้าและจัดอันดับต่ำกว่า Search Engine ชอบหน้าที่เนื้อความมากขึ้น

**อ้างอิง:** [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


## Render-blocking

### blocking ใน <head>

`Performance` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 711-712)**

1. นับ script src ใน head ไม่มี defer/async — *blocking script = เบราว์เซอร์หยุด render*

เกณฑ์ตัดสิน:
- > 2 blocking script ใน head → ควรแก้

**WHAT — ตรวจอะไร**

<head> มี <script> <link> render-blocking ที่ block display จนกว่า resource load เสร็จ

**WHY — ทำไมต้องตรวจ**

Render-blocking resource ใน <head> ทำให้คน whitespace นาน ก่อนเนื้อหาแสดง critical perceived load time

**อ้างอิง:** [Lighthouse: Eliminate render-blocking resources](https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources)


### third-party เยอะ

`Performance` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 703-708)**

1. นับ third-party script — *เยอะ = เสีย INP privacy*

เกณฑ์ตัดสิน:
- > 8 third-party โดเมน → ควรแก้

**WHAT — ตรวจอะไร**

หน้า load code จากบริการนอก (ads chat analytics widget) เยอะมาก เราควบคุมความเร็วไม่ได้

**WHY — ทำไมต้องตรวจ**

Third-party code ความเร็วไม่ได้ control ถ้า service อื่นช้า load นานๆ ของเรา ลด performance

**อ้างอิง:** [Lighthouse: Reduce third-party impact](https://developer.chrome.com/docs/lighthouse/performance/third-party-summary)


# Media / Links

## Images

### รูปไม่มี alt

`Media / Links` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 504-548)**

1. ตรวจรูปที่แสดงจริง (ใช้ rendered DOM ถ้ามี) — *ต้องแยก รูปที่โชว์ vs รูปที่ซ่อน*
2. หา alt attribute หรือ aria-label หรือ role=presentation — *ทั้ง 3 หมายถึง อธิบายแล้ว*
3. ไม่มี alt = fail | alt = warn (อาจรูปประดับ) — *ต้องแบ่งเคส*

เกณฑ์ตัดสิน:
- โชว์จริง + ไม่มี alt → ผิดร้ายแรง | โชว์จริง + alt → ควรแก้

ข้อสังเกต: alt ambiguous เพราะต้องคนดูยืนยัน.

**WHAT — ตรวจอะไร**

ภาพไม่มี alt attribute บรรยายว่าภาพคืออะไร

**WHY — ทำไมต้องตรวจ**

alt text ช่วยให้ภาพขึ้น Google Images ผู้พิการที่ใช้ screen reader เข้าใจภาพ ขาดจะเสีย traffic จากรูป และเข้าถึง

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 555-558)**

1. ตรวจรูปมี width/height attribute — *ไม่มี = layout shift (CLS แย่)*

เกณฑ์ตัดสิน:
- 50% + > 5 รูป ไม่มี dimensions → ควรแก้

**WHAT — ตรวจอะไร**

ภาพไม่ระบุ width height ในโค้ด เวลา load เนื้อหากระโดดขยับ

**WHY — ทำไมต้องตรวจ**

ระบุ dimension ภาพให้เบราว์เซอร์ reserve space ลด layout shift ลดทีให้ layout shift penalty และอะไร user

**อ้างอิง:** [HTML Standard: dimension attributes](https://html.spec.whatwg.org/multipage/embedded-content-other.html#dimension-attributes) · [Google: Core Web Vitals report](https://developers.google.com/search/docs/appearance/core-web-vitals)


### ไม่ lazy-load

`Media / Links` · ความเชื่อมั่น 75% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 551-554)**

1. นับรูปที่ไม่มี loading="lazy" — *รูปด้านล่างหน้า ควร lazy load*

เกณฑ์ตัดสิน:
- 70% + > 5 รูป ไม่มี lazy → ควรแก้

**WHAT — ตรวจอะไร**

ภาพ loading ทั้งหมดตั้งแต่ load หน้า แม้ยังไม่เห็นจอ

**WHY — ทำไมต้องตรวจ**

Lazy load ภาพลดขนาด download ครั้งแรก ทำให้ load เร็วขึ้น โดยเฉพาะ mobile

**อ้างอิง:** [HTML Standard: lazy-loading attribute](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#lazy-loading-attributes) · [MDN: Lazy loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading)


## Rendering

### raw ≠ rendered

`Media / Links` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 611-633)**

1. เปรียบ raw HTML vs rendered (headless Chrome) — *ต้องแยก Google เห็น vs AI bot เห็น*
2. หากแตกต่างชัด = fail — *สิ่งที่ Google crawl ≠ สิ่งที่ AI bot เห็น*

เกณฑ์ตัดสิน:
- ต่างกันชัด → ผิดร้ายแรง | ตรงกัน → ผ่าน

**WHAT — ตรวจอะไร**

HTML เบื้องต้นกับ render สุดท้าย (หลัง JS) ต่างกันมาก เนื้อหาสำคัญ render ทีหลัง

**WHY — ทำไมต้องตรวจ**

Google render ได้ แต่ AI bots ไม่รอ render เนื้อหา SSR ไม่ขึ้น AI เสีย context สำหรับ AI answer

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)


### SPA shell ว่าง

`Media / Links` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 599-609)**

1. ตรวจ root container ว่างเปล่า — *CSR = เนื้อหา render บน client*
2. ว่าง = SPA | ไม่ว่าง = SSR — *ต้องแยก*

เกณฑ์ตัดสิน:
- SPA + empty root → ผิดร้ายแรง | SSR + เนื้อหาครบ → ผ่าน

**WHAT — ตรวจอะไร**

เว็บสร้างแบบ SPA (Single Page App) server ส่ง HTML shell ว่างเปล่า เนื้อหา load ด้วย JS ที่ client

**WHY — ทำไมต้องตรวจ**

Search Engine รอ JS render ได้ แต่ AI bots (ChatGPT Claude) เยอะ crawler render HTML ไม่รอ SPA โหลด โรคว่างเปล่า

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)


### ไม่มี noscript fallback

`Media / Links` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 635-636)**

1. ตรวจ noscript tag เมื่อ SPA — *ผู้ใช้ปิด JS อ่านอะไร*

เกณฑ์ตัดสิน:
- SPA ไม่มี noscript → ควรแก้

**WHAT — ตรวจอะไร**

เว็บ JS-heavy แต่ไม่มี <noscript> fallback เนื้อหาเมื่อ JS disable หรือ fail load

**WHY — ทำไมต้องตรวจ**

JS fail load ผู้ใช้ crawler ไม่รัน JS เจอหน้าว่าง เสีย UX เสีย indexability เสีย AI citability

**อ้างอิง:** [HTML Standard: the noscript element](https://html.spec.whatwg.org/multipage/scripting.html#the-noscript-element) · [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)


# GEO (AI Search)

## llms.txt

### ไม่มี llms.txt

`GEO (AI Search)` · ความเชื่อมั่น 60% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 84-89)**

1. ตรวจว่ามีไฟล์ /llms.txt หรือไม่ — *เพื่อดูว่าเว็บบอก AI engine ว่าสามารถใช้เนื้อหาได้*
2. อธิบายความจำเป็นของ llms.txt — *เพื่อให้เจ้าของเว็บรู้ว่านี่ไม่เป็นปัจจัย SEO ที่สำคัญ*

เกณฑ์ตัดสิน:
- ถ้ามี llms.txt → แจ้งเพื่อทราบ (ดี แต่ไม่ส่งผลอันดับ)
- ถ้าไม่มี → แจ้งเพื่อทราบ (ไม่ใช่ปัญหา)

**WHAT — ตรวจอะไร**

llms.txt ไม่มี (file /robots-llm.txt หรือ /.well-known/llms.txt ที่สรุปเว็บ ให้ AI อ่าน)

**WHY — ทำไมต้องตรวจ**

llms.txt standard ใหม่ AI ชอบ complete info เว็บ ทำให้ AI context ชัด อ้างอิงถูก

**อ้างอิง:** [The /llms.txt proposal](https://llmstxt.org/)


## AI Crawler

### AI bot เข้าได้ไหม

`GEO (AI Search)` · ความเชื่อมั่น 75% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 49-82)**

1. อ่านไฟล์ robots.txt เพื่อดูว่า AI bot ไหนถูกบล็อก — *เพื่อรู้ว่าเว็บช่วยให้ AI สามารถครอล (อ่าน) เนื้อหาได้หรือไม่*
2. รวมเก็บ path ที่เว็บปฏิเสธ AI bot ทั้งหมด — *เพื่อดูว่า bot ไหนถูกกั้น และที่ไหนของเว็บถูกกั้น*
3. ตรวจว่า root (/) ถูกบล็อกหรือแค่บาง section — *เพื่อเข้าใจความร้ายแรง — ทั้งเว็บกับแค่ส่วนนั้ง*

เกณฑ์ตัดสิน:
- ถ้าบล็อก root → ร้ายแรง (ผิด)
- ถ้าบล็อกเฉพาะ section → เตือน (ควรแก้)
- ถ้า bot ทั้งหมดผ่าน → ผ่าน

ข้อสังเกต: ไม่เช็ค HTTP headers (Disallow-Agent) แค่ robots.txt

**WHAT — ตรวจอะไร**

ตรวจว่า robots.txt meta robots allow GPTBot ClaudeBot PerplexityBot Googlebot-Extended อ่าน

**WHY — ทำไมต้องตรวจ**

Block AI bots จาก robots.txt AI search ไม่มีข้อมูลเรา ตอบคำถาม AI ไป competitor เสีย AI search channel

**อ้างอิง:** [OpenAI: Bots (GPTBot)](https://developers.openai.com/api/docs/bots) · [Anthropic: Does Anthropic crawl the web?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity: PerplexityBot](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)


### เสี่ยง SPA บัง AI bot

`GEO (AI Search)` · ความเชื่อมั่น 70% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 91-99)**

1. ตรวจหน้าเว็บที่ส่ง HTML ว่างเปล่า (emptyRoot) — *เพื่อดูว่าเนื้อหาต่อจากเว็บ JavaScript หรือไม่*
2. นับจำนวนหน้าที่มีพฤติกรรมนี้ — *เพื่อรู้ขาดของปัญหา*
3. บอกว่า AI crawler ปัจจุบันไม่รัน JavaScript — *เพื่อให้เจ้าของรู้ว่า AI จะมองไม่เห็นเนื้อหาเลย*

เกณฑ์ตัดสิน:
- ถ้ามีหน้า SPA → ร้ายแรง (ผิด)
- ถ้าไม่มี → ผ่าน

**WHAT — ตรวจอะไร**

เนื้อหา render ด้วย JS ต้องรอประกอบ AI bots ไม่รอ JS

**WHY — ทำไมต้องตรวจ**

AI crawler ไม่รันJS โหลด HTML shell เห็นว่าง เนื้อหาหายไป AI

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) · [OpenAI: Bots (GPTBot)](https://developers.openai.com/api/docs/bots)


## Citability

### FAQ schema

`GEO (AI Search)` · ความเชื่อมั่น 60% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 101-112)**

1. เดินไปทั่วหน้าเว็บ ตรวจ JSON-LD schema — *เพื่อหา FAQPage หรือ QAPage type*
2. บอกว่า Google ไม่ใช้อีกแล้ว แต่ AI engine ใช้ — *เพื่อให้เจ้าของรู้คุณค่า และสิ่งที่ควรโฟกัส*

เกณฑ์ตัดสิน:
- ถ้ามี FAQ/QA schema → ผ่าน
- ถ้าไม่มี → ควรแก้ (แต่ไม่เร่งด่วน)

**WHAT — ตรวจอะไร**

FAQPage schema ไม่มี Q&A ส่วนเว็บ ไม่ให้ Google AI รู้จักเป็น FAQ

**WHY — ทำไมต้องตรวจ**

FAQPage schema ประสิทธิสูง AI อ้างอิง ถ้า Q&A ไม่มี schema AI ไม่เลือก

**อ้างอิง:** [Google: Changes to FAQ rich results (2023)](https://developers.google.com/search/blog/2023/08/howto-faq-changes) · [Schema.org: FAQPage](https://schema.org/FAQPage)


### เนื้อหา Q&A

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 114-121)**

1. ตรวจหัวข้อ (heading) ว่ามีคำที่บ่งบอกคำถาม ("/", "คืออะไร", "ทำไม", "what", "how") — *เพื่อดูว่าเนื้อหาเขียนแบบตอบคำถาม*
2. นับจำนวนหน้าที่มีลักษณะนี้ — *เพื่อรู้ว่าเนื้อหามีโครงสร้างเหมาะกับ AI หรือไม่*

เกณฑ์ตัดสิน:
- ถ้ามีหัวข้อเชิงคำถาม → ผ่าน
- ถ้าไม่มี → ควรแก้

**WHAT — ตรวจอะไร**

เนื้อหา Q&A format (คำถาม → คำตอบ) น้อย ส่วนใหญ่ essay paragraph

**WHY — ทำไมต้องตรวจ**

AI ตอบคำถาม ยิ่ง Q&A format ยิ่งดึงง่าย ยิ่งอ้างอิงสูง

**อ้างอิง:** [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


### เนื้อหาอ้างอิงได้

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 140-146)**

1. นับหน้าที่มีตาราง (hasTables) หรือลิสต์ (listCount >= 3) — *เพื่อดูว่าเนื้อหามีข้อมูลที่ AI สามารถอ้างอิงได้*
2. เทียบกับจำนวนหน้า — *เพื่อตัดสินว่าเนื้อหาพอเนื้อให้ cite*

เกณฑ์ตัดสิน:
- ถ้า >= 3 หน้าขึ้นไป → ผ่าน
- ถ้าน้อยกว่า → ควรแก้

**WHAT — ตรวจอะไร**

เนื้อหาอยู่รูปแบบที่ AI ชอบอ้าง table list Q&A format มีข้อมูล citable

**WHY — ทำไมต้องตรวจ**

AI ดึงคำตอบจากเนื้อหาระเบียบ ยิ่งจัด structured ยิ่งอ้างอิงเรา

**อ้างอิง:** [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


## Authority / E-E-A-T

### E-E-A-T สัญญาณ

`GEO (AI Search)` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 123-138)**

1. ตรวจว่าหน้ามี author (meta tag หรือ schema) — *เพื่อรู้ว่า AI จะระบุได้ว่าใครเขียนเนื้อหา*
2. ตรวจว่ามี datePublished หรือ dateModified — *เพื่อรู้ว่า AI ทราบเนื้อหาสดใหม่ไหน*
3. ตรวจว่า Organization มี sameAs ลิงก์ไป social/Wikipedia — *เพื่อช่วยให้ AI เชื่อมโยงแบรนด์กับเอกลักษณ์จริง*

เกณฑ์ตัดสิน:
- ถ้ามีทั้งหมด → ผ่าน
- ถ้าขาดส่วนไหน → ควรแก้

ข้อสังเกต: ตรวจแค่ structured data ไม่ได้วัด E-E-A-T จริง

**WHAT — ตรวจอะไร**

เนื้อหาขาด E-E-A-T signal author publish date update date entity link (social wiki)

**WHY — ทำไมต้องตรวจ**

Google AI ให้ score E-E-A-T สูงกว่า ขาด signal ลดคะแนนเชื่อถือ

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) · [Google: Search Quality Rater Guidelines (PDF)](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)


### entity ชัดเจน

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 166-176)**

1. ตรวจว่ามี Organization หรือ LocalBusiness schema ใน JSON-LD — *เพื่อบอก AI ว่าแบรนด์คืออะไร และข้อมูลเขา*

เกณฑ์ตัดสิน:
- ถ้ามี → ผ่าน
- ถ้าไม่มี → ควรแก้

ข้อสังเกต: ตรวจแค่ presence ไม่ได้ check ความครบถ้วน (name, logo, address เป็นต้น)

**WHAT — ตรวจอะไร**

Organization schema ไม่มี ไม่ชี้ AI รู้จัก entity (brand) เราคือใคร

**WHY — ทำไมต้องตรวจ**

ไม่มี schema AI ไม่รู้ entity เรา ตอบคำถาม AI recommend competitor entity ที่ทำให้

**อ้างอิง:** [Google: Introducing the Knowledge Graph](https://blog.google/products-and-platforms/products/search/introducing-knowledge-graph-things-not/) · [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


### หน้า trust (about/contact)

`GEO (AI Search)` · ความเชื่อมั่น 65% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 148-164)**

1. เดินไปทั่วหน้าและลิงก์ ตรวจว่ามีหน้า About, Contact, Privacy — *เพื่อรู้ว่าธุรกิจแสดงตัวตนให้ AI เห็น*
2. ตรวจว่าหน้ามีเบอร์โทรหรืออีเมลแสดง — *เพื่อให้ AI เห็นว่ามีวิธีติดต่อได้*

เกณฑ์ตัดสิน:
- ถ้าขาดหลาย signal (>= 3) → ร้ายแรง (ผิด)
- ถ้าขาดแค่ 1-2 → เตือน
- ถ้าครบ → ผ่าน

**WHAT — ตรวจอะไร**

เว็บขาด trust page สำคัญ About Contact Privacy Policy Terms

**WHY — ทำไมต้องตรวจ**

Trust page ช่วยให้ user AI รู้เป็นธุรกิจจริง ขาด AI trust ลด อ้างอิงลด

**อ้างอิง:** [Google: Search Quality Rater Guidelines (PDF)](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf) · [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)


# Verify

## Verification

### เทียบ Lighthouse



### เทียบ raw ↔ rendered



### คำนวณ confidence



### ส่งคน / seo-geo-verify


