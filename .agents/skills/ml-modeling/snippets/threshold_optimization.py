"""
Per-fold threshold optimisation under an asymmetric business loss.

Pattern adapted from Békés–Kézdi ch17 firm-exit case study
(https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch17-predicting-firm-exit).
Fast-growing-firms / Bisnode classifier with asymmetric FN vs FP cost.

Use when the default 0.5 classification threshold is wrong because the
costs of FP and FN differ. Pick a threshold per CV fold, average across
folds — that is the operating threshold for production.
"""

from __future__ import annotations

import numpy as np
from sklearn.metrics import roc_curve
from sklearn.model_selection import StratifiedKFold


def expected_loss(y_true, y_proba, threshold: float,
                  fn_cost: float = 4.0, fp_cost: float = 1.0) -> float:
    pred = (y_proba >= threshold).astype(int)
    fn = int(((pred == 0) & (y_true == 1)).sum())
    fp = int(((pred == 1) & (y_true == 0)).sum())
    return fn * fn_cost + fp * fp_cost


def optimal_threshold(y_true, y_proba,
                      fn_cost: float = 4.0, fp_cost: float = 1.0) -> tuple[float, float]:
    """Return (best_threshold, loss_at_best) by sweeping ROC-curve thresholds."""
    fpr, tpr, thresholds = roc_curve(y_true, y_proba)
    losses = np.array([
        expected_loss(y_true, y_proba, t, fn_cost, fp_cost) for t in thresholds
    ])
    best = int(np.argmin(losses))
    return float(thresholds[best]), float(losses[best])


def cv_optimal_threshold(estimator, X, y,
                         fn_cost: float = 4.0, fp_cost: float = 1.0,
                         n_splits: int = 5, random_state: int = 42) -> dict:
    """
    Fit `estimator` on each train fold, find threshold minimising expected
    loss on the validation fold. Return the average best-threshold and
    average loss across folds.
    """
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    fold_thresholds, fold_losses = [], []

    for fold_idx, (tr, va) in enumerate(cv.split(X, y), start=1):
        X_tr, X_va = X.iloc[tr], X.iloc[va]
        y_tr, y_va = y[tr], y[va]
        estimator.fit(X_tr, y_tr)
        proba_va = estimator.predict_proba(X_va)[:, 1]
        t, loss = optimal_threshold(y_va, proba_va, fn_cost, fp_cost)
        fold_thresholds.append(t)
        fold_losses.append(loss)
        print(f"fold {fold_idx}: threshold={t:.3f}  loss={loss:.1f}")

    return {
        "avg_threshold": float(np.mean(fold_thresholds)),
        "avg_loss":      float(np.mean(fold_losses)),
        "fold_thresholds": fold_thresholds,
        "fold_losses": fold_losses,
    }
