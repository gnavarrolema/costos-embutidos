import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// En producción (Cloud Run), VITE_API_URL apuntará al backend
// En desarrollo, usará el proxy configurado en vite.config.js
const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api'

const TOKEN_KEY = 'costos_embutidos_token'
const USER_KEY = 'costos_embutidos_user'

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Cargar sesión al iniciar
    useEffect(() => {
        const savedToken = localStorage.getItem(TOKEN_KEY)
        const savedUser = localStorage.getItem(USER_KEY)

        if (savedToken && savedUser) {
            // Verificar que el token siga siendo válido
            verifyToken(savedToken).then(isValid => {
                if (isValid) {
                    setToken(savedToken)
                    setUser(JSON.parse(savedUser))
                } else {
                    // Token expirado, limpiar
                    localStorage.removeItem(TOKEN_KEY)
                    localStorage.removeItem(USER_KEY)
                }
                setLoading(false)
            })
        } else {
            setLoading(false)
        }
    }, [])

    const verifyToken = async (tokenToVerify) => {
        try {
            const response = await fetch(`${API_BASE}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${tokenToVerify}`
                }
            })
            if (response.ok) {
                const data = await response.json()
                // Actualizar usuario con datos frescos del servidor
                if (data.user) {
                    setUser(data.user)
                    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
                }
                return true
            }
            return false
        } catch {
            return false
        }
    }

    const login = async (username, password) => {
        setError(null)
        setLoading(true)

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Error al iniciar sesión')
            }

            // Guardar en estado y localStorage
            setToken(data.token)
            setUser(data.user)
            localStorage.setItem(TOKEN_KEY, data.token)
            localStorage.setItem(USER_KEY, JSON.stringify(data.user))

            return { success: true }
        } catch (err) {
            setError(err.message)
            return { success: false, error: err.message }
        } finally {
            setLoading(false)
        }
    }

    const logout = async () => {
        try {
            if (token) {
                await fetch(`${API_BASE}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
            }
        } catch {
            // Ignorar errores en logout
        } finally {
            setToken(null)
            setUser(null)
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(USER_KEY)
        }
    }

    const changePassword = async (currentPassword, newPassword) => {
        try {
            const response = await fetch(`${API_BASE}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Error al cambiar contraseña')
            }

            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    }

    const value = {
        user,
        token,
        loading,
        error,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.rol === 'admin',
        login,
        logout,
        changePassword,
        clearError: () => setError(null)
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth debe usarse dentro de AuthProvider')
    }
    return context
}

// HOC para proteger componentes
export function withAuth(Component) {
    return function AuthenticatedComponent(props) {
        const { isAuthenticated, loading } = useAuth()

        if (loading) {
            return <div className="auth-loading">Cargando...</div>
        }

        if (!isAuthenticated) {
            return null
        }

        return <Component {...props} />
    }
}
