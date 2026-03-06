import React from 'react'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary capturó un error:', error, errorInfo)

        // Detectar error de chunk no encontrado (ocurre tras un re-deploy)
        // y recargar automáticamente una sola vez
        const isChunkError =
            error?.message?.includes('Failed to fetch dynamically imported module') ||
            error?.message?.includes('Loading chunk') ||
            error?.message?.includes('Loading CSS chunk') ||
            error?.name === 'ChunkLoadError'

        const RELOAD_KEY = 'error_boundary_auto_reload'
        const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY)

        if (isChunkError && !alreadyReloaded) {
            sessionStorage.setItem(RELOAD_KEY, 'true')
            window.location.reload()
            return
        }

        // Limpiar el flag para futuros errores genuinos
        if (!isChunkError) {
            sessionStorage.removeItem(RELOAD_KEY)
        }
    }

    handleReload = () => {
        sessionStorage.removeItem('error_boundary_auto_reload')
        window.location.reload()
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="loading-screen" role="alert" aria-live="assertive">
                    <h2>Ocurrió un error inesperado</h2>
                    <p>Podés recargar la aplicación para continuar.</p>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={this.handleReload}
                        aria-label="Recargar aplicación"
                    >
                        Recargar
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
