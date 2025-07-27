'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authManager, useAuth } from '@/utils/auth'

// TypeScript Interfaces (unchanged)
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'mitarbeiter'
  isActive: boolean
  createdAt: string
  stundenlohn?: number
  abrechnungStart?: number
  abrechnungEnde?: number
  lohnzettelEmail?: string
}

interface NewUser {
  name: string
  email: string
  password: string
  role: 'admin' | 'mitarbeiter'
}

interface EditUser {
  id: number
  name: string
  email: string
  password: string
  role: 'admin' | 'mitarbeiter'
  isActive: boolean
}

interface UserSettings {
  id: number
  stundenlohn: number
  abrechnungStart: number
  abrechnungEnde: number
  lohnzettelEmail: string
}

export default function AdminPage() {
  const router = useRouter()
  const { handleSessionExpired } = useAuth()

  // States (unchanged logic)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [message, setMessage] = useState('')
  const [newUserForm, setNewUserForm] = useState<NewUser>({
    name: '',
    email: '',
    password: '',
    role: 'mitarbeiter'
  })

  // Bearbeiten-States
  const [showEditUser, setShowEditUser] = useState(false)
  const [showUserSettings, setShowUserSettings] = useState(false)
  const [editingUser, setEditingUser] = useState<EditUser | null>(null)
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const [loadingAction, setLoadingAction] = useState(false)

  // Auth Check beim Laden
  useEffect(() => {
    checkAuth()
  }, [])

  // Auth-Prüfung (unchanged)
  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/')
      return
    }

    try {
      const user = JSON.parse(userData)

      if (user.role !== 'admin') {
        setMessage('❌ Administratorrechte erforderlich')
        setTimeout(() => router.push('/'), 2000)
        return
      }

      setCurrentUser(user)
      loadAllUsers()
    } catch (error: any) {
      console.error('Auth error:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  // All existing functions (unchanged)
  const loadAllUsers = async () => {
    setLoadingUsers(true)
    setMessage('')
    
    try {
      const response = await authManager.authenticatedFetch('http://localhost:5000/api/admin/users')
      const data = await response.json()
      
      if (response.ok) {
        setAllUsers(data.users)
        setMessage(`✅ ${data.total} Benutzer geladen`)
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') {
        setMessage('⏰ Sitzung abgelaufen - Sie werden ausgeloggt...')
        setTimeout(handleSessionExpired, 2000)
      } else {
        setMessage('❌ Fehler beim Laden der Benutzer')
      }
    } finally {
      setLoadingUsers(false)
    }
  }

  const createNewUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    try {
      const response = await authManager.authenticatedFetch('http://localhost:5000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUserForm),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        setNewUserForm({ name: '', email: '', password: '', role: 'mitarbeiter' })
        setShowCreateUser(false)
        loadAllUsers()
      } else {
        if (data.details) {
          setMessage(`❌ ${data.details.join(', ')}`)
        } else {
          setMessage(`❌ ${data.error}`)
        }
      }
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') {
        setMessage('⏰ Sitzung abgelaufen - Sie werden ausgeloggt...')
        setTimeout(handleSessionExpired, 2000)
      } else {
        setMessage('❌ Verbindungsfehler beim Erstellen des Benutzers')
      }
    } finally {
      setLoading(false)
    }
  }

  const openEditUser = (user: User) => {
    setEditingUser({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      isActive: user.isActive
    })
    setShowEditUser(true)
  }

  const openUserSettings = (user: User) => {
    setUserSettings({
      id: user.id,
      stundenlohn: user.stundenlohn || 12.00,
      abrechnungStart: user.abrechnungStart || 1,
      abrechnungEnde: user.abrechnungEnde || 31,
      lohnzettelEmail: user.lohnzettelEmail || user.email
    })
    setShowUserSettings(true)
  }

  const updateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setLoadingAction(true)
    setMessage('')

    try {
      const response = await authManager.authenticatedFetch(`http://localhost:5000/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingUser),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        setShowEditUser(false)
        setEditingUser(null)
        loadAllUsers()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') {
        setMessage('⏰ Sitzung abgelaufen - Sie werden ausgeloggt...')
        setTimeout(handleSessionExpired, 2000)
      } else {
        setMessage('❌ Verbindungsfehler beim Aktualisieren des Benutzers')
      }
    } finally {
      setLoadingAction(false)
    }
  }

  const updateUserSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userSettings) return

    setLoadingAction(true)
    setMessage('')

    try {
      const response = await authManager.authenticatedFetch(`http://localhost:5000/api/admin/users/${userSettings.id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userSettings),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        setShowUserSettings(false)
        setUserSettings(null)
        loadAllUsers()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') {
        setMessage('⏰ Sitzung abgelaufen - Sie werden ausgeloggt...')
        setTimeout(handleSessionExpired, 2000)
      } else {
        setMessage('❌ Verbindungsfehler beim Aktualisieren der Einstellungen')
      }
    } finally {
      setLoadingAction(false)
    }
  }

  const toggleUserStatus = async (userId: number) => {
    setLoadingAction(true)
    setMessage('')

    try {
      const response = await authManager.authenticatedFetch(`http://localhost:5000/api/admin/users/${userId}/toggle-status`, {
        method: 'PATCH'
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        loadAllUsers()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') {
        setMessage('⏰ Sitzung abgelaufen - Sie werden ausgeloggt...')
        setTimeout(handleSessionExpired, 2000)
      } else {
        setMessage('❌ Verbindungsfehler beim Ändern des Status')
      }
    } finally {
      setLoadingAction(false)
    }
  }

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Lade Admin-Panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Professional Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {/* Logo & Title */}
            <div className="flex items-center space-x-4">
              <img
                src="/Schoppmann_Logo.png"
                alt="SCHOPPMANN"
                className="w-8 h-8"
              />
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Admin-Panel</h1>
                <p className="text-sm text-slate-500">Benutzer-Verwaltung</p>
              </div>
            </div>

            {/* User Info & Actions */}
            <div className="flex items-center space-x-6">
              {/* User Info */}
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-slate-900">{currentUser?.name}</p>
                <p className="text-xs text-slate-500">Administrator</p>
              </div>

              {/* User Avatar */}
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {currentUser?.name?.charAt(0)}
                </span>
              </div>

              {/* Logout */}
              <button
                onClick={() => router.push('/')}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Zum Dashboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex">
          {/* Professional Sidebar */}
          <aside className="w-64 mr-8">
            <nav className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="space-y-2">
                {/* Active Page */}
                <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm font-medium border-l-4 border-blue-600">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Benutzer-Verwaltung
                  </div>
                </div>

                {/* Navigation Links */}
                <button
                  onClick={() => router.push('/admin/minijob')}
                  className="w-full text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Minijob-Einstellungen
                  </div>
                </button>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Page Header */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Benutzer-Verwaltung</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Verwalten Sie alle Benutzer und deren Einstellungen
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateUser(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Neuer Benutzer
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-medium text-slate-900">
                  Alle Benutzer ({allUsers.length})
                </h3>
              </div>

              {loadingUsers ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-slate-500">Lade Benutzer...</p>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Benutzer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Rolle
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Stundenlohn
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {allUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mr-4">
                                <span className="text-sm font-medium text-slate-600">
                                  {user.name.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-900">{user.name}</div>
                                <div className="text-sm text-slate-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'admin'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {user.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            {user.stundenlohn ? `${user.stundenlohn}€` : 'Nicht gesetzt'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {user.isActive ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => openEditUser(user)}
                                className="text-blue-600 hover:text-blue-900 p-1.5 hover:bg-blue-50 rounded"
                                title="Bearbeiten"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openUserSettings(user)}
                                className="text-slate-600 hover:text-slate-900 p-1.5 hover:bg-slate-50 rounded"
                                title="Einstellungen"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => toggleUserStatus(user.id)}
                                className={`p-1.5 rounded ${
                                  user.isActive 
                                    ? 'text-red-600 hover:text-red-900 hover:bg-red-50' 
                                    : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                }`}
                                title={user.isActive ? 'Deaktivieren' : 'Aktivieren'}
                                disabled={loadingAction}
                              >
                                {user.isActive ? (
                                  <svg 
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M18.364 5.636l-12.728 12.728M6.343 6.343a9 9 0 1112.728 12.728A9 9 0 016.343 6.343z"
                                    />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {allUsers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                            Noch keine Benutzer vorhanden
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* All existing modals unchanged... */}
      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Neuen Benutzer erstellen</h3>
              <button
                onClick={() => setShowCreateUser(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={createNewUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Vollständiger Name
                </label>
                <input
                  type="text"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                  placeholder="z.B. Max Mustermann"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  E-Mail-Adresse
                </label>
                <input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                  placeholder="name@schoppmann.de"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Passwort
                </label>
                <input
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                  placeholder="Mindestens 8 Zeichen"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rolle
                </label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as 'admin' | 'mitarbeiter' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                >
                  <option value="mitarbeiter" className="text-slate-900">Mitarbeiter</option>
                  <option value="admin" className="text-slate-900">Administrator</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {loading ? 'Erstelle...' : 'Benutzer erstellen'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateUser(false)}
                  className="flex-1 bg-slate-200 text-slate-800 py-2 px-4 rounded-md hover:bg-slate-300 font-medium transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUser && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Benutzer bearbeiten</h3>
              <button
                onClick={() => setShowEditUser(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={updateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  E-Mail
                </label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Neues Passwort (leer lassen um beizubehalten)
                </label>
                <input
                  type="password"
                  value={editingUser.password}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-500"
                  placeholder="Leer lassen für keine Änderung"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rolle
                </label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'admin' | 'mitarbeiter' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                >
                  <option value="mitarbeiter" className="text-slate-900">Mitarbeiter</option>
                  <option value="admin" className="text-slate-900">Administrator</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {loadingAction ? 'Aktualisiere...' : 'Aktualisieren'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditUser(false)}
                  className="flex-1 bg-slate-200 text-slate-800 py-2 px-4 rounded-md hover:bg-slate-300 font-medium transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Settings Modal */}
      {showUserSettings && userSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Einstellungen für {allUsers.find(u => u.id === userSettings.id)?.name}
              </h3>
              <button
                onClick={() => setShowUserSettings(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={updateUserSettings} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Stundenlohn (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="999"
                  value={userSettings.stundenlohn}
                  onChange={(e) => setUserSettings({ ...userSettings, stundenlohn: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Der Betrag in Euro, den der Benutzer pro Arbeitsstunde erhält.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Abrechnungszeitraum Start (Tag)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={userSettings.abrechnungStart}
                    onChange={(e) => setUserSettings({ ...userSettings, abrechnungStart: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Abrechnungszeitraum Ende (Tag)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={userSettings.abrechnungEnde}
                    onChange={(e) => setUserSettings({ ...userSettings, abrechnungEnde: parseInt(e.target.value) || 31 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  E-Mail für Lohnzettel
                </label>
                <input
                  type="email"
                  value={userSettings.lohnzettelEmail}
                  onChange={(e) => setUserSettings({ ...userSettings, lohnzettelEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-500"
                  placeholder="E-Mail für Lohnzettel-Versand"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {loadingAction ? 'Speichere...' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserSettings(false)}
                  className="flex-1 bg-slate-200 text-slate-800 py-2 px-4 rounded-md hover:bg-slate-300 font-medium transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg max-w-md border ${message.includes('✅')
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}