'use client'

import { Menu, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="hidden md:flex items-center justify-between h-16 px-6 bg-card border-b border-border ml-64">
      <div className="flex-1" />
      
      {mounted && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-foreground"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </Button>
      )}
    </header>
  )
}

export function MobileHeader({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="md:hidden flex items-center justify-between h-14 px-4 bg-card border-b border-border">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="text-foreground"
      >
        <Menu className="w-5 h-5" />
      </Button>

      <div className="text-lg font-bold text-foreground">Dashboard</div>

      {mounted && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-foreground"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </Button>
      )}
    </header>
  )
}
