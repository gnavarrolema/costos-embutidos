import { useState, useEffect } from 'react'
import {
    FileText,
    Brain,
    AlertTriangle,
    BarChart3,
    X,
    Shuffle,
    Loader2,
    Sparkles,
    Package,
    DollarSign,
    Calculator,
    Calendar,
    Hash,
    ChevronRight,
    TrendingUp,
    ChevronDown
} from 'lucide-react'
import { proyeccionApi, costosIndirectosApi, formatCurrency, formatNumber } from '../services/api'
import './ProyeccionMultiPeriodo.css'

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function getCurrentMonth() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getNextMonths(n) {
    const now = new Date()
    const futureDate = new Date(now.getFullYear(), now.getMonth() + n, 1)
    return `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`
}

function getMonthOptions() {
    // Genera opciones de meses: 6 meses atrás hasta 12 meses adelante
    const options = []
    const now = new Date()
    for (let i = -6; i <= 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const label = `${MESES[date.getMonth()]} ${date.getFullYear()}`
        options.push({ value, label })
    }
    return options
}

function ProyeccionMultiPeriodo() {
    const [mesInicio, setMesInicio] = useState(getCurrentMonth())
    const [mesFin, setMesFin] = useState(getNextMonths(3))
    const [mesBase, setMesBase] = useState('')  // Se inicializará con el primer mes disponible
    const [modo, setModo] = useState('mixto')
    const [proyeccion, setProyeccion] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [mesesBaseDisponibles, setMesesBaseDisponibles] = useState([])
    const [expandedMonths, setExpandedMonths] = useState({})

    useEffect(() => {
        loadMesesBase()
    }, [])

    async function loadMesesBase() {
        try {
            const data = await costosIndirectosApi.getAll()

            // Extraer meses únicos
            const mesesSet = new Set(data.map(c => c.mes_base))
            const mesesArray = Array.from(mesesSet).sort().reverse()
            setMesesBaseDisponibles(mesesArray)

            if (mesesArray.length > 0 && mesBase === '') {
                setMesBase(mesesArray[0])
            }
        } catch (err) {
            console.error('Error cargando meses base:', err)
        }
    }

    async function handleGenerar() {
        if (!mesBase) {
            setError('Debe seleccionar un mes base con costos indirectos configurados')
            return
        }

        setLoading(true)
        setError(null)
        setProyeccion(null)

        try {
            const result = await proyeccionApi.generarMultiPeriodo(mesInicio, mesFin, mesBase, modo)
            setProyeccion(result)

            // Expandir solo los meses que tienen productos
            const expanded = {}
            result.meses.forEach(m => {
                expanded[m.mes] = m.productos && m.productos.length > 0
            })
            setExpandedMonths(expanded)
        } catch (err) {
            setError(err.message || 'Error generando proyección')
        } finally {
            setLoading(false)
        }
    }

    function toggleMonth(mes) {
        setExpandedMonths(prev => ({
            ...prev,
            [mes]: !prev[mes]
        }))
    }

    function getMesLabel(mesStr) {
        const [año, mes] = mesStr.split('-')
        return `${MESES[parseInt(mes) - 1]} ${año}`
    }

    function getFuenteBadge(fuente) {
        const badges = {
            'manual': { icon: <FileText size={14} />, label: 'Manual', class: 'badge-manual' },
            'ml': { icon: <Brain size={14} />, label: 'ML', class: 'badge-ml' },
            'sin_datos': { icon: <AlertTriangle size={14} />, label: 'Sin Datos', class: 'badge-warning' }
        }
        const badge = badges[fuente] || badges.sin_datos
        return (
            <span className={`fuente-badge ${badge.class}`}>
                {badge.icon} {badge.label}
            </span>
        )
    }

    return (
        <div className="page-proyeccion-multiperiodo">
            <header className="page-header">
                <div>
                    <h1 className="page-title"><BarChart3 className="mr-2 inline-block" /> Planificación de Producción</h1>
                    <p className="page-subtitle">Planificación consolidada de 1-12 meses con costos completos</p>
                </div>
            </header>

            {error && (
                <div className="alert alert-error">
                    <AlertTriangle size={20} /> {error}
                    <button className="alert-close" onClick={() => setError(null)}><X size={16} /></button>
                </div>
            )}

            {/* Configuración */}
            <div className="card config-card">
                <div className="card-header">
                    <h3 className="card-title">Configuración de Proyección</h3>
                </div>
                <div className="config-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>Mes Inicio</label>
                            <select
                                value={mesInicio}
                                onChange={(e) => setMesInicio(e.target.value)}
                                className="form-control"
                            >
                                {getMonthOptions().map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Mes Fin</label>
                            <select
                                value={mesFin}
                                onChange={(e) => setMesFin(e.target.value)}
                                className="form-control"
                            >
                                {getMonthOptions().map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Mes Base (Costos Indirectos)</label>
                            <select
                                value={mesBase}
                                onChange={(e) => setMesBase(e.target.value)}
                                className="form-control"
                            >
                                <option value="">Seleccione...</option>
                                {mesesBaseDisponibles.map(m => (
                                    <option key={m} value={m}>{getMesLabel(m)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Fuente de Datos</label>
                        <div className="modo-selector">
                            <label className={`modo-option ${modo === 'mixto' ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    value="mixto"
                                    checked={modo === 'mixto'}
                                    onChange={(e) => setModo(e.target.value)}
                                />
                                <div className="modo-content">
                                    <strong><Shuffle size={16} className="inline-block mr-1" /> Mixto (Recomendado)</strong>
                                    <span className="modo-desc">Usa producción manual si existe, ML si está vacío</span>
                                </div>
                            </label>
                            <label className={`modo-option ${modo === 'manual' ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    value="manual"
                                    checked={modo === 'manual'}
                                    onChange={(e) => setModo(e.target.value)}
                                />
                                <div className="modo-content">
                                    <strong><FileText size={16} className="inline-block mr-1" /> Solo Manual</strong>
                                    <span className="modo-desc">Solo meses con producción programada</span>
                                </div>
                            </label>
                            <label className={`modo-option ${modo === 'ml' ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    value="ml"
                                    checked={modo === 'ml'}
                                    onChange={(e) => setModo(e.target.value)}
                                />
                                <div className="modo-content">
                                    <strong><Brain size={16} className="inline-block mr-1" /> Solo ML</strong>
                                    <span className="modo-desc">Forzar predicciones ML para todos los meses</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <button
                        className="btn btn-primary btn-lg btn-generar"
                        onClick={handleGenerar}
                        disabled={loading || !mesBase}
                    >
                        {loading ? <><Loader2 className="animate-spin mr-2" /> Generando...</> : <><Sparkles className="mr-2" /> Generar Proyección</>}
                    </button>
                </div>
            </div>

            {/* Resultados */}
            {proyeccion && (
                <>
                    {/* Resumen General */}
                    <div className="card resumen-card">
                        <div className="card-header">
                            <h3 className="card-title">
                                Resumen del Período: {getMesLabel(mesInicio)} - {getMesLabel(mesFin)}
                            </h3>
                        </div>
                        <div className="resumen-grid">
                            <div className="resumen-item">
                                <span className="resumen-icon"><Package size={20} /></span>
                                <div>
                                    <span className="resumen-label">Total Producción</span>
                                    <span className="resumen-value">{formatNumber(proyeccion.resumen.total_kg_periodo, 0)} kg</span>
                                </div>
                            </div>
                            <div className="resumen-item">
                                <span className="resumen-icon"><DollarSign size={20} /></span>
                                <div>
                                    <span className="resumen-label">Costo Total Período</span>
                                    <span className="resumen-value">{formatCurrency(proyeccion.resumen.costo_total_periodo)}</span>
                                </div>
                            </div>
                            <div className="resumen-item">
                                <span className="resumen-icon"><Calculator size={20} /></span>
                                <div>
                                    <span className="resumen-label">Costo Promedio/Kg</span>
                                    <span className="resumen-value">{formatCurrency(proyeccion.resumen.costo_promedio_kg)}</span>
                                </div>
                            </div>
                            <div className="resumen-item">
                                <span className="resumen-icon"><Calendar size={20} /></span>
                                <div>
                                    <span className="resumen-label">Costo Promedio/Mes</span>
                                    <span className="resumen-value">{formatCurrency(proyeccion.resumen.costo_promedio_mes)}</span>
                                </div>
                            </div>
                            <div className="resumen-item">
                                <span className="resumen-icon"><Hash size={20} /></span>
                                <div>
                                    <span className="resumen-label">Meses Proyectados</span>
                                    <span className="resumen-value">{proyeccion.resumen.num_meses}</span>
                                </div>
                            </div>
                            <div className="resumen-item">
                                <span className="resumen-icon"><FileText size={20} /></span>
                                <div>
                                    <span className="resumen-label">Meses Manuales</span>
                                    <span className="resumen-value">{proyeccion.resumen.meses_manuales}</span>
                                </div>
                            </div>
                            <div className="resumen-item">
                                <span className="resumen-icon"><Brain size={20} /></span>
                                <div>
                                    <span className="resumen-label">Meses ML</span>
                                    <span className="resumen-value">{proyeccion.resumen.meses_ml}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detalle por Mes */}
                    {proyeccion.meses.map((mes) => (
                        <div key={mes.mes} className="card mes-card">
                            <div className="mes-header" onClick={() => toggleMonth(mes.mes)}>
                                <div className="mes-title-row">
                                    <h3 className="mes-title">
                                        <span className={`expand-icon ${expandedMonths[mes.mes] ? 'expanded' : ''}`}>
                                            {expandedMonths[mes.mes] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                        </span>
                                        {getMesLabel(mes.mes)}
                                    </h3>
                                    {getFuenteBadge(mes.fuente)}
                                    {mes.inflacion_acumulada_pct > 0 && (
                                        <span className="inflacion-badge">
                                            <TrendingUp size={14} className="mr-1" /> +{mes.inflacion_acumulada_pct}%
                                        </span>
                                    )}
                                    {mes.productos_sin_formula > 0 && (
                                        <span className="warning-badge" title="Productos sin fórmula definida">
                                            <AlertTriangle size={14} className="mr-1" /> {mes.productos_sin_formula} sin fórmula
                                        </span>
                                    )}
                                </div>
                                <div className="mes-summary">
                                    <span>{formatNumber(mes.total_kg, 0)} kg</span>
                                    <span className="separator">•</span>
                                    <span>{formatCurrency(mes.costo_total)}</span>
                                </div>
                            </div>

                            {expandedMonths[mes.mes] && mes.productos.length > 0 && (
                                <div className="mes-content">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th className="text-right">Kg</th>
                                                <th className="text-right">MP/Kg</th>
                                                <th className="text-right">Ind/Kg</th>
                                                <th className="text-right">Total/Kg</th>
                                                <th className="text-right">Costo Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {mes.productos.map((p) => (
                                                <tr key={p.producto_id} className={p.sin_formula ? 'row-warning' : ''}>
                                                    <td>
                                                        <strong>{p.nombre}</strong>
                                                        {p.sin_formula && <span className="sin-formula-tag"><AlertTriangle size={12} className="mr-1" /> Sin fórmula</span>}
                                                        <div className="text-muted font-mono">{p.codigo}</div>
                                                    </td>
                                                    <td className="table-number">{formatNumber(p.kg, 2)}</td>
                                                    <td className="table-number">{formatCurrency(p.mp_por_kg)}</td>
                                                    <td className="table-number">{formatCurrency(p.ind_por_kg)}</td>
                                                    <td className="table-number">
                                                        <strong>{formatCurrency(p.total_por_kg)}</strong>
                                                    </td>
                                                    <td className="table-number">
                                                        <strong>{formatCurrency(p.costo_total)}</strong>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {expandedMonths[mes.mes] && mes.productos.length === 0 && (<div className="mes-content empty-state">
                                <p><AlertTriangle size={20} className="mr-2 inline-block" /> No hay datos disponibles para este mes</p>
                            </div>
                            )}
                        </div>
                    ))}
                </>
            )}
        </div>
    )
}

export default ProyeccionMultiPeriodo
