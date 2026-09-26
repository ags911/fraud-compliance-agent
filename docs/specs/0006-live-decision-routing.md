# 0006. Live decision routing

**Date**: 2026-09-24
**Status**: Proposed

## Summary

The Cases tab gains a small live routing board. New simulated payments enter from one input stream and visibly settle in PASS, CHALLENGE, or HOLD lanes. The board is read only and uses the existing deterministic feed decisions. It is shown by default, and one "Hide board" button lets a viewer stop its motion and reclaim the space without stopping the feed; that choice is remembered in the browser. The existing internal feed stream gains a minimal routing snapshot, but there is no new score, policy, stored data, or public API.

## Context

The current Scenario chart shows totals over time and the Cases tab refreshes saved case rows. Neither surface shows the moment a live payment receives its deterministic recommendation. A fixed routing board makes that event legible without implying that a viewer can change a decision.

The existing `sandbox_simulation_events` schedule holds 200 payments per S01 to S05 run. `sequence` is unique and increasing within `run_id`, and `appended_at` marks a revealed payment. Rendering every settled payment indefinitely would make the board hard to read. Each outcome lane therefore keeps its 18 newest visible tokens and represents older settled tokens in its lane count.

## Requirements

**User stories**:

1. As a demo viewer, I want to see each new feed payment settle in its final outcome lane so that I can understand the deterministic routing as it happens.
2. As a reviewer, I want the routing board to be clearly read only so that I never mistake it for a tool that can alter a payment decision.
3. As a viewer reading the Cases table, I want to hide the moving board without stopping the feed so that the motion does not distract me and the table gets the space back.

**Acceptance criteria**:

1. **AC 1**: While the selected scenario has a live or finished feed run, the Cases tab displays a board with one input stream and three labelled outcome lanes, PASS, CHALLENGE, and HOLD.
2. **AC 2**: A newly revealed feed payment appears once, travels from the input stream to the lane named by its existing deterministic recommendation, and increments only that lane count.
3. **AC 3**: Each lane keeps at most 18 visible settled tokens. Earlier tokens are removed from the visible collection only, while the lane count continues to show every revealed feed payment in that outcome.
4. **AC 4**: The internal feed stream emits one `routing_decision` frame for every newly revealed payment, including only `event_id`, `sequence`, and `recommendation`. The browser reconnects with its last received sequence and the server replays every later revealed decision before continuing live frames.
5. **AC 5**: Each `simulation_state` frame includes a routing snapshot with the total count and up to 18 newest opaque revealed decisions for every outcome. The snapshot is one consistent read of the caller's run, ordered by descending sequence.
6. **AC 6**: The board is driven only by the existing feed state, routing frames, and routing snapshot. It neither writes data nor accepts route changes, and it does not display a model score or an invented risk value.
7. **AC 7**: With no live run, an unavailable feed, or an unsupported workflow scenario, the board shows an explicit quiet state and leaves the Cases table behaviour unchanged.
8. **AC 8**: Motion is reduced when the operating system requests reduced motion. The outcome and count remain visible without travel animation, and the board remains understandable below 700 pixels wide.
9. **AC 9**: While the chart is drawn, the board header has one disclosure button, "Hide board" or "Show board", with `aria-expanded` and `aria-controls` naming the chart area. It is visible by default. Hiding removes the chart and the screen reader count list; the "Last routed #N → OUTCOME" line and the rule note stay visible, and the polite routing announcement is unchanged. The choice is remembered in this browser across reloads and runs. It changes display only: the feed keeps running and no payment, run, or route is touched.

## Options considered

### Option 1: A conventional chart

A bar or funnel chart would show the aggregate count by outcome. It is compact but does not communicate individual routing events.

### Option 2: A fixed Motion routing board

A fixed input stream and three outcome lanes use Motion to show each new payment settling into its existing outcome. It provides the intended live classifier feel without editor controls.

### Option 3: A diagram editor

A general canvas library would support editable nodes and connections. That capability conflicts with the fixed, auditable decision flow and would add unnecessary interaction complexity.

## Decision

**Chosen option**: Option 2: A fixed Motion routing board.

The Cases tab will render a presentational routing board using the installed Motion package and existing feed state. It will not use a diagram editor or add a dependency.

**Implementation skills**: `payments-dashboard-consistency` (`local`, `/Users/darrengidado/.codex/skills/payments-dashboard-consistency`)

## Rationale

The board makes the current deterministic route visible at the right level of detail. It remains truthful because its lane is always derived from the stored recommendation, and it remains legible across a full run because token retention is bounded. Motion fits this one direction visual transition and is already part of the web application.

## Feature design

**Data model sketch**:

No database change. The internal stream gains `routing_decision` frames and a `routing_snapshot` field read from already stored feed decisions. The component creates ephemeral display tokens from the decision frames and seeds settled tokens from the snapshot without replaying their animation. A token has `eventId`, `recommendation`, and an arrival sequence. Tokens exist only in browser memory and are discarded on run, scenario, or tab change.

**State transitions**:

`unavailable` becomes `idle`, `live`, or `finished` from the existing feed state. A new decision record creates an entering token, then a settled token in exactly one lane. A lane removes its oldest settled token when its visible collection exceeds 18.

The display preference is separate from the feed state: `shown` (default) and `hidden`, switched only by the disclosure button. It is stored in `localStorage` under `radar-routing-board-hidden` (value `"1"` when hidden, removed when shown). Every read and write is wrapped in `try`/`catch` (private windows and blocked storage throw), and any failure or unknown value means `shown`. Nothing else reads or writes that key.

**API surface**:

No new endpoint. The existing internal `GET /sandbox/simulation-runs/{run_id}/events` stream accepts optional `after_sequence` and adds two frame types:

| Event | Payload | Rule |
|---|---|---|
| `routing_decision` | `{ event_id, sequence, recommendation }` | all revealed rows where `sequence` exceeds `after_sequence`, then one for each later reveal |
| `simulation_state` | existing safe run state plus `routing_snapshot` | emitted after replay and whenever state changes |

The server validates `after_sequence` as a nonnegative integer. It reads only rows belonging to the owned run where `appended_at IS NOT NULL`, ordered by increasing `sequence` for replay. The browser saves its highest received sequence per active run and sends it after reconnect. A stream failure moves the board to unavailable. Cancelled, failed, and completed runs retain their last snapshot until the current page leaves the run.

Each `simulation_state` frame adds this field:

| Field | Shape | Limit |
|---|---|---|
| `routing_snapshot` | `by_recommendation` map for PASS, CHALLENGE, HOLD | required |
| `routing_snapshot.*.count` | integer count of every revealed payment in that outcome | not truncated |
| `routing_snapshot.*.recent` | ordered `{ event_id, sequence, recommendation }` items | newest 18 per outcome |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Board state | idle, live, finished, unavailable, unsupported | existing `useSandboxFeed` state |
| Input token | each newly revealed payment | one authoritative `routing_decision` stream frame |
| Outcome lane | PASS, CHALLENGE, HOLD | `recommendation` on the opaque decision item from the stream |
| Lane count | all revealed payments in that outcome | `routing_snapshot.*.count` from the stream |
| Visible token order | newest first | `sequence` on the decision item or snapshot |
| Motion preference | animated or reduced motion | operating system reduced motion preference through Motion |
| Board shown or hidden | chart and count list, or the footer line only | browser `localStorage` key `radar-routing-board-hidden`, default shown |

**Key invariants**:

1. Every token has exactly one outcome lane.
2. The browser de duplicates by `event_id` and never reanimates a snapshot token.
3. Only 18 tokens per lane are visible, but no count is truncated.
4. A board token cannot create, edit, delete, or reroute a payment. The board's only control is the display disclosure (AC 9), which never sends a request or changes feed state.
5. The board never displays a model score, threshold, or risk value.

**Security model**:

The board is browser only and receives only the existing synthetic, browser scoped feed data. It introduces no new request, identifier, storage, or permission.

**Configuration required**:

None.

**Critical test scenarios**:

1. A live S02 feed emits a HOLD decision and the board adds one token and one count to HOLD, verifies **AC 1**, **AC 2**, and **AC 4**.
2. A reconnect after missed decisions replays each later sequence once and does not duplicate a seen event, verifies **AC 4** and **AC 6**.
3. Nineteen revealed payments in one outcome lane produce 18 recent items and a count of 19, verifies **AC 3** and **AC 5**.
4. A scenario without a payment schedule renders the quiet unsupported state, verifies **AC 7**.
5. Reduced motion settles a new token without travel animation while retaining the correct lane and count, verifies **AC 8**.
6. Pressing "Hide board" removes the chart and count list, keeps the last routed line, sets `aria-expanded="false"`, and survives a reload; pressing "Show board" restores the chart. Blocked storage still shows the board. The board has exactly one button, verifies **AC 6** and **AC 9**.

**Board layout (revised 2026-09-26)**:

The board is a one level Sankey from the EvilCharts registry (`@evilcharts/recharts-sankey-chart`, copied into `src/components/evilcharts/` by the shadcn CLI and built on the installed Recharts and Motion, so no new package). A Feed node flows into PASS, CHALLENGE, and HOLD nodes in that fixed order (`sort={false}`). Each node's label and count sit inside it. All three outcomes are drawn from the start, at zero before any payment, and outside workflow scenarios the chart shows even without a run. Each label shows its real snapshot count. Band sizes follow the counts, with a floor of 18% of the total (or 1 before any payment) so an empty or small outcome stays visible and labelled, so small outcomes are drawn larger than their exact share.

The chart is read only: nodes are not clickable, there is no tooltip, and its SVG takes no keyboard focus (the chart is hidden from assistive technology, so the count list carries the numbers). The chart area is 220 pixels tall, with `nodePadding` 42 and `minNodeHeight` 44, so every node fits its two line label and count (a zero included) and neighbouring nodes keep at least 8 pixels between them even when one outcome dominates. A lane whose outcome is at zero is drawn faint, so its floor width does not read as real flow. It renders in a `.dark` scope with the page's `--sev-*` outcome colours, because the Radar page is dark without a `.dark` class. The footer shows the newest decision ("Last routed #48 → CHALLENGE"). Screen readers get a list of all three counts, including zero, and a polite announcement when routing starts and finishes, not one per payment.

The newest payment shows as a short, outcome coloured sweep that travels from Feed along its own lane to the outcome node (about a fifth of the lane long, 0.9 to 1.6 seconds by lane length). The sweep is clipped to the curved lane, and only the lane animates: nodes never glow or pulse. Under reduced motion the lane tints in place with no travel. The chart redraws with the new counts on each `simulation_state` frame. The stream's `routing_decision` frames (**AC 4**) are still unbuilt, and the board does not need them.

A "Hide board" / "Show board" text button sits in the header beside the Synthetic and Read only pills (AC 9), styled like Radar's other pill buttons. It appears only while the chart would be drawn, not in a quiet state. It exists because the feed animates about every three seconds for a whole run beside the Cases table: a viewer needs a way to stop that motion (WCAG 2.2.2, Pause, Stop, Hide) and reclaim the space without cancelling the feed, which the Live switch would do.

## Build plan

1. Extend the internal simulation stream model, repository read, replay cursor, and stream tests with decision frames and the bounded routing snapshot, satisfies **AC 4** and **AC 5**.
2. Add a typed presentational routing board and a small feed token derivation helper, satisfies **AC 1**, **AC 2**, and **AC 3**.
3. Place the board above the Cases table and wire it to the existing selected feed state without any extra request, satisfies **AC 1**, **AC 6**, and **AC 7**.
4. Add Motion transitions and reduced motion handling, then style the desktop and narrow layouts in Radar's existing visual system, satisfies **AC 2** and **AC 8**.
5. Add the header disclosure with its guarded `localStorage` preference, and update the board test that asserted no buttons to allow exactly this one, satisfies **AC 6** and **AC 9**.
6. Add focused API and Playwright coverage for replay, snapshots, token retention, quiet states, and narrow viewport rendering, satisfies **AC 1** through **AC 9**.

## Consequences

**Positive**:

1. The live feed has a clear visual representation of deterministic routing.
2. The existing Scenario chart and Cases table retain their different jobs.

**Negative or tradeoffs**:

1. Older tokens are not individually inspectable on the board, so the table remains the detail surface.
2. Browser only display state resets after a reload, like the existing live presentation. The hide preference is the one exception: it persists, but only in that browser, so a viewer on another device sees the board again.
3. The board now has one button, so "nothing here can be pressed" is no longer literally true. The header copy says nothing here can be *changed*, which stays accurate, and the button is plainly a display control.

**Neutral**:

1. Existing deterministic rules, feed limits, and case saving remain unchanged. The internal simulation stream gains a safe additive field.

## Follow up

1. Consider a future case detail link only after the public case and feed contracts are accepted. It is outside this visual only scope.

## Migration plan

**Strategy**: no migration needed

**Phases**:

1. Add the board beside the existing Cases surface.

**Rollback**: revert the browser component and its styles. No persisted data or contract changes exist.

**Risks**: a fast feed could make lane changes distracting. The 18 token cap and reduced motion path keep the visual bounded.
