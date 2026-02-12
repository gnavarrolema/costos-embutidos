import { useState, useEffect, useRef } from 'react'
import {
    Users,
    Plus,
    Edit2,
    Trash2,
    X,
    Save,
    Shield,
    User,
    Eye,
    Check,
    AlertCircle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Usuarios.css'

const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api'

function Usuarios() {
    const { token, user: currentUser } = useAuth()
    const [usuarios, setUsuarios] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        nombre: '',
        email: '',
        rol: 'usuario',
        activo: true
    })
    const [formError, setFormError] = useState('')
    const [saving, setSaving] = useState(false)
    const modalRef = useRef(null)
    const closeButtonRef = useRef(null)

    useEffect(() => {
        fetchUsuarios()
    }, [])

    const fetchUsuarios = async () => {
        try {
            setLoading(true)
            const response = await fetch(`${API_BASE}/usuarios`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            if (!response.ok) throw new Error('Error al cargar usuarios')
            const data = await response.json()
            setUsuarios(Array.isArray(data) ? data : (data.items || []))
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!modalOpen || !modalRef.current) {
            return
        }

        const modalElement = modalRef.current
        const focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])',
        ].join(',')

        const getFocusableElements = () =>
            Array.from(modalElement.querySelectorAll(focusableSelectors))

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                closeModal()
                return
            }

            if (event.key !== 'Tab') {
                return
            }

            const focusableElements = getFocusableElements()
            if (focusableElements.length === 0) {
                event.preventDefault()
                return
            }

            const firstElement = focusableElements[0]
            const lastElement = focusableElements[focusableElements.length - 1]
            const activeElement = document.activeElement

            if (event.shiftKey) {
                if (activeElement === firstElement || !modalElement.contains(activeElement)) {
                    event.preventDefault()
                    lastElement.focus()
                }
            } else if (activeElement === lastElement) {
                event.preventDefault()
                firstElement.focus()
            }
        }

        document.addEventListener('keydown', onKeyDown)
        const focusableElements = getFocusableElements()
        if (focusableElements.length > 0) {
            focusableElements[0].focus()
        } else if (closeButtonRef.current) {
            closeButtonRef.current.focus()
        }

        return () => {
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [modalOpen])

    const openModal = (user = null) => {
        if (user) {
            setEditingUser(user)
            setFormData({
                username: user.username,
                password: '', // No mostrar contraseña
                nombre: user.nombre,
                email: user.email || '',
                rol: user.rol,
                activo: user.activo
            })
        } else {
            setEditingUser(null)
            setFormData({
                username: '',
                password: '',
                nombre: '',
                email: '',
                rol: 'usuario',
                activo: true
            })
        }
        setFormError('')
        setModalOpen(true)
    }

    const closeModal = () => {
        setModalOpen(false)
        setEditingUser(null)
        setFormError('')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setFormError('')

        // Validaciones
        if (!formData.nombre.trim()) {
            setFormError('El nombre es requerido')
            return
        }

        if (!editingUser) {
            if (!formData.username.trim()) {
                setFormError('El nombre de usuario es requerido')
                return
            }
            if (!formData.password) {
                setFormError('La contraseña es requerida')
                return
            }
            if (formData.password.length < 4) {
                setFormError('La contraseña debe tener al menos 4 caracteres')
                return
            }
        }

        try {
            setSaving(true)
            const url = editingUser
                ? `${API_BASE}/usuarios/${editingUser.id}`
                : `${API_BASE}/usuarios`

            const body = editingUser
                ? {
                    nombre: formData.nombre,
                    email: formData.email || null,
                    rol: formData.rol,
                    activo: formData.activo,
                    ...(formData.password && { password: formData.password })
                }
                : formData

            const response = await fetch(url, {
                method: editingUser ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Error al guardar usuario')
            }

            closeModal()
            fetchUsuarios()
        } catch (err) {
            setFormError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (user) => {
        if (user.id === currentUser.id) {
            alert('No puedes eliminar tu propio usuario')
            return
        }

        if (!window.confirm(`¿Está seguro de eliminar al usuario "${user.nombre}"?`)) {
            return
        }

        try {
            const response = await fetch(`${API_BASE}/usuarios/${user.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Error al eliminar usuario')
            }

            fetchUsuarios()
        } catch (err) {
            alert(err.message)
        }
    }

    const getRolIcon = (rol) => {
        switch (rol) {
            case 'admin':
                return <Shield size={16} className="rol-icon admin" />
            case 'usuario':
                return <User size={16} className="rol-icon user" />
            case 'lectura':
                return <Eye size={16} className="rol-icon reader" />
            default:
                return <User size={16} className="rol-icon" />
        }
    }

    const getRolLabel = (rol) => {
        switch (rol) {
            case 'admin': return 'Administrador'
            case 'usuario': return 'Usuario'
            case 'lectura': return 'Solo lectura'
            default: return rol
        }
    }

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Cargando usuarios...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <Users size={24} />
                    </div>
                    <div>
                        <h1>Administración de Usuarios</h1>
                        <p>Gestione los usuarios del sistema</p>
                    </div>
                </div>
                <button className="btn-primary" onClick={() => openModal()}>
                    <Plus size={18} />
                    Nuevo Usuario
                </button>
            </div>

            {error && (
                <div className="error-message">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            <div className="card">
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Rol</th>
                                <th>Estado</th>
                                <th>Último acceso</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usuarios.map(user => (
                                <tr key={user.id} className={!user.activo ? 'inactive-row' : ''}>
                                    <td className="user-cell">
                                        <div className="user-avatar">
                                            {user.nombre.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </div>
                                        <div className="user-info">
                                            <span className="username">
                                                {user.username}
                                                {user.id === currentUser.id && (
                                                    <span className="current-badge">Tú</span>
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    <td>{user.nombre}</td>
                                    <td>{user.email || '-'}</td>
                                    <td>
                                        <span className={`rol-badge ${user.rol}`}>
                                            {getRolIcon(user.rol)}
                                            {getRolLabel(user.rol)}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${user.activo ? 'active' : 'inactive'}`}>
                                            {user.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        {user.ultimo_login
                                            ? new Date(user.ultimo_login).toLocaleString('es-ES', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                            : 'Nunca'
                                        }
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button
                                                className="btn-icon"
                                                onClick={() => openModal(user)}
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            {user.id !== currentUser.id && (
                                                <button
                                                    className="btn-icon danger"
                                                    onClick={() => handleDelete(user)}
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div
                        className="modal"
                        onClick={e => e.stopPropagation()}
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="usuarios-modal-title"
                    >
                        <div className="modal-header">
                            <h2 id="usuarios-modal-title">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                            <button className="btn-close" onClick={closeModal} aria-label="Cerrar modal" ref={closeButtonRef}>
                                <X size={20} />
                            </button>
                        </div>

                        {formError && (
                            <div className="form-error">
                                <AlertCircle size={16} />
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Nombre de usuario</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    disabled={!!editingUser}
                                    placeholder="Ingrese nombre de usuario"
                                />
                                {editingUser && (
                                    <small className="form-hint">El nombre de usuario no se puede cambiar</small>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Nombre completo *</label>
                                <input
                                    type="text"
                                    value={formData.nombre}
                                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                    placeholder="Ingrese nombre completo"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="correo@ejemplo.com"
                                />
                            </div>

                            <div className="form-group">
                                <label>{editingUser ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña *'}</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    placeholder={editingUser ? '••••••••' : 'Ingrese contraseña'}
                                    required={!editingUser}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Rol</label>
                                    <select
                                        value={formData.rol}
                                        onChange={e => setFormData({ ...formData, rol: e.target.value })}
                                    >
                                        <option value="usuario">Usuario</option>
                                        <option value="admin">Administrador</option>
                                        <option value="lectura">Solo lectura</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Estado</label>
                                    <select
                                        value={formData.activo ? 'true' : 'false'}
                                        onChange={e => setFormData({ ...formData, activo: e.target.value === 'true' })}
                                        disabled={editingUser?.id === currentUser.id}
                                    >
                                        <option value="true">Activo</option>
                                        <option value="false">Inactivo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? (
                                        <>
                                            <span className="spinner-small"></span>
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            Guardar
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Usuarios
