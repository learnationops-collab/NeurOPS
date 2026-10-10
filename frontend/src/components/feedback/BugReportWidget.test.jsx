import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BugReportWidget from './BugReportWidget';
import useOpcionesDeReporte from './useOpcionesDeReporte';
import {
    abrirMisReportes, abrirReporteDeBug, publicarEstadoDeReportes, triggerBugReport,
} from '../../utils/bugReportBus';

/**
 * El botón flotante rosado se fue (07/10/2026): reportar y «Mis reportes» son opciones del menú del
 * usuario. El widget sigue teniendo el chat y el historial, y se abren con eventos del bus.
 */

const sesion = vi.hoisted(() => ({ user: { id: 1, username: 'ana' } }));
const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: sesion.user }) }));
vi.mock('../../services/api', () => ({ default: api }));
// El chat y el historial se reemplazan por dobles: acá se prueba cuándo se abren, no su contenido.
vi.mock('./BugReportChat', () => ({
    default: ({ isOpen, onMinimize, technicalContext }) => (
        <div data-testid="chat" data-open={String(isOpen)} data-contexto={technicalContext?.message || ''}>
            <button type="button" onClick={onMinimize}>minimizar</button>
        </div>
    ),
}));
vi.mock('./BugReportHistory', () => ({
    default: ({ isOpen }) => <div data-testid="historial" data-open={String(isOpen)} />,
}));

const abierto = (id) => screen.getByTestId(id).getAttribute('data-open') === 'true';
const montar = async () => {
    render(<BugReportWidget />);
    await act(async () => {});
};

const Opciones = () => {
    const { opciones, sinLeer, enProgreso } = useOpcionesDeReporte();
    return (
        <div>
            <output data-testid="estado">{`${sinLeer}|${enProgreso}`}</output>
            {opciones.map((o) => (
                <span key={o.id}>
                    <button type="button" onClick={o.onClick}>
                        {o.label}{o.cuenta ? ` (${o.cuenta})` : ''}
                    </button>
                    {o.accion && <button type="button" aria-label={o.accion.label} onClick={o.accion.onClick}>+</button>}
                </span>
            ))}
        </div>
    );
};

describe('BugReportWidget sin botón flotante', () => {
    beforeEach(() => {
        sesion.user = { id: 1, username: 'ana' };
        api.get.mockReset().mockResolvedValue({ data: [] });
        publicarEstadoDeReportes({ sinLeer: 0, enProgreso: false });
    });
    afterEach(() => vi.useRealTimers());

    it('no dibuja ningún botón propio: arranca con el chat y el historial cerrados', async () => {
        await montar();

        expect(screen.queryByTitle('Reportar un problema o feedback')).toBeNull();
        expect(screen.queryByTitle('Mis reportes')).toBeNull();
        expect(abierto('chat')).toBe(false);
        expect(abierto('historial')).toBe(false);
    });

    it('«abrirReporteDeBug» abre el chat y «abrirMisReportes» el historial', async () => {
        await montar();

        act(() => abrirReporteDeBug());
        expect(abierto('chat')).toBe(true);

        act(() => abrirMisReportes());
        expect(abierto('historial')).toBe(true);
        expect(abierto('chat')).toBe(false);
    });

    it('un reporte nuevo desde el menú no arrastra el contexto de un error anterior', async () => {
        await montar();
        act(() => triggerBugReport({ message: 'falló algo', autoOpen: true }));
        expect(screen.getByTestId('chat').getAttribute('data-contexto')).toBe('falló algo');

        // Se cierra a mano (no hay botón de cierre en el doble: se abre otra vista) y se reporta de cero.
        act(() => abrirMisReportes());
        act(() => abrirReporteDeBug());

        expect(abierto('chat')).toBe(true);
        expect(screen.getByTestId('chat').getAttribute('data-contexto')).toBe('');
    });

    it('con un reporte minimizado, el menú lo retoma sin perder el contexto', async () => {
        await montar();
        act(() => triggerBugReport({ message: 'falló algo', autoOpen: true }));
        fireEvent.click(screen.getByText('minimizar'));
        expect(abierto('chat')).toBe(false);

        act(() => abrirReporteDeBug());

        expect(abierto('chat')).toBe(true);
        expect(screen.getByTestId('chat').getAttribute('data-contexto')).toBe('falló algo');
    });

    it('publica las respuestas sin leer y si hay un reporte en progreso', async () => {
        api.get.mockResolvedValue({ data: [{ unread_for_user: true }, { unread_for_user: false }, { unread_for_user: true }] });
        render(<><BugReportWidget /><Opciones /></>);
        await act(async () => {});

        expect(screen.getByTestId('estado').textContent).toBe('2|false');
        expect(screen.getByText('Mis reportes (2)')).toBeTruthy();
        // Una sola fila: «Mis reportes» y al lado el «+» para reportar uno nuevo.
        expect(screen.getByRole('button', { name: 'Reportar un problema' })).toBeTruthy();

        act(() => triggerBugReport({ message: 'x', autoOpen: true }));
        fireEvent.click(screen.getByText('minimizar'));

        expect(screen.getByTestId('estado').textContent).toBe('2|true');
        expect(screen.getByRole('button', { name: 'Continuar reporte en progreso' })).toBeTruthy();
    });

    it('abrir «Mis reportes» baja la cuenta a cero', async () => {
        api.get.mockResolvedValue({ data: [{ unread_for_user: true }] });
        render(<><BugReportWidget /><Opciones /></>);
        await act(async () => {});
        expect(screen.getByTestId('estado').textContent).toBe('1|false');

        fireEvent.click(screen.getByText('Mis reportes (1)'));

        expect(screen.getByTestId('estado').textContent).toBe('0|false');
    });

    it('sin sesión no hace nada', async () => {
        sesion.user = null;
        const { container } = render(<BugReportWidget />);
        await act(async () => {});

        expect(container.innerHTML).toBe('');
        expect(api.get).not.toHaveBeenCalled();
    });
});
