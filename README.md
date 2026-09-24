# Apni Policy — product walkthrough demo

A static, twenty-screen walkthrough of **Apni Policy** ("See your coverage. Know your
path."), a coverage-aware admission intelligence prototype built for **Smart India Hackathon
2026** — Problem Statement **SIH26198**, Theme MedTech / BioTech / HealthTech, PS Category
Software, by Team **Bit BanditX** (Team ID 142665). Every screen is real, interactive HTML —
no screenshots, no framework, no build step, no network requests.

## How to open it

- **From disk:** double-click `index.html`. It works over `file://` with zero console errors
  and zero network requests. The engine self-test logs its results to the console on load.
- **From GitHub Pages** (or any static host): push the folder as-is. There is nothing to build.

Files:

```
index.html            two nav bars, twenty <section> tiles, phone markup per screen
assets/favicon.svg    the mark: ink tile, white A, one bar — two shapes so it holds at 16px
assets/tokens.css     :root tokens and typography utility classes, nothing else
assets/styles.css     layout, tiles, nav bars, phone frame, in-phone components
assets/constellation.js  the light-mode monochrome mesh background (canvas, no DOM reads)
assets/vendor/gsap/   GSAP 3.13.0 vendored locally (core + ScrollTrigger, Flip, MotionPath, DrawSVG, SplitText) — no CDN
assets/engine.js      pure rules engine + roomBySegments/combinePolicies/roomRentLineage/roomTypeScenarios/hospitalScenarios/claimMemoryInsight + runSelfTest (no DOM access)
assets/app.js         hash routing, screen switching, control binding, rendering, state, GSAP motion (guarded)
```

`engine.js` does arithmetic only; `app.js` does no arithmetic. The split mirrors the product's
claim that a deterministic engine owns every rupee and nothing else touches a number. GSAP is
vendored under `assets/vendor/` and loaded from disk — motion is fully guarded, so a missing
plugin or `prefers-reduced-motion` degrades to the static layout with no console error.

## The twenty screens

Four phases · Get set up · Add your policy · Check an admission · Through the stay

The Surface column records the original tile assignment. Since the monochrome redesign every
tile is transparent over the white mesh, so the column now reads as history, not as colour.

| # | Screen | Surface | What works |
|---|--------|---------|------------|
| 01 | Arrive | tile-1 (dark) | hero CTA, "What this is not" inline disclosure, launch screen |
| 02 | Register and verify | canvas | +91 number input gated on ten digits; "Send code" reveals six auto-advancing OTP boxes in the same screen (Backspace step-back, paste support, 30s resend); Change-number returns to entry — the former Register and Verify screens, merged |
| 03 | Consent | tile-2 (dark) | three individually-stated DPDP purposes, none pre-ticked, third genuinely optional, withdrawal link |
| 04 | Who you are admitting | canvas | relationship chips, patient name/age, optional ABHA ID; "Fetch details with consent (ABDM)" simulates a consent-based pull on-device, filling the fields from a synthetic record with no network |
| 05 | Add the policy | parchment | working drag-and-drop and file input, three recomputing sample chips (A preselected) |
| 06 | Multiple policies, one estimate | canvas | employer policy plus a toggleable personal top-up; the combined figure is `combinePolicies()` layering the top-up over the same admission above a deductible; aria-live announces the recompute |
| 07 | Reading it | tile-1 (dark) | OCR scanned-page step (scan-line sweep over a document) precedes extraction; determinate progress bar (~2.5s), fields appearing one by one, Skip link, instant under reduced motion |
| 08 | Confirm what we read | canvas | editable extraction rows, each with a per-field confidence bar and the source clause it was read from; two below-threshold fields flagged; edits recompute everything downstream |
| 09 | Your policy, in plain terms | parchment | first derived figure (₹5,000 = engine, not policy text), model-written cards each carrying the boundary notice, exact-wording extract |
| 10 | The same number, every language | canvas | the same engine shortfall stated in English, Hindi and Marathi; language chips reprint the sentence (SplitText word reveal), the figure is `computeCoverage()` output, identical across languages |
| 11 | Where this number comes from | canvas | clause → structured rule → formula → calculation → rupee chain for the ₹5,000/day figure, `roomRentLineage()` output; cards build and DrawSVG traces the connectors between links; moves with the sum insured/cap upstream |
| 12 | Choose the hospital | parchment | four selectable hospitals with per-day room rates, each row showing its own real outcome via `hospitalScenarios()`; the pick writes name, city and rate into state, so the estimate, verdict and settlement all move with it; a stated warning that the list is invented and not a network lookup |
| 13 | Start an admission | canvas | hospital/city read-only (carried from 12, with a Change link back); procedure/room/rate/LOS inputs; estimate row rebuilt by the engine (₹2,90,000) |
| 14 | Room-type digital twin | parchment | the same admission priced across general/twin/private rooms by `roomTypeScenarios()`; selecting a room animates the active card (Flip) and shows how the cap bites harder as the room climbs; mid-stay per-day-segment note included |
| 15 | The verdict | tile-1 (dark) | sliders in the narrative column drive live recomputation in the phone; ratio strip speaks in words at 100%; settlement table; cause-attributing callout; aria-live summary |
| 16 | What to do now | canvas | three action cards whose impact figures recompute from the same engine call as the verdict |
| 17 | Settlement | tile-3 (dark) | final figures, estimated-vs-actual comparison (engine run twice), honest limits, national statistics with sources |
| 18 | Claim memory | canvas | how close past estimates landed to the settled figure, summarised by `claimMemoryInsight()` over a synthetic history; within-band rate counts up (GSAP), no forecasting claimed |
| 19 | Hospital / TPA desk view | canvas | the same Sample A settlement re-addressed to the admissions desk — insurer payment, patient exposure and the room-rent rule, all identical engine outputs; kept inside the phone frame |
| 20 | How it connects | canvas | interoperability diagram — DrawSVG traces the pipeline spine, nodes fade in, a pulse rides the path (MotionPath); shows ingestion → OCR → extraction → engine → explanation → desk as connected stages |

Navigation works four ways: step dots, Back/Continue, `←`/`→` keys (ignored while typing),
and deep links such as `#/15-verdict`. Slugs carry the position number; the code addresses
screens by descriptive suffix (`goto('verdict')`), so reordering the deck never breaks a link.

## The interface: monochrome, light, one accent that is black

The demo was redesigned to a single-hue system. There is no brand colour: white surfaces,
near-black ink (`#0a0a0a`), and one grey ramp. State is carried by fill, weight and position
rather than hue — a selected chip inverts to black, the current step dot stretches to a
capsule, the coverage ratio is a black bar on a grey track. That removes the whole class of
"is this blue readable on that surface" problem the earlier palette had, and every text pair
now clears 4.5:1 on white.

The five formerly dark screens (01, 03, 07, 15, 17) are light like the rest; their
`tile--dark` classes remain in the markup but no longer carry any styling, so the phone is
the only dark object on the page and stays the focal point.

Behind everything sits `constellation.js` — a fixed canvas mesh of spring-anchored nodes
(Hooke's law, damped) that recoils from the cursor and settles back. It is monochrome,
`pointer-events:none`, and light-mode only, matching `color-scheme: only light` on the
document. Two changes from the reference implementation it was ported from: connections are
precomputed once as grid-neighbour pairs rather than distance-tested all-pairs every frame
(476 nodes, 1,771 links instead of ~113,000 pair tests per frame — it self-tests this count
on load), and the accent-coloured hex coordinate readouts were dropped as noise in a
monochrome system. Under `prefers-reduced-motion` the mesh paints one static frame and the
screen-entrance animations do not run. All GSAP motion added on top — the entrance timeline
and the per-screen effects (Flip on the room-type twin, DrawSVG on the lineage connectors and
interop spine, MotionPath pulse, SplitText language reveal, count-up on claim memory) — is
guarded on the plugin being present and reduced-motion being off, so it degrades to the static
layout offline or under reduced motion without a console error.

## The two deviations from DESIGN-apple.md, deliberately made

1. **No Inter, no webfont request.** The md file suggests Inter as the SF Pro substitute on
   non-Apple platforms. Loading it would break the no-network constraint this demo runs under,
   and the demo will be judged on Windows. The system stack is used instead —
   `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` — which is
   genuine SF Pro on Apple devices and Segoe UI Variable elsewhere. The md file's compensation
   guidance is applied unconditionally rather than by sniffing: display letter-spacing carries
   an extra `-0.01em` (via `calc()` against the specified values), and body line-height is
   tightened from 1.47 to 1.44.

2. **`#8e8e93` carries no text.** The md file assigns its ink-muted-48 step to fine print and
   disabled text. At 10–12px, fine print needs 4.5:1, which that step does not clear on white.
   All fine print and micro-legal copy uses `#6e6e73` (5.07:1 on white); `--ink-48` survives
   only on disabled controls (disabled Back button, disabled primary buttons, disabled cap
   inputs), where contrast requirements do not apply. The monochrome redesign made this moot
   for the mid-greys the md file assigned to links, since links are now ink.

Two smaller decisions, noted so they read as choices rather than misses:

- **The "What to do now" screen's first impact figure is anchored to the live slider state**
  (as §6 requires twice: "recomputed from the same engine call", "change the room-rate slider
  there and this number moves"). At the worked case it reads ₹71,250. If the room rate is then
  dragged down to ₹5,000 on the verdict screen, the ratio bar reads 100%, the label speaks the
  words "No proportionate deduction applies", and the impact figure honestly falls to ₹0 — at a
  ₹5,000 room there is no deduction left to reverse and no gap left to close, so any other
  figure would be wrong arithmetic. This is the one reading of the acceptance list we resolved
  in favour of the engine over the checklist's letter.

- **The "What to do now" screen's "Download the breakdown" uses the standard light-surface
  link**, not `text-link-on-dark` as the brief names it. The link renders *inside the phone*,
  whose canvas is white, and the brief's on-dark link colour would have measured roughly 3.3:1
  there. Since the redesign both link styles resolve to ink on white (18.9:1), so the
  distinction is now only historical.
- **The room-cap slider keeps its specified range (0.5–2.0)** and is disabled, with an
  explanatory line ("This policy has no room-rent cap…"), when Sample C is active, since a
  no-cap policy cannot be represented inside 0.5–2.0 without inventing a value outside the
  brief. Reset returns the demo to the Sample A worked case.

## Every figure, and where it comes from

**Synthetic worked case (Sample A) — invented for this demo, labelled synthetic throughout:**
sum insured ₹5,00,000; room-rent cap 1% per day; ICU limit 2% per day; co-pay nil; initial
waiting period 30 days; pre-existing conditions 36 months; room billed ₹8,000/day; stay
5 days; associated medical expenses ₹1,50,000; pharmacy ₹40,000; ICU ₹60,000; hospital
estimate ₹2,90,000; "Sample General Hospital" and "Specimen"-style samples are fictional.

**Engine outputs — deterministic arithmetic on the above, verified by self-test:**
eligible room rent ₹5,000/day (derived, not extracted); coverage ratio 62.5%; insurer pays
₹2,18,750; you pay ₹71,250; proportionate deduction ₹56,250; lower-room-charge component
₹15,000; protected-head carve-out worth ₹37,500 when toggled; Sample B (₹10,00,000 at 2%)
yields ratio 100% and shortfall ₹0; Sample C carries no cap and the UI says the clause does
not apply; sum-insured-exhaustion case attributes ₹70,000 separately from deduction losses;
per-day segment case pays ₹21,000 of ₹30,000 billed; the multi-policy layer (`combinePolicies()`)
has a ₹5,00,000 personal top-up absorb ₹21,250 of Sample A's ₹71,250 gap above a ₹50,000
deductible, leaving ₹50,000 for the patient; the room-rent lineage (`roomRentLineage()`) returns
the same ₹5,000/day the verdict uses; the room-type twin (`roomTypeScenarios()`) prices the
same admission at general/twin/private rooms, so the general ward pays ₹0 while the private
room pays ₹71,250; the hospital picker (`hospitalScenarios()`) gives each of the four hospitals
its own real outcome for the same admission; the multilingual screen prints the identical
shortfall in three languages (`computeCoverage()` output, not re-typed); and claim memory
(`claimMemoryInsight()`) summarises a synthetic estimate-vs-actual history without forecasting.
All fourteen checks log PASS in the console on load (`runSelfTest()`, invoked once when the
engine loads in the browser).

The ABDM consent pull (screen 04), the OCR scanned-page step (screen 07), and the per-field
extraction confidence + source clause (screen 08) are demonstrative display only — a fixed
synthetic record and static provenance labels, run entirely on-device with no network and no
coverage arithmetic, so they live in `app.js`, not the engine.

One error was corrected rather than copied: source material stating that a ₹50,00,000 policy
at a 1% cap yields ₹5,000/day is arithmetically wrong (that is ₹50,000/day). This demo uses
₹5,00,000 everywhere.

**Real-world figures, cited where they appear on screen:**

- Alight Solutions advocacy programme, Validation Institute audit: 713,571 cases; 21.3%
  average savings; 27.9% when the member engaged before their first provider visit vs 13.7%
  after — screen 13 narrative, attributed as someone else's validated result.
- IRDAI Master Circular, May 2024: cashless pre-authorisation decided within 1 hour;
  discharge authorisation within 3 hours; cost of delay borne by the insurer's shareholder
  funds — screen 16, card three.
- IRDAI Annual Report 2023-24: ≈₹1.2 lakh crore of health claims filed in FY24; 71.3% paid;
  ₹15,100 crore disallowed at settlement; ₹10,937 crore repudiated — screen 17 narrative.
- National Health Accounts 2021-22: out-of-pocket spending 39.4% of total health expenditure,
  down from 64.2% in 2013-14 — screen 17 narrative.
- Digital Personal Data Protection Act, 2023: consent must be free, specific, informed,
  unconditional and unambiguous, purpose-bound and withdrawable — screens 01 and 03.
- IRDAI 2020 standardisation of exclusions: pharmacy, implants and devices, diagnostics, and
  ICU charges protected from proportionate deduction — screens 09 and 15.

Every impact number the project quotes for itself (screen 17) is labelled a proposed pilot
target, with the metric named and a measurement method sketched. Nothing is presented as a
measured result.
