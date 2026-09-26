import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// El cliente HTTP se mockea completo: ninguna pestaña llama a axios por su cuenta,
// así que interceptar acá alcanza para fijar TODO el contrato de escritura.
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
    },
}));

import api from '../../services/api';
import FichaLeadModal from './FichaLeadModal';
import { fichaAlDia, fichaConDeuda, fichaPrecall } from './__fixtures__/ficha';

const responder = (ficha) => {
    api.get.mockResolvedValue({ data: ficha });
    ['patch', 'post', 'put', 'delete'].forEach(m => api[m].mockResolvedValue({ data: { ok: true } }));
};

const abrir = async (ficha, props = {}) => {
    responder(ficha);
    const vista = render(<FichaLeadModal appointmentId={9012} onCerrar={vi.fn()} {...props} />);
    // Se espera a que HAYA una pestaña activa: el tablist aparece recién con la ficha,
    // y esperar solo el tablist dejaba pasar la primera pintura, todavía sin datos.
    await waitFor(() => expect(screen.getByRole('tab', { selected: true })).toBeInTheDocument());
    return vista;
};

const activa = () => screen.getByRole('tab', { selected: true }).textContent;

beforeEach(() => { vi.clearAllMocks(); });

describe('lectura', () => {
    it('pide la ficha con el id de la agenda', async () => {
        await abrir(fichaPrecall);
        expect(api.get).toHaveBeenCalledWith('/ficha/lead', expect.objectContaining({
            params: { appointment_id: 9012 },
        }));
    });

    it('abre en la pestaña que dice el payload, no en una fija', async () => {
        await abrir(fichaPrecall);
        expect(activa()).toBe('Confirmación');
    });

    it('abre en Historial cuando el payload lo pide', async () => {
        await abrir(fichaAlDia);
        expect(activa()).toBe('Historial');
    });

    it('muestra solo las pestañas que declara el estado', async () => {
        await abrir(fichaPrecall);
        expect(screen.getAllByRole('tab').map(t => t.textContent))
            .toEqual(['Confirmación', 'Resultado', 'Historial', 'Formulario', 'Comunicación']);
    });

    it('sobrevive a que la pestaña del otro agente no exista todavía', async () => {
        // `fichaConDeuda` abre en Acciones, que la escribe otro agente en su worktree.
        // La ficha tiene que seguir funcionando con las pestañas que sí están.
        await abrir(fichaConDeuda);
        expect(activa()).toBe('Acciones');
        expect(await screen.findByText(/todavía no está disponible/)).toBeInTheDocument();
        // Y las propias siguen andando.
        await userEvent.click(screen.getByRole('tab', { name: 'Historial' }));
        expect(screen.getByText('Pagos')).toBeInTheDocument();
    });

    it('pinta la cabecera como una franja de datos', async () => {
        await abrir(fichaPrecall);
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Kevin Encalada');
        expect(screen.getByText('+593 99 515 7254')).toBeInTheDocument();
        expect(screen.getByText('MIR / ENARM')).toBeInTheDocument();
    });
});

describe('onAccion pega en el endpoint correcto', () => {
    it('la etapa de confirmación parchea el bloque de confirmación y recarga', async () => {
        const usuario = userEvent.setup();
        await abrir(fichaPrecall);
        await usuario.click(screen.getByRole('button', { name: /VideoAsk/ }));

        expect(api.patch).toHaveBeenCalledWith('/ficha/9012/confirmacion', { etapa: 'videoask' });
        // Después de escribir se vuelve a pedir la ficha y queda el aviso descartable.
        await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
        expect(await screen.findByText('Etapa guardada.')).toBeInTheDocument();
    });

    it('reasignar closer va a la ruta del closer con el id elegido', async () => {
        const usuario = userEvent.setup();
        await abrir(fichaPrecall);
        await usuario.click(screen.getByRole('button', { expanded: false, name: /Jean Carlo/ }));
        await usuario.click(screen.getByRole('option', { name: /Valentina/ }));

        expect(api.patch).toHaveBeenCalledWith('/ficha/9012/closer',
            { closer_id: 8, closer: 'Valentina' });
    });

    it('enviar una nota postea en la ruta de notas y limpia el campo', async () => {
        const usuario = userEvent.setup();
        await abrir(fichaPrecall);
        await usuario.click(screen.getByRole('tab', { name: 'Comunicación' }));
        const campo = screen.getByLabelText('Escribí una nota');
        await usuario.type(campo, 'Atiende después de las 20{Enter}');

        expect(api.post).toHaveBeenCalledWith('/ficha/9012/nota',
            { texto: 'Atiende después de las 20', notificar: [] });
        await waitFor(() => expect(campo).toHaveValue(''));
    });

    it('cerrar la confirmación solo se habilita en la última etapa', async () => {
        const usuario = userEvent.setup();
        await abrir({
            ...fichaPrecall,
            confirmacion: { ...fichaPrecall.confirmacion, etapa: 'testimonio' },
        });
        const cta = screen.getByRole('button', { name: /100% confirmado/ });
        expect(cta).not.toBeDisabled();
        await usuario.click(cta);
        expect(api.patch).toHaveBeenCalledWith('/ficha/9012/confirmacion', { cerrada: true });
    });

    it('en una etapa intermedia el CTA está deshabilitado y se avisa qué falta', async () => {
        await abrir(fichaPrecall);
        expect(screen.getByRole('button', { name: /100% confirmado/ })).toBeDisabled();
        expect(screen.getByText('Falta marcar hasta Testimonio')).toBeInTheDocument();
    });

    it('un error del backend queda a la vista y no borra la ficha', async () => {
        const usuario = userEvent.setup();
        await abrir(fichaPrecall);
        api.patch.mockRejectedValueOnce({ response: { data: { message: 'La agenda ya se reportó' } } });
        await usuario.click(screen.getByRole('button', { name: /Contactado/ }));

        expect(await screen.findByText('La agenda ya se reportó')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Kevin Encalada');
    });
});

describe('cerrar', () => {
    it('cierra con Escape y con clic en el velo', async () => {
        const usuario = userEvent.setup();
        const onCerrar = vi.fn();
        const { container } = await abrir(fichaPrecall, { onCerrar });

        await usuario.keyboard('{Escape}');
        expect(onCerrar).toHaveBeenCalledTimes(1);

        await usuario.click(container.querySelector('.scrim'));
        expect(onCerrar).toHaveBeenCalledTimes(2);
    });

    it('eliminar cierra la ficha en vez de recargar un lead que ya no existe', async () => {
        const usuario = userEvent.setup();
        const onCerrar = vi.fn();
        await abrir(fichaPrecall, { onCerrar });
        await usuario.click(screen.getByRole('button', { name: /Eliminar lead/ }));
        await usuario.click(screen.getByRole('button', { name: /Eliminar lead/ }));
        await usuario.click(screen.getByRole('button', { name: /Sí, eliminar/ }));
        // El borrado se difiere durante la ventana de deshacer: recién al vencer se llama.
        await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/ficha/9012'), { timeout: 8000 });
        await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    }, 15000);   // la ventana de deshacer del InlineConfirm dura 5 s de reloj real
});
