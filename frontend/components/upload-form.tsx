'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UploadResponse {
  status: string;
  rows?: number;
  columns?: string[];
  date_range?: string;
  sales_stats?: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  message?: string;
  error?: string;
}

interface ForecastResponse {
  rmse: number;
  mae: number;
  mape?: number;
  r2?: number;
  rows: number;
  filename: string;
  status: string;
}

export default function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [forecasting, setForecasting] = useState(false);
  const [validation, setValidation] = useState<UploadResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [epochs, setEpochs] = useState(300);
  const [step, setStep] = useState<'upload' | 'validate' | 'forecast'>('upload');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setStep('validate');
    }
  };

  const handleValidate = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      setValidating(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/validate-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Validation failed');
      }

      const data: UploadResponse = await response.json();
      setValidation(data);
      setStep('forecast');

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation error';
      setError(message);
      setStep('upload');
    } finally {
      setValidating(false);
    }
  };

  const handleForecast = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      setForecasting(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `http://localhost:8000/upload-and-forecast?epochs=${epochs}`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Forecast failed');
      }

      const data: ForecastResponse = await response.json();
      setForecast(data);

      // Redirect to forecast page after success
      setTimeout(() => {
        router.push('/dashboard/forecast');
      }, 2000);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Forecast error';
      setError(message);
    } finally {
      setForecasting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>📤 Upload Sales Data</CardTitle>
            <CardDescription>
              Upload a CSV file with Order Date and Sales columns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <div className="text-4xl mb-2">📁</div>
                <p className="font-semibold text-gray-700">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </p>
                <p className="text-sm text-gray-500 mt-1">CSV files only</p>
              </label>
            </div>

            {file && (
              <div className="flex gap-2">
                <Button onClick={() => setFile(null)} variant="outline">
                  Change File
                </Button>
                <Button 
                  onClick={handleValidate} 
                  disabled={validating}
                  className="flex-1"
                >
                  {validating ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </div>
            )}

            {error && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">{error}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Validation Results */}
      {step === 'forecast' && validation && (
        <Card>
          <CardHeader>
            <CardTitle>✅ Data Validation Passed</CardTitle>
            <CardDescription>File is ready for forecasting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Rows</p>
                <p className="text-2xl font-bold">{validation.rows}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Columns</p>
                <p className="text-2xl font-bold">{validation.columns?.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date Range</p>
                <p className="text-sm font-semibold">{validation.date_range}</p>
              </div>
              {validation.sales_stats && (
                <div>
                  <p className="text-sm text-gray-600">Avg Sales</p>
                  <p className="text-sm font-semibold">
                    ${validation.sales_stats.mean.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {validation.sales_stats && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                💡 Sales range: ${validation.sales_stats.min.toFixed(2)} - ${validation.sales_stats.max.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Forecast Configuration */}
      {step === 'forecast' && validation && (
        <Card>
          <CardHeader>
            <CardTitle>⚙️ Configure Forecast</CardTitle>
            <CardDescription>Adjust training parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Training Epochs: <span className="text-blue-600 font-bold">{epochs}</span>
              </label>
              <input
                type="range"
                min="50"
                max="500"
                step="10"
                value={epochs}
                onChange={(e) => setEpochs(parseInt(e.target.value))}
                className="w-full mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                More epochs = longer training but potentially better accuracy
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => setStep('upload')} 
                variant="outline"
              >
                Back
              </Button>
              <Button 
                onClick={handleForecast} 
                disabled={forecasting}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {forecasting ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Training Model... (This may take 2-5 minutes)
                  </>
                ) : (
                  '🚀 Start Forecast'
                )}
              </Button>
            </div>

            {error && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">{error}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {forecast && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              Forecast Complete!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>RMSE:</strong> ${forecast.rmse.toFixed(2)}</p>
            <p><strong>MAE:</strong> ${forecast.mae.toFixed(2)}</p>
            {forecast.mape && <p><strong>MAPE:</strong> {forecast.mape.toFixed(2)}%</p>}
            <p className="text-gray-600 mt-3">Redirecting to forecast results...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}