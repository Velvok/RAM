'use client'

import { useState } from 'react'
import { Toaster } from 'sonner'
import { AdminSidebar } from '@/components/admin-sidebar'
import { RealtimeNotificationsProvider } from '@/components/realtime-notifications-provider'

interface AdminShellProps {
  displayEmail: string
  children: React.ReactNode
}

export function AdminShell({ displayEmail, children }: AdminShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-muted/40">
      <RealtimeNotificationsProvider />
      <Toaster
        position="top-right"
        richColors
        closeButton
        expand
        toastOptions={{
          duration: 5000,
        }}
      />
      <AdminSidebar
        displayEmail={displayEmail}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      <main className={`${isCollapsed ? 'ml-20' : 'ml-64'} min-h-screen overflow-auto transition-all duration-300`}>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
