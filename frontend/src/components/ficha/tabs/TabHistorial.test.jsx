import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabHistorial from './TabHistorial';
import { fichaPrecall } from '../__fixtures__/ficha';
import { localDateFromNow } from '../../../utils/datetime';

// `start_time` viaja en UTC y sin Z, como lo manda `isoformat()`. Las expectativas se arman con la
// misma cuenta en la zona del proceso, para que el test no dependa del huso de la máquina.
const HORA_UTC = '2026-10-02T21:30:00';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const enLocal = (iso) => {
    const d = new Date(`${iso}Z`);
    const hora = [d.getHours(), d.getMinutes()].map(n => String(n).padStart(2, '0')).join(':');
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${hora}`;
};

const AGENDA = {
    id: 71, fecha: HORA_UTC, detalle: 'vsl · Jean Carlo', chip: { label: 'Próxima', tone: 'info' },
    pre_call: 'sin_confirmar', post_call: 'pendiente', closer: 'Jean Carlo', closer_id: 7,
    fuente: 'vsl',
};

// Los estados con la forma que manda el backend (`comercial_service.PRE_CALL`/`POST_CALL`).
const VOCABULARIO = {
    ...fichaPrecall.vocabulario,
    pre_call: [{ key: 'confirmada', label: 'Confirmada' }, { key: 'sin_confirmar', label: 'Sin confirmar' }],
    post_call: [
        { key: 'pendiente', label: 'Pendiente', editable: true },
        { key: 'no_show', label: 'No show', editable: true },
        { key: 'venta', label: 'Venta', editable: false },
    ],
    // `ficha_vocabulario.fuentes_disponibles()`: el catálogo del Tablero de Agendas, en dos grupos.
    fuentes: [
        { titulo: 'Embudos', tono: 'info', opciones: [
            { clave: 'workshop', label: 'Workshop en vivo' },
            { clave: 'vsl', label: 'VSL' },
        ] },
        { titulo: 'Setters', tono: 'success', opciones: [{ clave: 'Paula', label: 'Paula' }] },
    ],
    // `ficha_vocabulario.tipos_seguimiento()`: los grupos de la pestaña Seguimientos del closer.
    tipos_seguimiento: [
        { clave: 'no_tomada', label: 'Llamadas no tomadas', desc: 'No shows, cancelaciones y reprogramaciones' },
        { clave: 'tomada', label: 'Llamadas tomadas', desc: 'Asistieron y quedó una decisión o una 2ª llamada' },
        { clave: 'cerrada', label: 'Llamadas cerradas', desc: 'Clientes: cobranza, renovación y upsell' },
    ],
};

const ficha = (agendas = [AGENDA], extra = {}) => ({
    ...fichaPrecall,
    historial: { ...fichaPrecall.historial, agendas },
    vocabulario: VOCABULARIO,
    ...extra,
});

const abrirAgendas = async (usuario, f = ficha(), onAccion = vi.fn().mockResolvedValue({})) => {
    render(<TabHistorial ficha={f} onAccion={onAccion} />);
    await usuario.click(screen.getByRole('button', { name: /Agendas/ }));
    return onAccion;
};

describe('la hora de las agendas', () => {
    it('se muestra en el reloj de quien mira, no en UTC', async () => {
        const usuario = userEvent.setup();
        await abrirAgendas(usuario);

        // La fila y el resumen de la sección dicen la misma hora local.
        expect(screen.getAllByText(enLocal(HORA_UTC)).length).toBeGreaterThan(0);
        expect(screen.getByText(new RegExp(`próxima ${enLocal(HORA_UTC)}`))).toBeInTheDocument();
    });

    it('«Agendar otra llamada» manda un instante UTC, no la hora local cruda', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirAgendas(usuario);
        await usuario.click(screen.getByRole('button', { name: 'Agendar otra llamada' }));
        const campo = screen.getByLabelText('Fecha y hora de la llamada');
        await usuario.clear(campo);
        await usuario.type(campo, '2026-12-15T10:00');
        await usuario.click(screen.getByRole('button', { name: 'Agendar' }));

        expect(onAccion).toHaveBeenCalledWith('crear_agenda', {
            fecha: new Date('2026-12-15T10:00:00').toISOString(), closer_id: 7,
        });
    });
});

// Pedido del 29/09/2026: la fecha, la hora, la fuente (y el closer) de cada agenda se corrigen en
// la fila, con el lápiz.
describe('corregir una agenda en la fila', () => {
    const lapiz = () => screen.getByRole('button', { name: /Corregir fecha, fuente y closer/ });
    const editor = () => screen.getByRole('group', { name: /Corregir la agenda/ });

    it('el lápiz abre el editor con lo que la agenda tiene hoy, en hora local', async () => {
        const usuario = userEvent.setup();
        await abrirAgendas(usuario);
        await usuario.click(lapiz());

        const d = new Date(`${HORA_UTC}Z`);
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-`
            + `${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:`
            + `${String(d.getMinutes()).padStart(2, '0')}`;
        expect(within(editor()).getByLabelText('Fecha y hora')).toHaveValue(local);
        expect(within(editor()).getByLabelText('Fuente de la agenda')).toHaveValue('vsl');
        expect(within(editor()).getByLabelText('Closer de la agenda')).toHaveValue('7');
        // Los desplegables de estado siguen en la fila.
        expect(screen.getByLabelText(/Pre call de la agenda/)).toBeInTheDocument();
        // Sin cambios no hay nada que guardar.
        expect(within(editor()).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    });

    it('guarda solo lo que cambió, con la hora como instante UTC y apuntado a ESA agenda', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirAgendas(usuario);
        await usuario.click(lapiz());
        const campo = within(editor()).getByLabelText('Fecha y hora');
        await usuario.clear(campo);
        await usuario.type(campo, '2026-10-03T09:15');
        await usuario.click(within(editor()).getByRole('button', { name: 'Guardar cambios' }));

        expect(onAccion).toHaveBeenCalledWith('editar_agenda',
            { fecha: new Date('2026-10-03T09:15:00').toISOString() }, 71);
        // Se cerró al guardar bien.
        expect(screen.queryByRole('group', { name: /Corregir la agenda/ })).not.toBeInTheDocument();
    });

    it('la fuente sale del catálogo y el closer de la lista de closers', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirAgendas(usuario);
        await usuario.click(lapiz());
        await usuario.selectOptions(within(editor()).getByLabelText('Fuente de la agenda'), 'Paula');
        await usuario.selectOptions(within(editor()).getByLabelText('Closer de la agenda'), '8');
        await usuario.click(within(editor()).getByRole('button', { name: 'Guardar cambios' }));

        expect(onAccion).toHaveBeenCalledWith('editar_agenda', { fuente: 'Paula', closer_id: 8 }, 71);
    });

    it('una fuente vieja fuera del catálogo se muestra, y no viaja si no se toca', async () => {
        const usuario = userEvent.setup();
        const vieja = { ...AGENDA, fuente: 'Entrevista Diagnóstica Gratuita' };
        const onAccion = await abrirAgendas(usuario, ficha([vieja]));
        await usuario.click(lapiz());

        expect(within(editor()).getByLabelText('Fuente de la agenda'))
            .toHaveValue('Entrevista Diagnóstica Gratuita');
        expect(within(editor()).getByRole('option', { name: /fuera del catálogo/ })).toBeInTheDocument();
        await usuario.selectOptions(within(editor()).getByLabelText('Closer de la agenda'), '9');
        await usuario.click(within(editor()).getByRole('button', { name: 'Guardar cambios' }));

        expect(onAccion).toHaveBeenCalledWith('editar_agenda', { closer_id: 9 }, 71);
    });

    it('si el backend rechaza, el editor se queda abierto con lo elegido', async () => {
        const usuario = userEvent.setup();
        const onAccion = vi.fn().mockRejectedValue(new Error('Ese closer ya tiene otra llamada'));
        await abrirAgendas(usuario, ficha(), onAccion);
        await usuario.click(lapiz());
        await usuario.selectOptions(within(editor()).getByLabelText('Fuente de la agenda'), 'workshop');
        await usuario.click(within(editor()).getByRole('button', { name: 'Guardar cambios' }));

        expect(within(editor()).getByLabelText('Fuente de la agenda')).toHaveValue('workshop');
    });

    it('sin el permiso de reasignar no se ofrece cambiar el closer', async () => {
        const usuario = userEvent.setup();
        await abrirAgendas(usuario, ficha([AGENDA], {
            permisos: { ...fichaPrecall.permisos, reasignar: false },
        }));
        await usuario.click(lapiz());

        expect(within(editor()).queryByLabelText('Closer de la agenda')).not.toBeInTheDocument();
        expect(within(editor()).getByLabelText('Fuente de la agenda')).toBeInTheDocument();
    });

    it('quien no puede reportar ve la agenda pero no el lápiz', async () => {
        const usuario = userEvent.setup();
        await abrirAgendas(usuario, ficha([AGENDA], {
            permisos: { ...fichaPrecall.permisos, reportar: false, reasignar: false },
        }));

        expect(screen.queryByRole('button', { name: /Corregir fecha, fuente y closer/ }))
            .not.toBeInTheDocument();
        expect(screen.getByText('VSL · Jean Carlo')).toBeInTheDocument();
    });
});

// Pedido del 29/09/2026: «En los seguimientos deberían poder crearse seguimientos y cambiar el
// estado de los seguimientos». Un seguimiento vive en su agenda (uno por agenda).
const SEGUIMIENTO = {
    agenda_id: 71, agenda_fecha: HORA_UTC, fecha: '2026-10-06', canal: null,
    nota: 'Lo habla con la esposa', tipo: 'tomada', realizado: false, intento: 2,
};
const OTRA_AGENDA = {
    ...AGENDA, id: 64, fecha: '2026-09-20T15:00:00', chip: { label: 'No show', tone: 'error' },
    tipo_seguimiento: 'no_tomada',
};

const conSeguimientos = (seguimientos = [SEGUIMIENTO], agendas = [AGENDA, OTRA_AGENDA], extra = {}) => ({
    ...ficha(agendas),
    historial: { ...fichaPrecall.historial, agendas, seguimientos },
    ...extra,
});

const abrirSeguimientos = async (usuario, f = conSeguimientos(), onAccion = vi.fn().mockResolvedValue({})) => {
    render(<TabHistorial ficha={f} onAccion={onAccion} />);
    await usuario.click(screen.getByRole('button', { name: /^Seguimientos/ }));
    return onAccion;
};

describe('los seguimientos del historial', () => {
    const estado = () => screen.getByRole('group', { name: /Estado del seguimiento/ });
    const editor = () => screen.getByRole('group', { name: /Corregir el seguimiento/ });

    it('la fila dice el día, la nota, el tipo, el intento y de qué agenda es', async () => {
        const usuario = userEvent.setup();
        await abrirSeguimientos(usuario);

        expect(screen.getByText('6 oct 2026')).toBeInTheDocument();
        expect(screen.getByText('Lo habla con la esposa')).toBeInTheDocument();
        expect(screen.getByText(`Llamadas tomadas · Seguimiento 2 de 4 · de la agenda del ${enLocal(HORA_UTC)}`))
            .toBeInTheDocument();
        expect(within(estado()).getByRole('button', { name: 'Pendiente' }))
            .toHaveAttribute('aria-pressed', 'true');
    });

    it('marcarlo realizado manda solo el estado, apuntado a la agenda del seguimiento', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirSeguimientos(usuario);
        await usuario.click(within(estado()).getByRole('button', { name: 'Realizado' }));

        expect(onAccion).toHaveBeenCalledWith('corregir_seguimiento', { realizado: true }, 71);
    });

    it('si el backend rechaza el cambio de estado, vuelve a como estaba', async () => {
        const usuario = userEvent.setup();
        const onAccion = vi.fn().mockRejectedValue(new Error('No se pudo'));
        await abrirSeguimientos(usuario, conSeguimientos(), onAccion);
        await usuario.click(within(estado()).getByRole('button', { name: 'Realizado' }));

        expect(within(estado()).getByRole('button', { name: 'Pendiente' }))
            .toHaveAttribute('aria-pressed', 'true');
    });

    it('el lápiz corrige día, tipo y nota, y manda solo lo que cambió', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirSeguimientos(usuario);
        await usuario.click(screen.getByRole('button', { name: /Corregir día, tipo y nota/ }));

        expect(within(editor()).getByLabelText('Día del contacto')).toHaveValue('2026-10-06');
        expect(within(editor()).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
        await usuario.selectOptions(within(editor()).getByLabelText('Tipo de seguimiento'), 'cerrada');
        // La explicación del tipo elegido, con las palabras de la pestaña del closer.
        expect(within(editor()).getByText('Clientes: cobranza, renovación y upsell')).toBeInTheDocument();
        const nota = within(editor()).getByLabelText('Nota');
        await usuario.clear(nota);
        await usuario.type(nota, 'Cobrar la cuota');
        await usuario.click(within(editor()).getByRole('button', { name: 'Guardar cambios' }));

        expect(onAccion).toHaveBeenCalledWith('corregir_seguimiento',
            { tipo: 'cerrada', nota: 'Cobrar la cuota' }, 71);
        expect(screen.queryByRole('group', { name: /Corregir el seguimiento/ })).not.toBeInTheDocument();
    });

    it('Escape cierra el editor del seguimiento y no llega a cerrar la ficha', async () => {
        const usuario = userEvent.setup();
        const cerrarFicha = vi.fn();
        document.addEventListener('keydown', cerrarFicha);
        await abrirSeguimientos(usuario);
        await usuario.click(screen.getByRole('button', { name: /Corregir día, tipo y nota/ }));
        await usuario.keyboard('{Escape}');
        document.removeEventListener('keydown', cerrarFicha);

        expect(screen.queryByRole('group', { name: /Corregir el seguimiento/ })).not.toBeInTheDocument();
        expect(cerrarFicha).not.toHaveBeenCalled();
    });

    it('un pendiente con el día pasado se marca atrasado, también en el resumen', async () => {
        const usuario = userEvent.setup();
        await abrirSeguimientos(usuario, conSeguimientos([
            { ...SEGUIMIENTO, fecha: '2020-01-10' },
            { ...SEGUIMIENTO, agenda_id: 64, fecha: '2099-03-02', intento: 1 },
        ]));

        expect(screen.getByText('Atrasado')).toBeInTheDocument();
        expect(screen.getByText('2 seguimientos · 1 atrasado · próximo 2 mar 2099')).toBeInTheDocument();
    });

    it('uno que el mazo cerró sin día se lee «Sin fecha» y se puede reabrir', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirSeguimientos(usuario,
            conSeguimientos([{ ...SEGUIMIENTO, fecha: null, realizado: true }]));

        expect(screen.getByText('Sin fecha')).toBeInTheDocument();
        const estadoSinFecha = screen.getByRole('group', { name: 'Estado del seguimiento sin fecha' });
        await usuario.click(within(estadoSinFecha).getByRole('button', { name: 'Pendiente' }));

        expect(onAccion).toHaveBeenCalledWith('corregir_seguimiento', { realizado: false }, 71);
    });

    it('quien no puede reportar ve el estado pero no lo corrige ni agenda otro', async () => {
        const usuario = userEvent.setup();
        await abrirSeguimientos(usuario, conSeguimientos([{ ...SEGUIMIENTO, realizado: true }],
            [AGENDA, OTRA_AGENDA], { permisos: { ...fichaPrecall.permisos, reportar: false } }));

        expect(screen.getByText('Realizado')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: /Estado del seguimiento/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Corregir día, tipo y nota/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Agendar seguimiento' })).not.toBeInTheDocument();
    });
});

describe('el registro de eventos', () => {
    it('el botón de borrar un evento se nombra para los lectores de pantalla', async () => {
        const usuario = userEvent.setup();
        render(<TabHistorial onAccion={vi.fn()} ficha={{
            ...fichaPrecall,
            historial: { ...fichaPrecall.historial, eventos: [
                { id: 5, fecha: '2026-09-20T10:00:00', detalle: 'Llamó dos veces', autor: 'vendedor' },
            ] },
        }} />);
        await usuario.click(screen.getByRole('button', { name: /^Registro de eventos/ }));

        // Es solo un ícono: sin nombre, el lector anunciaba «botón» a secas.
        expect(screen.getByRole('button', { name: 'Borrar este evento' })).toBeInTheDocument();
    });
});

describe('agendar un seguimiento desde el historial', () => {
    const RECIENTE = { ...AGENDA, tipo_seguimiento: 'tomada' };
    const formulario = () => screen.getByRole('group', { name: 'Agendar un seguimiento' });
    const abrirFormulario = async (usuario, f, onAccion) => {
        const accion = await abrirSeguimientos(usuario, f, onAccion);
        await usuario.click(screen.getByRole('button', { name: 'Agendar seguimiento' }));
        return accion;
    };

    it('arranca sobre la agenda más reciente, con su tipo y a tres días, y manda día, tipo y nota', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirFormulario(usuario, conSeguimientos([], [RECIENTE, OTRA_AGENDA]));

        expect(within(formulario()).getByLabelText('Agenda del seguimiento')).toHaveValue('71');
        expect(within(formulario()).getByLabelText('Día del contacto')).toHaveValue(localDateFromNow(3));
        expect(within(formulario()).getByLabelText('Tipo de seguimiento')).toHaveValue('tomada');
        const dia = within(formulario()).getByLabelText('Día del contacto');
        await usuario.clear(dia);
        await usuario.type(dia, '2099-03-02');
        await usuario.type(within(formulario()).getByLabelText('Nota'), '  Llamarlo después de las 20 ');
        await usuario.click(within(formulario()).getByRole('button', { name: 'Agendar seguimiento' }));

        expect(onAccion).toHaveBeenCalledWith('agendar_seguimiento',
            { fecha: '2099-03-02', tipo: 'tomada', nota: 'Llamarlo después de las 20' }, 71);
        expect(screen.queryByRole('group', { name: 'Agendar un seguimiento' })).not.toBeInTheDocument();
    });

    it('avisa que reemplaza el seguimiento de una agenda que ya tiene uno', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirFormulario(usuario, conSeguimientos([SEGUIMIENTO], [RECIENTE, OTRA_AGENDA]));

        expect(within(formulario()).getByText(/agendar este lo reemplaza/)).toBeInTheDocument();
        expect(within(formulario()).getByText(/Pendiente · 6 oct 2026 · «Lo habla con la esposa»/))
            .toBeInTheDocument();
        await usuario.click(within(formulario()).getByRole('button', { name: 'Reemplazar seguimiento' }));

        expect(onAccion).toHaveBeenCalledWith('agendar_seguimiento',
            expect.objectContaining({ tipo: 'tomada' }), 71);
    });

    it('elegir otra agenda trae el tipo de esa agenda y apunta el pedido a ella', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirFormulario(usuario, conSeguimientos([SEGUIMIENTO], [RECIENTE, OTRA_AGENDA]));
        await usuario.selectOptions(within(formulario()).getByLabelText('Agenda del seguimiento'), '64');

        expect(within(formulario()).getByLabelText('Tipo de seguimiento')).toHaveValue('no_tomada');
        // La 64 no tiene seguimiento: no hay nada que reemplazar.
        expect(within(formulario()).queryByText(/lo reemplaza/)).not.toBeInTheDocument();
        await usuario.click(within(formulario()).getByRole('button', { name: 'Agendar seguimiento' }));

        expect(onAccion).toHaveBeenCalledWith('agendar_seguimiento',
            expect.objectContaining({ tipo: 'no_tomada' }), 64);
    });

    it('un tipo elegido a mano no se pisa al cambiar de agenda', async () => {
        const usuario = userEvent.setup();
        await abrirFormulario(usuario, conSeguimientos([], [RECIENTE, OTRA_AGENDA]));
        await usuario.selectOptions(within(formulario()).getByLabelText('Tipo de seguimiento'), 'cerrada');
        await usuario.selectOptions(within(formulario()).getByLabelText('Agenda del seguimiento'), '64');

        expect(within(formulario()).getByLabelText('Tipo de seguimiento')).toHaveValue('cerrada');
    });

    it('dice a quién le va a aparecer, y avisa si ese closer ya no está activo', async () => {
        const usuario = userEvent.setup();
        const deBaja = { ...OTRA_AGENDA, closer: 'Sebastián', closer_id: 99 };
        await abrirFormulario(usuario, conSeguimientos([], [RECIENTE, deBaja]));

        expect(within(formulario()).getByText(/Le va a aparecer a Jean Carlo en su pestaña Seguimientos desde el/))
            .toBeInTheDocument();
        await usuario.selectOptions(within(formulario()).getByLabelText('Agenda del seguimiento'), '64');
        expect(within(formulario()).getByText(/Sebastián ya no está activo/)).toBeInTheDocument();
    });

    it('con una sola agenda no pregunta sobre cuál', async () => {
        const usuario = userEvent.setup();
        await abrirFormulario(usuario, conSeguimientos([], [RECIENTE]));

        expect(within(formulario()).queryByLabelText('Agenda del seguimiento')).not.toBeInTheDocument();
    });

    it('si el backend rechaza, el formulario se queda con lo cargado', async () => {
        const usuario = userEvent.setup();
        const onAccion = vi.fn().mockRejectedValue(new Error('No se pudo'));
        await abrirFormulario(usuario, conSeguimientos([], [RECIENTE]), onAccion);
        await usuario.type(within(formulario()).getByLabelText('Nota'), 'Cobrar la cuota');
        await usuario.click(within(formulario()).getByRole('button', { name: 'Agendar seguimiento' }));

        expect(within(formulario()).getByLabelText('Nota')).toHaveValue('Cobrar la cuota');
    });
});
