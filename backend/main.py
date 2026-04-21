
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

from fastapi.responses import RedirectResponse

latest_forecast = None

# ---------------------------------------------------------
# ROOT ENDPOINT
# ---------------------------------------------------------
@app.get("/")
def read_root():
    # If the user opens the API natively in their browser, redirect them cleanly to the docs
    # so they don't see a confusing "404 Not Found" error in their server terminal!
    return RedirectResponse(url="/docs")
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

        fc = LSTMForecaster(target_col="Sales")
        result = _run_pipeline(fc, df, filename=file.filename, horizon_days=horizon_days)

        latest_forecast = result
        joblib.dump(result, MODELS_DIR / "latest_forecast.joblib")
        df.to_csv(MODELS_DIR / "latest_data.csv", index=False)

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

        fc = LSTMForecaster(target_col="Sales")
        result = _run_pipeline(fc, df, filename=file.filename, horizon_days=horizon_days)

        latest_forecast = result
        joblib.dump(result, MODELS_DIR / "latest_forecast.joblib")
        df.to_csv(MODELS_DIR / "latest_data.csv", index=False)

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
# GET INVENTORY FORECAST
# ---------------------------------------------------------
@app.get("/inventory-forecast")
async def get_inventory_forecast():
    data_path = MODELS_DIR / "latest_data.csv"
    if not data_path.exists() and Path("Global_Superstore2.csv").exists():
        data_path = Path("Global_Superstore2.csv")
    elif not data_path.exists():
        raise HTTPException(404, detail="No dataset found. Upload one first.")
    
    df = pd.read_csv(data_path, encoding="latin1")

    # Clean needed columns
    required = ["Product ID", "Product Name", "Category", "Sub-Category", "Quantity", "Order Date", "Ship Date", "Discount", "Profit", "Shipping Cost"]
    for col in required:
        if col not in df.columns:
            raise HTTPException(400, detail=f"Missing column {col}")

    # Parse dates
    df["Order Date"] = pd.to_datetime(df["Order Date"], errors="coerce")
    df["Ship Date"] = pd.to_datetime(df["Ship Date"], errors="coerce")
    df["Month"] = df["Order Date"].dt.month
    df["DayOfWeek"] = df["Order Date"].dt.dayofweek
    
    df["LeadTime"] = (df["Ship Date"] - df["Order Date"]).dt.days
    df["LeadTime"] = df["LeadTime"].fillna(0).clip(lower=0)

    # Filter to Top 50 products by volume to train fast
    grouped = df.groupby(["Product ID", "Product Name", "Category"]).agg({"Quantity": "sum", "LeadTime": "mean"}).reset_index()
    top_products_df = grouped.sort_values(by="Quantity", ascending=False).head(50)
    top_pids = top_products_df["Product ID"].unique()

    # Train XGBoost on top 50 products historical data
    train_df = df[df["Product ID"].isin(top_pids)].copy()
    
    # Encode categoricals safely
    from sklearn.preprocessing import LabelEncoder
    import xgboost as xgb
    import random
    
    le_cat = LabelEncoder()
    train_df["Category_enc"] = le_cat.fit_transform(train_df["Category"].fillna("").astype(str))
    le_sub = LabelEncoder()
    train_df["SubCat_enc"] = le_sub.fit_transform(train_df["Sub-Category"].fillna("").astype(str))
    le_pid = LabelEncoder()
    train_df["PID_enc"] = le_pid.fit_transform(train_df["Product ID"].fillna("").astype(str))
    
    features = ["Month", "DayOfWeek", "Discount", "Profit", "Shipping Cost", "Category_enc", "SubCat_enc", "PID_enc"]
    X = train_df[features].fillna(0)
    y = train_df["Quantity"].fillna(0)
    
    model = xgb.XGBRegressor(n_estimators=50, max_depth=3, learning_rate=0.1, n_jobs=-1, random_state=42)
    model.fit(X, y)
    
    inventory_items = []
    
    for idx, row_prod in top_products_df.iterrows():
        pid = row_prod["Product ID"]
        name = str(row_prod["Product Name"])
        cat = str(row_prod["Category"])
        avg_lead = max(1.0, row_prod["LeadTime"])
        
        # Simulating Next 30 Days using the product's average dependent metrics
        prod_hist = train_df[train_df["Product ID"] == pid]
        
        # Default fallbacks if empty
        if prod_hist.empty:
            avg_disc = 0.0
            avg_prof = 0.0
            avg_ship = 0.0
            pid_enc = 0
            cat_enc = 0
            subcat_enc = 0
        else:
            avg_disc = float(prod_hist["Discount"].mean())
            avg_prof = float(prod_hist["Profit"].mean())
            avg_ship = float(prod_hist["Shipping Cost"].mean())
            pid_enc  = float(prod_hist["PID_enc"].iloc[0])
            cat_enc  = float(prod_hist["Category_enc"].iloc[0])
            subcat_enc = float(prod_hist["SubCat_enc"].iloc[0])
        
        # Predict 30 days (assume generic month = 6, day = 0..29%7)
        future_X = pd.DataFrame({
            "Month": [6] * 30,
            "DayOfWeek": [i % 7 for i in range(30)],
            "Discount": [avg_disc] * 30,
            "Profit": [avg_prof] * 30,
            "Shipping Cost": [avg_ship] * 30,
            "Category_enc": [cat_enc] * 30,
            "SubCat_enc": [subcat_enc] * 30,
            "PID_enc": [pid_enc] * 30
        })
        
        preds = model.predict(future_X)
        forecast_demand_30d = float(preds.sum())
        
        # Fallback safeguard in case XGB regressor goes wild due to outliers
        if forecast_demand_30d < 0 or forecast_demand_30d > row_prod["Quantity"]:
            forecast_demand_30d = row_prod["Quantity"] / (365 * 4) * 30 
            
        daily_demand = forecast_demand_30d / 30.0

        safety_stock = int(daily_demand * avg_lead * 2) 
        if safety_stock < 10:
            safety_stock = 10
            
        current_stock = random.randint(0, safety_stock * 3) 
        
        days_of_stock = current_stock / daily_demand if daily_demand > 0 else 999
        status = "optimal"
        if current_stock < safety_stock * 0.7:
            status = "critical"
        elif current_stock < safety_stock * 1.5:
            status = "warning"

        inventory_items.append({
            "id": pid,
            "name": name,
            "category": cat,
            "currentStock": current_stock,
            "safetyStock": safety_stock,
            "forecastDemand": int(forecast_demand_30d),
            "daysOfStock": round(days_of_stock, 1),
            "status": status,
        })
    return inventory_items


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