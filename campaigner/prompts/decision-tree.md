# Decision Tree — דיאגנוזה לפי תרחיש

> **Source:** [campaigner-spec §17](../../docs/plans/campaigner-spec.md#17-עץ-החלטות-לדיאגנוזה).
> **Prereqs:** [performance-brain.md](performance-brain.md) §§3-5 (data sufficiency + two gates). אל תפעיל את העצים בלעדיהם.
> **Output language:** כל `rationale` ו-`summary` שיוצא מהעץ הזה — עברית פשוטה, רהוטה ודיבורית, שמובנת גם למי שלא בתחום השיווק. ראה [hebrew-copy-style.md §11](hebrew-copy-style.md#11-operator-facing-rationale-rationale-summary-fields). פסקה ראשונה — בלי ראשי תיבות באנגלית.

---

## סדר ההפעלה

1. **תמיד קודם Gate 1** (§T0 — creative-level). כל קריאייטיב עם volume מספיק עובר כאן.
2. רק אם Gate 1 עבר, הקמפיין זכאי ל-**Gate 2** (§T1-T3 — campaign-level).
3. אם שני השערים עברו ללא action → `skip` decision עם rationale "healthy, no action needed".

---

## §T0 — Early Creative Evaluation (Gate 1)

**חלון:** 48h - 7d מהעלאת הקריאייטיב.

```
FOR EACH active creative:

  ┌─ data sufficient? (≥ 1,000 impressions AND ≥ 50 clicks)
  │  └─ לא → log SKIP, wait for volume, המשך לקריאייטיב הבא
  │
  ├─ Hook rate < 25% אחרי 48h?
  │  └─ מסקנה: לא עוצר גלילה
  │     action: KILL creative (pause), propose new_creative עם hook שונה (§7.5)
  │
  ├─ CTR < 1% עם ≥ 1,000 חשיפות?
  │  └─ מסקנה: הנעה לפעולה חלשה / חוסר התאמה לקהל
  │     action: KILL creative, propose new_creative עם angle אחר
  │
  ├─ Hook 25-35% + CTR תקין?
  │  └─ מסקנה: solid — תן זמן
  │     action: אל תיגע. log SKIP. חוזר בסבב הבא.
  │
  └─ Hook > 35% + CTR > 2%?
     └─ מסקנה: winner potential
        action: propose new_creative × 2-3 (iterate על הזווית המנצחת)
```

**עיקרון קריטי:** ב-Gate 1 **לא** מסתכלים על CPA / ROAS. אלה lagging ב-48h. אם ה-stakeholder שואל "אבל ה-CPA בסדר" — תקן אותו דרך ה-rationale: "Gate 1 בודק אם הקריאייטיב עוצר גלילה ומושך קליק. CPA נבדק ב-Gate 2 רק אחרי יציאה מ-Learning."

---

## §T1 — CPA יקר מדי (Gate 2)

**תנאי כניסה:** קמפיין `status=ACTIVE` (יצא מ-Learning, ≥ 50 המרות ב-7 ימים), CPA > יעד × 1.3 למשך 5+ ימים.

```
CPA > יעד × 1.3 למשך 5+ ימים
  │
  ├─ CTR < 1%?
  │  └─ מסקנה: המודעה לא מעניינת / הקהל לא נכון
  │     action: propose new_creative (firehose 3-5 וריאנטים), לא pause
  │
  ├─ CTR גבוה (> 2%), אין המרות?
  │  └─ מסקנה: בעיה בדף הנחיתה / ב-Offer — לא בקריאייטיב
  │     action: propose alert — "CTR גבוה אבל לנטישה בדף הנחיתה"
  │              (task_type='new_creative' לא יעזור. rationale מציין תחום האחריות)
  │
  ├─ Meta Creative Fatigue flag (CPR ≥ 2× היסטורי)?
  │  └─ מסקנה: שחיקת קריאייטיב — Meta מזהה לבד
  │     action: propose new_creative × 3-5 (diversity).
  │     **אל תציע pause** — guardrail `prefer_add_creative_over_pause` יפסול.
  │
  ├─ Frequency > 3?
  │  └─ monitoring signal בלבד. אם CPR יציב, אל תיגע (guardrail `no_frequency_only_kill`).
  │     אם CPR לא יציב → טפל תחת ענף ה-Fatigue flag למעלה.
  │
  └─ Emergency (CPA > 3× יעד OR 3+ ימים 0 conversions עם תקציב מלא)?
     └─ action: propose pause_campaign עם urgency='urgent'
```

---

## §T2 — קמפיין מעולה (Winner)

**תנאי כניסה:** CPA < יעד × 0.8 למשך 5-7 ימים + hook rate > 35%.

```
Winner detected
  │
  ├─ התקציב נוצל במלואו (spend ≥ 95% מה-daily)?
  │  ├─ כן + hook > 35% + frequency < 2.0
  │  │  └─ action: propose scale_up 30%
  │  │     guardrail check: `budget_jump_max_30pct` — עד 30% מותר רק אם עומד בתנאים האלה
  │  │
  │  └─ כן, אחרת
  │     └─ action: propose scale_up 20% (default)
  │
  ├─ התקציב לא נוצל במלואו?
  │  └─ אין pacing problem לפתור — action: אל תיגע, log SKIP
  │
  └─ חובה: **אל תציע horizontal scaling ע"י duplication** — מאפס Learning.
     guardrail `no_horizontal_scaling_by_duplication` יפסול. תמיד vertical (budget+).
```

**Cannibalization check (Advantage+):** v2. ב-MVP לא בודק.

---

## §T3 — ירידה רוחבית בכל החשבון

**תנאי כניסה:** CPA עלה בכל הקמפיינים הפעילים באותו יום, או ירידה של > 30% ב-conversions יומיות.

```
ירידה רוחבית בחשבון
  │
  ├─ יום בשבוע חריג (שבת/חג)?
  │  └─ אין action. log SKIP rationale="calendar_anomaly"
  │
  ├─ חג / מועד (Pesach, Rosh Hashana, ...)?
  │  └─ v2: Operation Mode "Holiday". ב-MVP אין action, log SKIP rationale="holiday"
  │
  ├─ חדשות חריגות (מלחמה / אירוע ביטחוני)?
  │  └─ v2: Operation Mode "Storm". ב-MVP log SKIP rationale="external_event"
  │     (CPL בישראל קפץ ל-$385 באוגוסט 2025 — זה נורמלי לאירועים כאלה)
  │
  └─ שום אחד מהנ"ל?
     └─ action: propose alert — "ייתכן תקלה טכנית — בדוק Pixel/Events"
        task_type='new_creative' לא מתאים. השתמש ב-log_decision 'error' עם rationale
        מפורט; המשתמש יראה ב-UI.
```

---

## §T4 — קמפיין ב-Learning Phase

**תנאי כניסה:** `status=LEARNING` (conversions_7d < 50 AND days_active ≤ 7).

```
Learning Phase
  │
  ├─ action ברירת מחדל: אל תיגע
  │  └─ guardrail `no_learning_phase_touch` יפסול כל פרופוזל שנוגע בקמפיין זה
  │
  └─ חריג יחיד: תקציב מתחת ל-budget_daily_min_ils (§6 performance-brain)?
     └─ action: propose scale_up עד לתקציב מינימלי
        rationale: "קמפיין לא ייצא מ-Learning ב-תקציב הנוכחי. חישוב מינימלי: (CPA×50)/7 = X"
        guardrail: `no_learning_phase_touch` בודק `task_type` — scale_up חוקי כאן, pause לא.
```

---

## §T5 — קמפיין Learning Limited

**תנאי כניסה:** `status=LEARNING_LIMITED` (conversions_7d < 50 AND days_active > 7 AND not trending up).

```
Learning Limited (>7d בלי 50 conversions)
  │
  ├─ תקציב מתחת ל-budget_daily_min_ils?
  │  └─ action: propose scale_up עד לתקציב מינימלי
  │
  ├─ יותר מ-3 ad sets צרים בקמפיין?
  │  └─ action: propose consolidate — למזג ל-ad set אחד broad
  │     task_type: 'expand_audience' עם payload שמתאר את ה-merge
  │
  └─ קהל צר מאוד (< 1M)?
     └─ action: propose expand_audience — broad + Advantage+ Audience
        rationale: "Andromeda עובד טוב יותר ב-broad"
```

---

## §T6 — Cold Start (חשבון חדש ללא היסטוריה)

**תנאי כניסה:** זה קיים ב-memory — Aiweon Meta account הוא חדש, אין historical baselines.

```
Cold start account
  │
  ├─ יום 1-7: אין baselines. אין data sufficiency.
  │  └─ action: אל תציע שום scale / pause. log SKIP rationale="cold_start_stabilization"
  │     פעולה יחידה שמותרת: propose new_creative (firehose initial batch 10-12)
  │
  ├─ יום 8-14: התחלת building baselines (7d window).
  │  └─ apply Gate 1 בלבד. Gate 2 מחייב ≥ 50 conversions שאין עוד.
  │
  └─ יום 15+: baselines מלאים. פועל רגיל.
```

ר' [memory: Aiweon new account](../../C:\Users\harel.claude\projects\d--meta-ads-automation-ai\memory\project_aiweon_new_account.md) לפירוט.
