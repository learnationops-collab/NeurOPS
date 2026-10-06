import { describe, expect, it } from 'vitest';
import { ordenarListos } from './ElegirCloser';

describe('Elegir closer', () => {
    it('primero los que tienen Calendar, WhatsApp y horarios; después a los que les falta menos; cada grupo por nombre', () => {
        const os = [
            { nombre: 'Zoe', calendar: false, whatsapp: false, horarios: false },
            { nombre: 'Beto', calendar: true, whatsapp: false, horarios: true },
            { nombre: 'Mario', calendar: true, whatsapp: true, horarios: true },
            { nombre: 'Ana', calendar: true, whatsapp: true, horarios: true },
            { nombre: 'Luz', horarios: true },  // modo local: Calendar y WhatsApp no se saben y no cuentan
        ];
        expect(ordenarListos(os).map(o => o.nombre)).toEqual(['Ana', 'Luz', 'Mario', 'Beto', 'Zoe']);
    });
});
