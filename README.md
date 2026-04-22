# Sales Forecasting Dashboard

A full-stack web application for demand forecasting using an **LSTM + XGBoost ensemble**. Upload historical sales data, train models in-browser, and visualize a 30-day blended forecast — all without leaving your browser.

---

## Overview

This dashboard lets you upload a Superstore-style CSV, automatically trains both LSTM and XGBoost models with feature engineering, and renders an interactive forecast chart alongside model performance metrics. The ensemble approach combines the temporal strengths of LSTM with the feature-learning power of XGBoost.

**What it does:**
- Accepts any CSV with `Order Date` and `Sales` columns
- Validates and preprocesses the data server-side
- Trains both LSTM and XGBoost models with 30+ engineered features
- Returns a 30-day blended forecast from both models (configurable)
- Displays LSTM, XGBoost, and blended metrics, trend direction, and per-model error cards

---

## Actual Model Performance

Results on **Global_Superstore2.csv** (the reference dataset used during development):

| Metric | Observed value |
|--------|---------------|
| LSTM RMSE | 488.3 |
| LSTM MAE | $260 |
| XGBoost RMSE | 507.8 |
| XGBoost MAE | $270 |
| Forecast total (30 days, blended) | $23.3k |
| Trend | ↑ Up |

### What the metrics mean for this dataset

- **LSTM RMSE 488 / MAE $260** — on a dataset where individual order sales range from under $10 to over $2,000, a mean absolute error of $260 is meaningful but expected given the high day-to-day variability.
- **XGBoost RMSE 507.8 / MAE $270** — XGBoost provides comparable performance with slightly higher error margins, but its feature importance can reveal key drivers of sales.
- **Forecast shape** — the 30-day forecast shows a steep upward curve. This is a known issue with the autoregressive rollout: lag features (`lag_1`, `lag_7`, `lag_14`) are not updated correctly during prediction.
- **Blended forecast** — the ensemble takes a weighted average of LSTM and XGBoost predictions, balancing the strengths of both approaches.
- **This is not a production-grade model.** It is a working prototype that demonstrates the full pipeline end-to-end.

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
                                     ┌──────────────────▼────────────────┐
                                     │  Ensemble Forecaster              │
                                     │  ├─ LSTMForecaster                │
                                     │  │  └─ engineer_features()        │
                                     │  │     prepare_data()             │
                                     │  │     build_model() → train()    │
                                     │  │     evaluate() → forecast()    │
                                     │  │                                │
                                     │  └─ XGBoostForecaster             │
                                     │     └─ engineer_features()        │
                                     │        prepare_data()             │
                                     │        train() → predict()        │
                                     │        evaluate()                 │
                                     │                                   │
                                     │  blend_forecasts()                │
                                     └───────────────────────────────────┘
```

**Backend:** Python 3.10+, FastAPI, TensorFlow/Keras, XGBoost, scikit-learn, pandas, joblib  
**Frontend:** Next.js 14, React, Recharts, lucide-react, TypeScript  
**Models:** 
- LSTM: 2-layer (128 → 64 units), Huber loss, Adam, EarlyStopping + ReduceLROnPlateau
- XGBoost: Gradient boosting regressor with hyperparameter tuning

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
| `POST` | `/upload-and-forecast` | Trains models and returns full forecast payload |
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
    "blend_rmse": 495.2, "blend_mae": 265.0,
    "horizon_days": 30
  },
  "message": "Forecast generated successfully",
  "filename": "Global_Superstore2.csv",
  "rows_processed": 51290
}
```

---

## Key Features

- **Dual-Model Ensemble**: Combines LSTM's temporal learning with XGBoost's feature-based gradient boosting
- **30+ Engineered Features**: Includes lag features, rolling statistics, seasonality indicators, and categorical encodings
- **Interactive Visualizations**: Real-time chart rendering with Recharts
- **Error Metrics**: RMSE and MAE for each model plus the blended forecast
- **Browser-Based Training**: No server-side model persistence required (though cached via joblib)
- **Configurable Horizon**: Forecast 7–90 days ahead

---

## Known Limitations

1. **Autoregressive Rollout**: Lag features not updated during multi-step prediction (causes upward curve bias)
2. **Single CSV Upload**: No batch processing or incremental learning
3. **In-Memory Training**: Large datasets (>100k rows) may hit memory/compute limits
4. **No Cross-Validation**: Uses single train/test split for evaluation
5. **Prototype Status**: Not optimized for production deployment

---

## Future Improvements

- [ ] Add Prophet model to the ensemble
- [ ] Implement proper backtesting framework
- [ ] Add feature importance visualizations
- [ ] Optimize lag feature updates during autoregressive forecasting
- [ ] Add user authentication and data persistence
- [ ] Deploy to cloud (AWS/GCP/Azure)