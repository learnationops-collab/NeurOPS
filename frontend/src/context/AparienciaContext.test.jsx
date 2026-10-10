import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AparienciaProvider, TEMA_POR_DEFECTO, useApariencia } from './AparienciaContext';
import TabApariencia from '../temas/TabApariencia';
import ConfiguracionCloser from '../pages/closer/components/ConfiguracionCloser';

vi.mock('../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: {} })), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

function Modo() {
    const { modo } = useApariencia();
    return <span data-testid="modo">{modo}</span>;
}
const montar = (hijos) => render(<AparienciaProvider>{hijos}</AparienciaProvider>);

describe('Apariencia', () => {
    beforeEach(() => { localStorage.clear(); delete document.documentElement.dataset.tema; });

    it('sin elección arranca en Closing oscuro, el look actual', () => {
        montar(<Modo />);
        expect(TEMA_POR_DEFECTO).toBe('closing-oscuro');
        expect(document.documentElement.dataset.tema).toBe('closing-oscuro');
        expect(screen.getByTestId('modo').textContent).toBe('oscuro');
    });

    it('elegir un tema lo pone en <html>, trae su modo y queda guardado', () => {
        montar(<><TabApariencia /><Modo /></>);
        fireEvent.click(screen.getByRole('radio', { name: 'Thalamus claro' }));
        expect(document.documentElement.dataset.tema).toBe('thalamus-claro');
        expect(screen.getByTestId('modo').textContent).toBe('claro');
        expect(screen.getByRole('radio', { name: 'Thalamus claro' }).getAttribute('aria-checked')).toBe('true');
        expect(localStorage.getItem('app-tema')).toBe('thalamus-claro');
    });

    it('un tema guardado que ya no existe vuelve al default', () => {
        localStorage.setItem('app-tema', 'elegant');
        montar(<Modo />);
        expect(document.documentElement.dataset.tema).toBe('closing-oscuro');
    });

    it('cada tema de la lista se ve con sus propios colores', () => {
        montar(<TabApariencia />);
        const radios = screen.getAllByRole('radio');
        expect(radios.map(r => r.dataset.tema)).toEqual(['closing-oscuro', 'thalamus-oscuro', 'thalamus-claro']);
    });

    it('en la Configuración del closer, Apariencia aparece solo para admins por ahora', () => {
        const { unmount } = montar(<ConfiguracionCloser user={{ role: 'closer', username: 'jc' }} />);
        expect(screen.queryByRole('tab', { name: /Apariencia/ })).toBeNull();
        unmount();
        montar(<ConfiguracionCloser user={{ role: 'admin', username: 'mario' }} />);
        fireEvent.click(screen.getByRole('tab', { name: /Apariencia/ }));
        expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeTruthy();
    });
});
