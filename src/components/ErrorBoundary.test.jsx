import { render, screen } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function BrokenComponent() {
    throw new Error('boom')
}

describe('ErrorBoundary', () => {
    it('renderiza fallback cuando ocurre un error', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        render(
            <ErrorBoundary>
                <BrokenComponent />
            </ErrorBoundary>
        )

        expect(screen.getByText('Ocurrió un error inesperado')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Recargar aplicación' })).toBeInTheDocument()

        consoleErrorSpy.mockRestore()
    })

})
