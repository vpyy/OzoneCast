---
name: ml-modeling
description: Best-practice suggestions for building, comparing, or reviewing predictive supervised ML models in Python with scikit-learn — Pipelines, ColumnTransformer, cross-validation, hyperparameter search, leakage prevention, candidate leaderboards, one-time held-out test evaluation, and threshold/loss-based decisions. Use for regression or classification; use statistical-modeling instead for coefficient inference and time-series-forecasting when row order and forecast horizon matter. Pair implementation reviews with code-review.
---

# ML Modelling Best Practices (scikit-learn flavoured)

These are **suggestions**, not absolute rules — the user is an industry-experienced developer and prefers pragmatic patterns that resonated across several CEU MSBA course repos. Adapt freely to context.

The patterns below are inspired by these course and open-source repositories:

- **Primary inspiration:**
  - [divenyijanos/ceu-ml](https://github.com/divenyijanos/ceu-ml) — *Data Science 3: Machine Learning Concepts and Tools* (CEU MSBA, János Divényi). The `ResultCollector` model-comparison pattern below comes straight from this course and is published here with his permission.
  - [gabors-data-analysis/da_case_studies](https://github.com/gabors-data-analysis/da_case_studies) (Békés–Kézdi) — cross-validated prediction, classification, and business-loss thresholding (see [ch17-predicting-firm-exit](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch17-predicting-firm-exit), [ch13-used-cars-reg](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch13-used-cars-reg)).
- **Lightly related (data/AI engineering context only):** [zoltanctoth/ceu-ai-engineering-class](https://github.com/zoltanctoth/ceu-ai-engineering-class), [zoltanctoth/ceu-modern-data-platforms](https://github.com/zoltanctoth/ceu-modern-data-platforms).
- **More academic:** [da_data_repo on OSF](https://osf.io/3u5em/) (Békés–Kézdi datasets).

## Default Stack (industry-standard, what the inspiration repos use)

- `scikit-learn` for pipelines, preprocessing, model selection, metrics, and baseline estimators.
- `pandas` + `numpy` for data wrangling.
- `matplotlib` for essential diagnostic plots.
- For experiment tracking: a plain DataFrame leaderboard is often enough (see `ResultCollector` below). Reach for MLflow / W&B when you have many runs across sessions.
- `joblib` for model serialisation (prefer over `pickle` — handles large NumPy arrays better).

Add boosting, interpretation, optimization, or profiling packages only when the task requires them. Keep the stack boring.

## Core Principles

1. **Always have a baseline.** Predict the mean / majority class first — every model must beat it.
2. **Pipeline everything.** No fitting transformers on the full dataset before the split. Fit-transform leaks are silent and devastating.
3. **One held-out test set, touched once.** All model selection happens in CV on the train set.
4. **Same CV folds and metric** for every candidate — fair comparison without touching the test set.
5. **Track results in a leaderboard** as you go. The `ResultCollector` pattern below makes this a one-liner.
6. **Set a `random_state`.** Reproducibility is free.
7. **Optimize the metric the business cares about**, not just the one easiest to compute. For classification, that often means a custom loss + tuned threshold, not raw accuracy.
8. **Sanity-check generalisation.** When in doubt, run a paired statistical test on per-fold CV scores before declaring "Model B beats Model A" (see [reference/significance.md](reference/significance.md)).

## The Workflow

When asked to build a predictive model, follow this skeleton (aligned with Géron's [ML project checklist](https://github.com/ageron/handson-ml3/blob/main/ml-project-checklist.md)):

```
1. Frame:    What are we predicting? What metric matters? (→ designing-analytics-projects skill)
2. Get data: Automate ingestion; sample a test set, put it aside, never look at it.
3. Explore:  EDA in a dedicated notebook — distributions, correlations, target leakage checks.
4. Prepare:  Write transform functions, not ad-hoc cells. Treat prep choices as hyperparams.
5. Baseline: Mean / majority. Beat this or stop.
6. Pipeline: ColumnTransformer + estimator. No leakage possible.
7. Short-list: Cross-validate 3–5 model families on the train set, log to leaderboard.
8. Tune:     GridSearchCV / RandomizedSearchCV on the best 1–2.
9. Threshold: (Classification) Pick a cutoff using a business loss function.
10. Evaluate: Final fit on full train, evaluate ONCE on held-out test.
11. Present:  Leaderboard, key plots, confusion matrix, limitations. Highlight the big picture.
12. Monitor:  In production, track input quality and model drift (PSI) over time.
```

For details on each step see [reference/workflow.md](reference/workflow.md). For ready-to-paste code see [snippets/](snippets/).

## The Pipeline Pattern (no leakage, no exceptions)

```python
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer

numeric = ["age", "income", "tenure"]
categorical = ["region", "plan"]

preprocess = ColumnTransformer([
    ("num", Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ]), numeric),
    ("cat", OneHotEncoder(handle_unknown="ignore"), categorical),
])

pipe = Pipeline([
    ("prep", preprocess),
    ("model", LogisticRegression(max_iter=1000, random_state=42)),
])
pipe.fit(X_train, y_train)
```

**Why this matters:** when you `cross_val_score(pipe, X_train, y_train, ...)`, sklearn re-fits the preprocessor inside each fold automatically. No data leakage from the validation fold into scaling statistics. This is non-negotiable.

## Model Comparison: the `ResultCollector` Pattern

Adapted from [class5_bike_share_demand.ipynb](https://github.com/divenyijanos/ceu-ml/blob/2026/notebooks/class5_bike_share_demand.ipynb). Copy or adapt the helper from [snippets/result_collector.py](snippets/result_collector.py) into the project's shared `dev/src/` modules before importing it in notebooks.

```python
from dev.src.result_collector import ResultCollector
results = ResultCollector(metric_name="RMSLE", lower_is_better=True)

results.add("baseline (mean)", train=baseline_train, validation=baseline_cv)
results.add("linear (FE)",     train=lin_train,      validation=lin_cv)
results.add("xgboost",         train=xgb_train,      validation=xgb_cv)

results.show()   # train, validation, gap, and improvement over baseline
```

A simple `print(pd.DataFrame(rows))` is often enough — don't over-engineer. The point is: **every candidate lands in the same CV-based table, with the same metric and folds, while the held-out test set remains untouched.**

## Cross-Validation Cheatsheet

| Situation | Use |
|---|---|
| iid regression / classification | `KFold(shuffle=True, random_state=42)` |
| imbalanced classification | `StratifiedKFold(...)` (standard in [ch17 firm-exit case study](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch17-predicting-firm-exit)) |
| grouped data (same user across rows) | `GroupKFold` |
| time-series | `TimeSeriesSplit` — never shuffle time! |
| nested model selection | inner CV for tuning, outer CV for honest score |

Default to `n_splits=5` (good bias-variance trade-off, fast). Use `n_splits=10` only if folds are very small.

## Hyperparameter Search

Order of preference:

1. **Manual sweep over 3–5 sensible values** in a loop. Often enough, fully transparent.
2. **`GridSearchCV`** when the grid is small (< 100 combinations).
3. **`RandomizedSearchCV`** when the search space is wide.
4. **`optuna`** when the above are too slow or you need conditional spaces.

Always wire the search into the pipeline (`pipe__model__C`, `pipe__prep__num__scale__with_mean`) so preprocessing is tuned along with the estimator.

## Classification Thresholds & Business Loss

Don't default to 0.5 if the costs are asymmetric. Pattern from Békés–Kézdi [ch17 predicting firm exit](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch17-predicting-firm-exit):

```python
# False negatives cost 4x false positives.
def expected_loss(y_true, proba, threshold, fn_cost=4, fp_cost=1):
    pred = (proba >= threshold).astype(int)
    fn = ((pred == 0) & (y_true == 1)).sum()
    fp = ((pred == 1) & (y_true == 0)).sum()
    return fn * fn_cost + fp * fp_cost

# Find the threshold that minimises expected loss on each CV fold,
# average them — that's your operating threshold.
```

See [snippets/threshold_optimization.py](snippets/threshold_optimization.py) for the full per-fold-then-average pattern.

## Are the Differences Significant?

When comparing two models, **don't trust a single test-set number** if the gap is small relative to noise. Use:

- **Paired t-test or Wilcoxon signed-rank** on per-fold CV scores (regression or classification).
- **McNemar's test** on the disagreements between two classifiers on the same test set.
- **Bootstrap CI** on the held-out metric for a single model.

Code and decision rules in [reference/significance.md](reference/significance.md). For the full statistical-inference toolkit (OLS coefficients, confidence intervals on coefficients, prediction intervals), see the **`statistical-modeling`** skill.

## Data Drift Monitoring (PSI)

In production, monitor whether feature distributions have shifted since training using the **Population Stability Index (PSI)**:

| PSI | Interpretation | Action |
|---|---|---|
| < 0.1 | Stable | No action |
| 0.1 – 0.2 | Moderate drift | Investigate |
| > 0.2 | Significant shift | Retrain |

Compute PSI by binning the training (expected) and production (actual) distributions and comparing proportions. Implementations for both continuous and categorical features are in [snippets/datadrift_psi.py](snippets/datadrift_psi.py). This is a standard industry technique — also emphasised in Géron's "Launch!" checklist step: *"monitor your inputs' quality"*.

## Data Preparation Best Practices

- **Outlier handling:** Use Tukey's IQR method or z-score filtering, but always **document and justify** removals — explain *why* values are invalid, not just extreme.
- **Feature selection:** For high-dimensional datasets, a quick correlation-with-target filter (`corrwith().abs() > threshold`) is a useful coarse screen before building pipelines. Not a substitute for proper feature importance.
- **Write transform functions**, not ad-hoc notebook cells — so you can reuse them on test data, new data, and treat prep choices as hyperparameters (Géron ch. 2).

## Model Serialisation

Prefer `joblib` over `pickle` — it handles large NumPy arrays better:

```python
import joblib
joblib.dump(pipe, 'models/model_v2.pkl')
pipe = joblib.load('models/model_v2.pkl')
```

For project structure (`dev/models/` → `prod/models/` split), see the **`analytics-project-setup`** skill.

## Modelling Notebook Practices

- Set seeds at the top: `np.random.seed(42)`, `random_state=42` everywhere.
- Print shapes after every split / transform to catch silent bugs.
- Use one clearly named `Pipeline` per model.
- Plot calibration curves and confusion matrices for classification.
- Keep reusable modeling utilities in shared modules.
- Follow the repository-wide notebook-output policy in `AGENTS.md`.

## Anti-Patterns to Flag in Reviews

- `StandardScaler().fit(X)` *before* `train_test_split` — leakage.
- Imputing with the full-data mean before CV — leakage.
- Comparing models with different CV splits or different metrics.
- Picking a threshold on the test set after looking at the test scores.
- Reporting a single test-set number without any uncertainty estimate when models are close.
- `accuracy_score` on a 95/5 imbalanced dataset.
- One mega-cell that does load + preprocess + fit + plot — split it.
- Re-using the test set for "one more tweak". The test set is sacred.
- No data drift monitoring between training data and production inference data.
- Hardcoded file paths instead of shared config/constants — see `analytics-project-setup` skill.
- Model saved as `.pkl` with no versioning or naming convention.
- No `dev/prod` separation — exploratory and production code in the same folder.

## Code Snippets

In [snippets/](snippets/):

- `result_collector.py` — the leaderboard helper from [ceu-ml](https://github.com/divenyijanos/ceu-ml).
- `pipeline_template.py` — full ColumnTransformer + Pipeline + GridSearchCV scaffold for a tabular problem.
- `cv_compare_models.py` — fair `cross_val_score` comparison loop with mean ± std per model.
- `threshold_optimization.py` — find the loss-minimising threshold per CV fold and average.
- `paired_cv_test.py` — paired t-test / Wilcoxon on CV scores; wraps the "is the difference significant?" decision.
- `datadrift_psi.py` — continuous and categorical PSI with reference-derived bins and per-bucket diagnostics.

## Data Sources Used in the Inspiration Courses (good for ML practice)

The inspiration repos hit a few canonical datasets repeatedly. They're solid defaults when
prototyping a new modelling pattern or wanting a reproducible benchmark:

| Dataset | Task | Used in | URL |
|---|---|---|---|
| Kaggle Bike Sharing Demand | Regression (count target) — the ceu-ml flagship example | [class5_bike_share_demand.ipynb](https://github.com/divenyijanos/ceu-ml/blob/2026/notebooks/class5_bike_share_demand.ipynb) | <https://www.kaggle.com/c/bike-sharing-demand> |
| MNIST (`fetch_openml('mnist_784')`) | Multi-class image classification | [class3_clustering](https://github.com/divenyijanos/ceu-ml/blob/2026/notebooks/class3_clustering.ipynb), [class6_deep_learning_intro](https://github.com/divenyijanos/ceu-ml/blob/2026/notebooks/class6_deep_learning_intro.ipynb) | <https://www.openml.org/d/554> |
| Synthetic 2D toys: `make_moons`, `make_circles` | Decision-boundary visualisation, clustering | [ceu-ml](https://github.com/divenyijanos/ceu-ml) deep-learning + clustering classes | `from sklearn.datasets import make_moons, make_circles` |
| Hotels Europe (Vienna) — Békés–Kézdi | Regression on price; pipeline practice | [ch09-hotels-europe-stability](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch09-hotels-europe-stability), [ch03-hotels-europe-compare](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch03-hotels-europe-compare) | <https://osf.io/r6uqb/> (and <https://gabors-data-analysis.com/>) |
| Used Cars — Békés–Kézdi | Regression with feature engineering | [da_data_repo/used-cars on OSF](https://osf.io/8tx54/), [ch13-used-cars-reg](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch13-used-cars-reg) | <https://gabors-data-analysis.com/data-and-code/> |
| Bisnode firm exits — Békés–Kézdi | Imbalanced binary classification with business loss — perfect for the threshold-optimization snippet | [ch17-predicting-firm-exit](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch17-predicting-firm-exit) | <https://osf.io/3qyut/> |

Reusable scikit-learn / OpenML defaults for quick experiments without downloading anything:

```python
from sklearn.datasets import fetch_california_housing, fetch_openml, load_breast_cancer

X, y = fetch_california_housing(return_X_y=True, as_frame=True)   # regression
X, y = load_breast_cancer(return_X_y=True, as_frame=True)         # binary classification
adult = fetch_openml("adult", version=2, as_frame=True)           # mixed-type tabular classic
```

For larger benchmark suites, see [OpenML CC18](https://www.openml.org/s/99) (72 curated tabular tasks)
or [Kaggle Datasets](https://www.kaggle.com/datasets) filtered by tabular + competition.

When pulling data for a project, pin the **download URL, version/snapshot date, and licence**
in a load-data cell — the [ceu-ml](https://github.com/divenyijanos/ceu-ml) notebooks consistently load straight from a versioned GitHub URL
(e.g. `https://raw.githubusercontent.com/divenyijanos/ceu-ml/2026/data/bike_sharing_demand/train.csv`),
which is a clean pattern.

## Further Reference

Inspiration repos (check these for full worked examples):

- [divenyijanos/ceu-ml](https://github.com/divenyijanos/ceu-ml) — model comparison, pipelines on bike-share, transfer learning, bias-variance.
- [gabors-data-analysis/da_case_studies](https://github.com/gabors-data-analysis/da_case_studies) — cross-validated prediction and business-loss thresholding ([ch17](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch17-predicting-firm-exit)); used-cars and airbnb chapters for lasso, random forests, and boosting ([ch13](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch13-used-cars-reg), [ch15-used-cars-cart](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch15-used-cars-cart), [ch16-airbnb-random-forest](https://github.com/gabors-data-analysis/da_case_studies/tree/master/ch16-airbnb-random-forest)).
- [da_data_repo on OSF](https://osf.io/3u5em/) — tidy datasets from Békés–Kézdi.
- A clear production-oriented structure — e.g. `dev/prod` split and shared utility modules.

Companion skills:

- **`analytics-project-setup`** — folder structure, branching, AGENTS.md, environment management.
- **`statistical-modeling`** — for inferential/explanatory modelling (OLS coefficients, confidence intervals, significance tests).
- **`data-warehousing`** — for bronze/silver/gold data pipeline patterns feeding into ML models.

External:

- Géron, *Hands-On Machine Learning with Scikit-Learn, Keras and TensorFlow*, 3rd ed. — the industry-standard textbook. [ML project checklist](https://github.com/ageron/handson-ml3/blob/main/ml-project-checklist.md) and [worked notebooks](https://github.com/ageron/handson-ml3).
- [scikit-learn user guide](https://scikit-learn.org/stable/user_guide.html) — especially Pipeline, model_selection, metrics.
- [Raschka, *Model Evaluation, Model Selection, and Algorithm Selection in ML*](https://arxiv.org/abs/1811.12808).
- [SHAP documentation](https://shap.readthedocs.io/) — for model interpretation.

---

*Suggestions, not gospel. When in doubt, prefer **simpler models + honest evaluation** over exotic techniques.*
