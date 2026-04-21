# Creative Guide — מנוע הקריאייטיב

> **Source:** [campaigner-spec §7](../../docs/plans/campaigner-spec.md#7-מנוע-קריאייטיב) + [CAMPAIGN_BUILDING_RECOMMENDATIONS.md](../../docs/CAMPAIGN_BUILDING_RECOMMENDATIONS.md).
> **מודל:** **Andromeda-era Firehose** — 10-50+ קריאייטיבים מגוונים פעילים, continuous additions, אל תחתוך ידנית.
> **Hebrew copy:** לקופי עצמו — קרא [hebrew-copy-style.md](hebrew-copy-style.md). הקובץ הזה עוסק בעקרונות המבניים.

---

## 1. Firehose vs. תפיסה ישנה

| Pre-Andromeda (לא משתמשים) | Andromeda 2026 (current) |
|---|---|
| 9-15 קריאייטיבים, אחרי 5-7 ימים השאר top 3-5 | 10-12 ראשוני + 3-5/שבוע, אל תחתוך ידנית |
| Manual pruning של underperformers | תן ל-Meta להרעיב חלשים. חתוך רק hook < 25% אחרי 48h |
| Single winning creative — מקסם אותו | 10-50+ diversity — שחיקה נדחית |
| Horizontal testing (campaign per angle) | One campaign, diversity בתוך ad set |

**למה:** Meta ב-Andromeda מחלקת תקציב לא-אחיד במכוון. קריאייטיב שמקבל 5% מהתקציב עם CTR גבוה = Meta בוחנת אותו. **לא צריך "לאלץ"** יותר תקציב.

---

## 2. Initial Batch — פתיחת קמפיין חדש

**10-12 קריאייטיבים בפתיחה:**

```
3-4 Hooks × 3 aspect ratios = ~12
```

### 3-4 Hooks שונים (angles לפי §7.5 בספק)

| זווית | מתי | דוגמה |
|---|---|---|
| **רגש / חוויה** | מוצרים רגשיים, הורים, אירועי חיים | "החיוך שלהם שווה הכל" |
| **תועלת ישירה** | שירותים פרקטיים | "קיר צילום שישדרג כל בת מצווה" |
| **דחיפות / מבצע** | עונות, סוף-מלאי | "נשארו מקומות אחרונים למאי!" |
| **רשימת יתרונות** | B2B, טכני | "🌟 עיצוב אישי 🌟 אביזרים 🌟 מזכרת" |
| **חברתי (Social Proof)** | עסקים חדשים | "אלפי הורים כבר בחרו בנו" |
| **השוואה** | שווקים תחרותיים | "למה כולם עוברים אלינו?" |

הסוכן בוחר **3-4 זוויות שונות** לקמפיין (לא כולן) → Meta Dynamic Creative בוחר את הזוכה.

### 3 Aspect Ratios

לכל hook — תמיד 3 פורמטים:

| Ratio | Dimensions | Placement מועדף |
|---|---|---|
| 1:1 | 1080×1080 | Feed universal |
| 4:5 | 1080×1350 | Feed (מומלץ — תופס יותר screen) |
| 9:16 | 1080×1920 | Stories / Reels |

**אל תקצה placement ידני** — תן את כל ה-ratios, Meta בוחרת לבד (Andromeda).

---

## 3. Continuous Additions — תוספת שבועית

**3-5 קריאייטיבים חדשים לשבוע**, בצורת proposals `task_type=new_creative` ב-`weekly_creative_firehose.sh`:

- **הוסף** — אל תחליף. האקטיבים הקיימים ממשיכים עד שטריגר Kill (Gate 1) פעל.
- **מגוון** — כל תוספת צריכה להיות שונה מהקיים (hook חדש, angle חדש, פורמט שלא בשימוש).
- **כלל זהב:** **אל תחתוך ידנית** — guardrail `no_manual_creative_pruning_before_48h` יפסול. חיתוך רק כש-Gate 1 kill trigger פעל: hook < 25% OR CTR < 1% עם ≥ 1,000 חשיפות.

---

## 4. Placement-Specific Copy

מה שעובד בפיד **לא עובד** בסטוריז. לכל placement, קופי שונה:

| מיקום | מאפייני קופי | דוגמה |
|---|---|---|
| **Feed** | עד 3 שורות לפני "קרא עוד", כותרת חזקה | "זוכרים את בת המצווה שלכם? הגיע תורם..." |
| **Stories / Reels** | קצר, ישיר, Overlay Text גדול | "החלק למעלה להזמנה! 👆" |
| **Right Column** | כותרת בלבד | "קיר צילום לבת מצווה" |

**הסוכן מייצר וריאנטים פר-מיקום** — לא גרסה אחת שמותחים על כל הפורמטים.

---

## 5. Copy Generation — תהליך

**לכל קריאייטיב, Claude מייצר:**

```json
{
  "headline": "<= 40 chars בעברית>",
  "primary_text": "<עד 3 שורות לפיד, 1 שורה לסטוריז>",
  "description": "<אופציונלי — 25 chars לפני CTA>",
  "cta": "LEARN_MORE | SHOP_NOW | SIGN_UP | CONTACT_US | ...",
  "angle": "<emotion | urgency | benefit | social_proof | comparison>",
  "placement": "feed | stories | right_column"
}
```

**Cross-check לפני כל וריאנט:**

1. האם הוא עומד ב-[hebrew-copy-style.md](hebrew-copy-style.md) §3 (forbidden) ו-§9 (hard constraints)?
2. האם ה-angle כתוב ב-`outputs.angle`? (נדרש לאנליטיקה)
3. האם הקופי מתאים ל-placement שנבחר?

---

## 6. Image Generation — תהליך

דרך `CreativeClient.generate_image(prompt, aspect_ratio, save_path)` ([campaigner/lib/creative.py](../lib/creative.py)) — לא דרך הכלי הישן ישירות.

**Prompt structure:**

```
<subject description>. <mood/emotion>. <setting>. <style>.
Professional, high quality, 4K, commercial photography.
```

**דוגמה:**

```
Happy Israeli family celebrating Bat Mitzvah at a colorful photo wall decorated with balloons and flowers. Warm, joyful mood. Modern event hall, soft evening lighting. Candid documentary style. Professional, high quality, 4K, commercial photography.
```

**Aspect ratio חובה:** 1:1 / 4:5 / 9:16 — לא "landscape" / "portrait".
**Model tier:** `fast` (default, $0.02/img) עד שיש data שה-quality של `standard` מוסיף ROI.

**Post-generation:** ולידציה ש-dimensions ≥ 1080 (guardrail `no_low_res_creative`).

---

## 7. Variation Strategy — 10 וריאנטים מ-prompt בסיסי

שימוש ב-`CreativeClient.generate_variations(base_prompt, variations, aspect_ratio)`:

**Base prompt:**
```
Happy Israeli family celebrating Bat Mitzvah at a colorful photo wall decorated with balloons and flowers.
```

**Variations list** (6-10 שונות):
```python
variations = [
    "Close-up of smiling teenage girl",
    "Wide shot showing the whole decorated wall",
    "Parents hugging the celebrating teen",
    "Friends taking selfie in front of the wall",
    "Detail shot of balloon decorations",
    "Cake-cutting moment with family around",
]
```

תוצאה: 6 קריאייטיבים שונים באותו angle — מגוון visual בלי שחיקת הקונספט.

---

## 8. Creative Fatigue — איך לזהות

**לא לפי Frequency.** Frequency > 3 לבדו לא signal — זה מה שהפקענו ב-§14.15.

**הסימן האמיתי — Meta Creative Fatigue flag:** CPR (Cost Per Result) של קריאייטיב ספציפי ≥ 2× מה-baseline ההיסטורי שלו. מופיע ב-Ads Manager וב-API (field: `meta_creative_fatigue` בעתיד, כרגע דרך השוואת CPR).

**כשסימון פעיל:**

1. `task_type='new_creative'` × 3-5 — הוסף וריאנטים חדשים עם angle שונה
2. **אל תציע** `pause_campaign` — guardrail `prefer_add_creative_over_pause` יפסול.

---

## 9. Firehose MVP scope — מה כן ומה לא

### ✅ ב-MVP
- Copy generation בעברית (Claude, 10-20 וריאנטים לפי batch)
- כותרות / CTA (Claude)
- יצירת תמונות (Vertex Imagen דרך `CreativeClient`)
- שליפה מגלריה קיימת (`creative_gallery` table)
- Continuous additions (3-5/שבוע)

### ❌ ב-MVP, ✅ ב-v2
- Image expansion (outpainting)
- Background swap
- Text overlay אוטומטי על תמונה
- יצירת וידאו AI
- Voice-over AI
- Regeneration loop (Claude מתקן על בסיס feedback)

---

## 10. Flow אישור קריאייטיב

```
Agent → propose_task.py --task-type new_creative
  → approvals row (status='pending')
  → user approves in web platform
  → Flow B (execute) picks up approved rows
  → execute_task.py uploads to Meta דרך MetaClient.upload_image + create_ad_creative + create_ad
  → approval.status='executed' + agent_decisions row 'execution'
```

**אם נדחה:** rejection_reason נשמר. ב-MVP אין regeneration אוטומטי — הקריאייטיב נגמר.
