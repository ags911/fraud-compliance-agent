// A minimal, valid response for GET /demo/model-summary, shared by browser tests.
export const modelSummary = {
  artifact: "synthetic_benchmark_model_summary",
  status: "mechanics_evaluation_complete_not_deployable",
  data_source: "Sparkov simulated credit-card transactions",
  training_scope: "mechanics_only",
  dataset_sha256: "a".repeat(64),
  feature_columns: ["amount_source_value", "event_hour_utc", "event_day_of_week_utc", "is_weekend"],
  partition_counts: { train: 1000, calibration: 200, test: 300 },
  test_prevalence: 0.005,
  model_results: [
    {
      model_id: "xgboost_candidate",
      label: "XGBoost candidate",
      pr_auc: 0.24,
      roc_auc: 0.88,
      brier_score: 0.008,
      threshold_sweep: [
        { threshold: 0.2, precision: 0.1, recall: 0.8, false_positive_rate: 0.04, block_rate: 0.05 },
        { threshold: 0.5, precision: 0.3, recall: 0.55, false_positive_rate: 0.01, block_rate: 0.02 },
      ],
      slice_metrics: [{ slice: "amount_band", value: "over_50", count: 200, prevalence: 0.006, pr_auc: 0.27, roc_auc: 0.89 }],
    },
  ],
  release_boundary: ["No score can approve or execute a payment action."],
  report_sha256: "b".repeat(64),
}
