'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronDown, AlertTriangle, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast, Toaster } from 'sonner'
import { cn } from '@/lib/utils'

interface InventoryItem {
  id: string
  name: string
  category: string
  currentStock: number
  safetyStock: number
  forecastDemand: number
  daysOfStock: number
  status: string
}

export default function InventoryPage() {
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    async function loadInventory() {
      try {
        const res = await fetch('http://127.0.0.1:8000/inventory-forecast')
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.detail || 'Failed to fetch inventory from server.')
        }
        const data: InventoryItem[] = await res.json()
        setInventoryData(data)
        
        // --- PREDICTIVE ALERTS NOTIFICATION ---
        const criticalCount = data.filter(i => i.status === 'critical').length
        const warningCount = data.filter(i => i.status === 'warning').length
        if (criticalCount > 0) {
          toast.error(`⚠️ Restock Alert: ${criticalCount} items are at CRITICAL stock levels!`, {
            description: "Safety Stock thresholds have been breached. Action required.",
            duration: 8000
          })
        } else if (warningCount > 0) {
          toast.warning(`Inventory Warning: ${warningCount} items are approaching low stock.`, {
            duration: 5000
          })
        } else {
          toast.success("✅ Inventory Healthy: All predictive stock levels are optimal.")
        }
        
      } catch (e: any) {
        setError(e.message)
      } finally {
        setIsLoading(false)
      }
    }
    loadInventory()
  }, [])

  const filteredInventory = useMemo(() => {
    if (filterStatus === 'all') return inventoryData
    return inventoryData.filter(item => item.status === filterStatus)
  }, [filterStatus, inventoryData])

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-sm">Processing Top 50 Inventory Predictors...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Error Loading Forecast</h2>
        <p className="text-muted-foreground">{error}</p>
        <p className="text-xs text-muted-foreground mt-4">Make sure you have uploaded a dataset via the main dashboard.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 relative">
      <Toaster position="top-right" richColors />
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Insights</h1>
          <p className="text-muted-foreground mt-1">Monitor product inventory levels and get AI-powered warnings based on historical lead times.</p>
        </div>
        
        <Button 
          variant="destructive" 
          onClick={() => {
            const crit = inventoryData.filter(i => i.status === 'critical')
            if (crit.length === 0) return toast.info("No critical items to reorder.")
            toast.success(`Drafted bulk reorder for ${crit.length} critical products!`, {
              description: "Sent notification to vendor queues."
            })
          }}
        >
          Automate Critical Restocks
        </Button>
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
          Top Items ({inventoryData.length})
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
          <CardTitle>Forecasted Restock Triggers (Top 50 Sub-Category Products)</CardTitle>
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
                        <p className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs">{item.name}</p>
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary whitespace-nowrap">
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
                        <p className="text-xs text-muted-foreground font-medium">Estimated Current Stock</p>
                        <p className="text-lg font-bold text-foreground mt-1">{item.currentStock.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Safety Minimum Stock (Based on Lead Time)</p>
                        <p className="text-lg font-bold text-foreground mt-1">{item.safetyStock.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Expected Demand</p>
                        <p className="text-lg font-bold text-foreground mt-1">{item.forecastDemand.toLocaleString()}/mo</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Est. Days of Stock</p>
                        <p className="text-lg font-bold text-foreground mt-1">{item.daysOfStock.toFixed(1)}</p>
                      </div>
                    </div>
                    
                    <div className="pt-3 pb-1 flex justify-between items-center border-t border-border">
                       <div className="flex-1 mr-4">
                         <div className="w-full bg-secondary rounded-full h-2 relative">
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
                        <span>Safety Trigger: {item.safetyStock.toLocaleString()}</span>
                        <span>Optimal Target: {(item.safetyStock * 2).toLocaleString()}</span>
                      </div>
                    </div>
                     <Button 
                       size="sm" 
                       variant={item.status === 'critical' ? 'destructive' : 'secondary'}
                       onClick={(e) => {
                         e.stopPropagation()
                         toast.success(`Notification sent for ${item.name}`, {
                           description: `Requested restock of ${item.forecastDemand} units.`
                         })
                       }}
                     >
                       <AlertCircle className="w-4 h-4 mr-2" />
                       Notify Vendor
                     </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredInventory.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">No inventory items matched your filter.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <Card className="bg-card border-border border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>AI Restock Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredInventory.filter(i => i.status !== 'optimal').slice(0, 4).map(item => (
            <div key={item.id} className="flex gap-3 items-start border-b border-border/40 pb-3 last:border-0 last:pb-0">
              {item.status === 'critical' ? (
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="text-sm font-semibold text-muted-foreground mb-1">{item.status === 'critical' ? '🔴 Priority Restock Order Required' : '🟡 Review Stock Depletion'}</p>
                <p className="text-sm text-muted-foreground">
                  {item.status === 'critical' 
                    ? `Simulated stock is critically low (${item.currentStock} units) given ${item.forecastDemand.toFixed(0)} units expected monthly demand over lead time. Stockout estimated in ${Math.max(0, item.daysOfStock).toFixed(1)} days.`
                    : `Stock of ${item.currentStock} units is approaching the safety threshold of ${item.safetyStock}. Start preparing order logistics.`}
                </p>
              </div>
            </div>
          ))}
          {filteredInventory.filter(i => i.status !== 'optimal').length === 0 && (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-green-500 w-5 h-5" />
              <p className="text-sm text-muted-foreground">All top 50 items are well-stocked. No warnings generated.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
