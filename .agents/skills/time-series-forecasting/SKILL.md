---
name: time-series-forecasting
description: Best-practice suggestions for analyzing, building, comparing, or reviewing forecasts for dated or ordered data such as demand, energy, sales, traffic, sensors, macro, or finance series. Covers datetime indexing, resampling, trend and seasonality, lag features, temporal splits, decomposition, ACF/PACF, stationarity, ARIMA/SARIMA/SARIMAX, optional AutoGluon, multi-item forecasting, backtesting, metrics, and prediction intervals. Use ml-modeling for non-temporal supervised pipelines, statistical-modeling for coefficient inference and interrupted-time-series effects, data-warehousing for source tables, and analytics-project-setup for repository setup. Pair implementation reviews with code-review.
---

# Time Series Forecasting Best Practices

These are **suggestions**, not absolute rules. They are based on the CEU Time Series Forecasting course materials and gently refined with standard forecasting practice.

**Primary inspiration:** <https://github.com/francescaconselvan/time_series_forecasting> (Francesca Conselvan) — aggregation, temporal patterns, seasonal decomposition, ACF/PACF, ARIMA/SARIMA, AutoGluon, and electricity / beer / passenger forecasting examples.

## Default Stack

- `pandas`, `numpy` for timestamp parsing, indexing, resampling, and feature engineering.
- `matplotlib` for time plots, seasonal plots, and residual diagnostics.
- `statsmodels` for `seasonal_decompose` / STL, ADF/KPSS, ACF/PACF, ARIMA/SARIMAX, diagnostics.
- `scikit-learn` for metrics and simple ML baselines with explicit temporal splits.
- `autogluon.timeseries` only when automated or multi-series forecasting is required.

Keep the stack boring. For many business forecasts, seasonal naive plus
ARIMA/SARIMA is a strong comparison set. Add an AutoML model only when automated
or multi-series forecasting is part of the task.

## Core Principles

1. **Sort by time and set the frequency.** Parse timestamps, sort, deduplicate, choose a grain, and make missing timestamps visible.
2. **Never shuffle time.** Splits, cross-validation, and feature engineering must respect chronology.
3. **Define the forecast horizon first.** Evaluation must match the decision: next 30 minutes, next 7 days, next 12 months, etc.
4. **Always beat simple baselines.** Mean, last value, seasonal naive, and moving average are mandatory reference points.
5. **Avoid future leakage.** Rolling features, scalers, imputers, decomposition, and covariates must use only information available at forecast time.
6. **Evaluate with backtesting, not one lucky split.** Use rolling / expanding windows when data length allows.
7. **Report uncertainty.** Prefer prediction intervals / quantile forecasts when decisions depend on risk.
8. **Inspect residuals.** A model is not done if residuals still show obvious autocorrelation or seasonality.
9. **Match metrics to the business.** MAE/RMSE for units, MAPE/sMAPE/WAPE for relative error, pinball loss for quantiles.

## Recommended Workflow

```text
1. Frame:    Target, grain, horizon, forecast cadence, acceptable error, users.
2. Prepare:  Parse datetime, sort, set index/freq, handle duplicates and missing timestamps.
3. Explore:  Plot raw series; inspect trend, seasonality, outliers, level shifts, holidays.
4. Split:    Chronological train/validation/test; keep final test untouched.
5. Baseline: Last value, seasonal naive, moving average; record metrics.
6. Diagnose: Decomposition, stationarity checks, ACF/PACF; decide transforms/differencing.
7. Model:    ARIMA/SARIMA/SARIMAX and/or ML/AutoGluon with lag/calendar/covariate features.
8. Backtest: Rolling or expanding windows using the exact forecast horizon.
9. Evaluate: Same metrics and same cutoffs for every model; compare against baselines.
10. Explain: Forecast plot, residual diagnostics, interval coverage, known limitations.
11. Operate: Monitor error, bias, data freshness, missing future covariates, drift/regime changes.
```

## Data Preparation Checklist

- Convert timestamps once and early:

```python
df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)  # or document local timezone
df = df.sort_values("timestamp").drop_duplicates("timestamp")
df = df.set_index("timestamp").asfreq("30min")
```

- State the **grain** in a sentence: "one row per meter per 30-minute settlement period".
- Decide whether gaps mean zero, missing sensor readings, closed business days, or unavailable source data. These are different.
- Use explicit resampling rules:

```python
daily = df.resample("D").agg({"demand": "sum", "temperature": "mean"})
```

- Engineer calendar features only if they are known in advance: hour, day of week, month, holiday, business day.
- For lag / rolling features, shift before rolling to avoid using the current or future target:

```python
df["lag_1"] = df["y"].shift(1)
df["roll_24_mean"] = df["y"].shift(1).rolling(24).mean()
```

## Baselines First

At minimum, compare to:

```python
# one-step or horizon-aligned naive
pred_last = y_train.iloc[-1]

# seasonal naive: same period last season, e.g. 48 half-hours/day or 12 months/year
season = 48
pred_seasonal = y_history.shift(season).loc[test.index]
```

For seasonal data, **seasonal naive is the real baseline**. An ARIMA/AutoML model that cannot beat it is not useful yet.

## Splitting and Backtesting

Use chronological splits. For repeated evaluation, prefer expanding windows:

```python
from sklearn.model_selection import TimeSeriesSplit

tscv = TimeSeriesSplit(n_splits=5, test_size=forecast_horizon)
for train_idx, val_idx in tscv.split(df):
    train, val = df.iloc[train_idx], df.iloc[val_idx]
    # fit only on train; forecast exactly len(val)
```

For production-like evaluation, each validation fold should mimic how the forecast will actually run: same horizon, same retraining cadence, same available covariates.

## Exploration and Diagnostics

- Plot the full series and at least one zoomed-in window.
- Use seasonal plots / grouped summaries: hour-of-day, day-of-week, month, weekend vs weekday.
- Decompose trend/seasonality/residuals with a period that matches the data grain:

```python
from statsmodels.tsa.seasonal import seasonal_decompose

decomp = seasonal_decompose(y.asfreq("30min"), model="additive", period=48)
decomp.plot();
```

- Check stationarity with both visual judgement and tests. ADF rejects a unit root; KPSS rejects stationarity. Do not treat either as magic.
- Use ACF/PACF to guide AR/MA orders and to detect remaining autocorrelation after fitting.

## ARIMA / SARIMA / SARIMAX Pattern

Use ARIMA-family models for interpretable univariate or small-covariate forecasts.

```python
from statsmodels.tsa.statespace.sarimax import SARIMAX

model = SARIMAX(
    y_train,
    order=(p, d, q),
    seasonal_order=(P, D, Q, s),
    exog=X_train,                 # optional known-at-forecast-time covariates
    enforce_stationarity=False,
    enforce_invertibility=False,
)
res = model.fit()
forecast = res.get_forecast(steps=len(y_test), exog=X_test)
pred = forecast.predicted_mean
intervals = forecast.conf_int()
```

Guidance:

- Use transformations (`log1p`, Box-Cox) when variance grows with the level; back-transform carefully.
- `d` / `D` should be the minimum differencing needed for stable residuals; over-differencing hurts forecasts.
- For seasonal data, try SARIMA before a large non-seasonal ARIMA order.
- Exogenous variables must be known or separately forecast for the entire prediction horizon.
- After fitting, inspect `res.summary()`, residual plots, Ljung–Box, and residual ACF.

## AutoGluon Time Series Pattern

Use AutoGluon when you want a strong automated benchmark, multiple related series, or known covariates.

```python
from autogluon.timeseries import TimeSeriesDataFrame, TimeSeriesPredictor

ts = TimeSeriesDataFrame.from_data_frame(
    df,
    id_column="item_id",
    timestamp_column="timestamp",
)

predictor = TimeSeriesPredictor(
    prediction_length=forecast_horizon,
    target="y",
    freq="30min",
    eval_metric="MAE",  # or MAPE/WAPE/sMAPE/SQL depending on the decision
)
predictor.fit(ts_train)
leaderboard = predictor.leaderboard(ts_val)
pred = predictor.predict(ts)
```

Notes:

- Use one `item_id` per independent series, even if there is only one series.
- Pass known future covariates only if their future values are genuinely available.
- Keep a simple baseline outside AutoGluon so model value remains transparent.
- Save the predictor directory deliberately; AutoGluon artifacts can be large.

## Metrics Cheatsheet

| Metric | Use when | Caution |
|---|---|---|
| MAE | Stakeholders understand absolute error in target units | Treats all errors linearly |
| RMSE | Large errors are especially costly | Scale-dependent; sensitive to outliers |
| MAPE | Relative error is useful and target is never near zero | Explodes at zero / small actuals |
| sMAPE | Relative error with fewer zero issues than MAPE | Can still be unintuitive |
| WAPE | Aggregate business error, common in demand planning | Can hide poor performance on small series |
| MASE | Compare across series and against naive forecasts | Requires a clear seasonal naive denominator |
| Pinball / quantile loss | Probabilistic forecasts | Needs quantile forecasts |

Always show a plot of actual vs forecast for the test period. Metrics alone hide phase shifts, bias, and missed seasonality.

## Anti-Patterns to Flag in Reviews

- `train_test_split(..., shuffle=True)` or random CV on time series.
- Creating rolling means without `.shift(1)`.
- Fitting scalers, imputers, decomposition, or feature selection on the full series before splitting.
- Evaluating only one holdout window when enough history exists for backtesting.
- Claiming success without comparing to seasonal naive.
- Using MAPE when actuals can be zero or near-zero.
- Tuning ARIMA orders on the final test set.
- Using future weather / price / campaign covariates that would not be known at forecast time.
- Forecasting at a high frequency when the decision is made at a lower frequency, without justifying the grain.
- Ignoring residual autocorrelation, biased errors, or interval coverage.
- Absolute local paths and untracked generated model artifacts in notebooks.

## Data Sources for Practice

From the [course repository](https://github.com/francescaconselvan/time_series_forecasting):

- UK electricity demand, wind, and solar generation, half-hourly / daily examples.
- Smart meter electricity consumption.
- Australian beer production, monthly and quarterly.
- AirPassengers, monthly airline passengers.

Other useful sources:

- `statsmodels` datasets: `sunspots`, `co2`, `nile`, `macrodata`, `elnino`.
- FRED for macroeconomic time series.
- NOAA for weather and climate series.
- UCI Machine Learning Repository for sensor / operations time series.

When using external data, record source URL, download date, timezone, frequency, and any aggregation choices.

## Notebook Hygiene

- Put the timestamp parsing, frequency choice, horizon, and split dates near the top.
- Print train/validation/test date ranges, not just shapes.
- Number notebooks by workflow order if the project grows.
- Keep reusable metric, plotting, and backtesting helpers in shared modules rather than copy-pasting cells.
- Restart & Run All before relying on a notebook result.
- Follow the repository-wide requirement in `AGENTS.md` to clear all notebook outputs before committing.

---

*Suggestions, not gospel. When in doubt, prefer **simple seasonal baselines + honest temporal backtesting** over sophisticated models evaluated with leakage.*
