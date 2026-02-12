import { lazy, Suspense } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Waypoints,
    Package,
    ShoppingBag,
    ClipboardList,
    Factory,
    Briefcase,
    Brain,
    CalendarRange,
    BarChart3,
    LogOut,
    User,
    Users,
    Calculator
} from 'lucide-react'
import { useAuth } from './context/AuthContext'
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MateriasPrimas = lazy(() => import('./pages/MateriasPrimas'))
const Productos = lazy(() => import('./pages/Productos'))
const Formulacion = lazy(() => import('./pages/Formulacion'))
const ProduccionProgramada = lazy(() => import('./pages/ProduccionProgramada'))
const Proyecciones = lazy(() => import('./pages/Proyecciones'))
const ProyeccionMultiPeriodo = lazy(() => import('./pages/ProyeccionMultiPeriodo'))
const CostosIndirectos = lazy(() => import('./pages/CostosIndirectos'))
const HojaCostos = lazy(() => import('./pages/HojaCostos'))
const Escenarios = lazy(() => import('./pages/Escenarios'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const NotFound = lazy(() => import('./pages/NotFound'))
import './App.css'

// Componente de carga
function LoadingScreen() {
    return (
        <div className="loading-screen">
            <div className="loading-spinner"></div>
            <p>Cargando...</p>
        </div>
    )
}

// Aplicación principal (protegida)
function MainApp() {
    const { user, logout, isAdmin } = useAuth()

    const navItems = [
        // Vista general
        { path: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        // Configuración inicial
        { path: '/materias-primas', icon: <Package size={20} />, label: 'Materias Primas' },
        { path: '/productos', icon: <ShoppingBag size={20} />, label: 'Productos' },
        { path: '/formulacion', icon: <ClipboardList size={20} />, label: 'Formulación' },
        // Costos mensuales
        { path: '/costos-indirectos', icon: <Briefcase size={20} />, label: 'Costos Indirectos' },
        // Operación
        { path: '/produccion', icon: <Factory size={20} />, label: 'Producción' },
        { path: '/hoja-costos', icon: <Calculator size={20} />, label: 'Hoja de Costos' },
        { path: '/planificacion', icon: <CalendarRange size={20} />, label: 'Planificación' },
        // Análisis avanzado
        { path: '/proyecciones', icon: <Brain size={20} />, label: 'Proyecciones ML' },
        { path: '/escenarios', icon: <Waypoints size={20} />, label: 'Escenarios' },
    ]

    // Agregar opción de administración si es admin
    if (isAdmin) {
        navItems.push({
            path: '/usuarios',
            icon: <Users size={20} />,
            label: 'Usuarios',
            adminOnly: true
        })
    }

    const handleLogout = () => {
        logout()
    }

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <span className="logo-icon"><BarChart3 size={32} /></span>
                        <div className="logo-text">
                            <span className="logo-title">Costos</span>
                            <span className="logo-subtitle">Embutidos</span>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-item ${isActive ? 'active' : ''} ${item.adminOnly ? 'admin-item' : ''}`
                            }
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <User size={16} />
                        <div className="user-details">
                            <span className="user-name">{user?.nombre}</span>
                            <span className="user-role">{user?.rol}</span>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión">
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/planificacion" element={<ProyeccionMultiPeriodo />} />
                        <Route path="/escenarios" element={<Escenarios />} />
                        <Route path="/materias-primas" element={<MateriasPrimas />} />
                        <Route path="/productos" element={<Productos />} />
                        <Route path="/formulacion" element={<Formulacion />} />
                        <Route path="/produccion" element={<ProduccionProgramada />} />
                        <Route path="/costos-indirectos" element={<CostosIndirectos />} />
                        <Route path="/hoja-costos" element={<HojaCostos />} />
                        <Route path="/proyecciones" element={<Proyecciones />} />
                        {isAdmin && <Route path="/usuarios" element={<Usuarios />} />}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </main>
        </div>
    )
}

function App() {
    const { isAuthenticated, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return <LoadingScreen />
    }

    // Si está en la landing page, mostrarla siempre (sin importar autenticación)
    if (location.pathname === '/landing') {
        return (
            <Suspense fallback={<LoadingScreen />}>
                <Landing />
            </Suspense>
        )
    }

    // Si está en login, mostrar login
    if (location.pathname === '/login') {
        // Si ya está autenticado, redirigir al dashboard
        if (isAuthenticated) {
            return <MainApp />
        }
        return (
            <Suspense fallback={<LoadingScreen />}>
                <Login />
            </Suspense>
        )
    }

    // Para cualquier otra ruta, verificar autenticación
    if (!isAuthenticated) {
        // Si no está autenticado, mostrar landing por defecto
        return (
            <Suspense fallback={<LoadingScreen />}>
                <Landing />
            </Suspense>
        )
    }

    return <MainApp />
}

export default App
