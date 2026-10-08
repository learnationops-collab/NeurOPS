import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Revisar from './Revisar';

/**
 * Una selección de filas puntuales que llega de otra sección (08/10/2026): Payroll abre Revisar con
 * las ventas de la comisión de una persona (`__ids`), que no se pueden escribir con las facetas.
 * Se ve como UNA etiqueta y se quita como cualquier otra.
 */

const agenda = (id) => ({
    tipo: 'agenda', id, client_id: id, cliente: `Cliente ${id}`, ig: '', fecha: '2026-09-10T10:00:00',
    fuente: 'Instagram', closer: 'Nerina', realizada: true, retraso_dias: 0, asistio: true, presento: true,
    pre_call: { key: 'confirmada', label: 'Confirmada', tone: 'success' },
    post_call: { key: 'venta', label: 'Venta', tone: 'info' },
});

const ConUrl = ({ inicial, onOlvidar }) => {
    const [filtro, setFiltro] = useState(inicial);
    return (
        <Revisar tabla="agendas" setTabla={() => {}} datos={{ filas: [1, 2, 3, 4].map(agenda) }} cargando={false}
            rol="closers" basis="meet" setBasis={() => {}} alcance="Todo el equipo" onAbrirFila={() => {}}
            puedeElegirEquipo filtroInicial={filtro}
            onOlvidarFiltro={() => { onOlvidar(); setFiltro(null); }} />
    );
};

const registros = () => screen.queryAllByRole('button', { name: /^Abrir / });

describe('Revisar · selección que llega de otra sección', () => {
    it('muestra solo esas filas, con una sola etiqueta que la nombra', () => {
        render(<ConUrl onOlvidar={() => {}}
            inicial={{ __ids: [1, 3], __ids_rotulo: 'Comisión de Andy', __de: 'Comisión de Andy', __t: 1 }} />);

        expect(registros()).toHaveLength(2);
        expect(screen.getByRole('button', { name: 'Quitar Comisión de Andy' })).toHaveTextContent('Comisión de Andy');
    });

    it('quitar la etiqueta vuelve a la lista entera y suelta el filtro de la URL', () => {
        const onOlvidar = vi.fn();
        render(<ConUrl onOlvidar={onOlvidar} inicial={{ __ids: [2], __ids_rotulo: 'Comisión de Paula', __t: 1 }} />);
        expect(registros()).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'Quitar Comisión de Paula' }));

        expect(registros()).toHaveLength(4);
        expect(onOlvidar).toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: /Quitar Comisión/ })).toBeNull();
    });
});
