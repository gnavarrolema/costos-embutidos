import { useState, useEffect } from 'react'
import { materiasPrimasApi, categoriasApi, formatCurrency, getCategoryClass } from '../services/api'

const CATEGORIAS = ['CERDO', 'POLLO', 'GALLINA', 'INSUMOS', 'ENVASES']
const UNIDADES = ['Kg', 'UND', 'Lt', 'Ml', 'Gr']

function MateriasPrimas() {
    const [materiasPrimas, setMateriasPrimas] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [showAjusteModal, setShowAjusteModal] = useState(false)
    const [showHistorialModal, setShowHistorialModal] = useState(false)
    const [historial, setHistorial] = useState([])
    const [loadingHistorial, setLoadingHistorial] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [filterCategoria, setFilterCategoria] = useState('')
    const [saving, setSaving] = useState(false)
    const [mensaje, setMensaje] = useState(null)
    const [ajusteData, setAjusteData] = useState({ porcentaje: '', categoria: '' })
    const [ajusteResultado, setAjusteResultado] = useState(null)
    const [formData, setFormData] = useState({
        codigo: '',
        nombre: '',
        categoria: 'INSUMOS',
        unidad: 'Kg',
        costo_unitario: '',
    })

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        setError(null)
        try {
            const data = await materiasPrimasApi.getAll()
            setMateriasPrimas(data)
        } catch (err) {
            console.error('Error loading materias primas:', err)
            setError('Error al cargar las materias primas. Verifica que el backend esté corriendo.')
        } finally {
            setLoading(false)
        }
    }

    function handleOpenModal(item = null) {
        if (item) {
            setEditingItem(item)
            setFormData({
                codigo: item.codigo || '',
                nombre: item.nombre,
                categoria: item.categoria,
                unidad: item.unidad,
                costo_unitario: item.costo_unitario.toString(),
            })
        } else {
            setEditingItem(null)
            setFormData({
                codigo: '',
                nombre: '',
                categoria: 'INSUMOS',
                unidad: 'Kg',
                costo_unitario: '',
            })
        }
        setShowModal(true)
    }

    function handleCloseModal() {
        setShowModal(false)
        setEditingItem(null)
    }

    function handleChange(e) {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setSaving(true)
        try {
            const data = {
                ...formData,
                costo_unitario: parseFloat(formData.costo_unitario) || 0,
            }

            if (editingItem) {
                await materiasPrimasApi.update(editingItem.id, data)
            } else {
                await materiasPrimasApi.create(data)
            }

            handleCloseModal()
            await loadData() // Recargar datos
        } catch (err) {
            console.error('Error saving:', err)
            alert('Error al guardar la materia prima')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        if (!confirm('¿Estás seguro de eliminar esta materia prima?')) return
        try {
            await materiasPrimasApi.delete(id)
            await loadData() // Recargar datos
        } catch (err) {
            console.error('Error deleting:', err)
            alert('Error al eliminar la materia prima')
        }
    }

    async function handleAjustePrecios(e) {
        e.preventDefault()
        setSaving(true)
        setAjusteResultado(null)
        try {
            const result = await materiasPrimasApi.ajustarPrecios(
                parseFloat(ajusteData.porcentaje),
                ajusteData.categoria || null
            )
            setAjusteResultado(result)
            setMensaje(`✅ Se ajustaron ${result.items_ajustados} materias primas con ${result.porcentaje_aplicado}%`)
            await loadData()
        } catch (err) {
            console.error('Error ajustando precios:', err)
            setMensaje(`❌ Error: ${err.message}`)
        } finally {
            setSaving(false)
        }
    }

    function handleCloseAjusteModal() {
        setShowAjusteModal(false)
        setAjusteData({ porcentaje: '', categoria: '' })
        setAjusteResultado(null)
    }

    async function handleOpenHistorialModal() {
        setShowHistorialModal(true)
        setLoadingHistorial(true)
        try {
            const data = await materiasPrimasApi.getHistorial(null, 100)
            setHistorial(data)
        } catch (err) {
            console.error('Error loading historial:', err)
            setMensaje(`❌ Error al cargar historial: ${err.message}`)
        } finally {
            setLoadingHistorial(false)
        }
    }

    async function handleDeshacerUltimoAjuste() {
        if (!confirm('¿Está seguro de que  desea deshacer el último ajuste masivo de precios? Esto revertirá todos los cambios del último ajuste.')) {
            return
        }

        setSaving(true)
        try {
            const result = await materiasPrimasApi.deshacerUltimoAjuste()
            setMensaje(`✅ Se revirtieron ${result.items_revertidos} precios al estado anterior`)
            await loadData() // Recargar materias primas
            await handleOpenHistorialModal() // Recargar historial
        } catch (err) {
            console.error('Error undoing adjustment:', err)
            setMensaje(`❌ Error: ${err.message}`)
        } finally {
            setSaving(false)
        }
    }

    const filteredItems = filterCategoria
        ? materiasPrimas.filter(mp => mp.categoria === filterCategoria)
        : materiasPrimas

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando materias primas...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="error-container">
                <div className="error-icon">⚠️</div>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={loadData}>
                    Reintentar
                </button>
            </div>
        )
    }

    return (
        <div className="page-materias-primas">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Materias Primas</h1>
                    <p className="page-subtitle">Gestiona ingredientes, insumos y envases</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={handleOpenHistorialModal}>
                        📜 Ver Historial
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowAjusteModal(true)}>
                        📈 Ajustar Precios
                    </button>
                    <button className="btn btn-primary btn-lg" onClick={() => handleOpenModal()}>
                        ➕ Nueva Materia Prima
                    </button>
                </div>
            </header>

            {mensaje && (
                <div className={`alert ${mensaje.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>
                    {mensaje}
                    <button className="alert-close" onClick={() => setMensaje(null)}>×</button>
                </div>
            )}

            <div className="filters-bar">
                <div className="filter-group">
                    <label className="filter-label">Filtrar por categoría:</label>
                    <select
                        className="form-input form-select"
                        value={filterCategoria}
                        onChange={(e) => setFilterCategoria(e.target.value)}
                    >
                        <option value="">Todas las categorías</option>
                        {CATEGORIAS.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-stats">
                    Mostrando {filteredItems.length} de {materiasPrimas.length} items
                </div>
            </div>

            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Nombre</th>
                                <th>Categoría</th>
                                <th>Unidad</th>
                                <th className="text-right">Costo Unitario</th>
                                <th className="text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="empty-state">
                                        <div className="empty-state-icon">📦</div>
                                        <div className="empty-state-title">No hay materias primas</div>
                                        <p>Comienza agregando una nueva materia prima</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(mp => (
                                    <tr key={mp.id}>
                                        <td className="font-mono">{mp.codigo || '-'}</td>
                                        <td><strong>{mp.nombre}</strong></td>
                                        <td>
                                            <span className={`badge ${getCategoryClass(mp.categoria)}`}>
                                                {mp.categoria}
                                            </span>
                                        </td>
                                        <td>{mp.unidad}</td>
                                        <td className="table-number">{formatCurrency(mp.costo_unitario)}</td>
                                        <td className="table-actions">
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleOpenModal(mp)}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDelete(mp.id)}
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingItem ? 'Editar Materia Prima' : 'Nueva Materia Prima'}
                            </h3>
                            <button className="modal-close" onClick={handleCloseModal}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Código</label>
                                        <input
                                            type="text"
                                            name="codigo"
                                            className="form-input"
                                            value={formData.codigo}
                                            onChange={handleChange}
                                            placeholder="Ej: 91101"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Unidad</label>
                                        <select
                                            name="unidad"
                                            className="form-input form-select"
                                            value={formData.unidad}
                                            onChange={handleChange}
                                        >
                                            {UNIDADES.map(u => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nombre *</label>
                                    <input
                                        type="text"
                                        name="nombre"
                                        className="form-input"
                                        value={formData.nombre}
                                        onChange={handleChange}
                                        placeholder="Ej: Recorte de Cerdo"
                                        required
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Categoría *</label>
                                        <select
                                            name="categoria"
                                            className="form-input form-select"
                                            value={formData.categoria}
                                            onChange={handleChange}
                                            required
                                        >
                                            {CATEGORIAS.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Costo Unitario (ARS) *</label>
                                        <input
                                            type="number"
                                            name="costo_unitario"
                                            className="form-input form-input-number"
                                            value={formData.costo_unitario}
                                            onChange={handleChange}
                                            placeholder="0.00"
                                            step="0.001"
                                            min="0"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Guardando...' : (editingItem ? 'Guardar Cambios' : 'Crear Materia Prima')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAjusteModal && (
                <div className="modal-overlay" onClick={handleCloseAjusteModal}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">📈 Ajustar Precios por Inflación</h3>
                            <button className="modal-close" onClick={handleCloseAjusteModal}>×</button>
                        </div>
                        <form onSubmit={handleAjustePrecios}>
                            <div className="modal-body">
                                <div className="ajuste-info">
                                    <p>Esta función ajustará los precios de las materias primas aplicando un porcentaje de incremento o decremento.</p>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Porcentaje de Ajuste *</label>
                                        <input
                                            type="number"
                                            className="form-input form-input-number"
                                            value={ajusteData.porcentaje}
                                            onChange={(e) => setAjusteData(prev => ({ ...prev, porcentaje: e.target.value }))}
                                            placeholder="5"
                                            step="0.1"
                                            required
                                        />
                                        <small className="form-help">Ej: 5 para aumentar 5%, -3 para reducir 3%</small>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Categoría</label>
                                        <select
                                            className="form-input form-select"
                                            value={ajusteData.categoria}
                                            onChange={(e) => setAjusteData(prev => ({ ...prev, categoria: e.target.value }))}
                                        >
                                            <option value="">Todas las categorías</option>
                                            {CATEGORIAS.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                        <small className="form-help">Opcional: seleccione para ajustar solo una categoría</small>
                                    </div>
                                </div>

                                {ajusteResultado && (
                                    <div className="ajuste-resultado">
                                        <h4>✅ Resultado del Ajuste</h4>
                                        <p><strong>{ajusteResultado.items_ajustados}</strong> items ajustados con <strong>{ajusteResultado.porcentaje_aplicado}%</strong></p>
                                        <div className="ajuste-detalle-table">
                                            <table className="table table-compact">
                                                <thead>
                                                    <tr>
                                                        <th>Materia Prima</th>
                                                        <th>Categoría</th>
                                                        <th className="text-right">Precio Anterior</th>
                                                        <th className="text-right">Precio Nuevo</th>
                                                        <th className="text-right">Diferencia</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ajusteResultado.detalle.slice(0, 10).map(item => (
                                                        <tr key={item.id}>
                                                            <td>{item.nombre}</td>
                                                            <td><span className={`badge ${getCategoryClass(item.categoria)}`}>{item.categoria}</span></td>
                                                            <td className="table-number">{formatCurrency(item.precio_anterior)}</td>
                                                            <td className="table-number">{formatCurrency(item.precio_nuevo)}</td>
                                                            <td className="table-number text-success">+{formatCurrency(item.diferencia)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {ajusteResultado.detalle.length > 10 && (
                                                <p className="text-muted text-sm">...y {ajusteResultado.detalle.length - 10} más</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseAjusteModal}>
                                    {ajusteResultado ? 'Cerrar' : 'Cancelar'}
                                </button>
                                {!ajusteResultado && (
                                    <button type="submit" className="btn btn-primary" disabled={saving || !ajusteData.porcentaje}>
                                        {saving ? 'Aplicando...' : '📈 Aplicar Ajuste'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showHistorialModal && (
                <div className="modal-overlay" onClick={() => setShowHistorialModal(false)}>
                    <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">📜 Historial de Cambios de Precios</h3>
                            <button className="modal-close" onClick={() => setShowHistorialModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {loadingHistorial ? (
                                <div className="loading-container" style={{ minHeight: '200px' }}>
                                    <div className="spinner"></div>
                                    <p>Cargando historial...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="historial-actions" style={{ marginBottom: 'var(--spacing-4)' }}>
                                        <button
                                            className="btn btn-warning"
                                            onClick={handleDeshacerUltimoAjuste}
                                            disabled={saving || !historial.some(h => h.tipo_cambio === 'AJUSTE_MASIVO')}
                                        >
                                            ⏪ Deshacer Último Ajuste Masivo
                                        </button>
                                    </div>
                                    <div className="table-container">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Fecha/Hora</th>
                                                    <th>Materia Prima</th>
                                                    <th className="text-right">Precio Anterior</th>
                                                    <th className="text-right">Precio Nuevo</th>
                                                    <th className="text-right">Cambio</th>
                                                    <th>Tipo</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historial.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" className="empty-state">
                                                            <div className="empty-state-icon">📋</div>
                                                            <div className="empty-state-title">No hay historial</div>
                                                            <p>Los cambios de precios aparecerán aquí</p>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    historial.map(h => (
                                                        <tr key={h.id}>
                                                            <td style={{ fontSize: 'var(--font-size-sm)' }}>
                                                                {new Date(h.fecha_cambio).toLocaleString('es-AR', {
                                                                    day: '2-digit',
                                                                    month: '2-digit',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </td>
                                                            <td><strong>{h.materia_prima_nombre}</strong></td>
                                                            <td className="table-number">{formatCurrency(h.precio_anterior)}</td>
                                                            <td className="table-number">{formatCurrency(h.precio_nuevo)}</td>
                                                            <td className={`table-number ${h.diferencia > 0 ? 'text-danger' : h.diferencia < 0 ? 'text-success' : ''}`}>
                                                                {h.porcentaje_aplicado ?
                                                                    `${h.porcentaje_aplicado > 0 ? '+' : ''}${h.porcentaje_aplicado}%` :
                                                                    `${h.diferencia > 0 ? '+' : ''}${formatCurrency(h.diferencia)}`
                                                                }
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${h.tipo_cambio === 'AJUSTE_MASIVO' ? 'badge-primary' :
                                                                        h.tipo_cambio === 'REVERSION' ? 'badge-warning' :
                                                                            'badge-secondary'
                                                                    }`}>
                                                                    {h.tipo_cambio.replace('_', ' ')}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowHistorialModal(false)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .header-actions {
          display: flex;
          gap: var(--spacing-3);
        }
        .alert {
          padding: var(--spacing-3) var(--spacing-4);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-4);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .alert-success {
          background: var(--color-success-light);
          color: var(--color-success-dark);
        }
        .alert-error {
          background: var(--color-danger-light);
          color: var(--color-danger);
        }
        .alert-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          opacity: 0.6;
        }
        .modal-lg {
          max-width: 700px;
        }
        .ajuste-info {
          background: var(--color-neutral-100);
          padding: var(--spacing-3);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-4);
        }
        .ajuste-info p {
          margin: 0;
          color: var(--color-neutral-600);
        }
        .ajuste-resultado {
          margin-top: var(--spacing-4);
          padding: var(--spacing-4);
          background: var(--color-success-light);
          border-radius: var(--radius-md);
        }
        .ajuste-resultado h4 {
          margin: 0 0 var(--spacing-2) 0;
        }
        .ajuste-detalle-table {
          margin-top: var(--spacing-3);
          max-height: 300px;
          overflow-y: auto;
        }
        .text-success {
          color: var(--color-success);
        }
        .filters-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-4);
          padding: var(--spacing-4);
          background: white;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }
        .filter-group {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
        }
        .filter-label {
          font-weight: 500;
          color: var(--color-neutral-600);
        }
        .filter-group .form-input {
          width: 200px;
        }
        .filter-stats {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-4);
        }
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: var(--spacing-4);
          text-align: center;
        }
        .error-icon {
          font-size: 4rem;
        }
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: var(--spacing-4);
          color: var(--color-neutral-500);
        }
      `}</style>
        </div>
    )
}

export default MateriasPrimas
