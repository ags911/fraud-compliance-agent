"""Offline fast-path model training and evaluation library.

This package holds the logic Notebook 08 used to carry inline: configuration
loading, dataset loading and validation, partitioning, model construction,
evaluation, visual diagnostics, and release-report assembly. The notebook is a
thin runner over these modules so the behaviour is reviewable and testable.

Boundaries:

- It is offline evaluation support, not part of the served API. `server/` must
  never import it, and its heavier dependencies (pandas, scikit-learn, XGBoost,
  Plotly) are development dependencies, not API runtime dependencies.
- Nothing here approves, promotes, calibrates, or thresholds a model, and no
  score produced here may approve, hold, release, or execute a payment.
- Approved-mode work is gated on the accepted contract in
  `docs/contracts/model-training-contract.v1.json`; synthetic mode exercises
  mechanics only and can never support a fraud-performance claim.
"""
