export type DemoModelMetrics = {
  model_id: string
  label: string
  pr_auc: number
  roc_auc: number
  brier_score: number
  threshold_sweep: DemoThresholdPoint[]
  slice_metrics: DemoSliceMetric[]
}

export type DemoThresholdPoint = {
  threshold: number
  precision: number
  recall: number
  false_positive_rate: number
  block_rate: number
}

export type DemoSliceMetric = {
  slice: string
  value: string
  count: number
  prevalence: number
  pr_auc: number
  roc_auc: number
}

export type DemoModelSummary = {
  artifact: string
  status: "mechanics_evaluation_complete_not_deployable"
  data_source: string
  training_scope: string
  dataset_sha256: string
  feature_columns: string[]
  partition_counts: Record<"train" | "calibration" | "test", number>
  test_prevalence: number
  model_results: DemoModelMetrics[]
  release_boundary: string[]
  report_sha256: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8010"

/** Fetch the read-only, sanitised benchmark evidence for the portfolio screen. */
export async function fetchDemoModelSummary(): Promise<DemoModelSummary> {
  const response = await fetch(`${API_BASE_URL}/demo/model-summary`)
  if (!response.ok) throw new Error("Benchmark evidence is unavailable")
  return response.json() as Promise<DemoModelSummary>
}
