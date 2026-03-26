'use client'

import { useState } from 'react'
import { Upload, File, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { recentUploads } from '@/lib/mock-data'

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<string[]>([])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    // In a real app, process files here
    const droppedFiles = Array.from(e.dataTransfer.files).map(f => f.name)
    setFiles(prev => [...prev, ...droppedFiles])
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload Data</h1>
        <p className="text-muted-foreground mt-1">Import your sales, inventory, and returns data via CSV files.</p>
      </div>

      {/* Upload Zone */}
      <Card className="bg-card border-border border-2 border-dashed">
        <CardContent className="pt-8">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center p-12 rounded-lg transition-colors ${
              isDragging ? 'bg-primary/10' : 'bg-transparent'
            }`}
          >
            <Upload className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Drop your CSV files here</h3>
            <p className="text-muted-foreground text-center mb-6">
              or click the button below to browse. We support sales, inventory, and returns data.
            </p>
            <Button className="mb-4">
              Browse Files
            </Button>
            <p className="text-xs text-muted-foreground">
              Maximum file size: 50MB. Supported formats: CSV, Excel
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recently Uploaded */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Recently Uploaded Files</CardTitle>
          <CardDescription>Your recent data uploads and their processing status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentUploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border"
              >
                <div className="flex items-center gap-4 flex-1">
                  <File className="w-6 h-6 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{upload.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      {upload.records.toLocaleString()} records • {upload.uploadedAt}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {upload.status === 'processed' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-600 dark:text-green-400">Processed</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-sm text-yellow-600 dark:text-yellow-400">Processing</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload Guidelines */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Upload Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-2">Sales Data</h4>
              <p className="text-sm text-muted-foreground">
                Required columns: Date, Product_ID, Quantity, Price. Ensure dates are in YYYY-MM-DD format.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Inventory Data</h4>
              <p className="text-sm text-muted-foreground">
                Required columns: SKU, Current_Stock, Safety_Stock, Reorder_Point. Include product category for better insights.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Returns Data</h4>
              <p className="text-sm text-muted-foreground">
                Required columns: Date, Product_ID, Quantity, Reason. This helps improve demand accuracy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
