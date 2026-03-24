'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

interface AdminSidebarProps {
  displayEmail: string
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
}

export function AdminSidebar({ displayEmail, isCollapsed, setIsCollapsed }: AdminSidebarProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(path)
  }

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 fixed left-0 top-0`}>
      <div className={`${isCollapsed ? 'p-4' : 'p-6'} border-b border-slate-200 flex items-center justify-center`}>
        {!isCollapsed ? (
          <div className="relative h-10 w-48">
            <Image 
              src="/logo-horizontal.png" 
              alt="Comercial RAM" 
              fill
              className="object-contain"
              priority
            />
          </div>
        ) : (
          <div className="relative w-12 h-12">
            <Image 
              src="/logo-square.png" 
              alt="RAM" 
              width={48}
              height={48}
              className="object-contain"
              priority
            />
          </div>
        )}
      </div>
      
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          <a 
            href="/admin" 
            className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-lg transition-colors font-medium ${
              isActive('/admin')
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title={isCollapsed ? 'Dashboard' : ''}
          >
            <svg className={`w-5 h-5 ${!isCollapsed && 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {!isCollapsed && 'Dashboard'}
          </a>
          <a 
            href="/admin/pedidos" 
            className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-lg transition-colors font-medium ${
              isActive('/admin/pedidos')
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title={isCollapsed ? 'Pedidos' : ''}
          >
            <svg className={`w-5 h-5 ${!isCollapsed && 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {!isCollapsed && 'Pedidos'}
          </a>
          <a 
            href="/admin/stock" 
            className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-lg transition-colors font-medium ${
              isActive('/admin/stock')
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title={isCollapsed ? 'Stock' : ''}
          >
            <svg className={`w-5 h-5 ${!isCollapsed && 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {!isCollapsed && 'Stock'}
          </a>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-3">
        {!isCollapsed ? (
          <>
            <div className="px-4">
              <p className="text-xs text-slate-500 mb-1">Usuario</p>
              <p className="text-sm text-slate-700 truncate">{displayEmail}</p>
            </div>
            <a
              href="/"
              className="flex items-center justify-center w-full px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver
            </a>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center justify-center w-full px-4 py-2 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium text-slate-700"
              title="Colapsar menú"
            >
              <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              Colapsar
            </button>
          </>
        ) : (
          <>
            <a
              href="/"
              className="flex items-center justify-center w-full px-2 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              title="Volver al inicio"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center justify-center w-full px-2 py-2 hover:bg-blue-50 rounded-lg transition-colors"
              title="Expandir menú"
            >
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
