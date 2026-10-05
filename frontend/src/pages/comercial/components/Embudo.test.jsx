import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Embudo from './Embudo';

const PASOS = [
    { paso: 'Agendas', n: 100 },
    { paso: 'Confirmadas', n: 80 },
    { paso: 'Ventas', n: 10 },
];

describe('Embudo · el pie', () => {
    it('por defecto cierra con el porcentaje final del primer al último paso', () => {
        render(<Embudo pasos={PASOS} />);
        expect(screen.getByText('10.0% final')).toBeInTheDocument();
    });

    it('con `sinFinal` deja el conteo y quita la tasa de ventas sobre agendas', () => {
        render(<Embudo pasos={PASOS} sinFinal />);
        expect(screen.getByText('de 100 agendas a 10 ventas')).toBeInTheDocument();
        expect(screen.queryByText(/% final/)).toBeNull();
    });
});
