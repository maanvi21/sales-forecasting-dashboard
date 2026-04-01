'use client'

import { useMemo } from 'react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KPICard } from '@/components/kpi-card'
import { TrendingUp, Percent, Clock, AlertCircle } from 'lucide-react'
import { dashboardKPIs, demandChartData } from '@/lib/mock-data'

export default function DashboardPage() {
  const kpis = useMemo(() => [
    {
      label: 'Forecast Accuracy',
      value: `${dashboardKPIs.forecastAccuracy}%`,
      icon: Percent,
      trend: { value: 2.1, isPositive: true },
    },
    {
      label: 'Total SKUs',
      value: dashboardKPIs.totalSKUs.toLocaleString(),
      icon: TrendingUp,
      trend: { value: 5.3, isPositive: true },
    },
    {
      label: 'Avg Lead Time',
      value: dashboardKPIs.avgLeadTime,
      unit: 'days',
      icon: Clock,
      trend: { value: 0.8, isPositive: false },
    },
    {
      label: 'Stockout Risk',
      value: dashboardKPIs.stockoutRisk,
      unit: '%',
      icon: AlertCircle,
      trend: { value: 1.2, isPositive: false },
    },
  ], [])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here&apos;s your forecast performance overview.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard
            key={index}
            label={kpi.label}
            value={kpi.value}
            unit={kpi.unit}
            icon={kpi.icon}
            trend={kpi.trend}
          />
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Demand Chart */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Demand Forecast vs Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={demandChartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="var(--color-chart-1)"
                    fillOpacity={1}
                    fill="url(#colorActual)"
                    name="Actual Demand"
                  />
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    stroke="var(--color-chart-2)"
                    fillOpacity={1}
                    fill="url(#colorForecast)"
                    name="Forecast"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Confidence Intervals */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-border h-full">
            <CardHeader>
              <CardTitle className="text-base">Confidence Intervals</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={demandChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} />
                  <YAxis stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: `1px solid var(--color-border)`,
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="upper"
                    stroke="var(--color-chart-4)"
                    strokeWidth={1}
                    dot={false}
                    name="Upper"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                    dot={false}
                    name="Forecast"
                  />
                  <Line
                    type="monotone"
                    dataKey="lower"
                    stroke="var(--color-chart-5)"
                    strokeWidth={1}
                    dot={false}
                    name="Lower"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Model MAPE</p>
              <p className="text-xl font-bold text-foreground mt-1">5.8%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Avg Lead Time</p>
              <p className="text-xl font-bold text-foreground mt-1">12.5d</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Items at Risk</p>
              <p className="text-xl font-bold text-foreground mt-1">47</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Last Updated</p>
              <p className="text-xl font-bold text-foreground mt-1">2 min ago</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
