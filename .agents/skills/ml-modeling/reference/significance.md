# Is the Difference Significant?

When two models look close, **don't pick a winner from a single number**. The patterns below are inspired by the inferential discipline in [da_case_studies](https://github.com/gabors-data-analysis/da_case_studies), applied to ML model comparison.

---

## Decision tree

| Situation | Test |
|---|---|
| Two models, k-fold CV scores per fold available | **Paired t-test** on per-fold scores (or Wilcoxon if normality is doubtful) |
| Two classifiers, predictions on the same held-out test set | **McNemar's test** on the disagreement contingency table |
| One model, want a CI on its held-out metric | **Bootstrap** the test set, recompute metric ~1000 times |
| Many models | Pairwise tests with Bonferroni / Holm correction, or just pick top-2 and test them |
| Tiny effect size, small data | Just report `mean ± std` and stop pretending it's significant |

The reasonable default is: report the per-fold mean and std, and only invoke a formal test when the call is close enough to matter.

---

## Paired t-test on CV scores

This is the workhorse. Same CV split for both models so the folds are paired.

```python
from scipy.stats import ttest_rel, wilcoxon
from sklearn.model_selection import cross_val_score, KFold

cv = KFold(n_splits=10, shuffle=True, random_state=42)
scores_a = cross_val_score(pipe_a, X_train, y_train, cv=cv, scoring="roc_auc")
scores_b = cross_val_score(pipe_b, X_train, y_train, cv=cv, scoring="roc_auc")

t_stat, p_val = ttest_rel(scores_a, scores_b)
print(f"A: {scores_a.mean():.4f} ± {scores_a.std():.4f}")
print(f"B: {scores_b.mean():.4f} ± {scores_b.std():.4f}")
print(f"paired t-test  t={t_stat:.3f}  p={p_val:.4f}")

# Non-parametric alternative if folds are skewed:
w_stat, p_val_w = wilcoxon(scores_a, scores_b)
print(f"Wilcoxon       W={w_stat:.3f}  p={p_val_w:.4f}")
```

**Caveats:**
- Standard CV violates the iid assumption of the t-test (folds share data). The test is approximate. For more rigour use 5×2 CV (Dietterich) or corrected resampled t-test (Nadeau & Bengio).
- Same `random_state` for the CV splitter for both models, otherwise pairing is meaningless.

---

## McNemar's test on test-set predictions

Two classifiers, one held-out test set. Build the 2×2 contingency table of agreements:

```python
from statsmodels.stats.contingency_tables import mcnemar
import numpy as np

correct_a = (pred_a == y_test)
correct_b = (pred_b == y_test)

n00 = ((~correct_a) & (~correct_b)).sum()   # both wrong
n01 = ((~correct_a) &  correct_b ).sum()   # only B right
n10 = ( correct_a  & (~correct_b)).sum()   # only A right
n11 = ( correct_a  &  correct_b ).sum()    # both right

table = np.array([[n00, n01], [n10, n11]])
result = mcnemar(table, exact=False, correction=True)
print(f"McNemar  stat={result.statistic:.3f}  p={result.pvalue:.4f}")
```

Use `exact=True` if `n01 + n10 < 25`.

---

## Bootstrap CI on a single test-set metric

Quantifies "how lucky was this number?" without a competitor model.

```python
import numpy as np
rng = np.random.default_rng(42)
n = len(y_test)
n_boot = 1000

boot_scores = np.empty(n_boot)
for i in range(n_boot):
    idx = rng.integers(0, n, n)
    boot_scores[i] = roc_auc_score(y_test[idx], y_proba[idx])

lo, hi = np.percentile(boot_scores, [2.5, 97.5])
print(f"AUC = {boot_scores.mean():.4f}  [95% CI {lo:.4f}, {hi:.4f}]")
```

Two models' bootstrap CIs that overlap **do not** imply a non-significant difference — for that, bootstrap the *paired difference* instead:

```python
boot_diff = np.empty(n_boot)
for i in range(n_boot):
    idx = rng.integers(0, n, n)
    boot_diff[i] = roc_auc_score(y_test[idx], proba_b[idx]) - roc_auc_score(y_test[idx], proba_a[idx])
lo, hi = np.percentile(boot_diff, [2.5, 97.5])
# Significant at 5% if the CI excludes 0.
```

---

## Multiple-comparison correction

If you compare 10 models pairwise, you'll find a "significant" winner by chance. Apply Bonferroni (divide p by number of comparisons) or Holm. Or — better — pre-register the top 2 you'll formally test before looking at the test set.

---

## When NOT to test

- Models differ by **less than 1 std of CV scores** → it's noise. Pick on parsimony.
- You're going to deploy the simpler model anyway → the test is theatre.
- Sample is large enough that everything is "significant" → switch to **effect size**: how big is the gap, in business units?

A 0.001 AUC improvement that's "p < 0.001" because n = 1M is still operationally meaningless. **Significance ≠ importance.**
