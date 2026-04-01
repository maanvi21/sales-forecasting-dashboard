'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { inventoryData } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export default function InventoryPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const filteredInventory = useMemo(() => {
    if (filterStatus === 'all') return inventoryData
    return inventoryData.filter(item => item.status === filterStatus)
  }, [filterStatus])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'optimal':
        return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'optimal':
        return 'bg-green-500/10'
      case 'warning':
        return 'bg-yellow-500/10'
      case 'critical':
        return 'bg-red-500/10'
      default:
        return 'bg-gray-500/10'
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Inventory Insights</h1>
        <p className="text-muted-foreground mt-1">Monitor inventory levels and get AI-powered recommendations.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Items at Optimal Level</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                {inventoryData.filter(i => i.status === 'optimal').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Warning Level Items</p>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                {inventoryData.filter(i => i.status === 'warning').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Critical Items</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
                {inventoryData.filter(i => i.status === 'critical').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('all')}
          className="text-sm"
        >
          All Items ({inventoryData.length})
        </Button>
        <Button
          variant={filterStatus === 'optimal' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('optimal')}
          className="text-sm"
        >
          Optimal
        </Button>
        <Button
          variant={filterStatus === 'warning' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('warning')}
          className="text-sm"
        >
          Warning
        </Button>
        <Button
          variant={filterStatus === 'critical' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('critical')}
          className="text-sm"
        >
          Critical
        </Button>
      </div>

      {/* Inventory Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredInventory.map((item) => (
              <div key={item.id}>
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className={cn(
                    'w-full px-4 py-4 rounded-lg border border-border transition-all flex items-center justify-between hover:bg-secondary/50',
                    getStatusColor(item.status)
                  )}
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div className="flex-shrink-0">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                          {item.id}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.category}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-foreground">{item.currentStock.toLocaleString()} units</p>
                      <p className="text-xs text-muted-foreground">{item.daysOfStock.toFixed(1)}d stock</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-5 h-5 text-muted-foreground transition-transform ml-4',
                      expandedId === item.id && 'rotate-180'
                    )}
                  />
                </button>

                {/* Expanded Details */}
                {expandedId === item.id && (
                  <div className="px-4 py-4 bg-secondary/30 rounded-b-lg border border-t-0 border-border space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Current Stock</p>
                        <p className="text-lg font-bold text-foreground mt-1">{item.currentStock.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Safety Stock</p>
                        <p className="text-lg font-bold text-foreground mt-1">{item.safetyStock.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Forecast Demand</p>
                        <p className="text-lg font-bold text-foreground mt-1">{item.forecastDemand.toLocaleString()}/mo</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Days of Stock</p>
                        <p className="text-lg font-bold text-foreground mt-1">{item.daysOfStock.toFixed(1)}</p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-border">
                      <div className="w-full bg-secondary rounded-full h-2 mb-2">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all',
                            item.currentStock >= item.safetyStock * 2
                              ? 'bg-green-500'
                              : item.currentStock >= item.safetyStock
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          )}
                          style={{
                            width: `${Math.min((item.currentStock / (item.safetyStock * 3)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0</span>
                        <span>Safety: {item.safetyStock.toLocaleString()}</span>
                        <span>Optimal: {(item.safetyStock * 2).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <Card className="bg-card border-border border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>AI Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">SKU-004 (Device Pro) - Order immediately</p>
              <p className="text-sm text-muted-foreground mt-1">
                Current stock of 180 units is critically low with 950 units monthly demand. Expected stockout in 1.9 days.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">SKU-002 (Widget B) - Review stock levels</p>
              <p className="text-sm text-muted-foreground mt-1">
                Stock of 420 units is below optimal levels. Consider increasing safety stock or adjusting forecast.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
