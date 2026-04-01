'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, File, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const API = 'http://localhost:8000'

type UploadEntry = {
  filename: string
  rows:     number
  rmse:     number
  mae:      number
  status:   'processed' | 'processing'
}

export default function UploadPage() {
  const [isDragging, setIsDragging]   = useState(false)
  const [history, setHistory]         = useState<UploadEntry[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const res = await fetch(`${API}/uploads/history`)
      if (res.ok) {
        const data = await res.json()
        setHistory(data.uploads ?? [])
      }
    } catch {
      // server may not be up yet — silently ignore
    } finally {
      setIsLoadingHistory(false)
    }
  }

  useEffect(() => { fetchHistory() }, [])

  // ── Upload handler ─────────────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setUploadResult({ ok: false, msg: 'Only CSV files are supported.' })
      return
    }

    setIsUploading(true)
    setUploadResult(null)

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch(`${API}/upload-and-forecast`, { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setUploadResult({ ok: false, msg: data.detail ?? 'Upload failed.' })
        return
      }

      setUploadResult({
        ok:  true,
        msg: `Forecast complete — RMSE: ${data.metrics.rmse} · MAE: ${data.metrics.mae}`,
      })
      fetchHistory()
    } catch {
      setUploadResult({ ok: false, msg: 'Could not reach the server on port 8000.' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload Data</h1>
        <p className="text-muted-foreground mt-1">
          Import your sales CSV to train the LSTM model and generate forecasts.
        </p>
      </div>

      {/* ── Drop zone ─────────────────────────────────────────────────── */}
      <Card className="border-2 border-dashed border-border bg-card">
        <CardContent className="pt-8">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && inputRef.current?.click()}
            className={`flex flex-col items-center justify-center p-12 rounded-lg transition-colors cursor-pointer select-none ${
              isDragging ? 'bg-primary/10' : 'hover:bg-secondary/20'
            }`}
          >
            {isUploading ? (
              <Loader2 className="w-12 h-12 text-primary mb-4 animate-spin" />
            ) : (
              <Upload className="w-12 h-12 text-primary mb-4" />
            )}

            <h3 className="text-lg font-semibold text-foreground mb-2">
              {isUploading ? 'Training LSTM model…' : 'Drop your CSV file here'}
            </h3>
            <p className="text-muted-foreground text-center mb-6 text-sm">
              {isUploading
                ? 'This may take ~30–60 seconds depending on dataset size.'
                : 'or click anywhere to browse. Required columns: Order Date, Sales.'}
            </p>

            <Button disabled={isUploading} onClick={e => { e.stopPropagation(); inputRef.current?.click() }}>
              {isUploading ? 'Processing…' : 'Browse Files'}
            </Button>

            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
            />

            <p className="text-xs text-muted-foreground mt-5">
              Max 50 MB · CSV only
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Upload feedback ───────────────────────────────────────────── */}
      {uploadResult && (
        <Card className={uploadResult.ok ? 'border-green-500' : 'border-destructive'}>
          <CardContent className={`pt-6 flex items-start gap-2 text-sm ${
            uploadResult.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'
          }`}>
            {uploadResult.ok
              ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <AlertCircle  className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            {uploadResult.msg}
          </CardContent>
        </Card>
      )}

      {/* ── Upload history ────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Upload History</CardTitle>
            <CardDescription>Files processed this session</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHistory}
            disabled={isLoadingHistory}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>

        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No uploads yet — upload a CSV to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <File className="w-6 h-6 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{entry.filename}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entry.rows?.toLocaleString()} rows
                        {entry.rmse != null ? ` · RMSE ${entry.rmse} · MAE ${entry.mae}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {entry.status === 'processed' ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-green-600 dark:text-green-400">Processed</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-5 h-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
                        <span className="text-sm text-yellow-600 dark:text-yellow-400">Processing</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Upload guidelines ─────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Upload Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium text-foreground mb-1">Required columns</h4>
            <p className="text-muted-foreground">
              <code className="bg-secondary px-1 rounded">Order Date</code> (YYYY-MM-DD) and{' '}
              <code className="bg-secondary px-1 rounded">Sales</code> (numeric). The model
              aggregates order-level rows to daily totals automatically.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Data volume</h4>
            <p className="text-muted-foreground">
              At least 60 days of data recommended (30-day look-back + test window). More
              historical data typically improves LSTM accuracy.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Training time</h4>
            <p className="text-muted-foreground">
              The model trains for 50 epochs on upload. Expect ~30–90 seconds depending on
              dataset size and your hardware.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}