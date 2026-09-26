# 0009. Visible feed lifecycle

**Date**: 2026-09-25
**Status**: In Progress

## Summary

The live feed still starts by itself (spec 0005), but only while the tab is visible. It stops after the tab has been hidden for two minutes, and it is cancelled reliably when the tab closes. Background tabs therefore stop using the site's live run allowance.

## Context

`useSandboxFeed` starts a run on load and on each scenario change. A run lasts about ten minutes on the server whether or not anyone is watching. Leaving the page cancels the run only on a best-effort basis, because an ordinary request is often dropped while the page unloads.

## Requirements

**Acceptance criteria**:
1. **AC 1**: If the page loads, or the scenario changes, while the tab is hidden, the automatic start waits until the tab is first visible. A viewer's own Live press always starts at once.
2. **AC 2**: If the tab stays hidden for 120 seconds while a run is live, the run is cancelled. Returning does not restart it. The Live switch shows the existing stopped state ("Stopped · n"), and the viewer's "off" preference is not saved, so the next load starts again.
3. **AC 3**: Returning within 120 seconds keeps the run going.
4. **AC 4**: On `pagehide`, a live run is cancelled with a `keepalive` request that carries the browser ID header.
5. **AC 5**: Nothing else about starting, limits, or the stopped state changes.

## Decision

Keep the lifecycle in the browser hook (`useSandboxFeed`). The server keeps its existing limits and sweep, and a server-side idle timeout is not added. The 120 second grace period lets a viewer switch tabs briefly without losing the run.

## Build plan

1. `postRun` accepts `keepalive`; `cancelSandboxSimulation` passes it through (AC 4).
2. The hook waits for visibility before an automatic start, stops after 120 seconds hidden, and cancels on `pagehide` (AC 1 to AC 3).
3. Playwright coverage that sets document visibility (AC 1, AC 2, AC 4).
