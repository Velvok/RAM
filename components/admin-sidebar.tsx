'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, ShoppingCart, Package, History, FileText,
  Settings, ArrowLeft, ChevronLeft, ChevronRight, Scissors, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/app/actions/auth'

interface AdminSidebarProps {
  displayEmail: string
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
}

export function AdminSidebar({ displayEmail, isCollapsed, setIsCollapsed }: AdminSidebarProps) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)

  // Contador de eventos pendientes (entrada sin procesar + salida fallida)
  useEffect(() => {
    const supabase = createClient()

    const fetchPending = async () => {
      const { count: failedOutbound } = await supabase
        .from('outbound_events')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'failed'])
        .is('viewed_at', null) // Solo contar no vistos

      const { count: failedInbound } = await supabase
        .from('evo_events')
        .select('*', { count: 'exact', head: true })
        .eq('success', false)

      setPendingCount((failedOutbound || 0) + (failedInbound || 0))
    }

    fetchPending()

    // Suscripción a cambios para actualizar el contador en vivo
    const channel = supabase
      .channel('sidebar-pending-count')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'evo_events' },
        () => fetchPending())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'outbound_events' },
        () => fetchPending())
      .subscribe()

    // Refrescar cada 30 segundos por si Realtime falla
    const interval = setInterval(fetchPending, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(path)
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingCart },
    { href: '/admin/recortes', label: 'Recortes', icon: Scissors },
    { href: '/admin/stock', label: 'Stock', icon: Package },
    { href: '/admin/historial', label: 'Historial Anual', icon: History },
    { href: '/admin/logs', label: 'Logs RAM', icon: FileText, badge: pendingCount },
  ]

  return (
    <aside className={cn(
      'h-screen bg-card border-r border-border flex flex-col transition-all duration-300 fixed left-0 top-0',
      isCollapsed ? 'w-20' : 'w-64'
    )}>
      <div className={cn(
        'h-16 border-b border-border flex items-center justify-center shrink-0',
        isCollapsed ? 'px-3' : 'px-6'
      )}>
        {!isCollapsed ? (
          <div className="relative h-9 w-44">
            <Image
              src="/logo-horizontal.png"
              alt="Comercial RAM"
              fill
              className="object-contain"
              priority
            />
          </div>
        ) : (
          <div className="relative w-10 h-10">
            <Image
              src="/logo-square.png"
              alt="RAM"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href)
          return (
            <a
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 py-2 rounded-md text-sm font-medium transition-all duration-200 relative',
                isCollapsed ? 'justify-center px-0' : 'px-3',
                active
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              title={isCollapsed ? `${label}${badge ? ` (${badge} pendientes)` : ''}` : undefined}
            >
              <Icon size={16} strokeWidth={1.5} className={cn('shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
              {!isCollapsed && (
                <span className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{label}</span>
                  {!!badge && badge > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[10px] rounded-full px-1.5 py-0.5 font-semibold leading-none">
                      {badge}
                    </span>
                  )}
                </span>
              )}
              {isCollapsed && !!badge && badge > 0 && (
                <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-semibold leading-none">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </a>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <a
          href="/admin/configuracion"
          className={cn(
            'flex items-center gap-2.5 py-2 rounded-md text-sm font-medium transition-all duration-200',
            isCollapsed ? 'justify-center px-0' : 'px-3',
            isActive('/admin/configuracion')
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          title={isCollapsed ? 'Configuración' : undefined}
        >
          <Settings size={16} strokeWidth={1.5} className={cn('shrink-0', isActive('/admin/configuracion') ? 'text-primary' : 'text-muted-foreground')} />
          {!isCollapsed && 'Configuración'}
        </a>

        {!isCollapsed && (
          <div className="px-3 py-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Usuario</p>
            <p className="text-sm text-foreground truncate">{displayEmail}</p>
          </div>
        )}

        <a
          href="/"
          className={cn(
            'flex items-center gap-2 rounded-md text-xs font-medium text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground transition-all duration-200',
            isCollapsed ? 'justify-center px-0 py-2' : 'px-3 py-1.5'
          )}
          title="Volver al inicio"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          {!isCollapsed && 'Volver'}
        </a>

        <button
          onClick={() => logout()}
          className={cn(
            'flex items-center gap-2 w-full rounded-md text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200',
            isCollapsed ? 'justify-center px-0 py-2' : 'px-3 py-1.5'
          )}
          title="Cerrar sesión"
        >
          <LogOut size={14} strokeWidth={1.5} />
          {!isCollapsed && 'Cerrar sesión'}
        </button>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'flex items-center gap-2 w-full rounded-md text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200',
            isCollapsed ? 'justify-center px-0 py-2' : 'px-3 py-1.5'
          )}
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {isCollapsed ? <ChevronRight size={14} strokeWidth={1.5} /> : <ChevronLeft size={14} strokeWidth={1.5} />}
          {!isCollapsed && 'Colapsar'}
        </button>
      </div>
    </aside>
  )
}
