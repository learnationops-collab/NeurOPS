import { describe, expect, it } from 'vitest';
import { AYUDA_ESTADO, ayudaDeResultado } from './estadosAgenda';

/**
 * El tooltip de los estados de agenda que se muestran crudos (el mazo, la auditoría del closer, el
 * tablero de triage). Las oraciones son las del backend: lo verifica un contrato en pytest.
 */
describe('ayudaDeResultado', () => {
    it('reconoce los valores crudos de closer_result, sin importar mayúsculas ni espacios', () => {
        expect(ayudaDeResultado('Lead Perdido')).toBe(AYUDA_ESTADO.lead_perdido);
        expect(ayudaDeResultado(' perdido ')).toBe(AYUDA_ESTADO.lead_perdido);
        expect(ayudaDeResultado('Archivada sin reporte')).toBe(AYUDA_ESTADO.archivada_sin_reporte);
    });

    it('los demás no llevan tooltip (y `title` no se dibuja)', () => {
        expect(ayudaDeResultado('Show up')).toBeUndefined();
        expect(ayudaDeResultado(null)).toBeUndefined();
    });

    it('las dos oraciones son cortas', () => {
        Object.values(AYUDA_ESTADO).forEach(t => expect(t.split(' ').length).toBeLessThanOrEqual(15));
    });
});
