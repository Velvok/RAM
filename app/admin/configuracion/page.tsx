'use client'

import { useState, useEffect } from 'react'
import { getUsers, createUser, updateUser, deleteUser } from '@/app/actions/users'
import { Plus, Trash2, Edit2, UserCog, Shield, Wrench } from 'lucide-react'

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
      alert('Error al guardar usuario')
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm('¿Eliminar este usuario?')) return
    try {
      await deleteUser(userId)
      loadUsers()
    } catch (e) {
      console.error('Error deleting user:', e)
      alert('Error al eliminar usuario')
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
    return <div className="p-8 text-slate-600">Cargando...</div>
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestión de usuarios del sistema</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Primer Login</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{user.full_name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{user.email || '—'}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                    {getRoleIcon(user.role)}
                    {getRoleLabel(user.role)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                    user.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.first_login ? (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Pendiente</span>
                  ) : (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Completado</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => openModal(user)}
                    className="text-slate-400 hover:text-blue-600 mr-3 transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {(formData.role === 'admin' || formData.role === 'manager') ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="usuario@ejemplo.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'manager' | 'operator' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="operator">Operario (acceso planta)</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {formData.role === 'operator' && !editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PIN inicial</label>
                  <input
                    type="text"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    placeholder="111111 (por defecto)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-400 mt-1">El operario deberá cambiarlo en su primer acceso</p>
                </div>
              )}

              {formData.role !== 'operator' && !editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña inicial</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="admin1 (por defecto)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-400 mt-1">El usuario deberá cambiarla en su primer acceso</p>
                </div>
              )}

              {editingUser && formData.role === 'operator' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nuevo PIN</label>
                  <input
                    type="text"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    placeholder="Dejar vacío para no cambiar"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {editingUser ? 'Guardar cambios' : 'Crear usuario'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
