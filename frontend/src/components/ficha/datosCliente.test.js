import { describe, expect, it } from 'vitest';
import { cambiosDe, valoresIniciales } from './datosCliente';

describe('valoresIniciales', () => {
    it('trae lo guardado, con el instagram sin la arroba y la fuente por su clave', () => {
        expect(valoresIniciales({
            nombre: 'Kevin Encalada', email: 'kevin@example.com', telefono: '+593 99 515 7254',
            instagram: '@kevin.enc', examen: 'MIR / ENARM',
            fuente: 'workshop_landing', fuente_label: 'Workshop · grabación',
        })).toEqual({
            nombre: 'Kevin Encalada', email: 'kevin@example.com', telefono: '+593 99 515 7254',
            instagram: 'kevin.enc', examen: 'MIR / ENARM', fuente: 'workshop_landing',
        });
    });

    it('el nombre de relleno de la lectura no es un nombre que corregir', () => {
        // Sin `full_name` la lectura cae al correo, y sin cliente a "Sin cliente".
        expect(valoresIniciales({ nombre: 'ana@x.com', email: 'ana@x.com' }).nombre).toBe('');
        expect(valoresIniciales({ nombre: 'Sin nombre' }).nombre).toBe('');
        expect(valoresIniciales({ nombre: 'Sin cliente' }).nombre).toBe('');
    });

    it('el correo inventado por NeurOPS se muestra vacío', () => {
        expect(valoresIniciales({ email: 'no-email-3fa9c2e1b0d4@neurops.com' }).email).toBe('');
    });

    it('aguanta una identidad ausente', () => {
        expect(valoresIniciales(null)).toEqual(
            { nombre: '', telefono: '', email: '', instagram: '', examen: '', fuente: '' });
    });
});

describe('cambiosDe', () => {
    const iniciales = { nombre: 'Kevin', telefono: '123', email: '', instagram: 'kev', examen: '' };

    it('solo manda lo que cambió, recortado', () => {
        expect(cambiosDe(iniciales, { ...iniciales, telefono: ' 456 ', examen: 'MIR' }))
            .toEqual({ telefono: '456', examen: 'MIR' });
    });

    it('espacios de más no son un cambio', () => {
        expect(cambiosDe(iniciales, { ...iniciales, nombre: '  Kevin ' })).toEqual({});
    });

    it('vaciar un dato sí es un cambio: viaja vacío', () => {
        expect(cambiosDe(iniciales, { ...iniciales, instagram: '' })).toEqual({ instagram: '' });
    });

    it('lo que el backend guarda igual no es un cambio: la arroba del instagram, las mayúsculas del correo', () => {
        const guardado = { ...iniciales, email: 'kevin@example.com', instagram: 'kevin.enc' };
        expect(cambiosDe(guardado, { ...guardado, instagram: '@kevin.enc' })).toEqual({});
        expect(cambiosDe(guardado, { ...guardado, instagram: 'kevin.enc@' })).toEqual({});
        expect(cambiosDe(guardado, { ...guardado, email: 'Kevin@Example.COM' })).toEqual({});
    });

    it('las mayúsculas del instagram sí son un cambio: el backend las guarda como vienen', () => {
        expect(cambiosDe(iniciales, { ...iniciales, instagram: 'Kev' })).toEqual({ instagram: 'Kev' });
    });
});
