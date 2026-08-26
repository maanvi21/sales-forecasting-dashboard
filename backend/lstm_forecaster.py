# lstm_forecaster.py — PyTorch LSTM + XGBoost ensemble

from __future__ import annotations
import pandas as pd
import numpy as np
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from sklearn.preprocessing import MinMaxScaler, LabelEncoder
from sklearn.metrics import mean_squared_error, mean_absolute_error
import xgboost as xgb
import joblib

import warnings
warnings.filterwarnings("ignore")

WINDOW = 30
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

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

# Features that are recomputed at every step of the autoregressive rollout.
# Everything else in NUM_COLS/CAT_COLS has no future information available,
# so it's carried forward at its last known value.
_DERIVED_COLS = {
    "lag_1", "lag_7", "lag_14", "rolling_mean_7", "rolling_std_7",
    "trend", "sin_week", "cos_week", "Year", "Month", "Day", "WeekOfYear",
}


class _LSTMNet(nn.Module):
    """2-layer stacked LSTM (128 -> 64 units) + linear head."""

    def __init__(self, n_features: int):
        super().__init__()
        self.lstm1 = nn.LSTM(n_features, 128, batch_first=True)
        self.drop1 = nn.Dropout(0.2)
        self.lstm2 = nn.LSTM(128, 64, batch_first=True)
        self.drop2 = nn.Dropout(0.2)
        self.fc = nn.Linear(64, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm1(x)
        out = self.drop1(out)
        out, _ = self.lstm2(out)
        out = self.drop2(out)
        last_step = out[:, -1, :]          # final timestep's hidden state
        return self.fc(last_step).squeeze(-1)


class LSTMForecaster:
    """
    Sequence forecaster combining a genuine PyTorch LSTM (2-layer, 128 -> 64
    units, Huber loss, Adam, ReduceLROnPlateau, early stopping) with an
    XGBoost regressor trained on the same flattened windows. Predictions
    from both are blended by simple averaging.
    """

    def __init__(self, target_col: str = "Sales"):
        self.date_col   = "Order Date"
        self.target_col = target_col

        self.model_dir = Path("models")
        self.model_dir.mkdir(exist_ok=True)

        self.scaler         = MinMaxScaler()
        self.label_encoders = {}
        self.model: _LSTMNet | None = None
        self.xgb_model       = None

        self._features: list[str] = []
        self._n_cols: int = 0

    # -----------------------------------------------------------------
    # FEATURE ENGINEERING
    # -----------------------------------------------------------------
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

    # -----------------------------------------------------------------
    # DATA PREP
    # -----------------------------------------------------------------
    def prepare_data(self, df: pd.DataFrame):
        df_feat = self.engineer_features(df, fit=True)

        available_num = [c for c in NUM_COLS  if c in df_feat.columns]
        available_cat = [c for c in CAT_COLS  if c in df_feat.columns]
        self._features = available_num + DATE_COLS + available_cat

        data   = df_feat[self._features + [self.target_col]].values
        self._n_cols = data.shape[1]

        scaled = self.scaler.fit_transform(data)

        X, y   = self.create_sequences(scaled)

        # Chronological 80/20 train/test split — never shuffle time series.
        split  = int(0.8 * len(X))
        self.X_train, self.X_test = X[:split], X[split:]
        self.y_train, self.y_test = y[:split], y[split:]

        # Carve an internal validation tail out of the *training* portion for
        # early stopping / LR scheduling, so the test set stays untouched
        # until final evaluation.
        val_split = max(1, int(0.85 * len(self.X_train)))
        self.X_tr,  self.X_val = self.X_train[:val_split], self.X_train[val_split:]
        self.y_tr,  self.y_val = self.y_train[:val_split], self.y_train[val_split:]

        print(f"✅ Data ready — train: {self.X_tr.shape}  val: {self.X_val.shape}  test: {self.X_test.shape}")

    # -----------------------------------------------------------------
    # MODEL BUILD
    # -----------------------------------------------------------------
    def build_model(self):
        n_features = self.X_train.shape[2]
        self.model = _LSTMNet(n_features).to(DEVICE)

        self.xgb_model = xgb.XGBRegressor(
            n_estimators=100,
            learning_rate=0.05,
            max_depth=5,
            random_state=42
        )
        print(f"✅ PyTorch LSTM (2-layer, 128→64) & XGBoost models built — device: {DEVICE}")

    # -----------------------------------------------------------------
    # TRAIN
    # -----------------------------------------------------------------
    def train(self, epochs: int = 100, batch_size: int = 32, patience: int = 10):
        print("⏳ Training PyTorch LSTM...")

        Xtr = torch.tensor(self.X_tr, dtype=torch.float32)
        ytr = torch.tensor(self.y_tr, dtype=torch.float32)
        Xval = torch.tensor(self.X_val, dtype=torch.float32).to(DEVICE)
        yval = torch.tensor(self.y_val, dtype=torch.float32).to(DEVICE)

        loader = DataLoader(TensorDataset(Xtr, ytr), batch_size=batch_size, shuffle=True)

        criterion = nn.HuberLoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=1e-3)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode="min", factor=0.5, patience=3
        )

        best_val_loss = float("inf")
        best_state = None
        wait = 0

        for epoch in range(epochs):
            self.model.train()
            for xb, yb in loader:
                xb, yb = xb.to(DEVICE), yb.to(DEVICE)
                optimizer.zero_grad()
                pred = self.model(xb)
                loss = criterion(pred, yb)
                loss.backward()
                optimizer.step()

            self.model.eval()
            with torch.no_grad():
                val_loss = criterion(self.model(Xval), yval).item()
            scheduler.step(val_loss)

            if val_loss < best_val_loss - 1e-5:
                best_val_loss = val_loss
                best_state = {k: v.clone() for k, v in self.model.state_dict().items()}
                wait = 0
            else:
                wait += 1
                if wait >= patience:
                    print(f"⏹ Early stopping at epoch {epoch + 1}/{epochs} (best val loss {best_val_loss:.5f})")
                    break

        if best_state is not None:
            self.model.load_state_dict(best_state)

        torch.save(self.model.state_dict(), self.model_dir / "lstm_model.pt")
        print(f"✅ LSTM trained — best val loss {best_val_loss:.5f}")

        print("⏳ Training XGBoost...")
        X_train_flat = self.X_train.reshape((self.X_train.shape[0], -1))
        self.xgb_model.fit(X_train_flat, self.y_train)
        joblib.dump(self.xgb_model, self.model_dir / "xgb_model.joblib")
        print("✅ XGBoost trained")

    # -----------------------------------------------------------------
    # PREDICT HELPERS
    # -----------------------------------------------------------------
    def _lstm_predict(self, X: np.ndarray) -> np.ndarray:
        self.model.eval()
        with torch.no_grad():
            xt = torch.tensor(X, dtype=torch.float32).to(DEVICE)
            preds = self.model(xt).cpu().numpy()
        return preds

    def _inverse_target(self, scaled_value: float) -> float:
        dummy = np.zeros((1, self._n_cols))
        dummy[0, -1] = scaled_value
        return float(self.scaler.inverse_transform(dummy)[0, -1])

    # -----------------------------------------------------------------
    # EVALUATE
    # -----------------------------------------------------------------
    def evaluate(self) -> tuple[float, float, float, float]:
        preds_lstm_scaled = self._lstm_predict(self.X_test)

        X_test_flat = self.X_test.reshape((self.X_test.shape[0], -1))
        preds_xgb_scaled = self.xgb_model.predict(X_test_flat)

        dummy_pred        = np.zeros((len(preds_lstm_scaled), self._n_cols))
        dummy_pred[:, -1] = preds_lstm_scaled
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

        print(f"📊 LSTM  RMSE: {rmse:.2f}   MAE: {mae:.2f}")
        print(f"📊 XGB   RMSE: {xgb_rmse:.2f}   MAE: {xgb_mae:.2f}")
        return rmse, mae, xgb_rmse, xgb_mae

    # -----------------------------------------------------------------
    # FORECAST — proper autoregressive rollout
    #
    # Every derived feature (lags, rolling stats, trend, calendar parts) is
    # recomputed at each step from a running history of true + predicted
    # target values, instead of being carried forward unchanged. This is
    # what the previous implementation got wrong: it froze all derived
    # features after the last real observation, so lag_7/lag_14 stayed
    # constant across the whole horizon and the model latched onto trend's
    # naive +1 increment, producing an artificial upward drift.
    # -----------------------------------------------------------------
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

        # Values with no future information — held constant across the horizon.
        last_row = df_feat.iloc[-1]
        carried = {c: last_row[c] for c in self._features if c not in _DERIVED_COLS}

        # True (unscaled) target history — grows with each prediction so
        # lag_7/lag_14/rolling stats are computed from a real running series.
        history: list[float] = df_feat[self.target_col].tolist()
        last_trend = float(last_row["trend"])
        last_date  = hist_df[self.date_col].max()

        data_all   = df_feat[self._features + [self.target_col]].values
        scaled_all = self.scaler.transform(data_all)
        window     = scaled_all[-WINDOW:, :-1].copy()   # (WINDOW, n_features), features only

        lstm_preds, xgb_preds, blend_preds, forecast_dates = [], [], [], []

        for step in range(horizon_days):
            future_date = last_date + pd.Timedelta(days=step + 1)
            forecast_dates.append(future_date.strftime("%Y-%m-%d"))
            dow = future_date.dayofweek

            recent7 = history[-7:]
            raw_row = dict(carried)
            raw_row["Year"]           = future_date.year
            raw_row["Month"]          = future_date.month
            raw_row["Day"]            = future_date.day
            raw_row["WeekOfYear"]     = int(future_date.isocalendar().week)
            raw_row["lag_1"]          = history[-1]
            raw_row["lag_7"]          = history[-7] if len(history) >= 7 else history[0]
            raw_row["lag_14"]         = history[-14] if len(history) >= 14 else history[0]
            raw_row["rolling_mean_7"] = float(np.mean(recent7))
            raw_row["rolling_std_7"]  = float(np.std(recent7)) if len(recent7) > 1 else 0.0
            last_trend += 1
            raw_row["trend"]    = last_trend
            raw_row["sin_week"] = np.sin(2 * np.pi * dow / 7)
            raw_row["cos_week"] = np.cos(2 * np.pi * dow / 7)

            ordered_row  = [raw_row[c] for c in self._features] + [history[-1]]
            scaled_row   = self.scaler.transform(np.array(ordered_row).reshape(1, -1))[0]
            window       = np.vstack([window[1:], scaled_row[:-1]])

            x_seq = window.reshape(1, WINDOW, -1)
            pred_lstm_s = float(self._lstm_predict(x_seq)[0])

            x_flat = window.flatten().reshape(1, -1)
            pred_xgb_s = float(self.xgb_model.predict(x_flat)[0])

            blend_s = (pred_lstm_s + pred_xgb_s) / 2.0

            lstm_val  = self._inverse_target(pred_lstm_s)
            xgb_val   = self._inverse_target(pred_xgb_s)
            blend_val = self._inverse_target(blend_s)

            lstm_preds.append(round(lstm_val, 2))
            xgb_preds.append(round(xgb_val, 2))
            blend_preds.append(round(blend_val, 2))

            # Feed the blended prediction back in as the next step's "true"
            # value — this is what makes lag_7/lag_14/rolling stats correct
            # for subsequent steps instead of frozen at their last real value.
            history.append(blend_val)

        lstm_rmse, lstm_mae, xgb_rmse, xgb_mae = self.evaluate()

        return {
            "historical": historical,
            "forecast": {
                "dates": forecast_dates,
                "lstm":  lstm_preds,
                "xgb":   xgb_preds,
                "blend": blend_preds,
            },
            "metrics": {
                "lstm_rmse":    round(lstm_rmse, 2),
                "lstm_mae":     round(lstm_mae, 2),
                "xgb_rmse":     round(xgb_rmse, 2),
                "xgb_mae":      round(xgb_mae, 2),
                "horizon_days": horizon_days,
            },
        }


if __name__ == "__main__":
    df = pd.read_csv("your_data.csv", encoding="latin1")

    f = LSTMForecaster()
    f.prepare_data(df)
    f.build_model()
    f.train(epochs=50)

    result = f.forecast(df, horizon_days=30)
    print("Forecast complete.")
