import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TabIA, { leerPaquete } from './TabIA';

describe('Configuración › Con IA', () => {
    it('lee el JSON aunque venga dentro del bloque de la IA o con texto alrededor', () => {
        expect(leerPaquete('{"paquete_thalamus": 1}')).toEqual({ paquete: { paquete_thalamus: 1 } });
        expect(leerPaquete('Acá está:\n```json\n{"a": [1, 2]}\n```\n¡Suerte!')).toEqual({ paquete: { a: [1, 2] } });
        expect(leerPaquete('Listo: {"b": true} cualquier cosa')).toEqual({ paquete: { b: true } });
        expect(leerPaquete('esto no es json').error).toMatch(/No es un JSON válido/);
    });

    it('sin servidor (modo local) avisa que no está disponible', () => {
        render(<TabIA />);
        expect(screen.getByText(/necesita el servidor/i)).toBeTruthy();
    });
});
