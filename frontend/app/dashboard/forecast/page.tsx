'use client'

import { useState, useEffect } from 'react'
import {
  Upload, Loader2, TrendingUp, AlertTriangle, CheckCircle2,
  BarChart3, Zap, Activity, Target
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
  AreaChart, Area, BarChart, Bar, Cell
} from 'recharts'

const API = 'http://localhost:8000'

// ── Updated type to match backend shape (FIX 7 — nested lstm/xgb metrics) ──
type ForecastData = {
  historical: { dates: string[]; sales: number[] }
  forecast:   { dates: string[]; lstm: number[]; xgb: number[]; blend: number[] }
  metrics: {
    lstm_rmse:    number
    lstm_mae:     number
    xgb_rmse:     number
    xgb_mae:      number
    horizon_days: number
  }
  message:        string
  filename:       string
  rows_processed: number
}

// ── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const colorMap: Record<string, string> = {
    actual: '#6366f1',
    blend:  '#f97316',
    lstm:   '#a78bfa',
    xgb:    '#34d399',
  }
  const labelMap: Record<string, string> = {
    actual: 'Actual',
    blend:  'Blended Forecast',
    lstm:   'LSTM',
    xgb:    'XGBoost',
  }
  return (
    <div style={{
      background: 'rgba(10,10,20,0.95)',
      border: '1px solid rgba(99,102,241,0.4)',
      borderRadius: 10,
      padding: '10px 16px',
      fontSize: 13,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
    }}>
      <p style={{ color: '#a5b4fc', fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: colorMap[entry.dataKey] ?? '#fff', margin: '2px 0' }}>
          ▸ {labelMap[entry.dataKey] ?? entry.dataKey}:{' '}
          <span style={{ fontWeight: 700 }}>
            ${Number(entry.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </p>
      ))}
    </div>
  )
}

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(10,10,20,0.95)',
      border: '1px solid rgba(249,115,22,0.4)',
      borderRadius: 10,
      padding: '10px 16px',
      fontSize: 13,
    }}>
      <p style={{ color: '#fed7aa', fontWeight: 600 }}>{label}</p>
      <p style={{ color: '#f97316' }}>
        ${Number(payload[0]?.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </p>
    </div>
  )
}

// ── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(20,20,40,0.9) 0%, rgba(30,30,60,0.8) 100%)',
      border: `1px solid ${accent ?? 'rgba(99,102,241,0.3)'}`,
      borderRadius: 14,
      padding: '20px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: `${accent ?? 'rgba(99,102,241,0.15)'}22`,
        filter: 'blur(20px)'
      }} />
      <p style={{ fontSize: 12, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function ForecastPage() {
  const [isUploading, setIsUploading]     = useState(false)
  const [isValidating, setIsValidating]   = useState(false)
  const [validationMsg, setValidationMsg] = useState<string | null>(null)
  const [validationOk, setValidationOk]   = useState<boolean | null>(null)
  const [forecastData, setForecastData]   = useState<ForecastData | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [activeTab, setActiveTab]         = useState<'combined' | 'forecast-only' | 'bar'>('combined')
  const [showModels, setShowModels]       = useState<'blend' | 'all'>('blend')

  useEffect(() => {
    fetch(`${API}/forecast/latest`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setForecastData(data) })
      .catch(() => {})
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setValidationOk(null); setValidationMsg(null); setError(null)
    setIsValidating(true)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res  = await fetch(`${API}/validate-csv`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setValidationOk(false); setValidationMsg(data.detail ?? 'Validation failed'); return }
      setValidationOk(true)
      setValidationMsg(`✓ ${data.rows.toLocaleString()} rows · ${data.columns?.length} columns`)
      await runForecast(file)
    } catch {
      setValidationOk(false)
      setValidationMsg('Server unreachable — is the backend running on port 8000?')
    } finally { setIsValidating(false); e.target.value = '' }
  }

  const runForecast = async (file: File) => {
    setIsUploading(true); setError(null)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res  = await fetch(`${API}/upload-and-forecast`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Forecast failed')
      setForecastData(data)
    } catch (err: any) {
      setError(err.message ?? 'Forecast generation failed')
    } finally { setIsUploading(false) }
  }

  // ── Build chart data ──────────────────────────────────────────────────────
  const combinedData = forecastData ? [
    ...forecastData.historical.dates.map((date, i) => ({
      date:   date.slice(5),
      actual: forecastData.historical.sales[i],
      blend:  null as number | null,
      lstm:   null as number | null,
      xgb:    null as number | null,
    })),
    ...forecastData.forecast.dates.map((date, i) => ({
      date:   date.slice(5),
      actual: null as number | null,
      blend:  forecastData.forecast.blend[i],
      lstm:   forecastData.forecast.lstm[i],
      xgb:    forecastData.forecast.xgb[i],
    })),
  ] : []

  const forecastBarData = forecastData?.forecast.dates.map((date, i) => ({
    date:  date.slice(5),
    sales: forecastData.forecast.blend[i],
  })) ?? []

  // Insights
  const totalForecast = forecastData?.forecast.blend.reduce((a, b) => a + b, 0) ?? 0
  const avgForecast   = forecastData ? totalForecast / forecastData.forecast.blend.length : 0
  const lastActual    = forecastData?.historical.sales.at(-1) ?? 0
  const trend         = avgForecast > lastActual * 1.1 ? 'up' : avgForecast < lastActual * 0.9 ? 'down' : 'stable'

  const isWorking = isValidating || isUploading

  // Safe metric accessors (guard against undefined on stale cached responses)
  const lstmRmse = forecastData?.metrics?.lstm_rmse ?? 0
  const lstmMae  = forecastData?.metrics?.lstm_mae  ?? 0
  const xgbRmse  = forecastData?.metrics?.xgb_rmse  ?? 0
  const xgbMae   = forecastData?.metrics?.xgb_mae   ?? 0

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a14 0%, #0f0f1e 50%, #0a0a14 100%)',
      color: '#f1f5f9',
      fontFamily: "'DM Sans', 'Inter', sans-serif",
      padding: '32px 24px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Activity size={20} color="white" />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Demand Forecasting
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: 15, marginLeft: 52 }}>
            Upload your Superstore CSV → LSTM + XGBoost ensemble trains & renders forecast inline
          </p>
        </div>

        {/* Upload Zone */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(20,20,40,0.9), rgba(30,30,60,0.7))',
          border: '2px dashed rgba(99,102,241,0.35)',
          borderRadius: 20,
          padding: '40px 32px',
          textAlign: 'center',
          marginBottom: 32,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'rgba(99,102,241,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            {isWorking
              ? <Loader2 size={28} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
              : <Upload size={28} color="#6366f1" />
            }
          </div>

          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {isValidating ? 'Validating CSV…' : isUploading ? 'Training LSTM + XGBoost…' : 'Upload Sales CSV'}
          </p>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Needs{' '}
            <code style={{ background: 'rgba(99,102,241,0.2)', padding: '1px 6px', borderRadius: 4 }}>Order Date</code>
            {' '}and{' '}
            <code style={{ background: 'rgba(99,102,241,0.2)', padding: '1px 6px', borderRadius: 4 }}>Sales</code>
            {' '}columns.
          </p>

          <label htmlFor="csv-upload" style={{ cursor: isWorking ? 'not-allowed' : 'pointer' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: isWorking ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white', padding: '12px 28px', borderRadius: 10,
              fontWeight: 600, fontSize: 15, cursor: isWorking ? 'not-allowed' : 'pointer',
              boxShadow: isWorking ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
            }}>
              {isWorking
                ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                : <Upload size={16} />
              }
              {isValidating ? 'Validating…' : isUploading ? 'Training Models…' : 'Choose CSV File'}
            </div>
            <input
              id="csv-upload" type="file" accept=".csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={isWorking}
            />
          </label>

          {validationMsg && (
            <p style={{
              marginTop: 16, fontSize: 13,
              color: validationOk ? '#4ade80' : '#f87171',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              {validationOk ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {validationMsg}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 24,
            display: 'flex', gap: 10, alignItems: 'flex-start'
          }}>
            <AlertTriangle size={16} color="#f87171" style={{ marginTop: 2 }} />
            <span style={{ color: '#fca5a5', fontSize: 14 }}>{error}</span>
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {forecastData && (
          <>
            {/* Stat Cards — 6 cards: LSTM RMSE/MAE, XGB RMSE/MAE, Total, Trend */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 32 }}>
              <StatCard
                label="LSTM RMSE"
                value={lstmRmse.toFixed(1)}
                sub="LSTM root mean sq. error"
                accent="rgba(167,139,250,0.5)"
              />
              <StatCard
                label="LSTM MAE"
                value={`$${lstmMae.toFixed(0)}`}
                sub="LSTM mean abs. error"
                accent="rgba(167,139,250,0.4)"
              />
              <StatCard
                label="XGB RMSE"
                value={xgbRmse.toFixed(1)}
                sub="XGBoost root mean sq. error"
                accent="rgba(52,211,153,0.5)"
              />
              <StatCard
                label="XGB MAE"
                value={`$${xgbMae.toFixed(0)}`}
                sub="XGBoost mean abs. error"
                accent="rgba(52,211,153,0.4)"
              />
              <StatCard
                label="Forecast Total"
                value={`$${(totalForecast / 1000).toFixed(1)}k`}
                sub={`Next ${forecastData.metrics.horizon_days} days (blended)`}
                accent="rgba(249,115,22,0.5)"
              />
              <StatCard
                label="Trend"
                value={trend === 'up' ? '↑ Up' : trend === 'down' ? '↓ Down' : '→ Stable'}
                sub="vs recent actuals"
                accent={trend === 'up' ? 'rgba(74,222,128,0.5)' : trend === 'down' ? 'rgba(248,113,113,0.5)' : 'rgba(148,163,184,0.5)'}
              />
            </div>

            {/* Chart Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(20,20,40,0.95), rgba(15,15,30,0.9))',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 20, overflow: 'hidden', marginBottom: 28
            }}>
              {/* Tab header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 24px 0', borderBottom: '1px solid rgba(99,102,241,0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TrendingUp size={18} color="#6366f1" />
                  <span style={{ fontWeight: 700, fontSize: 16 }}>
                    Sales Forecast — Historical + Next {forecastData.metrics.horizon_days} Days
                  </span>
                  {forecastData.filename && (
                    <span style={{
                      fontSize: 12, color: '#64748b',
                      background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 20
                    }}>
                      {forecastData.filename}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 4, paddingBottom: 12 }}>
                  {(['combined', 'forecast-only', 'bar'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: activeTab === tab ? 'rgba(99,102,241,0.3)' : 'transparent',
                      color: activeTab === tab ? '#a5b4fc' : '#64748b',
                    }}>
                      {tab === 'combined' ? 'Full View' : tab === 'forecast-only' ? 'Forecast Only' : 'Bar Chart'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '24px 8px 16px' }}>

                {/* Combined view */}
                {activeTab === 'combined' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 24, marginBottom: 8, gap: 6 }}>
                      {(['blend', 'all'] as const).map(m => (
                        <button key={m} onClick={() => setShowModels(m)} style={{
                          padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 11,
                          fontWeight: 600, cursor: 'pointer',
                          background: showModels === m ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.05)',
                          color: showModels === m ? '#fdba74' : '#64748b',
                        }}>
                          {m === 'blend' ? 'Blended only' : 'Show all models'}
                        </button>
                      ))}
                    </div>

                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={combinedData} margin={{ top: 10, right: 30, bottom: 60, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" />
                        <XAxis dataKey="date" angle={-40} textAnchor="end" height={70}
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          axisLine={{ stroke: 'rgba(99,102,241,0.2)' }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }}
                          axisLine={{ stroke: 'rgba(99,102,241,0.2)' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" height={36}
                          formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 13 }}>{v}</span>} />
                        <ReferenceLine
                          x={forecastData.historical.dates.at(-1)?.slice(5)}
                          stroke="rgba(248,113,113,0.5)" strokeDasharray="6 3"
                          label={{ value: 'Forecast Start', fill: '#f87171', fontSize: 11 }}
                        />
                        <Line type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2.5}
                          dot={false} name="Historical Sales" connectNulls={false}
                          activeDot={{ r: 5, fill: '#6366f1', stroke: '#1e1b4b', strokeWidth: 2 }} />
                        <Line type="monotone" dataKey="blend" stroke="#f97316" strokeWidth={2.5}
                          strokeDasharray="8 4" dot={{ r: 3, fill: '#f97316' }}
                          name="Blended Forecast" connectNulls={false}
                          activeDot={{ r: 5, fill: '#f97316', stroke: '#431407', strokeWidth: 2 }} />
                        {showModels === 'all' && <>
                          <Line type="monotone" dataKey="lstm" stroke="#a78bfa" strokeWidth={1.5}
                            strokeDasharray="4 4" dot={false} name="LSTM" connectNulls={false} />
                          <Line type="monotone" dataKey="xgb" stroke="#34d399" strokeWidth={1.5}
                            strokeDasharray="4 4" dot={false} name="XGBoost" connectNulls={false} />
                        </>}
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}

                {/* Forecast-only area chart */}
                {activeTab === 'forecast-only' && (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={forecastBarData} margin={{ top: 10, right: 30, bottom: 60, left: 10 }}>
                      <defs>
                        <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" />
                      <XAxis dataKey="date" angle={-40} textAnchor="end" height={70}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: 'rgba(249,115,22,0.2)' }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: 'rgba(249,115,22,0.2)' }} />
                      <Tooltip content={<BarTooltip />} />
                      <Area type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2.5}
                        fill="url(#forecastFill)" name="Blended Forecast"
                        dot={{ r: 4, fill: '#f97316', stroke: '#431407', strokeWidth: 2 }}
                        activeDot={{ r: 6 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                {/* Bar chart */}
                {activeTab === 'bar' && (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={forecastBarData} margin={{ top: 10, right: 30, bottom: 60, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" vertical={false} />
                      <XAxis dataKey="date" angle={-40} textAnchor="end" height={70}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: 'rgba(249,115,22,0.2)' }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: 'rgba(249,115,22,0.2)' }} />
                      <Tooltip content={<BarTooltip />} />
                      <Bar dataKey="sales" name="Blended Forecast" radius={[5, 5, 0, 0]}>
                        {forecastBarData.map((_, i) => (
                          <Cell key={i} fill={`rgba(249,115,22,${0.4 + (i / forecastBarData.length) * 0.6})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Insights Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(20,20,40,0.9), rgba(15,15,30,0.8))',
                border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 24
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <Zap size={16} color="#6366f1" />
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Key Insights</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    {
                      icon: <Target size={14} />,
                      text: `Total forecast: $${totalForecast.toLocaleString(undefined, { maximumFractionDigits: 0 })} over ${forecastData.metrics.horizon_days} days`,
                      color: '#a5b4fc'
                    },
                    {
                      icon: <TrendingUp size={14} />,
                      text: trend === 'up'
                        ? 'Strong upward trend vs recent actuals — consider scaling inventory.'
                        : trend === 'down'
                        ? 'Forecast shows slowdown — consider running promotions.'
                        : 'Forecast is relatively stable — maintain current strategy.',
                      color: trend === 'up' ? '#4ade80' : trend === 'down' ? '#f87171' : '#94a3b8'
                    },
                    {
                      icon: <BarChart3 size={14} />,
                      text: `LSTM — RMSE ${lstmRmse.toFixed(2)} · MAE $${lstmMae.toFixed(0)}   |   XGB — RMSE ${xgbRmse.toFixed(2)} · MAE $${xgbMae.toFixed(0)}`,
                      color: '#fdba74'
                    },
                    {
                      icon: <Activity size={14} />,
                      text: `Processed ${forecastData.rows_processed?.toLocaleString() ?? '—'} rows · 30-day look-back · LSTM + XGBoost ensemble`,
                      color: '#a5b4fc'
                    },
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 10, padding: '12px 14px',
                      background: 'rgba(99,102,241,0.07)', borderRadius: 10,
                      borderLeft: `3px solid ${item.color}`
                    }}>
                      <span style={{ color: item.color, marginTop: 1, flexShrink: 0 }}>{item.icon}</span>
                      <span style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, rgba(20,20,40,0.9), rgba(15,15,30,0.8))',
                border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 24
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <Activity size={16} color="#6366f1" />
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Model Summary</span>
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 20 }}>
                  Stacked LSTM + XGBoost ensemble (50/50 blend by default). LSTM captures
                  sequential patterns; XGBoost anchors stable feature relationships and prevents
                  autoregressive drift.
                </p>
                {/* Model legend */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  {[
                    { color: '#f97316', label: 'Blended (shown)' },
                    { color: '#a78bfa', label: 'LSTM only' },
                    { color: '#34d399', label: 'XGBoost only' },
                  ].map(m => (
                    <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
                      <div style={{ width: 28, height: 3, background: m.color, borderRadius: 2 }} />
                      {m.label}
                    </div>
                  ))}
                </div>

                {/* Per-model metric comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'LSTM', rmse: lstmRmse, mae: lstmMae, color: '#a78bfa' },
                    { label: 'XGBoost', rmse: xgbRmse, mae: xgbMae, color: '#34d399' },
                  ].map(m => (
                    <div key={m.label} style={{
                      background: 'rgba(99,102,241,0.07)', borderRadius: 10,
                      padding: '12px 14px', borderLeft: `3px solid ${m.color}`
                    }}>
                      <p style={{ fontWeight: 700, fontSize: 12, color: m.color, marginBottom: 8 }}>{m.label}</p>
                      <p style={{ fontSize: 12, color: '#94a3b8' }}>RMSE: <strong style={{ color: '#f1f5f9' }}>{m.rmse.toFixed(1)}</strong></p>
                      <p style={{ fontSize: 12, color: '#94a3b8' }}>MAE: <strong style={{ color: '#f1f5f9' }}>${m.mae.toFixed(0)}</strong></p>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Strengths', items: ['XGBoost prevents forecast collapse', 'LSTM captures weekly seasonality', 'Good for 14–21 day horizons'] },
                    { label: 'Limitations', items: ['Needs 60+ days of history', 'May miss sudden promotions', 'Blend weight is fixed at 50/50'] },
                  ].map(section => (
                    <div key={section.label} style={{ background: 'rgba(99,102,241,0.07)', borderRadius: 10, padding: '14px 16px' }}>
                      <p style={{ fontWeight: 700, fontSize: 12, color: '#a5b4fc', marginBottom: 10, letterSpacing: '0.05em' }}>
                        {section.label.toUpperCase()}
                      </p>
                      {section.items.map((item, i) => (
                        <p key={i} style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>· {item}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!forecastData && !isWorking && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
            <Activity size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p style={{ fontSize: 16, fontWeight: 600 }}>Upload a CSV to see forecast charts here</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>LSTM + XGBoost ensemble · all charts render inline</p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}