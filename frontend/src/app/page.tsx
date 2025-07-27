'use client'

import { useState, useEffect } from 'react'

// TypeScript Interface für User-Objekt mit Rollen
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'mitarbeiter'
  isActive?: boolean
}

// Interface für neue User-Erstellung
interface NewUser {
  name: string
  email: string
  password: string
  role: 'admin' | 'mitarbeiter'
}

export default function Home() {
  const [isLogin, setIsLogin] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  })
  
  // Loading-State für Hydration
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

// === NEU: Admin-States ===
const [showAdminPanel, setShowAdminPanel] = useState(false)
const [allUsers, setAllUsers] = useState<User[]>([])
const [loadingUsers, setLoadingUsers] = useState(false)
const [showCreateUser, setShowCreateUser] = useState(false)
const [newUserForm, setNewUserForm] = useState<NewUser>({
  name: '',
  email: '',
  password: '',
  role: 'mitarbeiter'
})
const [adminMessage, setAdminMessage] = useState('')

  // Check if user is logged in on component mount
  useEffect(() => {
    // Client-side only check
    const token = localStorage.getItem('accessToken')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      try {
        setIsLoggedIn(true)
        setUser(JSON.parse(userData))
      } catch (error) {
        console.error('Error parsing user data:', error)
        localStorage.removeItem('user')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }
    }
    setIsLoading(false) // Loading beendet
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    const endpoint = isLogin ? '/api/login' : '/api/register'
    const url = `http://localhost:5000${endpoint}`
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        
        if (data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)
          localStorage.setItem('user', JSON.stringify(data.user))
          setIsLoggedIn(true)
          setUser(data.user)
          setFormData({ email: '', password: '', name: '' })
        }
      } else {
        if (data.details) {
          setMessage(`❌ ${data.details.join(', ')}`)
        } else {
          setMessage(`❌ ${data.error}`)
        }
      }
    } catch (error) {
      setMessage('❌ Verbindungsfehler - Server nicht erreichbar')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    setIsLoggedIn(false)
    setUser(null)
    setMessage('Erfolgreich abgemeldet')
  }

  const testProtectedRoute = async () => {
    const token = localStorage.getItem('accessToken')
    
    try {
      const response = await fetch('http://localhost:5000/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage(`Profil erfolgreich geladen: ${JSON.stringify(data, null, 2)}`)
      } else {
        setMessage(`Fehler: ${data.error}`)
      }
    } catch (error) {
      setMessage('Fehler beim Laden des Profils')
    }
  }

// === ADMIN-FUNKTIONEN ===

  // Alle User laden (nur Admin)
  const loadAllUsers = async () => {
    setLoadingUsers(true)
    setAdminMessage('')
    
    const token = localStorage.getItem('accessToken')
    
    try {
      const response = await fetch('http://localhost:5000/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setAllUsers(data.users)
        setAdminMessage(`✅ ${data.total} Benutzer geladen`)
      } else {
        setAdminMessage(`❌ ${data.error}`)
      }
    } catch (error) {
      setAdminMessage('❌ Fehler beim Laden der Benutzer')
    } finally {
      setLoadingUsers(false)
    }
  }

  // Neuen User erstellen (nur Admin)
  const createNewUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setAdminMessage('')
    
    const token = localStorage.getItem('accessToken')
    
    try {
      const response = await fetch('http://localhost:5000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUserForm),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setAdminMessage(`✅ ${data.message}`)
        setNewUserForm({ name: '', email: '', password: '', role: 'mitarbeiter' })
        setShowCreateUser(false)
        // User-Liste neu laden
        loadAllUsers()
      } else {
        if (data.details) {
          setAdminMessage(`❌ ${data.details.join(', ')}`)
        } else {
          setAdminMessage(`❌ ${data.error}`)
        }
      }
    } catch (error) {
      setAdminMessage('❌ Verbindungsfehler beim Erstellen des Benutzers')
    } finally {
      setLoading(false)
    }
  }

  // Admin-Panel öffnen und User laden
  const openAdminPanel = () => {
    setShowAdminPanel(true)
    setAdminMessage('')
    loadAllUsers()
  }

  // Responsive Logo-Component mit echtem Bild
  const SchoppmannLogo = () => (
    <div className="flex flex-col items-center mb-6 sm:mb-8">
      <div className="mb-4 sm:mb-6">
        <img 
          src="/Schoppmann_Logo.png" 
          alt="SCHOPPMANN Immobilien & Vermögensverwaltung" 
          className="w-36 sm:w-48 lg:w-56 h-auto"
        />
      </div>
    </div>
  )

  // Loading Screen während Hydration
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-stone-100 to-slate-200 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-slate-700 mx-auto mb-3 sm:mb-4"></div>
          <p className="text-slate-600 text-sm sm:text-base">Portal wird geladen...</p>
        </div>
      </div>
    )
  }

  // Dashboard für eingeloggte User
  if (isLoggedIn && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-stone-100 to-slate-200 flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm sm:max-w-lg p-6 sm:p-8 border border-slate-200 mx-2">
          <SchoppmannLogo />
          
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">
              Willkommen im Portal
            </h2>
            <p className="text-sm sm:text-base text-slate-600">Verwaltungsbereich erfolgreich erreicht</p>
          </div>
          
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-slate-50 border border-slate-200 p-4 sm:p-6 rounded-lg">
              <h3 className="text-base sm:text-lg font-semibold text-slate-700 mb-3 sm:mb-4 flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-slate-200 rounded-full flex items-center justify-center mr-2 sm:mr-3">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                Benutzerinformationen
              </h3>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex flex-col sm:flex-row sm:justify-between">
                  <span className="text-slate-600 font-medium text-sm sm:text-base">Name:</span>
                  <span className="text-slate-800 text-sm sm:text-base">{user?.name || 'Nicht verfügbar'}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between">
                  <span className="text-slate-600 font-medium text-sm sm:text-base">E-Mail:</span>
                  <span className="text-slate-800 text-sm sm:text-base break-all">{user?.email || 'Nicht verfügbar'}</span>
                </div>
              </div>
            </div>
            
<button
  onClick={testProtectedRoute}
  className="w-full bg-slate-700 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg hover:bg-slate-800 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center text-sm sm:text-base"
>
  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
  </svg>
  Geschützte Daten abrufen
</button>

{/* === NEU: Admin-Buttons (nur für Admins) === */}
{user?.role === 'admin' && (
  <button
    onClick={openAdminPanel}
    className="w-full bg-blue-600 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center text-sm sm:text-base"
  >
    <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
    </svg>
    Benutzer verwalten
  </button>
)}

<button
  onClick={handleLogout}
  className="w-full bg-white border-2 border-slate-300 text-slate-700 font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 flex items-center justify-center text-sm sm:text-base"
>
  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
  </svg>
  Abmelden
</button>
          </div>
          
          {message && (
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-slate-100 border border-slate-200 rounded-lg">
              <pre className="whitespace-pre-wrap text-xs sm:text-sm text-slate-700 font-mono">{message}</pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Login/Register Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-stone-100 to-slate-200 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm sm:max-w-md p-6 sm:p-8 border border-slate-200 mx-2">
        <SchoppmannLogo />
        
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">
            {isLogin ? 'Portal-Zugang' : 'Konto erstellen'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            {isLogin ? 'Melden Sie sich in Ihrem Verwaltungsbereich an' : 'Erstellen Sie Ihren Zugang zum Verwaltungsportal'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Vollständiger Name
              </label>
              <input
                type="text"
                placeholder="z.B. Max Mustermann"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none transition-colors text-slate-800 placeholder-slate-400 bg-white text-sm sm:text-base"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Nur Buchstaben, 2-50 Zeichen
              </p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              E-Mail-Adresse
            </label>
            <input
              type="email"
              placeholder="ihre.email@unternehmen.de"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none transition-colors text-slate-800 placeholder-slate-400 bg-white text-sm sm:text-base"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Passwort
            </label>
            <input
              type="password"
              placeholder={isLogin ? "Ihr Passwort" : "Sicheres Passwort erstellen"}
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none transition-colors text-slate-800 placeholder-slate-400 bg-white text-sm sm:text-base"
              required
            />
            {!isLogin && (
              <p className="text-xs text-slate-500 mt-1">
                Mindestens 8 Zeichen mit Groß-/Kleinbuchstaben und einer Zahl
              </p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-700 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center text-sm sm:text-base"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verarbeitung...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  {isLogin ? (
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  )}
                </svg>
                {isLogin ? 'Anmelden' : 'Konto erstellen'}
              </>
            )}
          </button>
        </form>
        
        <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-200 text-center">
          <p className="text-slate-600 mb-3 sm:mb-4 text-sm sm:text-base">
            {isLogin ? 'Noch kein Zugang?' : 'Bereits registriert?'}
          </p>
          <button
            onClick={() => {
              setIsLogin(!isLogin)
              setMessage('')
              setFormData({ email: '', password: '', name: '' })
            }}
            className="text-slate-700 hover:text-slate-900 font-semibold hover:underline transition-colors text-sm sm:text-base"
          >
            {isLogin ? 'Konto erstellen' : 'Zum Login'}
          </button>
        </div>
        
        {message && (
          <div className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg border ${
            message.includes('✅') 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="text-xs sm:text-sm font-medium">{message}</div>
          </div>
        )}
        
        <div className="mt-6 sm:mt-8 pt-3 sm:pt-4 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500">
            © 2024 SCHOPPMANN Immobilien &amp; Vermögensverwaltung
          </p>
        </div>
      </div>
    </div>
  )
}