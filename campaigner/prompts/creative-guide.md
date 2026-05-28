# Creative Guide — מנוע הקריאייטיב

> **Source:** [campaigner-spec §7](../../docs/plans/campaigner-spec.md#7-מנוע-קריאייטיב) + [CAMPAIGN_BUILDING_RECOMMENDATIONS.md](../../docs/CAMPAIGN_BUILDING_RECOMMENDATIONS.md) + [clara-video-flow.md](../../docs/plans/clara-video-flow.md).
> **מודל:** **Andromeda-era Firehose** — 10-50+ קריאייטיבים מגוונים פעילים, continuous additions, אל תחתוך ידנית.
> **Generation backend:** **Clara** ([clarasocial.com](https://clarasocial.com/app)) דרך Playwright. החליף את Imagen ב-2026-05. Clara מקבל 2-3 תמונות מהגלריה + תקציר חופשי בעברית, מפיק וידאו 9:16 עם סאונד.
> **Hebrew copy:** לקופי עצמו — קרא [hebrew-copy-style.md](hebrew-copy-style.md). הקובץ הזה עוסק בעקרונות המבניים.

---

## 1. Firehose vs. תפיסה ישנה

| Pre-Andromeda (לא משתמשים)                   | Andromeda 2026 (current)                            |
| -------------------------------------------- | --------------------------------------------------- |
| 9-15 קריאייטיבים, אחרי 5-7 ימים השאר top 3-5 | 10-12 ראשוני + 3-5/שבוע, אל תחתוך ידנית             |
| Manual pruning של underperformers            | תן ל-Meta להרעיב חלשים. חתוך רק hook < 25% אחרי 48h |
| Single winning creative — מקסם אותו          | 10-50+ diversity — שחיקה נדחית                      |
| Horizontal testing (campaign per angle)      | One campaign, diversity בתוך ad set                 |

**למה:** Meta ב-Andromeda מחלקת תקציב לא-אחיד במכוון. קריאייטיב שמקבל 5% מהתקציב עם CTR גבוה = Meta בוחנת אותו. **לא צריך "לאלץ"** יותר תקציב.

---

## 2. Initial Batch — פתיחת קמפיין חדש

**10-12 קריאייטיבים בפתיחה.** מקור עיקרי: גלריה קיימת (`creative_gallery` — assets שהמפעיל העלה ידנית, או וידאו ש-Clara הפיק בעבר). אם אין מספיק — תקציב להוסיף תקצירים שבועיים ל-Clara (ראה §3).

### 3-4 Hooks שונים (angles לפי §7.5 בספק)

| זווית                    | מתי                               | דוגמה                               |
| ------------------------ | --------------------------------- | ----------------------------------- |
| **רגש / חוויה**          | מוצרים רגשיים, הורים, אירועי חיים | "החיוך שלהם שווה הכל"               |
| **תועלת ישירה**          | שירותים פרקטיים                   | "קיר צילום שישדרג כל בת מצווה"      |
| **דחיפות / מבצע**        | עונות, סוף-מלאי                   | "נשארו מקומות אחרונים למאי!"        |
| **רשימת יתרונות**        | B2B, טכני                         | "🌟 עיצוב אישי 🌟 אביזרים 🌟 מזכרת" |
| **חברתי (Social Proof)** | עסקים חדשים                       | "אלפי הורים כבר בחרו בנו"           |
| **השוואה**               | שווקים תחרותיים                   | "למה כולם עוברים אלינו?"            |

הסוכן בוחר **3-4 זוויות שונות** לקמפיין (לא כולן) → Meta Dynamic Creative בוחר את הזוכה.

### Aspect ratio — 9:16 בלבד

Clara מפיק תמיד **9:16 (אנכי)**. זה הפורמט הדומיננטי ל-Reels/Stories שבהם Andromeda הכי משחקת. ל-Feed Meta מקצצת אוטומטית.

קריאייטיבים סטטיים (תמונות מ-`creative_gallery`) — תמיד שלושה פורמטים מהמפעיל: 1:1 / 4:5 / 9:16. **אל תקצה placement ידני** — תן את כל הפורמטים, Meta בוחרת לבד.

---

## 3. Continuous Additions — תקצירי Clara שבועיים

**מטרה:** 3-5 וריאנטים חדשים לשבוע לכל קמפיין פעיל, דרך Flow C → Flow I.

### 3.1. הזרימה השלמה

```
Mon 10:00  Flow C — propose_pending_creative.py
             ↓
           creative_gallery row: status='pending',
             kind='video', generated_by='clara',
             hebrew_brief, source_asset_ids[2..3],
             expires_at = now() + 7d
             ↓
Daily 11:00  Flow I — generate_clara_video.py (≤ 2/day, FIFO)
             ↓
           Playwright → Clara (login, upload photos, submit brief)
             ↓
           creative_gallery row: status='generated',
             storage_url='<clara mp4 url>'
             ↓
           propose_task --task-type upload_creative
             ↓
           operator approves in /library
             ↓
Flow B    execute_task — upload video to Meta + create ad
             ↓
           creative_gallery row: status='active', meta_creative_id=...
```

### 3.2. Gallery-first sourcing (Block 8, 2026-05-13)

**עקרון:** לפני שמייצרים וריאנט חדש, בדוק מה כבר יש בגלריה ולא נוצל. גם ב-Andromeda — Clara עולה כסף; כל אסט שלא הוטמע הוא slot מבוזבז שכבר שילמת עליו.

```bash
python -m campaigner.tools.list_active_creatives \
  --business-id $BUSINESS_ID \
  --unused-in-campaigns \
  --matches-channel <feed|stories|reels>
# → viable_unused_count: N
```

**הסף (לפי שלב הסוכן):**

| שלב | יעד וריאנטים | N ≥ סף → redeploy | אמצע → mixed | אחרת → pending brief |
| --- | --- | --- | --- | --- |
| §T6.1 (cold start, קמפיין ראשון) | 10-12 | N ≥ 10 → רק `redeploy_creative` | 5 ≤ N ≤ 9 → mix | N < 5 → `propose_pending_creative` |
| §T_PE (pool הריק, שבועי) | 3-5 | N ≥ 3 → רק `redeploy_creative` | N = 1-2 → mix | N = 0 → `propose_pending_creative` |

### 3.3. בחירת 2-3 source assets לתקציר

לפני שכותב את התקציר, הסוכן בוחר **2-3 רשומות מ-`creative_gallery`** שיעברו ל-Clara:

- שאילתה: `list_gallery_assets --business-id <id> --kind image` + (אופציונלי) `--kind video`. וידאו זה גם בסדר — Flow I עצמו יחלץ פריים אחד דרך ffmpeg.
- בוחר נכסים שמשקפים את האווירה של הזווית: מסעדה רוצה לוקיישן + מנה + לקוח; שירות B2B רוצה משרד + טכנולוגיה.
- שמור על מגוון — לא 2 תמונות כמעט-זהות.
- כל ה-UUID-ים נכנסים ל-`--source-asset-ids` כ-JSON list.

### 3.4. כובע התקצירים השבועי

`propose_pending_creative.py` חוסם **אחרי 14 תקצירים פתוחים בשבוע** (7 ימים × 2/יום cap של Flow I). הסוכן צריך לעצור עצמית כשהוא מתקרב לסף — אל תכניס תור עמוק שלא יספיק להתפנות.

```bash
# Pre-flight count (אופציונלי — הכלי גם בודק):
SELECT count(*) FROM creative_gallery
WHERE business_id = $1 AND status = 'pending'
  AND created_at > now() - interval '7 days';
```

### 3.5. כלל זהב

**אל תחתוך ידנית** קריאייטיבים פעילים — guardrail `no_manual_creative_pruning_before_48h` יפסול. חיתוך רק כש-Gate 1 kill trigger פעל: hook < 25% OR CTR < 1% עם ≥ 1,000 חשיפות.

### 3.6. Task-types שנוגעים לזה

- **`pending_creative` (לא task_type — שורה ב-`creative_gallery` עם status='pending')** — תקציר חדש ל-Clara. נכתב דרך `propose_pending_creative.py`. לא דרך `propose_task` (אין HITL בשלב הזה).
- **`redeploy_creative` (task_type ב-`approvals`)** — אסט מהגלריה (תמונה/וידאו) שלא נוצל עוד. payload: `{creative_gallery_id, adset_id, link_url}`. אם הגלריה גם שמרה `meta_creative_id` קודם, execute_task עושה short-circuit: יוצר Ad חדש על אותו creative בלי upload חוזר.
- **`upload_creative` (task_type ב-`approvals`)** — וידאו ש-Clara הפיק (status='generated') מוכן להעלות ל-Meta. Flow I יוצר את ההצעה אוטומטית; המפעיל מאשר ב-UI; Flow B מעלה ל-Meta. payload: `{creative_gallery_id, adset_id?, link_url?, headline?, primary_text?, cta?}`.
- **`new_creative` (task_type ב-`approvals`)** — נשמר עבור העלאות ידניות (תמונה ש-המפעיל הביא מבחוץ) ושימוש legacy. החל מ-2026-05 הסוכן לא מפיק `new_creative` אוטומטית — רק `pending_creative` (Flow C) או `redeploy_creative` (Flow C / Flow A).

---

## 4. Placement-Specific Copy

מה שעובד בפיד **לא עובד** בסטוריז. לכל placement, קופי שונה:

| מיקום               | מאפייני קופי                          | דוגמה                                    |
| ------------------- | ------------------------------------- | ---------------------------------------- |
| **Feed**            | עד 3 שורות לפני "קרא עוד", כותרת חזקה | "זוכרים את בת המצווה שלכם? הגיע תורם..." |
| **Stories / Reels** | קצר, ישיר, Overlay Text גדול          | "החלק למעלה להזמנה! 👆"                  |
| **Right Column**    | כותרת בלבד                            | "קיר צילום לבת מצווה"                    |

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

הקופי **לא נכלל בתקציר של Clara.** Clara מפיק את הסרט; הקופי (headline/primary_text/cta) נוסף בשלב Flow B כשמעלים ל-Meta — דרך payload של `upload_creative`.

---

## 6. Creative Fatigue — איך לזהות

**לא לפי Frequency.** Frequency > 3 לבדו לא signal — זה מה שהפקענו ב-§14.15.

**הסימן האמיתי — Meta Creative Fatigue flag:** CPR (Cost Per Result) של קריאייטיב ספציפי ≥ 2× מה-baseline ההיסטורי שלו. מופיע ב-Ads Manager וב-API (field: `meta_creative_fatigue` בעתיד, כרגע דרך השוואת CPR).

**כשסימון פעיל:**

1. `propose_pending_creative.py` — הוסף תקציר Clara חדש עם angle שונה (זה נכנס לתור Flow I; הוידאו יגיע 1-2 ימים אחרי).
2. **אל תציע** `pause_campaign` — guardrail `prefer_add_creative_over_pause` יפסול.

---

## 7. Firehose MVP scope — מה כן ומה לא

### ✅ ב-MVP

- Copy generation בעברית (Claude, 10-20 וריאנטים לפי batch) — נכנס דרך `upload_creative.payload`
- כותרות / CTA (Claude)
- **יצירת וידאו חדש דרך Clara** — Flow C כותב תקציר, Flow I מפיק. 9:16, סאונד כלול, אורך לפי Clara.
- שליפה מגלריה קיימת (`creative_gallery` table) — Block 8 (2026-05-13): §T6.1 ו-§T_PE עושים gallery-first, ייצור חדש (תקציר Clara) רק כשאין מספיק אסטים מתאימים. ראה §3.2 וגארדריל §28 `prefer_gallery_over_generation`.
- `redeploy_creative` task_type — לפרוס אסט קיים מהגלריה לקמפיין חדש, עם short-circuit כשיש כבר `meta_creative_id`.
- Continuous additions (3-5/שבוע) — gallery-first; pending brief רק כשהגלריה לא מספיקה, חסום ב-14/שבוע.

### ❌ ב-MVP, ✅ ב-v2

- Image expansion (outpainting)
- Background swap
- Text overlay אוטומטי על תמונה
- Voice-over AI (Clara מספק audio default — לא ניתן לעקוף ב-MVP)
- Regeneration loop (אם המפעיל דחה וידאו של Clara — הוידאו נגמר; אין retry אוטומטי)
- Multiple aspect ratios per brief (Clara מפיק 9:16; v2 יתכן 1:1 + 4:5)
- אישור התקציר לפני Clara (HITL רק על הוידאו הסופי)
- ייצור תמונות סטטיות אוטומטי (Imagen הוסר ב-2026-05; תמונות סטטיות בגלריה הן manual_upload בלבד)

---

## 8. Flow אישור — מקצה לקצה

```
Mon 10:00     Flow C → propose_pending_creative
                ↓
              creative_gallery (status='pending')
                ↓
Daily 11:00   Flow I → generate_clara_video
                ↓
              creative_gallery (status='generated', storage_url=mp4)
                ↓
              propose_task --task-type upload_creative
                ↓
              approvals (status='pending')
                ↓
              user approves in /library
                ↓
Every 15min   Flow B → execute_task (task_type='upload_creative')
                ↓
              MetaClient.upload_video_creative → create_ad
                ↓
              creative_gallery (status='active', meta_creative_id=...)
              approval.status='executed'
              agent_decisions: 'execution'
```

**אם נדחה (`upload_creative`):** rejection_reason נשמר. ב-MVP אין regeneration אוטומטי — הוידאו נגמר, השורה נשארת status='generated' אבל לא תועלה. הוידאו עדיין זמין ב-storage_url אם המפעיל ירצה לפרוס אותו ידנית דרך redeploy_creative בעתיד.

**אם Clara נכשל (`generate_clara_video` נופל):** `decision_type='error'` ב-`agent_decisions`, השורה נשארת status='pending' עם quota יומי-נוצל; ינסה שוב מחר. אחרי 7 ימים `status` מתחלף ל-`expired` (cleanup).

---

## 9. Rationale להצעת `upload_creative` — שפת בעל-עסק

> **חוק מחייב:** ה־`rationale` של הצעת `upload_creative` (Flow I יוצר אוטומטית) מציית ל־[hebrew-copy-style.md §11](hebrew-copy-style.md#11-operator-facing-rationale-rationale-summary-fields) **באותה רמת חומרה** כמו אבחון ביצועים. הקורא הוא בעל עסק שמאשר העלאה של וידאו לפרסום אמיתי, לא איש שיווק.

### מה אסור בפסקה הראשונה

- **שמות פורמטים טכניים:** `9:16`, `4:5`, `1:1` → "וריאנט אנכי למובייל", "פורמט מרובע".
- **שמות placement באנגלית:** `Stories`, `Reels`, `Feed`, `Right Column` → "סטוריז", "ריילז", "פיד", "טור צד".
- **טוקני CTA של Meta:** `MESSAGE_PAGE`, `LEARN_MORE`, `SIGN_UP` → "שלח הודעה", "מידע נוסף", "להירשם".
- **שמות מנועי ML של Meta:** `Andromeda`, `Advantage+` → "מערכת הפרסום של Meta", "הרחבת קהל אוטומטית".
- **שמות כלים פנימיים:** `Clara`, `Imagen`, `Flow I`, `propose_pending_creative` → "מערכת הפקת הוידאו שלנו", "התקציר שכתבנו ביום שני".
- **הפניות פנימיות לקבצים שלנו:** "לפי creative-guide §3", "לפי decision-tree §17" → תרגם את הכלל לעברית טבעית במקום ההפניה.
- **מדדים באנגלית:** `CTR`, `CPM`, `hook rate`, `frequency` → "אחוז הקלקות", "עלות לאלף חשיפות", "קצב משיכת תשומת לב", "תדירות חשיפה". (אסור בפסקה 1; מותר עם gloss בפסקה 2+.)

### מה כן בפסקה הראשונה

- **משפט TL;DR אחד, ≤ 20 מילים, נשמע טבעי בפה.** עונה: _מה הופק? למה זה ייכנס לאוויר?_
- כתוב כמו ש**מסבירים לחבר** ליד הקפה, לא כמו שכותבים סיכום לקובץ Slack של צוות שיווק.

### דוגמה — לפני / אחרי

**❌ Before (הצעה שתידחה):**

> Clara הפיק וריאנט 9:16 בעקבות התקציר השבועי של Flow C ל-Andromeda. הסרט באורך 12 שניות עם audio default. צריך MESSAGE_PAGE כ-CTA ולפי decision-tree §T_PE זה החסר עכשיו ב-pool.

**✅ After (TL;DR בעברית טבעית):**

> וידאו אנכי חדש (12 שניות, עם סאונד) מוכן להעלות לקמפיין "מסעדה ראשון לציון" — מציג את האווירה של ארוחת ערב, לפי התקציר שכתבנו ביום שני.
>
> זה הוידאו הראשון שמערכת הוידאו האוטומטית שלנו הפיקה השבוע. הקמפיין צריך וריאנטים חדשים כי הוידאו הקיים מתחיל להתעייף — מערכת הפרסום של Meta משלמת יותר על כל לקוח עכשיו מאשר לפני שבועיים (סימן ל"שחיקה"). וידאו טרי שיוצא לסטוריז וריילז של פייסבוק ואינסטגרם אמור להחזיר את האחוזים. הכפתור ("שלח הודעה") מקושר לעמוד הנחיתה הראשי.

### בדיקה עצמית לפני שמירת ה-`rationale`

לפני שכתבת `propose_task.py --rationale "..."`, עבור על הפסקה הראשונה ושאל: *האם בעל מסעדה / בעל סטודיו / יזם סולו, בלי שום רקע פרסומי, יבין מה אני מציע מהמשפט הזה לבד?* אם לא — נסח מחדש לפני שהפרופוזל נכנס לתור.

---

## 10. תקציר Clara — מבנה ה-`hebrew_brief`

ה-`hebrew_brief` שנכנס ל-`propose_pending_creative.py --hebrew-brief "..."` הוא **טקסט חופשי בעברית**. אין שדות מובְנים, אין JSON.

### עקרונות

- **התמקד באווירה ובמטרה**, לא בפרטים טכניים. דוגמה: `"מסעדת שף בראשון לציון עם תפריט ים-תיכוני מודרני — כלים פשוטים ויפים, אור טבעי שנכנס בערב, אנשים שוקעים בשיחה. רוצים שיריח טוב דרך המסך."`
- **שפה טבעית** — כמו שתסבירי לצלם מקצועי מה את רוצה. לא רשימת תכונות.
- **אורך** — אין מינימום. 25-80 מילים זה sweet spot. הסף הקשיח ב-tool הוא 4000 chars.
- **שמות מותג** — לא צריך להכניס. `business_name` / `logo_url` / `default_cta_url` נשלפים אוטומטית מ-`business_knowledge` ע"י Flow I לפני ההגשה ל-Clara.
- **אסור:** אל תכתוב בתקציר טוקנים שיגיעו על המסך (Hebrew text overlays). Clara בונה את הטקסטים שלה לבד — את כותבת רק את האווירה.
- **שפה — עברית בלבד.** אל תערבב אנגלית.

### מה Clara עושה מהתקציר

1. קוראת את התקציר (עברית).
2. עושה עיבוד של 2-3 תמונות-מקור שהעלית.
3. בונה סרטון 9:16 עם:
   - קאט-סצנות שמשקפות את האווירה.
   - טקסטים בעברית שמופיעים על המסך (כותרות לפי הקצב).
   - מוזיקה / סאונד שמתאים למצב הרוח שתיארת.
   - אורך לבחירת Clara (~12 שניות בממוצע).

הסוכן **לא שולט ב-overlays האלה** — אם רוצה כותרת ספציפית, היא חייבת להגיע מהתקציר עצמו ("רוצים שתופיע כותרת...") וה-success rate נמוך. ב-MVP — לא מנסים.

---

## 11. Variation Strategy — מספר תקצירים מאותה אווירה

ל-firehose שבועי שמייצר 3-5 וריאנטים לקמפיין:

הסוכן כותב **3-5 תקצירים שונים** — כל אחד עם זווית אחרת (emotion / urgency / benefit / social_proof / comparison לפי §2). לא variations של אותה אווירה — Clara עושה את ה-visual variation לבד מתוך הצירוף של (תקציר × 2-3 source assets שונים).

דוגמה — מסעדת שף:

```
brief #1 (emotion):    "ארוחה שכל המשפחה זוכרת — צחוקים, קסיואלית, אווירה ביתית-יוקרתית"
brief #2 (urgency):    "מקום אחרון השבוע — שולחנות מתמלאים מהר, רק עוד 4 ספוטים לערב שישי"
brief #3 (social):     "האנשים שמגיעים — אורחים קבועים שחוזרים בכל חודש"
```

לכל תקציר — בחירה שונה של 2-3 source assets (תמונה של המנה מול תמונה של האווירה מול תמונה של הקבוצה).

---

## 12. מה השתנה ב-2026-05

| לפני                                              | אחרי                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| Imagen מפיק תמונות סטטיות אוטומטית ב-Flow C       | **הוסר.** Clara מפיק וידאו ב-Flow I (cap 2/יום)                       |
| `generate_creative.py` (Imagen wrapper)            | **הוסר.** הוחלף ב-`propose_pending_creative.py` (Flow C) + `generate_clara_video.py` (Flow I) |
| Flow C מפיק מיידית + מציע `new_creative`           | Flow C מציע `pending_creative` בלבד — Flow I מפיק ביום שלמחרת          |
| HITL על אישור התקציר + Imagen output               | HITL רק על הוידאו הסופי — הפקה אוטומטית בתוך cap                       |
| כל גישת Vertex / `google-genai`                    | **הוסר.** ה-base agent image כבר לא צריך GCP credentials. Flow I רץ ב-image נפרד `agent-clara` עם Playwright + Chromium + ffmpeg |
| `new_creative` כ-task_type אוטומטי                 | רק `upload_creative` (Clara output) או `redeploy_creative` (gallery-first). `new_creative` נשמר רק להעלאות ידניות |

ראה [docs/plans/clara-video-flow.md](../../docs/plans/clara-video-flow.md) לתוכנית מלאה.
