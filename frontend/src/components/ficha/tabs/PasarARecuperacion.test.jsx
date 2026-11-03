import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import PasarARecuperacion from './PasarARecuperacion';

const hace = (horas) => new Date(Date.now() + horas * 3600e3).toISOString().replace('Z', '');

// Desde el 23/10/2026 el flujo es breve: primero el motivo, después el día y la nota. El botón que lo abre y el
// que lo envía se llaman igual; el segundo vive dentro del grupo.
const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Pasar a seguimiento' }));
// El selector de día no acepta fechas pasadas: se elige el atajo «En 3 días», sea cual sea hoy.
const enTresDias = () => {
  const d = new Date(Date.now() + 3 * 86400e3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const enviar = () => fireEvent.click(within(screen.getByRole('group', { name: 'Pasar a seguimiento' }))
  .getByRole('button', { name: 'Pasar a seguimiento' }));

describe('PasarARecuperacion', () => {
  it('no aparece si la llamada todavía no ocurrió', () => {
    render(<PasarARecuperacion llamadaIso={hace(24)} onAccion={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /pasar a seguimiento/i })).toBeNull();
  });

  it('pasa la llamada con el día y la nota', async () => {
    const onAccion = vi.fn().mockResolvedValue({});
    render(<PasarARecuperacion llamadaIso={hace(-48)} onAccion={onAccion} />);

    abrir();
    // Sin motivo no hay a dónde seguir: el día y el envío aparecen después de elegirlo.
    expect(screen.queryByLabelText('Nota')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'La llamada corresponde a otro closer' }));
    const dia = enTresDias();
    // El día se elige en el calendario (un popover, no un input): se abre y se toca el atajo «En 3 días».
    fireEvent.click(screen.getByRole('button', { name: 'Día del seguimiento' }));
    fireEvent.click(screen.getByRole('option', { name: /En 3 días/ }));
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: ' Era de Gabriel ' } });
    enviar();

    await waitFor(() => expect(onAccion).toHaveBeenCalledWith(
      'pasar_a_recuperacion', { motivo: 'otro_closer', fecha: dia, nota: 'Era de Gabriel' }));
  });

  it('«Otro motivo» no se envía sin contar cuál', () => {
    render(<PasarARecuperacion llamadaIso={hace(-48)} onAccion={vi.fn()} />);

    abrir();
    fireEvent.click(screen.getByRole('radio', { name: 'Otro motivo' }));
    expect(within(screen.getByRole('group', { name: 'Pasar a seguimiento' }))
      .getByRole('button', { name: 'Pasar a seguimiento' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: 'Se cayó la luz' } });
    expect(within(screen.getByRole('group', { name: 'Pasar a seguimiento' }))
      .getByRole('button', { name: 'Pasar a seguimiento' })).toBeEnabled();
  });

  it('dice por qué falló', async () => {
    const onAccion = vi.fn().mockRejectedValue({ response: { data: { message: 'Esta llamada ya tiene resultado' } } });
    render(<PasarARecuperacion llamadaIso={hace(-48)} onAccion={onAccion} />);

    abrir();
    fireEvent.click(screen.getByRole('radio', { name: 'No pude tomar la llamada' }));
    enviar();

    expect(await screen.findByText(/ya tiene resultado/)).toBeTruthy();
  });
});
