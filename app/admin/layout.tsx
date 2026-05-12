'use client'

import { useState } from 'react'
import { Toaster } from 'sonner'
import { AdminSidebar } from '@/components/admin-sidebar'
import { RealtimeNotificationsProvider } from '@/components/realtime-notifications-provider'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const displayEmail = 'admin@velvok.com (modo demo)'

  return (
    <div className="min-h-screen bg-slate-50">
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
