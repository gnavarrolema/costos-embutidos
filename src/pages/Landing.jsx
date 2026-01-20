import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    BarChart3,
    ArrowRight,
    FileText,
    Download,
    Package,
    Calculator,
    Brain,
    Waypoints,
    Factory,
    TrendingUp,
    Shield,
    Zap,
    CheckCircle2,
    ChevronDown,
    Star,
    BarChart2,
    Menu,
    X
} from 'lucide-react'
import './Landing.css'

// API base URL
const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api'

function Landing() {
    const navigate = useNavigate()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    // Scroll reveal logic
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20)
        }

        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal-visible')
                }
            })
        }, observerOptions)

        window.addEventListener('scroll', handleScroll)

        const revealElements = document.querySelectorAll('.reveal')
        revealElements.forEach(el => observer.observe(el))

        return () => {
            window.removeEventListener('scroll', handleScroll)
            revealElements.forEach(el => observer.unobserve(el))
        }
    }, [])

    const handleDownloadGuide = async () => {
        try {
            const response = await fetch(`${API_BASE}/download-guide`)
            if (!response.ok) throw new Error('Error al descargar')

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'Guia_Usuario_Costos_Embutidos.pdf'
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            a.remove()
        } catch (error) {
            console.error('Error descargando guía:', error)
            alert('Error al descargar la guía. Por favor intente nuevamente.')
        }
    }

    const features = [
        {
            icon: <Package size={28} />,
            title: 'Gestión de Materias Primas',
            description: 'Control completo de ingredientes con precios actualizados, categorización y ajustes masivos.'
        },
        {
            icon: <Calculator size={28} />,
            title: 'Formulación de Productos',
            description: 'Crea recetas detalladas con cálculo automático de costos por kg y gestión de mermas.'
        },
        {
            icon: <Factory size={28} />,
            title: 'Planificación de Producción',
            description: 'Programa tu producción mensual con visibilidad total de costos directos e indirectos.'
        },
        {
            icon: <Brain size={28} />,
            title: 'Proyecciones con ML',
            description: 'Predice cantidades de producción futura usando Machine Learning basado en datos históricos.'
        },
        {
            icon: <TrendingUp size={28} />,
            title: 'Control de Inflación',
            description: 'Aplica tasas de inflación automáticamente a todos los componentes de costo.'
        },
        {
            icon: <Waypoints size={28} />,
            title: 'Análisis de Escenarios',
            description: 'Simula escenarios "What-If" para evaluar el impacto de cambios en costos.'
        }
    ]

    const benefits = [
        {
            icon: <Zap size={24} />,
            title: 'Ahorro de Tiempo',
            description: 'Automatiza cálculos complejos que antes tomaban horas'
        },
        {
            icon: <Shield size={24} />,
            title: 'Datos Seguros',
            description: 'Toda la información se guarda automáticamente en la base de datos'
        },
        {
            icon: <BarChart2 size={24} />,
            title: 'Decisiones Informadas',
            description: 'Visualiza costos en tiempo real para tomar mejores decisiones'
        }
    ]

    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' })
        }
    }

    return (
        <div className="landing-page">
            {/* Navigation */}
            <nav className={`landing-nav ${scrolled ? 'nav-scrolled' : ''}`}>
                <div className="nav-container">
                    <div className="nav-logo">
                        <BarChart3 size={32} className="logo-icon" />
                        <div className="logo-text">
                            <span className="logo-title">Costos</span>
                            <span className="logo-subtitle">Embutidos</span>
                        </div>
                    </div>
                    <div className="nav-links">
                        <button onClick={() => scrollToSection('features')} className="nav-link">
                            Características
                        </button>
                        <button onClick={() => scrollToSection('how-it-works')} className="nav-link">
                            Cómo Funciona
                        </button>
                        <button onClick={handleDownloadGuide} className="nav-link download-link">
                            <Download size={16} />
                            Guía de Usuario
                        </button>
                        <button onClick={() => navigate('/login')} className="nav-cta">
                            Ingresar al Sistema
                            <ArrowRight size={18} />
                        </button>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Menú"
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="mobile-menu">
                        <button onClick={() => { scrollToSection('features'); setMobileMenuOpen(false); }} className="mobile-menu-link">
                            Características
                        </button>
                        <button onClick={() => { scrollToSection('how-it-works'); setMobileMenuOpen(false); }} className="mobile-menu-link">
                            Cómo Funciona
                        </button>
                        <button onClick={() => { handleDownloadGuide(); setMobileMenuOpen(false); }} className="mobile-menu-link">
                            <Download size={16} />
                            Descargar Guía PDF
                        </button>
                        <button onClick={() => navigate('/login')} className="mobile-menu-cta">
                            Ingresar al Sistema
                            <ArrowRight size={18} />
                        </button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-background">
                    <div className="hero-gradient"></div>
                    <div className="hero-pattern"></div>
                    <div className="hero-glow"></div>
                </div>

                <div className="hero-content">
                    <div className="hero-badge animate-fade-in">
                        <Star size={14} />
                        <span>Sistema Profesional de Costeo</span>
                    </div>

                    <h1 className="hero-title animate-fade-in-up">
                        Control Total de
                        <span className="title-highlight"> Costos de Producción</span>
                    </h1>

                    <p className="hero-description animate-fade-in-up delay-1">
                        Planifica, controla y analiza los costos de tu producción de embutidos
                        con herramientas avanzadas de Machine Learning y análisis de escenarios.
                    </p>

                    <div className="hero-actions animate-fade-in-up delay-2">
                        <button onClick={() => navigate('/login')} className="hero-btn primary">
                            <span>Comenzar Ahora</span>
                            <ArrowRight size={20} />
                        </button>
                        <button onClick={handleDownloadGuide} className="hero-btn secondary">
                            <FileText size={20} />
                            <span>Descargar Guía PDF</span>
                        </button>
                    </div>

                    <div className="hero-stats animate-fade-in-up delay-3">
                        <div className="stat-item">
                            <span className="stat-value">100%</span>
                            <span className="stat-label">Automatizado</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="stat-value">ML</span>
                            <span className="stat-label">Proyecciones</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="stat-value">∞</span>
                            <span className="stat-label">Escenarios</span>
                        </div>
                    </div>
                </div>

                <button onClick={() => scrollToSection('features')} className="scroll-indicator animate-bounce">
                    <ChevronDown size={24} />
                </button>
            </section>

            {/* Features Section */}
            <section id="features" className="features-section reveal">
                <div className="section-container">
                    <div className="section-header reveal-up">
                        <span className="section-tag">Características</span>
                        <h2 className="section-title">Todo lo que necesitas para gestionar tus costos</h2>
                        <p className="section-description">
                            Un sistema integral diseñado específicamente para la industria de embutidos
                        </p>
                    </div>

                    <div className="features-grid">
                        {features.map((feature, index) => (
                            <div key={index} className="feature-card" style={{ '--delay': `${index * 0.1}s` }}>
                                <div className="feature-icon">
                                    {feature.icon}
                                </div>
                                <h3 className="feature-title">{feature.title}</h3>
                                <p className="feature-description">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="workflow-section reveal">
                <div className="section-container">
                    <div className="section-header reveal-up">
                        <span className="section-tag">Flujo de Trabajo</span>
                        <h2 className="section-title">¿Cómo funciona?</h2>
                        <p className="section-description">
                            Un proceso simple y ordenado para obtener costos precisos
                        </p>
                    </div>

                    <div className="workflow-steps">
                        <div className="workflow-step">
                            <div className="step-number">1</div>
                            <div className="step-content">
                                <h3>Configura Materias Primas</h3>
                                <p>Carga tus ingredientes con precios actualizados. Organízalos por categorías.</p>
                            </div>
                        </div>
                        <div className="workflow-connector"></div>

                        <div className="workflow-step">
                            <div className="step-number">2</div>
                            <div className="step-content">
                                <h3>Crea tus Productos</h3>
                                <p>Define recetas con cantidades exactas. El sistema calcula costos automáticamente.</p>
                            </div>
                        </div>
                        <div className="workflow-connector"></div>

                        <div className="workflow-step">
                            <div className="step-number">3</div>
                            <div className="step-content">
                                <h3>Configura Costos Indirectos</h3>
                                <p>Ingresa sueldos, gastos de fabricación y depreciación por mes.</p>
                            </div>
                        </div>
                        <div className="workflow-connector"></div>

                        <div className="workflow-step">
                            <div className="step-number">4</div>
                            <div className="step-content">
                                <h3>Planifica y Analiza</h3>
                                <p>Programa producción, genera proyecciones ML y analiza escenarios.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="benefits-section reveal">
                <div className="section-container">
                    <div className="benefits-grid">
                        <div className="benefits-content">
                            <span className="section-tag">Beneficios</span>
                            <h2 className="section-title">¿Por qué usar este sistema?</h2>
                            <div className="benefits-list">
                                {benefits.map((benefit, index) => (
                                    <div key={index} className="benefit-item">
                                        <div className="benefit-icon">{benefit.icon}</div>
                                        <div className="benefit-text">
                                            <h4>{benefit.title}</h4>
                                            <p>{benefit.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="benefits-visual">
                            <div className="visual-card">
                                <div className="card-header">
                                    <BarChart3 size={24} />
                                    <span>Dashboard de Costos</span>
                                </div>
                                <div className="card-content">
                                    <div className="mock-chart">
                                        <div className="chart-bar" style={{ height: '60%' }}></div>
                                        <div className="chart-bar" style={{ height: '80%' }}></div>
                                        <div className="chart-bar" style={{ height: '45%' }}></div>
                                        <div className="chart-bar" style={{ height: '90%' }}></div>
                                        <div className="chart-bar" style={{ height: '70%' }}></div>
                                    </div>
                                    <div className="card-stats">
                                        <div className="mini-stat">
                                            <span className="mini-value">$2,138</span>
                                            <span className="mini-label">MP/Kg</span>
                                        </div>
                                        <div className="mini-stat">
                                            <span className="mini-value">$8,400</span>
                                            <span className="mini-label">Ind/Kg</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section reveal">
                <div className="cta-background">
                    <div className="cta-gradient"></div>
                </div>
                <div className="cta-content">
                    <h2>¿Listo para optimizar tus costos?</h2>
                    <p>Comienza a usar el sistema ahora o descarga la guía completa para conocer todas las funcionalidades.</p>
                    <div className="cta-actions">
                        <button onClick={() => navigate('/login')} className="cta-btn primary">
                            Ingresar al Sistema
                            <ArrowRight size={20} />
                        </button>
                        <button onClick={handleDownloadGuide} className="cta-btn secondary">
                            <Download size={20} />
                            Descargar Guía PDF
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-container">
                    <div className="footer-brand">
                        <BarChart3 size={24} />
                        <span>Costos Embutidos</span>
                    </div>
                    <p className="footer-text">
                        Sistema de Gestión de Costos de Producción
                    </p>
                    <p className="footer-version">Versión 1.5.0</p>
                </div>
            </footer>
        </div>
    )
}

export default Landing
