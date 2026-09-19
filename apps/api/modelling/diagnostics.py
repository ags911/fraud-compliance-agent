"""Plotly diagnostics for a held-out evaluation.

These figures follow the shared Arbiris notebook convention: a white canvas, a
bold title, a muted subtitle, explicit margins, readable hover detail, and the
established blue/red/green palette. They visualise aggregate held-out scores
only. Every figure carries its mode in the subtitle and a visible notice that no
operating threshold is selected, so a chart cannot be lifted out of the notebook
and read as a performance or policy claim.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from sklearn.metrics import precision_recall_curve, roc_curve

from modelling.config import BASELINE_MODEL_ID, CANDIDATE_MODEL_ID, EvaluationConfig
from modelling.evaluation import held_out_target, reliability_curve
from modelling.features import Partitions
from modelling.report import SYNTHETIC_MODE

MODEL_COLORS = {
    BASELINE_MODEL_ID: "#2E91E5",
    CANDIDATE_MODEL_ID: "#EF553B",
}
REFERENCE_COLOR = "#6B7280"
GRID_COLOR = "#E5ECF6"
PLOT_WIDTH = 900
PLOT_MARGIN = {"l": 100, "r": 200, "t": 100, "b": 75}
SYNTHETIC_NOTICE = "Synthetic mechanics-only — not fraud-model performance evidence."
CANDIDATE_NOTICE = (
    "Candidate evaluation — review only; no threshold or release decision."
)
SAFETY_ANNOTATION = "Diagnostic only — no operating threshold is selected."
FIGURE_KEYS = (
    "precision_recall",
    "roc",
    "reliability",
    "score_distribution",
    "threshold_tradeoffs",
)


def evaluation_subtitle(detail: str, mode: str) -> str:
    """Return a safety-qualified subtitle for one diagnostic.

    Args:
        detail: What the figure shows.
        mode: Resolved run mode, which selects the standing notice.

    Returns:
        Subtitle markup combining the detail and the mode's notice.
    """
    notice = SYNTHETIC_NOTICE if mode == SYNTHETIC_MODE else CANDIDATE_NOTICE
    return f"{detail}<br><sup>{notice}</sup>"


def create_evaluation_figure(
    title: str, subtitle: str, hovermode: str = "closest"
) -> go.Figure:
    """Create an empty figure in the shared notebook visual language.

    Args:
        title: Bold figure title.
        subtitle: Output of `evaluation_subtitle`.
        hovermode: Plotly hover mode; `x unified` suits multi-series sweeps.

    Returns:
        A styled figure with no traces yet.
    """
    figure = go.Figure()
    figure.update_layout(
        template="plotly_white",
        title=f"<b>{title}</b><br><sup>{subtitle}</sup>",
        title_font_size=18,
        width=PLOT_WIDTH,
        hovermode=hovermode,
        margin=PLOT_MARGIN,
        legend={
            "bgcolor": "rgba(255, 255, 255, 0.85)",
            "bordercolor": GRID_COLOR,
            "borderwidth": 1,
        },
    )
    figure.update_xaxes(
        showgrid=True, gridcolor=GRID_COLOR, ticklabelstandoff=6, zeroline=False
    )
    figure.update_yaxes(showgrid=True, gridcolor=GRID_COLOR, zeroline=False)
    return figure


def add_safety_annotation(figure: go.Figure) -> None:
    """Place the visible non-authority notice below a diagnostic.

    Args:
        figure: Figure to annotate.

    Side effects:
        Adds one annotation to `figure` in place.
    """
    figure.add_annotation(
        text=SAFETY_ANNOTATION,
        xref="paper",
        yref="paper",
        x=0,
        y=-0.24,
        showarrow=False,
        font={"color": REFERENCE_COLOR, "size": 11},
        align="left",
    )


def _model_label(model_id: str) -> str:
    """Return a readable series name for a report model id."""
    return model_id.replace("_", " ")


def precision_recall_figure(
    target: pd.Series, model_scores: dict[str, np.ndarray], mode: str
) -> go.Figure:
    """Plot precision-recall curves, which foreground class imbalance.

    Args:
        target: Held-out outcomes.
        model_scores: Held-out scores keyed by model id.
        mode: Resolved run mode.

    Returns:
        One curve per model, with test prevalence as the reference line.
    """
    figure = create_evaluation_figure(
        "Precision–recall curves",
        evaluation_subtitle(
            "Held-out test partition; dashed line is test prevalence.", mode
        ),
    )
    figure.add_hline(
        y=float(target.mean()),
        line_dash="dot",
        line_color=REFERENCE_COLOR,
        annotation_text="Test prevalence",
        annotation_position="bottom right",
    )
    for name, scores in model_scores.items():
        precision, recall, _ = precision_recall_curve(target, scores)
        figure.add_trace(
            go.Scatter(
                x=recall,
                y=precision,
                mode="lines",
                name=_model_label(name),
                line={"color": MODEL_COLORS[name], "width": 3},
                hovertemplate="Recall: %{x:.3f}<br>Precision: %{y:.3f}<extra>%{fullData.name}</extra>",
            )
        )
    figure.update_xaxes(title_text="Recall", range=[0, 1])
    figure.update_yaxes(title_text="Precision", range=[0, 1])
    add_safety_annotation(figure)
    return figure


def roc_figure(
    target: pd.Series, model_scores: dict[str, np.ndarray], mode: str
) -> go.Figure:
    """Plot ROC curves as a complementary discrimination diagnostic.

    Args:
        target: Held-out outcomes.
        model_scores: Held-out scores keyed by model id.
        mode: Resolved run mode.

    Returns:
        One curve per model against the no-discrimination diagonal.
    """
    figure = create_evaluation_figure(
        "ROC curves",
        evaluation_subtitle(
            "Held-out test partition; dashed diagonal is no-discrimination reference.",
            mode,
        ),
    )
    figure.add_trace(
        go.Scatter(
            x=[0, 1],
            y=[0, 1],
            mode="lines",
            name="No-discrimination reference",
            line={"color": REFERENCE_COLOR, "dash": "dot"},
            hoverinfo="skip",
        )
    )
    for name, scores in model_scores.items():
        false_positive_rate, true_positive_rate, _ = roc_curve(target, scores)
        figure.add_trace(
            go.Scatter(
                x=false_positive_rate,
                y=true_positive_rate,
                mode="lines",
                name=_model_label(name),
                line={"color": MODEL_COLORS[name], "width": 3},
                hovertemplate="False-positive rate: %{x:.3f}<br>True-positive rate: %{y:.3f}<extra>%{fullData.name}</extra>",
            )
        )
    figure.update_xaxes(title_text="False-positive rate", range=[0, 1])
    figure.update_yaxes(title_text="True-positive rate", range=[0, 1])
    add_safety_annotation(figure)
    return figure


def reliability_figure(
    target: pd.Series, model_scores: dict[str, np.ndarray], mode: str, bins: int
) -> go.Figure:
    """Plot observed outcome rate against mean predicted score.

    Args:
        target: Held-out outcomes.
        model_scores: Held-out scores keyed by model id.
        mode: Resolved run mode.
        bins: Equal-width score bins across the unit interval.

    Returns:
        One curve per model against the perfect-calibration diagonal. The figure
        exposes calibration; it does not calibrate the model.
    """
    figure = create_evaluation_figure(
        "Reliability diagnostic",
        evaluation_subtitle(
            "Held-out test partition; score bins are descriptive and do not calibrate the model.",
            mode,
        ),
    )
    figure.add_trace(
        go.Scatter(
            x=[0, 1],
            y=[0, 1],
            mode="lines",
            name="Perfect calibration",
            line={"color": REFERENCE_COLOR, "dash": "dot"},
            hoverinfo="skip",
        )
    )
    for name, scores in model_scores.items():
        mean_prediction, observed_rate = reliability_curve(target, scores, bins)
        figure.add_trace(
            go.Scatter(
                x=mean_prediction,
                y=observed_rate,
                mode="lines+markers",
                name=_model_label(name),
                line={"color": MODEL_COLORS[name], "width": 3},
                marker={"size": 8},
                hovertemplate="Mean predicted score: %{x:.3f}<br>Observed rate: %{y:.3f}<extra>%{fullData.name}</extra>",
            )
        )
    figure.update_xaxes(title_text="Mean predicted score", range=[0, 1])
    figure.update_yaxes(title_text="Observed outcome rate", range=[0, 1])
    add_safety_annotation(figure)
    return figure


def score_distribution_figure(
    target: pd.Series, model_scores: dict[str, np.ndarray], mode: str
) -> go.Figure:
    """Overlay held-out score distributions by observed outcome.

    Args:
        target: Held-out outcomes.
        model_scores: Held-out scores keyed by model id.
        mode: Resolved run mode.

    Returns:
        Overlaid histograms that make class separation legible without drawing a
        policy cut-off. Opacity differs per model so overlap stays visible.
    """
    figure = create_evaluation_figure(
        "Held-out score distributions",
        evaluation_subtitle(
            "Outcome groups in the test partition; opacity is used so overlap remains visible.",
            mode,
        ),
    )
    figure.update_layout(barmode="overlay")
    outcomes = target.to_numpy()
    for name, scores in model_scores.items():
        for outcome, color, label in (
            (0, "#2E91E5", "Observed non-target"),
            (1, "#EF553B", "Observed target"),
        ):
            figure.add_trace(
                go.Histogram(
                    x=scores[outcomes == outcome],
                    nbinsx=30,
                    name=f"{_model_label(name)} — {label}",
                    legendgroup=name,
                    marker={"color": color},
                    opacity=0.38 if name == BASELINE_MODEL_ID else 0.65,
                    hovertemplate="Score: %{x:.3f}<br>Count: %{y}<extra>%{fullData.name}</extra>",
                )
            )
    figure.update_xaxes(title_text="Model score", range=[0, 1])
    figure.update_yaxes(title_text="Count")
    add_safety_annotation(figure)
    return figure


def threshold_tradeoff_figure(
    models: dict[str, dict[str, Any]], mode: str
) -> go.Figure:
    """Plot each reported measure across the candidate threshold grid.

    Args:
        models: Output of `modelling.evaluation.evaluate_models`.
        mode: Resolved run mode.

    Returns:
        A comparison chart that reports, but never chooses, a policy threshold.
        The baseline is drawn solid and the candidate dashed.
    """
    figure = create_evaluation_figure(
        "Threshold trade-offs",
        evaluation_subtitle(
            "Held-out test partition; comparison only — policy must select no threshold here.",
            mode,
        ),
        hovermode="x unified",
    )
    measure_styles = {
        "precision": ("Precision", "#2E91E5"),
        "recall": ("Recall", "#00CC96"),
        "false_positive_rate": ("False-positive rate", "#EF553B"),
        "block_rate": ("Score-at-or-above threshold", "#636EFA"),
    }
    for name, values in models.items():
        sweep = pd.DataFrame(values["threshold_sweep"])
        for measure, (label, color) in measure_styles.items():
            figure.add_trace(
                go.Scatter(
                    x=sweep["threshold"],
                    y=sweep[measure],
                    mode="lines+markers",
                    name=f"{_model_label(name)} — {label}",
                    legendgroup=name,
                    line={
                        "color": color,
                        "width": 3,
                        "dash": "solid" if name == BASELINE_MODEL_ID else "dash",
                    },
                    marker={"size": 6},
                    hovertemplate="Threshold: %{x:.2f}<br>Rate: %{y:.3f}<extra>%{fullData.name}</extra>",
                )
            )
    figure.update_xaxes(title_text="Candidate threshold (not selected)", range=[0, 1])
    figure.update_yaxes(title_text="Rate", range=[0, 1])
    add_safety_annotation(figure)
    return figure


def build_diagnostics(
    partitions: Partitions,
    model_scores: dict[str, np.ndarray],
    models: dict[str, dict[str, Any]],
    config: EvaluationConfig,
    mode: str,
) -> dict[str, go.Figure]:
    """Build every diagnostic for one evaluation run.

    Args:
        partitions: Split dataset; only the test partition is visualised.
        model_scores: Held-out scores keyed by model id.
        models: Output of `modelling.evaluation.evaluate_models`.
        config: Supplies the reliability-bin count.
        mode: Resolved run mode, shown in every subtitle.

    Returns:
        Figures keyed by `FIGURE_KEYS`, in display order. Nothing is rendered or
        written here; the caller decides whether to show them.
    """
    target = held_out_target(partitions)
    return {
        "precision_recall": precision_recall_figure(target, model_scores, mode),
        "roc": roc_figure(target, model_scores, mode),
        "reliability": reliability_figure(
            target, model_scores, mode, config.reliability_bins
        ),
        "score_distribution": score_distribution_figure(target, model_scores, mode),
        "threshold_tradeoffs": threshold_tradeoff_figure(models, mode),
    }
