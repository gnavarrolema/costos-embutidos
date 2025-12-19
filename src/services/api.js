const API_BASE = '/api'
const TOKEN_KEY = 'costos_embutidos_token'

// Obtener token del localStorage
function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY)
}

// Helper para manejar respuestas
async function handleResponse(response) {
    // Si el token expiró o es inválido, redirigir a login
    if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem('costos_embutidos_user')
        window.location.reload() // Forzar recarga para mostrar login
        throw new Error('Sesión expirada. Por favor, inicie sesión nuevamente.')
    }
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Error en la solicitud')
    }
    return response.json()
}

// Helper para requests (con autenticación automática)
async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`
    const token = getAuthToken()
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    }
    const response = await fetch(url, config)
    return handleResponse(response)
}

// ===== CATEGORÍAS =====
export const categoriasApi = {
    getAll: () => request('/categorias'),
    create: (data) => request('/categorias', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
}

// ===== MATERIAS PRIMAS =====
export const materiasPrimasApi = {
    getAll: () => request('/materias-primas'),
    getById: (id) => request(`/materias-primas/${id}`),
    create: (data) => request('/materias-primas', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/materias-primas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/materias-primas/${id}`, {
        method: 'DELETE',
    }),
    ajustarPrecios: (porcentaje, categoria = null) => request('/materias-primas/ajustar-precios', {
        method: 'POST',
        body: JSON.stringify({ porcentaje, categoria }),
    }),
    getHistorial: (materiaPrimaId = null, limit = 100) => {
        let url = '/materias-primas/historial'
        const params = []
        if (materiaPrimaId) params.push(`materia_prima_id=${materiaPrimaId}`)
        if (limit) params.push(`limit=${limit}`)
        if (params.length > 0) url += `?${params.join('&')}`
        return request(url)
    },
    deshacerUltimoAjuste: () => request('/materias-primas/deshacer-ajuste', {
        method: 'POST',
    }),
}

// ===== PRODUCTOS =====
export const productosApi = {
    getAll: () => request('/productos'),
    getById: (id) => request(`/productos/${id}`),
    create: (data) => request('/productos', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/productos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/productos/${id}`, {
        method: 'DELETE',
    }),
    getFormula: (id) => request(`/productos/${id}/formula`),
}

// ===== FÓRMULAS =====
export const formulasApi = {
    getByProducto: (productoId) => request(`/formulas/${productoId}`),
    save: (productoId, ingredientes) => request(`/formulas/${productoId}`, {
        method: 'POST',
        body: JSON.stringify({ ingredientes }),
    }),
    addIngrediente: (productoId, data) => request(`/formulas/${productoId}/ingrediente`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateIngrediente: (id, data) => request(`/formulas/ingrediente/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    deleteIngrediente: (id) => request(`/formulas/ingrediente/${id}`, {
        method: 'DELETE',
    }),
}

// ===== PRODUCCIÓN PROGRAMADA =====
export const produccionApi = {
    getAll: (mes = null) => request(mes ? `/produccion-programada?mes=${mes}` : '/produccion-programada'),
    create: (data) => request('/produccion-programada', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/produccion-programada/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/produccion-programada/${id}`, {
        method: 'DELETE',
    }),
    getRequerimientos: (mes = null) => request(mes ? `/requerimientos?mes=${mes}` : '/requerimientos'),
    getResumenMensual: (mes = null) => request(mes ? `/resumen-mensual?mes=${mes}` : '/resumen-mensual'),
}

// ===== COSTEO =====
export const costeoApi = {
    getByProducto: (productoId) => request(`/costeo/${productoId}`),
    getCompleto: (productoId, mesBase = null, mesProduccion = null) => {
        let url = `/costeo/${productoId}/completo`
        const params = []
        if (mesBase) params.push(`mes_base=${mesBase}`)
        if (mesProduccion) params.push(`mes_produccion=${mesProduccion}`)
        if (params.length > 0) url += `?${params.join('&')}`
        return request(url)
    },
    getResumen: () => request('/costeo/resumen'),
}

// ===== ML / PREDICCIONES =====
export const mlApi = {
    getStatus: () => request('/ml/status'),
    importExcel: () => request('/ml/import', { method: 'POST' }),
    train: () => request('/ml/train', { method: 'POST' }),
    predict: (año, mes, productosIds = null) => request('/ml/predict', {
        method: 'POST',
        body: JSON.stringify({ año, mes, productos_ids: productosIds }),
    }),
    predictProducto: (productoId, año, mes, similarId = null) => {
        let url = `/ml/predict/${productoId}?año=${año}&mes=${mes}`
        if (similarId) url += `&similar_id=${similarId}`
        return request(url)
    },
}

// ===== PRODUCCIÓN HISTÓRICA =====
export const historicoApi = {
    getAll: (productoId = null) => request(productoId ? `/produccion-historica?producto_id=${productoId}` : '/produccion-historica'),
    getResumen: () => request('/produccion-historica/resumen'),
}

// ===== COSTOS INDIRECTOS =====
export const costosIndirectosApi = {
    getAll: (mesBase = null) => request(mesBase ? `/costos-indirectos?mes_base=${mesBase}` : '/costos-indirectos'),
    getResumen: (mesBase) => request(`/costos-indirectos/resumen?mes_base=${mesBase}`),
    create: (data) => request('/costos-indirectos', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/costos-indirectos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/costos-indirectos/${id}`, {
        method: 'DELETE',
    }),
}

// ===== INFLACIÓN =====
export const inflacionApi = {
    getAll: () => request('/inflacion'),
    create: (data) => request('/inflacion', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/inflacion/${id}`, {
        method: 'DELETE',
    }),
}

// ===== DISTRIBUCIÓN DE COSTOS =====
export const distribucionApi = {
    calcular: (mesBase, mesProduccion) =>
        request(`/distribucion-costos?mes_base=${mesBase}&mes_produccion=${mesProduccion}`),
}

// ===== PROYECCIÓN MULTI-PERÍODO =====
export const proyeccionApi = {
    generarMultiPeriodo: (mesInicio, mesFin, mesBase, modo = 'mixto') =>
        request('/proyeccion-multiperiodo', {
            method: 'POST',
            body: JSON.stringify({
                mes_inicio: mesInicio,
                mes_fin: mesFin,
                mes_base_costos: mesBase,
                modo
            })
        }),
}


// ===== EXPORTACIÓN A EXCEL =====
export const exportarApi = {
    costeoProducto: (productoId, mesBase = null, mesProduccion = null) => {
        let url = `${API_BASE}/exportar/costeo/${productoId}`
        const params = []
        if (mesBase) params.push(`mes_base=${mesBase}`)
        if (mesProduccion) params.push(`mes_produccion=${mesProduccion}`)
        if (params.length > 0) url += `?${params.join('&')}`
        window.open(url, '_blank')
    },
    produccion: (mes) => {
        window.open(`${API_BASE}/exportar/produccion?mes=${mes}`, '_blank')
    },
    requerimientos: (mes) => {
        window.open(`${API_BASE}/exportar/requerimientos?mes=${mes}`, '_blank')
    },
}

// ===== UTILIDADES =====
export function formatCurrency(value) {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value)
}

export function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value)
}

export function parseCurrency(str) {
    if (!str) return 0
    // Remove currency symbol and thousands separators, replace decimal comma with dot
    const cleaned = str.toString()
        .replace(/[^0-9,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
    return parseFloat(cleaned) || 0
}

// Colores por categoría
export const categoryColors = {
    CERDO: { bg: 'var(--color-cerdo-light)', text: 'var(--color-cerdo)', class: 'badge-cerdo' },
    POLLO: { bg: 'var(--color-pollo-light)', text: '#b45309', class: 'badge-pollo' },
    GALLINA: { bg: 'var(--color-gallina-light)', text: 'var(--color-gallina)', class: 'badge-gallina' },
    INSUMOS: { bg: 'var(--color-insumos-light)', text: '#1d4ed8', class: 'badge-insumos' },
    ENVASES: { bg: 'var(--color-envases-light)', text: '#15803d', class: 'badge-envases' },
}

export function getCategoryClass(categoria) {
    const cat = categoria?.toUpperCase?.() || ''
    return categoryColors[cat]?.class || 'badge-insumos'
}
