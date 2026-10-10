import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReporteDiario from './ReporteDiario';
import { hoyIso } from './modelo';

/**
 * El formulario del reporte diario v2: navegar por pasos, cargar con el teclado, los avisos que
 * bloquean, el envío con el payload v2 y reabrir un día ya enviado para editarlo.
 *
 * jsdom no tiene `matchMedia`: el formulario lo toma como movimiento reducido (las cifras quedan en
 * su valor final sin esperar cuadros) y como pantalla táctil (no enfoca solo al cambiar de paso;
 * con el teclado sí).
 */

const red = vi.hoisted(() => ({ reporte: null, prefill: {}, fechas: [], post: null, gets: [] }));

vi.mock('../../../services/api', () => ({
    default: {
        get: vi.fn((url, { params } = {}) => {
            red.gets.push([url, params]);
            if (url === '/public/setter-report') return Promise.resolve({ data: { reporte: red.reporte } });
            if (url === '/public/setter-report/prefill') return Promise.resolve({ data: red.prefill });
            if (url === '/public/setter-report/fechas') return Promise.resolve({ data: { fechas: red.fechas } });
            return Promise.reject(new Error(`sin doble para ${url}`));
        }),
        post: vi.fn((url, datos) => { red.post = [url, datos]; return Promise.resolve({ data: { id: 1 } }); }),
    },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import toast from 'react-hot-toast';

const HOY = hoyIso();

const Url = () => <output data-testid="url">{useLocation().search}</output>;

const montar = async (url = '/setter/deck?step=reporte&tab=hoy', props = {}) => {
    const vista = render(
        <MemoryRouter initialEntries={[url]}>
            <ReporteDiario setterId={7} {...props} />
            <Url />
        </MemoryRouter>,
    );
    await act(async () => {});
    return vista;
};

const celda = (nombre) => screen.getByRole('textbox', { name: nombre });
const escribir = (nombre, valor) => fireEvent.change(celda(nombre), { target: { value: String(valor) } });
const siguiente = () => fireEvent.click(screen.getByRole('button', { name: /^(Aperturas|Embudo|Follow-ups|Reflexión|Resumen)$/ }));
const pasoActual = () => screen.getByRole('navigation', { name: 'Pasos del reporte' }).querySelector('[aria-current="step"]').textContent;

const cargarDiaDelDiseno = () => {
    escribir('Anuncios, nuevos mensajes', 10);
    escribir('Anuncios, no leads', 1);
    escribir('Anuncios, in-abribles', 0);
    escribir('Inbound, nuevos mensajes', 6);
    escribir('Inbound, in-abribles', 1);
    escribir('Bienvenidas, hechas', 12);
    escribir('Bienvenidas, respondidas', 5);
};

beforeEach(() => {
    red.reporte = null;
    red.prefill = {};
    red.fechas = [];
    red.post = null;
    red.gets = [];
    window.localStorage.clear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => { window.localStorage.clear(); });

describe('ReporteDiario · los pasos', () => {
    it('arranca en Entrantes con una columna por canal y pasa por los seis pasos', async () => {
        await montar();

        expect(pasoActual()).toContain('Entrantes');
        expect(screen.getAllByText('Anuncios').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Inbound').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Bienvenidas').length).toBeGreaterThan(0);

        for (const paso of ['Aperturas', 'Embudo', 'Follow-ups', 'Reflexión', 'Resumen']) {
            siguiente();
            expect(pasoActual()).toContain(paso);
        }
        expect(screen.getByRole('button', { name: 'Enviar reporte' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
        expect(pasoActual()).toContain('Reflexión');
    });

    it('calcula la cualificación por canal mientras se carga', async () => {
        await montar();
        cargarDiaDelDiseno();

        const paso = screen.getByRole('region', { name: 'Entrantes' });
        // El número grande de cada columna: cualificación de anuncios e inbound, respuesta a bienvenidas.
        expect([...paso.querySelectorAll('.rd-rbig > b')].map(b => b.textContent)).toEqual(['90%', '83,3%', '41,7%']);
        // Y la píldora de su embudo, redondeada.
        expect(within(paso).getByText('83%')).toBeInTheDocument();
    });

    it('con el teclado: flechas ±1 (±10 con Shift), Enter al número siguiente y del último al paso siguiente', async () => {
        await montar();
        const entr = celda('Anuncios, nuevos mensajes');

        fireEvent.keyDown(entr, { key: 'ArrowUp' });
        fireEvent.keyDown(entr, { key: 'ArrowUp', shiftKey: true });
        expect(entr).toHaveValue('11');
        fireEvent.keyDown(entr, { key: 'ArrowDown' });
        expect(entr).toHaveValue('10');

        fireEvent.keyDown(entr, { key: 'Enter' });
        expect(celda('Anuncios, no leads')).toHaveFocus();

        celda('Bienvenidas, respondidas').focus();
        fireEvent.keyDown(celda('Bienvenidas, respondidas'), { key: 'Enter' });
        expect(pasoActual()).toContain('Aperturas');
        expect(celda('Anuncios, aperturas en entrantes')).toHaveFocus();

        // Shift+Enter en el primero vuelve al último número del paso anterior.
        fireEvent.keyDown(celda('Anuncios, aperturas en entrantes'), { key: 'Enter', shiftKey: true });
        expect(pasoActual()).toContain('Entrantes');
        expect(celda('Bienvenidas, respondidas')).toHaveFocus();
    });

    it('solo deja números', async () => {
        await montar();

        escribir('Anuncios, nuevos mensajes', '1a2-3');

        expect(celda('Anuncios, nuevos mensajes')).toHaveValue('123');
    });

    it('en Aperturas dice si te responden: más aperturas en dolor que en entrantes', async () => {
        await montar();
        siguiente();

        escribir('Anuncios, aperturas en entrantes', 3);
        escribir('Anuncios, aperturas en dolor', 5);
        escribir('Inbound, aperturas en entrantes', 4);
        escribir('Inbound, aperturas en dolor', 1);

        expect(screen.getByText('Te responden')).toBeInTheDocument();
        expect(screen.getByText('Responden poco')).toBeInTheDocument();
    });
});

describe('ReporteDiario · los avisos', () => {
    it('no leads + in-abribles por encima de los mensajes bloquea el envío y lleva al paso', async () => {
        await montar();
        escribir('Inbound, nuevos mensajes', 2);
        escribir('Inbound, no leads', 3);

        expect(screen.getByText('Inbound: no leads e in-abribles superan los 2 mensajes')).toBeInTheDocument();
        expect(celda('Inbound, no leads')).toHaveAttribute('aria-invalid', 'true');

        fireEvent.click(screen.getByRole('button', { name: /Resumen/ }));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' })); });

        expect(red.post).toBeNull();
        expect(toast.error).toHaveBeenCalledWith('Inbound: no leads e in-abribles superan los 2 mensajes');
        expect(pasoActual()).toContain('Entrantes');
    });

    it('una advertencia se ve en su paso pero no bloquea', async () => {
        await montar();
        cargarDiaDelDiseno();
        siguiente();
        siguiente();
        escribir('Dolor', 10);
        escribir('Oferta', 12);

        expect(screen.getByText('Oferta supera a dolor (10)')).toBeInTheDocument();
        const pill = screen.getByRole('navigation', { name: 'Pasos del reporte' }).querySelectorAll('button')[2];
        expect(pill).toHaveClass('warn');

        fireEvent.click(screen.getByRole('button', { name: /Resumen/ }));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' })); });
        expect(red.post).not.toBeNull();
    });
});

describe('ReporteDiario · enviar', () => {
    it('manda el v2 por canal, festeja y deja editar', async () => {
        const onEnviado = vi.fn();
        await montar(undefined, { onEnviado });
        cargarDiaDelDiseno();
        siguiente();
        escribir('Anuncios, aperturas en entrantes', 3);
        escribir('Anuncios, aperturas en dolor', 5);
        siguiente();
        escribir('Dolor', 10);
        escribir('Agendas de anuncios', 2);
        escribir('Agendas de inbound', 1);
        siguiente();
        escribir('Follow-ups en entrantes', 9);
        siguiente();
        fireEvent.change(screen.getByLabelText('Win del día'), { target: { value: 'Una fría agendó' } });
        siguiente();

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' })); });

        const [url, datos] = red.post;
        expect(url).toBe('/public/setter-report');
        expect(datos).toMatchObject({
            setter_id: 7, date: HOY, version: 2, is_non_working_day: false,
            anuncios: { entrantes: 10, no_lead: 1, inabribles: 0, ap_entrantes: 3, ap_dolor: 5, agendas: 2 },
            inbound: { entrantes: 6, no_lead: 0, inabribles: 1, ap_entrantes: 0, ap_dolor: 0, agendas: 1 },
            bienvenidas: { hechas: 12, respondidas: 5, aperturas: 0 },
            embudo: { dolor: 10, oferta: 0, link: 0 },
            followups: { entrantes: 9, dolor: 0, oferta: 0, link: 0 },
            reflexion: { flujo_trabajo: '', win_del_dia: 'Una fría agendó' },
        });
        expect(onEnviado).toHaveBeenCalledWith(HOY);
        expect(screen.getByText('Reporte enviado')).toBeInTheDocument();
        expect(screen.getByText(/16 entrantes · 3 agendas/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Editar reporte' }));
        expect(pasoActual()).toContain('Entrantes');
        expect(celda('Anuncios, nuevos mensajes')).toHaveValue('10');
    });

    it('un día no laborable se manda sin pasar por los pasos', async () => {
        await montar();

        fireEvent.click(screen.getByRole('button', { name: 'No laborable' }));
        expect(screen.getByRole('heading', { name: 'Día no laborable', level: 2 })).toBeInTheDocument();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' })); });

        expect(red.post[1]).toMatchObject({ is_non_working_day: true, version: 2 });
    });
});

describe('ReporteDiario · de dónde salen los números', () => {
    it('sin reporte del día, arranca con la precarga del sistema por canal', async () => {
        red.prefill = { anuncios: { entrantes: 14, no_lead: 2, inabribles: 3, agendas: 2 },
            inbound: { entrantes: 1, no_lead: 0, inabribles: 0, agendas: 1 } };
        await montar();

        expect(celda('Anuncios, nuevos mensajes')).toHaveValue('14');
        expect(celda('Anuncios, in-abribles')).toHaveValue('3');
        expect(celda('Inbound, nuevos mensajes')).toHaveValue('1');
        expect(red.gets.find(([u]) => u === '/public/setter-report/prefill')[1]).toEqual({ setter_id: 7, date: HOY });
    });

    it('la precarga no pisa lo que el setter dejó escrito en su borrador', async () => {
        window.localStorage.setItem(`neurops:reporte-setter:v2:7:${HOY}`, JSON.stringify({
            estado: { anuncios: { entrantes: 20 } }, tocados: ['anuncios.entrantes'], guardado: 1,
        }));
        red.prefill = { anuncios: { entrantes: 14, no_lead: 2, inabribles: 3, agendas: 2 } };
        await montar();

        expect(celda('Anuncios, nuevos mensajes')).toHaveValue('20');
        expect(celda('Anuncios, no leads')).toHaveValue('2');
        expect(screen.getByText('Borrador')).toBeInTheDocument();
    });

    it('lo que escribe queda en un borrador de este navegador hasta enviarlo', async () => {
        await montar();
        escribir('Inbound, nuevos mensajes', 4);

        const borrador = JSON.parse(window.localStorage.getItem(`neurops:reporte-setter:v2:7:${HOY}`));
        expect(borrador.estado.inbound.entrantes).toBe(4);
        expect(borrador.tocados).toEqual(['inbound.entrantes']);

        siguiente(); siguiente(); siguiente(); siguiente(); siguiente();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' })); });
        expect(window.localStorage.getItem(`neurops:reporte-setter:v2:7:${HOY}`)).toBeNull();
    });

    it('un día ya enviado se reabre con lo que mandó, sin precarga, para editarlo', async () => {
        red.reporte = {
            version: 2, fecha: '2026-10-08', no_laborable: false,
            canales: {
                anuncios: { entrantes: 10, no_lead: 1, inabribles: 0, ap_entrantes: 3, ap_dolor: 5, agendas: 2, cualificados: 9, aperturas: 8 },
                inbound: { entrantes: 6, no_lead: 0, inabribles: 1, ap_entrantes: 1, ap_dolor: 3, agendas: 1, cualificados: 5, aperturas: 4 },
            },
            bienvenidas: { hechas: 12, respondidas: 5, aperturas: 4 },
            totales: { entrantes: 16 },
            embudo: { cualificados: 14, dolor: 10, oferta: 7, link: 5, agendas: 3 },
            followups: { entrantes: 9, dolor: 5, oferta: 3, link: 3 },
            reflexion: { flujo_trabajo: 'Abrí 40', win_del_dia: 'Una fría' },
        };
        await montar('/setter/deck?step=reporte&tab=hoy&fecha=2026-10-08');

        expect(red.gets.find(([u]) => u === '/public/setter-report')[1]).toEqual({ setter_id: 7, date: '2026-10-08' });
        expect(red.gets.some(([u]) => u === '/public/setter-report/prefill')).toBe(false);
        expect(screen.getByText('Enviado')).toBeInTheDocument();
        expect(celda('Inbound, nuevos mensajes')).toHaveValue('6');

        escribir('Inbound, nuevos mensajes', 8);
        expect(screen.getByText('Cambios sin enviar')).toBeInTheDocument();
        siguiente(); siguiente(); siguiente(); siguiente(); siguiente();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' })); });

        expect(red.post[1]).toMatchObject({ date: '2026-10-08', inbound: { entrantes: 8, agendas: 1 }, embudo: { dolor: 10 } });
    });

    it('un día del formulario anterior se rehace por canal: avisa y precarga los canales', async () => {
        red.reporte = {
            version: 1, no_laborable: false, canales: null, bienvenidas: null, totales: { entrantes: 20 },
            embudo: { cualificados: 13, dolor: 8, oferta: 4, link: 2, agendas: 2 },
            followups: { entrantes: 6, dolor: 2, oferta: 0, link: 0 },
            reflexion: { flujo_trabajo: '', win_del_dia: '' },
        };
        red.prefill = { anuncios: { entrantes: 18, no_lead: 2, inabribles: 3, agendas: 2 } };
        await montar();

        expect(screen.getByText('Formulario anterior')).toBeInTheDocument();
        expect(celda('Anuncios, nuevos mensajes')).toHaveValue('18');
        siguiente(); siguiente();
        expect(celda('Dolor')).toHaveValue('8');
    });

    it('cambiar el día lo escribe en la URL', async () => {
        await montar();

        fireEvent.click(screen.getByRole('button', { name: /^Hoy/ }));
        const ayer = new Date(`${HOY}T12:00:00`);
        ayer.setDate(ayer.getDate() - 1);
        const iso = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
        const dia = document.querySelector(`[data-dia="${iso}"]`);
        await act(async () => { fireEvent.click(dia); });

        expect(new URLSearchParams(screen.getByTestId('url').textContent).get('fecha')).toBe(iso);
    });
});
