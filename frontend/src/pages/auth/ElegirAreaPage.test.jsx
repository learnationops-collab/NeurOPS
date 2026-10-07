import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const user = { id: 7, role: 'director_comercial', username: 'mario_bueller' };
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user }) }));

import ElegirAreaPage from './ElegirAreaPage';
import { areaPorDefecto } from '../../utils/areas';

function montar(ruta = '/inicio') {
    render(
        <MemoryRouter initialEntries={[ruta]}>
            <Routes>
                <Route path="/inicio" element={<ElegirAreaPage />} />
                <Route path="/agendas-v2" element={<p>Thalamus</p>} />
                <Route path="/admin/comercial" element={<p>Dirección</p>} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('Elegir área', () => {
    beforeEach(() => localStorage.clear());

    it('saluda por el primer nombre y muestra una tarjeta por área', () => {
        montar();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Mario$/);
        expect(screen.getByRole('button', { name: /Dirección/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Agendamiento/ })).toBeInTheDocument();
    });

    it('con «Entrar directo» guarda el área y la próxima vez saltea la elección', () => {
        montar();
        fireEvent.click(screen.getByLabelText('Entrar directo la próxima vez'));
        fireEvent.click(screen.getByRole('button', { name: /Agendamiento/ }));
        expect(screen.getByText('Thalamus')).toBeInTheDocument();
        expect(areaPorDefecto(user)).toBe('agendamiento');
    });

    it('desde «Cambiar de área» (?elegir=1) se ve aunque haya un área por defecto, y se puede apagar', () => {
        localStorage.setItem('area_por_defecto_7_director_comercial', 'agendamiento');
        montar('/inicio?elegir=1');
        const directo = screen.getByLabelText('Entrar directo la próxima vez');
        expect(directo).toBeChecked();
        fireEvent.click(directo);
        expect(areaPorDefecto(user)).toBe(null);
    });

    it('sin ?elegir y con área por defecto, entra directo', () => {
        localStorage.setItem('area_por_defecto_7_director_comercial', 'direccion');
        montar();
        expect(screen.getByText('Dirección')).toBeInTheDocument();
    });
});
