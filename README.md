# SaaS Sales Forecasting Dashboard

A full-stack web application for demand forecasting using advanced machine learning models. This platform integrates an LSTM neural network with a modern, responsive UI to provide accurate sales predictions and performance analytics.

## 🎯 Overview

This SaaS dashboard enables businesses to forecast sales with high accuracy using deep learning techniques. Upload your historical sales data, and the system will train models and provide actionable insights through an interactive interface.

**Key Features:**
- LSTM-based time series forecasting
- Real-time model training and evaluation
- CSV data upload and validation
- Interactive performance metrics dashboard
- Model accuracy tracking (RMSE & MAE)
- Docker containerization for easy deployment
- RESTful API for programmatic access

## 📊 Model Accuracy

The LSTM forecasting model achieves strong performance metrics:

| Metric | Value | Description |
|--------|-------|-------------|
| **RMSE** | ~$50-100 | Root Mean Squared Error (lower is better) |
| **MAE** | ~$40-80 | Mean Absolute Error (average prediction deviation) |
| **Model Type** | LSTM RNN | 2-layer bidirectional LSTM with dropout |
| **Training Epochs** | Up to 100 | With early stopping to prevent overfitting |
| **Validation Split** | 80/20 | 80% training, 20% testing data |

The model incorporates:
- **30-step temporal window** for capturing time dependencies
- **Advanced feature engineering**: lag features (1, 7, 14 days), rolling statistics, trend, and seasonality
- **Data scaling** with MinMaxScaler for normalized input
- **Categorical encoding** for order attributes (ship mode, segment, region, category, etc.)
- **Dropout regularization (0.2)** to prevent overfitting
- **Early stopping** with patience=10 to halt training when validation loss plateaus
- **Learning rate reduction** for adaptive optimization

## 🏗️ Architecture

### Backend (Python/FastAPI)
```
backend/
├── main.py                    # FastAPI application & API endpoints
├── lstm_forecaster.py         # LSTM model training & evaluation
├── requirements.txt           # Python dependencies
├── dockerfile                 # Docker image configuration
└── models/                    # Trained model artifacts
    ├── lstm_model.keras       # Trained LSTM neural network
    ├── scaler.joblib          # MinMaxScaler for data normalization
    ├── label_encoders.joblib  # Categorical encoders
    ├── prophet_model.joblib   # Prophet forecasting model (backup)
    ├── xgb_model.joblib       # XGBoost model (backup)
    └── latest_forecast.joblib # Last forecast results cache
```

**Key Technologies:**
- **FastAPI**: Async REST API framework
- **TensorFlow/Keras**: Deep learning framework for LSTM
- **Pandas & NumPy**: Data manipulation and processing
- **Scikit-learn**: Feature scaling and encoding
- **XGBoost & Prophet**: Alternative forecasting models

### Frontend (React/Next.js)
```
frontend/
├── app/                       # Next.js App Router
├── components/                # Reusable React components
├── hooks/                     # Custom React hooks
├── lib/                       # Utility functions
├── styles/                    # Tailwind CSS styles
├── package.json               # Dependencies & scripts
├── next.config.mjs            # Next.js configuration
└── tsconfig.json              # TypeScript settings
```

**Key Technologies:**
- **Next.js 16.2**: React framework with server-side rendering
- **React 19.2**: UI library with latest hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Recharts**: Data visualization library
- **Radix UI**: Accessible component primitives
- **React Hook Form**: Form state management
- **Zod**: Schema validation

## 🚀 Setup & Installation

### Prerequisites
- Docker & Docker Compose (recommended)
- Node.js 18+ (for local frontend development)
- Python 3.9+ (for local backend development)

### Quick Start with Docker

1. **Clone the repository:**
   ```bash
   git clone https://github.com/maanvi21/sales-forecasting-dashboard.git
   cd sales-forecasting-dashboard

   ```

2. **Start services with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Local Development

#### Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run FastAPI server
uvicorn main:app --port 8000 --reload
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Open http://localhost:3000 in your browser.

## 📡 API Endpoints

### 1. Validate CSV
**POST** `/validate-csv`

Upload and validate your CSV file before forecasting.

**Request:**
```bash
curl -X POST "http://localhost:8000/validate-csv" \
  -F "file=@sales_data.csv"
```

**Response:**
```json
{
  "rows": 1500,
  "columns": ["Order Date", "Sales", "Quantity", ...],
  "date_range": "2020-01-01 → 2023-12-31",
  "message": "CSV validated successfully"
}
```

### 2. Upload & Forecast
**POST** `/upload-and-forecast`

Train the model and generate forecast.

**Request:**
```bash
curl -X POST "http://localhost:8000/upload-and-forecast" \
  -F "file=@sales_data.csv" \
  -F "epochs=100"
```

**Response:**
```json
{
  "rmse": 62.43,
  "mae": 48.72,
  "rows": 1500,
  "filename": "sales_data.csv"
}
```

### 3. Retrain Model
**POST** `/retrain`

Retrain the model with new data.

**Request:**
```bash
curl -X POST "http://localhost:8000/retrain" \
  -F "file=@updated_sales_data.csv" \
  -F "epochs=150"
```

### 4. Get Latest Forecast
**GET** `/forecast/latest`

Retrieve the most recent forecast results.

**Response:**
```json
{
  "rmse": 62.43,
  "mae": 48.72,
  "rows": 1500,
  "filename": "sales_data.csv"
}
```

### 5. Health Check
**GET** `/health`

Check API status.

**Response:**
```json
{
  "status": "running"
}
```

## 📋 Data Requirements

Your CSV file must contain these columns:

| Column | Type | Description |
|--------|------|-------------|
| Order Date | Date (YYYY-MM-DD format) | Transaction date |
| Sales | Float | Revenue amount |

Optional but recommended columns:
- Quantity, Discount, Profit, Shipping Cost
- Ship Mode, Segment, Region, Category, Sub-Category
- City, State, Country, Market
- Order Priority

**Example CSV Structure:**
```
Order Date,Sales,Quantity,Discount,Profit,Ship Mode,Segment,Region
2020-01-01,100.50,2,0.1,20.10,Standard,Consumer,South
2020-01-02,250.75,1,0,50.15,Express,Corporate,East
2020-01-03,125.00,3,0.2,25.00,Same Day,Home Office,West
```

## 🎨 Feature Highlights

### Real-time Model Training
- Upload historical data and train models in seconds
- Automatic feature engineering with 30+ engineered features
- Early stopping prevents overfitting
- Live training progress monitoring

### Performance Analytics
- RMSE and MAE metrics for model evaluation
- Data quality validation before training
- Date range analysis and row count tracking
- Cached forecast results for quick access

### Interactive Dashboard
- Clean, modern UI built with React and Tailwind CSS
- Responsive design works on desktop and mobile
- Real-time data visualization with charts
- File upload and drag-drop interface

### Production-Ready
- Docker containers for reproducible deployments
- CORS enabled for cross-origin requests
- Error handling and validation
- Health check endpoints

## 🔧 Feature Engineering Details

The LSTM model uses advanced feature engineering:

```python
# Temporal features
- Lag features: lag_1, lag_7, lag_14 (previous sales values)
- Rolling statistics: rolling_mean_7, rolling_std_7
- Trend: linear trend component
- Seasonality: sin/cos encoded day-of-week patterns
- Date components: Year, Month, Day, Week of Year

# Categorical encoding
- Label encoding for: Ship Mode, Segment, Category, Region, etc.

# Normalization
- MinMaxScaler (0-1 range) for stable neural network training
```

## 📈 Performance Optimization

The model achieves high accuracy through:

1. **Architecture**: 2-layer LSTM with 128→64 units, providing sufficient model capacity
2. **Regularization**: Dropout (0.2) reduces overfitting
3. **Learning**: Adam optimizer with 0.001 learning rate
4. **Loss Function**: Huber loss for robustness to outliers
5. **Training Strategy**: 
   - 100 epoch limit with early stopping
   - 20% validation split for monitoring
   - Learning rate reduction on plateau

Expected performance:
- **RMSE: $50-100** on typical retail sales data
- **MAE: $40-80** average deviation
- **Training time: 2-5 minutes** with standard datasets

## 🐳 Docker Support

The repository includes Docker configurations for both frontend and backend:

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - PYTHONUNBUFFERED=1

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
```

## 📝 Development Notes

- Backend uses async operations for non-blocking I/O
- Frontend uses Next.js App Router for modern React patterns
- All ML models are persisted in `backend/models/`
- Latest forecast cached for quick retrieval
- CORS middleware allows development flexibility

## 🤝 Contributing

Feel free to fork, improve, and submit pull requests. Areas for enhancement:
- Additional forecasting models (ARIMA, Transformer)
- Advanced visualization features
- Ensemble model predictions
- API authentication and rate limiting
- Real-time streaming data support

## 📄 License

This project is open source. Check the LICENSE file for details.

## 💡 Troubleshooting

**Model not training?**
- Check CSV has "Order Date" and "Sales" columns
- Ensure data is properly formatted (dates in YYYY-MM-DD)
- Check backend logs: `docker-compose logs backend`

**Frontend not connecting to API?**
- Verify backend is running on port 8000
- Check CORS settings in main.py
- Check browser console for network errors

**Out of memory?**
- Reduce batch size in lstm_forecaster.py
- Use smaller CSV files for testing
- Increase Docker memory allocation

---

**Built with ❤️ for modern SaaS applications**
