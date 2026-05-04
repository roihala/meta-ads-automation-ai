# Guardrails — החוקים שלא חורגים מהם אף פעם

> **Source:** [campaigner-spec §14](../../docs/plans/campaigner-spec.md#14-guardrails).
> **עיקרון:** הכלל הכי קריטי במערכת — הסוכן לא שובר אף guardrail, גם אם "חושב" שכדאי.
> **מימוש עתידי:** `campaigner/tools/check_guardrails.py` (⏳ pending 4.x). עד אז, הסוכן קורא את הקובץ הזה לפני כל proposal ומוודא ידנית.
> **שפת הפלט (rejections + rationale):** עברית פשוטה ודיבורית, מובנת גם למי שלא מהתחום. ראשי תיבות באנגלית רק בפסקה שניה ועם הסבר בסוגריים בפעם הראשונה. ראה [hebrew-copy-style.md §11](hebrew-copy-style.md#11-operator-facing-rationale-rationale-summary-fields).

---

## איך להשתמש בקובץ הזה

לפני כל `propose_task.py`, עבור על הרשימה למטה. אם אחד מהחוקים מופעל → **אל תציע**. במקום זה:

```bash
python -m campaigner.tools.log_decision \
  --business-id "$BUSINESS_ID" --run-id "$RUN_ID" \
  --graph-name observe_propose --node-name apply_guardrails \
  --decision-type rejection \
  --summary "Rejected <task_type> on <target_id>: violates <rule_name>" \
  --rationale "<Hebrew: למה הכלל חל כאן>" \
  --guardrail-violations "<rule_name>" \
  --campaign-id "<id>" \
  --outputs "{\"rejected_proposal\":{...}}"
```

**שם ה-rule** (ב-`--guardrail-violations`) חייב להיות תואם לשם ב-snake_case מהרשימה למטה. זה מפתח ה-audit trail של §14.

---

## 1. `no_delete_campaigns`

**כלל:** אין proposal עם `task_type='delete_*'`. השהייה (`pause_campaign`, `pause_adset`) בלבד.

**למה:** מחיקה לא הפיכה, מאבדת היסטוריה, ו-Meta ממיר delete ל-archive אוטומטית. השהייה משיגה אותה תוצאה אופרטיבית עם rollback אפשרי.

**איך להחליף:** `pause_campaign` / `pause_adset`.

---

## 2. `max_tasks_per_day` (§8.3)

**כלל:** תקרת הצעות יומית לפי תקציב העסק:

| `businesses.daily_budget_ils` | מקסימום proposals/יום |
|---|---|
| < 50 | 2 |
| 50 – 500 | 5 |
| > 500 | 10 |

**למה:** אפליקציה של החלטות הוא מאמץ קוגניטיבי. הצפת המשתמש במשימות → decision fatigue → אישורים אוטומטיים בלי חשיבה.

**איך להחליף:** אחרי step 5 (anti-flood prioritization ב-CAMPAIGNER.md), דלג על proposals עודפים → `log_decision rejection`.

---

## 3. `no_learning_phase_touch`

**כלל:** קמפיין ב-`status=LEARNING` (conversions_7d < 50 AND days_active ≤ 7) → אין `pause_campaign` / `pause_adset` / `expand_audience` / `new_campaign`.

**חריג:** `scale_up` ל-תקציב מינימלי (`budget_daily_min_ils = CPA × 50 / 7`) — אחרת הקמפיין לא ייצא מ-Learning לעולם.

**למה:** שינוי בקמפיין ב-Learning מאפס את האלגוריתם של Meta. 7 ימים הולכים לפח.

---

## 4. `budget_jump_max_30pct`

**כלל:** שינוי תקציב יומי חד פעמי ≤ 20% (default). עד 30% מותר **רק** אם:
- `hook_rate > 35%`
- `frequency < 2.0`
- `status=ACTIVE` (יצא מ-Learning)

קפיצה > 30% → פסילה.

**למה:** Meta מכוילת ל-pacing. קפיצה גדולה מדי → re-entering Learning, reset של ההתקדמות.

**איך להחליף:** פרוט ל-2-3 הצעות scale_up ברצף ימים עוקבים.

---

## 5. `no_audience_change_on_active`

**כלל:** אין `expand_audience` על קמפיין `status=ACTIVE` שעומד ביעד (CPA ≤ יעד). קהל = משתנה יסודי.

**חריג:** קמפיין `LEARNING_LIMITED` מעל 7 ימים בלי 50 conversions — שינוי קהל מותר לפתיחת Learning מחדש.

**למה:** שינוי קהל בקמפיין מוצלח = שבירת מה שעובד. "Don't fix what ain't broken."

---

## 6. `no_horizontal_scaling_by_duplication` (חדש 2026)

**כלל:** אין proposal עם `task_type='new_campaign'` שמעתיק קמפיין מוצלח.

**למה:** Duplication מאפס Learning Phase — 7+ ימים של אופטימיזציה הולכים לפח. Vertical scaling (הגדלת תקציב בקמפיין הקיים) = הדרך היחידה הלגיטימית.

**איך להחליף:** `scale_up` (בכפוף ל-`budget_jump_max_30pct`).

---

## 7. `meta_api_rate_limit`

**כלל:** מקסימום X קריאות/דקה ל-Meta Marketing API (X נקבע לפי `app_rate_limit` — בדר"כ 200/hour user-level).

**למה:** Meta חוסמת tokens על rate limit. חסימה = אי-יכולת לבצע approvals עד שהחסימה פגה.

**איך להחליף:** אם זיהית ריבוי קריאות, קמצן — השתמש ב-cached snapshot מ-`fetch_insights` במקום לקרוא שוב.

---

## 8. `document_every_decision` (§12.1)

**כלל:** כל פעולה → שורה ב-`agent_decisions` דרך `log_decision.py`.

**למה:** §12.1 הוא צורך אמיתי — ללא רישום אין audit, אין debugging, אין UI "למה?".

**אם log_decision נכשל:** הכלי חוזר 3 פעמים אוטומטית. אם עדיין נכשל → exit 1. **לא** ממשיכים ב-"fail-soft".

---

## 9. `explicit_approval_over_threshold_ils`

**כלל:** הצעה שמגדילה spend ב-> ₪500/יום חייבת `urgency='high'` או `'urgent'` לפחות. השפעת תקציב גבוהה = רואה אותה המשתמש בראש הרשימה.

**למה:** הצעת scale_up בתקציב גבוה שתקועה בתור "medium" 48 שעות = שריפת כסף.

---

## 10. `no_pause_on_recent_conversion_24h`

**כלל:** אין `pause_campaign` על קמפיין שהביא המרה ב-24 השעות האחרונות.

**למה:** המרה חיה = המודעה עדיין רלוונטית. השהייה לא לוגית.

**חריג:** Emergency kill (CPA > 3× יעד) גובר על הכלל הזה.

---

## 11. `no_low_res_creative`

**כלל:** קריאייטיב בפירמידה פחות מ-1080p → פסילה ב-`new_creative` proposal.

**למה:** Meta מוריד איכות תצוגה אוטומטית, פוגע ב-hook rate.

**מימוש:** בעת יצירת תמונה דרך `ImageGenerator`, הדגל `aspect_ratio` + dimensions מחזיר 1080x*. ולידציה על התוצר לפני upload.

---

## 12. `require_95pct_significance_for_ab` (חדש 2026)

**כלל:** הכרזה על winner ב-A/B test דורשת 95% statistical significance (או volume equivalent). אין "hook A עבר 2% > hook B 1.8% אז A ניצח" ב-100 חשיפות כל אחד.

**למה:** Andromeda מחלקת תקציב לא-אחיד במכוון. הבדלי ביצועים בהיקף נמוך = רעש, לא signal.

---

## 13. `prefer_add_creative_over_pause` (חדש 2026)

**כלל:** קמפיין עם Meta Creative Fatigue flag (CPR ≥ 2× baseline) → הצעה אסורה `pause_campaign`. הצעה מותרת: `new_creative` × 3-5.

**למה:** Fatigue בקריאייטיב ≠ בעיה בקמפיין. פאוזה מאבדת את Learning. Firehose של קריאייטיבים מרענן בלי איבוד.

---

## 14. `no_manual_creative_pruning_before_48h` (חדש 2026)

**כלל:** אין `pause_adset` / `pause_campaign` על קריאייטיב חדש (פחות מ-48h חי) **אלא אם** Gate 1 kill trigger פעל (hook < 25% OR CTR < 1% עם volume מספיק).

**למה:** Meta מקציבה תקציב לא-אחיד במכוון — "winning" creatives מקבלים יותר. שחיקה נראית כפרופורציות לא-אחידות ב-dashboard. אל תפרש כ-"צריך לכבות".

---

## 15. `no_frequency_only_kill` (חדש 2026)

**כלל:** Frequency > 3 לבדו → **לא** trigger ל-pause. חייב signal נוסף (CPR ≥ 2×, או CPA > 1.3× יעד).

**למה:** Andromeda מטרגטת טוב יותר. Frequency גבוה ≠ שחיקה. ה-trigger האמיתי הוא Creative Fatigue flag.

**איך לתפוס rationale שמפר את הכלל:** אם ב-`rationale` מופיעה המילה "frequency" בלי מדד אחר תומך → חזור ל-[decision-tree.md §T1](decision-tree.md#t1--cpa-יקר-מדי-gate-2).

---

## 16. `video_preferred_on_equal_cpa`

**כלל:** כאשר מציעים `new_creative` וה-CPA של וריאנטי וידאו ותמונה דומה (±10%), העדף וידאו.

**למה:** וידאו נותן hook rate גבוה יותר ב-2026. CTR דומה + hook טוב יותר = פוטנציאל scale עדיף.

---

## 17. `verify_tracking_infrastructure` (מחובר ל-backend PRD E1 #11)

**כלל:** אין `new_campaign` proposal אם `business.tracking_verified=false` (Pixel + Conversions API מחוברים וקיבלו לפחות event ב-7 ימים).

**למה:** קמפיין עם tracking לא מאומת לא יכול לצאת מ-Learning (Meta לא יודעת לספור conversions). שריפת תקציב ללא היזון חזרה = הגדרה של "optimization impossible".

**איך להחליף:** proposal בסוג שונה (למשל awareness בלי conversion event) עד ש-tracking מאומת; או log_decision 'skip' עם rationale "tracking_not_verified".

---

## 18. `enforce_budget_formula` (מחובר ל-backend PRD E1 #12)

**כלל:** כל `new_campaign` / `scale_up` שהתוצאה שלו תקציב יומי מתחת ל-`(expected_cpa × 50) / 7` → פסילה.

**למה:** §6.3 — קמפיין לא ייצא מ-Learning אם התקציב שלו לא יאפשר ≥ 50 המרות ב-7 ימים. הצעה שמציבה אותו בתקציב נמוך יותר = שריפת כסף ללא exit from Learning.

**דוגמה:** CPA יעד ₪100 → `budget_daily_min_ils = (100 × 50) / 7 = 714`. הצעה עם daily_budget_ils = 500 → rejection.

**איך להחליף:** הצע תקציב שעומד ב-formula, או העלה את ה-CPA יעד אם הלקוח עומד על תקציב נמוך.

---

## 19. חוקים דחויים ל-v2

לא מיושמים ב-MVP — אזכור למיקום ארכיטקטוני:
- `remarketing_min_budget_ils` — רימרקטינג ≥ ₪50/יום גם בעונה חלשה
- `external_source_allowlist` — רק אתרים אמינים (רק לכלים שיצרכו web research)
- `no_competitor_hallucinations` — דורש מקור לכל טענה על מתחרים

---

## טמפלט rejection Hebrew

```
סיבה: <rule_name>
הקמפיין/קריאייטיב: <id>
הממצא: <מה נמצא שמפר את הכלל>
למה הכלל חל: <1-2 משפטים>
מה הייתי ממליץ במקום: <חלופה אם קיימת, או "אין פעולה מותרת כרגע">
```
