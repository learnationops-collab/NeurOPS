import { describe, expect, it } from 'vitest';
import { techoIA } from './escalas';

/**
 * «Lo más avanzado que hiciste con IA» es de opción múltiple: las marcadas llegan unidas por « | » y
 * cuenta la más alta. Los puntos son los mismos que usa el backend (assistant_clarity.IA_TECHO).
 */

const REDACTAR = 'La uso para redactar, resumir, corregir textos y hacer consultas puntuales';
const GPTS = 'Creé mis propios GPTs o asistentes personalizados para tareas que repito';
const CONSTRUI = 'Construí herramientas o automatizaciones con IA que después funcionan solas: un dashboard, un script, un flujo conectado con otras aplicaciones';

describe('techoIA', () => {
    it('puntúa cada opción del formulario nuevo', () => {
        expect(techoIA('Casi no la uso')).toMatchObject({ n: 0, ok: true, label: 'Casi no la usa' });
        expect(techoIA(REDACTAR)).toMatchObject({ n: 1, ok: true, label: 'Redacta/resume' });
        expect(techoIA(GPTS)).toMatchObject({ n: 3, ok: true, label: 'Creó GPTs propios' });
        expect(techoIA(CONSTRUI)).toMatchObject({ n: 4, ok: true, label: 'Construyó herramientas' });
    });

    it('con varias marcadas cuenta la más avanzada', () => {
        expect(techoIA(`${REDACTAR} | ${GPTS}`)).toMatchObject({ n: 3, label: 'Creó GPTs propios' });
        expect(techoIA(`${CONSTRUI} | Casi no la uso`).n).toBe(4);
    });

    it('sigue entendiendo las opciones del formulario anterior', () => {
        expect(techoIA('Construí algo funcional con IA: una herramienta, un dashboard').n).toBe(4);
        expect(techoIA('Armé agentes o flujos donde la IA se conecta con otras aplicaciones').n).toBe(4);
        expect(techoIA('Escribo prompts con contexto y ejemplos, y voy corrigiendo').n).toBe(3);
    });

    it('sin respuesta o con un texto desconocido no inventa un nivel', () => {
        expect(techoIA(null)).toMatchObject({ n: 0, ok: false, label: 'Sin respuesta' });
        expect(techoIA('Otra cosa')).toMatchObject({ n: 0, ok: false, label: 'Otra cosa' });
    });
});
