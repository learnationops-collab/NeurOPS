import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import Revisar from './Revisar';

/**
 * La tira de totales cuenta lo que muestra la lista: búsqueda, etiquetas del filtro y filtro rápido.
 *
 * Pedido del usuario (30/09/2026), sobre la tira de Clientes: «la idea es que muestre los datos
 * según lo que se está filtrando». Hasta entonces la tira ignoraba el filtro rápido: con «Con deuda»
 * elegido seguía contando la cartera entera. Cada test elige un filtro y comprueba que cada número
 * sale de las filas que se ven, y que la cuenta es la del "mostrando X".
 */

const props = (extra = {}) => ({
    setTabla: () => {}, cargando: false, rol: 'closers', basis: 'meet', setBasis: () => {},
    alcance: 'Todo el equipo', onAbrirFila: () => {}, filtroInicial: null, onOlvidarFiltro: () => {},
    puedeElegirEquipo: true, ...extra,
});

/** El número de un total (el primer `<b>` de su celda) y la celda entera, por su clave. */
const tira = () => document.querySelector('.tot-tira');
const celda = (clave) => tira().querySelector(`[data-total="${clave}"]`);
const valor = (clave) => celda(clave).querySelector('b').textContent;
const registros = () => screen.queryAllByRole('button', { name: /^Abrir / });
const mostrando = () => screen.getByText(/^mostrando \d+ de \d+$/).textContent;

const elegirRapido = (actual, etiqueta) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${actual}`) }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: new RegExp(`^${etiqueta}`) }));
};

const buscar = (texto) => fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }),
    { target: { value: texto } });

// --- Clientes --------------------------------------------------------------------------------

const cliente = (id, nombre, extra = {}) => ({
    tipo: 'cliente', id, client_id: id, cliente: nombre, ig: '', email: '', telefono: '',
    fecha: '2026-08-01T00:00:00', closer: 'Nerina', programa: 'Residency Roadmap',
    pagado: 100, deuda: 0, cobros: 1, cuota_monto: null, cuota_fecha: null, cuota_vencida: false,
    cuota_numero: null, baja: null, estado: { key: 'al_dia', label: 'Al día', tone: 'success' },
    ...extra,
});
const vencida = { key: 'vencida', label: 'Cuota vencida', tone: 'error' };
const CLIENTES = [
    cliente(1, 'Ana Gomez', { pagado: 500, deuda: 900, cuota_monto: 300, cuota_vencida: true, estado: vencida }),
    cliente(2, 'Beto Diaz', { pagado: 200, deuda: 400, estado: { key: 'por_vencer', label: 'Con deuda', tone: 'warning' } }),
    cliente(3, 'Carla Ruiz', { pagado: 1000, closer: 'Marlon' }),
    cliente(4, 'Dani Paz', { pagado: 50, deuda: 150, cuota_monto: 150, cuota_vencida: true, estado: vencida,
        closer: 'Marlon' }),
    cliente(5, 'Eva Sol', { pagado: 70, estado: { key: 'baja', label: 'Dado de baja', tone: 'idle' },
        baja: { fecha: '2026-09-12T10:00:00', fecha_legible: '12 sep 2026', motivo: 'x', por: 'lucia' } }),
];

describe('Totales · Clientes', () => {
    beforeEach(() => { window.localStorage.clear(); });

    it('el filtro rápido «Con deuda» cambia todos los números de la tira', () => {
        render(<Revisar {...props({ tabla: 'clientes', datos: { filas: CLIENTES } })} />);
        // «Vigentes»: la baja no se ve, así que tampoco suma.
        expect(valor('clientes')).toBe('4');
        expect(valor('cobrado')).toBe('$1,750');
        expect(mostrando()).toBe('mostrando 4 de 5');

        elegirRapido('Vigentes', 'Con deuda');

        expect(registros()).toHaveLength(3);
        expect(valor('clientes')).toBe('3');
        expect(mostrando()).toBe('mostrando 3 de 5');
        expect(valor('deuda')).toBe('$1,450');
        expect(valor('vencido')).toBe('$450');
        expect(valor('cobrado')).toBe('$750');
    });

    it('las etiquetas del filtro y la búsqueda se suman al filtro rápido', () => {
        render(<Revisar {...props({ tabla: 'clientes', datos: { filas: CLIENTES },
            filtroInicial: { closer: 'Marlon', __t: 1 } })} />);
        expect(valor('clientes')).toBe('2');
        expect(valor('cobrado')).toBe('$1,050');

        elegirRapido('Vigentes', 'Cuota vencida');
        expect(valor('clientes')).toBe('1');
        expect(valor('deuda')).toBe('$150');

        buscar('nadie');
        expect(valor('clientes')).toBe('0');
        expect(valor('deuda')).toBe('$0');
    });

    it('cada número lleva un rótulo corto: las aclaraciones van en su "i"', () => {
        render(<Revisar {...props({ tabla: 'clientes', datos: { filas: CLIENTES } })} />);

        expect(tira().textContent).not.toMatch(/de esta cartera|desde siempre/);
        expect(celda('deuda').textContent).toMatch(/deuda.*3 con saldo/);

        const deuda = within(celda('deuda')).getByRole('note');
        expect(deuda).toHaveAccessibleName(/^Deuda: Lo que deben hoy .*«por cobrar» de Cash/);
        fireEvent.mouseEnter(deuda);
        expect(screen.getByText(/No coincide con el «por cobrar» de Cash/)).toBeInTheDocument();
        fireEvent.mouseLeave(deuda);

        expect(within(celda('cobrado')).getByRole('note'))
            .toHaveAccessibleName(/^Cobrado: .*no depende del período/);
        // Lo que no necesita aclaración no lleva "i".
        expect(within(celda('vencido')).queryByRole('note')).toBeNull();
    });

    it('el rótulo de una cuenta concuerda con su número', () => {
        render(<Revisar {...props({ tabla: 'clientes', datos: { filas: CLIENTES } })} />);

        elegirRapido('Vigentes', 'Al día');

        expect(valor('clientes')).toBe('1');
        expect(celda('clientes').textContent).toMatch(/cliente(?!s)/);
        expect(celda('vencido').textContent).toMatch(/0 cuotas/);
    });

    it('la tira se enciende con cualquier filtro, sin palabras, y el alcance no repite la búsqueda', () => {
        render(<Revisar {...props({ tabla: 'clientes', datos: { filas: CLIENTES } })} />);
        const encendida = () => tira().classList.contains('tot-tira--filtrada');
        expect(encendida()).toBe(false);
        expect(tira()).toHaveAccessibleName('Totales de la lista');

        elegirRapido('Vigentes', 'Con deuda');
        expect(encendida()).toBe(true);
        expect(tira()).toHaveAccessibleName('Totales de lo filtrado');
        elegirRapido('Con deuda', 'Vigentes');
        expect(encendida()).toBe(false);

        buscar('Ana');
        expect(encendida()).toBe(true);
        expect(tira().querySelector('.tot-alcance')).toHaveTextContent(/^Todo el equipo$/);
        buscar('  ');
        expect(encendida()).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Filtro completo' }))
            .getByRole('checkbox', { name: /^Marlon/ }));
        expect(encendida()).toBe(true);
        // Sin texto que lo diga: lo dicen el borde y el embudo (y el nombre accesible).
        expect(tira().textContent).not.toMatch(/filtrad/i);
    });

    it('la grilla sabe cuántos números hay, para no dejar uno solo abajo', () => {
        const { unmount } = render(<Revisar {...props({ tabla: 'clientes', datos: { filas: CLIENTES } })} />);
        expect(tira()).toHaveAttribute('data-n', '4');
        expect(tira().style.getPropertyValue('--n')).toBe('4');
        unmount();

        render(<Revisar {...props({ tabla: 'agendas', datos: { filas: AGENDAS } })} />);
        expect(tira()).toHaveAttribute('data-n', '6');
    });

    it('sin nadie con cuenta en la Academia, su número no aparece', () => {
        render(<Revisar {...props({ tabla: 'clientes', datos: { filas: CLIENTES } })} />);

        expect(celda('academia')).toBeNull();
        expect(tira().querySelectorAll('[data-total]')).toHaveLength(4);
    });
});

// --- Agendas ---------------------------------------------------------------------------------

const agenda = (id, post, { asistio = true, presento = true, closer = 'Nerina', retraso = 0 } = {}) => ({
    tipo: 'agenda', id, client_id: id, cliente: `Cliente ${id}`, ig: '', fecha: '2026-09-10T10:00:00',
    fuente: 'Instagram', closer, realizada: post !== 'Pendiente' || retraso > 0, retraso_dias: retraso,
    asistio, presento,
    pre_call: { key: 'confirmada', label: 'Confirmada', tone: 'success' },
    post_call: { key: post.toLowerCase().replace(' ', '_'), label: post, tone: 'info' },
});
const AGENDAS = [
    agenda(1, 'Venta'), agenda(2, 'Venta', { closer: 'Marlon' }), agenda(3, 'Seguimiento'),
    agenda(4, 'No show', { asistio: false, presento: false }),
    agenda(5, 'Pendiente', { asistio: false, presento: false, retraso: 2 }),
    agenda(6, 'Seguimiento', { closer: 'Marlon' }),
];

describe('Totales · Agendas', () => {
    beforeEach(() => { window.localStorage.clear(); });

    it('con una etiqueta y el filtro rápido, cada número sale de las filas que se ven', () => {
        render(<Revisar {...props({ tabla: 'agendas', datos: { filas: AGENDAS },
            filtroInicial: { closer: 'Nerina', __t: 1 } })} />);
        expect(valor('agendas')).toBe('4');
        expect(valor('show_up')).toBe('50%');
        expect(valor('no_show')).toBe('1');

        elegirRapido('Todas', 'Asistieron');

        expect(registros()).toHaveLength(2);
        expect(valor('agendas')).toBe('2');
        expect(valor('show_up')).toBe('100%');
        expect(valor('close_rate')).toBe('50%');
        expect(valor('seguimiento')).toBe('1');
        expect(valor('no_show')).toBe('0');
        expect(valor('pendientes')).toBe('0');
    });

    it('«Cumple alguna» suma las filas de cada etiqueta', () => {
        render(<Revisar {...props({ tabla: 'agendas', datos: { filas: AGENDAS },
            filtroInicial: { closer: 'Marlon', post_call: 'No show', __t: 1 } })} />);
        // «Cumple todas»: un No show de Marlon no hay.
        expect(registros()).toHaveLength(0);
        expect(valor('agendas')).toBe('0');

        fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Filtro completo' }))
            .getByRole('button', { name: 'Alguna' }));

        expect(registros()).toHaveLength(3);
        expect(valor('agendas')).toBe('3');
        expect(valor('no_show')).toBe('1');
        expect(valor('close_rate')).toBe('50%');
    });
});

// --- Ventas ----------------------------------------------------------------------------------

const venta = (id, cliente, monto, tipo = 'completo', extra = {}) => ({
    tipo: 'venta', id, client_id: id, cliente, closer: 'Nerina', programa: 'ACE',
    fecha: '2026-09-10T10:00:00', metodo: 'Stripe', monto, monto_neto: monto - 10, es_venta: true,
    tipo_pago: { key: tipo, label: tipo === 'completo' ? 'Pago completo' : 'Split Pay', tone: 'success' },
    academia: null, ...extra,
});
const VENTAS = [
    venta(1, 'Ana Gomez', 1000), venta(2, 'Ana Gomez', 300, 'parcial'), venta(3, 'Beto Diaz', 500, 'parcial'),
    venta(4, 'Carla Ruiz', 200, 'completo', { es_venta: false }),
];

describe('Totales · Ventas', () => {
    beforeEach(() => { window.localStorage.clear(); });

    it('la búsqueda y el filtro rápido recortan el cash, las ventas y el ticket', () => {
        render(<Revisar {...props({ tabla: 'ventas', datos: { filas: VENTAS } })} />);
        expect(valor('cash')).toBe('$2,000');

        buscar('Ana');
        expect(valor('cash')).toBe('$1,300');
        expect(celda('cash').textContent).toMatch(/2 cobros/);
        expect(valor('ventas')).toBe('2');
        expect(valor('ticket')).toBe('$650');
        expect(valor('neto')).toBe('$1,280');

        elegirRapido('Todas', 'Split Pay');
        expect(registros()).toHaveLength(1);
        expect(valor('cash')).toBe('$300');
        expect(celda('cash').textContent).toMatch(/1 cobro\b/);
    });
});

// --- Leads -----------------------------------------------------------------------------------

const lead = (id, { respondio = false, cualificado = false, agendo = false, mensajes = 1, setter = 'Lu' } = {}) => ({
    tipo: 'lead', id, cliente: `Lead ${id}`, ig: '', fecha: '2026-09-10T10:00:00', fuente: 'Instagram',
    setter, respondio, cualificado, agendo, mensajes,
    estado: { key: agendo ? 'agendo' : 'nuevo', label: agendo ? 'Agendó' : 'Nuevo', tone: 'info' },
});
const LEADS = [
    lead(1, { respondio: true, cualificado: true, agendo: true, mensajes: 4 }),
    lead(2, { respondio: true, mensajes: 2 }),
    lead(3, { mensajes: 1 }),
    lead(4, { respondio: true, cualificado: true, agendo: true, mensajes: 3, setter: 'Mia' }),
];

describe('Totales · Leads', () => {
    beforeEach(() => { window.localStorage.clear(); });

    it('el filtro rápido «Agendaron» deja la conversión de esa lista', () => {
        render(<Revisar {...props({ tabla: 'leads', rol: 'setters', datos: { filas: LEADS } })} />);
        expect(valor('leads')).toBe('4');
        expect(valor('conversion')).toBe('50%');

        elegirRapido('Todos', 'Agendaron');

        expect(registros()).toHaveLength(2);
        expect(valor('leads')).toBe('2');
        expect(celda('leads').textContent).toMatch(/7 mensajes/);
        expect(valor('respuesta')).toBe('100%');
        expect(valor('conversion')).toBe('100%');
        expect(mostrando()).toBe('mostrando 2 de 4');
    });
});
