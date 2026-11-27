# ML Modelling Workflow — Detailed Steps

Inspired by patterns in [ceu-ml](https://github.com/divenyijanos/ceu-ml) and [da_case_studies](https://github.com/gabors-data-analysis/da_case_studies). These are suggestions, adapt to context.

---

## 1. Frame the problem

Before touching code, write down (in a notebook markdown cell or a comment):

- **What is being predicted?** Variable name, type (continuous / binary / multiclass / count).
- **Unit of observation.** "One row per customer-month." If you can't say it, the data is wrong.
- **Business metric.** What does success *cost*? Asymmetric losses change everything.
- **The baseline.** Naïve mean / majority class — write down the expected score.
- **Acceptance criterion.** "RMSLE < 0.6" or "AUC > 0.75 with FN cost = 4× FP". Without one, you'll keep tuning forever.

---

## 2. Split — once, properly

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y,             # for classification with imbalance
)
```

For time-series: **never shuffle**. Use `TimeSeriesSplit` for CV and a strict cutoff date for test.

For grouped data (same user/store across rows): use `GroupShuffleSplit` so a group is never in both train and test.

The held-out test set is now **frozen**. Do not look at it again until step 9.

---

## 3. Baseline first

```python
from sklearn.dummy import DummyRegressor, DummyClassifier
from sklearn.model_selection import cross_val_score

baseline = DummyRegressor(strategy="mean")
baseline_scores = cross_val_score(
    baseline, X_train, y_train, cv=5, scoring="neg_root_mean_squared_error"
)
print(f"baseline CV RMSE = {-baseline_scores.mean():.3f} ± {baseline_scores.std():.3f}")
```

Add this row to your leaderboard. Every subsequent model must beat it. If a "fancy" model can't, the bug is in your features, not the algorithm.

---

## 4. Build a Pipeline

Always wrap preprocessing inside the same object as the estimator. Then **the entire pipeline** is what gets fit per CV fold — no leakage.

```python
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

preprocess = ColumnTransformer([
    ("num", num_pipeline, num_cols),
    ("cat", cat_pipeline, cat_cols),
], remainder="drop")            # be explicit

pipe = Pipeline([
    ("prep", preprocess),
    ("model", estimator),
])
```

`remainder="drop"` is safer than the default `"passthrough"` — forces you to be explicit about every column.

---

## 5. Cross-validate on the train set

```python
from sklearn.model_selection import StratifiedKFold, cross_val_score

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
scores = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="roc_auc", n_jobs=-1)
print(f"AUC = {scores.mean():.3f} ± {scores.std():.3f}")
```

Pick the scoring metric that matches the business metric. Common ones:

- Regression: `"neg_root_mean_squared_error"`, `"neg_mean_absolute_error"`, `"r2"`.
- Classification: `"roc_auc"`, `"average_precision"`, `"neg_brier_score"`, `"neg_log_loss"`.

The std across folds is your honesty signal. If it's large, your dataset is small or your model is unstable — quote both numbers.

---

## 6. Add candidates to the leaderboard

Use the `ResultCollector` (or any DataFrame). One row per model, same metric, same CV scheme.

```python
from sklearn.model_selection import cross_validate

candidates = {
    "logistic L2": logistic_l2_pipeline,
    "rf depth=8": rf_depth_8_pipeline,
    "xgboost": xgboost_pipeline,
}

for name, candidate in candidates.items():
    candidate_scores = cross_validate(
        candidate,
        X_train,
        y_train,
        cv=cv,
        scoring="roc_auc",
        n_jobs=-1,
        return_train_score=True,
    )
    results.add(
        name,
        train=candidate_scores["train_score"].mean(),
        validation=candidate_scores["test_score"].mean(),
    )
```

The validation column is the CV mean on the training partition. The held-out
test set comes out only at step 9.

---

## 7. Tune the best 1–2

Don't tune everything. Pick the top contenders, then:

```python
from sklearn.model_selection import GridSearchCV

grid = GridSearchCV(
    pipe,
    param_grid={
        "model__max_depth":     [3, 5, 7, 10],
        "model__n_estimators":  [100, 300, 500],
        "model__learning_rate": [0.01, 0.05, 0.1],
    },
    cv=cv,
    scoring="roc_auc",
    n_jobs=-1,
    refit=True,
)
grid.fit(X_train, y_train)
print(grid.best_params_, grid.best_score_)
```

For wide spaces use `RandomizedSearchCV(n_iter=50, ...)` or `optuna`. Always tune *inside* the pipeline so preprocessing parameters can be tuned too.

---

## 8. Choose a threshold (classification only)

If predictions are probabilities and the decision is binary, the default 0.5 is almost certainly wrong. Use a business-loss-driven threshold:

```python
from sklearn.metrics import roc_curve

# Per fold: get probabilities, compute loss at every threshold, pick the min.
fpr, tpr, thresholds = roc_curve(y_val, proba_val)
losses = [expected_loss(y_val, proba_val, t) for t in thresholds]
best_t = thresholds[np.argmin(losses)]
```

Average `best_t` across CV folds → your operating threshold. See `snippets/threshold_optimization.py` for the full per-fold loop.

---

## 9. Final fit and held-out evaluation — once

```python
final_model = grid.best_estimator_           # already refit on full train
y_pred = final_model.predict(X_test)
y_proba = final_model.predict_proba(X_test)[:, 1]   # if classifier

print("test AUC:", roc_auc_score(y_test, y_proba))
print("test loss:", expected_loss(y_test, y_proba, threshold=best_t))
```

This is the number you report. **Do not** then "try one more thing". If you do, the test number is no longer honest and you need a new test set.

---

## 10. Report

Minimum viable report:

- Leaderboard table.
- Test-set metric(s) and their uncertainty (CV std or bootstrap CI).
- Confusion matrix at the chosen threshold (classification).
- Calibration plot if probabilities matter for downstream decisions.
- Feature importance / SHAP (a few sentences only — don't over-claim causality).
- Honest "what could go wrong": data drift, segments where the model fails, etc.

For comparing models, see `reference/significance.md` — a 0.001 AUC difference may be noise.
