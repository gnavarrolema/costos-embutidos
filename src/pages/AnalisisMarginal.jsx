import { useState, useEffect, useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import {
    analisisMarginalApi,
    costosIndirectosApi,
    materiasPrimasApi,
    formatCurrency,
    formatNumber,
} from '../services/api'
import './AnalisisMarginal.css'

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function getMonthOptions() {
    const options = []
    const now = new Date()
    for (let i = -12; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = `${MESES[d.getMonth()]} ${d.getFullYear()}`
        options.push({ value, label })
    }
    return options
}

function getCurrentMonth() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const TIPOS_ESCENARIO = [
    { id: '', label: 'Sin escenario' },
    { id: 'inflacion', label: 'Inflación diferente' },
    { id: 'materia_prima', label: 'Precio de MP' },
    { id: 'categoria', label: 'Categoría completa' },
    { id: 'indirectos', label: 'Costos indirectos' },
    { id: 'produccion', label: 'Volumen producción' },
]

export default function AnalisisMarginal() {
    const [mesBase, setMesBase] = useState(null)
    const [mesProduccion, setMesProduccion] = useState(getCurrentMonth())
    const [mesesConCostos, setMesesConCostos] = useState([])
    const [materiasPrimas, setMateriasPrimas] = useState([])
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadingData, setLoadingData] = useState(false)
    const [error, setError] = useState(null)

    // Escenario
    const [escTipo, setEscTipo] = useState('')
    const [escValor, setEscValor] = useState('')
    const [escExtra, setEscExtra] = useState('')

    const monthOptions = useMemo(() => getMonthOptions(), [])
    const categorias = useMemo(() => {
        return [...new Set(materiasPrimas.map(mp => mp.categoria))].filter(Boolean)
    }, [materiasPrimas])

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (mesBase && mesProduccion) {
            loadAnalisis()
        }
    }, [mesBase, mesProduccion, escTipo, escValor, escExtra])

    async function loadInitialData() {
        setLoading(true)
        try {
            const [costosData, mpData] = await Promise.all([
                costosIndirectosApi.getAll(),
                materiasPrimasApi.getAll()
            ])

            setMateriasPrimas(mpData)

            const meses = [...new Set(costosData.map(c => c.mes_base))].sort()
            setMesesConCostos(meses)

            if (meses.length > 0) {
                setMesBase(meses[meses.length - 1])
            }
        } catch (err) {
            setError('Error al cargar datos iniciales')
        } finally {
            setLoading(false)
        }
    }

    async function loadAnalisis() {
        if (!mesBase || !mesProduccion) return
        setLoadingData(true)
        setError(null)
        try {
            const escenario = escTipo ? {
                tipo: escTipo,
                valor: escValor ? parseFloat(escValor) : null,
                extra: escExtra || null,
            } : null
            const result = await analisisMarginalApi.get(mesBase, mesProduccion, escenario)
            setData(result)
        } catch (err) {
            if (err.name === 'AbortError') return
            setData(null)
            setError(err.message)
        } finally {
            setLoadingData(false)
        }
    }

    function getMcClass(pct) {
        if (pct >= 50) return 'alto'
        if (pct >= 30) return 'medio'
        return 'bajo'
    }

    function getMarkupClass(val) {
        return val >= 0 ? 'positivo' : 'negativo'
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando...</p>
            </div>
        )
    }

    return (
        <div className="page-analisis-marginal">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <TrendingUp size={28} />
                        Análisis Marginal
                    </h1>
                    <p className="page-subtitle">
                        Cuadro de rentabilidad, punto de equilibrio y margen de contribución por producto
                    </p>
                </div>
            </div>

            {/* Configuración */}
            <div className="am-config-card">
                <div className="am-config-row">
                    <div className="am-config-item">
                        <label>Mes base costos</label>
                        <select value={mesBase || ''} onChange={e => setMesBase(e.target.value)}>
                            <option value="">Seleccionar</option>
                            {mesesConCostos.map(m => (
                                <option key={m} value={m}>
                                    {`${MESES[parseInt(m.split('-')[1]) - 1]} ${m.split('-')[0]}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="am-config-item">
                        <label>Mes producción</label>
                        <select value={mesProduccion} onChange={e => setMesProduccion(e.target.value)}>
                            {monthOptions.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    {data && (
                        <div className="am-config-item">
                            <label>Inflación acumulada</label>
                            <span className="config-badge inflacion">
                                {formatNumber(data.inflacion_acumulada_pct)}%
                            </span>
                        </div>
                    )}
                </div>

                {/* Escenario */}
                <div className="am-escenario-group">
                    <div className="am-config-item">
                        <label>Escenario</label>
                        <select value={escTipo} onChange={e => { setEscTipo(e.target.value); setEscValor(''); setEscExtra('') }}>
                            {TIPOS_ESCENARIO.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {escTipo && (
                        <div className="am-config-item">
                            <label>Variación %</label>
                            <input
                                type="number"
                                step="0.1"
                                value={escValor}
                                onChange={e => setEscValor(e.target.value)}
                                placeholder="Ej: 10"
                            />
                        </div>
                    )}

                    {escTipo === 'materia_prima' && (
                        <div className="am-config-item">
                            <label>Materia prima</label>
                            <select value={escExtra} onChange={e => setEscExtra(e.target.value)}>
                                <option value="">Seleccionar</option>
                                {materiasPrimas.map(mp => (
                                    <option key={mp.id} value={mp.id}>{mp.nombre}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {escTipo === 'categoria' && (
                        <div className="am-config-item">
                            <label>Categoría</label>
                            <select value={escExtra} onChange={e => setEscExtra(e.target.value)}>
                                <option value="">Seleccionar</option>
                                {categorias.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Loading */}
            {loadingData && (
                <div className="loading-container small">
                    <div className="spinner"></div>
                    <p>Calculando análisis...</p>
                </div>
            )}

            {/* Error */}
            {error && !loadingData && (
                <div className="am-empty">
                    <div className="am-empty-icon">⚠️</div>
                    <p>{error}</p>
                </div>
            )}

            {/* Datos */}
            {data && !loadingData && (
                <>
                    {/* Resumen */}
                    <div className="am-resumen-grid">
                        <div className="am-resumen-card">
                            <div className="label">Producción Total</div>
                            <div className="value azul">{formatNumber(data.totales.total_produccion_kg, 0)} kg</div>
                        </div>
                        <div className="am-resumen-card">
                            <div className="label">Precio Ponderado</div>
                            <div className="value">{formatCurrency(data.totales.precio_ponderado)}</div>
                        </div>
                        <div className="am-resumen-card">
                            <div className="label">Markup Ponderado</div>
                            <div className={`value ${data.totales.markup_ponderado >= 0 ? 'verde' : 'rojo'}`}>
                                {formatNumber(data.totales.markup_ponderado)}%
                            </div>
                        </div>
                        <div className="am-resumen-card">
                            <div className="label">Margen Contribución</div>
                            <div className={`value ${data.totales.margen_contribucion_pct >= 40 ? 'verde' : 'rojo'}`}>
                                {formatNumber(data.totales.margen_contribucion_pct)}%
                            </div>
                        </div>
                        <div className="am-resumen-card">
                            <div className="label">Punto de Equilibrio</div>
                            <div className="value azul">{formatNumber(data.totales.punto_equilibrio_kg, 0)} kg</div>
                        </div>
                    </div>

                    {/* Tabla */}
                    <div className="am-table-wrapper">
                        <table className="am-table">
                            <thead>
                                <tr>
                                    <th>Productos</th>
                                    <th>Precio Unitario S/IVA ($/kg)</th>
                                    <th>Costo Variable Unitario ($/kg)</th>
                                    <th>Costo Fijo Unitario ($)</th>
                                    <th>Costo Unitario por kg Producido ($)</th>
                                    <th>Proporción CV/CT</th>
                                    <th>Markup por producto</th>
                                    <th>Producción en kg</th>
                                    <th>Costo Fijo Total Atribuido ($)</th>
                                    <th>Punto de Equilibrio (kg)</th>
                                    <th>Margen de Contribución (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.filas.map(fila => (
                                    <tr key={fila.producto_id}>
                                        <td>
                                            <div className="producto-cell">
                                                <span>{fila.producto_nombre}</span>
                                                <span className="codigo">{fila.producto_codigo}</span>
                                            </div>
                                        </td>
                                        <td className="am-cell-precio">
                                            {fila.precio_venta > 0
                                                ? formatCurrency(fila.precio_venta)
                                                : <span className="sin-precio">Sin precio</span>
                                            }
                                        </td>
                                        <td className="am-cell-cv">{formatCurrency(fila.costo_variable_unitario)}</td>
                                        <td className="am-cell-cf">{formatCurrency(fila.costo_fijo_unitario)}</td>
                                        <td className="am-cell-ct">{formatCurrency(fila.costo_unitario_total)}</td>
                                        <td>{formatNumber(fila.proporcion_cv_ct)}%</td>
                                        <td className={`am-cell-markup ${getMarkupClass(fila.markup)}`}>
                                            <span className="markup-icon">{fila.markup >= 0 ? '▲' : '▼'}</span>
                                            {formatNumber(fila.markup)}%
                                        </td>
                                        <td className="am-cell-produccion">{formatNumber(fila.produccion_kg, 0)}</td>
                                        <td className="am-cell-cf-total">{formatCurrency(fila.costo_fijo_total_producto)}</td>
                                        <td className="am-cell-pe">
                                            {fila.precio_venta > 0
                                                ? formatNumber(fila.punto_equilibrio_kg, 0)
                                                : <span className="sin-precio">-</span>
                                            }
                                        </td>
                                        <td className={`am-cell-mc ${getMcClass(fila.margen_contribucion_pct)}`}>
                                            {fila.precio_venta > 0
                                                ? `${formatNumber(fila.margen_contribucion_pct)}%`
                                                : <span className="sin-precio">-</span>
                                            }
                                        </td>
                                    </tr>
                                ))}

                                {/* Fila Totales */}
                                <tr className="fila-total">
                                    <td>Σ Total Ponderado</td>
                                    <td className="am-cell-precio">{formatCurrency(data.totales.precio_ponderado)}</td>
                                    <td className="am-cell-cv">{formatCurrency(data.totales.costo_variable_ponderado)}</td>
                                    <td className="am-cell-cf">{formatCurrency(data.totales.costo_fijo_ponderado)}</td>
                                    <td className="am-cell-ct">{formatCurrency(data.totales.costo_total_ponderado)}</td>
                                    <td>{formatNumber(data.totales.proporcion_cv_ct)}%</td>
                                    <td className={`am-cell-markup ${getMarkupClass(data.totales.markup_ponderado)}`}>
                                        {formatNumber(data.totales.markup_ponderado)}%
                                    </td>
                                    <td className="am-cell-produccion">{formatNumber(data.totales.total_produccion_kg, 0)}</td>
                                    <td className="am-cell-cf-total">{formatCurrency(data.totales.total_costo_fijo)}</td>
                                    <td className="am-cell-pe">{formatNumber(data.totales.punto_equilibrio_kg, 0)}</td>
                                    <td className={`am-cell-mc ${getMcClass(data.totales.margen_contribucion_pct)}`}>
                                        {formatNumber(data.totales.margen_contribucion_pct)}%
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Sin datos */}
            {!data && !loading && !loadingData && !error && (
                <div className="am-empty">
                    <div className="am-empty-icon">📊</div>
                    <p>Seleccioná un mes base y un mes de producción para generar el análisis marginal.</p>
                </div>
            )}
        </div>
    )
}
