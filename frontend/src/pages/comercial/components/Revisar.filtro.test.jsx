import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Revisar from './Revisar';

/**
 * La fila de etiquetas del filtro: lo único que queda arriba de la lista al llegar de un número.
 *
 * Pedido del usuario (30/09/2026), sobre la lista de «Cierre por presentación»: sacar el aviso
 * grande violeta («Viniste de… · 13 de 238 registros», con las etiquetas repetidas y un «Quitar el
 * filtro»), dejar solo la fila «Cumple todas» para poner y sacar etiquetas, y que de dónde viene el
 * filtro sea, como mucho, un tooltip breve.
 */

const agenda = (id, post, { asistio = true, presento = true } = {}) => ({
    tipo: 'agenda', id, client_id: id, cliente: `Cliente ${id}`, ig: '', fecha: '2026-09-10T10:00:00',
    fuente: 'Instagram', closer: 'Nerina', realizada: true, retraso_dias: 0, asistio, presento,
    pre_call: { key: 'confirmada', label: 'Confirmada', tone: 'success' },
    post_call: { key: post.toLowerCase().replace(' ', '_'), label: post, tone: 'info' },
});
const FILAS = [
    agenda(1, 'Venta'), agenda(2, 'Venta'), agenda(3, 'Seguimiento'),
    agenda(4, 'No show', { asistio: false, presento: false }),
];

const props = (extra = {}) => ({
    tabla: 'agendas', setTabla: () => {}, datos: { filas: FILAS }, cargando: false, rol: 'closers',
    basis: 'meet', setBasis: () => {}, alcance: 'Todo el equipo', onAbrirFila: () => {},
    filtroInicial: null, onOlvidarFiltro: () => {}, puedeElegirEquipo: true, ...extra,
});

/**
 * Revisar con un host que hace lo que hace `DashboardComercial`: el filtro del drill-down vive en
 * la URL y `onOlvidarFiltro` lo borra de ahí, así que `filtroInicial` pasa a null.
 */
const ConUrl = ({ inicial, onOlvidar }) => {
    const [filtro, setFiltro] = useState(inicial);
    return (
        <Revisar {...props()} filtroInicial={filtro}
            onOlvidarFiltro={() => { onOlvidar(); setFiltro(null); }} />
    );
};

const DE_CIERRE = { post_call: 'Venta', __de: 'Cierre por presentación', __t: 1 };
const TIP_CIERRE = 'Filtro de Cierre por presentación: Viene del número que tocaste.';

const registros = () => screen.queryAllByRole('button', { name: /^Abrir / });
const tipDeOrigen = () => screen.queryByRole('note', { name: /^Filtro de / });

/**
 * Tilda (o destilda) una opción de una faceta en el panel Filtro completo, que tiene que estar
 * abierto. El título de la columna lleva la cuenta de lo tildado ("Post call · 1"): de ahí el `^`.
 */
const tildar = (faceta, valor) => {
    const col = within(screen.getByRole('dialog', { name: 'Filtro completo' }))
        .getByText(new RegExp(`^${faceta}`)).closest('.config-col');
    fireEvent.click(within(col).getByRole('checkbox', { name: new RegExp(valor) }));
};

describe('Revisar · la fila de etiquetas del filtro', () => {
    beforeEach(() => { window.localStorage.clear(); });

    it('al llegar de un número no hay aviso grande: la procedencia va en el "i" de la fila', () => {
        render(<ConUrl inicial={DE_CIERRE} onOlvidar={() => {}} />);

        expect(screen.queryByText(/Viniste de/)).toBeNull();
        expect(screen.queryByRole('button', { name: /Quitar el filtro/ })).toBeNull();
        expect(screen.queryByText(/registros del período/)).toBeNull();

        expect(screen.getByText('Cumple todas:')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Quitar Post call: Venta' })).toHaveTextContent('Venta');
        expect(registros()).toHaveLength(2);

        const tip = screen.getByRole('note', { name: TIP_CIERRE });
        fireEvent.mouseEnter(tip);
        expect(screen.getByText('Viene del número que tocaste.')).toBeInTheDocument();
        expect(screen.getByText('Filtro de Cierre por presentación')).toBeInTheDocument();
    });

    it('sin un número de origen la fila no lleva "i"', () => {
        render(<Revisar {...props()} />);

        fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        tildar('Post call', 'Venta');

        expect(screen.getByRole('button', { name: 'Quitar Post call: Venta' })).toBeInTheDocument();
        expect(tipDeOrigen()).toBeNull();
    });

    it('quitar la última etiqueta olvida el origen, también en la URL, sin tocar la búsqueda', () => {
        const olvidar = vi.fn();
        render(<ConUrl inicial={DE_CIERRE} onOlvidar={olvidar} />);
        fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 'Cliente' } });

        fireEvent.click(screen.getByRole('button', { name: 'Quitar Post call: Venta' }));

        expect(olvidar).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Cumple todas:')).toBeNull();
        expect(registros()).toHaveLength(4);
        // La URL vacía que llega después la pidió la propia lista: no es un cambio de pestaña y
        // no se lleva lo que puso el usuario.
        expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('Cliente');

        // Una etiqueta nueva ya no viene de ningún número.
        fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        tildar('Post call', 'Seguimiento');
        expect(screen.getByRole('button', { name: 'Quitar Post call: Seguimiento' })).toBeInTheDocument();
        expect(tipDeOrigen()).toBeNull();
    });

    it('destildar la última en el panel es lo mismo que quitarla con su X', () => {
        const olvidar = vi.fn();
        render(<ConUrl inicial={DE_CIERRE} onOlvidar={olvidar} />);

        fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        tildar('Post call', 'Venta');

        expect(olvidar).toHaveBeenCalledTimes(1);
        // El panel sigue abierto: el usuario está eligiendo otra condición.
        expect(screen.getByRole('dialog', { name: 'Filtro completo' })).toBeInTheDocument();
        tildar('Post call', 'Seguimiento');
        expect(tipDeOrigen()).toBeNull();
    });

    it('quitar una etiqueta que no es la última conserva el origen', () => {
        const olvidar = vi.fn();
        render(<ConUrl inicial={{ ...DE_CIERRE, post_call: ['Venta', 'Seguimiento'] }} onOlvidar={olvidar} />);
        expect(registros()).toHaveLength(3);

        fireEvent.click(screen.getByRole('button', { name: 'Quitar Post call: Seguimiento' }));

        expect(olvidar).not.toHaveBeenCalled();
        expect(registros()).toHaveLength(2);
        expect(screen.getByRole('note', { name: TIP_CIERRE })).toBeInTheDocument();
    });

    it('Limpiar saca las etiquetas y el origen', () => {
        const olvidar = vi.fn();
        render(<ConUrl inicial={DE_CIERRE} onOlvidar={olvidar} />);

        fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

        expect(olvidar).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Cumple todas:')).toBeNull();
        expect(tipDeOrigen()).toBeNull();
        expect(registros()).toHaveLength(4);
    });

    it('un número sin condiciones lleva al período entero, sin fila ni texto', () => {
        render(<ConUrl inicial={{ __de: 'Agendas', __t: 1 }} onOlvidar={() => {}} />);

        expect(screen.queryByText('Cumple todas:')).toBeNull();
        expect(screen.queryByText(/Sin condiciones/)).toBeNull();
        expect(tipDeOrigen()).toBeNull();
        expect(registros()).toHaveLength(4);
    });

    it('las etiquetas de sí/no llevan el nombre de su faceta', () => {
        render(<ConUrl inicial={{ asistio: 'Sí', __de: 'Show up', __t: 1 }} onOlvidar={() => {}} />);

        expect(screen.getByRole('button', { name: 'Quitar Asistió: Sí' })).toHaveTextContent('Asistió: Sí');
        expect(registros()).toHaveLength(3);
    });
});
