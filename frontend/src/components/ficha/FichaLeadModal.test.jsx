import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

// Resultado y Acciones se cargan con `React.lazy`. La primera vez que una aparece, suspende: se
// carga el módulo y React 18 no revela un Suspense hasta ~500 ms después de mostrar el fallback.
// Sumado al render de la venta, pasaba el segundo por defecto de `findByRole` apenas la máquina
// estaba cargada (la suite entera en paralelo). Esa primera aparición tiene su propio margen.
const PRIMERA_CARGA = { timeout: 5000 };

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

    it('el mazo puede pedir con qué pestaña abrir', async () => {
        // Quien abre desde una columna del mazo ya dijo a qué venía, y eso gana sobre
        // "donde el backend cree que hay trabajo".
        await abrir(fichaConDeuda, { pestanaInicial: 'hist' });
        expect(activa()).toBe('Historial');
    });

    it('«Declarar venta» abre Resultado derecho en la venta', async () => {
        // Era la página /closer/sales/new: el mazo abre la ficha del cliente elegido para vender.
        await abrir(fichaPrecall, { pestanaInicial: 'resultado', abrirEnVenta: true });
        expect(activa()).toBe('Resultado');
        expect(await screen.findByRole('heading', { name: '¿Quién compró?' }, PRIMERA_CARGA)).toBeInTheDocument();
    });

    it('la segunda ficha abierta en Resultado no vuelve a mostrar el esqueleto', async () => {
        // El lazy se crea una vez por módulo: si se creara por ficha, cada apertura suspendería
        // de nuevo y mostraría el esqueleto medio segundo aunque el código ya esté cargado.
        const primera = await abrir(fichaPrecall, { pestanaInicial: 'resultado', abrirEnVenta: true });
        await screen.findByRole('heading', { name: '¿Quién compró?' }, PRIMERA_CARGA);
        primera.unmount();

        await abrir(fichaPrecall, { pestanaInicial: 'resultado', abrirEnVenta: true });
        // Sin esperar: Resultado se pinta en el mismo render en que se elige la pestaña.
        expect(screen.getByRole('heading', { name: '¿Quién compró?' })).toBeInTheDocument();
    });

    it('un cobro abierto desde Seguimientos cae en Resultado, reportando el cobro', async () => {
        // Antes caía en Acciones, que registra un pago o agenda otro seguimiento pero no
        // reporta el que se acaba de hacer.
        await abrir(fichaConDeuda, { pestanaInicial: 'resultado', seguimiento: 'cobro' });
        expect(activa()).toBe('Resultado');
        expect(await screen.findByRole('heading', { name: '¿Qué pasó con el cobro?' }, PRIMERA_CARGA)).toBeInTheDocument();
    });

    it('una pestaña pedida que este lead no tiene no deja el panel en blanco', async () => {
        // `fichaAlDia` es un cliente que ya compró: no tiene Confirmación. Pedirla no puede
        // dejar la ficha abierta en una pestaña inexistente.
        await abrir(fichaAlDia, { pestanaInicial: 'conf' });
        expect(activa()).toBe('Historial');
    });

    it('el teléfono abre WhatsApp con el saludo listo', async () => {
        await abrir(fichaPrecall);
        const enlace = screen.getByTitle(/Escribirle por WhatsApp/);
        expect(enlace).toHaveAttribute('href', expect.stringContaining('https://wa.me/'));
        expect(enlace.getAttribute('href')).toContain(encodeURIComponent('te saluda tu asesor'));
    });

    it('muestra solo las pestañas que declara el estado', async () => {
        await abrir(fichaPrecall);
        // Por el nombre accesible y no por el texto: la pestaña lleva además un ícono y, si
        // hay notas, su contador, y ninguno de los dos forma parte de cómo se llama.
        const esperadas = ['Confirmación', 'Resultado', 'Historial', 'Formulario', 'Comunicación'];
        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(esperadas.length);
        tabs.forEach((tab, i) => expect(tab).toHaveAccessibleName(esperadas[i]));
    });

    it('una venta con deuda abre en Acciones con las cuatro acciones de cobro', async () => {
        // Antes este test fijaba el andamio del trabajo en paralelo: que la ficha
        // sobreviviera a que Acciones todavía no existiera. Ya existe, así que ahora
        // fija lo que de verdad importa — que la pestaña que el backend eligió carga.
        await abrir(fichaConDeuda);
        expect(activa()).toBe('Acciones');
        expect(await screen.findByText('Armar plan de cuotas')).toBeInTheDocument();
        expect(screen.getByText('Registrar pago')).toBeInTheDocument();
        // Y las demás siguen andando.
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

    it('corregir una agenda del historial parchea ESA agenda y no la abierta', async () => {
        const usuario = userEvent.setup();
        await abrir({
            ...fichaAlDia,
            historial: { ...fichaAlDia.historial, agendas: [{
                id: 555, fecha: '2026-08-02T21:30:00', fuente: 'vsl', closer: 'Jean Carlo',
                closer_id: 7, chip: { label: 'Asistió', tone: 'success' },
            }] },
            vocabulario: { ...fichaAlDia.vocabulario, fuentes: [{ titulo: 'Embudos', opciones: [
                { clave: 'vsl', label: 'VSL' }, { clave: 'workshop', label: 'Workshop en vivo' },
            ] }] },
        });
        await usuario.click(screen.getByRole('button', { name: /^Agendas/ }));
        await usuario.click(screen.getByRole('button', { name: /Corregir fecha, fuente y closer/ }));
        await usuario.selectOptions(screen.getByLabelText('Fuente de la agenda'), 'workshop');
        await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(api.patch).toHaveBeenCalledWith('/ficha/555/agenda', { fuente: 'workshop' });
        expect(await screen.findByText('Agenda corregida.')).toBeInTheDocument();
    });

    it('marcar realizado un seguimiento parchea el de SU agenda, no el de la abierta', async () => {
        const usuario = userEvent.setup();
        await abrir({
            ...fichaAlDia,
            historial: { ...fichaAlDia.historial, seguimientos: [{
                agenda_id: 555, agenda_fecha: '2026-08-02T21:30:00', fecha: '2026-08-05',
                nota: 'Recordarle la cuota', tipo: 'cerrada', realizado: false, intento: 1,
            }] },
        });
        await usuario.click(screen.getByRole('button', { name: /^Seguimientos/ }));
        await usuario.click(screen.getByRole('button', { name: 'Realizado' }));

        expect(api.patch).toHaveBeenCalledWith('/ficha/555/seguimiento', { realizado: true });
        expect(await screen.findByText('Seguimiento corregido.')).toBeInTheDocument();
    });

    it('agendar un seguimiento desde el historial lo pone en la agenda elegida', async () => {
        const usuario = userEvent.setup();
        await abrir({
            ...fichaAlDia,
            historial: { ...fichaAlDia.historial, seguimientos: [], agendas: [{
                id: 555, fecha: '2026-08-02T21:30:00', fuente: 'vsl', closer: 'Jean Carlo',
                closer_id: 7, chip: { label: 'Asistió', tone: 'success' }, tipo_seguimiento: 'cerrada',
            }] },
            vocabulario: { ...fichaAlDia.vocabulario, tipos_seguimiento: [
                { clave: 'tomada', label: 'Llamadas tomadas' },
                { clave: 'cerrada', label: 'Llamadas cerradas' },
            ] },
        });
        await usuario.click(screen.getByRole('button', { name: /^Seguimientos/ }));
        await usuario.click(screen.getByRole('button', { name: 'Agendar seguimiento' }));
        await usuario.type(screen.getByLabelText('Nota'), 'Cobrar la cuota');
        const formulario = screen.getByRole('group', { name: 'Agendar un seguimiento' });
        await usuario.click(within(formulario).getByRole('button', { name: 'Agendar seguimiento' }));

        expect(api.put).toHaveBeenCalledWith('/ficha/555/seguimiento',
            expect.objectContaining({ tipo: 'cerrada', nota: 'Cobrar la cuota' }));
        expect(await screen.findByText('Seguimiento agendado.')).toBeInTheDocument();
    });

    describe('corregir un pago del historial', () => {
        const conVocabularioDePagos = {
            ...fichaAlDia,
            vocabulario: { ...fichaAlDia.vocabulario,
                medios_pago_venta: [{ clave: 'Stripe', label: 'Stripe' }, { clave: 'Hotmart', label: 'Hotmart' }],
                programas: [{ clave: 'RR', label: 'Residency Roadmap' }],
                tipos_pago_venta: [{ clave: 'seña', label: 'Seña' }, { clave: 'cuota', label: 'Cuota' }] },
        };
        const corregirMonto = async (usuario) => {
            await usuario.click(screen.getByRole('button', { name: /^Pagos/ }));
            await usuario.click(screen.getByRole('button', { name: /Corregir el pago/ }));
            const monto = screen.getByLabelText('Monto');
            await usuario.clear(monto);
            await usuario.type(monto, '900');
            await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        };

        it('parchea ESE pago, con el id en la URL y no en el cuerpo', async () => {
            const usuario = userEvent.setup();
            await abrir(conVocabularioDePagos);
            api.patch.mockResolvedValueOnce({ data: { id: 881, espejo: true, deuda: 100 } });
            await corregirMonto(usuario);

            expect(api.patch).toHaveBeenCalledWith('/ficha/9012/pago/881', { monto: 900 });
            expect(await screen.findByText('Pago corregido: la deuda se recalculó.')).toBeInTheDocument();
        });

        it('sin registro en inscripciones, el aviso dice que la deuda no cambió', async () => {
            // Decir «se recalculó» sería mentirle a quien está mirando un «Debe» que no se movió.
            const usuario = userEvent.setup();
            await abrir(conVocabularioDePagos);
            api.patch.mockResolvedValueOnce({ data: { id: 881, espejo: false, deuda: 0 } });
            await corregirMonto(usuario);

            expect(await screen.findByText(/la deuda no cambió/)).toBeInTheDocument();
        });

        it('marcar a quién se le hizo una transferencia parchea solo eso y no dice que la deuda cambió', async () => {
            const usuario = userEvent.setup();
            await abrir({
                ...conVocabularioDePagos,
                cobro: { ...conVocabularioDePagos.cobro, pagos: [{
                    ...conVocabularioDePagos.cobro.pagos[0], medio: 'Transferencia Bancaria',
                    es_transferencia: true, transferido_a: null,
                }] },
            });
            api.patch.mockResolvedValueOnce({ data: { id: 881, espejo: true, deuda: 100, cambios: ['transferido_a'] } });
            await usuario.click(screen.getByRole('button', { name: /^Pagos/ }));
            await usuario.click(screen.getByRole('button', { name: 'Jean Carlo' }));

            expect(api.patch).toHaveBeenCalledWith('/ficha/9012/pago/881', { transferido_a: 'jean_carlo' });
            expect(await screen.findByText('Listo: quedó anotado a quién se le hizo la transferencia.')).toBeInTheDocument();
        });

        it('agregar un pago postea en la ruta de pagos y no declara una venta', async () => {
            // `/venta` pasa por Sheets y n8n: agregar un pago olvidado no tiene que avisarle a nadie.
            const usuario = userEvent.setup();
            await abrir(conVocabularioDePagos);
            api.post.mockResolvedValueOnce({ data: { id: 900, espejo: true, deuda: 50 } });
            await usuario.click(screen.getByRole('button', { name: /^Pagos/ }));
            await usuario.click(screen.getByRole('button', { name: 'Agregar pago' }));
            await usuario.type(screen.getByLabelText('Monto'), '50');
            const formulario = screen.getByRole('group', { name: 'Agregar un pago' });
            await usuario.click(within(formulario).getByRole('button', { name: 'Agregar pago' }));

            expect(api.post).toHaveBeenCalledWith('/ficha/9012/pago', expect.objectContaining({
                monto: 50, metodo_pago: 'Stripe', tipo: 'cuota',
            }));
            expect(api.post).not.toHaveBeenCalledWith('/ficha/9012/venta', expect.anything());
            expect(await screen.findByText('Pago agregado: la deuda ya lo cuenta.')).toBeInTheDocument();
        });
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

    it('Escape en el editor de una agenda cierra el editor y no la ficha', async () => {
        const usuario = userEvent.setup();
        const onCerrar = vi.fn();
        await abrir({
            ...fichaAlDia,
            historial: { ...fichaAlDia.historial, agendas: [{
                id: 555, fecha: '2026-08-02T21:30:00', fuente: 'vsl', closer: 'Jean Carlo',
                closer_id: 7, chip: { label: 'Asistió', tone: 'success' },
            }] },
        }, { onCerrar });
        await usuario.click(screen.getByRole('button', { name: /^Agendas/ }));
        const lapiz = screen.getByRole('button', { name: /Corregir fecha, fuente y closer/ });
        await usuario.click(lapiz);
        await usuario.keyboard('{Escape}');

        expect(onCerrar).not.toHaveBeenCalled();
        expect(screen.queryByRole('group', { name: /Corregir la agenda/ })).not.toBeInTheDocument();
        // El foco vuelve al lápiz y no se pierde en el `body`.
        expect(lapiz).toHaveFocus();
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
