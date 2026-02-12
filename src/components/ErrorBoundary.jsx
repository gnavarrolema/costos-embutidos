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
    }

    handleReload = () => {
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
