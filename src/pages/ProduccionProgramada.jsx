import { useState, useEffect, useMemo } from 'react'
import {
    productosApi,
    produccionApi,
    costeoApi,
    costosIndirectosApi,
    inflacionApi,
    mlApi,
    exportarApi,
    formatCurrency,
    formatNumber
} from '../services/api'
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Settings,
    Download,
    FileText,
    Bot,
    Plus,
    Package,
    Scale,
    DollarSign,
    TrendingUp,
    Factory,
    Trash2,
    Layers,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Info,
    ClipboardX
} from 'lucide-react'
import './ProduccionProgramada.css'

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
    for (let i = -2; i <= 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const label = `${MESES[date.getMonth()]} ${date.getFullYear()}`
        options.push({ value, label })
    }
    return options
}

// Calcular meses entre dos fechas (para inflación acumulada)
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

function ProduccionProgramada() {
    const [mesSeleccionado, setMesSeleccionado] = useState(getCurrentMonth())
    const [mesBaseCostos, setMesBaseCostos] = useState(null)
    const [mesesConCostos, setMesesConCostos] = useState([])
    const [productos, setProductos] = useState([])
    const [productosConCosto, setProductosConCosto] = useState({})
    const [produccion, setProduccion] = useState([])
    const [costosIndirectosBase, setCostosIndirectosBase] = useState(null)
    const [inflaciones, setInflaciones] = useState([])
    const [mlStatus, setMlStatus] = useState(null)

    const [loading, setLoading] = useState(true)
    const [loadingML, setLoadingML] = useState(false)
    const [error, setError] = useState(null)
    const [mensaje, setMensaje] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [showConfigModal, setShowConfigModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [categoriaExpandida, setCategoriaExpandida] = useState(null)

    const [formData, setFormData] = useState({
        producto_id: '',
        cantidad_batches: '',
        cantidad_kg: '',
        fecha: '',
    })

    const monthOptions = useMemo(() => getMonthOptions(), [])

    // Calcular factor de inflación acumulada
    const factorInflacion = useMemo(() => {
        if (!mesBaseCostos || !mesSeleccionado) return 1

        const mesesEntre = getMonthsBetween(mesBaseCostos, mesSeleccionado)
        let factor = 1

        mesesEntre.forEach(mes => {
            const inf = inflaciones.find(i => i.mes === mes)
            if (inf) {
                factor *= (1 + inf.porcentaje / 100)
            }
        })

        return factor
    }, [mesBaseCostos, mesSeleccionado, inflaciones])

    const inflacionAcumuladaPct = useMemo(() => {
        return ((factorInflacion - 1) * 100).toFixed(1)
    }, [factorInflacion])

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        loadProduccionMes()
        const [year, month] = mesSeleccionado.split('-')
        setFormData(prev => ({
            ...prev,
            fecha: `${year}-${month}-01`
        }))
    }, [mesSeleccionado])

    useEffect(() => {
        if (mesBaseCostos) {
            loadCostosIndirectos()
        }
    }, [mesBaseCostos])

    async function loadInitialData() {
        setLoading(true)
        setError(null)
        try {
            const [productosData, costosData, inflacionesData, mlStatusData] = await Promise.all([
                productosApi.getAll(),
                costosIndirectosApi.getAll(),
                inflacionApi.getAll().catch(() => []),
                mlApi.getStatus().catch(() => ({ is_trained: false }))
            ])

            setProductos(productosData)
            setInflaciones(inflacionesData)
            setMlStatus(mlStatusData)

            // Detectar meses con costos cerrados
            const meses = [...new Set(costosData.map(c => c.mes_base))].sort()
            setMesesConCostos(meses)

            if (meses.length > 0) {
                const ultimoMes = meses[meses.length - 1]
                setMesBaseCostos(ultimoMes)
            }

            // Cargar costos de cada producto
            const costosMap = {}
            const resultados = await Promise.allSettled(
                productosData.map(async (p) => {
                    const costeo = await costeoApi.getByProducto(p.id)
                    return { id: p.id, costeo }
                })
            )

            resultados.forEach((resultado, index) => {
                const productoId = productosData[index].id
                if (resultado.status === 'fulfilled' && resultado.value.costeo) {
                    const costeo = resultado.value.costeo
                    costosMap[productoId] = {
                        costoNetoBatch: costeo.resumen?.total_neto || 0,
                        costoPorKg: costeo.resumen?.costo_por_kg || 0,
                        totalesPorCategoria: costeo.totales_categoria || {},
                        ingredientes: costeo.ingredientes || []
                    }
                } else {
                    console.warn(`Error cargando costeo para producto ${productoId}:`, resultado.reason || 'Sin datos')
                    costosMap[productoId] = { costoNetoBatch: 0, costoPorKg: 0, totalesPorCategoria: {}, ingredientes: [] }
                }
            })

            console.log('Costos cargados:', Object.entries(costosMap).filter(([_, v]) => v.costoPorKg > 0).length, 'de', productosData.length, 'productos con costo > 0')
            setProductosConCosto(costosMap)

            await loadProduccionMes()
        } catch (err) {
            console.error('Error loading data:', err)
            setError('Error al cargar los datos. Verifica que el backend esté corriendo.')
        } finally {
            setLoading(false)
        }
    }

    async function loadCostosIndirectos() {
        try {
            const resumen = await costosIndirectosApi.getResumen(mesBaseCostos)
            setCostosIndirectosBase(resumen)
        } catch {
            setCostosIndirectosBase(null)
        }
    }

    async function loadProduccionMes() {
        try {
            const produccionData = await produccionApi.getAll(mesSeleccionado)
            setProduccion(produccionData)
        } catch (err) {
            console.error('Error loading produccion:', err)
            setProduccion([])
        }
    }

    // Calcular totales para distribución de indirectos
    const totalesProduccion = useMemo(() => {
        let totalKg = 0
        let totalMinutos = 0

        produccion.forEach(p => {
            const producto = productos.find(pr => pr.id === p.producto_id)
            if (!producto) return

            const pesoTotal = p.cantidad_batches * producto.peso_batch_kg
            totalKg += pesoTotal
            totalMinutos += pesoTotal * (producto.min_mo_kg || 0)
        })

        return { totalKg, totalMinutos }
    }, [produccion, productos])

    // Producción con costos completos (MP + Indirectos + Inflación)
    const produccionConCostos = useMemo(() => {
        return produccion.map(p => {
            const producto = productos.find(prod => prod.id === p.producto_id)
            if (!producto) return null

            const costoData = productosConCosto[p.producto_id] || { costoNetoBatch: 0, costoPorKg: 0, totalesPorCategoria: {}, ingredientes: [] }
            const pesoTotal = p.cantidad_batches * producto.peso_batch_kg

            // Costo variable (MP) con inflación
            // Los costos vienen del endpoint /costeo/{id} que NO incluye inflación
            const costoMPPorKg = costoData.costoPorKg * factorInflacion
            const costoMPTotal = costoData.costoNetoBatch * p.cantidad_batches * factorInflacion

            // Costo indirecto distribuido
            let costoIndirectoPorKg = 0
            if (costosIndirectosBase && totalesProduccion.totalKg > 0) {
                const pctKg = pesoTotal / totalesProduccion.totalKg
                const minutosProducto = pesoTotal * (producto.min_mo_kg || 0)
                const pctMinutos = totalesProduccion.totalMinutos > 0
                    ? minutosProducto / totalesProduccion.totalMinutos
                    : pctKg

                // Aplicar inflación a costos indirectos BASE
                const costoSP = (costosIndirectosBase.por_tipo?.SP || 0) * pctMinutos * factorInflacion
                const costoGIF = (costosIndirectosBase.por_tipo?.GIF || 0) * pctKg * factorInflacion
                const costoDEP = (costosIndirectosBase.por_tipo?.DEP || 0) * pctKg * factorInflacion

                costoIndirectoPorKg = pesoTotal > 0 ? (costoSP + costoGIF + costoDEP) / pesoTotal : 0
            }

            const costoTotalPorKg = costoMPPorKg + costoIndirectoPorKg
            const costoIndirectoTotal = costoIndirectoPorKg * pesoTotal
            const costoTotal = costoTotalPorKg * pesoTotal

            return {
                ...p,
                producto,
                pesoTotal,
                costoMPPorKg,
                costoIndirectoPorKg,
                costoTotalPorKg,
                costoMPTotal,
                costoIndirectoTotal,
                costoTotal,
                totalesPorCategoria: costoData.totalesPorCategoria,
                ingredientes: costoData.ingredientes || []
            }
        }).filter(Boolean)
    }, [produccion, productos, productosConCosto, costosIndirectosBase, totalesProduccion, factorInflacion])

    // Resumen total del mes
    const resumen = useMemo(() => {
        const result = produccionConCostos.reduce((acc, p) => ({
            totalBatches: acc.totalBatches + p.cantidad_batches,
            totalPeso: acc.totalPeso + p.pesoTotal,
            totalCostoMP: acc.totalCostoMP + p.costoMPTotal,
            totalCostoIndirecto: acc.totalCostoIndirecto + p.costoIndirectoTotal,
            totalCosto: acc.totalCosto + p.costoTotal,
        }), { totalBatches: 0, totalPeso: 0, totalCostoMP: 0, totalCostoIndirecto: 0, totalCosto: 0 })

        result.costoPorKgPromedio = result.totalPeso > 0 ? result.totalCosto / result.totalPeso : 0

        // Calcular totales por categoría (cantidad y costo)
        const categorias = {}
        const materiasPrimas = {}

        produccionConCostos.forEach(p => {
            // Totales por categoría
            Object.entries(p.totalesPorCategoria || {}).forEach(([cat, data]) => {
                if (!categorias[cat]) categorias[cat] = { cantidad: 0, costo: 0 }
                categorias[cat].cantidad += (data.cantidad || 0) * p.cantidad_batches
                categorias[cat].costo += (data.costo || 0) * p.cantidad_batches * factorInflacion
            })

            // Detalle por materia prima
            p.ingredientes.forEach(ing => {
                const mpId = ing.materia_prima_id
                if (!materiasPrimas[mpId]) {
                    materiasPrimas[mpId] = {
                        id: mpId,
                        nombre: ing.nombre,
                        categoria: ing.categoria,
                        unidad: ing.unidad,
                        cantidad: 0,
                        costo: 0
                    }
                }
                materiasPrimas[mpId].cantidad += ing.cantidad * p.cantidad_batches
                materiasPrimas[mpId].costo += ing.costo_total * p.cantidad_batches * factorInflacion
            })
        })
        result.categorias = categorias
        result.materiasPrimas = Object.values(materiasPrimas).sort((a, b) => b.costo - a.costo)

        return result
    }, [produccionConCostos, factorInflacion])

    // Cargar predicciones desde ML
    async function cargarPrediccionesML() {
        if (!mlStatus?.is_trained) {
            setMensaje({ type: 'warning', text: 'El modelo ML no está entrenado. Vaya a Proyecciones ML para entrenarlo.' })
            return
        }

        setLoadingML(true)
        try {
            const [año, mes] = mesSeleccionado.split('-').map(Number)
            const result = await mlApi.predict(año, mes)

            if (!result.predicciones || result.predicciones.length === 0) {
                setMensaje({ type: 'warning', text: 'No hay predicciones disponibles para este período.' })
                return
            }

            // Crear registros de producción a partir de predicciones
            const [year, month] = mesSeleccionado.split('-')
            const fechaDefault = `${year}-${month}-15` // Mitad del mes por defecto

            let creados = 0
            for (const pred of result.predicciones) {
                // Usar cantidad_kg que es lo que devuelve el predictor
                const cantidadKg = pred.cantidad_kg || pred.prediccion_kg || 0
                if (cantidadKg > 0) {
                    const producto = productos.find(p => p.id === pred.producto_id)
                    if (producto) {
                        const batches = cantidadKg / producto.peso_batch_kg
                        await produccionApi.create({
                            producto_id: pred.producto_id,
                            cantidad_batches: batches,
                            fecha_programacion: fechaDefault
                        })
                        creados++
                    }
                }
            }

            await loadProduccionMes()
            setMensaje({ type: 'success', text: `✅ ${creados} producciones creadas desde predicciones ML` })

        } catch (err) {
            setMensaje({ type: 'error', text: `Error al cargar predicciones: ${err.message}` })
        } finally {
            setLoadingML(false)
        }
    }

    // --- Lógica del Modal ---
    function handleModalProductChange(e) {
        const prodId = e.target.value
        setFormData(prev => {
            const newState = { ...prev, producto_id: prodId }
            if (prev.cantidad_batches && prodId) {
                const prod = productos.find(p => p.id === parseInt(prodId))
                if (prod && prod.peso_batch_kg) {
                    newState.cantidad_kg = (parseFloat(prev.cantidad_batches) * prod.peso_batch_kg).toFixed(2)
                }
            }
            return newState
        })
    }

    function handleModalBatchesChange(e) {
        const batches = e.target.value
        setFormData(prev => {
            const newState = { ...prev, cantidad_batches: batches }
            if (prev.producto_id) {
                const prod = productos.find(p => p.id === parseInt(prev.producto_id))
                if (prod && prod.peso_batch_kg) {
                    newState.cantidad_kg = batches ? (parseFloat(batches) * prod.peso_batch_kg).toFixed(2) : ''
                }
            }
            return newState
        })
    }

    function handleModalKgChange(e) {
        const kg = e.target.value
        setFormData(prev => {
            const newState = { ...prev, cantidad_kg: kg }
            if (prev.producto_id) {
                const prod = productos.find(p => p.id === parseInt(prev.producto_id))
                if (prod && prod.peso_batch_kg > 0) {
                    newState.cantidad_batches = kg ? (parseFloat(kg) / prod.peso_batch_kg).toFixed(2) : ''
                }
            }
            return newState
        })
    }

    async function handleAddProduccion(e) {
        e.preventDefault()
        setSaving(true)
        try {
            await produccionApi.create({
                producto_id: parseInt(formData.producto_id),
                cantidad_batches: parseFloat(formData.cantidad_batches),
                fecha_programacion: formData.fecha,
            })
            setFormData(prev => ({
                ...prev,
                producto_id: '',
                cantidad_batches: '',
                cantidad_kg: ''
            }))
            setShowModal(false)
            await loadProduccionMes()
            setMensaje({ type: 'success', text: 'Producción agregada' })
        } catch (err) {
            console.error('Error adding produccion:', err)
            setMensaje({ type: 'error', text: 'Error al agregar la producción' })
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteProduccion(id) {
        if (!confirm('¿Eliminar esta producción programada?')) return
        try {
            await produccionApi.delete(id)
            await loadProduccionMes()
        } catch (err) {
            console.error('Error deleting:', err)
            setMensaje({ type: 'error', text: 'Error al eliminar' })
        }
    }

    async function handleTableBatchesChange(id, value) {
        const newCantidad = parseFloat(value) || 0
        updateProduccionLocal(id, { cantidad_batches: newCantidad })

        try {
            await produccionApi.update(id, { cantidad_batches: newCantidad })
        } catch (err) {
            console.error('Error updating:', err)
        }
    }

    async function handleTableKgChange(p, value) {
        const kg = parseFloat(value) || 0
        const newBatches = kg / p.producto.peso_batch_kg
        updateProduccionLocal(p.id, { cantidad_batches: newBatches })

        try {
            await produccionApi.update(p.id, { cantidad_batches: newBatches })
        } catch (err) {
            console.error('Error updating:', err)
        }
    }

    function updateProduccionLocal(id, changes) {
        setProduccion(prev => prev.map(p =>
            p.id === id ? { ...p, ...changes } : p
        ))
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando producción programada...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="error-container">
                <AlertTriangle size={48} className="text-danger mb-3" />
                <p>{error}</p>
                <button className="btn btn-primary" onClick={loadInitialData}>
                    Reintentar
                </button>
            </div>
        )
    }

    return (
        <div className="page-produccion">
            <header className="page-header">
                <div>
                    <h1 className="page-title d-flex align-items-center gap-2">
                        <Factory size={32} /> Producción Programada
                    </h1>
                    <p className="page-subtitle">Planifica la producción y calcula costos completos</p>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-secondary d-flex align-items-center gap-2"
                        onClick={() => exportarApi.produccion(mesSeleccionado)}
                        title="Exportar producción a Excel"
                    >
                        <Download size={18} /> Excel
                    </button>
                    <button
                        className="btn btn-outline d-flex align-items-center gap-2"
                        onClick={() => exportarApi.pdfProduccion(mesSeleccionado)}
                        title="Descargar producción en PDF"
                    >
                        <FileText size={18} /> PDF
                    </button>
                    <button
                        className="btn btn-info d-flex align-items-center gap-2"
                        onClick={cargarPrediccionesML}
                        disabled={loadingML || !mlStatus?.is_trained}
                        title={mlStatus?.is_trained ? 'Cargar predicciones desde ML' : 'Entrene el modelo en Proyecciones ML'}
                    >
                        {loadingML ? <div className="spinner-border spinner-border-sm" role="status" /> : <Bot size={18} />} Cargar ML
                    </button>
                    <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowModal(true)}>
                        <Plus size={18} /> Agregar
                    </button>
                </div>
            </header>

            {mensaje && (
                <div className={`alert alert-${mensaje.type} d-flex align-items-center gap-2`}>
                    {mensaje.type === 'success' ? <CheckCircle size={20} /> : mensaje.type === 'warning' ? <AlertTriangle size={20} /> : <XCircle size={20} />}
                    {mensaje.text}
                    <button className="alert-close ml-auto" onClick={() => setMensaje(null)}><XCircle size={16} /></button>
                </div>
            )}

            {/* Selector de Mes y Config - Diseño Mejorado */}
            <div className="config-bar card">
                {/* Mes de Producción */}
                <div className="config-section">
                    <span className="config-section-label d-flex align-items-center gap-2">
                        <Calendar size={18} /> Mes Producción
                    </span>
                    <div className="month-nav">
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
                            className="month-select-main"
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

                {/* Separador */}
                <div className="config-separator"></div>

                {/* Mes Base de Costos */}
                <div className="config-section">
                    <span className="config-section-label d-flex align-items-center gap-2">
                        <Layers size={18} /> Mes Base Costos
                    </span>
                    <div className="base-selector">
                        <select
                            className="month-select-base"
                            value={mesBaseCostos || ''}
                            onChange={(e) => setMesBaseCostos(e.target.value)}
                        >
                            {mesesConCostos.length === 0 ? (
                                <option value="">Sin costos</option>
                            ) : (
                                mesesConCostos.map(m => (
                                    <option key={m} value={m}>{getMonthName(m)}</option>
                                ))
                            )}
                        </select>
                        {factorInflacion > 1 && (
                            <span className="inflacion-badge d-flex align-items-center gap-1">
                                <TrendingUp size={14} /> +{inflacionAcumuladaPct}%
                            </span>
                        )}
                        <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setShowConfigModal(true)}
                            title="Configuración avanzada"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats del mes */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">
                        <Package size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Total Batches</span>
                        <span className="stat-value">{formatNumber(resumen.totalBatches, 1)}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">
                        <Scale size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Peso Total</span>
                        <span className="stat-value">{formatNumber(resumen.totalPeso, 0)} Kg</span>
                    </div>
                </div>
                <div className="stat-card highlight">
                    <div className="stat-icon">
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Costo Total</span>
                        <span className="stat-value">{formatCurrency(resumen.totalCosto)}</span>
                    </div>
                </div>
                <div className="stat-card accent">
                    <div className="stat-icon">
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Costo Prom/Kg</span>
                        <span className="stat-value">{formatCurrency(resumen.costoPorKgPromedio)}</span>
                    </div>
                </div>
            </div>

            {/* Desglose de costos */}
            {resumen.totalCosto > 0 && (
                <div className="cost-breakdown card">
                    <div className="breakdown-item">
                        <span className="breakdown-label d-flex align-items-center gap-2"><Layers size={16} /> Materia Prima</span>
                        <span className="breakdown-value">{formatCurrency(resumen.totalCostoMP)}</span>
                        <span className="breakdown-pct">
                            {((resumen.totalCostoMP / resumen.totalCosto) * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div className="breakdown-separator">+</div>
                    <div className="breakdown-item">
                        <span className="breakdown-label d-flex align-items-center gap-2"><Factory size={16} /> Indirectos</span>
                        <span className="breakdown-value">{formatCurrency(resumen.totalCostoIndirecto)}</span>
                        <span className="breakdown-pct">
                            {((resumen.totalCostoIndirecto / resumen.totalCosto) * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div className="breakdown-separator">=</div>
                    <div className="breakdown-item total">
                        <span className="breakdown-label">Total</span>
                        <span className="breakdown-value">{formatCurrency(resumen.totalCosto)}</span>
                    </div>
                </div>
            )}

            {/* Tabla de producción */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Detalle de Producción - {getMonthName(mesSeleccionado)}</h3>
                    <span className="card-subtitle">
                        {produccion.length} {produccion.length === 1 ? 'registro' : 'registros'}
                    </span>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Fecha</th>
                                <th className="text-right">Batches</th>
                                <th className="text-right">Kg Total</th>
                                <th className="text-right">MP/Kg</th>
                                <th className="text-right">Ind/Kg</th>
                                <th className="text-right highlight-col">Total/Kg</th>
                                <th className="text-right">Costo Total</th>
                                <th style={{ width: '50px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {produccionConCostos.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="empty-state">
                                        <div className="empty-state-icon"><ClipboardX size={48} /></div>
                                        <div className="empty-state-title">Sin producción en {getMonthName(mesSeleccionado)}</div>
                                        <p>Agrega productos manualmente o carga predicciones desde ML</p>
                                        <div className="empty-actions">
                                            <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowModal(true)}>
                                                <Plus size={16} /> Agregar Manual
                                            </button>
                                            {mlStatus?.is_trained && (
                                                <button className="btn btn-info d-flex align-items-center gap-2" onClick={cargarPrediccionesML}>
                                                    <Bot size={16} /> Cargar ML
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                produccionConCostos.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <strong>{p.producto.nombre}</strong>
                                            <div className="text-muted">{p.producto.codigo}</div>
                                        </td>
                                        <td>{new Date(p.fecha_programacion + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                                        <td className="table-number">
                                            <input
                                                type="number"
                                                className="inline-input"
                                                value={Number(p.cantidad_batches).toFixed(2)}
                                                onChange={(e) => handleTableBatchesChange(p.id, e.target.value)}
                                                min="0"
                                                step="0.01"
                                            />
                                        </td>
                                        <td className="table-number">
                                            <input
                                                type="number"
                                                className="inline-input"
                                                value={Number(p.pesoTotal).toFixed(0)}
                                                onChange={(e) => handleTableKgChange(p, e.target.value)}
                                                min="0"
                                                step="1"
                                            />
                                        </td>
                                        <td className="table-number">{formatCurrency(p.costoMPPorKg)}</td>
                                        <td className="table-number text-muted">{formatCurrency(p.costoIndirectoPorKg)}</td>
                                        <td className="table-number highlight-col">
                                            <strong>{formatCurrency(p.costoTotalPorKg)}</strong>
                                        </td>
                                        <td className="table-number cost-total">{formatCurrency(p.costoTotal)}</td>
                                        <td>
                                            <button
                                                className="btn btn-sm btn-danger btn-icon"
                                                onClick={() => handleDeleteProduccion(p.id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {produccionConCostos.length > 0 && (
                            <tfoot>
                                <tr className="total-row">
                                    <td colSpan="2"><strong>TOTALES</strong></td>
                                    <td className="table-number"><strong>{formatNumber(resumen.totalBatches, 1)}</strong></td>
                                    <td className="table-number"><strong>{formatNumber(resumen.totalPeso, 0)} Kg</strong></td>
                                    <td colSpan="2"></td>
                                    <td className="table-number highlight-col">
                                        <strong>{formatCurrency(resumen.costoPorKgPromedio)}</strong>
                                    </td>
                                    <td className="table-number total-value">
                                        <strong>{formatCurrency(resumen.totalCosto)}</strong>
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Requerimientos por categoría */}
            {Object.keys(resumen.categorias || {}).length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">📦 Requerimientos de Materia Prima</h3>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setCategoriaExpandida(categoriaExpandida === 'all' ? null : 'all')}
                        >
                            {categoriaExpandida === 'all' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {categoriaExpandida === 'all' ? 'Ocultar detalle' : 'Ver detalle'}
                        </button>
                    </div>
                    <div className="requirements-grid">
                        {Object.entries(resumen.categorias).map(([cat, data]) => (
                            <div
                                key={cat}
                                className={`requirement-item ${categoriaExpandida === cat ? 'expanded' : ''}`}
                                onClick={() => setCategoriaExpandida(categoriaExpandida === cat ? null : cat)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="requirement-icon">
                                    {cat === 'ENVASES' ? <Package size={24} /> : <Layers size={24} />}
                                </div>
                                <div className="requirement-content">
                                    <span className="requirement-label">{cat}</span>
                                    <span className="requirement-quantity">{formatNumber(data.cantidad)} {cat === 'ENVASES' ? 'un' : 'kg'}</span>
                                    <span className="requirement-value">{formatCurrency(data.costo)}</span>
                                </div>
                                <div className="requirement-expand">
                                    {categoriaExpandida === cat ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tabla detallada de materias primas */}
                    {(categoriaExpandida === 'all' || categoriaExpandida) && (
                        <div className="requirements-detail">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Materia Prima</th>
                                        <th>Categoría</th>
                                        <th className="table-number">Cantidad</th>
                                        <th className="table-number">Costo Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(resumen.materiasPrimas || [])
                                        .filter(mp => categoriaExpandida === 'all' || mp.categoria === categoriaExpandida)
                                        .map(mp => (
                                            <tr key={mp.id}>
                                                <td>{mp.nombre}</td>
                                                <td>
                                                    <span className={`badge badge-${mp.categoria === 'ENVASES' ? 'info' : 'secondary'}`}>
                                                        {mp.categoria}
                                                    </span>
                                                </td>
                                                <td className="table-number">
                                                    {formatNumber(mp.cantidad)} {mp.unidad}
                                                </td>
                                                <td className="table-number">
                                                    {formatCurrency(mp.costo)}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                                {categoriaExpandida === 'all' && (
                                    <tfoot>
                                        <tr>
                                            <td colSpan="3"><strong>TOTAL</strong></td>
                                            <td className="table-number total-value">
                                                <strong>{formatCurrency(resumen.totalCostoMP)}</strong>
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modal agregar */}
            {showModal && (
                <div className="modal-overlay align-start" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Agregar Producción</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleAddProduccion}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Producto *</label>
                                    <select
                                        className="form-input form-select"
                                        value={formData.producto_id}
                                        onChange={handleModalProductChange}
                                        required
                                    >
                                        <option value="">Seleccionar producto...</option>
                                        {productos.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.codigo} - {p.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Batches</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={formData.cantidad_batches}
                                            onChange={handleModalBatchesChange}
                                            placeholder="Ej: 5"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Kg Total</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={formData.cantidad_kg}
                                            onChange={handleModalKgChange}
                                            placeholder="Ej: 500"
                                            min="0"
                                            step="1"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha *</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formData.fecha}
                                        onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving || (!formData.cantidad_batches && !formData.cantidad_kg)}>
                                    {saving ? 'Agregando...' : 'Agregar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de configuración */}
            {showConfigModal && (
                <div className="modal-overlay align-start" onClick={() => setShowConfigModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">⚙️ Configuración de Costos</h3>
                            <button className="modal-close" onClick={() => setShowConfigModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Mes Base de Costos</label>
                                <select
                                    className="form-input"
                                    value={mesBaseCostos || ''}
                                    onChange={(e) => setMesBaseCostos(e.target.value)}
                                >
                                    {mesesConCostos.length === 0 ? (
                                        <option value="">Sin costos cargados</option>
                                    ) : (
                                        mesesConCostos.map(m => (
                                            <option key={m} value={m}>{getMonthName(m)}</option>
                                        ))
                                    )}
                                </select>
                                <small className="form-help">
                                    Los costos se tomarán de este período cerrado y se ajustarán por inflación.
                                </small>
                            </div>

                            {mesBaseCostos && (
                                <div className="config-summary">
                                    <h4>Resumen de Costos Base ({getMonthName(mesBaseCostos)})</h4>
                                    {costosIndirectosBase ? (
                                        <div className="config-details">
                                            <div className="detail-row">
                                                <span>SP (Mano de Obra):</span>
                                                <span>{formatCurrency(costosIndirectosBase.por_tipo?.SP || 0)}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span>GIF (Gastos Indirectos):</span>
                                                <span>{formatCurrency(costosIndirectosBase.por_tipo?.GIF || 0)}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span>DEP (Depreciación):</span>
                                                <span>{formatCurrency(costosIndirectosBase.por_tipo?.DEP || 0)}</span>
                                            </div>
                                            <div className="detail-row total">
                                                <span>Total Indirectos:</span>
                                                <span>{formatCurrency(costosIndirectosBase.total || 0)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-muted">No hay costos indirectos para este mes.</p>
                                    )}

                                    {factorInflacion > 1 && (
                                        <div className="inflacion-info">
                                            <span className="inflacion-label">📈 Inflación acumulada hasta {getMonthName(mesSeleccionado)}:</span>
                                            <span className="inflacion-value">+{inflacionAcumuladaPct}%</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={() => setShowConfigModal(false)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ProduccionProgramada

