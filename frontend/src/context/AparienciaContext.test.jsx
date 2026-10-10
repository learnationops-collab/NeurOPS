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
const html = () => [document.documentElement.dataset.tema, document.documentElement.dataset.temaModo];

describe('Apariencia', () => {
    beforeEach(() => {
        localStorage.clear();
        delete document.documentElement.dataset.tema;
        delete document.documentElement.dataset.temaModo;
        sesion.user = { role: 'admin' };
    });

    it('sin elección no hay tema: cada pantalla queda como siempre', () => {
        montar(<Estado />);
        expect(html()).toEqual([undefined, undefined]);
        expect(estado()).toBe('null|null|false|respaldo');
    });

    it('elegir un tema lo pone en <html> en oscuro, y el modo se cambia aparte', () => {
        montar(<><TabApariencia /><Estado /></>);
        fireEvent.click(screen.getByRole('radio', { name: 'Learnation Modern' }));
        expect(html()).toEqual(['modern', 'oscuro']);
        fireEvent.click(screen.getByRole('radio', { name: 'Claro' }));
        expect(html()).toEqual(['modern', 'claro']);
        expect(estado()).toBe('modern|claro|true|light');
        fireEvent.click(screen.getByRole('radio', { name: 'Learnation Classic' }));
        expect(html()).toEqual(['classic', 'claro']);  // cambiar de tema conserva el modo
        expect(JSON.parse(localStorage.getItem('app-tema'))).toEqual({ tema: 'classic', modo: 'claro' });
    });

    it('elegir el modo sin tema pone Classic', () => {
        montar(<TabApariencia />);
        fireEvent.click(screen.getByRole('radio', { name: 'Claro' }));
        expect(html()).toEqual(['classic', 'claro']);
    });

    it('lo guardado antes de separar el modo se traduce', () => {
        localStorage.setItem('app-tema', 'thalamus-claro');
        montar(<Estado />);
        expect(html()).toEqual(['modern', 'claro']);
    });

    it('un tema guardado que ya no existe es como no haber elegido', () => {
        localStorage.setItem('app-tema', JSON.stringify({ tema: 'glass', modo: 'claro' }));
        montar(<Estado />);
        expect(html()).toEqual([undefined, undefined]);
    });

    it('sin sesión (login, páginas públicas) no se aplica el tema guardado', () => {
        localStorage.setItem('app-tema', JSON.stringify({ tema: 'modern', modo: 'claro' }));
        sesion.user = null;
        montar(<Estado />);
        expect(html()).toEqual([undefined, undefined]);
        expect(estado()).toBe('null|null|false|respaldo');
    });

    it('cada vista previa se pinta con su tema en el modo elegido', () => {
        localStorage.setItem('app-tema', JSON.stringify({ tema: 'classic', modo: 'claro' }));
        montar(<TabApariencia />);
        expect(screen.getAllByRole('radio', { name: /Learnation/ }).map(r => [r.dataset.tema, r.dataset.temaModo]))
            .toEqual([['classic', 'claro'], ['modern', 'claro']]);
    });

    it('en la Configuración, Apariencia aparece para cualquier rol', () => {
        montar(<ConfiguracionCloser user={{ role: 'setter', username: 'st' }} />);
        fireEvent.click(screen.getByRole('tab', { name: /Apariencia/ }));
        expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeTruthy();
        expect(screen.getByRole('radiogroup', { name: 'Modo' })).toBeTruthy();
    });

    it('con tema elegido, la Configuración del closer va en el modo del tema', () => {
        localStorage.setItem('app-tema', JSON.stringify({ tema: 'modern', modo: 'claro' }));
        const { container } = montar(<ConfiguracionCloser user={{ role: 'admin', username: 'mario' }} />);
        expect(container.querySelector('.cu-hoja').dataset.theme).toBe('light');
    });
});
