# SaaS Sales Forecasting Dashboard

A full-stack web application for demand forecasting using an LSTM neural network ensemble. Upload historical sales data, train a model in-browser, and visualise a 30-day blended forecast — all without leaving the dashboard.

---

## Overview

This dashboard lets you upload a Superstore-style CSV, automatically trains an LSTM model with feature engineering, and renders an interactive forecast chart alongside model performance metrics. The backend exposes a FastAPI REST API; the frontend is built in Next.js with Recharts.

**What it does:**
- Accepts any CSV with `Order Date` and `Sales` columns
- Validates and preprocesses the data server-side
- Trains an LSTM model with 30+ engineered features
- Returns a 30-day autoregressive forecast (configurable)
- Displays LSTM and blended metrics, trend direction, and per-model error cards

---

## Actual Model Performance

Results on **Global_Superstore2.csv** (the reference dataset used during development):

| Metric | Observed value |
|--------|---------------|
| LSTM RMSE | 488.3 |
| LSTM MAE | $260 |
| XGB RMSE | 507.8 |
| XGB MAE | $270 |
| Forecast total (30 days, blended) | $23.3k |
| Trend | ↑ Up |

> **Note on XGBoost metrics:** The current implementation does not include a real XGBoost model. The `xgb` forecast line and its metrics are derived from the LSTM output with calibrated noise. These numbers are placeholders and will be replaced once a real `XGBRegressor` is wired in.

### What the metrics mean for this dataset

- **RMSE 488 / MAE $260** — on a dataset where individual order sales range from under $10 to over $2 000, a mean absolute error of $260 is meaningful but expected given the high day-to-day variance in the data. The model captures the general trend but not sharp order-level spikes.
- **Forecast shape** — the 30-day forecast shows a steep upward curve. This is a known issue with the autoregressive rollout: lag features (`lag_1`, `lag_7`, `lag_14`) are not updated correctly as the window advances, causing compounding drift over longer horizons. The first 7–10 days are more reliable than the tail.
- **This is not a production-grade model.** It is a working prototype that demonstrates the full pipeline end-to-end.

---

## Known Limitations

These are documented issues in the current codebase:

| Issue | Impact |
|-------|--------|
| Lag features go stale during autoregressive rollout | Forecast drifts upward beyond ~7 days |
| No real XGBoost model | XGB line and metrics are simulated |
| `evaluate()` runs inside `forecast()` on every call | Slow — test-set inference runs twice per request |
| Training blocks the FastAPI event loop (sync function) | Server is single-threaded during training |
| No minimum dataset size guard | Small CSVs (&lt;100 rows) produce near-zero training samples silently |
| `epochs` query param accepted but not passed to `train()` | Always runs with EarlyStopping defaults regardless |
| No file size limit on upload | Large CSVs read fully into memory before validation |

---

## Architecture

```
┌─────────────────────────────────┐     ┌───────────────────────────────┐
│  Next.js frontend (page.tsx)    │────▶│  FastAPI backend (main.py)    │
│  Recharts visualisation         │     │  /validate-csv                │
│  Stat cards, tab views          │◀────│  /upload-and-forecast         │
│  isValidForecast() shape guard  │     │  /forecast/latest             │
└─────────────────────────────────┘     └──────────────┬────────────────┘
                                                        │
                                         ┌──────────────▼────────────────┐
                                         │  LSTMForecaster               │
                                         │  engineer_features()          │
                                         │  prepare_data()               │
                                         │  build_model() → train()      │
                                         │  evaluate() → forecast()      │
                                         └───────────────────────────────┘
```

**Backend:** Python 3.10+, FastAPI, TensorFlow/Keras, scikit-learn, pandas, joblib  
**Frontend:** Next.js 14, React, Recharts, lucide-react, TypeScript  
**Model:** 2-layer LSTM (128 → 64 units), Huber loss, Adam, EarlyStopping + ReduceLROnPlateau

---

## Input Data Format

The CSV must contain at minimum:

| Column | Type | Example |
|--------|------|---------|
| `Order Date` | Date string | `2023-01-15` or `15/01/2023` |
| `Sales` | Numeric | `1250.00` |

Optional columns that improve accuracy when present: `Ship Mode`, `Segment`, `Category`, `Sub-Category`, `Quantity`, `Discount`, `Profit`, `Shipping Cost`, `Region`, `Market`.

Minimum recommended history: **90+ days** of daily data. The model uses a 30-day lookback window, so fewer than ~60 rows will produce very few training sequences.

---

## Setup

```bash
# Backend
pip install fastapi uvicorn tensorflow scikit-learn pandas joblib xgboost python-multipart
uvicorn main:app --port 8000 --reload

# Frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:8000`. Update the `API` constant in `page.tsx` to change this.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/validate-csv` | Validates columns, returns row count and date range |
| `POST` | `/upload-and-forecast` | Trains model and returns full forecast payload |
| `POST` | `/retrain` | Re-trains on a new file, replaces cached result |
| `GET` | `/forecast/latest` | Returns last cached forecast (persisted via joblib) |
| `GET` | `/health` | `{"status": "running"}` |

Both `POST` forecast endpoints accept optional query params:
- `horizon_days` (int, 7–90, default 30) — forecast window length
- `epochs` (int, 10–500, default 100) — *(currently not passed to training — known bug)*

---

## Forecast Payload Shape

The API returns (and the frontend validates against) this exact structure:

```json
{
  "historical": { "dates": ["2023-10-01", "..."], "sales": [312.5, "..."] },
  "forecast":   { "dates": ["2023-12-01", "..."], "lstm": [...], "xgb": [...], "blend": [...] },
  "metrics": {
    "lstm_rmse": 488.3, "lstm_mae": 260.0,
    "xgb_rmse": 507.8,  "xgb_mae": 270.0,
    "horizon_days": 30
  },
  "message": "Forecast generated successfully",
  "filename": "Global_Superstore2.csv",
  "rows_processed": 51290
}
```

---

## Roadmap

- [ ] Replace simulated XGBoost with a real `XGBRegressor` trained on the same feature matrix
- [ ] Fix lag feature updates in the autoregressive rollout window
- [ ] Move training to a background task (`asyncio.run_in_executor` or Celery)
- [ ] Add confidence interval bands to the forecast chart
- [ ] Per-category forecasting (not just aggregate sales)
- [ ] Model persistence and reload (currently retrains on every upload)
