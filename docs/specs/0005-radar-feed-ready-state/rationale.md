# 0005. Radar feed ready state and run strip: rationale

## Context

Radar's Scenario tab (`apps/web/src/references/RadarReference.tsx`) opens with four metric cards and two charts already filled in, all from the scenario's imported Plaid Sandbox history. The only sign of the live feed is a small Live switch in the top bar (spec 0003, `RadarLiveSwitch.tsx`), whose status sits next to it as one word and whose explanations hide in a tooltip. A viewer landing on the page cannot tell whether they are looking at a finished run, a live one, or nothing at all; after a reload, numbers from before look the same as numbers now.

Specs 0003 and 0004 treat the imported history as real data: the chart's base counts (0004 AC-7, AC-8) come from it, and a feed's revealed payments are added on top of it, one every 3 seconds. Once merged, a run's contribution is invisible: nothing on the page says "this run added 12 HOLD payments and saved 12 cases". The feed's own progress counter (`appended_event_count`) counts every revealed event, including incoming money that is never decided, so it cannot be compared with the decided counts either.

The failure states (busy, unavailable, worker not running) are only a short word in the top bar, and the fix (for example, starting the API with `SIMULATION_WORKER_ENABLED=true`) lives in a tooltip. The project's Session area already follows the usual empty state pattern (one empty state with a run button before any run, `context/ui_context.md`), so the Scenario tab is the odd one out.

This is an enhancement to the web app (`apps/web`) plus one additive field on an internal API response (`apps/api`, contract version "0"). No schema change, no new tool, no new environment variable.

## Options considered

### Option 1: Ready panel with history kept, becoming a run strip

A compact panel above the cards explains the idle state and offers Start; once live it becomes a strip with this run's own counts, fed by a small `run` block on the decisions response. The history stays on screen at all times.

**Pros**:
- The page is never ambiguous: idle, live, finished and failed each read differently.
- Keeps specs 0003 and 0004 true; the chart and cards don't change meaning.
- Makes the run's own effect visible, which the merged charts hide.

**Cons**:
- Adds a small API change and a new component to maintain.
- The page is still busy on first load; a viewer sees numbers before doing anything.

### Option 2: Truly empty until start

Cards show placeholders and charts show empty frames under one init panel; history and live payments appear together once the viewer starts.

**Pros**:
- The cleanest first impression and demo moment.
- No numbers to misread before the viewer acts.

**Cons**:
- Hides real data the viewer can explore without a feed, and every scenario switch goes blank again.
- Changes what 0004's chart shows on load (AC-8), and still doesn't separate the run's contribution once the history appears.

### Option 3: Fix in place, better switch status only

Keep the layout; enlarge the top bar status and move tooltip text into a visible line under the switch.

**Pros**:
- The least to build, no API change.

**Cons**:
- The idle state still reads as "numbers with a toggle"; no clear starting point.
- No per run counts, so the live effect stays hidden in the merged charts.

## Rationale

The core problem is ambiguity, not clutter: the history is real and useful, but the page never says whether a feed is running or what it added. Option 1 fixes both with one element, and it is the pattern monitoring dashboards use (history by default, a clear sign of whether the live stream is on). It keeps 0003 and 0004's data meaning intact, so no built and verified behaviour is rewritten, which the project's workflow rules ask for.

Option 2 buys a cleaner first frame at the cost of hiding real data and still leaves the run's contribution merged into the history once it appears. Option 3 is cheap but leaves the two real gaps (no starting point, no per run counts) open.

The run counts come from the API, not the web: the server already has the run's revealed events and their `case_status`, so one grouped query in the existing decisions read gives exact numbers, including cases saved, in the fetch that already happens on every payment. Working it out in the browser would double the requests and still couldn't show cases saved.
