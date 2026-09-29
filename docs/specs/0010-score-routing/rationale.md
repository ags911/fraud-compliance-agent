# 0010. Score routing: decision record

## Context

The live feed (specs 0003, 0004, 0008) decides every outbound payment by its scenario's rule table: S01 PASS, S02 and S03 HOLD, S04 CHALLENGE, S05 HOLD. ADR-024 added a model score, trained on Sparkov synthetic data and served by a plain Python scorer, as display only evidence. The owner wants F3: a score that actually routes payments, using Sparkov as the demo corpus.

Three forces shape it. First, the accepted routing record (ADR-006) says deterministic controls come before any model, and the project's safety rules forbid a model overriding a hard control. Second, the only rule cleared payments are S01's, and measured on the dev dataset (2026-09-29) every normal S01 feed payment scores below 0.03 while S02 to S05 have medians from 0.40 to 0.68: the model agrees with the rules, so a model that can only escalate cleared payments would never visibly act. Third, a saved case must describe its decision honestly, and the frozen `public-showcase-events.v1` has no recommendation basis for "a threshold on a model score decided".

Also measured: against S01's real history (average payment £53), a payment 5 times larger to a familiar payee scores 0.95, and 10 to 20 times larger scores 0.52 to 0.62, while everyday amounts stay below 0.02.

Workspace: the monorepo's `apps/api` (FastAPI, psycopg on Neon) and `apps/web` (React); no new tool.

## Options considered

### Option 1: Keep the score display only

Leave spec 0004 and ADR-024 as they are.

**Pros**:
- Nothing to build; zero risk.

**Cons**:
- F3 never happens; the demo cannot show where a model adds value.

### Option 2: Escalate rule cleared payments, two thresholds, planted S01 outliers (chosen)

The score may raise a rule PASS to CHALLENGE or HOLD at thresholds derived from Sparkov test precision; about 1 in 20 S01 feed payments is a planted large outlier the rules still clear.

**Pros**:
- Keeps deterministic controls first and can only add review work.
- Visible, explainable, and every threshold has evidence.

**Cons**:
- The outliers are planted, so the demo proves mechanics, not detection.
- Three contract versions move at once.

### Option 3: Escalate any rule decision

Let the score also raise S04's CHALLENGE to HOLD (S04's median score is 0.63).

**Pros**:
- Visible with no new data.

**Cons**:
- Changes an outcome the recorded investigation already settled, and still never shows the model catching something the rules missed.

### Option 4: Two way routing

Let the score also relax rule HOLDs and CHALLENGEs to PASS.

**Pros**:
- The most dramatic movement on the board.

**Cons**:
- A Sparkov score overriding a hard control contradicts ADR-006 and the project's safety rules; a wrong score could let a risky payment through.

## Rationale

Option 2 is the only one that shows the real value of a model in a fraud engine, catching what rules clear, without weakening a control. The measured scores make the need for planted outliers concrete: the model correctly leaves normal S01 payments alone, so without an unusual payment there is nothing for it to catch. The drawer states that the outliers are planted, which keeps the demo honest.

Thresholds come from precision on the chronological Sparkov test split because precision reads plainly to a visitor ("at HOLD, 9 in 10 flagged Sparkov payments were fraud") and because a rule, not a hand picked number, can be rerun when the model changes. The alert rate fallback exists because the HOLD precision target may be unreachable on this model.

A new event contract version (v2), rather than stretching v1, keeps every existing case and the Run showcase stream exactly as accepted, and puts the honest basis (`model_threshold`) where the case story needs it. The snapshot and case summary changes are purely additive, so they are minor versions.

Decided by the architect (not asked): outliers sit at sequences 10, 30, 50 and so on so the first appears 30 seconds into a feed (runner up: a random 5% chance, rejected because a demo should behave the same every time); the multiplier range 5 to 20 follows the measured scores (tuned to 7 to 9 during the build, when 5 to 20 raised only 6 of 10 outliers on the S01 dataset; see AC-6) (runner up: a fixed 10, rejected because varied amounts make the board less mechanical); the policy loader verifies a pinned digest like the model does (runner up: trusting the file, rejected for consistency with ADR-024).
