# Clara Playwright Spike — Operator-Driven

**Status:** TODO — needs an operator with Aiweon's Clara credentials to run.
**Blocker for:** Phase 3 of [`../plans/clara-video-flow.md`](../plans/clara-video-flow.md). The Clara client selectors and auth strategy come from this doc.

---

## Goal

Drive [clarasocial.com](https://clarasocial.com/app) by hand with Playwright codegen recording. Capture exactly:

1. The login flow (URL, form selectors, anything between login and the prompt input).
2. The prompt-submission flow (where the prompt goes, how photos upload).
3. The render-wait + download flow (where the finished video lives, how to download).
4. Any captcha / 2FA / rate-limiting we hit during automation.

The output is the data we need to implement `campaigner/lib/clara_client.py` without guesswork.

---

## How to run

From a host with Chromium and Aiweon's Clara credentials:

```bash
pnpm dlx playwright codegen https://clarasocial.com/app
# or, if Playwright is already installed globally:
npx playwright codegen https://clarasocial.com/app
```

The codegen window records every action as a Python (or JS) script. Drive the full happy path once with the recording on:

1. Log in with `CLARA_EMAIL` / `CLARA_PASSWORD`.
2. Start a new generation.
3. Upload 2 source photos (use anything for the spike — a JPEG from disk is fine).
4. Type a Hebrew atmosphere prompt — same one we'll send from production. Example:
   > מסעדת שף בראשון לציון עם תפריט ים-תיכוני מודרני — כלים פשוטים ויפים, אור טבעי שנכנס בערב, אנשים שוקעים בשיחה.
5. Submit. Wait for render (clock it — see §3 below).
6. Download the finished MP4.

Save the codegen output to `clara-codegen-<date>.py` next to this file (gitignored — it carries selectors that may have credentials in line). Distill the findings into the sections below.

---

## 1. Auth findings — TODO

Fill in once the codegen run completes:

- [ ] **Login URL:** `https://clarasocial.com/...`
- [ ] **Email field selector:**
- [ ] **Password field selector:**
- [ ] **Submit button selector:**
- [ ] **Post-login URL pattern:** what URL are we on after a successful login?
- [ ] **2FA prompt?** (yes / no — if yes, the env-var auth strategy needs to change to persisted-session per `clara-video-flow.md` §11 risk #1)
- [ ] **CAPTCHA?** (yes / no — if yes, same)
- [ ] **Session cookie name(s):** which cookie holds the auth state? (for the persisted-session fallback)
- [ ] **Login failure messaging:** what's the page state when creds are wrong? (so the client can detect + raise a clean error)

---

## 2. Prompt-submission flow — TODO

- [ ] **Entry URL:** the URL where a new generation starts
- [ ] **Prompt textarea selector:**
- [ ] **Photo upload trigger selector:** the button that opens the file chooser
- [ ] **Photo upload accepts:** how many photos can be uploaded at once? File types? Max size?
- [ ] **Submit / generate button selector:**
- [ ] **Hebrew RTL handling:** does the prompt textarea render Hebrew correctly? Any LTR-only fields we need to be aware of?

### Brand fields (logo, business name, CTA URL)

Per [`../plans/clara-video-flow.md`](../plans/clara-video-flow.md), Flow I auto-injects `business_name`, `logo_url`, and `default_cta_url` from `business_knowledge`. Confirm where each goes in Clara's UI:

- [ ] **Business name field:** is there a brand-name form field, or do we embed in the prompt text?
- [ ] **Logo upload:** can we attach a logo asset separately, or is it just another source photo?
- [ ] **CTA URL:** where is the destination link configured? (per-video setting, account-wide, embedded in prompt?)

---

## 3. Render + download flow — TODO

- [ ] **Render time:** roughly how long from submit → ready? (matters for the daily runner's timeout)
- [ ] **Ready state selector:** what element on the page indicates "video is ready" so Playwright knows when to stop waiting?
- [ ] **Download button selector:**
- [ ] **Downloaded filename pattern:** (e.g. `clara-<id>.mp4`)
- [ ] **MIME type + container:** `video/mp4`? Anything else?
- [ ] **Default aspect ratio:** is 9:16 the default, or selectable per-generation?
- [ ] **Audio:** is sound on by default? Confirm before going to production (per plan, briefs assume "yes").
- [ ] **Video URL persistence:** does Clara keep generated videos accessible at a stable URL, or only via download from the page? Determines whether we download once on Flow I or can reuse a stable URL later.

---

## 4. Failure modes — TODO

Try a few things that should fail, and note what Clara does:

- [ ] **Bad credentials:** what does the page look like?
- [ ] **Render rejection (e.g. inappropriate prompt):** does Clara reject the prompt? With what error?
- [ ] **Photo upload too large / wrong format:** what error?
- [ ] **Rate limit (rapid-fire submissions):** is there a daily / hourly cap? What does it look like when hit?
- [ ] **Session expiry mid-flow:** if we leave a session idle for an hour, does it expire? With what indicator?

---

## 5. Recommendations — TODO

Once §§1-4 are filled in, write the final call:

- **Auth strategy:** stay on env-var login per plan (default), or switch to persisted-session due to captcha/2FA?
- **Daily runner timeout:** plan says Flow I has a budget; set the Playwright `page.wait_for_selector` timeout to ~2× the typical render time measured in §3.
- **Source photo limit:** if Clara accepts more than 3, do we send 2-3 anyway (per plan), or relax to whatever Clara likes best?
- **Implementation gotchas:** anything that the agent's `clara_client.py` needs to be careful about (e.g., Hebrew prompt requires a specific input event, video URL only valid for N minutes after render).

---

## After the spike

When this doc is complete, Phase 3 of [`../plans/clara-video-flow.md`](../plans/clara-video-flow.md) is unblocked. Drop a one-liner in the conversation and the build resumes from `campaigner/lib/clara_client.py`.
