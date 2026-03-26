// Mock data for the demand forecasting dashboard

export const dashboardKPIs = {
  forecastAccuracy: 94.2,
  totalSKUs: 2847,
  avgLeadTime: 12.5,
  stockoutRisk: 3.2,
};

export const demandChartData = [
  { month: 'Jan', actual: 2400, forecast: 2210, upper: 2600, lower: 1900 },
  { month: 'Feb', actual: 1398, forecast: 1921, upper: 2400, lower: 1500 },
  { month: 'Mar', actual: 9800, forecast: 2290, upper: 2800, lower: 1700 },
  { month: 'Apr', actual: 3908, forecast: 2000, upper: 2600, lower: 1400 },
  { month: 'May', actual: 4800, forecast: 2181, upper: 2700, lower: 1600 },
  { month: 'Jun', actual: 3800, forecast: 2500, upper: 2900, lower: 1800 },
  { month: 'Jul', actual: 4300, forecast: 2100, upper: 2700, lower: 1500 },
  { month: 'Aug', actual: 2300, forecast: 2800, upper: 3200, lower: 2000 },
];

export const inventoryData = [
  {
    id: 'SKU-001',
    name: 'Widget A',
    category: 'Electronics',
    currentStock: 1250,
    safetyStock: 500,
    forecastDemand: 850,
    daysOfStock: 14.7,
    status: 'optimal',
  },
  {
    id: 'SKU-002',
    name: 'Widget B',
    category: 'Electronics',
    currentStock: 420,
    safetyStock: 300,
    forecastDemand: 600,
    daysOfStock: 7.0,
    status: 'warning',
  },
  {
    id: 'SKU-003',
    name: 'Gadget X',
    category: 'Hardware',
    currentStock: 2800,
    safetyStock: 800,
    forecastDemand: 1200,
    daysOfStock: 23.3,
    status: 'optimal',
  },
  {
    id: 'SKU-004',
    name: 'Device Pro',
    category: 'Hardware',
    currentStock: 180,
    safetyStock: 400,
    forecastDemand: 950,
    daysOfStock: 1.9,
    status: 'critical',
  },
  {
    id: 'SKU-005',
    name: 'Component Y',
    category: 'Parts',
    currentStock: 5600,
    safetyStock: 1000,
    forecastDemand: 2100,
    daysOfStock: 26.6,
    status: 'optimal',
  },
];

export const forecastModels = [
  { id: 'arima', name: 'ARIMA', accuracy: 92.1, mape: 7.9 },
  { id: 'ml-ensemble', name: 'ML Ensemble', accuracy: 94.2, mape: 5.8 },
  { id: 'prophet', name: 'Facebook Prophet', accuracy: 89.5, mape: 10.5 },
  { id: 'exponential', name: 'Exponential Smoothing', accuracy: 87.3, mape: 12.7 },
];

export const recentUploads = [
  { id: 1, filename: 'sales_q4_2024.csv', uploadedAt: '2024-12-15', records: 12450, status: 'processed' },
  { id: 2, filename: 'inventory_snapshot.csv', uploadedAt: '2024-12-14', records: 8730, status: 'processed' },
  { id: 3, filename: 'returns_november.csv', uploadedAt: '2024-12-10', records: 2340, status: 'processed' },
];

export const performanceMetrics = {
  currentAccuracy: 94.2,
  previousAccuracy: 92.1,
  mape: 5.8,
  rmse: 312.4,
  mae: 248.5,
};
