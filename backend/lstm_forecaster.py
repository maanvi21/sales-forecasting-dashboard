"""
lstm_forecaster.py

FULLY CORRECTED VERSION (April 2026)

Key improvements applied:
- Target is properly scaled via MinMaxScaler (already good, but now explicitly stable)
- LSTM architecture simplified + stabilized (tanh + smaller units + moderate dropout)
- Learning rate lowered to 0.001 (was exploding gradients)
- Dropout reduced from 0.5 → 0.2 (was causing huge train loss fluctuation)
- Batch size reduced to 256 (more stable gradients)
- Better callbacks (higher patience + min_lr)
- Default epochs = 200 with strong EarlyStopping
- All previous FIX 1–10 kept intact
- No breaking changes to forecast() or evaluate() logic
"""

from __future__ import annotations

import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.preprocessing import MinMaxScaler, LabelEncoder
from sklearn.metrics import mean_squared_error, mean_absolute_error
from tensorflow.keras.models import Sequential, load_model as keras_load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.optimizers import Adam
import xgboost as xgb
import warnings

warnings.filterwarnings("ignore")

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    try:
        from fbprophet import Prophet
        PROPHET_AVAILABLE = True
    except ImportError:
        PROPHET_AVAILABLE = False
        print("⚠️  Prophet not installed — pip install prophet to enable it.")

# ── Feature columns ────────────────────────────────────────────────
CAT_COLS = [
    "Ship Mode", "Segment", "City", "State", "Country",
    "Market", "Region", "Category", "Sub-Category", "Order Priority",
]
NUM_COLS     = ["Postal Code", "Quantity", "Discount", "Profit", "Shipping Cost"]
DATE_DERIVED = ["Year", "Month", "Day", "WeekOfYear"]
SCALE_COLS   = NUM_COLS + DATE_DERIVED
ALL_FEATURE_COLS = CAT_COLS + NUM_COLS + DATE_DERIVED

WINDOW = 30


class LSTMForecaster:
    def __init__(self):
        self.date_col   = "Order Date"
        self.target_col = "Sales"
        self.horizon    = 21
        self.model_dir  = Path("models")
        self.model_dir.mkdir(exist_ok=True)

        self.sc: MinMaxScaler | None = None
        self.label_encoders: dict    = {}
        self.lstm_model              = None
        self.xgb_model               = None
        self.prophet_model           = None

        self._daily_df           = None
        self._feat_df            = None
        self._col_order          = None
        self._scale_cols_present = None

    # ------------------------------------------------------------------
    # Load saved models (skips retraining if everything exists)
    # ------------------------------------------------------------------
    def load_models(self) -> bool:
        required = [
            self.model_dir / "lstm_model.keras",
            self.model_dir / "xgb_model.joblib",
            self.model_dir / "scaler.joblib",
            self.model_dir / "label_encoders.joblib",
        ]
        if not all(p.exists() for p in required):
            print("⚠️  Saved models not found — will retrain.")
            return False

        try:
            self.lstm_model     = keras_load_model(self.model_dir / "lstm_model.keras")
            self.xgb_model      = joblib.load(self.model_dir / "xgb_model.joblib")
            self.sc             = joblib.load(self.model_dir / "scaler.joblib")
            self.label_encoders = joblib.load(self.model_dir / "label_encoders.joblib")

            prophet_path = self.model_dir / "prophet_model.joblib"
            if PROPHET_AVAILABLE and prophet_path.exists():
                self.prophet_model = joblib.load(prophet_path)

            print("✅ Loaded saved models — skipping training.")
            return True

        except Exception as e:
            print(f"⚠️  Failed to load saved models ({e}) — will retrain.")
            return False

    # ------------------------------------------------------------------
    # Shared inverse-scale helper
    # ------------------------------------------------------------------
    def _inverse_scale(self, scaled_col: np.ndarray) -> np.ndarray:
        n_scale = len(self._scale_cols_present)
        dummy = np.zeros((len(scaled_col), n_scale + 1))
        dummy[:, -1] = scaled_col
        return np.clip(self.sc.inverse_transform(dummy)[:, -1], 0, None)

    # ------------------------------------------------------------------
    # Feature engineering
    # ------------------------------------------------------------------
    def _engineer_features(self, df: pd.DataFrame, fit_encoders: bool = False) -> pd.DataFrame:
        df = df.copy()
        df[self.date_col] = pd.to_datetime(df[self.date_col], dayfirst=True, errors="coerce")
        df = df.dropna(subset=[self.date_col, self.target_col])
        df[self.target_col] = pd.to_numeric(df[self.target_col], errors="coerce").fillna(0)

        df["Year"]       = df[self.date_col].dt.year
        df["Month"]      = df[self.date_col].dt.month
        df["Day"]        = df[self.date_col].dt.day
        df["WeekOfYear"] = df[self.date_col].dt.isocalendar().week.astype(int)

        for col in NUM_COLS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(df[col].mean())
            else:
                df[col] = 0.0

        for col in CAT_COLS:
            if col in df.columns:
                df[col] = df[col].astype(str).fillna("unknown")
                if fit_encoders:
                    le = LabelEncoder()
                    df[col] = le.fit_transform(df[col])
                    self.label_encoders[col] = le
                else:
                    le = self.label_encoders[col]
                    known = set(le.classes_)
                    fallback = le.classes_[np.argmax(np.bincount(le.transform(le.classes_)))]
                    df[col] = df[col].map(lambda x: x if x in known else fallback)
                    df[col] = le.transform(df[col])
            else:
                df[col] = 0

        df = df.sort_values(self.date_col).reset_index(drop=True)
        return df

    # ------------------------------------------------------------------
    # Sliding-window builder
    # ------------------------------------------------------------------
    @staticmethod
    def _make_windows(arr: np.ndarray, window: int) -> tuple[np.ndarray, np.ndarray]:
        X, y = [], []
        for i in range(len(arr) - window):
            X.append(arr[i : i + window, :-1])
            y.append(arr[i + window, -1])
        return np.array(X, dtype=float), np.array(y, dtype=float)

    # ------------------------------------------------------------------
    # Prepare data (always runs)
    # ------------------------------------------------------------------
    def prepare_data(self, df: pd.DataFrame):
        df = df.copy()
        df[self.date_col] = pd.to_datetime(df[self.date_col], dayfirst=True, errors="coerce")
        df = df.dropna(subset=[self.date_col, self.target_col])
        df = df.sort_values(self.date_col).reset_index(drop=True)

        n  = len(df)
        t1 = int(0.80 * n)
        t2 = int(0.90 * n)

        train_raw = df.iloc[:t1].copy()
        val_raw   = df.iloc[t1:t2].copy()
        test_raw  = df.iloc[t2:].copy()

        train_df = self._engineer_features(train_raw, fit_encoders=True)
        val_df   = self._engineer_features(val_raw,   fit_encoders=False)
        test_df  = self._engineer_features(test_raw,  fit_encoders=False)

        self._feat_df = pd.concat([train_df, val_df, test_df]).reset_index(drop=True)

        daily = (
            self._feat_df
            .groupby(self.date_col)[self.target_col]
            .sum()
            .reset_index()
            .rename(columns={self.date_col: "date"})
        )
        self._daily_df = daily

        feat_cols = [c for c in ALL_FEATURE_COLS if c in train_df.columns]
        self._col_order = feat_cols

        scale_cols_present = [c for c in SCALE_COLS if c in train_df.columns]
        self._scale_cols_present = scale_cols_present

        def _to_arr(split_df: pd.DataFrame) -> np.ndarray:
            return split_df[scale_cols_present + [self.target_col]].values.astype(float)

        self.sc = MinMaxScaler(feature_range=(0, 1))
        train_sc = self.sc.fit_transform(_to_arr(train_df))
        val_sc   = self.sc.transform(_to_arr(val_df))
        test_sc  = self.sc.transform(_to_arr(test_df))

        def _full_arr(split_df: pd.DataFrame, scaled: np.ndarray) -> np.ndarray:
            cat_vals = split_df[[c for c in CAT_COLS if c in split_df.columns]].values
            return np.hstack([cat_vals, scaled])

        train_arr = _full_arr(train_df, train_sc)
        val_arr   = _full_arr(val_df,   val_sc)
        test_arr  = _full_arr(test_df,  test_sc)

        Xtr3, ytr = self._make_windows(train_arr, WINDOW)
        Xva3, yva = self._make_windows(val_arr,   WINDOW)
        Xte3, yte = self._make_windows(test_arr,  WINDOW)

        # Flat arrays for XGBoost (still uses scaled target — consistent with previous version)
        Xtr_flat = train_arr[WINDOW:, :-1]
        Xva_flat = val_arr[WINDOW:,   :-1]
        Xte_flat = test_arr[WINDOW:,  :-1]
        ytr_flat = train_arr[WINDOW:, -1]
        yva_flat = val_arr[WINDOW:,   -1]

        print(f"✅ Data prepared  train={Xtr3.shape}  val={Xva3.shape}  test={Xte3.shape}")
        return Xtr3, ytr, Xva3, yva, Xte3, yte, Xtr_flat, ytr_flat, Xva_flat, yva_flat, Xte_flat

    # ------------------------------------------------------------------
    # Build LSTM — CORRECTED ARCHITECTURE
    # ------------------------------------------------------------------
    def build_model(self):
        n_feat = len(self._col_order)
        self.lstm_model = Sequential([
            LSTM(64, return_sequences=True, activation="tanh",
                 input_shape=(WINDOW, n_feat)),
            Dropout(0.2),
            LSTM(64, return_sequences=True, activation="tanh"),
            Dropout(0.2),
            LSTM(32, return_sequences=False, activation="tanh"),
            Dropout(0.2),
            Dense(1),
        ])
        self.lstm_model.compile(
            optimizer=Adam(learning_rate=0.001),   # ← lowered from 0.01
            loss="mean_squared_error",
        )
        print(f"✅ 3-layer Stacked LSTM built  (input: {WINDOW} × {n_feat})\n")

    # ------------------------------------------------------------------
    # Build XGBoost & Prophet (unchanged)
    # ------------------------------------------------------------------
    def build_xgb_model(self):
        self.xgb_model = xgb.XGBRegressor(
            booster="gbtree",
            objective="reg:squarederror",
            subsample=0.8,
            colsample_bytree=0.85,
            learning_rate=0.01,
            max_depth=6,
            n_estimators=1000,
            early_stopping_rounds=50,
            random_state=42,
            n_jobs=-1,
        )
        print("✅ XGBoost built\n")

    def build_prophet_model(self):
        if not PROPHET_AVAILABLE:
            print("⚠️  Prophet skipped — not installed\n")
            return
        self.prophet_model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
        )
        print("✅ Prophet built\n")

    # ------------------------------------------------------------------
    # Train — CORRECTED PARAMETERS
    # ------------------------------------------------------------------
    def train(self, Xtr3, ytr, Xva3, yva, Xte3, yte,
              Xtr_flat, ytr_flat, Xva_flat, yva_flat,
              epochs: int = 200):                     # ← increased default

        print("🚀 Training LSTM (corrected config)...")
        self.lstm_model.fit(
            Xtr3, ytr,
            epochs=epochs,
            batch_size=256,                          # ← reduced from 512
            validation_data=(Xva3, yva),
            callbacks=[
                EarlyStopping(monitor="val_loss", patience=25,
                              restore_best_weights=True, verbose=1),
                ReduceLROnPlateau(monitor="val_loss", factor=0.5,
                                  patience=6, min_lr=1e-6, verbose=1),
            ],
            verbose=1,
        )
        self.lstm_model.save(self.model_dir / "lstm_model.keras")
        print("💾 LSTM saved\n")

        self.xgb_model.fit(
            Xtr_flat, ytr_flat,
            eval_set=[(Xva_flat, yva_flat)],
            verbose=False,
        )
        joblib.dump(self.xgb_model, self.model_dir / "xgb_model.joblib")
        print("💾 XGBoost saved\n")

        if PROPHET_AVAILABLE and self.prophet_model and self._daily_df is not None:
            pf = (self._daily_df
                  .rename(columns={"date": "ds", self.target_col: "y"})
                  .copy())
            pf["y"] = np.log1p(pf["y"].clip(lower=0))
            self.prophet_model.fit(pf)
            joblib.dump(self.prophet_model, self.model_dir / "prophet_model.joblib")
            print("💾 Prophet saved\n")

        joblib.dump(self.sc,             self.model_dir / "scaler.joblib")
        joblib.dump(self.label_encoders, self.model_dir / "label_encoders.joblib")

    # ------------------------------------------------------------------
    # Evaluate & Forecast (unchanged — all previous FIXES kept)
    # ------------------------------------------------------------------
    def evaluate(self, Xte3, yte_scaled, Xte_flat) -> dict:
        true_vals = self._inverse_scale(yte_scaled)

        pred_lstm = self._inverse_scale(
            self.lstm_model.predict(Xte3, verbose=0).flatten()
        )
        rmse_lstm = np.sqrt(mean_squared_error(true_vals, pred_lstm))
        mae_lstm  = mean_absolute_error(true_vals, pred_lstm)

        pred_xgb  = self._inverse_scale(self.xgb_model.predict(Xte_flat))
        rmse_xgb  = np.sqrt(mean_squared_error(true_vals, pred_xgb))
        mae_xgb   = mean_absolute_error(true_vals, pred_xgb)

        print("=== Test-set Metrics ===")
        print(f"  LSTM    — RMSE: {rmse_lstm:,.2f}  MAE: {mae_lstm:,.2f}")
        print(f"  XGBoost — RMSE: {rmse_xgb:,.2f}  MAE: {mae_xgb:,.2f}")

        return {
            "lstm": {"rmse": round(rmse_lstm, 2), "mae": round(mae_lstm, 2)},
            "xgb":  {"rmse": round(rmse_xgb,  2), "mae": round(mae_xgb,  2)},
        }

    def forecast(self, blend_weight_lstm: float = 0.5,
                 eval_metrics: dict | None = None) -> dict:
        # (Exact same code as you provided — no changes needed)
        n_cat   = len([c for c in CAT_COLS if c in self._feat_df.columns])
        n_scale = len(self._scale_cols_present)
        n_feat  = len(self._col_order)
        last_date = pd.Timestamp(self._daily_df["date"].iloc[-1])

        scale_arr = self._feat_df[
            self._scale_cols_present + [self.target_col]
        ].values.astype(float)
        cat_arr = self._feat_df[
            [c for c in CAT_COLS if c in self._feat_df.columns]
        ].values.astype(float)

        scale_sc  = self.sc.transform(scale_arr)
        full_arr  = np.hstack([cat_arr, scale_sc])

        seed_window = full_arr[-WINDOW:, :-1].copy()
        last_row    = full_arr[-1, :].copy()

        extended_features = list(seed_window)
        extended_sales_sc = list(full_arr[-WINDOW:, -1])
        future_feat_rows  = []

        for step in range(self.horizon):
            next_date = last_date + pd.Timedelta(days=step + 1)

            new_row = last_row.copy()

            date_vals_raw = np.array([
                next_date.year,
                next_date.month,
                next_date.day,
                next_date.isocalendar()[1],
            ], dtype=float)

            dummy_scale = new_row[n_cat : n_cat + n_scale].copy()
            dummy_scale[-4:] = date_vals_raw
            full_dummy = np.zeros((1, n_scale + 1))
            full_dummy[0, :-1] = dummy_scale
            scaled_dummy = self.sc.transform(full_dummy)
            new_row[n_cat : n_cat + n_scale] = scaled_dummy[0, :-1]

            feat_row = new_row[:-1].copy()
            extended_features.append(feat_row)
            future_feat_rows.append(feat_row)
            extended_sales_sc.append(0.0)

        lstm_input = np.array([
            extended_features[i : i + WINDOW]
            for i in range(self.horizon)
        ])

        lstm_preds_sc = self.lstm_model.predict(lstm_input, verbose=0).flatten()

        for i, sc_pred in enumerate(lstm_preds_sc):
            extended_sales_sc[WINDOW + i] = sc_pred

        xgb_input    = np.array(future_feat_rows)
        xgb_preds_sc = self.xgb_model.predict(xgb_input)

        preds_lstm  = self._inverse_scale(lstm_preds_sc).tolist()
        preds_xgb   = self._inverse_scale(xgb_preds_sc).tolist()
        preds_blend = [
            round(blend_weight_lstm * l + (1 - blend_weight_lstm) * x, 2)
            for l, x in zip(preds_lstm, preds_xgb)
        ]

        prophet_result = None
        if PROPHET_AVAILABLE and self.prophet_model:
            future = self.prophet_model.make_future_dataframe(
                periods=self.horizon, freq="D"
            )
            fc = self.prophet_model.predict(future).tail(self.horizon)
            sigma     = (fc["yhat_upper"].values - fc["yhat_lower"].values) / (2 * 1.96)
            corrected = np.expm1(fc["yhat"].values + 0.5 * sigma ** 2).clip(0)
            lower     = np.expm1(fc["yhat_lower"].values).clip(0)
            upper     = np.expm1(fc["yhat_upper"].values + 0.5 * sigma ** 2).clip(0)
            prophet_result = {
                "dates": fc["ds"].dt.strftime("%Y-%m-%d").tolist(),
                "sales": corrected.round(2).tolist(),
                "lower": lower.round(2).tolist(),
                "upper": upper.round(2).tolist(),
            }

        future_dates = pd.date_range(
            start=last_date + pd.Timedelta(days=1),
            periods=self.horizon,
            freq="D",
        ).strftime("%Y-%m-%d").tolist()

        metrics_out = {
            "lstm_rmse":    eval_metrics["lstm"]["rmse"] if eval_metrics else 0.0,
            "lstm_mae":     eval_metrics["lstm"]["mae"]  if eval_metrics else 0.0,
            "xgb_rmse":     eval_metrics["xgb"]["rmse"]  if eval_metrics else 0.0,
            "xgb_mae":      eval_metrics["xgb"]["mae"]   if eval_metrics else 0.0,
            "horizon_days": self.horizon,
        }

        return {
            "historical": {
                "dates": self._daily_df["date"].dt.strftime("%Y-%m-%d").tail(180).tolist(),
                "sales": self._daily_df[self.target_col].tail(180).round(2).tolist(),
            },
            "forecast": {
                "dates":   future_dates,
                "lstm":    [round(p, 2) for p in preds_lstm],
                "xgb":     [round(p, 2) for p in preds_xgb],
                "blend":   preds_blend,
                "prophet": prophet_result,
            },
            "metrics":        metrics_out,
            "message":        "3-Layer LSTM + XGBoost + Prophet Ensemble (FULLY CORRECTED)",
            "rows_processed": len(self._feat_df),
        }