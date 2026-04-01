# lstm_forecaster.py (FINAL CLEAN VERSION)

from __future__ import annotations
import pandas as pd
import numpy as np
from pathlib import Path

from sklearn.preprocessing import MinMaxScaler, LabelEncoder
from sklearn.metrics import mean_squared_error, mean_absolute_error

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.optimizers import Adam

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

    def __init__(self):
        self.date_col = "Order Date"
        self.target_col = "Sales"

        self.model_dir = Path("models")
        self.model_dir.mkdir(exist_ok=True)

        self.scaler = MinMaxScaler()
        self.label_encoders = {}
        self.model = None

    # ---------------------------------------------------------
    # FEATURE ENGINEERING
    # ---------------------------------------------------------
    def engineer_features(self, df: pd.DataFrame, fit=False):

        df = df.copy()

        # Convert & sort
        df[self.date_col] = pd.to_datetime(df[self.date_col], dayfirst=True)
        df = df.sort_values(self.date_col)

        # Date features
        df["Year"] = df[self.date_col].dt.year
        df["Month"] = df[self.date_col].dt.month
        df["Day"] = df[self.date_col].dt.day
        df["WeekOfYear"] = df[self.date_col].dt.isocalendar().week.astype(int)
        df["day_of_week"] = df[self.date_col].dt.dayofweek

        # 🔥 Lag features
        df["lag_1"] = df[self.target_col].shift(1)
        df["lag_7"] = df[self.target_col].shift(7)
        df["lag_14"] = df[self.target_col].shift(14)

        # 🔥 Rolling features
        df["rolling_mean_7"] = df[self.target_col].rolling(7).mean()
        df["rolling_std_7"] = df[self.target_col].rolling(7).std()

        # 🔥 Trend
        df["trend"] = np.arange(len(df))

        # 🔥 Seasonality
        df["sin_week"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
        df["cos_week"] = np.cos(2 * np.pi * df["day_of_week"] / 7)

        # Handle missing values (FIXED)
        df = df.bfill().ffill().fillna(0)

        # Encode categorical
        for col in CAT_COLS:
            if col in df.columns:
                df[col] = df[col].astype(str)

                if fit:
                    le = LabelEncoder()
                    df[col] = le.fit_transform(df[col])
                    self.label_encoders[col] = le
                else:
                    le = self.label_encoders[col]
                    df[col] = df[col].map(lambda x: x if x in le.classes_ else le.classes_[0])
                    df[col] = le.transform(df[col])
            else:
                df[col] = 0

        return df

    # ---------------------------------------------------------
    # CREATE SEQUENCES
    # ---------------------------------------------------------
    def create_sequences(self, data):

        X, y = [], []
        for i in range(len(data) - WINDOW):
            X.append(data[i:i + WINDOW, :-1])
            y.append(data[i + WINDOW, -1])

        return np.array(X), np.array(y)

    # ---------------------------------------------------------
    # PREPARE DATA
    # ---------------------------------------------------------
    def prepare_data(self, df):

        df = self.engineer_features(df, fit=True)

        # Use only available columns (FIXED)
        available_num = [col for col in NUM_COLS if col in df.columns]
        available_cat = [col for col in CAT_COLS if col in df.columns]

        features = available_num + DATE_COLS + available_cat

        data = df[features + [self.target_col]].values

        # Scale
        scaled = self.scaler.fit_transform(data)

        # Create sequences
        X, y = self.create_sequences(scaled)

        # Train-test split
        split = int(0.8 * len(X))
        self.X_train, self.X_test = X[:split], X[split:]
        self.y_train, self.y_test = y[:split], y[split:]

        print("✅ Data ready:", self.X_train.shape)

    # ---------------------------------------------------------
    # BUILD MODEL
    # ---------------------------------------------------------
    def build_model(self):

        n_feat = self.X_train.shape[2]

        self.model = Sequential([
            LSTM(128, return_sequences=True, input_shape=(WINDOW, n_feat)),
            Dropout(0.2),

            LSTM(64),
            Dropout(0.2),

            Dense(32, activation="relu"),
            Dense(1)
        ])

        self.model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss="huber"
        )

        print("✅ Model built")

    # ---------------------------------------------------------
    # TRAIN
    # ---------------------------------------------------------
    def train(self):

        self.model.fit(
            self.X_train,
            self.y_train,
            epochs=100,
            batch_size=32,
            validation_split=0.2,
            callbacks=[
                EarlyStopping(patience=10, restore_best_weights=True),
                ReduceLROnPlateau(patience=5)
            ],
            verbose=1
        )

        self.model.save(self.model_dir / "lstm_model.keras")

    # ---------------------------------------------------------
    # EVALUATE
    # ---------------------------------------------------------
    def evaluate(self):

        preds = self.model.predict(self.X_test)

        # Inverse scaling
        dummy = np.zeros((len(preds), self.X_test.shape[2] + 1))
        dummy[:, -1] = preds.flatten()
        preds_inv = self.scaler.inverse_transform(dummy)[:, -1]

        dummy[:, -1] = self.y_test
        y_inv = self.scaler.inverse_transform(dummy)[:, -1]

        # Metrics
        rmse = np.sqrt(mean_squared_error(y_inv, preds_inv))
        mae = mean_absolute_error(y_inv, preds_inv)

        print(f"📊 RMSE: {rmse:.2f}")
        print(f"📊 MAE: {mae:.2f}")

        return rmse, mae
