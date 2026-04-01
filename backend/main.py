"""
main.py — FastAPI backend for LSTM + XGBoost + Prophet Sales Forecasting
Run: uvicorn main:app --port 8000 --reload

Changes vs original:
  FIX 1 — evaluate() now receives Xte_flat (shape [N, 19]) instead of
           Xte3.reshape(len(Xte3), -1) (shape [N, 570]) which caused XGBoost
           feature shape mismatch.
  FIX 2 — load_models() called before build/train; retraining skipped when
           saved weights exist. prepare_data() still runs every time to rebuild
           in-memory state (_feat_df, _daily_df) needed by forecast().
  FIX 3 — /retrain endpoint added to force a fresh train without code changes.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import joblib
import io
from pathlib import Path
from lstm_forecaster import LSTMForecaster

app = FastAPI(title="Demand Forecasting API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

latest_forecast = None
MODELS_DIR = Path("models")
MODELS_DIR.mkdir(exist_ok=True)

REQUIRED_COLS = {"Order Date", "Sales"}


def _read_csv(file_bytes: bytes) -> pd.DataFrame:
    df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin1")

    if "Order Date" not in df.columns:
        raise ValueError(f"Missing 'Order Date'. Found: {df.columns.tolist()}")
    if "Sales" not in df.columns:
        raise ValueError(f"Missing 'Sales'. Found: {df.columns.tolist()}")

    try:
        df["Order Date"] = pd.to_datetime(df["Order Date"], dayfirst=True, errors="coerce")
    except Exception:
        df["Order Date"] = pd.to_datetime(df["Order Date"], infer_datetime_format=True, errors="coerce")

    before = len(df)
    df = df.dropna(subset=["Order Date", "Sales"])
    if (dropped := before - len(df)):
        print(f"⚠️  Dropped {dropped} unparseable rows")

    df["Sales"] = pd.to_numeric(df["Sales"], errors="coerce").fillna(0)
    return df


def _run_pipeline(
    fc: LSTMForecaster,
    df: pd.DataFrame,
    blend_weight_lstm: float,
    epochs: int,
    force_retrain: bool = False,
) -> dict:
    """
    Shared pipeline used by both /upload-and-forecast and /retrain.
    prepare_data() always runs (rebuilds in-memory state).
    Training is skipped when saved models load successfully, unless
    force_retrain=True.
    """
    (Xtr3, ytr, Xva3, yva,
 Xte3, yte,
 Xtr_flat, ytr_flat,
 Xva_flat, yva_flat,
 Xte_flat) = fc.prepare_data(df)

    if len(Xtr3) < 5:
        raise HTTPException(400, detail=(
            "Not enough data to train. "
            "Ensure your CSV covers multiple months."
        ))

    # FIX 2: skip training if saved models exist and retrain not forced
    if force_retrain or not fc.load_models():
        fc.build_model()
        fc.build_xgb_model()
        fc.build_prophet_model()
        fc.train(
            Xtr3, ytr, Xva3, yva, Xte3, yte,
            Xtr_flat, ytr_flat, Xva_flat, yva_flat,
            epochs=epochs,
        )
    else:
        print("⚡ Skipped training — using saved weights")

    # FIX 1: pass Xte_flat (shape [N, n_feat]) not Xte3 reshaped
    metrics = fc.evaluate(Xte3, yte, Xte_flat)

    result = fc.forecast(
        blend_weight_lstm=blend_weight_lstm,
        eval_metrics=metrics,
    )
    return result


@app.post("/validate-csv")
async def validate_csv(file: UploadFile = File(...)):
    try:
        content = await file.read()
        df = _read_csv(content)
        missing = REQUIRED_COLS - set(df.columns)
        if missing:
            raise HTTPException(400, detail=f"Missing columns: {missing}")
        return {
            "rows":       len(df),
            "columns":    df.columns.tolist(),
            "date_range": f"{df['Order Date'].min().date()} → {df['Order Date'].max().date()}",
            "message":    "CSV validated successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, detail=str(e))


@app.post("/upload-and-forecast")
async def upload_and_forecast(
    file: UploadFile = File(...),
    blend_weight_lstm: float = Query(default=0.5, ge=0.0, le=1.0),
    epochs: int = Query(default=100, ge=10, le=500),
):
    global latest_forecast
    try:
        content = await file.read()
        df = _read_csv(content)

        print(f"✅ {file.filename}  rows={len(df):,}  "
              f"{df['Order Date'].min().date()} → {df['Order Date'].max().date()}")

        fc = LSTMForecaster()

        # FIX 2 + FIX 1: use shared pipeline with load-before-train logic
        result = _run_pipeline(
            fc, df,
            blend_weight_lstm=blend_weight_lstm,
            epochs=epochs,
            force_retrain=False,   # use saved weights if available
        )
        result["filename"] = file.filename
        latest_forecast = result

        joblib.dump(result, MODELS_DIR / "latest_forecast.joblib")
        print("✅ Forecast complete")
        return result

    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(500, detail=str(e))


# FIX 3: dedicated retrain endpoint — always trains from scratch
@app.post("/retrain")
async def retrain(
    file: UploadFile = File(...),
    blend_weight_lstm: float = Query(default=0.5, ge=0.0, le=1.0),
    epochs: int = Query(default=200, ge=10, le=500),
):
    global latest_forecast
    try:
        content = await file.read()
        df = _read_csv(content)

        print(f"🔄 Force retrain — {file.filename}  rows={len(df):,}")

        fc = LSTMForecaster()

        result = _run_pipeline(
            fc, df,
            blend_weight_lstm=blend_weight_lstm,
            epochs=epochs,
            force_retrain=True,    # always rebuild + train from scratch
        )
        result["filename"] = file.filename
        latest_forecast = result

        joblib.dump(result, MODELS_DIR / "latest_forecast.joblib")
        print("✅ Retrain complete")
        return result

    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@app.get("/forecast/latest")
async def get_latest_forecast():
    global latest_forecast
    if latest_forecast is None:
        cache = MODELS_DIR / "latest_forecast.joblib"
        if cache.exists():
            latest_forecast = joblib.load(cache)
        else:
            raise HTTPException(404, detail="No forecast yet. Upload a CSV.")
    return latest_forecast


@app.get("/health")
async def health():
    return {"status": "running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)