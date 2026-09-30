import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SiNo from './SiNo';

/**
 * El sí/no lo montan «Dar de baja» y «Canceló». Las pruebas de Acciones lo reemplazan por el
 * doble de `piezasStub`, así que el real se prueba acá: que se lea como un grupo con nombre, que
 * diga cuál está elegido con `aria-pressed` y que el elegido tenga la marca de `.fi-seg`.
 */
const ConEstado = ({ inicial = true, onElegir = () => {} }) => {
    const [valor, setValor] = useState(inicial);
    return (
        <SiNo valor={valor} etiqueta="¿Agendás un seguimiento a futuro?"
            onElegir={(v) => { setValor(v); onElegir(v); }} />
    );
};

describe('SiNo', () => {
    it('es un grupo con nombre y marca el elegido', () => {
        render(<ConEstado inicial />);
        const grupo = screen.getByRole('group', { name: '¿Agendás un seguimiento a futuro?' });
        expect(grupo).toHaveClass('fi-seg');
        expect(screen.getByRole('button', { name: 'Sí' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'Sí' }).querySelector('.fi-seg-marca')).not.toBeNull();
    });

    it('tocar la otra opción avisa el valor y la marca se muda', async () => {
        const user = userEvent.setup();
        const onElegir = vi.fn();
        render(<ConEstado inicial onElegir={onElegir} />);
        await user.click(screen.getByRole('button', { name: 'No' }));
        expect(onElegir).toHaveBeenCalledWith(false);
        expect(screen.getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Sí' }).querySelector('.fi-seg-marca')).toBeNull();
    });
});
