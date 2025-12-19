import { useState, useEffect, useMemo } from 'react'
import {
    mlApi,
    historicoApi,
    productosApi,
    costosIndirectosApi,
    inflacionApi,
    produccionApi,
    formatCurrency,
    formatNumber
} from '../services/api'
import {
    Bot,
    CheckCircle2,
    Clock,
    Database,
    Package,
    Brain,
    Calendar,
    Upload,
    Zap,
    Settings,
    Lightbulb,
    TrendingUp,
    DollarSign,
    BarChart3,
    Save,
    AlertCircle,
    Info
} from 'lucide-react'
import './Proyecciones.css'

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function getDefaultPeriod() {
    const now = new Date()
    return { año: now.getFullYear(), mes: now.getMonth() + 1 }
}

function Proyecciones() {
    const [mlStatus, setMlStatus] = useState(null)
    const [historico, setHistorico] = useState([])
    const [productos, setProductos] = useState([])
    const [predicciones, setPredicciones] = useState([])
    const [prediccionesConCostos, setPrediccionesConCostos] = useState([])
    const [periodo, setPeriodo] = useState(getDefaultPeriod())
    const [mesBase, setMesBase] = useState(null)
    const [mesesBaseDisponibles, setMesesBaseDisponibles] = useState([])
    const [costosIndirectosBase, setCostosIndirectosBase] = useState(null)
    const [inflaciones, setInflaciones] = useState([])
    const [loading, setLoading] = useState(true)
    const [importing, setImporting] = useState(false)
    const [training, setTraining] = useState(false)
    const [predicting, setPredicting] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState(null)
    const [mensaje, setMensaje] = useState(null)

    const mlMeta = mlStatus?.metadata || null
    const mlTrainedAtLabel = useMemo(() => {
        if (!mlMeta?.trained_at) return '-'
        const dt = new Date(mlMeta.trained_at)
        if (Number.isNaN(dt.getTime())) return String(mlMeta.trained_at)
        return dt.toLocaleString('es-AR')
    }, [mlMeta?.trained_at])

    const mlDataRangeLabel = useMemo(() => {
        const start = mlMeta?.data_range?.start_ym
        const end = mlMeta?.data_range?.end_ym
        if (!start && !end) return '-'
        if (start && end) return `${start} → ${end}`
        return start || end || '-'
    }, [mlMeta?.data_range?.start_ym, mlMeta?.data_range?.end_ym])

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        setError(null)
        try {
            const [status, resumen, prods, infls] = await Promise.all([
                mlApi.getStatus().catch(() => ({ is_trained: false })),
                historicoApi.getResumen().catch(() => []),
                productosApi.getAll().catch(() => []),
                inflacionApi.getAll().catch(() => [])
            ])
            setMlStatus(status)
            setHistorico(resumen)
            setProductos(prods)
            setInflaciones(infls)

            // Cargar meses base disponibles
            await loadMesesBase()
        } catch (err) {
            setError('Error cargando datos')
        } finally {
            setLoading(false)
        }
    }

    async function loadMesesBase() {
        try {
            const costosInd = await costosIndirectosApi.getAll()
            const mesesSet = new Set(costosInd.map(c => c.mes_base))
            const mesesArray = Array.from(mesesSet).sort().reverse()
            setMesesBaseDisponibles(mesesArray)

            if (mesesArray.length > 0 && !mesBase) {
                const mesBaseDefault = mesesArray[0]
                setMesBase(mesBaseDefault)
                await loadCostosBase(mesBaseDefault)
            }
        } catch (err) {
            console.error('Error cargando meses base:', err)
        }
    }

    async function loadCostosBase(mes) {
        try {
            const resumen = await costosIndirectosApi.getResumen(mes)
            setCostosIndirectosBase(resumen)
        } catch (err) {
            console.error('Error cargando costos base:', err)
            setCostosIndirectosBase(null)
        }
    }

    async function handleMesBaseChange(nuevoMes) {
        setMesBase(nuevoMes)
        await loadCostosBase(nuevoMes)
    }

    async function handleImport() {
        setImporting(true)
        setMensaje(null)
        try {
            const result = await mlApi.importExcel()
            if (result.success) {
                setMensaje(`✅ Importación exitosa: ${result.productos_creados} productos creados, ${result.registros_importados} registros importados`)
                await loadData()
            } else {
                setMensaje(`❌ Error: ${result.error}`)
            }
        } catch (err) {
            setMensaje(`❌ Error: ${err.message}`)
        } finally {
            setImporting(false)
        }
    }

    async function handleTrain() {
        setTraining(true)
        setMensaje(null)
        try {
            const result = await mlApi.train()
            if (result.success) {
                setMensaje(`✅ Modelo entrenado: ${result.productos_entrenados} productos con modelo propio`)
                await loadData()
            } else {
                setMensaje(`❌ ${result.error}`)
            }
        } catch (err) {
            setMensaje(`❌ Error: ${err.message}`)
        } finally {
            setTraining(false)
        }
    }

    async function handlePredict() {
        if (!mesBase) {
            setMensaje('⚠️ Seleccione un mes base para costos indirectos')
            return
        }

        if (!mlStatus?.is_trained) {
            setMensaje('⚠️ El modelo ML no está entrenado. Importe datos históricos y entrene el modelo primero.')
            return
        }

        setPredicting(true)
        setMensaje(null)
        try {
            const result = await mlApi.predict(periodo.año, periodo.mes)
            setPredicciones(result.predicciones || [])

            if (result.predicciones?.length === 0) {
                setMensaje('⚠️ No hay predicciones disponibles. Verifique que hay datos históricos para los productos.')
                setPrediccionesConCostos([])
                return
            }

            // Calcular costos para predicciones
            const prediccionesConCostosCalc = await calcularCostos(result.predicciones)
            setPrediccionesConCostos(prediccionesConCostosCalc)

            // Verificar si hay productos sin costo
            const sinCosto = prediccionesConCostosCalc.filter(p => p.mp_por_kg === 0)
            if (sinCosto.length > 0) {
                setMensaje(`⚠️ ${sinCosto.length} producto(s) tienen costo $0 (sin fórmula definida)`)
            }

        } catch (err) {
            setMensaje(`❌ Error: ${err.message}`)
        } finally {
            setPredicting(false)
        }
    }

    async function calcularCostos(prediccionesArray) {
        if (!costosIndirectosBase || prediccionesArray.length === 0) {
            return prediccionesArray
        }

        const mesPredStr = `${periodo.año}-${String(periodo.mes).padStart(2, '0')}`

        // Calcular inflación acumulada
        let inflacionAcumulada = 1.0
        if (mesPredStr > mesBase) {
            const inflsAplicables = inflaciones.filter(i => i.mes > mesBase && i.mes <= mesPredStr)
            inflsAplicables.forEach(inf => {
                inflacionAcumulada *= (1 + inf.porcentaje / 100)
            })
        }

        // Costos indirectos con inflación
        const totalSP = (costosIndirectosBase.por_tipo?.SP || 0) * inflacionAcumulada
        const totalGIF = (costosIndirectosBase.por_tipo?.GIF || 0) * inflacionAcumulada
        const totalDEP = (costosIndirectosBase.por_tipo?.DEP || 0) * inflacionAcumulada

        // Calcular totales del mes
        const prediccionesConDatos = prediccionesArray.filter(p => p.cantidad_kg && p.cantidad_kg > 0)
        const totalKgMes = prediccionesConDatos.reduce((sum, p) => sum + p.cantidad_kg, 0)

        let totalMinutosMes = 0
        prediccionesConDatos.forEach(pred => {
            const prod = productos.find(p => p.id === pred.producto_id)
            if (prod) {
                totalMinutosMes += pred.cantidad_kg * (prod.min_mo_kg || 0)
            }
        })

        //Calcular costos por producto
        const resultado = []
        for (const pred of prediccionesConDatos) {
            const prod = productos.find(p => p.id === pred.producto_id)
            if (!prod) continue

            const kg = pred.cantidad_kg
            const minutos = kg * (prod.min_mo_kg || 0)

            // Obtener costeo del producto usando la API correcta
            let mpBaseKg = 0
            try {
                const costeo = await fetch(`/api/costeo/${prod.id}`).then(r => r.json()).catch(() => null)
                if (costeo?.resumen) {
                    mpBaseKg = costeo.resumen.costo_por_kg || 0
                }
                // Si no hay costeo, mpBaseKg queda en 0 (producto sin fórmula)
            } catch (err) {
                console.error('Error obteniendo costeo:', err)
            }

            // MP con inflación
            const mpPorKg = mpBaseKg * inflacionAcumulada

            // Costos indirectos distribuidos
            let indPorKg = 0
            if (totalKgMes > 0 && totalMinutosMes > 0) {
                const pctMO = totalMinutosMes > 0 ? minutos / totalMinutosMes : 0
                const pctKg = kg / totalKgMes

                const costoSP = totalSP * pctMO
                const costoGIF = totalGIF * pctKg
                const costoDEP = totalDEP * pctKg

                indPorKg = (costoSP + costoGIF + costoDEP) / kg
            }

            const totalPorKg = mpPorKg + indPorKg
            const costoTotal = totalPorKg * kg

            resultado.push({
                ...pred,
                producto: prod,
                mp_por_kg: mpPorKg,
                ind_por_kg: indPorKg,
                total_por_kg: totalPorKg,
                costo_total: costoTotal,
                inflacion_acumulada_pct: (inflacionAcumulada - 1) * 100
            })
        }

        return resultado
    }

    async function handleGuardarEnProduccion() {
        if (prediccionesConCostos.length === 0) {
            setMensaje('⚠️ No hay predicciones para guardar')
            return
        }

        setGuardando(true)
        setMensaje(null)

        try {
            // Usar el primer día del mes seleccionado
            const fecha = new Date(periodo.año, periodo.mes - 1, 1)
            let guardados = 0
            let errores = 0

            for (const pred of prediccionesConCostos) {
                if (!pred.producto || pred.cantidad_kg <= 0) continue

                const cantidadBatches = pred.cantidad_kg / pred.producto.peso_batch_kg

                try {
                    await produccionApi.create({
                        producto_id: pred.producto_id,
                        cantidad_batches: cantidadBatches,
                        fecha_programacion: fecha.toISOString().split('T')[0]
                    })
                    guardados++
                } catch (err) {
                    errores++
                    console.error('Error guardando predicción:', err)
                }
            }

            if (guardados > 0) {
                setMensaje(`✅ ${guardados} predicciones guardadas en Producción Programada`)
            }
            if (errores > 0) {
                setMensaje(prev => `${prev || ''} ⚠️ ${errores} errores al guardar`)
            }
        } catch (err) {
            setMensaje(`❌ Error: ${err.message}`)
        } finally {
            setGuardando(false)
        }
    }

    const añoOptions = useMemo(() => {
        const años = []
        const current = new Date().getFullYear()
        for (let i = current - 1; i <= current + 2; i++) {
            años.push(i)
        }
        return años
    }, [])

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando módulo de predicciones...</p>
            </div>
        )
    }

    return (
        <div className="page-proyecciones">
            <header className="page-header">
                <div className="title-with-icon">
                    <Bot size={32} className="header-icon" />
                    <div>
                        <h1 className="page-title">Proyecciones ML</h1>
                        <p className="page-subtitle">Predicciones de producción con XGBoost</p>
                    </div>
                </div>
            </header>

            {mensaje && (
                <div className={`alert ${mensaje.startsWith('✅') ? 'alert-success' : mensaje.startsWith('⚠️') ? 'alert-warning' : 'alert-error'}`}>
                    {mensaje}
                    <button className="alert-close" onClick={() => setMensaje(null)}>×</button>
                </div>
            )}

            {/* Estado del Modelo */}
            <div className="card ml-status-card">
                <div className="card-header">
                    <h3 className="card-title">Estado del Modelo</h3>
                </div>
                <div className="status-grid">
                    <div className={`status-item ${mlStatus?.is_trained ? 'status-ok' : 'status-pending'}`}>
                        <div className="status-icon-container">
                            {mlStatus?.is_trained ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                        </div>
                        <div className="status-content">
                            <span className="status-label">Modelo</span>
                            <span className="status-value">{mlStatus?.is_trained ? 'Entrenado' : 'Sin entrenar'}</span>
                        </div>
                    </div>
                    <div className="status-item">
                        <div className="status-icon-container">
                            <Database size={20} />
                        </div>
                        <div className="status-content">
                            <span className="status-label">Datos Históricos</span>
                            <span className="status-value">{mlStatus?.datos_historicos?.total_registros || 0} registros</span>
                        </div>
                    </div>
                    <div className="status-item">
                        <div className="status-icon-container">
                            <Package size={20} />
                        </div>
                        <div className="status-content">
                            <span className="status-label">Productos con Datos</span>
                            <span className="status-value">{mlStatus?.datos_historicos?.productos_con_datos || 0} productos</span>
                        </div>
                    </div>
                    <div className="status-item">
                        <div className="status-icon-container">
                            <Brain size={20} />
                        </div>
                        <div className="status-content">
                            <span className="status-label">Modelos Individuales</span>
                            <span className="status-value">{mlStatus?.productos_con_modelo || 0}</span>
                        </div>
                    </div>
                    <div className="status-item">
                        <div className="status-icon-container">
                            <Clock size={20} />
                        </div>
                        <div className="status-content">
                            <span className="status-label">Último Entrenamiento</span>
                            <span className="status-value">{mlTrainedAtLabel}</span>
                        </div>
                    </div>
                    <div className="status-item">
                        <div className="status-icon-container">
                            <Calendar size={20} />
                        </div>
                        <div className="status-content">
                            <span className="status-label">Rango de Datos</span>
                            <span className="status-value">{mlDataRangeLabel}</span>
                        </div>
                    </div>
                </div>

                <div className="status-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={handleImport}
                        disabled={importing}
                    >
                        {importing ? <Clock size={18} className="spin" /> : <Upload size={18} />}
                        {importing ? 'Importando...' : 'Importar Excel'}
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleTrain}
                        disabled={training || !mlStatus?.datos_historicos?.total_registros}
                    >
                        {training ? <Clock size={18} className="spin" /> : <Zap size={18} />}
                        {training ? 'Entrenando...' : 'Entrenar Modelo'}
                    </button>
                </div>
            </div>

            {/* Resumen de Datos Históricos */}
            {historico.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Datos Históricos por Producto</h3>
                        <span className="card-subtitle">{historico.length} productos con historial</span>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Producto</th>
                                    <th className="text-right">Registros</th>
                                    <th>Desde</th>
                                    <th>Hasta</th>
                                    <th className="text-right">Total Kg</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historico.slice(0, 10).map(h => (
                                    <tr key={h.producto_id}>
                                        <td className="font-mono">{h.codigo}</td>
                                        <td>{h.nombre}</td>
                                        <td className="table-number">{h.total_registros}</td>
                                        <td>{h.fecha_inicio ? new Date(h.fecha_inicio).toLocaleDateString('es-AR') : '-'}</td>
                                        <td>{h.fecha_fin ? new Date(h.fecha_fin).toLocaleDateString('es-AR') : '-'}</td>
                                        <td className="table-number">{formatNumber(h.total_kg, 0)} Kg</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {historico.length > 10 && (
                            <p className="table-note">...y {historico.length - 10} productos más</p>
                        )}
                    </div>
                </div>
            )}

            {/* Configuración de Costos */}
            <div className="card config-card">
                <div className="card-header">
                    <div className="title-with-icon">
                        <Settings size={20} />
                        <h3 className="card-title">Configuración de Costos</h3>
                    </div>
                </div>
                <div style={{ padding: 'var(--spacing-4)' }}>
                    <div className="form-group">
                        <label>Mes Base (Costos Indirectos)</label>
                        <select
                            value={mesBase || ''}
                            onChange={(e) => handleMesBaseChange(e.target.value)}
                            className="form-control"
                            style={{ maxWidth: '300px' }}
                        >
                            <option value="">Seleccione...</option>
                            {mesesBaseDisponibles.map(m => {
                                const [año, mes] = m.split('-')
                                return (
                                    <option key={m} value={m}>
                                        {MESES[parseInt(mes) - 1]} {año}
                                    </option>
                                )
                            })}
                        </select>
                        {costosIndirectosBase && (
                            <div style={{
                                marginTop: 'var(--spacing-2)',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-neutral-600)'
                            }}>
                                <strong>Costos Base:</strong> SP: {formatCurrency(costosIndirectosBase.por_tipo?.SP || 0)} |
                                GIF: {formatCurrency(costosIndirectosBase.por_tipo?.GIF || 0)} |
                                DEP: {formatCurrency(costosIndirectosBase.por_tipo?.DEP || 0)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Generador de Predicciones */}
            <div className="card prediction-card">
                <div className="card-header">
                    <h3 className="card-title">Generar Predicciones</h3>
                </div>
                <div className="prediction-controls">
                    <div className="period-selector">
                        <label>Período a Predecir:</label>
                        <select
                            value={periodo.mes}
                            onChange={(e) => setPeriodo(prev => ({ ...prev, mes: parseInt(e.target.value) }))}
                        >
                            {MESES.map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={periodo.año}
                            onChange={(e) => setPeriodo(prev => ({ ...prev, año: parseInt(e.target.value) }))}
                        >
                            {añoOptions.map(a => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handlePredict}
                        disabled={predicting || !mlStatus?.is_trained}
                    >
                        {predicting ? <Clock size={20} className="spin" /> : <Bot size={20} />}
                        {predicting ? 'Calculando...' : 'Generar Predicciones'}
                    </button>
                </div>

                {!mlStatus?.is_trained && (
                    <div className="prediction-notice">
                        <span className="notice-icon"><Lightbulb size={20} /></span>
                        Importe datos históricos y entrene el modelo para generar predicciones.
                    </div>
                )}
            </div>

            {/* Resultados de Predicciones CON COSTOS */}
            {prediccionesConCostos.length > 0 && (
                <>
                    {/* Resumen del Mes */}
                    <div className="card resumen-proyeccion-card">
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="card-title">
                                Resumen: {MESES[periodo.mes - 1]} {periodo.año}
                            </h3>
                            {prediccionesConCostos[0]?.inflacion_acumulada_pct > 0 && (
                                <span className="inflacion-badge">
                                    <TrendingUp size={14} /> Inflación: +{prediccionesConCostos[0].inflacion_acumulada_pct.toFixed(2)}%
                                </span>
                            )}
                        </div>
                        <div className="resumen-grid">
                            <div className="resumen-item">
                                <div className="resumen-icon-container">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <span className="resumen-label">Total Producción</span>
                                    <span className="resumen-value">
                                        {formatNumber(prediccionesConCostos.reduce((sum, p) => sum + p.cantidad_kg, 0), 0)} kg
                                    </span>
                                </div>
                            </div>
                            <div className="resumen-item">
                                <div className="resumen-icon-container">
                                    <DollarSign size={24} />
                                </div>
                                <div>
                                    <span className="resumen-label">Costo Total Mes</span>
                                    <span className="resumen-value">
                                        {formatCurrency(prediccionesConCostos.reduce((sum, p) => sum + p.costo_total, 0))}
                                    </span>
                                </div>
                            </div>
                            <div className="resumen-item">
                                <div className="resumen-icon-container">
                                    <BarChart3 size={24} />
                                </div>
                                <div>
                                    <span className="resumen-label">Costo Promedio/Kg</span>
                                    <span className="resumen-value">
                                        {formatCurrency(
                                            prediccionesConCostos.reduce((sum, p) => sum + p.costo_total, 0) /
                                            prediccionesConCostos.reduce((sum, p) => sum + p.cantidad_kg, 0)
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabla de Productos con Costos */}
                    <div className="card results-card">
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="card-title">
                                Predicciones para {MESES[periodo.mes - 1]} {periodo.año}
                            </h3>
                            <button
                                className="btn btn-success"
                                onClick={handleGuardarEnProduccion}
                                disabled={guardando}
                            >
                                {guardando ? <Clock size={18} className="spin" /> : <Save size={18} />}
                                {guardando ? 'Guardando...' : 'Guardar en Producción'}
                            </button>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th className="text-right">Kg Proyectados</th>
                                        <th className="text-right">MP/Kg</th>
                                        <th className="text-right">Ind/Kg</th>
                                        <th className="text-right">Total/Kg</th>
                                        <th className="text-right">Costo Total</th>
                                        <th className="text-center">Confianza</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prediccionesConCostos.map(p => (
                                        <tr key={p.producto_id}>
                                            <td>
                                                <strong>{p.producto?.nombre || `ID: ${p.producto_id}`}</strong>
                                                <div className="text-muted font-mono">{p.producto?.codigo}</div>
                                            </td>
                                            <td className="table-number prediction-value">
                                                {formatNumber(p.cantidad_kg, 0)} kg
                                            </td>
                                            <td className="table-number">
                                                {formatCurrency(p.mp_por_kg)}
                                            </td>
                                            <td className="table-number">
                                                {formatCurrency(p.ind_por_kg)}
                                            </td>
                                            <td className="table-number">
                                                <strong>{formatCurrency(p.total_por_kg)}</strong>
                                            </td>
                                            <td className="table-number">
                                                <strong>{formatCurrency(p.costo_total)}</strong>
                                            </td>
                                            <td className="text-center">
                                                <span className={`confidence-badge confidence-${getConfidenceLevel(p.confianza)}`}>
                                                    {Math.round(p.confianza * 100)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Productos sin predicción */}
            {predicciones.filter(p => p.cantidad_kg === null).length > 0 && (
                <div className="card">
                    <div className="no-prediction-list">
                        <h4>Productos sin predicción disponible:</h4>
                        <ul>
                            {predicciones.filter(p => p.cantidad_kg === null).map(p => (
                                <li key={p.producto_id}>
                                    {p.producto?.nombre || `ID: ${p.producto_id}`} - {p.mensaje}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <style>{`
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: var(--spacing-4);
        }
        .alert {
          padding: var(--spacing-3) var(--spacing-4);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-4);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .alert-success { background: var(--color-success-light); color: var(--color-success); }
        .alert-warning { background: #fef3c7; color: #92400e; }
        .alert-error { background: var(--color-danger-light); color: var(--color-danger); }
        .alert-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          opacity: 0.6;
        }
        .ml-status-card .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--spacing-4);
          padding: var(--spacing-4);
        }
        .status-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-3);
          background: var(--color-neutral-50);
          border-radius: var(--radius-md);
        }
        .status-icon { font-size: 1.5rem; }
        .status-content { display: flex; flex-direction: column; }
        .status-label { font-size: var(--font-size-xs); color: var(--color-neutral-500); }
        .status-value { font-weight: 600; }
        .status-actions {
          display: flex;
          gap: var(--spacing-3);
          padding: var(--spacing-4);
          border-top: 1px solid var(--color-neutral-100);
        }
        .prediction-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--spacing-4);
          padding: var(--spacing-4);
          flex-wrap: wrap;
        }
        .period-selector {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }
        .period-selector select {
          padding: var(--spacing-2) var(--spacing-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-neutral-200);
          font-size: var(--font-size-base);
        }
        .prediction-notice {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          padding: var(--spacing-3);
          background: #fef3c7;
          border-radius: var(--radius-md);
          margin: var(--spacing-4);
          margin-top: 0;
        }
        .prediction-value {
          font-size: var(--font-size-lg);
          font-weight: 700;
          color: var(--color-primary-600);
        }
        .confidence-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: var(--font-size-xs);
          font-weight: 600;
        }
        .confidence-high { background: #d1fae5; color: #065f46; }
        .confidence-medium { background: #fef3c7; color: #92400e; }
        .confidence-low { background: #fee2e2; color: #991b1b; }
        .method-badge {
          font-size: var(--font-size-xs);
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--color-neutral-100);
        }
        .card-subtitle {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }
        .table-note {
          text-align: center;
          padding: var(--spacing-3);
          color: var(--color-neutral-500);
          font-size: var(--font-size-sm);
        }
        .no-prediction-list {
          padding: var(--spacing-4);
          background: var(--color-neutral-50);
          margin: var(--spacing-4);
          border-radius: var(--radius-md);
        }
        .no-prediction-list h4 {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-600);
          margin-bottom: var(--spacing-2);
        }
        .no-prediction-list ul {
          margin: 0;
          padding-left: var(--spacing-4);
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
        }
        .resumen-proyeccion-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          margin-top: var(--spacing-4);
        }
        .resumen-proyeccion-card .card-header {
          border-bottom-color: rgba(255, 255, 255, 0.2);
        }
        .resumen-proyeccion-card .card-title {
          color: white;
        }
        .resumen-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-4);
          padding: var(--spacing-4);
        }
        .resumen-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-3);
          background: rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-md);
        }
        .resumen-icon {
          font-size: 2rem;
        }
        .resumen-label {
          font-size: var(--font-size-sm);
          opacity: 0.9;
        }
        .resumen-value {
          font-size: var(--font-size-lg);
          font-weight: 700;
        }
        .inflacion-badge {
          background: #fef3c7;
          color: #92400e;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: var(--font-size-sm);
          font-weight: 600;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
        }
        .form-group label {
          font-weight: 600;
          font-size: var(--font-size-sm);
          color: var(--color-neutral-700);
        }
        .form-control {
          padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-size: var(--font-size-base);
        }
        .form-control:focus {
          outline: none;
          border-color: var(--color-primary-500);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
      `}</style>
        </div>
    )
}

function getConfidenceLevel(conf) {
    if (conf >= 0.7) return 'high'
    if (conf >= 0.4) return 'medium'
    return 'low'
}

function getMethodLabel(method) {
    const labels = {
        'modelo_producto': '🎯 Modelo específico',
        'modelo_global': '🌐 Modelo global',
        'producto_similar': '🔄 Similar',
        'sin_datos': '❓ Sin datos',
        'sin_modelo': '⚠️ Sin modelo'
    }
    return labels[method] || method
}

export default Proyecciones
