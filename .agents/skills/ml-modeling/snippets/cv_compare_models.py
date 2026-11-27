"""
Fair model comparison using a single CV scheme.

Inspired by https://github.com/divenyijanos/ceu-ml. Same splitter, same metric, same data — only the
estimator changes. Results land in a single sorted table.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold, cross_val_score


def compare_models(
    candidates: dict[str, "Pipeline"],
    X,
    y,
    scoring: str = "roc_auc",
    n_splits: int = 5,
    random_state: int = 42,
    higher_is_better: bool = True,
    n_jobs: int = -1,
) -> pd.DataFrame:
    """
    candidates: {model_name: fitted-or-unfitted sklearn Pipeline}
    Returns a DataFrame sorted by mean score, with std and per-fold scores.
    """
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    rows = []
    for name, pipe in candidates.items():
        scores = cross_val_score(pipe, X, y, cv=cv, scoring=scoring, n_jobs=n_jobs)
        rows.append({
            "model": name,
            "mean":  scores.mean(),
            "std":   scores.std(),
            "min":   scores.min(),
            "max":   scores.max(),
            "folds": np.round(scores, 4).tolist(),
        })
        print(f"{name:30s}  {scores.mean():.4f} ± {scores.std():.4f}")

    df = pd.DataFrame(rows).sort_values("mean", ascending=not higher_is_better)
    return df.reset_index(drop=True)
