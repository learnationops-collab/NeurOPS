import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Las piezas compartidas se reemplazan por sus dobles, como en `TabResultado.test.jsx`.
vi.mock('../acciones/piezas', () => import('../acciones/piezasStub.jsx'));

import TabAcciones from './TabAcciones';
import { fichaConDeuda } from '../resultado.fixtures';

/**
 * La pestaña Acciones de un cliente dado de baja: no debe, pero no está «al día», y en lugar de
 * «Dar de baja» ofrece deshacerla.
 */

const BAJA = { fecha: '2026-09-12T10:00:00', fecha_legible: '12 sep 2026', motivo: 'No puede pagar', por: 'lucia' };

const fichaDeBaja = {
  ...fichaConDeuda,
  identidad: { ...fichaConDeuda.identidad, baja: BAJA },
  cobro: { ...fichaConDeuda.cobro, deuda: 0, proxima_cuota: null,
    etapa: { clave: 'baja', titulo: 'Dado de baja el 12 sep 2026', tono: 'idle' } },
};

const props = (ficha) => ({
  ficha,
  onAccion: vi.fn().mockResolvedValue({ deuda: 1500 }),
  onRecargar: vi.fn(),
  irA: vi.fn(),
  puedeEditar: true,
});

describe('TabAcciones · cliente dado de baja', () => {
  it('la deuda dice que se dio de baja, cuándo y por qué, y no «Al día»', () => {
    render(<TabAcciones {...props(fichaDeBaja)} />);

    expect(screen.getByText('Dado de baja')).toBeInTheDocument();
    expect(screen.getByText(/El 12 sep 2026 · No puede pagar\. Ya no se le cobra/)).toBeInTheDocument();
    expect(screen.queryByText('Al día')).toBeNull();
  });

  it('ofrece revertir la baja en lugar de darla otra vez', () => {
    render(<TabAcciones {...props(fichaDeBaja)} />);

    expect(screen.getByRole('button', { name: 'Revertir baja' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dar de baja' })).toBeNull();
    // El resto de las acciones sigue: un dado de baja puede pagar lo que debía.
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
  });

  it('revertir explica qué pasa antes de hacerlo y manda la acción sin cuerpo', async () => {
    const user = userEvent.setup();
    const p = props(fichaDeBaja);
    render(<TabAcciones {...p} />);

    await user.click(screen.getByRole('button', { name: 'Revertir baja' }));
    expect(screen.getByRole('heading', { name: 'Revertir baja' })).toBeInTheDocument();
    expect(screen.getByText('Se dio de baja el 12 sep 2026 · No puede pagar · por lucia.')).toBeInTheDocument();
    expect(screen.getByText(/vuelve a deber lo que debía/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revertir baja' }));
    expect(p.onAccion).toHaveBeenCalledWith('revertir_baja', {});
  });

  it('sin baja sigue la acción de siempre y no hay nada que revertir', () => {
    render(<TabAcciones {...props(fichaConDeuda)} />);

    expect(screen.getByRole('button', { name: 'Dar de baja' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revertir baja' })).toBeNull();
  });
});
