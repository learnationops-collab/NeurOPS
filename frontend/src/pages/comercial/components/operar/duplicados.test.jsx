import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../../../services/api', () => ({ default: api }));

import { PanelDuplicados, filtrosDelPeriodo } from './duplicados';
import { operacionDe } from './operacion';
import Revisar from '../Revisar';

/**
 * «Duplicados» en la tabla Agendas de Revisar (10/10/2026): el panel de agendas repetidas del libro
 * viejo de Operaciones, ahora herramienta de Revisar. El motor y sus rutas son los de siempre
 * (tests/api/test_operaciones_duplicados.py prueba qué le pasa a la cita); acá se comprueba que el
 * panel pida los grupos del período de Revisar, que resuelva con lo que se eligió y que restaure, y
 * que después de cada cosa le avise a Revisar para que recargue.
 */

const RUTA = '/public/financial-agendas/duplicados';
const OCTUBRE = { start: '2026-10-01', end: '2026-10-31' };

const fila = (id, lead, date, extra = {}) => ({
    id, lead, fuente: 'Meta Ads', closer: 'Nerina', mail: `${lead.split(' ')[0].toLowerCase()}@test.local`,
    instagram: null, whatsapp: null, estado: 'Pendiente', registro: null,
    created_at: '2026-10-01T12:00:00', date, appointment_id: id + 100, cita_cancelada: false, ...extra,
});

const grupo = (clave, motivo, agendas, sugerida, sugiereDescartar = true) => ({
    clave, motivo, etiqueta: { reprogramacion: 'Probable reprogramación', duplicado_del_webhook: 'Duplicado del webhook',
        volvio_a_agendar: 'Volvió a agendar' }[motivo],
    detalle: '', sugiere_descartar: sugiereDescartar, conservar_sugerida_id: sugerida, agendas,
});

const GRUPOS = () => [
    grupo('g11', 'reprogramacion', [fila(11, 'Ana Gomez', '2026-10-10T15:00:00'),
        fila(12, 'Ana Gomez', '2026-10-12T15:00:00')], 12),
    grupo('g21', 'duplicado_del_webhook', [fila(21, 'Beto Diaz', '2026-10-14T18:00:00'),
        fila(22, 'Beto Diaz', '2026-10-14T18:00:00'), fila(23, 'Beto Diaz', '2026-10-14T18:01:00')], 21),
    grupo('g31', 'volvio_a_agendar', [fila(31, 'Carla Ruiz', '2026-10-02T15:00:00', { estado: 'Show Up' }),
        fila(32, 'Carla Ruiz', '2026-10-20T15:00:00')], 32, false),
];

const DESCARTADAS = [
    { ...fila(41, 'Dani Paz', '2026-10-05T15:00:00'), duplicada_de_id: 42, descartada_at: '2026-10-09T12:00:00',
        descartada_por: 'operador', descartada_motivo: null },
];

const pidioGrupos = () => api.get.mock.calls.filter(([url]) => url === RUTA);

const montar = async (extra = {}) => {
    const props = { tabla: 'agendas', filas: [], fila: null, fechas: OCTUBRE, onCerrar: vi.fn(), onHecho: vi.fn(), ...extra };
    render(<PanelDuplicados {...props} />);
    if (props.fechas) await screen.findByRole('region', { name: 'Grupo de Ana Gomez' });
    return props;
};

describe('Duplicados · el panel', () => {
    beforeEach(() => {
        api.get.mockReset();
        api.post.mockReset();
        api.get.mockImplementation((url) => Promise.resolve({
            data: url.endsWith('/descartadas') ? DESCARTADAS : { grupos: GRUPOS(), total_grupos: 3, hay_mas: false },
        }));
        api.post.mockResolvedValue({ data: {} });
    });

    it('pide los grupos del período de Revisar, por fecha de reunión', async () => {
        await montar();

        expect(pidioGrupos()).toEqual([[RUTA, {
            params: { start_date: '2026-10-01', end_date: '2026-10-31', date_filter_by: 'meet' } }]]);
        expect(filtrosDelPeriodo({ start: '2026-09-01T00:00:00', end: '2026-09-30' }))
            .toEqual({ start_date: '2026-09-01', end_date: '2026-09-30', date_filter_by: 'meet' });
        expect(filtrosDelPeriodo(undefined)).toBeNull();
    });

    it('sin período no pide nada', () => {
        render(<PanelDuplicados fechas={undefined} onCerrar={vi.fn()} onHecho={vi.fn()} />);

        expect(api.get).not.toHaveBeenCalled();
        expect(screen.getByText(/Elegí un período en Revisar/)).toBeInTheDocument();
    });

    it('cada grupo trae su motivo, sus filas y la sugerida marcada como la que se conserva', async () => {
        await montar();
        const ana = screen.getByRole('region', { name: 'Grupo de Ana Gomez' });

        expect(within(ana).getByText('Probable reprogramación')).toBeInTheDocument();
        const opciones = within(ana).getAllByRole('radio');
        expect(opciones).toHaveLength(2);
        expect(opciones[1]).toHaveAttribute('aria-checked', 'true');
        expect(opciones[1]).toHaveTextContent('Sugerida');
        expect(opciones[1]).toHaveTextContent('Se conserva');
        expect(opciones[0]).toHaveAttribute('aria-checked', 'false');
        expect(opciones[0]).toHaveTextContent('Se descarta');
        // Fecha, closer, fuente y estado de cada fila.
        expect(opciones[0]).toHaveTextContent(/Reunión \d\d\/10/);
        expect(opciones[0]).toHaveTextContent('Closer Nerina');
        expect(opciones[0]).toHaveTextContent('Meta Ads');
        expect(opciones[0]).toHaveTextContent('Pendiente');
        expect(within(ana).getByRole('checkbox', { name: /Cancelar también la cita/ })).toBeChecked();
    });

    it('resuelve con la conservada elegida y «cancelar citas», y avisa a Revisar', async () => {
        const { onHecho } = await montar();
        const beto = screen.getByRole('region', { name: 'Grupo de Beto Diaz' });

        fireEvent.click(within(beto).getByRole('radio', { name: /#23/ }));
        fireEvent.click(within(beto).getByRole('button', { name: 'Resolver' }));

        await waitFor(() => expect(onHecho).toHaveBeenCalledTimes(1));
        expect(api.post).toHaveBeenCalledWith(`${RUTA}/resolver`, {
            conservada_id: 23, descartar_ids: [21, 22], cancelar_citas: true });
        expect(screen.queryByRole('region', { name: 'Grupo de Beto Diaz' })).toBeNull();
        expect(screen.getByText(/2 agendas descartadas en esta sesión/)).toBeInTheDocument();
    });

    it('sin «cancelar citas» resuelve sin cancelar la llamada', async () => {
        await montar();
        const ana = screen.getByRole('region', { name: 'Grupo de Ana Gomez' });

        fireEvent.click(within(ana).getByRole('checkbox', { name: /Cancelar también la cita/ }));
        fireEvent.click(within(ana).getByRole('button', { name: 'Resolver' }));

        await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${RUTA}/resolver`, {
            conservada_id: 12, descartar_ids: [11], cancelar_citas: false }));
    });

    it('«Resolver todos con la sugerida» pide confirmación y deja afuera los de «Volvió a agendar»', async () => {
        const { onHecho } = await montar();

        fireEvent.click(screen.getByRole('button', { name: 'Resolver todos con la sugerida' }));
        expect(api.post).not.toHaveBeenCalled();
        expect(screen.getByText(/¿Resolver 2 grupos/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Sí, resolver' }));

        await waitFor(() => expect(onHecho).toHaveBeenCalledTimes(1));
        expect(api.post.mock.calls).toEqual([
            [`${RUTA}/resolver`, { conservada_id: 12, descartar_ids: [11], cancelar_citas: true }],
            [`${RUTA}/resolver`, { conservada_id: 21, descartar_ids: [22, 23], cancelar_citas: true }],
        ]);
        expect(screen.queryByRole('region', { name: 'Grupo de Ana Gomez' })).toBeNull();
        expect(screen.queryByRole('region', { name: 'Grupo de Beto Diaz' })).toBeNull();
        expect(screen.getByRole('region', { name: 'Grupo de Carla Ruiz' })).toBeInTheDocument();
    });

    it('si el servidor rechaza, lo muestra y no recarga Revisar', async () => {
        api.post.mockRejectedValueOnce({ response: { data: { error: 'Estas agendas no parecen del mismo lead' } } });
        const { onHecho } = await montar();

        fireEvent.click(within(screen.getByRole('region', { name: 'Grupo de Ana Gomez' }))
            .getByRole('button', { name: 'Resolver' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Estas agendas no parecen del mismo lead');
        expect(onHecho).not.toHaveBeenCalled();
        expect(screen.getByRole('region', { name: 'Grupo de Ana Gomez' })).toBeInTheDocument();
    });

    it('«Descartadas» lista lo descartado y restaura: avisa a Revisar y vuelve a buscar los grupos', async () => {
        const { onHecho } = await montar();

        fireEvent.click(screen.getByRole('tab', { name: 'Descartadas' }));
        const lista = await screen.findByRole('list', { name: 'Agendas descartadas' });
        expect(lista).toHaveTextContent('#41 · Dani Paz');
        expect(lista).toHaveTextContent('se conservó la #42');
        fireEvent.click(within(lista).getByRole('button', { name: 'Restaurar #41' }));

        await waitFor(() => expect(onHecho).toHaveBeenCalledTimes(1));
        expect(api.post).toHaveBeenCalledWith(`${RUTA}/restaurar`, { agenda_ids: [41] });
        expect(await screen.findByText('Todavía no se descartó ninguna agenda.')).toBeInTheDocument();
        // La restaurada puede volver a formar grupo con la que se conservó.
        await waitFor(() => expect(pidioGrupos()).toHaveLength(2));
    });
});

describe('Duplicados · en Revisar', () => {
    beforeEach(() => {
        api.get.mockReset();
        api.get.mockResolvedValue({ data: { grupos: GRUPOS(), total_grupos: 3, hay_mas: false } });
    });

    const agenda = {
        tipo: 'agenda', id: 7, client_id: 7, cliente: 'Ana Gomez', ig: '', email: '', telefono: '',
        fecha: '2026-10-10T15:00:00', creada: '2026-10-01T15:00:00', fuente: 'Meta Ads', closer: 'Nerina',
        closer_id: 1, setter: '', setter_id: null, pre_call: { key: 'confirmada', label: 'Confirmada', tone: 'info' },
        post_call: { key: 'pendiente', label: 'Pendiente', tone: 'idle' }, estado_libro: 'pendiente',
        asistio: false, realizada: false, presento: false, retraso_dias: 0, ya_paso: false, descartada: false,
        con_venta: false, venta_tipo: null, con_sena: false,
    };
    const props = (tabla) => ({
        tabla, setTabla: () => {}, cargando: false, rol: 'closers', basis: 'creacion', setBasis: () => {},
        datos: { filas: [agenda], dates: OCTUBRE }, alcance: 'Todo el equipo', onAbrirFila: () => {},
        filtroInicial: null, onOlvidarFiltro: () => {}, puedeElegirEquipo: true,
        operacion: operacionDe(tabla), onRecargar: vi.fn(),
    });

    it('la tabla Agendas trae «Duplicados», que abre el panel con el período de Revisar', async () => {
        render(<Revisar {...props('agendas')} />);

        fireEvent.click(screen.getByRole('button', { name: 'Duplicados' }));

        expect(await screen.findByRole('dialog', { name: 'Agendas repetidas' })).toBeInTheDocument();
        // Aunque la lista esté por fecha de creación, los grupos se buscan por la reunión.
        expect(pidioGrupos()[0][1].params).toEqual(
            { start_date: '2026-10-01', end_date: '2026-10-31', date_filter_by: 'meet' });
    });

    it('las demás tablas no la traen', () => {
        expect(operacionDe('ventas')?.herramientas.some(h => h.id === 'duplicados') ?? false).toBe(false);
        expect(operacionDe('clientes')?.herramientas.some(h => h.id === 'duplicados') ?? false).toBe(false);
    });
});
