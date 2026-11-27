"""Population Stability Index (PSI) for continuous or categorical features.

PSI compares a reference distribution (usually training data) with a current
distribution (usually production data). Treat common thresholds such as 0.1
and 0.2 as monitoring heuristics, not universal statistical cutoffs.
"""

from __future__ import annotations

from collections.abc import Hashable, Sequence

import numpy as np
import pandas as pd

_MISSING = "<MISSING>"


def _smoothed_proportions(counts: np.ndarray, epsilon: float) -> np.ndarray:
    """Return epsilon-smoothed proportions that still sum to one."""
    total = counts.sum()
    if total == 0:
        raise ValueError("PSI inputs must contain at least one observation")
    proportions = counts.astype(float) / total
    proportions = np.clip(proportions, epsilon, None)
    return proportions / proportions.sum()


def _numeric_counts(
    expected: pd.Series,
    actual: pd.Series,
    bins: int | Sequence[float],
) -> tuple[list[Hashable], np.ndarray, np.ndarray]:
    """Count numeric values in reference-derived bins plus a missing bucket."""
    expected_values = pd.to_numeric(expected, errors="raise").dropna().to_numpy()
    actual_values = pd.to_numeric(actual, errors="raise").dropna().to_numpy()
    if expected_values.size == 0:
        raise ValueError("expected must contain a non-missing numeric observation")
    if not np.isfinite(expected_values).all() or not np.isfinite(actual_values).all():
        raise ValueError("numeric PSI inputs must contain only finite values")

    if isinstance(bins, int):
        if bins < 2:
            raise ValueError("bins must be at least 2")
        quantiles = np.linspace(0, 1, bins + 1)
        edges = np.unique(np.quantile(expected_values, quantiles))
    else:
        edges = np.unique(np.asarray(bins, dtype=float))
        if len(edges) < 2:
            raise ValueError("explicit bins must contain at least two unique edges")

    if len(edges) < 2:
        reference_value = expected_values[0]
        edges = np.unique(
            np.array(
                [
                    -np.inf,
                    reference_value,
                    np.nextafter(reference_value, np.inf),
                    np.inf,
                ]
            )
        )
    else:
        edges[0], edges[-1] = -np.inf, np.inf

    expected_counts, _ = np.histogram(expected_values, bins=edges)
    actual_counts, _ = np.histogram(actual_values, bins=edges)
    labels: list[Hashable] = list(
        pd.IntervalIndex.from_breaks(edges, closed="left")
    )

    expected_missing = int(expected.isna().sum())
    actual_missing = int(actual.isna().sum())
    if expected_missing or actual_missing:
        labels.append(_MISSING)
        expected_counts = np.append(expected_counts, expected_missing)
        actual_counts = np.append(actual_counts, actual_missing)

    return labels, expected_counts, actual_counts


def _categorical_counts(
    expected: pd.Series,
    actual: pd.Series,
) -> tuple[list[Hashable], np.ndarray, np.ndarray]:
    """Count real categories and missing values in distinct buckets."""
    expected_values = expected[expected.notna()].astype("object")
    actual_values = actual[actual.notna()].astype("object")
    categories = list(
        dict.fromkeys([*expected_values.tolist(), *actual_values.tolist()])
    )
    labels: list[Hashable] = [
        f"category:{value}" if value == _MISSING else value
        for value in categories
    ]
    expected_counts = np.array(
        [int((expected_values == value).sum()) for value in categories],
        dtype=int,
    )
    actual_counts = np.array(
        [int((actual_values == value).sum()) for value in categories],
        dtype=int,
    )

    expected_missing = int(expected.isna().sum())
    actual_missing = int(actual.isna().sum())
    if expected_missing or actual_missing:
        labels.append(_MISSING)
        expected_counts = np.append(expected_counts, expected_missing)
        actual_counts = np.append(actual_counts, actual_missing)

    return labels, expected_counts, actual_counts


def psi_report(
    expected,
    actual,
    *,
    bins: int | Sequence[float] = 10,
    categorical: bool | None = None,
    epsilon: float = 1e-6,
) -> pd.DataFrame:
    """Return per-bucket PSI contributions.

    Numeric inputs use quantile bins learned only from ``expected``. Set
    ``categorical=True`` for integer-coded categories. Missing values form a
    separate bucket whenever either sample contains them.
    """
    if epsilon <= 0:
        raise ValueError("epsilon must be positive")

    expected_series = pd.Series(expected)
    actual_series = pd.Series(actual)
    if expected_series.empty or actual_series.empty:
        raise ValueError("expected and actual must both be non-empty")

    if categorical is None:
        categorical = not pd.api.types.is_numeric_dtype(expected_series)

    if categorical:
        labels, expected_counts, actual_counts = _categorical_counts(
            expected_series, actual_series
        )
    else:
        labels, expected_counts, actual_counts = _numeric_counts(
            expected_series, actual_series, bins
        )

    expected_share = _smoothed_proportions(expected_counts, epsilon)
    actual_share = _smoothed_proportions(actual_counts, epsilon)
    contribution = (actual_share - expected_share) * np.log(
        actual_share / expected_share
    )

    return pd.DataFrame(
        {
            "bucket": labels,
            "expected_count": expected_counts,
            "actual_count": actual_counts,
            "expected_share": expected_share,
            "actual_share": actual_share,
            "psi": contribution,
        }
    )


def population_stability_index(expected, actual, **kwargs) -> float:
    """Return the total PSI; keyword arguments are forwarded to ``psi_report``."""
    return float(psi_report(expected, actual, **kwargs)["psi"].sum())
