import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    productosApi,
    materiasPrimasApi,
    formulasApi,
    costeoApi,
    formatCurrency,
    formatNumber,
    getCategoryClass
} from '../services/api'
import './Formulacion.css'

function Formulacion() {
    const [searchParams] = useSearchParams()
    const [productos, setProductos] = useState([])
    const [materiasPrimas, setMateriasPrimas] = useState([])
    const [selectedProductoId, setSelectedProductoId] = useState(null)
    const [ingredientes, setIngredientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [newIngrediente, setNewIngrediente] = useState({ materia_prima_id: '', cantidad: '' })

    const selectedProducto = productos.find(p => p.id === selectedProductoId)

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (selectedProductoId) {
            loadFormula(selectedProductoId)
        }
    }, [selectedProductoId])

    async function loadInitialData() {
        setLoading(true)
        setError(null)
        try {
            const [productosData, mpData] = await Promise.all([
                productosApi.getAll(),
                materiasPrimasApi.getAll()
            ])
            setProductos(productosData)
            setMateriasPrimas(mpData)

            // Si hay un producto en la URL, seleccionarlo
            const productoIdFromUrl = searchParams.get('producto')
            if (productoIdFromUrl && productosData.some(p => p.id === parseInt(productoIdFromUrl))) {
                setSelectedProductoId(parseInt(productoIdFromUrl))
            } else if (productosData.length > 0) {
                setSelectedProductoId(productosData[0].id)
            }
        } catch (err) {
            console.error('Error loading data:', err)
            setError('Error al cargar los datos. Verifica que el backend esté corriendo.')
        } finally {
            setLoading(false)
        }
    }

    async function loadFormula(productoId) {
        try {
            const data = await formulasApi.getByProducto(productoId)
            setIngredientes(data.ingredientes || [])
        } catch (err) {
            console.error('Error loading formula:', err)
            setIngredientes([])
        }
    }

    // Calcular ingredientes con costos
    const ingredientesConCostos = useMemo(() => {
        return ingredientes.map(ing => {
            const mp = materiasPrimas.find(m => m.id === ing.materia_prima_id)
            if (!mp) return null
            const costoTotal = ing.cantidad * mp.costo_unitario
            return {
                ...ing,
                materiaPrima: mp,
                costoTotal,
            }
        }).filter(Boolean)
    }, [ingredientes, materiasPrimas])

    // Agrupar por tipo (Directa vs Indirecta/Envases)
    const { materiaPrimaDirecta, materiaPrimaIndirecta, envases } = useMemo(() => {
        const directa = ingredientesConCostos.filter(i =>
            ['CERDO', 'POLLO', 'GALLINA'].includes(i.materiaPrima.categoria)
        )
        const indirecta = ingredientesConCostos.filter(i =>
            i.materiaPrima.categoria === 'INSUMOS'
        )
        const env = ingredientesConCostos.filter(i =>
            i.materiaPrima.categoria === 'ENVASES'
        )
        return { materiaPrimaDirecta: directa, materiaPrimaIndirecta: indirecta, envases: env }
    }, [ingredientesConCostos])

    // Calcular totales por categoría
    const totalesPorCategoria = useMemo(() => {
        const totales = {}
        ingredientesConCostos.forEach(i => {
            const cat = i.materiaPrima.categoria
            if (!totales[cat]) {
                totales[cat] = { cantidad: 0, costo: 0 }
            }
            totales[cat].cantidad += i.cantidad
            totales[cat].costo += i.costoTotal
        })
        return totales
    }, [ingredientesConCostos])

    // Calcular resumen de costos
    const resumenCostos = useMemo(() => {
        const totalMateriaPrima = materiaPrimaDirecta.reduce((sum, i) => sum + i.costoTotal, 0) +
            materiaPrimaIndirecta.reduce((sum, i) => sum + i.costoTotal, 0)
        const totalEnvases = envases.reduce((sum, i) => sum + i.costoTotal, 0)

        // Calcular costo de merma (consistente con backend)
        const porcentajeMerma = selectedProducto?.porcentaje_merma || 0
        const costoMerma = totalMateriaPrima * (porcentajeMerma / 100)
        const materiaPrimaNeta = totalMateriaPrima + costoMerma
        const totalNeto = materiaPrimaNeta + totalEnvases

        // Calcular peso neto considerando rendimiento (Escenario B)
        const rendimiento = 100 - porcentajeMerma  // e.g., 100 - 3.6 = 96.4%
        const pesoNetoBatchKg = selectedProducto?.peso_batch_kg
            ? selectedProducto.peso_batch_kg * (rendimiento / 100)
            : 0

        const costoPorKg = pesoNetoBatchKg > 0
            ? totalNeto / pesoNetoBatchKg
            : 0

        return {
            totalMateriaPrimaDirecta: materiaPrimaDirecta.reduce((sum, i) => sum + i.costoTotal, 0),
            totalMateriaPrimaIndirecta: materiaPrimaIndirecta.reduce((sum, i) => sum + i.costoTotal, 0),
            totalMateriaPrima,
            costoMerma,
            materiaPrimaNeta,
            totalEnvases,
            totalNeto,
            pesoBatchKg: selectedProducto?.peso_batch_kg || 0,  // Peso bruto
            porcentajeMerma,
            rendimiento,
            pesoNetoBatchKg,  // Peso neto (después de merma)
            costoPorKg,
        }
    }, [materiaPrimaDirecta, materiaPrimaIndirecta, envases, selectedProducto])

    async function handleCantidadChange(id, value) {
        const newCantidad = parseFloat(value) || 0

        // Validar que la cantidad sea mayor a 0 antes de enviar al backend
        if (newCantidad <= 0) {
            // Solo actualizar localmente, no enviar al backend
            setIngredientes(prev => prev.map(i =>
                i.id === id ? { ...i, cantidad: newCantidad } : i
            ))
            return
        }

        setIngredientes(prev => prev.map(i =>
            i.id === id ? { ...i, cantidad: newCantidad } : i
        ))

        // Actualizar en el backend solo si es válido
        try {
            await formulasApi.updateIngrediente(id, { cantidad: newCantidad })
        } catch (err) {
            console.error('Error updating cantidad:', err)
            alert('Error al actualizar cantidad. La cantidad debe ser mayor a 0.')
        }
    }

    async function handleDeleteIngrediente(id) {
        try {
            await formulasApi.deleteIngrediente(id)
            setIngredientes(prev => prev.filter(i => i.id !== id))
        } catch (err) {
            console.error('Error deleting ingrediente:', err)
            alert('Error al eliminar el ingrediente')
        }
    }

    async function handleAddIngrediente(e) {
        e.preventDefault()
        if (!newIngrediente.materia_prima_id || !newIngrediente.cantidad) return

        setSaving(true)
        try {
            const result = await formulasApi.addIngrediente(selectedProductoId, {
                materia_prima_id: parseInt(newIngrediente.materia_prima_id),
                cantidad: parseFloat(newIngrediente.cantidad),
            })
            setIngredientes(prev => [...prev, result])
            setNewIngrediente({ materia_prima_id: '', cantidad: '' })
            setShowAddModal(false)
        } catch (err) {
            console.error('Error adding ingrediente:', err)
            alert('Error al agregar el ingrediente')
        } finally {
            setSaving(false)
        }
    }

    // Materias primas disponibles (no usadas aún)
    const materiasPrimasDisponibles = materiasPrimas.filter(mp =>
        !ingredientes.some(i => i.materia_prima_id === mp.id)
    )

    function renderIngredientesTable(items, title) {
        if (items.length === 0) return null
        return (
            <div className="ingredientes-section">
                <h4 className="section-title">{title}</h4>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Materia Prima</th>
                            <th>Categoría</th>
                            <th>Unidad</th>
                            <th className="text-right">Costo Unit.</th>
                            <th className="text-right" style={{ width: '120px' }}>Cantidad</th>
                            <th className="text-right">Costo Total</th>
                            <th style={{ width: '60px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => (
                            <tr key={item.id}>
                                <td><strong>{item.materiaPrima.nombre}</strong></td>
                                <td>
                                    <span className={`badge ${getCategoryClass(item.materiaPrima.categoria)}`}>
                                        {item.materiaPrima.categoria}
                                    </span>
                                </td>
                                <td>{item.materiaPrima.unidad}</td>
                                <td className="table-number">{formatCurrency(item.materiaPrima.costo_unitario)}</td>
                                <td className="table-number">
                                    <input
                                        type="number"
                                        className="inline-input"
                                        value={item.cantidad}
                                        onChange={(e) => handleCantidadChange(item.id, e.target.value)}
                                        step="0.001"
                                        min="0"
                                    />
                                </td>
                                <td className="table-number cost-cell">{formatCurrency(item.costoTotal)}</td>
                                <td>
                                    <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleDeleteIngrediente(item.id)}
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="subtotal-row">
                            <td colSpan="5" className="text-right"><strong>Subtotal {title}</strong></td>
                            <td className="table-number">
                                <strong>{formatCurrency(items.reduce((sum, i) => sum + i.costoTotal, 0))}</strong>
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando formulación...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="error-container">
                <div className="error-icon">⚠️</div>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={loadInitialData}>
                    Reintentar
                </button>
            </div>
        )
    }

    return (
        <div className="page-formulacion">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Formulación de Productos</h1>
                    <p className="page-subtitle">Define la receta y calcula costos por batch</p>
                </div>
                <button
                    className="btn btn-primary btn-lg"
                    onClick={() => setShowAddModal(true)}
                    disabled={!selectedProductoId}
                >
                    ➕ Agregar Ingrediente
                </button>
            </header>

            <div className="producto-selector card">
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Seleccionar Producto</label>
                    <select
                        className="form-input form-select"
                        value={selectedProductoId || ''}
                        onChange={(e) => setSelectedProductoId(parseInt(e.target.value))}
                    >
                        <option value="">Seleccionar...</option>
                        {productos.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.codigo} - {p.nombre}
                            </option>
                        ))}
                    </select>
                </div>
                {selectedProducto && (
                    <div className="producto-info">
                        <div className="info-item">
                            <span className="info-label">Peso Batch:</span>
                            <span className="info-value">{formatNumber(selectedProducto.peso_batch_kg, 3)} Kg</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Merma:</span>
                            <span className="info-value">{selectedProducto.porcentaje_merma}%</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Tiempo Batch:</span>
                            <span className="info-value">
                                {selectedProducto.peso_batch_kg > 0
                                    ? ((selectedProducto.min_mo_kg || 0) * selectedProducto.peso_batch_kg).toFixed(0)
                                    : 0} min
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {!selectedProductoId ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <div className="empty-state-title">Selecciona un producto</div>
                        <p>Elige un producto arriba para ver o editar su fórmula</p>
                    </div>
                </div>
            ) : (
                <div className="formula-content">
                    <div className="formula-table card">
                        {ingredientesConCostos.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📋</div>
                                <div className="empty-state-title">Sin ingredientes</div>
                                <p>Agrega ingredientes para comenzar a formular</p>
                                <button className="btn btn-primary mt-4" onClick={() => setShowAddModal(true)}>
                                    ➕ Agregar Ingrediente
                                </button>
                            </div>
                        ) : (
                            <>
                                {renderIngredientesTable(materiaPrimaDirecta, 'Materia Prima')}
                                {renderIngredientesTable(materiaPrimaIndirecta, 'Materia Prima Indirecta')}
                                {renderIngredientesTable(envases, 'Envases')}
                            </>
                        )}
                    </div>

                    <div className="cost-sidebar">
                        <div className="card cost-summary-card">
                            <h3 className="cost-summary-header">Resumen de Costos</h3>

                            <div className="cost-breakdown">
                                <div className="cost-line">
                                    <span>MP Directa (Carnes)</span>
                                    <span>{formatCurrency(resumenCostos.totalMateriaPrimaDirecta)}</span>
                                </div>
                                <div className="cost-line">
                                    <span>MP Indirecta (Insumos)</span>
                                    <span>{formatCurrency(resumenCostos.totalMateriaPrimaIndirecta)}</span>
                                </div>
                                <div className="cost-line subtotal">
                                    <span><strong>Total Materia Prima</strong></span>
                                    <span><strong>{formatCurrency(resumenCostos.totalMateriaPrima)}</strong></span>
                                </div>
                                <div className="cost-line">
                                    <span>Envases</span>
                                    <span>{formatCurrency(resumenCostos.totalEnvases)}</span>
                                </div>
                                <div className="cost-line subtotal">
                                    <span><strong>Total Costo Batch</strong></span>
                                    <span><strong>{formatCurrency(resumenCostos.totalNeto)}</strong></span>
                                </div>
                            </div>

                            <div className="cost-total">
                                <div className="cost-info-row">
                                    <span>Peso Bruto Batch (ingredientes):</span>
                                    <span>{formatNumber(resumenCostos.pesoBatchKg, 3)} Kg</span>
                                </div>
                                <div className="cost-info-row">
                                    <span>Rendimiento ({resumenCostos.rendimiento.toFixed(1)}%):</span>
                                    <span>{formatNumber(resumenCostos.pesoNetoBatchKg, 3)} Kg</span>
                                </div>
                                <div className="total-line highlight">
                                    <span>Costo por Kg</span>
                                    <span className="total-value">{formatCurrency(resumenCostos.costoPorKg)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="card category-summary">
                            <h4>Costos por Categoría</h4>
                            <div className="category-bars">
                                {Object.entries(totalesPorCategoria).map(([cat, data]) => (
                                    <div key={cat} className="category-item">
                                        <div className="category-header">
                                            <span className={`badge ${getCategoryClass(cat)}`}>{cat}</span>
                                            <span className="category-cost">{formatCurrency(data.costo)}</span>
                                        </div>
                                        <div className="category-bar-track">
                                            <div
                                                className={`category-bar-fill ${cat.toLowerCase()}`}
                                                style={{
                                                    width: `${resumenCostos.totalNeto ? (data.costo / resumenCostos.totalNeto * 100) : 0}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Agregar Ingrediente</h3>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleAddIngrediente}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Materia Prima *</label>
                                    <select
                                        className="form-input form-select"
                                        value={newIngrediente.materia_prima_id}
                                        onChange={(e) => setNewIngrediente(prev => ({ ...prev, materia_prima_id: e.target.value }))}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        {materiasPrimasDisponibles.map(mp => (
                                            <option key={mp.id} value={mp.id}>
                                                {mp.nombre} ({mp.categoria}) - {formatCurrency(mp.costo_unitario)}/{mp.unidad}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cantidad *</label>
                                    <input
                                        type="number"
                                        className="form-input form-input-number"
                                        value={newIngrediente.cantidad}
                                        onChange={(e) => setNewIngrediente(prev => ({ ...prev, cantidad: e.target.value }))}
                                        placeholder="0.00"
                                        step="0.001"
                                        min="0"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Agregando...' : 'Agregar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
        .loading-container, .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: var(--spacing-4);
        }
        .error-icon {
          font-size: 4rem;
        }
      `}</style>
        </div>
    )
}

export default Formulacion
