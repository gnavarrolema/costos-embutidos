import { Link } from 'react-router-dom'

function NotFound() {
    return (
        <div className="page-container">
            <div className="section-card" style={{ textAlign: 'center', marginTop: '2rem' }}>
                <h2>Página no encontrada</h2>
                <p>La ruta que buscás no existe o no está disponible.</p>
                <Link to="/" className="btn-primary" aria-label="Volver al dashboard">
                    Volver al Dashboard
                </Link>
            </div>
        </div>
    )
}

export default NotFound
