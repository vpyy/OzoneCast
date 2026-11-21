"""
Significance testing for ML model comparison.

Inspired by the inferential discipline in https://github.com/gabors-data-analysis/da_case_studies,
applied to ML model comparison.

Three patterns:
    1. paired_cv_test()    — paired t-test / Wilcoxon on per-fold CV scores
    2. mcnemar_classifiers() — McNemar on disagreement between two classifiers
    3. bootstrap_metric_ci() — bootstrap CI on a single held-out metric
"""

from __future__ import annotations

import numpy as np
from scipy.stats import ttest_rel, wilcoxon
from sklearn.model_selection import StratifiedKFold, cross_val_score


def paired_cv_test(
    pipe_a, pipe_b, X, y,
    scoring: str = "roc_auc",
    n_splits: int = 10,
    random_state: int = 42,
    use_wilcoxon: bool = False,
) -> dict:
    """Compare two pipelines on the same CV folds. Returns means, stds, and p-value."""
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    scores_a = cross_val_score(pipe_a, X, y, cv=cv, scoring=scoring, n_jobs=-1)
    scores_b = cross_val_score(pipe_b, X, y, cv=cv, scoring=scoring, n_jobs=-1)

    if use_wilcoxon:
        stat, p = wilcoxon(scores_a, scores_b)
        test = "Wilcoxon signed-rank"
    else:
        stat, p = ttest_rel(scores_a, scores_b)
        test = "Paired t-test"

    print(f"A:    {scores_a.mean():.4f} ± {scores_a.std():.4f}")
    print(f"B:    {scores_b.mean():.4f} ± {scores_b.std():.4f}")
    print(f"diff: {(scores_b - scores_a).mean():+.4f}")
    print(f"{test}: stat={stat:.3f}  p={p:.4f}")

    return {
        "test": test,
        "scores_a": scores_a,
        "scores_b": scores_b,
        "mean_diff": float((scores_b - scores_a).mean()),
        "stat": float(stat),
        "p_value": float(p),
    }


def mcnemar_classifiers(y_true, pred_a, pred_b, exact: bool | None = None) -> dict:
    """McNemar's test on two classifiers' predictions on the same test set."""
    from statsmodels.stats.contingency_tables import mcnemar

    y_true = np.asarray(y_true)
    pred_a = np.asarray(pred_a)
    pred_b = np.asarray(pred_b)

    correct_a = (pred_a == y_true)
    correct_b = (pred_b == y_true)

    n00 = int(((~correct_a) & (~correct_b)).sum())
    n01 = int(((~correct_a) &  correct_b ).sum())
    n10 = int(( correct_a  & (~correct_b)).sum())
    n11 = int(( correct_a  &  correct_b ).sum())

    table = np.array([[n00, n01], [n10, n11]])
    if exact is None:
        exact = (n01 + n10) < 25
    result = mcnemar(table, exact=exact, correction=not exact)

    print(f"contingency: only-B-right={n01}  only-A-right={n10}")
    print(f"McNemar  stat={result.statistic:.3f}  p={result.pvalue:.4f}  (exact={exact})")
    return {"table": table.tolist(), "stat": float(result.statistic), "p_value": float(result.pvalue)}


def bootstrap_metric_ci(metric_fn, y_true, y_score,
                        n_boot: int = 1000, alpha: float = 0.05,
                        random_state: int = 42) -> dict:
    """Bootstrap CI for any metric_fn(y_true, y_score) on a held-out set."""
    rng = np.random.default_rng(random_state)
    y_true = np.asarray(y_true)
    y_score = np.asarray(y_score)
    n = len(y_true)

    boot = np.empty(n_boot)
    for i in range(n_boot):
        idx = rng.integers(0, n, n)
        boot[i] = metric_fn(y_true[idx], y_score[idx])

    lo, hi = np.percentile(boot, [100 * alpha / 2, 100 * (1 - alpha / 2)])
    return {
        "mean":  float(boot.mean()),
        "ci_lo": float(lo),
        "ci_hi": float(hi),
    }
