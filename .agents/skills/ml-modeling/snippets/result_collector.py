"""
ResultCollector — running leaderboard for model comparison.

Adapted from https://github.com/divenyijanos/ceu-ml/blob/2026/notebooks/class5_bike_share_demand.ipynb
(CEU MSBA "Data Science 3: Machine Learning Concepts and Tools").

PROVENANCE: the upstream repository carries no licence file, so no rights are
granted by default. The author (Janos Divenyi) granted permission by email in
September 2026 to publish this adaptation here. See THIRD-PARTY-NOTICES.md at the
repo root.

Drop into any modelling notebook to keep a styled, sortable candidate leaderboard
of train / cross-validation scores with automatic improvement-over-baseline.

Usage:
    results = ResultCollector(metric_name="RMSLE", lower_is_better=True)
    results.add("baseline (mean)", train=base_train, validation=base_cv)
    results.add("xgboost",         train=xgb_train,  validation=xgb_cv)
    results.show()        # styled DataFrame in a notebook
    results.as_frame()    # raw DataFrame (for saving / programmatic use)
"""

from __future__ import annotations

import pandas as pd


class ResultCollector:
    """Collect comparable train and validation scores for model candidates."""

    def __init__(self, metric_name: str = "score", lower_is_better: bool = True):
        """Configure the metric label and which direction indicates improvement."""
        self.metric_name = metric_name
        self.lower_is_better = lower_is_better
        self._results: dict[str, dict[str, float]] = {}

    def add(self, name: str, train: float, validation: float) -> "ResultCollector":
        """Add or overwrite a model's row. Returns self for chaining."""
        self._results[name] = {
            f"Train {self.metric_name}": float(train),
            f"Validation {self.metric_name}": float(validation),
            "Gap": float(validation) - float(train),
        }
        return self

    def as_frame(self) -> pd.DataFrame:
        """Return the leaderboard and improvement over its first-row baseline."""
        df = pd.DataFrame(self._results).T
        if df.empty:
            return df

        validation_col = f"Validation {self.metric_name}"
        baseline = df[validation_col].iloc[0]

        if self.lower_is_better:
            df["Improvement vs baseline"] = (
                (baseline - df[validation_col]) / baseline * 100
            ).round(1).astype(str) + "%"
        else:
            df["Improvement vs baseline"] = (
                (df[validation_col] - baseline) / baseline * 100
            ).round(1).astype(str) + "%"
        return df

    def show(self):
        """Styled view for notebooks. Returns a Styler if pandas styling is available."""
        df = self.as_frame()
        if df.empty:
            return df
        validation_col = f"Validation {self.metric_name}"
        train_col = f"Train {self.metric_name}"
        try:
            cmap = "RdYlGn_r" if self.lower_is_better else "RdYlGn"
            return (
                df.style
                  .format("{:.4f}", subset=[train_col, validation_col, "Gap"])
                  .background_gradient(cmap=cmap, subset=[validation_col], axis=None)
            )
        except Exception:
            return df

    def best(self) -> str:
        """Return the name of the best candidate by validation score."""
        df = self.as_frame()
        validation_col = f"Validation {self.metric_name}"
        return (
            df[validation_col].idxmin()
            if self.lower_is_better
            else df[validation_col].idxmax()
        )

    def __repr__(self) -> str:
        """Return the raw leaderboard representation."""
        return repr(self.as_frame())
