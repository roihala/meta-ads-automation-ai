# Hebrew Copy Style — Aiweon Brand Voice

> **Audience:** Claude (the agent), loaded into context on every invocation.
> **Scope:** §§1-9 govern **customer-facing ad copy** (headlines, hooks, CTAs). §11 governs **operator-facing rationale** (the "למה?" in the approvals UI). Both apply on every run.
> **Status:** **v0.2 — 2026-05-04.** `[TBD]` markers show where Roi must fill in Aiweon-specific content before Phase 2. §11 is fully specified regardless of voice `[TBD]`s. v0.2 hardened §11's plain-Hebrew rule: assume the reader is not a marketing/ads professional, every TL;DR must be speakable aloud.
> **Target lock date:** 2026-05-10 (per [decisions-log §1.5](../../docs/plans/decisions-log.md#15-hebrew-copy-style--authorship)).
> **Owner:** Roi (admin@aiweon.co.il). Update triggers listed in §10.

---

## How to use this file (for Claude)

When generating Hebrew ad copy, read this file top to bottom before writing anything. Apply the rules in §2-7. Cross-check every generated variant against §3 (forbidden list) and §9 (hard constraints). If a requested CTA or angle isn't covered here, surface the gap in your output so the operator can add it — don't silently invent.

---

## 1. Brand overview

- **Name:** Aiweon
- **Tagline:** הבית של מותגים ויוצרי תוכן
- **Positioning:** AI-based digital marketing agency + SaaS platform, based in Israel.
- **Domain:** aiweon.co.il
- **Primary language:** Hebrew (MVP scope). English/Arabic deferred.

### What Aiweon sells
`[TBD — Roi to fill in: one-paragraph description of the core offer. Are these managed-service engagements? Self-serve software subscriptions? Hybrid? What's the primary SKU/tier structure?]`

### Who we sell to
`[TBD — Roi to fill in: primary customer profile. Are these SMB owners hiring an agency? Marketing managers at mid-market brands? Individual content creators? Freelance marketers buying SaaS? Mix? Which is the priority for this campaign series?]`

### What problem we solve (for the customer)
`[TBD — Roi to fill in: the pain point Aiweon addresses, in 1-2 sentences, in the customer's own language. Not "we offer AI-powered marketing automation." Rather: "marketing costs Xk/month with unclear ROI" or similar.]`

---

## 2. Voice dimensions

### Formality
`[TBD — Roi to pick ONE and delete the others]`
- Option A: "אתה/את" singular, warm, like a knowledgeable friend.
- Option B: "אתם" plural, professional, like addressing a business team.
- Option C: Neutral infinitives — "לקבל", "להשאיר" — impersonal.

**Default if uncommitted:** B (אתם plural) — Aiweon sells to businesses and teams, and "אתם" sidesteps gender-inflection problems.

### Energy level
`[TBD — pick ONE]`
- Calm / advisory / "מומחה שמסביר"
- Energetic / motivating / "בואו נתחיל"
- Factual / direct / numbers-forward

### Humor
`[TBD — pick ONE]`
- Dry wit, occasional wink
- Straight-faced, no humor
- Light self-deprecation ("גם אנחנו נפלנו לזה")

### Technical register
`[TBD — pick ONE]`
- Plain Hebrew — avoid marketing jargon. ROAS, CPA, CPM → explain in words.
- Mixed — use jargon where customers expect it (if they're marketers themselves).
- Heavy — assume audience knows ML/ad terminology.

### We sound like
`[TBD — Roi to fill in with 2-3 reference brands/creators whose voice we'd like to echo.]`

### We do NOT sound like
`[TBD — Roi to fill in: "the stereotypical Israeli hype-y Facebook ad" is a given; list 1-2 specific anti-examples.]`

---

## 3. Lexicon

### Forbidden words and phrases (pan-Israeli spam-feel — always reject)

- `לחץ כאן` (dead giveaway of template copy; use contextual CTA instead)
- `מוגבל בזמן!` (overused; cheapens actual scarcity when we need it)
- `הזדמנות של פעם בחיים`
- `מהפכה`, `פריצת דרך`, `בלעדי` — all overused to the point of meaninglessness
- `!!!` / `???` — never more than one exclamation/question mark in a row
- `חינם!!` — zero exclamation marks. "חינם" alone, once, is fine when literally true.
- `רק היום` unless literally true for today (adherence matters for Meta policy too)
- ALL CAPS English words mid-Hebrew sentence ("CTR", "ROI" OK; "LAST CHANCE" — no)

### Aiweon-specific forbidden terms
`[TBD — words/phrases the brand has explicitly committed to avoiding. Common category: any term a competitor over-uses that we want to distance from.]`

### Preferred vocabulary for our category
`[TBD — Roi to add: when talking about AI/marketing/content, which Hebrew words does Aiweon prefer? Examples:]`
- "אוטומציה" vs. "AI" vs. "בינה מלאכותית" — pick a default
- "לקוחות" vs. "עסקים" vs. "מותגים" — pick default
- "שיווק דיגיטלי" vs. "פרסום ברשת" vs. "פרסום ממומן" — pick default

### Common AI-generated mistakes in Hebrew (always check for)

- **Literal translation from English patterns:** "תן לעצמך" (from "give yourself"), "זה הזמן שלך" (from "your time"), "הכנס את עצמך" — all sound translated.
- **Masculine default for mixed audiences** — default to plural "אתם" or infinitive forms, not masc singular "אתה" unless audience is male-only.
- **Gender-inflection mixing mid-sentence** — "השאר את הפרטים שלך ותקבלי" (masc imperative + fem future) — always catch.
- **ו'/וכו'/ועוד** as filler to pad length — never acceptable.
- **Overly formal registers** ("אשר על כן", "נבקש בזאת") — too bureaucratic for social ads.
- **Emoji positioning** — in Hebrew RTL, emoji direction often breaks. Prefer no emoji, or ≤1 per ad at the end.

---

## 4. CTAs (call-to-action phrases)

### By campaign objective (prefer these; reject others unless operator overrides)

**Leads:**
`[TBD — Roi to rank 2-3 preferred options]`
- "להשאיר פרטים"
- "לקבוע שיחה"
- "לקבל הצעת מחיר"
- "לקבל הדגמה"
- "להתחיל היום"

**Sales (when applicable):**
`[TBD]`
- "להירשם"
- "להתחיל ניסיון חינם"
- "לראות מחיר"

**Traffic / Awareness:**
`[TBD]`
- "לקרוא עוד"
- "להכיר"

### Meta ad-format CTA buttons
The ad platform itself offers CTA buttons (Get Quote, Sign Up, Learn More, etc.). Match the Hebrew CTA **in the primary text** to what the button says — if button is "Sign Up", text should end with "להירשם" and not "לקבל הצעה" (this creates a confusing friction for users).

---

## 5. Headlines

### Hard constraints
- **Length:** 5-7 Hebrew words. One line of 40 chars max at standard Hebrew feed rendering.
- **Benefit-driven:** Focus on customer outcome, not Aiweon's feature.
- **No punctuation clutter:** Max one punctuation mark (`.`, `?`, or nothing). No exclamation in headlines.

### Structural patterns we prefer
`[TBD — Roi fills in 2-3 patterns that match Aiweon's voice. Examples to pick from:]`
- "[Outcome] ב-[timeframe]" — "מהלך שיווקי מוצלח תוך שבועיים"
- "ככה [audience] [achieves outcome]" — "ככה סוכנויות קטנות מכפילות תקציב"
- Question headline — "למה המתחרים שלך רואים תוצאות ואתה לא?"
- Declarative — "השיווק שלך לא חייב לעלות ככה."

### Anti-patterns (reject)
- "גלה את [thing]" — imperative-adventure register; worn out
- "[Number] סיבות למה..." — listicle tease; works on blogs, not ads
- Starting with brand name — "Aiweon היא..."

---

## 6. Primary text

### Opening hook (first 1-3 lines before "...ראה עוד")
Hebrew feed renders ~80-120 characters before the "see more" break. The hook must land there.

**Rules:**
- First sentence ≤12 words.
- Lead with the **customer's reality or question**, not our product.
- No generic openers: avoid "האם אתה..." (too template).

`[TBD — Roi: add 2-3 proven hooks if any exist from past campaigns (on old accounts), or describe the "feel" of a strong hook for Aiweon.]`

### Body
- **Length:** 40-80 words total is the sweet spot for Meta placements in Hebrew. Longer works only if the opening earns it.
- **Structure:** Hook → one specific claim → soft proof or specificity → CTA.
- **One idea per ad.** If there are three angles, that's three ads, not one.

### Proof points we can use
`[TBD — Roi to add: numbers, named clients, case study snippets, press mentions that can be referenced in ads. Example shape: "עזרנו ל-X מותגים להגדיל Y ב-Z%."]`

---

## 7. Cultural + regulatory context

### Hebrew-specific
- Right-to-left; emoji and English words break flow — use sparingly.
- Biblical/literary references can land well but risk sounding preachy; default to modern Hebrew.
- Military/security metaphors are **always off** in 2026 IL context.

### Calendar sensitivity
- **Shabbat:** No scheduled launches Friday afternoon → Saturday night. The Meta cron respects this via business timezone; copy should also avoid "השבוע" framing that becomes weird over Shabbat.
- **Holidays (חגים):** Pass, Rosh Hashana, Succot, Hanukkah, Purim, Shavuot — impose their own pause windows. When a campaign spans a holiday, the copy should acknowledge it only if the offer is holiday-tied; otherwise stay neutral.
- **Tisha B'Av / fast days:** No promotional energy on these dates.
- **Memorial Day / Independence Day / Yom Kippur:** Full blackout for promotional content.

### Audience segments (IL-specific)
`[TBD — Roi: which of these do Aiweon's campaigns target, if any specifically?]`
- חילוני / secular
- דתי לאומי
- חרדי (requires very different register + channel choice)
- ערבי-ישראלי (requires Arabic, out of MVP scope per CLAUDE.md)
- Russian-speaking Israelis

### Current-event sensitivity (2026)
- Wartime context: avoid flippant tone, avoid urgency copy that sounds like news ("אל תפספסו!"), avoid military vocabulary even as metaphor.
- Political neutrality: no sides, no slogans, no flags as visuals unless Independence Day.

---

## 8. Worked examples

### ✅ Good — hypothetical TOFU lead-gen ad for Aiweon
`[TBD — Roi should replace this with a real Aiweon-flavored example after v1 review. Below is a placeholder Claude may use for structural reference only.]`

**Headline:** תקציב שיווק שעובד, בלי לנחש
**Primary text:**
> רוב העסקים הקטנים מוציאים 30% מהתקציב השיווקי על קמפיינים שאף אחד לא עוקב אחריהם.
>
> אצלנו, כל שקל עובד עם נתונים — לא עם תחושות.
>
> להשאיר פרטים ונחזור אליכם עם הצעה מותאמת.

**Why this works (for Claude to learn from):**
- Hook in line 1 names a specific pain (30% figure anchors attention).
- Line 2 is the differentiator in one breath — not listing 5 features.
- CTA matches the "לקבוע שיחה / הצעה" Leads objective.
- No forbidden words; no hype language.

### ❌ Bad — pattern to always reject

**Headline:** מהפכה בעולם השיווק!!! הזדמנות של פעם בחיים
**Primary text:**
> לחץ כאן עכשיו כדי לקבל גישה בלעדית למערכת המהפכנית שלנו!!
>
> אל תפספסו — רק היום מחיר מיוחד.

**Why it's bad:**
- Three forbidden phrases: מהפכה, הזדמנות של פעם בחיים, לחץ כאן.
- Exclamation stacking (`!!!`, `!!`).
- "רק היום" without actual same-day offer.
- No differentiation — could be any SaaS/agency ad.
- Hype without substance; Andromeda will likely throttle delivery.

`[TBD — Roi: add 1-2 more real positive examples from Aiweon's prior work if possible.]`

---

## 9. Hard constraints Claude must enforce before returning copy

Every copy variant Claude produces must pass **all** of these programmatic checks:

1. **No forbidden phrase from §3** appears (case-insensitive, substring match).
2. **Headline ≤ 7 words**.
3. **Primary text opening ≤ 120 characters** before first paragraph break.
4. **One gender register per ad** — no mixing masc/fem verbs within the same copy block.
5. **CTA is from the approved list (§4)** for the current objective — or flag the gap.
6. **No more than 1 exclamation or question mark** in headline; ≤ 2 across entire primary text.
7. **Emoji count ≤ 1** per ad, placed at end only.

When a variant fails any check, regenerate rather than relaxing the rule.

---

## 11. Operator-facing rationale (`rationale`, `summary` fields)

> **This section applies to the agent's reasoning output shown to Roi — not to customer ad copy.** §§2-9 govern what the customer sees on Facebook/Instagram. §11 governs what Roi sees in the approvals UI and in `agent_decisions`.

### Why this matters

**Assume the reader is not a marketing or ads professional.** The operator (Roi today, an Aiweon teammate or client tomorrow) may have zero exposure to Meta jargon. The first paragraph of every rationale must be readable *and speakable aloud* by such a reader — they decide approve / reject / investigate from paragraph 1 alone, without consulting a glossary or asking what an acronym means. If you would not say it to a friend over coffee, do not write it in paragraph 1.

Acronyms buried in paragraph 2 (with first-use glosses) are fine; acronyms in paragraph 1 are not — they force the operator to translate before they can think.

### Hard rules for every `rationale` field

1. **Open with a TL;DR.** One sentence, ≤ 20 words, plain Hebrew that someone outside the field can read aloud and immediately understand. No English acronyms (CPM, CTR, ROAS, CPA, CPR), no internal Meta state names (LEARNING_LIMITED, ACTIVE), no metric names that need translation (hook rate, frequency, benchmark). Substitute the everyday-Hebrew equivalent: "Meta לא מצליחה למצוא לקוחות בעלות הגיונית", "הקמפיין עוד לא הספיק ללמוד מי הקהל הנכון", "רוב התקציב לא נוצל". The TL;DR answers three questions in one breath: *מה הבעיה? למה זה קורה? מה מוצע?* Blank line after the TL;DR.

2. **Then the analysis.** Detailed reasoning with numbers and evidence. Here acronyms are allowed **on first use** with a short Hebrew gloss in parentheses:

   | Acronym | First-use gloss |
   |---|---|
   | `CPM` | CPM (עלות לאלף חשיפות) |
   | `CTR` | CTR (אחוז הקלקות) |
   | `CPA` | CPA (עלות להמרה) |
   | `CPR` | CPR (עלות לתוצאה) |
   | `ROAS` | ROAS (החזר על הוצאת פרסום) |
   | `Andromeda` | Andromeda (מנוע ה-ML של Meta מ-דצמבר 2024) |
   | `LEARNING` / `LEARNING_LIMITED` | תקוע בלמידה (Meta state: `LEARNING_LIMITED`) |
   | `Advantage+ Audience` | Advantage+ Audience (הרחבת קהל אוטומטית של Meta) |

   After first use in the same rationale, the acronym alone is fine.

3. **No hype or sales voice.** This is diagnostic prose for an operator, not ad copy. The §3 forbidden list (`מהפכה`, `בלעדי`, `!!!`, `חינם!!`) is doubly out of place here. Write like a junior analyst briefing a senior one — factual, specific, short.

4. **Link action to diagnosis, not symptom.** Weak: *"מוצע להרחיב קהל כי ה-CPM גבוה."* The CPM being high is a *symptom*. Strong: *"הקהל צר מדי כך ש-Meta לא מצליחה למצוא המרות; הרחבה תאפשר ללמידה להתקדם."* The diagnosis explains what the action fixes and why.

5. **Numbers earn their place.** Every number in the rationale either anchors the decision (`CPM 128 לעומת 8.38 — פי 15`) or is irrelevant and should be cut. Don't pad with metrics that didn't drive the proposal.

### `summary` field — the one-line version

`summary` appears in queue lists and the decision feed. Rules:

- Hebrew, ≤ 70 characters.
- Pattern: `<פעולה> ל<יעד> — <סיבה בקצרה>`.
- ✅ `הרחבת קהל לקמפיין Aiweon-Leads — תקוע בלמידה 20 יום`
- ❌ `expand_audience on 120243246572990443 — CPM 128x benchmark`

Use the campaign's human name when available (not the Meta numeric ID). Use Hebrew for the reason even if the underlying metric is English.

### Worked example — the "הרחבת קהל" case

**❌ Before (jargon-first — what the UI currently shows):**

> USD 128 CPM בשבוע האחרון לעומת benchmark ישראלי USD 8.38 — יחס של פי 15. זהו סימן חד-משמעי לקהל צר מאוד שמונע מהקמפיין לצבור המרות ולצאת מ-Learning. הקמפיין פעיל 20 ימים ועדיין ב-LEARNING_LIMITED עם 5 לידים בלבד. מעבר ל-Broad Targeting עם Advantage+ Audience יוריד את ה-CPM, יגדיל את החשיפה לקהל רלוונטי, ויאפשר ל-Meta למצוא קונברטורים בעלות נמוכה יותר. CTR 2.36% מראה שהבעיה היא בגודל הקהל, לא בקריאייטיב.

Problem: an operator without ads background can't tell what this says until sentence 3. "CPM", "benchmark", "LEARNING_LIMITED", "Advantage+" all demand translation before the argument lands.

**✅ After (TL;DR-first):**

> הקמפיין עולה פי 15 מהממוצע בישראל כי הקהל צר מדי, ועדיין לא מצליח ללמוד אחרי 20 יום. מוצע להרחיב קהל כדי לאפשר ל-Meta למצוא המרות בעלות סבירה.
>
> הנתונים: CPM (עלות לאלף חשיפות) 128 USD לעומת ממוצע ישראלי 8.38 USD. הקמפיין פעיל 20 יום, 5 לידים, תקוע בלמידה (Meta state: `LEARNING_LIMITED`) — Meta לא מקבלת מספיק המרות לאופטימיזציה. CTR (אחוז הקלקות) 2.36% מראה שהקריאייטיב עצמו עובד; הבעיה בהיקף הקהל. המעבר ל-Broad Targeting עם Advantage+ Audience (הרחבת קהל אוטומטית של Meta) מרחיב את מאגר הקהל פי כמה.

Why this works:
- Paragraph 1 answers *מה / למה / מה מוצע* without a single acronym — the operator can approve or reject here.
- Paragraph 2 has the numbers an expert can validate, with acronyms glossed on first use.
- Action is linked to diagnosis (הקהל צר → הרחבה), not to symptom (CPM גבוה → הרחבה).

### When to break these rules

Never. This is the operator's daily interface — consistency beats cleverness. If the TL;DR is hard to write because the signal is ambiguous, that's a data-sufficiency issue — log a `skip` decision per [performance-brain §6.4](performance-brain.md#64-data-sufficiency) instead of forcing a weak proposal.

---

## 10. Update protocol

**Owner:** Roi (admin@aiweon.co.il).

**Iteration triggers:**
- Phase 2 first creative batch shows systematic issues (e.g., Claude keeps producing a pattern Roi flags as off).
- A creative variant underperforms 2 consecutive weeks and voice contribution is suspected.
- Aiweon team requests a voice shift (new positioning, new audience segment).

**Edit discipline:**
- Small lexicon adds (1-2 words) → Roi edits directly, no approval loop.
- Structural rewrites (§2 dimensions, §5-6 rules) → open a new session, diff the change in `docs/plans/decisions-log.md` as an amendment to §1.5.

**Version marker:** update the date at the top of this file on every non-trivial edit.
