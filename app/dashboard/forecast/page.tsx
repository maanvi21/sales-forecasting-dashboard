'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { forecastModels, demandChartData, performanceMetrics } from '@/lib/mock-data'

export default function ForecastPage() {
  const [selectedModel, setSelectedModel] = useState('ml-ensemble')

  const modelAccuracyData = useMemo(() => 
    forecastModels.map(m => ({
      name: m.name,
      accuracy: m.accuracy,
      mape: m.mape,
    }))
  , [])

  const selectedModelData = useMemo(() => 
    forecastModels.find(m => m.id === selectedModel)
  , [selectedModel])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Forecast Models</h1>
        <p className="text-muted-foreground mt-1">Compare and select the best forecasting model for your data.</p>
      </div>

      {/* Model Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {forecastModels.map((model) => (
          <Card
            key={model.id}
            className={`bg-card border cursor-pointer transition-all ${
              selectedModel === model.id
                ? 'border-primary ring-2 ring-primary'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => setSelectedModel(model.id)}
          >
            <CardContent className="pt-6">
              <h3 className="font-semibold text-foreground mb-3">{model.name}</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Accuracy</p>
                  <p className="text-2xl font-bold text-primary">{model.accuracy}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">MAPE</p>
                  <p className="text-lg font-bold text-foreground">{model.mape}%</p>
                </div>
              </div>
              {selectedModel === model.id && (
                <Button className="w-full mt-4" disabled>
                  Currently Active
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Model Comparison */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Model Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="accuracy" className="w-full">
            <TabsList>
              <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
              <TabsTrigger value="error">Error Rate (MAPE)</TabsTrigger>
            </TabsList>

            <TabsContent value="accuracy" className="mt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={modelAccuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" />
                  <YAxis stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: `1px solid var(--color-border)`,
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                  />
                  <Bar dataKey="accuracy" fill="var(--color-chart-1)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="error" className="mt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={modelAccuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" />
                  <YAxis stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: `1px solid var(--color-border)`,
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                  />
                  <Bar dataKey="mape" fill="var(--color-chart-5)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Active Model Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Active Model Performance</CardTitle>
            <CardDescription>Current metrics for {selectedModelData?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-muted-foreground">Current Accuracy</span>
                <span className="font-bold text-foreground">{performanceMetrics.currentAccuracy}%</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-muted-foreground">Previous Accuracy</span>
                <span className="font-bold text-foreground">{performanceMetrics.previousAccuracy}%</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-muted-foreground">MAPE</span>
                <span className="font-bold text-foreground">{performanceMetrics.mape}%</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-muted-foreground">RMSE</span>
                <span className="font-bold text-foreground">{performanceMetrics.rmse.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">MAE</span>
                <span className="font-bold text-foreground">{performanceMetrics.mae.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Forecast Visualization */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Forecast Results</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={demandChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" />
                  <YAxis stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: `1px solid var(--color-border)`,
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    dot={false}
                    name="Actual"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                    name="Forecast"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Model Configuration</CardTitle>
          <CardDescription>Adjust the settings for the active forecasting model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Forecast Horizon (days)
              </label>
              <input
                type="number"
                defaultValue={90}
                className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Confidence Interval
              </label>
              <select className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground">
                <option>95%</option>
                <option>90%</option>
                <option>85%</option>
              </select>
            </div>
            <Button className="w-full">Update Configuration</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
