'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Upload, TrendingUp, Package, Settings, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { label: 'Upload Data', href: '/dashboard/upload', icon: Upload },
  { label: 'Forecast', href: '/dashboard/forecast', icon: TrendingUp },
  { label: 'Inventory', href: '/dashboard/inventory', icon: Package },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={cn(
          'hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border transition-all duration-300',
          'h-screen fixed left-0 top-0'
        )}
      >
        <div className="p-6 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">Forecast</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/60">
            © 2024 Forecast SaaS
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          'md:hidden fixed inset-0 z-50 bg-black/50 transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => onOpenChange(false)}
      />

      <div
        className={cn(
          'md:hidden fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border z-50 transition-transform duration-300 flex flex-col',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">Forecast</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-sidebar-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/60">
            © 2024 Forecast SaaS
          </div>
        </div>
      </div>
    </>
  )
}
