'use client'

import { useState } from 'react'

interface AdminSidebarProps {
  displayEmail: string
}

export function AdminSidebar({ displayEmail }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-slate-200 flex flex-col transition-all duration-300`}>
      <div className="p-6 border-b border-slate-200 flex items-center justify-between">
        {!isCollapsed && (
          <h1 className="text-2xl font-bold text-slate-900">
            RAM <span className="text-blue-600">Velvok</span>
          </h1>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors ml-auto"
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>
      
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          <a 
            href="/admin" 
            className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium`}
            title={isCollapsed ? 'Dashboard' : ''}
          >
            <svg className={`w-5 h-5 ${!isCollapsed && 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {!isCollapsed && 'Dashboard'}
          </a>
          <a 
            href="/admin/pedidos" 
            className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium`}
            title={isCollapsed ? 'Pedidos' : ''}
          >
            <svg className={`w-5 h-5 ${!isCollapsed && 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {!isCollapsed && 'Pedidos'}
          </a>
          <a 
            href="/admin/stock" 
            className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium`}
            title={isCollapsed ? 'Stock' : ''}
          >
            <svg className={`w-5 h-5 ${!isCollapsed && 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {!isCollapsed && 'Stock'}
          </a>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-200">
        {!isCollapsed ? (
          <>
            <div className="mb-3 px-4">
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
          </>
        ) : (
          <a
            href="/"
            className="flex items-center justify-center w-full px-2 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            title="Volver al inicio"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </a>
        )}
      </div>
    </aside>
  )
}
