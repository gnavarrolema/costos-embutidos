import { useState, useEffect, useMemo } from 'react'
import {
    costosIndirectosApi,
    inflacionApi,
    produccionApi,
    formatCurrency,
    formatNumber
} from '../services/api'
import {
    Briefcase,
    TrendingUp,
    Plus,
    Calendar,
    HardHat,
    Factory,
    TrendingDown,
    DollarSign,
    Pencil,
    Trash2,
    RefreshCw,
    X,
    Lightbulb,
    CheckCircle,
    XCircle
} from 'lucide-react'
import './CostosIndirectos.css'

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const TIPOS_DISTRIBUCION = [
    { value: 'SP', label: 'Mano de Obra (SP)', description: 'Distribuye por minutos de M.O.' },
    { value: 'GIF', label: 'Gasto Indirecto (GIF)', description: 'Distribuye por Kg producidos' },
    { value: 'DEP', label: 'Depreciación (DEP)', description: 'Distribuye por Kg producidos' },
]

function getMonthName(mesStr) {
    if (!mesStr) return ''
    const [year, month] = mesStr.split('-')
    return `${MESES[parseInt(month) - 1]} ${year}`
}

function getPastMonthOptions() {
    // Meses pasados + mes actual + siguiente para registrar y planificar costos
    const options = []
    const now = new Date()
    for (let i = -24; i <= 1; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const label = `${MESES[date.getMonth()]} ${date.getFullYear()}`
        options.push({ value, label })
    }
    return options.reverse()
}

function getFutureMonthOptions() {
    // Meses futuros para proyectar inflación
    const options = []
    const now = new Date()
    for (let i = 1; i <= 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const label = `${MESES[date.getMonth()]} ${date.getFullYear()}`
        options.push({ value, label })
    }
    return options
}

function CostosIndirectos() {
    // Un solo mes: el período que estamos consultando/editando
    const [mesPeriodo, setMesPeriodo] = useState('2025-10')
    const [costos, setCostos] = useState([])
    const [resumen, setResumen] = useState(null)
    const [produccionMes, setProduccionMes] = useState(null)
    const [loading, setLoading] = useState(true)
    const [mensaje, setMensaje] = useState(null)

    // Form states
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [formData, setFormData] = useState({
        cuenta: '',
        descripcion: '',
        monto: '',
        tipo_distribucion: 'GIF'
    })

    // Inflación states
    const [showInflacionModal, setShowInflacionModal] = useState(false)
    const [inflaciones, setInflaciones] = useState([])
    const [inflacionConstante, setInflacionConstante] = useState('')

    const pastMonthOptions = useMemo(() => getPastMonthOptions(), [])
    const futureMonthOptions = useMemo(() => getFutureMonthOptions(), [])

    useEffect(() => {
        loadData()
    }, [mesPeriodo])

    async function loadData() {
        setLoading(true)
        try {
            const [costosData, inflacionesData, produccionData] = await Promise.all([
                costosIndirectosApi.getAll(mesPeriodo),
                inflacionApi.getAll(),
                produccionApi.getAll(mesPeriodo).catch(() => [])
            ])

            setCostos(costosData)
            setInflaciones(inflacionesData)
            setProduccionMes(produccionData)

            if (costosData.length > 0) {
                const resumenData = await costosIndirectosApi.getResumen(mesPeriodo)
                setResumen(resumenData)
            } else {
                setResumen(null)
            }
        } catch (err) {
            setMensaje({ type: 'error', text: `Error: ${err.message}` })
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        try {
            const data = {
                ...formData,
                monto: parseFloat(formData.monto),
                mes_base: mesPeriodo
            }

            if (editingId) {
                await costosIndirectosApi.update(editingId, data)
                setMensaje({ type: 'success', text: 'Costo actualizado' })
            } else {
                await costosIndirectosApi.create(data)
                setMensaje({ type: 'success', text: 'Costo creado' })
            }

            resetForm()
            await loadData()
        } catch (err) {
            setMensaje({ type: 'error', text: err.message })
        }
    }

    async function handleDelete(id) {
        if (!confirm('¿Eliminar este costo?')) return
        try {
            await costosIndirectosApi.delete(id)
            setMensaje({ type: 'success', text: 'Costo eliminado' })
            await loadData()
        } catch (err) {
            setMensaje({ type: 'error', text: err.message })
        }
    }

    function resetForm() {
        setFormData({ cuenta: '', descripcion: '', monto: '', tipo_distribucion: 'GIF' })
        setEditingId(null)
        setShowForm(false)
    }

    function editCosto(costo) {
        setFormData({
            cuenta: costo.cuenta,
            descripcion: costo.descripcion || '',
            monto: costo.monto.toString(),
            tipo_distribucion: costo.tipo_distribucion
        })
        setEditingId(costo.id)
        setShowForm(true)
    }

    // Funciones de inflación
    async function guardarInflacion(mes, porcentaje) {
        try {
            // Verificar si ya existe
            const existente = inflaciones.find(i => i.mes === mes)
            if (existente) {
                await inflacionApi.delete(existente.id)
            }
            await inflacionApi.create({ mes, porcentaje: parseFloat(porcentaje) })
            await loadData()
        } catch (err) {
            setMensaje({ type: 'error', text: err.message })
        }
    }

    async function eliminarInflacion(id) {
        try {
            await inflacionApi.delete(id)
            await loadData()
        } catch (err) {
            setMensaje({ type: 'error', text: err.message })
        }
    }

    async function aplicarInflacionConstante() {
        if (!inflacionConstante || parseFloat(inflacionConstante) === 0) return

        const pct = parseFloat(inflacionConstante)
        try {
            for (const mes of futureMonthOptions) {
                await guardarInflacion(mes.value, pct)
            }
            setMensaje({ type: 'success', text: `Inflación de ${pct}% aplicada a todos los meses` })
            setInflacionConstante('')
        } catch (err) {
            setMensaje({ type: 'error', text: err.message })
        }
    }

    // Calcular totales del período
    const totalesPeriodo = useMemo(() => {
        if (!produccionMes || produccionMes.length === 0) return null

        const totalKg = produccionMes.reduce((sum, p) => sum + (p.kg_producidos || 0), 0)
        const totalMinutos = produccionMes.reduce((sum, p) => {
            const minPorKg = p.producto?.min_mo_kg || 0
            return sum + ((p.kg_producidos || 0) * minPorKg)
        }, 0)

        return { totalKg, totalMinutos }
    }, [produccionMes])

    // Distribución por producto
    const distribucionProductos = useMemo(() => {
        if (!resumen || !produccionMes || produccionMes.length === 0 || !totalesPeriodo) return []

        return produccionMes.map(prod => {
            const kg = prod.kg_producidos || 0
            const minutos = kg * (prod.producto?.min_mo_kg || 0)

            const pctKg = totalesPeriodo.totalKg > 0 ? (kg / totalesPeriodo.totalKg) : 0
            const pctMO = totalesPeriodo.totalMinutos > 0 ? (minutos / totalesPeriodo.totalMinutos) : 0

            // SP se distribuye por minutos, GIF y DEP por Kg
            const costoSP = (resumen.por_tipo?.SP || 0) * pctMO
            const costoGIF = (resumen.por_tipo?.GIF || 0) * pctKg
            const costoDEP = (resumen.por_tipo?.DEP || 0) * pctKg
            const costoTotal = costoSP + costoGIF + costoDEP
            const costoPorKg = kg > 0 ? costoTotal / kg : 0

            return {
                producto: prod.producto,
                kg,
                pctKg: (pctKg * 100).toFixed(1),
                pctMO: (pctMO * 100).toFixed(1),
                costoTotal,
                costoPorKg
            }
        }).filter(d => d.kg > 0)
    }, [resumen, produccionMes, totalesPeriodo])

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando costos indirectos...</p>
            </div>
        )
    }

    return (
        <div className="page-costos-indirectos">
            <header className="page-header">
                <div>
                    <h1 className="page-title d-flex align-items-center gap-2">
                        <Briefcase size={32} /> Costos Indirectos
                    </h1>
                    <p className="page-subtitle">Gastos de conversión y distribución por período cerrado</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary d-flex align-items-center gap-2" onClick={() => setShowInflacionModal(true)}>
                        <TrendingUp size={18} /> Inflación Proyectada
                    </button>
                    <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm(true)}>
                        <Plus size={18} /> Agregar Costo
                    </button>
                </div>
            </header>

            {mensaje && (
                <div className={`alert alert-${mensaje.type} d-flex align-items-center gap-2`}>
                    {mensaje.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                    {mensaje.text}
                    <button className="alert-close ml-auto" onClick={() => setMensaje(null)}><X size={16} /></button>
                </div>
            )}

            {/* Selector de Período - SIMPLIFICADO */}
            <div className="card periodo-card">
                <div className="periodo-selector">
                    <label className="d-flex align-items-center gap-2"><Calendar size={20} /> Período Cerrado</label>
                    <select value={mesPeriodo} onChange={(e) => setMesPeriodo(e.target.value)}>
                        {pastMonthOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    <p className="periodo-help">
                        Seleccione el mes contable cerrado para ver/editar sus costos indirectos
                        y cómo se distribuyeron sobre la producción de ese mismo mes.
                    </p>
                </div>
            </div>

            {/* Resumen de Costos del Período */}
            {/* Resumen de Costos del Período */}
            {resumen && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon">
                            <HardHat size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Mano de Obra (SP)</span>
                            <span className="stat-value">{formatCurrency(resumen.por_tipo?.SP || 0)}</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">
                            <Factory size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Gastos Indirectos (GIF)</span>
                            <span className="stat-value">{formatCurrency(resumen.por_tipo?.GIF || 0)}</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">
                            <TrendingDown size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Depreciación (DEP)</span>
                            <span className="stat-value">{formatCurrency(resumen.por_tipo?.DEP || 0)}</span>
                        </div>
                    </div>
                    <div className="stat-card highlight">
                        <div className="stat-icon">
                            <DollarSign size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Total Indirectos</span>
                            <span className="stat-value">{formatCurrency(resumen.total)}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="two-columns">
                {/* Lista de Costos */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Costos de {getMonthName(mesPeriodo)}</h3>
                        <span className="card-badge">{costos.length} cuentas</span>
                    </div>

                    {costos.length === 0 ? (
                        <div className="empty-state">
                            <p>No hay costos cargados para este mes</p>
                            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                                Agregar primer costo
                            </button>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table table-compact">
                                <thead>
                                    <tr>
                                        <th>Cuenta</th>
                                        <th>Tipo</th>
                                        <th className="text-right">Monto</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {costos.map(c => (
                                        <tr key={c.id}>
                                            <td>
                                                <strong>{c.cuenta}</strong>
                                                {c.descripcion && <div className="text-muted text-sm">{c.descripcion}</div>}
                                            </td>
                                            <td>
                                                <span className={`tipo-badge tipo-${c.tipo_distribucion.toLowerCase()}`}>
                                                    {c.tipo_distribucion}
                                                </span>
                                            </td>
                                            <td className="table-number">{formatCurrency(c.monto)}</td>
                                            <td className="table-actions">
                                                <button className="btn-icon-sm" onClick={() => editCosto(c)}><Pencil size={16} /></button>
                                                <button className="btn-icon-sm" onClick={() => handleDelete(c.id)}><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Distribución del mismo período */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Distribución {getMonthName(mesPeriodo)}</h3>
                    </div>

                    {distribucionProductos.length === 0 ? (
                        <div className="empty-state">
                            <p>Sin producción registrada para {getMonthName(mesPeriodo)}</p>
                            <small>Cargue producción en la sección "Producción" para ver la distribución</small>
                        </div>
                    ) : (
                        <>
                            <div className="totales-grid">
                                <div className="total-item">
                                    <span className="total-label">Total Kg</span>
                                    <span className="total-value">{formatNumber(totalesPeriodo?.totalKg, 0)}</span>
                                </div>
                                <div className="total-item">
                                    <span className="total-label">Total Minutos</span>
                                    <span className="total-value">{formatNumber(totalesPeriodo?.totalMinutos, 0)}</span>
                                </div>
                                <div className="total-item highlight">
                                    <span className="total-label">$/Kg Promedio</span>
                                    <span className="total-value">
                                        {formatCurrency(totalesPeriodo?.totalKg > 0 ? resumen?.total / totalesPeriodo.totalKg : 0)}
                                    </span>
                                </div>
                            </div>

                            <div className="table-container">
                                <table className="table table-compact">
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th className="text-right">%M.O.</th>
                                            <th className="text-right">%Kg</th>
                                            <th className="text-right">$/Kg</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {distribucionProductos.map(d => (
                                            <tr key={d.producto?.id}>
                                                <td>
                                                    <strong>{d.producto?.nombre}</strong>
                                                    <div className="text-muted text-sm">{formatNumber(d.kg, 0)} Kg</div>
                                                </td>
                                                <td className="table-number">{d.pctMO}%</td>
                                                <td className="table-number">{d.pctKg}%</td>
                                                <td className="table-number cost-highlight">
                                                    {formatCurrency(d.costoPorKg)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modal Agregar/Editar Costo */}
            {showForm && (
                <div className="modal-overlay" onClick={() => resetForm()}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingId ? 'Editar Costo' : 'Nuevo Costo Indirecto'}</h3>
                            <button className="modal-close" onClick={() => resetForm()}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Cuenta / Concepto *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.cuenta}
                                        onChange={e => setFormData({ ...formData, cuenta: e.target.value })}
                                        placeholder="Ej: SUELDOS Y JORNALES"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descripción</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.descripcion}
                                        onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                        placeholder="Descripción opcional"
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Monto *</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            step="0.01"
                                            value={formData.monto}
                                            onChange={e => setFormData({ ...formData, monto: e.target.value })}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tipo de Distribución *</label>
                                        <select
                                            className="form-input"
                                            value={formData.tipo_distribucion}
                                            onChange={e => setFormData({ ...formData, tipo_distribucion: e.target.value })}
                                        >
                                            {TIPOS_DISTRIBUCION.map(t => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="tipo-info d-flex align-items-center gap-2">
                                    <Lightbulb size={16} /> {TIPOS_DISTRIBUCION.find(t => t.value === formData.tipo_distribucion)?.description}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => resetForm()}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingId ? 'Guardar Cambios' : 'Agregar Costo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Inflación Proyectada - REDISEÑADO */}
            {showInflacionModal && (
                <div className="modal-overlay" onClick={() => setShowInflacionModal(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title d-flex align-items-center gap-2"><TrendingUp size={24} /> Inflación Proyectada</h3>
                            <button className="modal-close" onClick={() => setShowInflacionModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="inflacion-intro">
                                <p>
                                    Configure la inflación mensual proyectada para ajustar los costos en la planificación futura.
                                    Estos valores se aplicarán sobre los costos del último período cerrado.
                                </p>
                            </div>

                            {/* Aplicar valor constante */}
                            <div className="inflacion-constante">
                                <h4 className="d-flex align-items-center gap-2"><RefreshCw size={18} /> Aplicar inflación constante</h4>
                                <div className="constante-row">
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="form-input"
                                        placeholder="Ej: 3.0"
                                        value={inflacionConstante}
                                        onChange={e => setInflacionConstante(e.target.value)}
                                    />
                                    <span>% mensual</span>
                                    <button
                                        className="btn btn-primary"
                                        onClick={aplicarInflacionConstante}
                                        disabled={!inflacionConstante}
                                    >
                                        Aplicar a todos los meses
                                    </button>
                                </div>
                            </div>

                            {/* Tabla de inflación por mes */}
                            <div className="inflacion-tabla">
                                <h4 className="d-flex align-items-center gap-2"><Calendar size={18} /> Inflación por mes</h4>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Mes</th>
                                            <th className="text-center">Inflación (%)</th>
                                            <th className="text-center">Acumulada</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {futureMonthOptions.map((mes, idx) => {
                                            const inflacionMes = inflaciones.find(i => i.mes === mes.value)
                                            const pct = inflacionMes?.porcentaje || 0

                                            // Calcular acumulada
                                            let acumulada = 1
                                            for (let i = 0; i <= idx; i++) {
                                                const m = futureMonthOptions[i]
                                                const inf = inflaciones.find(x => x.mes === m.value)
                                                acumulada *= (1 + (inf?.porcentaje || 0) / 100)
                                            }
                                            const pctAcumulada = ((acumulada - 1) * 100).toFixed(1)

                                            return (
                                                <tr key={mes.value}>
                                                    <td><strong>{mes.label}</strong></td>
                                                    <td className="text-center">
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            className="input-inflacion"
                                                            value={pct || ''}
                                                            placeholder="0"
                                                            onChange={e => {
                                                                const val = e.target.value
                                                                if (val) {
                                                                    guardarInflacion(mes.value, val)
                                                                }
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`acumulada ${parseFloat(pctAcumulada) > 0 ? 'positive' : ''}`}>
                                                            +{pctAcumulada}%
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {inflacionMes && (
                                                            <button
                                                                className="btn-icon-sm"
                                                                onClick={() => eliminarInflacion(inflacionMes.id)}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={() => setShowInflacionModal(false)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CostosIndirectos
