import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AparienciaProvider, dataThemeDe, useApariencia } from './AparienciaContext';
import TabApariencia from '../temas/TabApariencia';
import ConfiguracionCloser from '../pages/closer/components/ConfiguracionCloser';

const sesion = vi.hoisted(() => ({ user: null }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: sesion.user }) }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: {} })), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

function Estado() {
    const a = useApariencia();
    return <span data-testid="estado">{`${a.tema}|${a.modo}|${a.elegido}|${dataThemeDe(a, 'respaldo')}`}</span>;
}
const montar = (hijos) => render(<AparienciaProvider>{hijos}</AparienciaProvider>);
const estado = () => screen.getByTestId('estado').textContent;

describe('Apariencia', () => {
    beforeEach(() => { localStorage.clear(); delete document.documentElement.dataset.tema; sesion.user = { role: 'admin' }; });

    it('sin elección no hay tema: cada pantalla queda como siempre', () => {
        montar(<Estado />);
        expect(document.documentElement.dataset.tema).toBeUndefined();
        expect(estado()).toBe('null|null|false|respaldo');
    });

    it('elegir un tema lo pone en <html>, trae su modo y queda guardado', () => {
        montar(<><TabApariencia /><Estado /></>);
        fireEvent.click(screen.getByRole('radio', { name: 'Thalamus claro' }));
        expect(document.documentElement.dataset.tema).toBe('thalamus-claro');
        expect(estado()).toBe('thalamus-claro|claro|true|light');
        expect(screen.getByRole('radio', { name: 'Thalamus claro' }).getAttribute('aria-checked')).toBe('true');
        expect(localStorage.getItem('app-tema')).toBe('thalamus-claro');
    });

    it('un tema guardado que ya no existe es como no haber elegido', () => {
        localStorage.setItem('app-tema', 'elegant');
        montar(<Estado />);
        expect(document.documentElement.dataset.tema).toBeUndefined();
    });

    it('a un rol que todavía no elige tema no se le aplica el guardado en el navegador', () => {
        localStorage.setItem('app-tema', 'thalamus-claro');
        sesion.user = { role: 'closer' };  // p. ej. un admin simulando a un closer
        montar(<Estado />);
        expect(document.documentElement.dataset.tema).toBeUndefined();
        expect(estado()).toBe('null|null|false|respaldo');
    });

    it('cada tema de la lista se ve con sus propios colores', () => {
        montar(<TabApariencia />);
        expect(screen.getAllByRole('radio').map(r => r.dataset.tema)).toEqual(['closing-oscuro', 'thalamus-oscuro', 'thalamus-claro']);
    });

    it('en la Configuración del closer, Apariencia aparece solo para los roles que eligen tema', () => {
        const { unmount } = montar(<ConfiguracionCloser user={{ role: 'closer', username: 'jc' }} />);
        expect(screen.queryByRole('tab', { name: /Apariencia/ })).toBeNull();
        unmount();
        montar(<ConfiguracionCloser user={{ role: 'director_comercial', username: 'dir' }} />);
        fireEvent.click(screen.getByRole('tab', { name: /Apariencia/ }));
        expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeTruthy();
    });

    it('con tema elegido, la Configuración del closer va en el modo del tema', () => {
        localStorage.setItem('app-tema', 'thalamus-claro');
        const { container } = montar(<ConfiguracionCloser user={{ role: 'admin', username: 'mario' }} />);
        expect(container.querySelector('.cu-hoja').dataset.theme).toBe('light');
    });
});
