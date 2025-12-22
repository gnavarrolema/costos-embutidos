import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard,
    LineChart,
    Waypoints,
    Package,
    ShoppingBag,
    ClipboardList,
    Factory,
    Briefcase,
    FileText,
    Brain,
    CalendarRange,
    BarChart3,
    LogOut,
    User,
    Users,
    Settings,
    Calculator
} from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MateriasPrimas from './pages/MateriasPrimas'
import Productos from './pages/Productos'
import Formulacion from './pages/Formulacion'
import ProduccionProgramada from './pages/ProduccionProgramada'
import Proyecciones from './pages/Proyecciones'
import ProyeccionMultiPeriodo from './pages/ProyeccionMultiPeriodo'
import CostosIndirectos from './pages/CostosIndirectos'
import HojaCostos from './pages/HojaCostos'
import Escenarios from './pages/Escenarios'
import Usuarios from './pages/Usuarios'
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
        if (window.confirm('¿Está seguro que desea cerrar sesión?')) {
            logout()
        }
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
                    <button className="logout-btn" onClick={handleLogout} title="Cerrar sesión">
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>

            <main className="main-content">
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
                </Routes>
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
        return <Landing />
    }

    // Si está en login, mostrar login
    if (location.pathname === '/login') {
        // Si ya está autenticado, redirigir al dashboard
        if (isAuthenticated) {
            return <MainApp />
        }
        return <Login />
    }

    // Para cualquier otra ruta, verificar autenticación
    if (!isAuthenticated) {
        // Si no está autenticado, mostrar landing por defecto
        return <Landing />
    }

    return <MainApp />
}

export default App
