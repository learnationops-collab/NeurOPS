import { describe, expect, it } from 'vitest';
import { estadoParaSumar, ordenarParaSumar } from './Personas';

describe('Sumar a Team', () => {
    it('primero los que ya pueden recibir agendas, después los que tienen una de las dos, cada grupo por nombre', () => {
        const us = [
            { nombre: 'Zoe', calendar: false, whatsapp: false },
            { nombre: 'Beto', calendar: true, whatsapp: false },
            { nombre: 'Mario', calendar: true, whatsapp: true },
            { nombre: 'Ana', calendar: true, whatsapp: true },
        ];
        expect(ordenarParaSumar(us).map(u => u.nombre)).toEqual(['Ana', 'Mario', 'Beto', 'Zoe']);
        expect(us.map(estadoParaSumar)).toEqual([
            'sin Calendar ni WhatsApp', 'sin WhatsApp confirmado', 'listo para recibir agendas', 'listo para recibir agendas',
        ]);
    });
});
