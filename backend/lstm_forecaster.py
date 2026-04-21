# lstm_forecaster.py (FINAL CLEAN VERSION - No TensorFlow)

from __future__ import annotations
import pandas as pd
import numpy as np
import json
from pathlib import Path

from sklearn.preprocessing import MinMaxScaler, LabelEncoder
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.neural_network import MLPRegressor
import xgboost as xgb
import joblib

import warnings
warnings.filterwarnings("ignore")

WINDOW = 30

CAT_COLS = [
    "Ship Mode", "Segment", "City", "State", "Country",
    "Market", "Region", "Category", "Sub-Category", "Order Priority",
]

NUM_COLS = [
    "Postal Code", "Quantity", "Discount", "Profit", "Shipping Cost",
    "lag_1", "lag_7", "lag_14",
    "rolling_mean_7", "rolling_std_7",
    "trend", "sin_week", "cos_week"
]

DATE_COLS = ["Year", "Month", "Day", "WeekOfYear"]


class LSTMForecaster:
    """
    NOTE: Originally used an explicit LSTM via TensorFlow, but due to Windows 
    Application Control policies blocking TensorFlow DLLs, we have substituted 
    the engine with an MLPRegressor (Deep Neural Network) to preserve the 
    AI capabilities natively in Python. The class name remains LSTMForecaster 
    to prevent breaking existing API references.
    """
    def __init__(self, target_col: str = "Sales"):
        self.date_col   = "Order Date"
        self.target_col = target_col

        self.model_dir = Path("models")
        self.model_dir.mkdir(exist_ok=True)

        self.scaler         = MinMaxScaler()
        self.label_encoders = {}
        self.model          = None
        self.xgb_model      = None

        self._features: list[str] = []
        self._n_cols: int = 0

    def engineer_features(self, df: pd.DataFrame, fit: bool = False) -> pd.DataFrame:
        df = df.copy()

        df[self.date_col] = pd.to_datetime(df[self.date_col], dayfirst=True, errors="coerce")
        df = df.sort_values(self.date_col).reset_index(drop=True)

        df["Year"]      = df[self.date_col].dt.year
        df["Month"]     = df[self.date_col].dt.month
        df["Day"]       = df[self.date_col].dt.day
        df["WeekOfYear"]= df[self.date_col].dt.isocalendar().week.astype(int)
        df["day_of_week"]= df[self.date_col].dt.dayofweek

        df["lag_1"]  = df[self.target_col].shift(1)
        df["lag_7"]  = df[self.target_col].shift(7)
        df["lag_14"] = df[self.target_col].shift(14)

        df["rolling_mean_7"] = df[self.target_col].rolling(7).mean()
        df["rolling_std_7"]  = df[self.target_col].rolling(7).std()

        df["trend"]    = np.arange(len(df))
        df["sin_week"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
        df["cos_week"] = np.cos(2 * np.pi * df["day_of_week"] / 7)

        df = df.bfill().ffill().fillna(0)

        for col in CAT_COLS:
            if col in df.columns:
                df[col] = df[col].astype(str)
                if fit:
                    le = LabelEncoder()
                    df[col] = le.fit_transform(df[col])
                    self.label_encoders[col] = le
                else:
                    le = self.label_encoders.get(col)
                    if le is not None:
                        df[col] = df[col].map(
                            lambda x: x if x in le.classes_ else le.classes_[0]
                        )
                        df[col] = le.transform(df[col])
                    else:
                        df[col] = 0
            else:
                df[col] = 0

        return df

    def create_sequences(self, data: np.ndarray):
        X, y = [], []
        for i in range(len(data) - WINDOW):
            X.append(data[i : i + WINDOW, :-1])
            y.append(data[i + WINDOW, -1])
        return np.array(X), np.array(y)

    def prepare_data(self, df: pd.DataFrame):
        df_feat = self.engineer_features(df, fit=True)

        available_num = [c for c in NUM_COLS  if c in df_feat.columns]
        available_cat = [c for c in CAT_COLS  if c in df_feat.columns]
        self._features = available_num + DATE_COLS + available_cat

        data   = df_feat[self._features + [self.target_col]].values
        self._n_cols = data.shape[1]

        scaled = self.scaler.fit_transform(data)

        X, y   = self.create_sequences(scaled)

        split  = int(0.8 * len(X))
        self.X_train, self.X_test = X[:split], X[split:]
        self.y_train, self.y_test = y[:split], y[split:]

        print(f"✅ Data ready — train: {self.X_train.shape}  test: {self.X_test.shape}")

    def build_model(self):
        # We replace the complex TensorFlow Bidirectional logic with an equally capable
        # deep MLPRegressor that runs 100% natively in Python without triggering DLL blocks.
        self.model = MLPRegressor(
            hidden_layer_sizes=(128, 64, 32),
            activation='relu',
            solver='adam',
            alpha=0.001,
            batch_size=32,
            learning_rate='adaptive',
            max_iter=100,
            early_stopping=True,
            validation_fraction=0.2,
            random_state=42
        )
        
        self.xgb_model = xgb.XGBRegressor(
            n_estimators=100,
            learning_rate=0.05,
            max_depth=5,
            random_state=42
        )
        print("✅ Robust MLP Neural Network & XGBoost Models built")

    def train(self):
        # Flatten the sequences since both models now take 2D arrays (samples, features)
        print("⏳ Training MLP Neural Network Model...")
        X_train_flat = self.X_train.reshape((self.X_train.shape[0], -1))
        self.model.fit(X_train_flat, self.y_train)
        joblib.dump(self.model, self.model_dir / "mlp_model.joblib")
        print("✅ MLP Neural Network trained and saved")
        
        print("⏳ Training XGBoost Model...")
        self.xgb_model.fit(X_train_flat, self.y_train)
        print("✅ XGBoost Model trained")

    def evaluate(self) -> tuple[float, float, float, float]:
        X_test_flat = self.X_test.reshape((self.X_test.shape[0], -1))
        
        preds_scaled = self.model.predict(X_test_flat)
        preds_xgb_scaled = self.xgb_model.predict(X_test_flat)

        dummy_pred        = np.zeros((len(preds_scaled), self._n_cols))
        dummy_pred[:, -1] = preds_scaled
        preds_inv         = self.scaler.inverse_transform(dummy_pred)[:, -1]

        dummy_true        = np.zeros((len(self.y_test), self._n_cols))
        dummy_true[:, -1] = self.y_test
        y_inv             = self.scaler.inverse_transform(dummy_true)[:, -1]

        rmse = float(np.sqrt(mean_squared_error(y_inv, preds_inv)))
        mae  = float(mean_absolute_error(y_inv, preds_inv))

        dummy_xgb        = np.zeros((len(preds_xgb_scaled), self._n_cols))
        dummy_xgb[:, -1] = preds_xgb_scaled
        preds_xgb_inv    = self.scaler.inverse_transform(dummy_xgb)[:, -1]

        xgb_rmse = float(np.sqrt(mean_squared_error(y_inv, preds_xgb_inv)))
        xgb_mae  = float(mean_absolute_error(y_inv, preds_xgb_inv))

        print(f"📊 MLP   RMSE: {rmse:.2f}   MAE: {mae:.2f}")
        print(f"📊 XGB   RMSE: {xgb_rmse:.2f}   MAE: {xgb_mae:.2f}")
        return rmse, mae, xgb_rmse, xgb_mae

    def forecast(self, df: pd.DataFrame, horizon_days: int = 30) -> dict:
        hist_df = df.copy()
        hist_df[self.date_col] = pd.to_datetime(
            hist_df[self.date_col], dayfirst=True, errors="coerce"
        )
        hist_df = (
            hist_df.dropna(subset=[self.date_col])
                   .sort_values(self.date_col)
                   .tail(90)
        )

        historical = {
            "dates": hist_df[self.date_col].dt.strftime("%Y-%m-%d").tolist(),
            "sales": [round(float(v), 2) for v in hist_df[self.target_col].tolist()],
        }

        df_feat = self.engineer_features(df, fit=False)
        data    = df_feat[self._features + [self.target_col]].values
        scaled  = self.scaler.transform(data)

        window = scaled[-WINDOW:].copy()

        mlp_preds_scaled: list[float] = []
        xgb_preds_scaled: list[float]  = []

        for step in range(horizon_days):
            x_flat     = window[:, :-1].flatten().reshape(1, -1)
            
            pred_mlp_s = float(self.model.predict(x_flat)[0])
            mlp_preds_scaled.append(pred_mlp_s)
            
            pred_xgb_s = float(self.xgb_model.predict(x_flat)[0])
            xgb_preds_scaled.append(pred_xgb_s)

            # Slide window forward (use average momentum to prevent drift)
            new_row       = window[-1].copy()
            new_row[-1]   = (pred_mlp_s + pred_xgb_s) / 2.0
            
            trend_idx = self._features.index("trend") if "trend" in self._features else -1
            if trend_idx >= 0:
                new_row[trend_idx] = window[-1, trend_idx] + 1
            window = np.vstack([window[1:], new_row])

        dummy        = np.zeros((horizon_days, self._n_cols))
        dummy[:, -1] = mlp_preds_scaled
        mlp_preds    = [round(float(v), 2)
                        for v in self.scaler.inverse_transform(dummy)[:, -1]]

        dummy_xgb        = np.zeros((horizon_days, self._n_cols))
        dummy_xgb[:, -1] = xgb_preds_scaled
        xgb_preds    = [round(float(v), 2)
                        for v in self.scaler.inverse_transform(dummy_xgb)[:, -1]]

        blend_preds = [
            round((m + x) / 2, 2)
            for m, x in zip(mlp_preds, xgb_preds)
        ]

        last_date = hist_df[self.date_col].max()
        forecast_dates = (
            pd.date_range(
                start=last_date + pd.Timedelta(days=1),
                periods=horizon_days,
                freq="D",
            )
            .strftime("%Y-%m-%d")
            .tolist()
        )

        mlp_rmse, mlp_mae, xgb_rmse, xgb_mae = self.evaluate()
        
        xgb_rmse = round(xgb_rmse, 2)
        xgb_mae  = round(xgb_mae, 2)

        return {
            "historical": historical,
            "forecast": {
                "dates": forecast_dates,
                "lstm":  mlp_preds, # Sent out under 'lstm' label so frontend doesn't break
                "xgb":   xgb_preds,
                "blend": blend_preds,
            },
            "metrics": {
                "lstm_rmse":    round(mlp_rmse, 2), # Maintain key name mapping
                "lstm_mae":     round(mlp_mae, 2),
                "xgb_rmse":     xgb_rmse,
                "xgb_mae":      xgb_mae,
                "horizon_days": horizon_days,
            },
        }

if __name__ == "__main__":
    df = pd.read_csv("your_data.csv", encoding="latin1")

    f = LSTMForecaster()
    f.prepare_data(df)
    f.build_model()
    f.train()

    result = f.forecast(df, horizon_days=30)
    print("Forecast complete.")