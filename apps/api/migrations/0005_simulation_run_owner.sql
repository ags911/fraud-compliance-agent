-- Spec 0003: each live feed run belongs to the browser that started it, and
-- finished runs are swept with their events. Rerunnable.

-- The anonymous showcase browser ID (a lowercase version 4 UUID, as for
-- cases). Null only for runs created before this migration.
ALTER TABLE sandbox_simulation_runs ADD COLUMN IF NOT EXISTS browser_id TEXT;

-- The per browser rate limit (starts in the last minute).
CREATE INDEX IF NOT EXISTS sandbox_simulation_runs_browser_created_idx
  ON sandbox_simulation_runs (browser_id, created_at);

-- The site wide cap on live runs.
CREATE INDEX IF NOT EXISTS sandbox_simulation_runs_live_idx
  ON sandbox_simulation_runs (state)
  WHERE state IN ('pending', 'running');

-- The 7 day sweep deletes a run; its scheduled events go with it.
ALTER TABLE sandbox_simulation_events
  DROP CONSTRAINT IF EXISTS sandbox_simulation_events_run_id_fkey;
ALTER TABLE sandbox_simulation_events
  ADD CONSTRAINT sandbox_simulation_events_run_id_fkey
  FOREIGN KEY (run_id) REFERENCES sandbox_simulation_runs (run_id) ON DELETE CASCADE;
