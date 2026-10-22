import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuscripcionWork from './SuscripcionWork';

const SUB = {
  id: 1, product_slug: 'ace-learners', program_code: 'AL', expires_at: '2027-02-16', vigente: true, is_deposit: false,
  events: [
    { id: 1, kind: 'alta', from_date: null, to_date: '2026-10-08', reason: 'Seña: 7 días', source: 'work', actor: null,
      created_at: '2026-10-01T15:00:00' },
    { id: 2, kind: 'prorroga', from_date: '2027-02-01', to_date: '2027-02-16', reason: 'Prórroga: Viaje',
      source: 'academia', actor: 'gestor@academia.com', created_at: '2026-10-20T12:00:00' },
  ],
};

describe('la suscripción en Work', () => {
  it('sin suscripciones no dibuja nada', () => {
    const { container } = render(<SuscripcionWork suscripciones={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('resume el vencimiento y muestra cada cambio con quién y desde dónde', async () => {
    const usuario = userEvent.setup();
    render(<SuscripcionWork suscripciones={[SUB]} programas={[{ clave: 'AL', label: 'Ace Learners' }]} />);

    const boton = screen.getByRole('button', { name: /Suscripción en Work/ });
    expect(boton).toHaveTextContent('Vence el 16 feb 2027 · 2 cambios');
    await usuario.click(boton);

    expect(screen.getByText('Ace Learners')).toBeInTheDocument();
    expect(screen.getByText('Hasta el 16 feb 2027')).toBeInTheDocument();
    expect(screen.getByText('Prórroga')).toBeInTheDocument();
    expect(screen.getByText('1 feb 2027 → 16 feb 2027')).toBeInTheDocument();
    expect(screen.getByText('Academia · gestor@academia.com')).toBeInTheDocument();
    expect(screen.getByText('Automático')).toBeInTheDocument();
  });
});
