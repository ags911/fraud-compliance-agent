-- Spec 0008: a Mixed feed run (scenario_id 'MIX') interleaves S01 to S05
-- payments. The run has no single dataset, so its fixture version is null;
-- each payment instead records the dataset it came from. Rerunnable: the
-- migration runner applies every file on every run.

-- Only a Mixed run has no fixture version. The existing foreign key to
-- sandbox_datasets is not checked when the version is null.
ALTER TABLE sandbox_simulation_runs
  ALTER COLUMN fixture_version DROP NOT NULL;
ALTER TABLE sandbox_simulation_runs
  DROP CONSTRAINT IF EXISTS sandbox_simulation_runs_mixed_fixture;
ALTER TABLE sandbox_simulation_runs
  ADD CONSTRAINT sandbox_simulation_runs_mixed_fixture
  CHECK ((scenario_id = 'MIX') = (fixture_version IS NULL));

-- A Mixed payment's source dataset. Both null for a single scenario run,
-- whose events belong to the run's own dataset.
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS source_scenario_id TEXT;
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS source_fixture_version TEXT;
ALTER TABLE sandbox_simulation_events
  DROP CONSTRAINT IF EXISTS sandbox_simulation_events_source_pair;
ALTER TABLE sandbox_simulation_events
  ADD CONSTRAINT sandbox_simulation_events_source_pair
  CHECK ((source_scenario_id IS NULL) = (source_fixture_version IS NULL));
ALTER TABLE sandbox_simulation_events
  DROP CONSTRAINT IF EXISTS sandbox_simulation_events_source_dataset;
ALTER TABLE sandbox_simulation_events
  ADD CONSTRAINT sandbox_simulation_events_source_dataset
  FOREIGN KEY (source_scenario_id, source_fixture_version)
  REFERENCES sandbox_datasets (scenario_id, fixture_version);
