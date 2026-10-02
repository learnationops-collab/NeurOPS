import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Pedido del 02/10/2026: el closer pega el link de Fathom (grabación y transcripción) en el
// resultado de la agenda. Se guarda solo, sin pasar por el árbol de reporte.
vi.mock('../acciones/piezas', () => import('../acciones/piezasStub.jsx'));
vi.mock('../../../services/api', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../../services/api';
import GrabacionFathom from './GrabacionFathom';
import TabResultado from './TabResultado';
import FichaLeadModal from '../FichaLeadModal';
import { ejecutarAccion } from '../fichaApi';
import { esDeFathom } from '../fathom';
import { fichaAgendaVencida } from '../resultado.fixtures';
import { fichaPrecall } from '../__fixtures__/ficha';

const LINK = 'https://fathom.video/share/AbC123xyz';
const conLink = (ficha, link) => ({ ...ficha, identidad: { ...ficha.identidad, fathom_url: link } });
const campo = () => screen.getByLabelText('Link de Fathom');

beforeEach(() => { vi.clearAllMocks(); });

describe('el campo del link en Resultado', () => {
  it('está en la pestaña, debajo del stepper, junto a las cuatro tarjetas', () => {
    render(<TabResultado ficha={fichaAgendaVencida} onAccion={vi.fn()} irA={vi.fn()} />);
    expect(campo()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Asistió' })).toBeInTheDocument();
  });

  it('guarda solo el link, sin reportar la llamada', async () => {
    const usuario = userEvent.setup();
    const onAccion = vi.fn().mockResolvedValue({ fathom_url: LINK, es_fathom: true });
    render(<TabResultado ficha={fichaAgendaVencida} onAccion={onAccion} irA={vi.fn()} />);

    await usuario.type(campo(), `  ${LINK} `);
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onAccion).toHaveBeenCalledTimes(1);
    expect(onAccion).toHaveBeenCalledWith('guardar_fathom', { fathom_url: LINK });
    // El árbol sigue donde estaba: las cuatro tarjetas de la llamada.
    expect(screen.getByRole('heading', { name: '¿Qué pasó con esta llamada?' })).toBeInTheDocument();
  });

  it('Enter también guarda', async () => {
    const usuario = userEvent.setup();
    const onAccion = vi.fn().mockResolvedValue({});
    render(<GrabacionFathom ficha={fichaAgendaVencida} onAccion={onAccion} />);
    await usuario.type(campo(), `${LINK}{Enter}`);
    expect(onAccion).toHaveBeenCalledWith('guardar_fathom', { fathom_url: LINK });
  });

  it('trae el link guardado y no deja guardar si no cambió', () => {
    render(<GrabacionFathom ficha={conLink(fichaAgendaVencida, LINK)} onAccion={vi.fn()} />);
    expect(campo()).toHaveValue(LINK);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('vaciarlo y guardar lo quita', async () => {
    const usuario = userEvent.setup();
    const onAccion = vi.fn().mockResolvedValue({ fathom_url: null });
    render(<GrabacionFathom ficha={conLink(fichaAgendaVencida, LINK)} onAccion={onAccion} />);

    await usuario.clear(campo());
    await usuario.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(onAccion).toHaveBeenCalledWith('guardar_fathom', { fathom_url: '' });
  });

  it('un link que no es de Fathom avisa pero se puede guardar', async () => {
    const usuario = userEvent.setup();
    render(<GrabacionFathom ficha={fichaAgendaVencida} onAccion={vi.fn().mockResolvedValue({})} />);

    await usuario.type(campo(), 'https://drive.google.com/file/d/1');

    expect(screen.getByText(/No parece un link de Fathom/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('el rechazo del backend queda al lado del campo y lo escrito no se pierde', async () => {
    const usuario = userEvent.setup();
    const onAccion = vi.fn().mockRejectedValue({ response: { status: 400, data: {
      message: 'Eso no parece un link: pegá la dirección completa', campo: 'fathom_url',
    } } });
    render(<GrabacionFathom ficha={fichaAgendaVencida} onAccion={onAccion} />);

    await usuario.type(campo(), 'grabacion de ayer{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('no parece un link');
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
    expect(campo()).toHaveValue('grabacion de ayer');
    // Escribir de nuevo borra el motivo viejo.
    await usuario.type(campo(), 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Escape descarta lo escrito sin cerrar nada más', async () => {
    const usuario = userEvent.setup();
    const afuera = vi.fn();
    document.addEventListener('keydown', afuera);
    render(<GrabacionFathom ficha={conLink(fichaAgendaVencida, LINK)} onAccion={vi.fn()} />);

    await usuario.type(campo(), 'zzz{Escape}');

    expect(campo()).toHaveValue(LINK);
    expect(afuera).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }));
    document.removeEventListener('keydown', afuera);
  });

  it('quien no puede reportar no ve el campo', () => {
    render(<TabResultado ficha={{ ...fichaAgendaVencida, permisos: { reportar: false } }}
      onAccion={vi.fn()} irA={vi.fn()} />);
    expect(screen.queryByLabelText('Link de Fathom')).not.toBeInTheDocument();
  });
});

describe('la ruta y el cascarón', () => {
  it('guardar_fathom es un PATCH a la ruta del link de esa agenda', async () => {
    api.patch.mockResolvedValue({ data: { fathom_url: LINK } });
    await ejecutarAccion('guardar_fathom', 9012, { fathom_url: LINK });
    expect(api.patch).toHaveBeenCalledWith('/ficha/9012/fathom', { fathom_url: LINK });
  });

  it('desde la ficha: guarda, recarga y lo dice', async () => {
    const usuario = userEvent.setup();
    api.get.mockResolvedValue({ data: fichaPrecall });
    api.patch.mockResolvedValue({ data: { id: 9012, fathom_url: LINK, es_fathom: true, cambio: true } });
    render(<FichaLeadModal appointmentId={9012} onCerrar={vi.fn()} pestanaInicial="resultado" />);

    const input = await screen.findByLabelText('Link de Fathom', {}, { timeout: 5000 });
    await usuario.type(input, LINK);
    await usuario.click(within(input.closest('form')).getByRole('button', { name: 'Guardar' }));

    expect(api.patch).toHaveBeenCalledWith('/ficha/9012/fathom', { fathom_url: LINK });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Link de Fathom guardado/)).toBeInTheDocument();
  });
});

describe('esDeFathom', () => {
  it.each([
    [LINK, true],
    ['fathom.video/share/x', true],
    ['https://app.fathom.video/calls/1', true],
    ['https://notfathom.video/x', false],
    ['https://fathom.video.evil.com/x', false],
    ['https://drive.google.com/x', false],
    ['', false],
    ['no es un link', false],
  ])('%s → %s', (texto, esperado) => {
    expect(esDeFathom(texto)).toBe(esperado);
  });
});
