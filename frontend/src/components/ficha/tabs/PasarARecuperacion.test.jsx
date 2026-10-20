import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PasarARecuperacion from './PasarARecuperacion';

const hace = (horas) => new Date(Date.now() + horas * 3600e3).toISOString().replace('Z', '');

describe('PasarARecuperacion', () => {
  it('no aparece si la llamada todavía no ocurrió', () => {
    render(<PasarARecuperacion llamadaIso={hace(24)} onAccion={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /seguimiento de recuperación/i })).toBeNull();
  });

  it('pasa la llamada con el día y la nota', async () => {
    const onAccion = vi.fn().mockResolvedValue({});
    render(<PasarARecuperacion llamadaIso={hace(-48)} onAccion={onAccion} />);

    fireEvent.click(screen.getByRole('button', { name: /pasar a seguimiento de recuperación/i }));
    fireEvent.change(screen.getByLabelText('Día del contacto'), { target: { value: '2026-10-21' } });
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: ' Era de Gabriel ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pasar a recuperación' }));

    await waitFor(() => expect(onAccion).toHaveBeenCalledWith(
      'pasar_a_recuperacion', { fecha: '2026-10-21', nota: 'Era de Gabriel' }));
  });

  it('dice por qué falló', async () => {
    const onAccion = vi.fn().mockRejectedValue({ response: { data: { message: 'Esta llamada ya tiene resultado' } } });
    render(<PasarARecuperacion llamadaIso={hace(-48)} onAccion={onAccion} />);

    fireEvent.click(screen.getByRole('button', { name: /pasar a seguimiento de recuperación/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Pasar a recuperación' }));

    expect(await screen.findByText(/ya tiene resultado/)).toBeTruthy();
  });
});
