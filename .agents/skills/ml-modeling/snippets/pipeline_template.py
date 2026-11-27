"""
End-to-end scikit-learn modelling scaffold.

Inspired by https://github.com/divenyijanos/ceu-ml and https://github.com/gabors-data-analysis/da_case_studies. Adapt column names,
estimator, and metric to the task. The structure is the point.

Pattern:
    1. ColumnTransformer per column type (no leakage)
    2. Pipeline wraps preprocess + estimator
    3. CV on train set, GridSearchCV for tuning
    4. Final fit + held-out evaluation ONCE
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


RANDOM_STATE = 42


def build_pipeline(
    numeric: list[str],
    categorical: list[str],
    estimator,
) -> Pipeline:
    """Build a leak-free preprocess+estimator pipeline."""
    num_pipe = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ])
    cat_pipe = Pipeline([
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    preprocess = ColumnTransformer(
        [("num", num_pipe, numeric), ("cat", cat_pipe, categorical)],
        remainder="drop",
    )
    return Pipeline([("prep", preprocess), ("model", estimator)])


def main(df: pd.DataFrame, target: str):
    y = df[target].values
    X = df.drop(columns=[target])

    numeric = X.select_dtypes(include=np.number).columns.tolist()
    categorical = [c for c in X.columns if c not in numeric]
    print(f"numeric={len(numeric)}  categorical={len(categorical)}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE,
    )
    print(f"train={X_train.shape}  test={X_test.shape}")

    pipe = build_pipeline(
        numeric, categorical,
        RandomForestClassifier(random_state=RANDOM_STATE, n_jobs=-1),
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    grid = GridSearchCV(
        pipe,
        param_grid={
            "model__n_estimators": [200, 500],
            "model__max_depth":    [None, 8, 16],
            "model__min_samples_leaf": [1, 5],
        },
        cv=cv,
        scoring="roc_auc",
        n_jobs=-1,
        refit=True,
    )
    grid.fit(X_train, y_train)
    print("best CV AUC:", round(grid.best_score_, 4))
    print("best params:", grid.best_params_)

    proba_test = grid.predict_proba(X_test)[:, 1]
    print("HELD-OUT test AUC:", round(roc_auc_score(y_test, proba_test), 4))

    return grid


if __name__ == "__main__":
    pass
