import { useState, useEffect, useMemo } from 'react'
import { Waypoints } from 'lucide-react'
import {
    productosApi,
    costeoApi,
    costosIndirectosApi,
    inflacionApi,
    materiasPrimasApi,
    formatCurrency,
    formatNumber,
    getCategoryClass
} from '../services/api'
import './Escenarios.css'

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const TIPOS_ESCENARIO = [
    { id: 'inflacion', icon: '📈', label: 'Inflación diferente', desc: 'Cambiar tasa de inflación' },
    { id: 'materia_prima', icon: '🥩', label: 'Precio de MP', desc: 'Ajustar precio de materia prima' },
    { id: 'categoria', icon: '📦', label: 'Categoría completa', desc: 'Ajustar toda una categoría' },
    { id: 'indirectos', icon: '🏭', label: 'Costos indirectos', desc: 'Modificar SP, GIF o DEP' },
    { id: 'produccion', icon: '📉', label: 'Volumen producción', desc: 'Cambiar cantidad a producir' },
]

function getMonthName(mesStr) {
    if (!mesStr) return ''
    const [year, month] = mesStr.split('-')
    return `${MESES[parseInt(month) - 1]} ${year}`
}

function getFutureMonthOptions() {
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

function getMonthsBetween(mesBase, mesTarget) {
    if (!mesBase || !mesTarget) return []
    const [yearBase, monthBase] = mesBase.split('-').map(Number)
    const [yearTarget, monthTarget] = mesTarget.split('-').map(Number)

    const meses = []
    let current = new Date(yearBase, monthBase - 1, 1)
    const target = new Date(yearTarget, monthTarget - 1, 1)

    while (current < target) {
        current.setMonth(current.getMonth() + 1)
        if (current <= target) {
            const mes = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
            meses.push(mes)
        }
    }
    return meses
}

function Escenarios() {
    // Datos base
    const [mesProduccion, setMesProduccion] = useState('')
    const [mesBaseCostos, setMesBaseCostos] = useState(null)
    const [productos, setProductos] = useState([])
    const [materiasPrimas, setMateriasPrimas] = useState([])
    const [costeoProductos, setCosteoProductos] = useState({})
    const [costosIndirectosBase, setCostosIndirectosBase] = useState(null)
    const [inflacionesBase, setInflacionesBase] = useState([])
    const [mesesConCostos, setMesesConCostos] = useState([])

    // Planificación base
    const [planificacionBase, setPlanificacionBase] = useState([])

    // Escenarios
    const [escenarios, setEscenarios] = useState([])
    const [showCrearModal, setShowCrearModal] = useState(false)
    const [nuevoEscenario, setNuevoEscenario] = useState({
        nombre: '',
        tipo: 'inflacion',
        config: {}
    })

    // UI
    const [loading, setLoading] = useState(true)
    const [mensaje, setMensaje] = useState(null)

    const futureMonthOptions = useMemo(() => getFutureMonthOptions(), [])
    const categorias = useMemo(() => {
        return [...new Set(materiasPrimas.map(mp => mp.categoria))].filter(Boolean)
    }, [materiasPrimas])

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        // Establecer mes de producción por defecto si no está configurado
        if (!mesProduccion && futureMonthOptions.length > 0) {
            setMesProduccion(futureMonthOptions[0].value)
        }
    }, [futureMonthOptions, mesProduccion])

    async function loadInitialData() {
        setLoading(true)
        try {
            const [productosData, costosData, inflacionesData, mpData] = await Promise.all([
                productosApi.getAll(),
                costosIndirectosApi.getAll(),
                inflacionApi.getAll().catch(() => []),
                materiasPrimasApi.getAll()
            ])

            setProductos(productosData)
            setInflacionesBase(inflacionesData)
            setMateriasPrimas(mpData)

            // Detectar meses con costos
            const meses = [...new Set(costosData.map(c => c.mes_base))].sort()
            setMesesConCostos(meses)

            if (meses.length > 0) {
                const ultimoMes = meses[meses.length - 1]
                setMesBaseCostos(ultimoMes)

                // Cargar resumen de costos indirectos
                const resumen = await costosIndirectosApi.getResumen(ultimoMes)
                setCostosIndirectosBase(resumen)
            }

            // Cargar costeo de cada producto
            const costeos = {}
            await Promise.all(
                productosData.map(async (p) => {
                    try {
                        const costeo = await costeoApi.getByProducto(p.id)
                        costeos[p.id] = costeo
                    } catch {
                        costeos[p.id] = null
                    }
                })
            )
            setCosteoProductos(costeos)

            // Mes de producción por defecto
            if (getFutureMonthOptions().length > 0) {
                setMesProduccion(getFutureMonthOptions()[0].value)
            }

            // Crear planificación base con todos los productos (ejemplo)
            const planBase = productosData.slice(0, 5).map(p => ({
                producto_id: p.id,
                kg: 1000,
                batches: Math.ceil(1000 / p.peso_batch_kg)
            }))
            setPlanificacionBase(planBase)

        } catch (err) {
            setMensaje({ type: 'error', text: `Error: ${err.message}` })
        } finally {
            setLoading(false)
        }
    }

    // Calcular factor de inflación
    function calcularFactorInflacion(inflacionPct = null) {
        if (!mesBaseCostos || !mesProduccion) return 1

        const mesesEntre = getMonthsBetween(mesBaseCostos, mesProduccion)
        let factor = 1

        if (inflacionPct !== null) {
            // Usar inflación fija para escenario
            mesesEntre.forEach(() => {
                factor *= (1 + inflacionPct / 100)
            })
        } else {
            // Usar inflación base
            mesesEntre.forEach(mes => {
                const inf = inflacionesBase.find(i => i.mes === mes)
                if (inf) {
                    factor *= (1 + inf.porcentaje / 100)
                }
            })
        }

        return factor
    }

    // Calcular costos de un escenario
    function calcularEscenario(escenario = null) {
        let factorInflacion = calcularFactorInflacion(escenario?.tipo === 'inflacion' ? escenario.config.porcentaje : null)
        let ajusteMP = {} // producto_id -> factor
        let ajusteCategoria = {} // categoria -> factor
        let ajusteIndirectos = 1
        let ajusteProduccion = 1

        if (escenario) {
            switch (escenario.tipo) {
                case 'materia_prima':
                    ajusteMP[escenario.config.materia_prima_id] = 1 + (escenario.config.porcentaje / 100)
                    break
                case 'categoria':
                    ajusteCategoria[escenario.config.categoria] = 1 + (escenario.config.porcentaje / 100)
                    break
                case 'indirectos':
                    ajusteIndirectos = 1 + (escenario.config.porcentaje / 100)
                    break
                case 'produccion':
                    ajusteProduccion = 1 + (escenario.config.porcentaje / 100)
                    break
            }
        }

        let costoVariableTotal = 0
        let costoIndirectoTotal = 0
        let totalKg = 0
        let totalMinutos = 0

        // Calcular costos variables y totales de kg/minutos
        planificacionBase.forEach(plan => {
            const producto = productos.find(p => p.id === plan.producto_id)
            const costeo = costeoProductos[plan.producto_id]

            if (!producto || !costeo) return

            const kgAjustados = plan.kg * ajusteProduccion
            const batchesAjustados = Math.ceil(kgAjustados / producto.peso_batch_kg)
            const minutosProducto = kgAjustados * (producto.min_mo_kg || 0)

            totalKg += kgAjustados
            totalMinutos += minutosProducto

            // Calcular costo variable con ajustes
            let costoProducto = 0
            costeo.ingredientes?.forEach(ing => {
                let costoIng = ing.costo_total * batchesAjustados * factorInflacion

                // Aplicar ajuste de MP específica
                if (ajusteMP[ing.materia_prima_id]) {
                    costoIng *= ajusteMP[ing.materia_prima_id]
                }

                // Aplicar ajuste de categoría
                if (ajusteCategoria[ing.categoria]) {
                    costoIng *= ajusteCategoria[ing.categoria]
                }

                costoProducto += costoIng
            })

            costoVariableTotal += costoProducto
        })

        // Calcular costos indirectos con distribución correcta
        if (costosIndirectosBase && totalKg > 0) {
            // Separar costos por tipo
            const totalSP = (costosIndirectosBase.por_tipo?.SP || 0) * factorInflacion * ajusteIndirectos
            const totalGIF = (costosIndirectosBase.por_tipo?.GIF || 0) * factorInflacion * ajusteIndirectos
            const totalDEP = (costosIndirectosBase.por_tipo?.DEP || 0) * factorInflacion * ajusteIndirectos

            // Distribuir SP por minutos de M.O.
            // Distribuir GIF y DEP por kg producidos
            // (En el contexto de escenarios, asumimos que estos costos se distribuyen 100% 
            // sobre la planificación base, ya que no tenemos datos de otros productos del mes)

            costoIndirectoTotal = totalSP + totalGIF + totalDEP
        }

        const costoTotal = costoVariableTotal + costoIndirectoTotal
        const costoPorKg = totalKg > 0 ? costoTotal / totalKg : 0

        return {
            totalKg,
            totalMinutos,
            costoVariableTotal,
            costoIndirectoTotal,
            costoTotal,
            costoPorKg,
            factorInflacion,
            // Desglose de indirectos
            costoSP: costosIndirectosBase ? (costosIndirectosBase.por_tipo?.SP || 0) * factorInflacion * ajusteIndirectos : 0,
            costoGIF: costosIndirectosBase ? (costosIndirectosBase.por_tipo?.GIF || 0) * factorInflacion * ajusteIndirectos : 0,
            costoDEP: costosIndirectosBase ? (costosIndirectosBase.por_tipo?.DEP || 0) * factorInflacion * ajusteIndirectos : 0
        }
    }

    // Resultados base y escenarios
    const resultadoBase = useMemo(() => calcularEscenario(null), [
        planificacionBase, productos, costeoProductos, costosIndirectosBase,
        mesBaseCostos, mesProduccion, inflacionesBase
    ])

    const resultadosEscenarios = useMemo(() => {
        return escenarios.map(esc => ({
            ...esc,
            resultado: calcularEscenario(esc)
        }))
    }, [escenarios, planificacionBase, productos, costeoProductos, costosIndirectosBase,
        mesBaseCostos, mesProduccion, inflacionesBase])

    function agregarEscenario() {
        if (!nuevoEscenario.nombre) {
            setMensaje({ type: 'error', text: 'Ingrese un nombre para el escenario' })
            return
        }

        const escenario = {
            id: Date.now(),
            ...nuevoEscenario
        }

        setEscenarios(prev => [...prev, escenario])
        setShowCrearModal(false)
        setNuevoEscenario({ nombre: '', tipo: 'inflacion', config: {} })
        setMensaje({ type: 'success', text: `Escenario "${escenario.nombre}" creado` })
    }

    function eliminarEscenario(id) {
        setEscenarios(prev => prev.filter(e => e.id !== id))
    }

    function actualizarPlanificacion(productoId, kg) {
        const producto = productos.find(p => p.id === productoId)
        if (!producto) return

        setPlanificacionBase(prev => prev.map(p =>
            p.producto_id === productoId
                ? { ...p, kg: parseFloat(kg) || 0, batches: Math.ceil((parseFloat(kg) || 0) / producto.peso_batch_kg) }
                : p
        ))
    }

    function agregarProductoPlan(productoId) {
        const producto = productos.find(p => p.id === parseInt(productoId))
        if (!producto) return

        if (planificacionBase.find(p => p.producto_id === producto.id)) return

        setPlanificacionBase(prev => [...prev, {
            producto_id: producto.id,
            kg: 1000,
            batches: Math.ceil(1000 / producto.peso_batch_kg)
        }])
    }

    function eliminarProductoPlan(productoId) {
        setPlanificacionBase(prev => prev.filter(p => p.producto_id !== productoId))
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando datos...</p>
            </div>
        )
    }

    return (
        <div className="page-escenarios">
            <header className="page-header">
                <div>
                    <h1 className="page-title"><Waypoints className="page-icon" size={32} /> Análisis de Escenarios</h1>
                    <p className="page-subtitle">Simula diferentes situaciones y compara el impacto en costos</p>
                </div>
            </header>

            {mensaje && (
                <div className={`alert alert-${mensaje.type}`}>
                    {mensaje.type === 'success' ? '✅' : '❌'} {mensaje.text}
                    <button className="alert-close" onClick={() => setMensaje(null)}>×</button>
                </div>
            )}

            {/* Configuración Base */}
            <div className="card config-card">
                <div className="config-grid">
                    <div className="config-item">
                        <label>📅 Mes a Proyectar</label>
                        <select value={mesProduccion} onChange={(e) => setMesProduccion(e.target.value)}>
                            {futureMonthOptions.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="config-item">
                        <label>📊 Base de Costos</label>
                        <div className="config-value">{getMonthName(mesBaseCostos)}</div>
                    </div>
                    <div className="config-item">
                        <label>📈 Inflación Base Acumulada</label>
                        <div className="config-value inflacion">
                            +{((resultadoBase.factorInflacion - 1) * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="main-grid">
                {/* Planificación Base */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">📋 Producción Base</h3>
                        <select
                            className="add-producto-select"
                            onChange={(e) => { agregarProductoPlan(e.target.value); e.target.value = '' }}
                            value=""
                        >
                            <option value="">+ Agregar producto</option>
                            {productos
                                .filter(p => !planificacionBase.find(pl => pl.producto_id === p.id))
                                .map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                ))
                            }
                        </select>
                    </div>

                    <div className="plan-list">
                        {planificacionBase.map(plan => {
                            const producto = productos.find(p => p.id === plan.producto_id)
                            return (
                                <div key={plan.producto_id} className="plan-item">
                                    <div className="plan-producto">
                                        <strong>{producto?.nombre}</strong>
                                        <span className="plan-batches">{plan.batches} batches</span>
                                    </div>
                                    <div className="plan-kg">
                                        <input
                                            type="number"
                                            value={plan.kg}
                                            onChange={(e) => actualizarPlanificacion(plan.producto_id, e.target.value)}
                                            min="0"
                                        />
                                        <span>Kg</span>
                                    </div>
                                    <button
                                        className="btn-remove"
                                        onClick={() => eliminarProductoPlan(plan.producto_id)}
                                    >×</button>
                                </div>
                            )
                        })}
                    </div>

                    {planificacionBase.length === 0 && (
                        <div className="empty-state">
                            <p>Agregue productos para simular</p>
                        </div>
                    )}
                </div>

                {/* Resultado Base */}
                <div className="card resultado-base">
                    <div className="card-header">
                        <h3 className="card-title">📊 Escenario Base</h3>
                        <span className="badge badge-base">Referencia</span>
                    </div>
                    <div className="resultado-grid">
                        <div className="resultado-item">
                            <span className="resultado-label">Total Kg</span>
                            <span className="resultado-value">{formatNumber(resultadoBase.totalKg, 0)}</span>
                        </div>
                        <div className="resultado-item">
                            <span className="resultado-label">Costo Variable</span>
                            <span className="resultado-value">{formatCurrency(resultadoBase.costoVariableTotal)}</span>
                        </div>
                        <div className="resultado-item">
                            <span className="resultado-label">Costo Indirecto</span>
                            <span className="resultado-value">{formatCurrency(resultadoBase.costoIndirectoTotal)}</span>
                        </div>
                        <div className="resultado-item sub-items">
                            <span className="resultado-sublabel">• SP (M.O.)</span>
                            <span className="resultado-subvalue">{formatCurrency(resultadoBase.costoSP)}</span>
                        </div>
                        <div className="resultado-item sub-items">
                            <span className="resultado-sublabel">• GIF</span>
                            <span className="resultado-subvalue">{formatCurrency(resultadoBase.costoGIF)}</span>
                        </div>
                        <div className="resultado-item sub-items">
                            <span className="resultado-sublabel">• DEP</span>
                            <span className="resultado-subvalue">{formatCurrency(resultadoBase.costoDEP)}</span>
                        </div>
                        <div className="resultado-item total">
                            <span className="resultado-label">COSTO TOTAL</span>
                            <span className="resultado-value">{formatCurrency(resultadoBase.costoTotal)}</span>
                        </div>
                        <div className="resultado-item">
                            <span className="resultado-label">$/Kg Promedio</span>
                            <span className="resultado-value">{formatCurrency(resultadoBase.costoPorKg)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Escenarios */}
            <div className="escenarios-section">
                <div className="section-header">
                    <h2><Waypoints size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} /> Escenarios Alternativos</h2>
                    <button className="btn btn-primary" onClick={() => setShowCrearModal(true)}>
                        + Crear Escenario
                    </button>
                </div>

                {escenarios.length === 0 ? (
                    <div className="empty-escenarios">
                        <div className="empty-icon"><Waypoints size={64} /></div>
                        <h3>Sin escenarios creados</h3>
                        <p>Crea escenarios para simular diferentes situaciones:<br />
                            cambios de inflación, precios de materias primas, etc.</p>
                        <button className="btn btn-primary" onClick={() => setShowCrearModal(true)}>
                            Crear primer escenario
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="escenarios-grid">
                            {resultadosEscenarios.map(esc => {
                                const diff = resultadoBase.costoTotal > 0
                                    ? ((esc.resultado.costoTotal - resultadoBase.costoTotal) / resultadoBase.costoTotal * 100)
                                    : 0
                                const tipoInfo = TIPOS_ESCENARIO.find(t => t.id === esc.tipo)

                                return (
                                    <div key={esc.id} className={`escenario-card ${diff > 0 ? 'negativo' : 'positivo'}`}>
                                        <div className="escenario-header">
                                            <span className="escenario-icon">{tipoInfo?.icon}</span>
                                            <div className="escenario-info">
                                                <strong>{esc.nombre}</strong>
                                                <span className="escenario-tipo">{tipoInfo?.label}</span>
                                            </div>
                                            <button
                                                className="btn-remove-esc"
                                                onClick={() => eliminarEscenario(esc.id)}
                                            >×</button>
                                        </div>
                                        <div className="escenario-config">
                                            {esc.tipo === 'inflacion' && `Inflación: ${esc.config.porcentaje}% mensual`}
                                            {esc.tipo === 'materia_prima' && `${materiasPrimas.find(m => m.id === esc.config.materia_prima_id)?.nombre}: ${esc.config.porcentaje > 0 ? '+' : ''}${esc.config.porcentaje}%`}
                                            {esc.tipo === 'categoria' && `${esc.config.categoria}: ${esc.config.porcentaje > 0 ? '+' : ''}${esc.config.porcentaje}%`}
                                            {esc.tipo === 'indirectos' && `Costos Indirectos: ${esc.config.porcentaje > 0 ? '+' : ''}${esc.config.porcentaje}%`}
                                            {esc.tipo === 'produccion' && `Producción: ${esc.config.porcentaje > 0 ? '+' : ''}${esc.config.porcentaje}%`}
                                        </div>
                                        <div className="escenario-resultado">
                                            <div className="escenario-total">
                                                {formatCurrency(esc.resultado.costoTotal)}
                                            </div>
                                            <div className={`escenario-diff ${diff > 0 ? 'up' : 'down'}`}>
                                                {diff > 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}%
                                            </div>
                                        </div>
                                        <div className="escenario-detalle">
                                            <span>$/Kg: {formatCurrency(esc.resultado.costoPorKg)}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Tabla comparativa */}
                        <div className="card comparativa-card">
                            <div className="card-header">
                                <h3 className="card-title">📊 Tabla Comparativa</h3>
                            </div>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Escenario</th>
                                            <th className="text-right">Total Kg</th>
                                            <th className="text-right">Costo Variable</th>
                                            <th className="text-right">Costo Indirecto</th>
                                            <th className="text-right">Costo Total</th>
                                            <th className="text-right">vs Base</th>
                                            <th className="text-right">$/Kg</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="row-base">
                                            <td><strong>📊 Base</strong></td>
                                            <td className="text-right">{formatNumber(resultadoBase.totalKg, 0)}</td>
                                            <td className="text-right">{formatCurrency(resultadoBase.costoVariableTotal)}</td>
                                            <td className="text-right">{formatCurrency(resultadoBase.costoIndirectoTotal)}</td>
                                            <td className="text-right"><strong>{formatCurrency(resultadoBase.costoTotal)}</strong></td>
                                            <td className="text-right">-</td>
                                            <td className="text-right">{formatCurrency(resultadoBase.costoPorKg)}</td>
                                        </tr>
                                        {resultadosEscenarios.map(esc => {
                                            const diff = resultadoBase.costoTotal > 0
                                                ? ((esc.resultado.costoTotal - resultadoBase.costoTotal) / resultadoBase.costoTotal * 100)
                                                : 0
                                            const tipoInfo = TIPOS_ESCENARIO.find(t => t.id === esc.tipo)

                                            return (
                                                <tr key={esc.id}>
                                                    <td>{tipoInfo?.icon} {esc.nombre}</td>
                                                    <td className="text-right">{formatNumber(esc.resultado.totalKg, 0)}</td>
                                                    <td className="text-right">{formatCurrency(esc.resultado.costoVariableTotal)}</td>
                                                    <td className="text-right">{formatCurrency(esc.resultado.costoIndirectoTotal)}</td>
                                                    <td className="text-right"><strong>{formatCurrency(esc.resultado.costoTotal)}</strong></td>
                                                    <td className={`text-right ${diff > 0 ? 'text-danger' : 'text-success'}`}>
                                                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                                    </td>
                                                    <td className="text-right">{formatCurrency(esc.resultado.costoPorKg)}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modal Crear Escenario */}
            {showCrearModal && (
                <div className="modal-overlay" onClick={() => setShowCrearModal(false)}>
                    <div className="modal modal-md" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title"><Waypoints size={20} style={{ marginRight: '8px' }} /> Crear Escenario</h3>
                            <button className="modal-close" onClick={() => setShowCrearModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nombre del Escenario *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={nuevoEscenario.nombre}
                                    onChange={e => setNuevoEscenario(prev => ({ ...prev, nombre: e.target.value }))}
                                    placeholder="Ej: Inflación alta"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Tipo de Escenario</label>
                                <div className="tipos-grid">
                                    {TIPOS_ESCENARIO.map(tipo => (
                                        <button
                                            key={tipo.id}
                                            type="button"
                                            className={`tipo-btn ${nuevoEscenario.tipo === tipo.id ? 'active' : ''}`}
                                            onClick={() => setNuevoEscenario(prev => ({
                                                ...prev,
                                                tipo: tipo.id,
                                                config: {}
                                            }))}
                                        >
                                            <span className="tipo-icon">{tipo.icon}</span>
                                            <span className="tipo-label">{tipo.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Configuración según tipo */}
                            <div className="config-tipo">
                                {nuevoEscenario.tipo === 'inflacion' && (
                                    <div className="form-group">
                                        <label className="form-label">Tasa de inflación mensual (%)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            step="0.1"
                                            value={nuevoEscenario.config.porcentaje || ''}
                                            onChange={e => setNuevoEscenario(prev => ({
                                                ...prev,
                                                config: { porcentaje: parseFloat(e.target.value) || 0 }
                                            }))}
                                            placeholder="Ej: 10"
                                        />
                                        <small className="form-help">Esta tasa reemplazará la inflación base para el cálculo</small>
                                    </div>
                                )}

                                {nuevoEscenario.tipo === 'materia_prima' && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Materia Prima</label>
                                            <select
                                                className="form-input"
                                                value={nuevoEscenario.config.materia_prima_id || ''}
                                                onChange={e => setNuevoEscenario(prev => ({
                                                    ...prev,
                                                    config: { ...prev.config, materia_prima_id: parseInt(e.target.value) }
                                                }))}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {materiasPrimas.map(mp => (
                                                    <option key={mp.id} value={mp.id}>
                                                        {mp.nombre} ({mp.categoria})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Variación de precio (%)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={nuevoEscenario.config.porcentaje || ''}
                                                onChange={e => setNuevoEscenario(prev => ({
                                                    ...prev,
                                                    config: { ...prev.config, porcentaje: parseFloat(e.target.value) || 0 }
                                                }))}
                                                placeholder="Ej: 20 (para +20%)"
                                            />
                                        </div>
                                    </>
                                )}

                                {nuevoEscenario.tipo === 'categoria' && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Categoría</label>
                                            <select
                                                className="form-input"
                                                value={nuevoEscenario.config.categoria || ''}
                                                onChange={e => setNuevoEscenario(prev => ({
                                                    ...prev,
                                                    config: { ...prev.config, categoria: e.target.value }
                                                }))}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {categorias.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Variación de precio (%)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={nuevoEscenario.config.porcentaje || ''}
                                                onChange={e => setNuevoEscenario(prev => ({
                                                    ...prev,
                                                    config: { ...prev.config, porcentaje: parseFloat(e.target.value) || 0 }
                                                }))}
                                                placeholder="Ej: 15 (para +15%)"
                                            />
                                        </div>
                                    </>
                                )}

                                {nuevoEscenario.tipo === 'indirectos' && (
                                    <div className="form-group">
                                        <label className="form-label">Variación de costos indirectos (%)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={nuevoEscenario.config.porcentaje || ''}
                                            onChange={e => setNuevoEscenario(prev => ({
                                                ...prev,
                                                config: { porcentaje: parseFloat(e.target.value) || 0 }
                                            }))}
                                            placeholder="Ej: 25 (para +25%)"
                                        />
                                        <small className="form-help">Afecta SP, GIF y DEP proporcionalmente</small>
                                    </div>
                                )}

                                {nuevoEscenario.tipo === 'produccion' && (
                                    <div className="form-group">
                                        <label className="form-label">Variación de producción (%)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={nuevoEscenario.config.porcentaje || ''}
                                            onChange={e => setNuevoEscenario(prev => ({
                                                ...prev,
                                                config: { porcentaje: parseFloat(e.target.value) || 0 }
                                            }))}
                                            placeholder="Ej: -20 (para -20%)"
                                        />
                                        <small className="form-help">Valores negativos reducen la producción</small>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCrearModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={agregarEscenario}>
                                Crear Escenario
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Escenarios
