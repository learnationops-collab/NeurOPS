import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Revisar from '../Revisar';
import { MODULOS, operacionDe } from './operacion';
import agendasLote, {
    PanelEditarEnLote, SIN_CAMBIOS, mensajeDelResultado, pedidoDeLote, resumenDeLote,
} from './agendasLote';

/**
 * «Editar en lote» las agendas desde Revisar (10/10/2026): el panel arma el pedido que espera
 * `POST /comercial/agendas/lote`, lo que queda en «No cambiar» no viaja, y antes de aplicar dice qué
 * va a pasar («12 agendas: closer → Nerina, fuente → Workshop»).
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../../../services/api', () => ({ default: api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));

const OPCIONES = {
    campos: { fuente: 'Fuente', closer_id: 'Closer', pre_call: 'Estado pre call' },
    fuentes: [
        { titulo: 'Embudos', tono: 'info', opciones: [{ clave: 'workshop', label: 'Workshop' }, { clave: 'vsl', label: 'VSL' }] },
        { titulo: 'Setters', tono: 'success', opciones: [{ clave: 'Paula', label: 'Paula' }] },
    ],
    closers: [{ id: 7, nombre: 'Nerina', pista: 'Libre' }, { id: 9, nombre: 'Marlon', pista: '1 llamada hoy' }],
    pre_call: [{ key: 'confirmada', label: 'Confirmada', tone: 'info' },
        { key: 'sin_confirmar', label: 'Sin confirmar', tone: 'idle' }],
    limite: 5000,
};

const agenda = (id, cliente) => ({
    tipo: 'agenda', id, client_id: id, cliente, ig: '', email: '', telefono: '',
    fecha: '2026-10-08T15:00:00', creada: '2026-10-06T15:00:00', fuente: 'vsl',
    closer: 'Marlon', closer_id: 9, setter: '', setter_id: null,
    pre_call: { key: 'sin_confirmar', label: 'Sin confirmar', tone: 'idle' },
    post_call: { key: 'pendiente', label: 'Pendiente', tone: 'idle' }, estado_libro: 'por_confirmar',
    asistio: false, realizada: false, presento: false, retraso_dias: 0, ya_paso: false, descartada: false,
    con_venta: false, venta_tipo: null, con_sena: false,
});
const FILAS = [agenda(1, 'Ana Gomez'), agenda(3, 'Caro Paz')];

const montar = (extra = {}) => {
    const onCerrar = vi.fn();
    const onHecho = vi.fn();
    render(<PanelEditarEnLote tabla="agendas" filas={FILAS} fila={null} fechas={null}
        onCerrar={onCerrar} onHecho={onHecho} {...extra} />);
    return { onCerrar, onHecho };
};
const desplegable = (nombre) => screen.getByRole('combobox', { name: nombre });
const elegir = (nombre, valor) => fireEvent.change(desplegable(nombre), { target: { value: valor } });
const resumen = () => screen.getByRole('status', { name: 'Resumen del cambio' });
const aplicar = () => screen.getByRole('button', { name: /^Aplicar a/ });

beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: OPCIONES });
});

describe('pedidoDeLote', () => {
    it('manda los ids de las filas y solo lo que se eligió; «No cambiar» no viaja', () => {
        expect(pedidoDeLote(FILAS, { ...SIN_CAMBIOS, closer_id: '7' }))
            .toEqual({ ids: [1, 3], cambios: { closer_id: 7 } });
        expect(pedidoDeLote(FILAS, { closer_id: '', fuente: 'workshop', pre_call: 'confirmada' }))
            .toEqual({ ids: [1, 3], cambios: { fuente: 'workshop', pre_call: 'confirmada' } });
        expect(pedidoDeLote(FILAS, SIN_CAMBIOS).cambios).toEqual({});
    });
});

describe('resumenDeLote', () => {
    it('dice cuántas agendas y qué cambia, con los nombres que se leen', () => {
        expect(resumenDeLote(12, { closer_id: '7', fuente: 'workshop', pre_call: '' }, OPCIONES))
            .toBe('12 agendas: closer → Nerina, fuente → Workshop');
        expect(resumenDeLote(1, { closer_id: '', fuente: '', pre_call: 'confirmada' }, OPCIONES))
            .toBe('1 agenda: pre call → Confirmada');
    });

    it('sin nada elegido no hay resumen', () => {
        expect(resumenDeLote(12, SIN_CAMBIOS, OPCIONES)).toBeNull();
    });
});

describe('mensajeDelResultado', () => {
    it('sin errores es un éxito que dice cuántas cambiaron y cuántas ya lo tenían', () => {
        expect(mensajeDelResultado({ cambiadas: 10, sin_cambios: 2, errores: [] }))
            .toEqual({ tipo: 'success', texto: '10 agendas actualizadas · 2 ya lo tenían' });
        expect(mensajeDelResultado({ cambiadas: 1, sin_cambios: 0, errores: [] }).texto)
            .toBe('1 agenda actualizada');
    });

    it('con errores nombra al lead de la primera que no se pudo, no su id', () => {
        const { tipo, texto } = mensajeDelResultado({
            cambiadas: 1, sin_cambios: 0,
            errores: [{ id: 3, message: 'Nerina ya tiene una llamada sin resolver a esa misma hora.' }],
        }, FILAS);

        expect(tipo).toBe('error');
        expect(texto).toBe('1 agenda actualizada · 1 no se pudo cambiar '
            + '(Caro Paz: Nerina ya tiene una llamada sin resolver a esa misma hora.)');
    });
});

describe('Panel «Editar en lote»', () => {
    it('cada campo arranca en «No cambiar» y no hay nada para aplicar', async () => {
        montar();

        expect(await screen.findByRole('combobox', { name: 'Closer' })).toHaveValue('');
        expect(desplegable('Fuente')).toHaveValue('');
        expect(desplegable('Estado pre call')).toHaveValue('');
        expect(screen.getByRole('dialog', { name: 'Editar en lote' })).toHaveTextContent('2 agendas seleccionadas');
        expect(resumen()).toHaveTextContent('todavía no hay nada para aplicar');
        expect(aplicar()).toBeDisabled();
        expect(api.get).toHaveBeenCalledWith('/comercial/agendas/lote/opciones');
    });

    it('en lote solo ofrece los pre call que no piden motivo', async () => {
        montar();

        const opciones = within(await screen.findByRole('combobox', { name: 'Estado pre call' }))
            .getAllByRole('option').map(o => o.textContent);
        expect(opciones).toEqual(['No cambiar', 'Confirmada', 'Sin confirmar']);
    });

    it('muestra el resumen antes de aplicar y manda solo lo elegido', async () => {
        api.post.mockResolvedValue({ data: { pedidas: 2, cambiadas: 2, sin_cambios: 0, errores: [] } });
        const { onCerrar, onHecho } = montar();
        await screen.findByRole('combobox', { name: 'Closer' });

        elegir('Closer', '7');
        elegir('Fuente', 'workshop');

        expect(resumen()).toHaveTextContent('2 agendas: closer → Nerina, fuente → Workshop');
        expect(aplicar()).toHaveTextContent('Aplicar a 2 agendas');
        fireEvent.click(aplicar());

        await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1));
        expect(api.post).toHaveBeenCalledWith('/comercial/agendas/lote',
            { ids: [1, 3], cambios: { closer_id: 7, fuente: 'workshop' } });
        expect(toast.success).toHaveBeenCalledWith('2 agendas actualizadas', expect.anything());
        expect(onHecho).toHaveBeenCalledTimes(1);
    });

    it('volver un campo a «No cambiar» lo saca del pedido y del resumen', async () => {
        api.post.mockResolvedValue({ data: { cambiadas: 0, sin_cambios: 2, errores: [] } });
        montar();
        await screen.findByRole('combobox', { name: 'Closer' });

        elegir('Closer', '7');
        elegir('Estado pre call', 'confirmada');
        elegir('Closer', '');

        expect(resumen()).toHaveTextContent('2 agendas: pre call → Confirmada');
        fireEvent.click(aplicar());
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/comercial/agendas/lote',
            { ids: [1, 3], cambios: { pre_call: 'confirmada' } }));
    });

    it('si el lote vuelve con errores, el toast lo dice con el nombre del lead', async () => {
        api.post.mockResolvedValue({ data: {
            cambiadas: 1, sin_cambios: 0, errores: [{ id: 1, message: 'Esa agenda ya no existe.' }],
        } });
        const { onHecho } = montar();
        await screen.findByRole('combobox', { name: 'Closer' });

        elegir('Fuente', 'Paula');
        fireEvent.click(aplicar());

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
            '1 agenda actualizada · 1 no se pudo cambiar (Ana Gomez: Esa agenda ya no existe.)', expect.anything()));
        expect(onHecho).toHaveBeenCalledTimes(1);
    });

    it('si el pedido entero rebota, el motivo queda adentro del panel, que sigue abierto', async () => {
        api.post.mockRejectedValue({ response: { data: { message: 'Editar en lote es de Operaciones.' } } });
        const { onCerrar, onHecho } = montar();
        await screen.findByRole('combobox', { name: 'Closer' });

        elegir('Closer', '9');
        fireEvent.click(aplicar());

        expect(await screen.findByRole('alert')).toHaveTextContent('Editar en lote es de Operaciones.');
        expect(onCerrar).not.toHaveBeenCalled();
        expect(onHecho).not.toHaveBeenCalled();
        expect(desplegable('Closer')).toHaveValue('9');
        expect(aplicar()).toBeEnabled();
    });

    it('si no llegan las opciones se puede reintentar', async () => {
        api.get.mockRejectedValueOnce(new Error('red'));
        montar();

        fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

        expect(await screen.findByRole('combobox', { name: 'Closer' })).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledTimes(2);
    });

    it('más agendas que el tope del lote no se aplican', async () => {
        api.get.mockResolvedValue({ data: { ...OPCIONES, limite: 1 } });
        montar();
        await screen.findByRole('combobox', { name: 'Closer' });

        elegir('Fuente', 'vsl');

        expect(screen.getByRole('alert')).toHaveTextContent('hasta 1 agendas por lote');
        expect(aplicar()).toBeDisabled();
    });
});

describe('registro en Revisar', () => {
    it('es una acción de lote de la tabla Agendas y de ninguna otra', () => {
        expect(MODULOS).toContain(agendasLote);
        expect(operacionDe('agendas', [agendasLote]).lote.map(a => a.label)).toEqual(['Editar en lote']);
        expect(operacionDe('ventas', [agendasLote])).toBeNull();
    });

    it('tildar agendas y elegir «Editar en lote» abre el panel con esas agendas', async () => {
        render(<Revisar tabla="agendas" setTabla={() => {}} cargando={false} rol="closers" basis="meet"
            setBasis={() => {}} datos={{ filas: FILAS, dates: { start: '2026-10-01', end: '2026-10-31' } }}
            alcance="Todo el equipo" onAbrirFila={() => {}} filtroInicial={null} onOlvidarFiltro={() => {}}
            operacion={operacionDe('agendas', [agendasLote])} onRecargar={() => {}} />);

        fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Caro Paz' }));
        fireEvent.click(within(screen.getByRole('region', { name: 'Filas seleccionadas' }))
            .getByRole('button', { name: 'Editar en lote' }));

        const panel = await screen.findByRole('dialog', { name: 'Editar en lote' });
        expect(panel).toHaveTextContent('1 agenda seleccionada');
        await within(panel).findByRole('combobox', { name: 'Closer' });
        expect(within(panel).getByRole('button', { name: /^Aplicar a/ })).toHaveTextContent('Aplicar a 1 agenda');
    });
});
