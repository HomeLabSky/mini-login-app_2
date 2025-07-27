import { useRouter } from 'next/navigation'

export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'mitarbeiter'
  isActive: boolean
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  user: User
}

class AuthManager {
  private static instance: AuthManager
  private refreshPromise: Promise<boolean> | null = null

  private constructor() {}

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager()
    }
    return AuthManager.instance
  }

  // Token aus localStorage laden
  getTokens(): { accessToken: string | null, refreshToken: string | null } {
    return {
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken')
    }
  }

  // User aus localStorage laden
  getUser(): User | null {
    const userData = localStorage.getItem('user')
    return userData ? JSON.parse(userData) : null
  }

  // Tokens speichern
  setTokens(tokens: AuthTokens): void {
    localStorage.setItem('accessToken', tokens.accessToken)
    localStorage.setItem('refreshToken', tokens.refreshToken)
    localStorage.setItem('user', JSON.stringify(tokens.user))
  }

  // Alle Auth-Daten löschen
  clearAuth(): void {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  }

  // Token automatisch erneuern
  async refreshTokens(): Promise<boolean> {
    // Wenn bereits ein Refresh läuft, warten
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.performRefresh()
    const result = await this.refreshPromise
    this.refreshPromise = null
    return result
  }

  private async performRefresh(): Promise<boolean> {
    const { refreshToken } = this.getTokens()
    
    if (!refreshToken) {
      console.log('❌ Kein Refresh Token vorhanden')
      return false
    }

    try {
      console.log('🔄 Erneuere Token...')
      
      const response = await fetch('http://localhost:5000/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })

      const data = await response.json()

      if (response.ok) {
        console.log('✅ Token erfolgreich erneuert')
        this.setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user
        })
        return true
      } else {
        console.log('❌ Token Refresh fehlgeschlagen:', data.error)
        this.clearAuth()
        return false
      }
    } catch (error) {
      console.error('❌ Token Refresh Error:', error)
      this.clearAuth()
      return false
    }
  }

  // API-Call mit automatischem Token Refresh
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const { accessToken } = this.getTokens()
    
    // Ersten Versuch mit aktuellem Token
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`
      }
    })

    // Wenn 401/403, versuche Token zu erneuern
    if (response.status === 401 || response.status === 403) {
      console.log('🔄 Token abgelaufen, versuche Refresh...')
      
      const refreshSuccess = await this.refreshTokens()
      
      if (refreshSuccess) {
        // Retry mit neuem Token
        const { accessToken: newToken } = this.getTokens()
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          }
        })
      } else {
        // Refresh fehlgeschlagen - User muss sich neu einloggen
        throw new Error('SESSION_EXPIRED')
      }
    }

    return response
  }
}

export const authManager = AuthManager.getInstance()

// Hook für einfache Nutzung in Components
export const useAuth = () => {
  const router = useRouter()

  const handleSessionExpired = () => {
    authManager.clearAuth()
    router.push('/')
  }

  return {
    authManager,
    handleSessionExpired
  }
}