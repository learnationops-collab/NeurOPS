import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TabComunicacion from './TabComunicacion';

// `created_at` viaja en UTC y sin Z, con microsegundos, como lo manda `isoformat()`. La expectativa
// se arma con la misma cuenta en la zona del proceso, para que el test no dependa del huso.
const CREADA_UTC = '2026-10-09T21:19:05.691000';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const enLocal = (iso) => {
    const d = new Date(`${iso}Z`);
    const hora = [d.getHours(), d.getMinutes()].map(n => String(n).padStart(2, '0')).join(':');
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${hora}`;
};

const ficha = (notas) => ({ comunicacion: { notas, equipo: [] }, permisos: { comentar: true } });

describe('la fecha de las notas de Comunicación', () => {
    it('se muestra en el reloj de quien mira, no como el ISO crudo en UTC', () => {
        render(<TabComunicacion onAccion={vi.fn()} ficha={ficha([
            { id: 'appointment-1', autor: 'Jean Carlo', rol: 'Closer', fecha: CREADA_UTC, texto: 'Lo llamo el lunes' },
        ])} />);

        expect(screen.getByText(`Closer · ${enLocal(CREADA_UTC)}`)).toBeInTheDocument();
        expect(screen.queryByText(/2026-10-09T/)).not.toBeInTheDocument();
    });

    it('una nota sin fecha muestra solo el rol', () => {
        render(<TabComunicacion onAccion={vi.fn()} ficha={ficha([
            { id: 'cc-2', autor: 'lucia', rol: 'Dirección', fecha: null, texto: 'Revisar el pago' },
        ])} />);

        expect(screen.getByText('Dirección')).toBeInTheDocument();
    });
});
