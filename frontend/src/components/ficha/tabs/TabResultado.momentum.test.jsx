import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../acciones/piezas', () => import('../acciones/piezasStub.jsx'));

import TabResultado from './TabResultado';
import { fichaAgendaVencida, fichaEnSeguimiento } from '../resultado.fixtures';

const conMomentum = (ficha, tipo) => ({
  ...ficha,
  identidad: { ...ficha.identidad, fuente: 'Momentum' },
  resultado: { ...ficha.resultado, momentum: { tipo, sesion: 'Momentum Session', reporte: null } },
});

const props = (ficha) => ({ ficha, onAccion: vi.fn().mockResolvedValue({}), irA: vi.fn(), puedeEditar: true });

describe('TabResultado de una Momentum', () => {
  it('pregunta asistencia, continúa y motivo, y manda el bloque momentum', async () => {
    const user = userEvent.setup();
    const p = props(conMomentum(fichaAgendaVencida, 'cierre'));
    render(<TabResultado {...p} />);
    expect(screen.queryByRole('heading', { name: '¿Qué pasó con esta llamada?' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Asistió/ }));
    await user.click(screen.getByRole('button', { name: 'No por ahora' }));
    const guardar = screen.getByRole('button', { name: 'Guardar reporte' });
    expect(guardar).toBeDisabled();
    expect(screen.getByText('Escribí el motivo')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Motivo'), 'Sin presupuesto');
    await user.click(guardar);
    expect(p.onAccion).toHaveBeenCalledWith('reportar_resultado', expect.objectContaining({
      momentum: { asistencia: 'asistio', resultado: 'no_sigue', inicio: null, motivo: 'Sin presupuesto' },
    }));
    expect(await screen.findByText('Reporte de la Momentum guardado')).toBeInTheDocument();
  });

  it('«Reporte completo» vuelve al árbol de siempre', async () => {
    const user = userEvent.setup();
    render(<TabResultado {...props(conMomentum(fichaAgendaVencida, 'sena'))} />);
    expect(screen.getByRole('button', { name: /^Asistió/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reporte completo/ }));
    expect(screen.getByRole('heading', { name: '¿Qué pasó con esta llamada?' })).toBeInTheDocument();
  });

  it('una Momentum que ya está en seguimiento sigue con el árbol de siempre', () => {
    render(<TabResultado {...props(conMomentum(fichaEnSeguimiento, 'sena'))} />);
    expect(screen.queryByRole('button', { name: 'Guardar reporte' })).toBeNull();
  });
});
