# Predictions Engine Guide

## Prediction types
- `credit_volume` (30d/60d/90d): expected credits with low/high range.
- `uvs_retention_probability` (30d/60d/90d): UVS continuity likelihood.
- `device_failure_risk` (30d): likely device failures and key reasons.
- `fire_risk` (14d): near-term fire pressure score and recommended action.
- `market_demand` (30d): demand signal and projected pricing direction.
- `anomaly_forecast` (7d): probability and likely anomaly class.

## Confidence interval methodology
Intervals use baseline volatility bands around trend-adjusted statistical forecasts. Confidence scores decline as input sparsity and variance rise.

## How to interpret prediction charts
- Solid line: historical actuals.
- Dashed line: projected path.
- Shaded area: confidence band.
Wider bands imply lower certainty and higher operational risk.

## Historical accuracy reporting
Use `/api/predictions/:projectId/accuracy` to view realized accuracy, sample size, and whether performance is improving.

## Limitations and disclaimers
Predictions are decision-support signals, not guarantees. Weather shocks, outages, policy changes, and exogenous events may produce variance outside confidence bands.
