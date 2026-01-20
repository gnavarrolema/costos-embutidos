import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BarChart3, LogIn, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import './Login.css'

function Login() {
    const { login, loading, error, clearError } = useAuth()
    const navigate = useNavigate()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [localError, setLocalError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLocalError('')
        clearError()

        if (!username.trim()) {
            setLocalError('Ingrese su nombre de usuario')
            return
        }

        if (!password) {
            setLocalError('Ingrese su contraseña')
            return
        }

        const result = await login(username.trim(), password)

        if (!result.success) {
            setLocalError(result.error)
        }
    }

    const displayError = localError || error

    return (
        <div className="login-page">
            {/* Fondo decorativo */}
            <div className="login-background">
                <div className="bg-gradient"></div>
                <div className="bg-pattern"></div>
            </div>

            <div className="login-container">
                {/* Panel izquierdo - Hero */}
                <div className="login-hero">
                    <div className="hero-content">
                        <div className="hero-logo animate-enter">
                            <BarChart3 size={48} />
                        </div>
                        <h1 className="hero-title animate-enter animate-delay-100">Costos Embutidos</h1>
                        <p className="hero-subtitle animate-enter animate-delay-200">
                            Sistema de Gestión de Costos de Producción
                        </p>
                        <div className="hero-features">
                            <div className="feature-item animate-enter animate-delay-300">
                                <span className="feature-check">✓</span>
                                <span>Control de materias primas</span>
                            </div>
                            <div className="feature-item animate-enter animate-delay-400">
                                <span className="feature-check">✓</span>
                                <span>Fórmulas y costeo de productos</span>
                            </div>
                            <div className="feature-item animate-enter animate-delay-500">
                                <span className="feature-check">✓</span>
                                <span>Proyecciones con Machine Learning</span>
                            </div>
                            <div className="feature-item animate-enter animate-delay-600">
                                <span className="feature-check">✓</span>
                                <span>Análisis de escenarios</span>
                            </div>
                        </div>
                    </div>
                    <div className="hero-footer animate-enter animate-delay-700">
                        <span>Sistema de uso interno</span>
                    </div>
                </div>

                {/* Panel derecho - Formulario */}
                <div className="login-form-panel">
                    <div className="form-container animate-enter-slide">
                        <div className="form-header animate-enter-slide animate-delay-500">
                            <h2>Iniciar Sesión</h2>
                            <p>Ingrese sus credenciales para continuar</p>
                        </div>

                        {displayError && (
                            <div className="login-error animate-shake">
                                <AlertCircle size={18} />
                                <span>{displayError}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="form-group animate-enter-slide animate-delay-600">
                                <label htmlFor="username">Usuario</label>
                                <input
                                    type="text"
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Ingrese su usuario"
                                    autoComplete="username"
                                    autoFocus
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group animate-enter-slide animate-delay-700">
                                <label htmlFor="password">Contraseña</label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Ingrese su contraseña"
                                        autoComplete="current-password"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="toggle-password"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="login-button animate-enter-slide animate-delay-800"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner"></span>
                                        Ingresando...
                                    </>
                                ) : (
                                    <>
                                        <LogIn size={18} />
                                        Ingresar
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="form-footer">
                            <p>¿Problemas para acceder? Contacte al administrador</p>
                            <button 
                                type="button" 
                                className="back-to-landing"
                                onClick={() => navigate('/landing')}
                            >
                                <ArrowLeft size={16} />
                                Volver al inicio
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Login
