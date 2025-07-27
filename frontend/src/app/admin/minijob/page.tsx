'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authManager, useAuth } from '@/utils/auth'

// TypeScript Interfaces
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'mitarbeiter'
  isActive: boolean
}

interface MinijobSetting {
  id: number
  monthlyLimit: number
  description: string
  validFrom: string
  validUntil: string | null
  isActive: boolean
  createdAt: string
  Creator: {
    name: string
    email: string
  }
}

interface NewMinijobSetting {
  monthlyLimit: string
  description: string
  validFrom: string
  validUntil: string
}

export default function MinijobSettingsPage() {
  const router = useRouter()
  const { handleSessionExpired } = useAuth()

  // States
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<MinijobSetting[]>([])
  const [currentSetting, setCurrentSetting] = useState<MinijobSetting | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [message, setMessage] = useState('')

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSetting, setEditingSetting] = useState<MinijobSetting | null>(null)
  const [loadingAction, setLoadingAction] = useState(false)

  // Form State
  const [newSettingForm, setNewSettingForm] = useState<NewMinijobSetting>({
    monthlyLimit: '',
    description: '',
    validFrom: '',
    validUntil: ''
  })

  // Auth Check beim Laden
  useEffect(() => {
    checkAuth()
  }, [])

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
      loadMinijobSettings()
      loadCurrentSetting()
    } catch (error: any) {
      console.error('Auth error:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  // Alle Minijob-Einstellungen laden
  const loadMinijobSettings = async () => {
    setLoadingSettings(true)
    try {
      const response = await authManager.authenticatedFetch('http://localhost:5000/api/admin/minijob-settings')
      const data = await response.json()

      if (response.ok) {
        setSettings(data.settings)
        setMessage(`✅ ${data.total} Minijob-Einstellungen geladen`)
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') {
        setMessage('⏰ Sitzung abgelaufen - Sie werden ausgeloggt...')
        setTimeout(handleSessionExpired, 2000)
      } else {
        setMessage('❌ Fehler beim Laden der Einstellungen')
      }
    } finally {
      setLoadingSettings(false)
    }
  }

  // Aktuelle Minijob-Einstellung laden
  const loadCurrentSetting = async () => {
    try {
      const response = await authManager.authenticatedFetch('http://localhost:5000/api/admin/minijob-settings/current')
      const data = await response.json()

      if (response.ok) {
        setCurrentSetting(data.setting)
      } else if (response.status === 404) {
        setCurrentSetting(null)
      }
    } catch (error: any) {
      console.error('Fehler beim Laden der aktuellen Einstellung:', error)
    }
  }

  // Neue Einstellung erstellen
  const createNewSetting = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingAction(true)
    setMessage('')

    try {
      const response = await authManager.authenticatedFetch('http://localhost:5000/api/admin/minijob-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettingForm),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        setNewSettingForm({ monthlyLimit: '', description: '', validFrom: '', validUntil: '' })
        setShowCreateModal(false)
        loadMinijobSettings()
        loadCurrentSetting()
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
        setMessage('❌ Verbindungsfehler beim Erstellen der Einstellung')
      }
    } finally {
      setLoadingAction(false)
    }
  }

  // Einstellung bearbeiten vorbereiten
  const openEditSetting = (setting: MinijobSetting) => {
    setEditingSetting(setting)
    setNewSettingForm({
      monthlyLimit: setting.monthlyLimit.toString(),
      description: setting.description,
      validFrom: setting.validFrom,
      validUntil: setting.validUntil || ''
    })
    setShowEditModal(true)
  }

  // Einstellung aktualisieren
  const updateSetting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSetting) return

    setLoadingAction(true)
    setMessage('')

    try {
      const response = await authManager.authenticatedFetch(`http://localhost:5000/api/admin/minijob-settings/${editingSetting.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettingForm),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        setShowEditModal(false)
        setEditingSetting(null)
        loadMinijobSettings()
        loadCurrentSetting()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') {
        setMessage('⏰ Sitzung abgelaufen - Sie werden ausgeloggt...')
        setTimeout(handleSessionExpired, 2000)
      } else {
        setMessage('❌ Verbindungsfehler beim Aktualisieren der Einstellung')
      }
    } finally {
      setLoadingAction(false)
    }
  }

  // Einstellung löschen
  const deleteSetting = async (settingId: number) => {
    if (!confirm('Sind Sie sicher, dass Sie diese Einstellung löschen möchten?')) return

    setLoadingAction(true)
    setMessage('')

    try {
      const response = await authManager.authenticatedFetch(`http://localhost:5000/api/admin/minijob-settings/${settingId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        loadMinijobSettings()
        loadCurrentSetting()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') {
        setMessage('⏰ Sitzung abgelaufen - Sie werden ausgeloggt...')
        setTimeout(handleSessionExpired, 2000)
      } else {
        setMessage('❌ Verbindungsfehler beim Löschen der Einstellung')
      }
    } finally {
      setLoadingAction(false)
    }
  }

  // Status aktualisieren
  const refreshStatus = async () => {
    setLoadingAction(true)
    try {
      const response = await authManager.authenticatedFetch('http://localhost:5000/api/admin/minijob-settings/refresh-status', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        loadMinijobSettings()
        loadCurrentSetting()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error: any) {
      setMessage('❌ Fehler beim Aktualisieren des Status')
    } finally {
      setLoadingAction(false)
    }
  }

  // Hilfsfunktionen
  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T12:00:00').toLocaleDateString('de-DE')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const getStatusBadge = (setting: MinijobSetting) => {
    const today = new Date().toISOString().split('T')[0]
    
    if (setting.isActive) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aktiv</span>
    } else if (setting.validFrom > today) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Zukünftig</span>
    } else {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Inaktiv</span>
    }
  }

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Lade Minijob-Einstellungen...</p>
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
                <p className="text-sm text-slate-500">Minijob-Einstellungen</p>
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
                {/* Navigation Links */}
                <button
                  onClick={() => router.push('/admin')}
                  className="w-full text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Benutzer-Verwaltung
                  </div>
                </button>

                {/* Active Page */}
                <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm font-medium border-l-4 border-blue-600">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Minijob-Einstellungen
                  </div>
                </div>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Current Setting Card */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900">Aktuelle Einstellung</h2>
              </div>

              {currentSetting ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-blue-600 mb-1">Monatliches Limit</p>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(currentSetting.monthlyLimit)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-slate-600 mb-1">Beschreibung</p>
                    <p className="font-semibold text-slate-900">{currentSetting.description}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-slate-600 mb-1">Gültig ab</p>
                    <p className="font-semibold text-slate-900">{formatDate(currentSetting.validFrom)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-slate-600 mb-1">Gültig bis</p>
                    <p className="font-semibold text-slate-900">{currentSetting.validUntil ? formatDate(currentSetting.validUntil) : 'Unbegrenzt'}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-yellow-50 rounded-lg border border-yellow-200">
                  <svg className="w-12 h-12 text-yellow-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="text-lg font-medium text-yellow-800 mb-2">Keine aktuelle Einstellung gefunden</h3>
                  <p className="text-yellow-700 mb-4">Bitte erstellen Sie eine neue Minijob-Einstellung</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Neue Einstellung erstellen
                  </button>
                </div>
              )}
            </div>

            {/* Page Header */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Einstellungsverlauf</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Verwalten Sie alle Minijob-Grenzen und deren Gültigkeitszeiträume
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Neue Einstellung
                  </button>
                </div>
              </div>
            </div>

            {/* Settings Table */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-medium text-slate-900">
                  Alle Einstellungen ({settings.length})
                </h3>
              </div>

              {loadingSettings ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-slate-500">Lade Einstellungen...</p>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Limit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Beschreibung
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Gültigkeitszeitraum
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Erstellt von
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {settings.map((setting) => (
                        <tr key={setting.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-slate-900">
                              {formatCurrency(setting.monthlyLimit)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-900 max-w-xs">
                              {setting.description}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-900">
                              <div>{formatDate(setting.validFrom)}</div>
                              <div className="text-slate-500">
                                bis {setting.validUntil ? formatDate(setting.validUntil) : 'unbegrenzt'}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(setting)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-900">{setting.Creator.name}</div>
                            <div className="text-sm text-slate-500">{setting.Creator.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => openEditSetting(setting)}
                                className="text-blue-600 hover:text-blue-900 p-1.5 hover:bg-blue-50 rounded"
                                title="Bearbeiten"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {!setting.isActive && setting.validFrom > new Date().toISOString().split('T')[0] && (
                                <button
                                  onClick={() => deleteSetting(setting.id)}
                                  className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-50 rounded"
                                  title="Löschen"
                                  disabled={loadingAction}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {settings.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                            Noch keine Minijob-Einstellungen vorhanden
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Wichtige Hinweise</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="space-y-1">
                      <li>• Die <strong>aktive Einstellung</strong> bestimmt die Minijob-Grenze für alle Arbeitnehmer</li>
                      <li>• Einstellungen können im Voraus geplant werden durch Festlegung von Gültigkeitszeiträumen</li>
                      <li>• Nur zukünftige Einstellungen können gelöscht werden</li>
                      <li>• Der Status wird automatisch basierend auf dem aktuellen Datum aktualisiert</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ===== MODALS ===== */}

      {/* Create Setting Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Neue Minijob-Einstellung</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={createNewSetting} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Monatliches Limit (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="999999.99"
                  value={newSettingForm.monthlyLimit}
                  onChange={(e) => setNewSettingForm({ ...newSettingForm, monthlyLimit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                  placeholder="z.B. 550.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Beschreibung
                </label>
                <input
                  type="text"
                  value={newSettingForm.description}
                  onChange={(e) => setNewSettingForm({ ...newSettingForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                  placeholder="z.B. Neue gesetzliche Minijob-Grenze 2025"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gültig ab
                  </label>
                  <input
                    type="date"
                    value={newSettingForm.validFrom}
                    onChange={(e) => setNewSettingForm({ ...newSettingForm, validFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gültig bis (optional)
                  </label>
                  <input
                    type="date"
                    value={newSettingForm.validUntil}
                    onChange={(e) => setNewSettingForm({ ...newSettingForm, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                    min={newSettingForm.validFrom}
                    placeholder="Leer = unbegrenzt"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {loadingAction ? 'Erstelle...' : 'Einstellung erstellen'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-200 text-slate-800 py-2 px-4 rounded-md hover:bg-slate-300 font-medium transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Setting Modal */}
      {showEditModal && editingSetting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Einstellung bearbeiten</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={updateSetting} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Monatliches Limit (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="999999.99"
                  value={newSettingForm.monthlyLimit}
                  onChange={(e) => setNewSettingForm({ ...newSettingForm, monthlyLimit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Beschreibung
                </label>
                <input
                  type="text"
                  value={newSettingForm.description}
                  onChange={(e) => setNewSettingForm({ ...newSettingForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gültig ab
                  </label>
                  <input
                    type="date"
                    value={newSettingForm.validFrom}
                    onChange={(e) => setNewSettingForm({ ...newSettingForm, validFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gültig bis (optional)
                  </label>
                  <input
                    type="date"
                    value={newSettingForm.validUntil}
                    onChange={(e) => setNewSettingForm({ ...newSettingForm, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    min={newSettingForm.validFrom}
                  />
                </div>
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
                  onClick={() => setShowEditModal(false)}
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