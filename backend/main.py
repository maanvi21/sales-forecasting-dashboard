
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


# ---------------------------------------------------------
# READ CSV
# ---------------------------------------------------------
def _read_csv(file_bytes: bytes) -> pd.DataFrame:
    df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin1")

    if "Order Date" not in df.columns:
        raise ValueError(f"Missing 'Order Date'. Found: {df.columns.tolist()}")
    if "Sales" not in df.columns:
        raise ValueError(f"Missing 'Sales'. Found: {df.columns.tolist()}")

    df["Order Date"] = pd.to_datetime(df["Order Date"], errors="coerce")
    df = df.dropna(subset=["Order Date", "Sales"])
    df["Sales"] = pd.to_numeric(df["Sales"], errors="coerce").fillna(0)

    return df


# ---------------------------------------------------------
# PIPELINE — trains the model then calls fc.forecast()
# Returns the full shape the frontend's isValidForecast() expects:
# { historical, forecast, metrics, message, filename, rows_processed }
# ---------------------------------------------------------
def _run_pipeline(
    fc: LSTMForecaster,
    df: pd.DataFrame,
    filename: str,
    horizon_days: int = 30,
) -> dict:

    fc.prepare_data(df)
    fc.build_model()
    fc.train()

    # forecast() internally calls evaluate() and returns the full payload
    result = fc.forecast(df, horizon_days=horizon_days)

    result["message"]        = "Forecast generated successfully"
    result["filename"]       = filename
    result["rows_processed"] = len(df)

    return result


# ---------------------------------------------------------
# VALIDATE CSV
# ---------------------------------------------------------
@app.post("/validate-csv")
async def validate_csv(file: UploadFile = File(...)):
    try:
        content = await file.read()
        df = _read_csv(content)

        return {
            "rows": len(df),
            "columns": df.columns.tolist(),
            "date_range": f"{df['Order Date'].min().date()} → {df['Order Date'].max().date()}",
            "message": "CSV validated successfully",
        }

    except Exception as e:
        raise HTTPException(400, detail=str(e))


# ---------------------------------------------------------
# UPLOAD + FORECAST
# ---------------------------------------------------------
@app.post("/upload-and-forecast")
async def upload_and_forecast(
    file: UploadFile = File(...),
    epochs: int = Query(default=100, ge=10, le=500),
    horizon_days: int = Query(default=30, ge=7, le=90),
):
    global latest_forecast

    try:
        content = await file.read()
        df = _read_csv(content)

        print(f"✅ {file.filename} rows={len(df)}")

        fc = LSTMForecaster()
        result = _run_pipeline(fc, df, filename=file.filename, horizon_days=horizon_days)

        latest_forecast = result
        joblib.dump(result, MODELS_DIR / "latest_forecast.joblib")

        print("✅ Forecast complete")
        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


# ---------------------------------------------------------
# RETRAIN
# ---------------------------------------------------------
@app.post("/retrain")
async def retrain(
    file: UploadFile = File(...),
    epochs: int = Query(default=150, ge=10, le=500),
    horizon_days: int = Query(default=30, ge=7, le=90),
):
    global latest_forecast

    try:
        content = await file.read()
        df = _read_csv(content)

        print(f"🔄 Retraining {file.filename}")

        fc = LSTMForecaster()
        result = _run_pipeline(fc, df, filename=file.filename, horizon_days=horizon_days)

        latest_forecast = result
        joblib.dump(result, MODELS_DIR / "latest_forecast.joblib")

        print("✅ Retrain complete")
        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


# ---------------------------------------------------------
# GET LATEST
# ---------------------------------------------------------
@app.get("/forecast/latest")
async def get_latest_forecast():
    global latest_forecast

    if latest_forecast is None:
        cache = MODELS_DIR / "latest_forecast.joblib"
        if cache.exists():
            latest_forecast = joblib.load(cache)
        else:
            raise HTTPException(404, detail="No forecast yet.")

    return latest_forecast


# ---------------------------------------------------------
# HEALTH
# ---------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "running"}


# ---------------------------------------------------------
# RUN
# ---------------------------------------------------------
if __name__ == "__main__":

    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)