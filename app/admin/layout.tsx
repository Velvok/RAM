'use client'

import { useState } from 'react'
import { AdminSidebar } from '@/components/admin-sidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const displayEmail = 'admin@velvok.com (modo demo)'

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar 
        displayEmail={displayEmail} 
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      <main className={`${isCollapsed ? 'ml-20' : 'ml-64'} min-h-screen overflow-auto transition-all duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
