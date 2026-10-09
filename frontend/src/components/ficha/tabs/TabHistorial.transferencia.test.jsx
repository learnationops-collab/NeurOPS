import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabHistorial from './TabHistorial';
import { fichaPrecall } from '../__fixtures__/ficha';
import { localToday } from '../../../utils/datetime';

// Pedido de Kerwin (09/10/2026): en la sección Pagos, cada pago por transferencia dice a quién del
// equipo se le hizo (Pedro, Jean Carlo u Otro) o que está sin marcar, y se marca o se cambia; al
// agregar un pago por transferencia, la pregunta es obligatoria.

const SENA = {
    id: 901, fecha: '2026-09-09T00:00:00', medio: 'Transferencia Bancaria', monto: 150, tipo: 'seña',
    tipo_pago: 'RR - Seña', programa_code: 'RR', es_transferencia: true, transferido_a: null,
};
const MARCADA = { ...SENA, id: 902, monto: 200, transferido_a: 'jean_carlo' };
const STRIPE = {
    id: 903, fecha: '2026-09-15T00:00:00', medio: 'Stripe', monto: 300, tipo: 'cuota',
    tipo_pago: 'RR - Cuota', programa_code: 'RR', es_transferencia: false, transferido_a: null,
};

const VOCABULARIO = {
    ...fichaPrecall.vocabulario,
    medios_pago_venta: [
        { clave: 'Stripe', label: 'Stripe' }, { clave: 'Transferencia Bancaria', label: 'Transferencia bancaria' },
        { clave: 'Otro', label: 'Otro' },
    ],
    programas: [{ clave: 'RR', label: 'Residency Roadmap' }],
    tipos_pago_venta: [{ clave: 'cuota', label: 'Cuota' }, { clave: 'seña', label: 'Seña' }],
};

const conPagos = (pagos, extra = {}) => ({
    ...fichaPrecall,
    vocabulario: VOCABULARIO,
    cobro: { ...fichaPrecall.cobro, pagos, programa_code: 'RR', pagado: 0 },
    ...extra,
});

const abrir = async (usuario, f, onAccion = vi.fn().mockResolvedValue({})) => {
    render(<TabHistorial ficha={f} onAccion={onAccion} />);
    await usuario.click(screen.getByRole('button', { name: /^Pagos/ }));
    return onAccion;
};

const filaDe = (texto) => screen.getByText(texto).closest('.fi-pago');

describe('a quién se le hizo una transferencia, en la fila', () => {
    it('una marcada dice a quién, una sin marcar lo dice, y un pago por Stripe no dice nada', async () => {
        const usuario = userEvent.setup();
        await abrir(usuario, conPagos([SENA, MARCADA, STRIPE]));

        expect(within(filaDe('$200')).getByText('Transferido a Jean Carlo')).toBeInTheDocument();
        expect(within(filaDe('$150')).getByText('Sin marcar a quién')).toBeInTheDocument();
        expect(within(filaDe('$300')).queryByText(/Transferido a|Sin marcar/)).not.toBeInTheDocument();
    });

    it('una sin marcar se marca directo en la fila, con un pedido que lleva solo eso', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, conPagos([SENA]));

        const grupo = within(filaDe('$150')).getByRole('group', { name: /A quién se le hizo la transferencia de \$150/ });
        expect(within(grupo).getAllByRole('button').map(b => b.textContent)).toEqual(['Pedro', 'Jean Carlo', 'Otro']);
        await usuario.click(within(grupo).getByRole('button', { name: 'Jean Carlo' }));

        expect(onAccion).toHaveBeenCalledWith('corregir_pago', { pago_id: 901, transferido_a: 'jean_carlo' });
    });

    it('una ya marcada no ofrece marcarla en la fila: se cambia con el lápiz', async () => {
        const usuario = userEvent.setup();
        await abrir(usuario, conPagos([MARCADA]));

        expect(within(filaDe('$200')).queryByRole('group', { name: /A quién se le hizo/ })).not.toBeInTheDocument();
    });

    it('quien no puede cobrar ve a quién, pero no lo marca', async () => {
        const usuario = userEvent.setup();
        await abrir(usuario, conPagos([SENA], { permisos: { ...fichaPrecall.permisos, cobrar: false } }));

        expect(screen.getByText('Sin marcar a quién')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: /A quién se le hizo/ })).not.toBeInTheDocument();
    });

    it('si el backend rechaza la marca, la fila dice por qué', async () => {
        const usuario = userEvent.setup();
        const onAccion = vi.fn().mockRejectedValue(new Error('Ese pago no es de este lead.'));
        await abrir(usuario, conPagos([SENA]), onAccion);
        await usuario.click(within(filaDe('$150')).getByRole('button', { name: 'Pedro' }));

        expect(within(filaDe('$150')).getByRole('alert')).toHaveTextContent('Ese pago no es de este lead.');
    });
});

describe('a quién se le hizo una transferencia, en el editor del pago', () => {
    const editor = () => screen.getByRole('group', { name: /Corregir el pago/ });
    const pregunta = () => within(editor()).getByRole('group', { name: '¿A quién se le hizo la transferencia?' });

    it('se cambia a otra persona o se vuelve a «Sin marcar»', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, conPagos([MARCADA]));
        await usuario.click(screen.getByRole('button', { name: /Corregir el pago de \$200/ }));

        expect(within(pregunta()).getByRole('button', { name: 'Jean Carlo' })).toHaveAttribute('aria-pressed', 'true');
        await usuario.click(within(pregunta()).getByRole('button', { name: 'Sin marcar' }));
        await usuario.click(within(editor()).getByRole('button', { name: 'Guardar cambios' }));

        expect(onAccion).toHaveBeenCalledWith('corregir_pago', { pago_id: 902, transferido_a: null });
    });

    it('un pago que pasa a transferencia no se guarda sin decir a quién', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, conPagos([STRIPE]));
        await usuario.click(screen.getByRole('button', { name: /Corregir el pago de \$300/ }));
        expect(within(editor()).queryByRole('group', { name: '¿A quién se le hizo la transferencia?' }))
            .not.toBeInTheDocument();

        await usuario.selectOptions(within(editor()).getByLabelText('Medio de pago'), 'Transferencia Bancaria');
        const guardar = within(editor()).getByRole('button', { name: 'Guardar cambios' });
        expect(guardar).toBeDisabled();
        expect(guardar).toHaveAttribute('title', 'Elegí a quién se le hizo la transferencia');
        // En un pago que recién pasa a transferencia no hay «Sin marcar»: se pide.
        expect(within(pregunta()).queryByRole('button', { name: 'Sin marcar' })).not.toBeInTheDocument();

        await usuario.click(within(pregunta()).getByRole('button', { name: 'Pedro' }));
        expect(within(editor()).getByText('Se le descuenta en Payroll')).toBeInTheDocument();
        await usuario.click(guardar);

        expect(onAccion).toHaveBeenCalledWith('corregir_pago', {
            pago_id: 903, metodo_pago: 'Transferencia Bancaria', transferido_a: 'pedro',
        });
    });

    it('un pago que deja de ser transferencia no manda a quién: el backend limpia la marca', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, conPagos([MARCADA]));
        await usuario.click(screen.getByRole('button', { name: /Corregir el pago de \$200/ }));
        await usuario.selectOptions(within(editor()).getByLabelText('Medio de pago'), 'Stripe');
        await usuario.click(within(editor()).getByRole('button', { name: 'Guardar cambios' }));

        expect(onAccion).toHaveBeenCalledWith('corregir_pago', { pago_id: 902, metodo_pago: 'Stripe' });
    });
});

describe('agregar un pago por transferencia', () => {
    const formulario = () => screen.getByRole('group', { name: 'Agregar un pago' });

    it('pregunta a quién y no agrega hasta que se elige', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, conPagos([STRIPE]));
        await usuario.click(screen.getByRole('button', { name: 'Agregar pago' }));
        await usuario.type(within(formulario()).getByLabelText('Monto'), '150');
        await usuario.selectOptions(within(formulario()).getByLabelText('Medio de pago'), 'Transferencia Bancaria');

        const agregar = within(formulario()).getByRole('button', { name: 'Agregar pago' });
        expect(agregar).toBeDisabled();
        expect(agregar).toHaveAttribute('title', 'Elegí a quién se le hizo la transferencia');
        const grupo = within(formulario()).getByRole('group', { name: '¿A quién se le hizo la transferencia?' });
        await usuario.click(within(grupo).getByRole('button', { name: 'Otro' }));
        expect(within(formulario()).getByText('Solo se anota en Finanzas')).toBeInTheDocument();
        await usuario.click(within(grupo).getByRole('button', { name: 'Jean Carlo' }));
        await usuario.click(agregar);

        expect(onAccion).toHaveBeenCalledWith('agregar_pago', {
            fecha: localToday(), monto: 150, metodo_pago: 'Transferencia Bancaria', programa_code: 'RR',
            tipo: 'cuota', transferido_a: 'jean_carlo',
        });
    });

    it('arranca sin nadie elegido aunque el último pago fuera una transferencia marcada', async () => {
        const usuario = userEvent.setup();
        await abrir(usuario, conPagos([MARCADA]));
        await usuario.click(screen.getByRole('button', { name: 'Agregar pago' }));

        const grupo = within(formulario()).getByRole('group', { name: '¿A quién se le hizo la transferencia?' });
        expect(within(grupo).getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true')).toEqual([]);
    });

    it('si se vuelve a otro medio, a quién no viaja', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, conPagos([STRIPE]));
        await usuario.click(screen.getByRole('button', { name: 'Agregar pago' }));
        await usuario.type(within(formulario()).getByLabelText('Monto'), '150');
        const medio = within(formulario()).getByLabelText('Medio de pago');
        await usuario.selectOptions(medio, 'Transferencia Bancaria');
        await usuario.click(within(formulario()).getByRole('button', { name: 'Pedro' }));
        await usuario.selectOptions(medio, 'Stripe');
        await usuario.click(within(formulario()).getByRole('button', { name: 'Agregar pago' }));

        expect(onAccion).toHaveBeenCalledWith('agregar_pago', expect.not.objectContaining({ transferido_a: expect.anything() }));
    });
});
