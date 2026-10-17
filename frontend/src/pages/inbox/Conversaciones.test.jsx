import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import Conversaciones from './Conversaciones';
import { inboxApi } from './api';

vi.mock('./api', () => ({ inboxApi: { conversaciones: vi.fn(), conversacion: vi.fn() } }));

const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
const LISTA = [
    { id: 1, igsid: '111', username: 'maria.cmz', ultimo_de: 'lead', ultimo_en: hace(12), ultimo_texto: 'Mir', examen: 'MIR', paso: null },
    { id: 2, igsid: '222', username: 'dr.lay_', ultimo_de: 'lead', ultimo_en: hace(46), ultimo_texto: '¿Sirve uworld?', examen: 'enarm 2027',
      paso: { id: 'n4', numero: 4, nombre: 'Dolor', tipo: 'mensaje' }, flujo: 'Obtener guía' },
    { id: 3, igsid: '333', username: 'lu.perezm', ultimo_de: 'motor', ultimo_en: hace(5), ultimo_texto: 'Gracias', califica: false },
];

beforeEach(() => {
    vi.clearAllMocks();
    inboxApi.conversaciones.mockResolvedValue({ conversaciones: LISTA, mediana_respuesta: 8 });
    inboxApi.conversacion.mockResolvedValue({
        contacto: { id: 2, igsid: '222', username: 'dr.lay_', variables: { examen: 'ENARM 2027', perfil: 'Médico graduado', _califica: true } },
        ejecucion: { flujo: 'Obtener guía', estado: 'esperando_respuesta', paso: { numero: 4, nombre: 'Dolor' } },
        recorrido: [{ flujo: 'Obtener guía', estado: 'esperando_respuesta', paso: { numero: 4, nombre: 'Dolor' }, iniciada_en: hace(60) }],
        mensajes: [{ id: 9, direccion: 'entrante', origen: 'lead', texto: '¿Sirve uworld?', adjuntos: [], botones: [], en: hace(46) }],
    });
});

describe('Inbox › Conversaciones', () => {
    it('arranca en «Esperan respuesta», de la que más espera a la que menos', async () => {
        render(<Conversaciones />);

        const lista = await screen.findByRole('region', { name: 'Conversaciones' });
        const filas = within(lista).getAllByRole('button');
        expect(filas.map((b) => b.querySelector('strong').textContent)).toEqual(['@dr.lay_', '@maria.cmz']);
        expect(within(filas[0]).getByText('espera 46 min')).toBeTruthy();
        expect(within(filas[0]).getByText('Paso 4 · Dolor')).toBeTruthy();
        expect(within(filas[0]).getByText('ENARM')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Esperan respuesta 2' }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByText('8 min')).toBeTruthy();
    });

    it('filtra por cola y por examen', async () => {
        render(<Conversaciones />);

        fireEvent.click(await screen.findByRole('button', { name: 'No califican 1' }));
        expect(screen.getByText('@lu.perezm')).toBeTruthy();
        expect(screen.queryByText('@dr.lay_')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Todas 3' }));
        fireEvent.click(screen.getByRole('button', { name: 'MIR 1' }));
        expect(screen.getByText('@maria.cmz')).toBeTruthy();
        expect(screen.queryByText('@lu.perezm')).toBeNull();
    });

    it('abre el chat con la ficha del lead y su recorrido', async () => {
        render(<Conversaciones />);

        fireEvent.click(await screen.findByText('@dr.lay_'));

        const ficha = await screen.findByRole('complementary', { name: 'Ficha del lead' });
        expect(within(ficha).getByText('Médico graduado')).toBeTruthy();
        expect(within(ficha).getByText('Sí')).toBeTruthy();
        expect(within(ficha).getByText('Esperando respuesta en Paso 4 · Dolor')).toBeTruthy();
        const chat = screen.getByRole('region', { name: 'Conversación' });
        expect(within(chat).getByText('ENARM · Paso 4 · Dolor')).toBeTruthy();
    });
});
