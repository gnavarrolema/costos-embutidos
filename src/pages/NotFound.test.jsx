import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotFound from './NotFound'

describe('NotFound', () => {
    it('muestra mensaje y link de retorno', () => {
        render(
            <MemoryRouter>
                <NotFound />
            </MemoryRouter>
        )

        expect(screen.getByText('Página no encontrada')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Volver al dashboard' })).toHaveAttribute('href', '/')
    })
})
