import { useState, useEffect, useMemo } from 'react'
import {
    productosApi,
    costeoApi,
    costosIndirectosApi,
    exportarApi,
    formatCurrency,
    formatNumber,
    getCategoryClass
} from '../services/api'
import { Calculator, TrendingUp, Coins, Zap, FileText } from 'lucide-react'
import './HojaCostos.css'

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
    for (let i = -12; i <= 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const label = `${MESES[date.getMonth()]} ${date.getFullYear()}`
        options.push({ value, label })
    }
    return options
}

function HojaCostos() {
    const [productos, setProductos] = useState([])
    const [selectedProductoId, setSelectedProductoId] = useState(null)
    const [mesBase, setMesBase] = useState(null)  // Se inicializará con el último mes que tenga costos
    const [mesProduccion, setMesProduccion] = useState(getCurrentMonth())
    const [costeo, setCosteo] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadingCosteo, setLoadingCosteo] = useState(false)
    const [error, setError] = useState(null)
    const [mesesConCostos, setMesesConCostos] = useState([])

    const monthOptions = useMemo(() => getMonthOptions(), [])
    const selectedProducto = productos.find(p => p.id === selectedProductoId)

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (selectedProductoId) {
            loadCosteoCompleto()
        }
    }, [selectedProductoId, mesBase, mesProduccion])

    async function loadInitialData() {
        setLoading(true)
        setError(null)
        try {
            const [productosData, costosData] = await Promise.all([
                productosApi.getAll(),
                costosIndirectosApi.getAll()
            ])
            setProductos(productosData)

            // Extraer meses únicos que tienen costos indirectos
            const meses = [...new Set(costosData.map(c => c.mes_base))].sort()
            setMesesConCostos(meses)

            // Inicializar mesBase con el último mes que tenga costos
            if (meses.length > 0) {
                setMesBase(meses[meses.length - 1])
            } else {
                // Si no hay costos, usar el mes actual como fallback
                setMesBase(getCurrentMonth())
            }

            if (productosData.length > 0) {
                setSelectedProductoId(productosData[0].id)
            }
        } catch (err) {
            console.error('Error loading data:', err)
            setError('Error al cargar los datos')
        } finally {
            setLoading(false)
        }
    }

    async function loadCosteoCompleto() {
        if (!selectedProductoId) return

        setLoadingCosteo(true)
        try {
            const data = await costeoApi.getCompleto(selectedProductoId, mesBase, mesProduccion)
            setCosteo(data)
        } catch (err) {
            console.error('Error loading costeo:', err)
            setCosteo(null)
        } finally {
            setLoadingCosteo(false)
        }
    }

    // Agrupar ingredientes por categoría
    const ingredientesPorCategoria = useMemo(() => {
        if (!costeo?.ingredientes) return {}

        const grupos = {}
        costeo.ingredientes.forEach(ing => {
            const cat = ing.categoria
            if (!grupos[cat]) grupos[cat] = []
            grupos[cat].push(ing)
        })
        return grupos
    }, [costeo])

    const categoriasOrdenadas = ['CERDO', 'POLLO', 'GALLINA', 'INSUMOS', 'ENVASES']

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando hoja de costos...</p>
            </div>
        )
    }
    return (
        <div className="page-hoja-costos">
            <header className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Calculator size={32} /> Hoja de Costos
                    </h1>
                    <p className="page-subtitle">Costeo completo por producto (Variable + Indirecto)</p>
                </div>
                {costeo && (
                    <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
                        <button
                            className="btn btn-success"
                            onClick={() => exportarApi.costeoProducto(selectedProductoId, mesBase, mesProduccion)}
                        >
                            📥 Excel
                        </button>
                        <button
                            className="btn btn-outline d-flex align-items-center gap-2"
                            onClick={() => exportarApi.pdfCosteoProducto(selectedProductoId, mesBase, mesProduccion)}
                            title="Descargar hoja de costos en PDF"
                        >
                            <FileText size={18} /> PDF
                        </button>
                    </div>
                )}
            </header>

            {/* Selectores */}
            <div className="card config-card">
                <div className="config-row">
                    <div className="config-item">
                        <label>📦 Producto</label>
                        <select
                            value={selectedProductoId || ''}
                            onChange={(e) => setSelectedProductoId(parseInt(e.target.value))}
                        >
                            {productos.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.codigo} - {p.nombre}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="config-item">
                        <label>📅 Mes Base Costos Indirectos</label>
                        <select value={mesBase} onChange={(e) => setMesBase(e.target.value)}>
                            {mesesConCostos.length > 0 ? (
                                mesesConCostos.map(m => (
                                    <option key={m} value={m}>{getMonthName(m)}</option>
                                ))
                            ) : (
                                monthOptions.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))
                            )}
                        </select>
                    </div>
                    <div className="config-item">
                        <label>🏭 Mes de Producción</label>
                        <select value={mesProduccion} onChange={(e) => setMesProduccion(e.target.value)}>
                            {monthOptions.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {loadingCosteo ? (
                <div className="loading-container small">
                    <div className="spinner"></div>
                    <p>Calculando costeo...</p>
                </div>
            ) : costeo ? (
                <div className="hoja-costos-content">
                    {/* Advertencias si existen */}
                    {costeo.advertencias && costeo.advertencias.length > 0 && (
                        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                            ⚠️ <strong>Advertencias:</strong>
                            <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
                                {costeo.advertencias.map((adv, i) => (
                                    <li key={i}>{adv}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {/* Encabezado del Producto */}
                    <div className="card producto-header-card">
                        <div className="producto-info">
                            <div className="producto-main">
                                <span className="producto-codigo">{costeo.producto?.codigo}</span>
                                <h2 className="producto-nombre">{costeo.producto?.nombre}</h2>
                            </div>
                            <div className="producto-stats">
                                <div className="stat">
                                    <span className="stat-label">Peso Batch</span>
                                    <span className="stat-value">{formatNumber(costeo.producto?.peso_batch_kg, 2)} Kg</span>
                                </div>
                                <div className="stat">
                                    <span className="stat-label">% Merma</span>
                                    <span className="stat-value">{formatNumber(costeo.producto?.porcentaje_merma, 2)}%</span>
                                </div>
                                <div className="stat">
                                    <span className="stat-label">Min M.O./Kg</span>
                                    <span className="stat-value">{formatNumber(costeo.producto?.min_mo_kg || 0, 2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desglose de Materia Prima */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">🥩 Costos Variables (Materia Prima)</h3>
                        </div>

                        {categoriasOrdenadas.map(cat => {
                            const items = ingredientesPorCategoria[cat]
                            if (!items || items.length === 0) return null

                            const totalCategoria = costeo.totales_categoria?.[cat]

                            return (
                                <div key={cat} className="categoria-section">
                                    <div className="categoria-header">
                                        <span className={`badge ${getCategoryClass(cat)} `}>{cat}</span>
                                        <span className="categoria-total">{formatCurrency(totalCategoria?.costo || 0)}</span>
                                    </div>
                                    <table className="table table-compact">
                                        <thead>
                                            <tr>
                                                <th>Ingrediente</th>
                                                <th className="text-right">Cantidad</th>
                                                <th className="text-right">Costo Unit.</th>
                                                <th className="text-right">Costo Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map(ing => (
                                                <tr key={ing.id}>
                                                    <td>{ing.nombre}</td>
                                                    <td className="table-number">{formatNumber(ing.cantidad, 3)} {ing.unidad}</td>
                                                    <td className="table-number">{formatCurrency(ing.costo_unitario)}</td>
                                                    <td className="table-number">{formatCurrency(ing.costo_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        })}

                        {/* Resumen de Costos Variables */}
                        <div className="resumen-section">
                            <table className="table table-resumen">
                                <tbody>
                                    <tr>
                                        <td>Total Materia Prima</td>
                                        <td className="text-right">{formatCurrency(costeo.resumen?.total_materia_prima)}</td>
                                    </tr>
                                    <tr>
                                        <td>Costo Merma ({formatNumber(costeo.producto?.porcentaje_merma, 2)}%)</td>
                                        <td className="text-right">{formatCurrency(costeo.resumen?.costo_merma)}</td>
                                    </tr>
                                    <tr className="row-subtotal">
                                        <td>Materia Prima Neta</td>
                                        <td className="text-right">{formatCurrency(costeo.resumen?.materia_prima_neta)}</td>
                                    </tr>
                                    <tr>
                                        <td>Envases</td>
                                        <td className="text-right">{formatCurrency(costeo.resumen?.total_envases)}</td>
                                    </tr>
                                    <tr className="row-total">
                                        <td><strong>Total Costo Variable (Batch)</strong></td>
                                        <td className="text-right"><strong>{formatCurrency(costeo.resumen?.total_neto)}</strong></td>
                                    </tr>
                                    <tr className="row-highlight">
                                        <td>Costo Variable por Kg</td>
                                        <td className="text-right">{formatCurrency(costeo.resumen?.costo_variable_por_kg || costeo.resumen?.costo_por_kg)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Costos Indirectos */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">🏭 Costos Indirectos (Conversión)</h3>
                            {costeo.costos_indirectos?.inflacion_acumulada_pct > 0 && (
                                <span className="inflacion-badge">
                                    📈 +{formatNumber(costeo.costos_indirectos.inflacion_acumulada_pct, 2)}% inflación
                                </span>
                            )}
                        </div>

                        {costeo.costos_indirectos?.error ? (
                            <div className="empty-state">
                                <p>⚠️ {costeo.costos_indirectos.error}</p>
                                <p className="text-muted">Cargue costos indirectos en el módulo correspondiente</p>
                            </div>
                        ) : costeo.costos_indirectos ? (
                            <>
                                <div className="indirectos-info">
                                    <div className="info-item">
                                        <span className="info-label">Mes Base</span>
                                        <span className="info-value">{getMonthName(costeo.costos_indirectos.mes_base)}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Mes Producción</span>
                                        <span className="info-value">{getMonthName(costeo.costos_indirectos.mes_produccion)}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Kg Producción</span>
                                        <span className="info-value">{formatNumber(costeo.costos_indirectos.kg_produccion, 2)} Kg</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Minutos M.O.</span>
                                        <span className="info-value">{formatNumber(costeo.costos_indirectos.minutos_mo, 2)} min</span>
                                    </div>
                                </div>

                                <table className="table table-resumen">
                                    <thead>
                                        <tr>
                                            <th>Concepto</th>
                                            <th className="text-right">% Participación</th>
                                            <th className="text-right">Costo Asignado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>
                                                <strong>Mano de Obra (SP)</strong>
                                                <div className="text-muted text-sm">Distribuido por minutos M.O.</div>
                                            </td>
                                            <td className="table-number">{formatNumber(costeo.costos_indirectos.pct_participacion_mo, 2)}%</td>
                                            <td className="table-number">{formatCurrency(costeo.costos_indirectos.costo_sp)}</td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <strong>Gastos Indirectos (GIF)</strong>
                                                <div className="text-muted text-sm">Distribuido por Kg producidos</div>
                                            </td>
                                            <td className="table-number">{formatNumber(costeo.costos_indirectos.pct_participacion_kg, 2)}%</td>
                                            <td className="table-number">{formatCurrency(costeo.costos_indirectos.costo_gif)}</td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <strong>Depreciación (DEP)</strong>
                                                <div className="text-muted text-sm">Distribuido por Kg producidos</div>
                                            </td>
                                            <td className="table-number">{formatNumber(costeo.costos_indirectos.pct_participacion_kg, 2)}%</td>
                                            <td className="table-number">{formatCurrency(costeo.costos_indirectos.costo_dep)}</td>
                                        </tr>
                                        <tr className="row-total">
                                            <td colSpan="2"><strong>Total Costo Indirecto</strong></td>
                                            <td className="text-right"><strong>{formatCurrency(costeo.costos_indirectos.costo_indirecto_total)}</strong></td>
                                        </tr>
                                        <tr className="row-highlight">
                                            <td colSpan="2">Costo Indirecto por Kg</td>
                                            <td className="text-right">{formatCurrency(costeo.costos_indirectos.costo_indirecto_por_kg)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </>
                        ) : (
                            <div className="empty-state">
                                <p>Sin información de costos indirectos</p>
                            </div>
                        )}
                    </div>

                    {/* Resumen Final */}
                    <div className="card card-resumen-final">
                        <div className="card-header">
                            <h3 className="card-title">💰 Resumen de Costo Total</h3>
                        </div>
                        <div className="resumen-final-grid">
                            <div className="resumen-item">
                                <div className="resumen-icon var">
                                    <TrendingUp size={24} />
                                </div>
                                <div className="resumen-content">
                                    <span className="resumen-label">Variable por Kg</span>
                                    <span className="resumen-value">{formatCurrency(costeo.resumen?.costo_variable_por_kg || costeo.resumen?.costo_por_kg)}</span>
                                </div>
                            </div>
                            <div className="resumen-item">
                                <div className="resumen-icon ind">
                                    <Coins size={24} />
                                </div>
                                <div className="resumen-content">
                                    <span className="resumen-label">Indirecto por Kg</span>
                                    <span className="resumen-value">{formatCurrency(costeo.resumen?.costo_indirecto_por_kg || 0)}</span>
                                </div>
                            </div>
                            <div className="resumen-item total">
                                <div className="resumen-icon tot">
                                    <Zap size={24} fill="currentColor" />
                                </div>
                                <div className="resumen-content">
                                    <span className="resumen-label">COSTO TOTAL por Kg</span>
                                    <span className="resumen-value">{formatCurrency(costeo.resumen?.costo_total_por_kg || costeo.resumen?.costo_por_kg)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="resumen-batch">
                            <div className="batch-item">
                                <span className="batch-label">Costo Total por Batch ({formatNumber(costeo.producto?.peso_batch_kg, 2)} Kg)</span>
                                <span className="batch-value">
                                    {formatCurrency((costeo.resumen?.costo_total_por_kg || costeo.resumen?.costo_por_kg) * (costeo.producto?.peso_batch_kg || 0))}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="empty-state">
                        <p>Seleccione un producto para ver su hoja de costos</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default HojaCostos
