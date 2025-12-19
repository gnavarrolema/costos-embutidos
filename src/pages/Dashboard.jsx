import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
    ShoppingBag,
    Package,
    Boxes,
    DollarSign,
    Calendar,
    RefreshCw,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Tag,
    Factory,
    Scale
} from 'lucide-react'
import {
    materiasPrimasApi,
    productosApi,
    produccionApi,
    formatCurrency
} from '../services/api'
import './Dashboard.css'

// Nombres de meses en español
const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function getCurrentMonth() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getMonthName(mesStr) {
    if (!mesStr) return ''
    const [year, month] = mesStr.split('-')
    return `${MESES[parseInt(month) - 1]} ${year}`
}

function getMonthOptions() {
    const options = []
    const now = new Date()
    for (let i = -2; i <= 9; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const label = `${MESES[date.getMonth()]} ${date.getFullYear()}`
        options.push({ value, label })
    }
    return options
}

function Dashboard() {
    const [mesSeleccionado, setMesSeleccionado] = useState(getCurrentMonth())
    const [stats, setStats] = useState({
        totalProductos: 0,
        totalMateriasPrimas: 0,
    })
    const [resumenMes, setResumenMes] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const monthOptions = useMemo(() => getMonthOptions(), [])

    useEffect(() => {
        loadBaseData()
    }, [])

    useEffect(() => {
        loadResumenMes()
    }, [mesSeleccionado])

    async function loadBaseData() {
        setLoading(true)
        setError(null)
        try {
            const [materiasPrimas, productos] = await Promise.all([
                materiasPrimasApi.getAll(),
                productosApi.getAll(),
            ])

            setStats({
                totalProductos: productos.length,
                totalMateriasPrimas: materiasPrimas.length,
            })

            await loadResumenMes()
        } catch (err) {
            console.error('Error loading base data:', err)
            setError('Error al cargar los datos. Verifica que el backend esté corriendo.')
        } finally {
            setLoading(false)
        }
    }

    async function loadResumenMes() {
        try {
            const resumen = await produccionApi.getResumenMensual(mesSeleccionado)
            setResumenMes(resumen)
        } catch (err) {
            console.error('Error loading resumen mensual:', err)
            setResumenMes(null)
        }
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando dashboard...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="error-container">
                <div className="error-icon"><AlertTriangle size={48} /></div>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={loadBaseData}>
                    Reintentar
                </button>
            </div>
        )
    }

    return (
        <div className="dashboard">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Resumen de producción y costos</p>
                </div>
                <button className="btn btn-secondary" onClick={loadBaseData}>
                    <RefreshCw size={16} className="mr-2" /> Actualizar
                </button>
            </header>

            {/* Selector de Mes */}
            <div className="month-card card">
                <div className="month-header">
                    <span className="month-icon-lg"><Calendar size={24} /></span>
                    <div className="month-selector">
                        <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => {
                                const idx = monthOptions.findIndex(o => o.value === mesSeleccionado)
                                if (idx > 0) setMesSeleccionado(monthOptions[idx - 1].value)
                            }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <select
                            className="month-select-lg"
                            value={mesSeleccionado}
                            onChange={(e) => setMesSeleccionado(e.target.value)}
                        >
                            {monthOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => {
                                const idx = monthOptions.findIndex(o => o.value === mesSeleccionado)
                                if (idx < monthOptions.length - 1) setMesSeleccionado(monthOptions[idx + 1].value)
                            }}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Generales */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon"><ShoppingBag size={24} /></div>
                    <div className="stat-content">
                        <span className="stat-label">Productos</span>
                        <span className="stat-value">{stats.totalProductos}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Package size={24} /></div>
                    <div className="stat-content">
                        <span className="stat-label">Materias Primas</span>
                        <span className="stat-value">{stats.totalMateriasPrimas}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Boxes size={24} /></div>
                    <div className="stat-content">
                        <span className="stat-label">Batches {getMonthName(mesSeleccionado)}</span>
                        <span className="stat-value">{resumenMes?.total_batches || 0}</span>
                    </div>
                </div>
                <div className="stat-card highlight">
                    <div className="stat-icon"><DollarSign size={24} /></div>
                    <div className="stat-content">
                        <span className="stat-label">Costo {getMonthName(mesSeleccionado)}</span>
                        <span className="stat-value">{formatCurrency(resumenMes?.costo_total || 0)}</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Resumen del mes */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Producción de {getMonthName(mesSeleccionado)}</h3>
                    </div>
                    {(!resumenMes || resumenMes.total_batches === 0) ? (
                        <div className="empty-mini">
                            <p>Sin producción programada para este mes</p>
                            <Link to="/produccion" className="btn btn-sm btn-primary">
                                Programar Producción
                            </Link>
                        </div>
                    ) : (
                        <div className="month-summary-content">
                            <div className="summary-stat">
                                <span className="summary-icon"><Scale size={32} /></span>
                                <div className="summary-text">
                                    <span className="summary-value">{resumenMes.total_peso?.toLocaleString('es-AR', { maximumFractionDigits: 2 })} Kg</span>
                                    <span className="summary-label">Peso Total</span>
                                </div>
                            </div>

                            {resumenMes.por_producto && resumenMes.por_producto.length > 0 && (
                                <div className="products-breakdown">
                                    <h4>Por Producto</h4>
                                    {resumenMes.por_producto.map(p => (
                                        <div key={p.producto.id} className="product-row">
                                            <span className="product-name">{p.producto.nombre}</span>
                                            <span className="product-batches">{p.batches?.toLocaleString('es-AR', { maximumFractionDigits: 2 })} batches</span>
                                            <span className="product-cost">{formatCurrency(p.costo)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Costos por categoría */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Costos por Categoría</h3>
                        <span className="card-subtitle">{getMonthName(mesSeleccionado)}</span>
                    </div>
                    {(!resumenMes?.totales_categoria || Object.keys(resumenMes.totales_categoria).length === 0) ? (
                        <div className="empty-mini">
                            <p>Sin datos de costos para este mes</p>
                        </div>
                    ) : (
                        <div className="category-chart">
                            {Object.entries(resumenMes.totales_categoria).map(([cat, costo]) => {
                                const total = resumenMes.costo_total || 1
                                const porcentaje = Math.round((costo / total) * 100)
                                return (
                                    <div key={cat} className="category-bar-container">
                                        <div className="category-bar-header">
                                            <span className={`badge badge-${cat.toLowerCase()}`}>
                                                {cat}
                                            </span>
                                            <span className="category-value">{formatCurrency(costo)}</span>
                                        </div>
                                        <div className="category-bar-track">
                                            <div
                                                className={`category-bar-fill ${cat.toLowerCase()}`}
                                                style={{ width: `${porcentaje}%` }}
                                            ></div>
                                        </div>
                                        <span className="category-percentage">{porcentaje}%</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Acciones rápidas */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Acciones Rápidas</h3>
                </div>
                <div className="quick-actions">
                    <Link to="/materias-primas" className="quick-action-btn">
                        <span className="quick-action-icon"><Package size={20} /></span>
                        <span>Nueva Materia Prima</span>
                    </Link>
                    <Link to="/productos" className="quick-action-btn">
                        <span className="quick-action-icon"><ShoppingBag size={20} /></span>
                        <span>Nuevo Producto</span>
                    </Link>
                    <Link to="/formulacion" className="quick-action-btn">
                        <span className="quick-action-icon"><ClipboardList size={20} /></span>
                        <span>Nueva Fórmula</span>
                    </Link>
                    <Link to="/produccion" className="quick-action-btn">
                        <span className="quick-action-icon"><Factory size={20} /></span>
                        <span>Programar Producción</span>
                    </Link>
                </div>
            </div>

        </div>
    )
}

export default Dashboard
