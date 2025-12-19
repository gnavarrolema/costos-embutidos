import { useState, useEffect } from 'react'
import { productosApi, formatCurrency, formatNumber } from '../services/api'

function Productos() {
    const [productos, setProductos] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        codigo: '',
        nombre: '',
        peso_batch_kg: '',
        porcentaje_merma: '0.9',
        min_mo_kg: '0',
        min_batch: '0',
    })

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        setError(null)
        try {
            const data = await productosApi.getAll()
            setProductos(data)
        } catch (err) {
            console.error('Error loading productos:', err)
            setError('Error al cargar los productos. Verifica que el backend esté corriendo.')
        } finally {
            setLoading(false)
        }
    }

    function handleOpenModal(item = null) {
        if (item) {
            setEditingItem(item)
            setFormData({
                codigo: item.codigo,
                nombre: item.nombre,
                peso_batch_kg: item.peso_batch_kg.toString(),
                porcentaje_merma: item.porcentaje_merma.toString(),
                min_mo_kg: (item.min_mo_kg || 0).toString(),
                min_batch: ((item.min_mo_kg || 0) * item.peso_batch_kg).toFixed(1).replace(/\.0$/, '')
            })
        } else {
            setEditingItem(null)
            setFormData({
                codigo: '',
                nombre: '',
                peso_batch_kg: '',
                porcentaje_merma: '0.9',
                min_mo_kg: '0',
                min_batch: '0'
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

        if (name === 'min_mo_kg') {
            const minMoKg = parseFloat(value) || 0
            const pesoBatch = parseFloat(formData.peso_batch_kg) || 0
            const minBatch = pesoBatch > 0 ? (minMoKg * pesoBatch).toFixed(1).replace(/\.0$/, '') : '0'

            setFormData(prev => ({
                ...prev,
                [name]: value,
                min_batch: minBatch
            }))
        } else if (name === 'peso_batch_kg') {
            // Si cambia el peso, recalculamos min_batch manteniendo min_mo_kg constante
            // (El usuario ingresa el rendimiento min/kg como dato duro)

            const pesoBatch = parseFloat(value) || 0
            const minMoKg = parseFloat(formData.min_mo_kg) || 0
            const minBatch = pesoBatch > 0 ? (minMoKg * pesoBatch).toFixed(1).replace(/\.0$/, '') : '0'

            setFormData(prev => ({
                ...prev,
                [name]: value,
                min_batch: minBatch
            }))
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setSaving(true)
        try {
            const data = {
                ...formData,
                peso_batch_kg: parseFloat(formData.peso_batch_kg) || 0,
                porcentaje_merma: parseFloat(formData.porcentaje_merma) || 0,
                min_mo_kg: parseFloat(formData.min_mo_kg) || 0,
            }

            if (editingItem) {
                await productosApi.update(editingItem.id, data)
            } else {
                await productosApi.create(data)
            }

            handleCloseModal()
            await loadData()
        } catch (err) {
            console.error('Error saving:', err)
            alert('Error al guardar el producto')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return
        try {
            await productosApi.delete(id)
            await loadData()
        } catch (err) {
            console.error('Error deleting:', err)
            alert('Error al eliminar el producto')
        }
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando productos...</p>
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
        <div className="page-productos">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Productos</h1>
                    <p className="page-subtitle">Gestiona los productos finales de embutidos</p>
                </div>
                <button className="btn btn-primary btn-lg" onClick={() => handleOpenModal()}>
                    ➕ Nuevo Producto
                </button>
            </header>

            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Nombre del Producto</th>
                                <th className="text-right">Peso Batch (Kg)</th>
                                <th className="text-right">% Merma</th>
                                <th className="text-right">Min M.O./Kg</th>
                                <th className="text-center">Estado</th>
                                <th className="text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productos.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-state">
                                        <div className="empty-state-icon">🌭</div>
                                        <div className="empty-state-title">No hay productos</div>
                                        <p>Comienza agregando un nuevo producto</p>
                                    </td>
                                </tr>
                            ) : (
                                productos.map(p => (
                                    <tr key={p.id}>
                                        <td className="font-mono">{p.codigo}</td>
                                        <td><strong>{p.nombre}</strong></td>
                                        <td className="table-number">{formatNumber(p.peso_batch_kg, 3)} Kg</td>
                                        <td className="table-number">{formatNumber(p.porcentaje_merma, 2)}%</td>
                                        <td className="table-number">{formatNumber(p.min_mo_kg || 0, 2)}</td>
                                        <td className="text-center">
                                            <span className={`badge ${p.activo ? 'badge-activo' : 'badge-inactivo'}`}>
                                                {p.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="table-actions">
                                            <a
                                                href={`/formulacion?producto=${p.id}`}
                                                className="btn btn-sm btn-success"
                                                title="Ver/Editar Fórmula"
                                            >
                                                📋
                                            </a>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleOpenModal(p)}
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDelete(p.id)}
                                                title="Eliminar"
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
                                {editingItem ? 'Editar Producto' : 'Nuevo Producto'}
                            </h3>
                            <button className="modal-close" onClick={handleCloseModal}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Código *</label>
                                    <input
                                        type="text"
                                        name="codigo"
                                        className="form-input"
                                        value={formData.codigo}
                                        onChange={handleChange}
                                        placeholder="Ej: 05936"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nombre del Producto *</label>
                                    <input
                                        type="text"
                                        name="nombre"
                                        className="form-input"
                                        value={formData.nombre}
                                        onChange={handleChange}
                                        placeholder="Ej: Butifarra 1Kg"
                                        required
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Peso del Batch (Kg) *</label>
                                        <input
                                            type="number"
                                            name="peso_batch_kg"
                                            className="form-input form-input-number"
                                            value={formData.peso_batch_kg}
                                            onChange={handleChange}
                                            placeholder="100.00"
                                            step="0.001"
                                            min="0"
                                            required
                                        />
                                        <small className="form-help">Peso total del batch en Kilogramos</small>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Porcentaje de Merma (%) *</label>
                                        <input
                                            type="number"
                                            name="porcentaje_merma"
                                            className="form-input form-input-number"
                                            value={formData.porcentaje_merma}
                                            onChange={handleChange}
                                            placeholder="0.9"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            required
                                        />
                                        <small className="form-help">Pérdida esperada durante el proceso</small>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Minutos de Mano de Obra por Kg</label>
                                    <input
                                        type="number"
                                        name="min_mo_kg"
                                        className="form-input form-input-number"
                                        value={formData.min_mo_kg}
                                        onChange={handleChange}
                                        placeholder="0.5"
                                        step="0.01"
                                        min="0"
                                    />
                                    <small className="form-help">Minutos de trabajo necesarios para producir 1 Kg (para distribución de costos indirectos SP)</small>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tiempo por Batch (minutos)</label>
                                    <input
                                        type="number"
                                        name="min_batch"
                                        className="form-input form-input-number readonly-input"
                                        value={formData.min_batch}
                                        readOnly
                                        placeholder="120"
                                    />
                                    <small className="form-help">Calculado automáticamente: Min/Kg × Peso Batch</small>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Guardando...' : (editingItem ? 'Guardar Cambios' : 'Crear Producto')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-4);
        }
        .form-help {
          display: block;
          margin-top: var(--spacing-1);
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }
        .badge-activo {
          background: var(--color-success-light);
          color: var(--color-success);
        }
        .badge-inactivo {
          background: var(--color-neutral-200);
          color: var(--color-neutral-600);
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
        .readonly-input {
          background-color: var(--color-neutral-100);
          color: var(--color-neutral-600);
          cursor: not-allowed;
        }
      `}</style>
        </div>
    )
}

export default Productos
