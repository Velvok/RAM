'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { getUsers, createUser, updateUser, deleteUser } from '@/app/actions/users'
import { Plus, Trash2, Edit2, UserCog, Shield, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { PageLoader } from '@/components/ui/spinner'
import { useConfirm } from '@/components/confirm-modal'

export default function ConfiguracionPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'operator' as 'admin' | 'manager' | 'operator',
    pin: '',
    password: '',
  })
  const { confirm, ConfirmDialog } = useConfirm()

  async function loadUsers() {
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (e) {
      console.error('Error loading users:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function openModal(user?: any) {
    if (user) {
      setEditingUser(user)
      setFormData({
        full_name: user.full_name,
        email: user.email || '',
        role: user.role,
        pin: '',
        password: '',
      })
    } else {
      setEditingUser(null)
      setFormData({
        full_name: '',
        email: '',
        role: 'operator',
        pin: '',
        password: '',
      })
    }
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          full_name: formData.full_name,
          role: formData.role,
          newPin: formData.pin || undefined,
        })
      } else {
        await createUser({
          email: formData.email || undefined,
          full_name: formData.full_name,
          role: formData.role,
          pin: formData.pin || undefined,
          password: formData.password || undefined,
        })
      }
      setShowModal(false)
      loadUsers()
    } catch (e) {
      console.error('Error saving user:', e)
      toast.error('Error al guardar usuario')
    }
  }

  async function handleDelete(userId: string) {
    const confirmed = await confirm('Eliminar usuario', '¿Eliminar este usuario? Esta acción no se puede deshacer.', { variant: 'danger', confirmText: 'Eliminar' })
    if (!confirmed) return
    try {
      await deleteUser(userId)
      loadUsers()
    } catch (e) {
      console.error('Error deleting user:', e)
      toast.error('Error al eliminar usuario')
    }
  }

  function getRoleIcon(role: string) {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />
      case 'manager': return <UserCog className="w-4 h-4" />
      case 'operator': return <Wrench className="w-4 h-4" />
      default: return null
    }
  }

  function getRoleLabel(role: string) {
    switch (role) {
      case 'admin': return 'Admin'
      case 'manager': return 'Manager'
      case 'operator': return 'Operario'
      default: return role
    }
  }

  if (loading) {
    return <PageLoader label="Cargando usuarios..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        subtitle="Gestión de usuarios del sistema"
        actions={
          <Button onClick={() => openModal()}>
            <Plus size={16} />
            Nuevo Usuario
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Primer Login</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium text-foreground">{user.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email || '—'}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                    {getRoleIcon(user.role)}
                    {getRoleLabel(user.role)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? 'success' : 'destructive'}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.first_login ? 'warning' : 'success'}>
                    {user.first_login ? 'Pendiente' : 'Completado'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <button
                    onClick={() => openModal(user)}
                    className="text-muted-foreground hover:text-primary mr-3 transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nombre completo</label>
                <Input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              {(formData.role === 'admin' || formData.role === 'manager') ? (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="usuario@ejemplo.com"
                  />
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Rol</label>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'manager' | 'operator' })}
                >
                  <option value="operator">Operario (acceso planta)</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>

              {formData.role === 'operator' && !editingUser && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">PIN inicial</label>
                  <Input
                    type="text"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    placeholder="Dejar vacío para usar el PIN por defecto"
                  />
                  <p className="text-xs text-muted-foreground mt-1">El operario deberá cambiarlo en su primer acceso</p>
                </div>
              )}

              {formData.role !== 'operator' && !editingUser && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Contraseña inicial</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Dejar vacío para usar la contraseña por defecto"
                  />
                  <p className="text-xs text-muted-foreground mt-1">El usuario deberá cambiarla en su primer acceso</p>
                </div>
              )}

              {editingUser && formData.role === 'operator' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Nuevo PIN</label>
                  <Input
                    type="text"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    placeholder="Dejar vacío para no cambiar"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1">
                  {editingUser ? 'Guardar cambios' : 'Crear usuario'}
                </Button>
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog />
    </div>
  )
}
