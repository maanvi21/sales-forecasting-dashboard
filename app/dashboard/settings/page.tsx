'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [settings, setSettings] = useState({
    notifications: true,
    emailAlerts: true,
    automatedReorders: true,
    weeklyReports: true,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSettingChange = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your preferences and application settings.</p>
      </div>

      {/* Theme Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how the application looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium text-foreground block mb-4">Theme</label>
            {mounted && (
              <div className="flex gap-4">
                <button
                  onClick={() => setTheme('light')}
                  className={cn(
                    'flex items-center gap-3 px-6 py-4 rounded-lg border-2 transition-all',
                    theme === 'light'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <Sun className="w-5 h-5" />
                  <span className="font-medium">Light</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={cn(
                    'flex items-center gap-3 px-6 py-4 rounded-lg border-2 transition-all',
                    theme === 'dark'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <Moon className="w-5 h-5" />
                  <span className="font-medium">Dark</span>
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Control how you receive updates and alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-foreground block">In-App Notifications</label>
              <p className="text-xs text-muted-foreground mt-1">Receive notifications within the app</p>
            </div>
            <Switch
              checked={settings.notifications}
              onCheckedChange={() => handleSettingChange('notifications')}
            />
          </div>

          <div className="border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground block">Email Alerts</label>
                <p className="text-xs text-muted-foreground mt-1">Get alerts via email for critical events</p>
              </div>
              <Switch
                checked={settings.emailAlerts}
                onCheckedChange={() => handleSettingChange('emailAlerts')}
              />
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground block">Weekly Reports</label>
                <p className="text-xs text-muted-foreground mt-1">Receive weekly forecast performance reports</p>
              </div>
              <Switch
                checked={settings.weeklyReports}
                onCheckedChange={() => handleSettingChange('weeklyReports')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automation Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Automation</CardTitle>
          <CardDescription>Set up automated processes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-foreground block">Automated Reorders</label>
              <p className="text-xs text-muted-foreground mt-1">Automatically create purchase orders for low stock items</p>
            </div>
            <Switch
              checked={settings.automatedReorders}
              onCheckedChange={() => handleSettingChange('automatedReorders')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Data & Privacy</CardTitle>
          <CardDescription>Manage your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Data Retention</label>
            <select className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm">
              <option>Keep all data (default)</option>
              <option>1 year</option>
              <option>2 years</option>
              <option>5 years</option>
            </select>
          </div>

          <div className="border-t border-border pt-6">
            <Button variant="outline" className="w-full">
              Download My Data
            </Button>
          </div>

          <div className="border-t border-border pt-6">
            <Button variant="destructive" className="w-full">
              Delete All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>API Integration</CardTitle>
          <CardDescription>Manage API keys and integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value="••••••••••••••••••••••••"
                readOnly
                className="flex-1 px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
              />
              <Button variant="outline">Copy</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Use this key for API requests</p>
          </div>

          <div className="border-t border-border pt-6">
            <Button variant="outline" className="w-full">
              Regenerate Key
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Email</label>
            <input
              type="email"
              defaultValue="user@example.com"
              className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
            />
          </div>

          <div className="border-t border-border pt-6">
            <Button variant="outline" className="w-full">
              Change Password
            </Button>
          </div>

          <div className="border-t border-border pt-6">
            <Button variant="destructive" className="w-full">
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Changes */}
      <div className="flex gap-4 pt-6">
        <Button className="flex-1">Save Changes</Button>
        <Button variant="outline" className="flex-1">Cancel</Button>
      </div>
    </div>
  )
}
