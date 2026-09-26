import { describe, expect, it } from 'vitest';
import {
    ESTADO_CARTERA, FACETAS_POR_TABLA, SENA_ESTADO, TABLAS, TABLAS_POR_ROL, revisarDestino,
    rotuloToques,
} from '../../pages/comercial/components/tablasDef';
import {
    DESTINOS_CLOSER, DESTINOS_METRICA, DESTINOS_SETTER, PASOS_CLOSER, PASOS_SETTER, conDia,
    destinoDeSerie, destinoToques, serieCortable,
} from '../../pages/comercial/components/destinos';
import {
    DESTINOS_RANKING, METRICS, destino, destinoFuente, destinoPrograma,
} from '../../pages/closer/dashboard/metricSources';
import { cargaDe } from './MetricaClicable';

/**
 * **Este es el test que evita que un número lleve a una lista equivocada.**
 *
 * El drill-down filtra comparando el valor que manda la métrica contra lo que devuelve
 * `faceta.de(fila)`. Nada falla si la clave de faceta no existe o si está mal escrita: el filtro se
 * ignora en silencio y la lista muestra el período entero. Es el peor modo de falla posible —un
 * número que abre una lista que no le corresponde— y es invisible en una revisión de código.
 *
 * Así que todo destino, de las dos pantallas, se valida acá contra las facetas reales.
 */

/** Todos los destinos del repo, con el nombre del lugar donde viven, para que el fallo diga dónde. */
const todos = () => {
    const salida = [];
    const sumar = (donde, d) => { if (d) salida.push([donde, d]); };

    Object.entries(DESTINOS_CLOSER).forEach(([k, d]) => sumar(`DESTINOS_CLOSER.${k}`, d));
    Object.entries(DESTINOS_SETTER).forEach(([k, d]) => sumar(`DESTINOS_SETTER.${k}`, d));
    Object.entries(PASOS_CLOSER).forEach(([k, p]) => sumar(`PASOS_CLOSER.${k}`, p.destino));
    Object.entries(PASOS_SETTER).forEach(([k, p]) => sumar(`PASOS_SETTER.${k}`, p.destino));
    Object.entries(DESTINOS_METRICA).forEach(([rol, metricas]) => {
        Object.entries(metricas).forEach(([k, d]) => sumar(`DESTINOS_METRICA.${rol}.${k}`, d));
    });
    Object.entries(METRICS).forEach(([k, m]) => sumar(`METRICS.${k}`, m.destino));
    Object.entries(DESTINOS_RANKING).forEach(([k, d]) => sumar(`DESTINOS_RANKING.${k}`, d));

    // Los destinos que se arman con una función, con un argumento de ejemplo.
    sumar('destinoPrograma()', destinoPrograma('Residency Roadmap'));
    sumar('destinoFuente(agendas)', destinoFuente('Setting'));
    sumar('destinoFuente(asistencias)', destinoFuente('Setting', 'asistencias'));
    sumar('destinoToques()', destinoToques('3'));

    ['closers', 'setters'].forEach(rol => {
        ['cash', 'agendas', 'ventas', 'showup', 'senas', 'programas',
            'entrantes', 'respuestas', 'cualificados', 'tasa_resp'].forEach(key => {
            sumar(`destinoDeSerie(${rol}, ${key})`, destinoDeSerie(rol, key));
        });
    });
    sumar('destinoDeSerie(closers, cash, Cuotas)', destinoDeSerie('closers', 'cash', 'Cuotas'));
    sumar('destinoDeSerie(closers, ventas, Split Pay)', destinoDeSerie('closers', 'ventas', 'Split Pay'));
    sumar('destinoDeSerie(closers, programas, Todos)', destinoDeSerie('closers', 'programas', 'Todos'));

    return salida;
};

describe('el mapa de destinos del drill-down', () => {
    it('hay destinos para validar (si esto falla, el test no está mirando nada)', () => {
        expect(todos().length).toBeGreaterThan(50);
    });

    it('cada destino apunta a una tabla que existe y a facetas que existen de verdad', () => {
        const problemas = todos().flatMap(([donde, d]) =>
            revisarDestino(d).map(p => `${donde}: ${p}`));

        expect(problemas).toEqual([]);
    });

    it('ningún destino apunta a una tabla que su rol no puede abrir', () => {
        // La tabla tiene que estar en `TABLAS_POR_ROL` de algún rol: una tabla definida pero que
        // ninguna pestaña ofrece sería un destino al que no se puede llegar.
        const alcanzables = new Set(Object.values(TABLAS_POR_ROL).flat());
        const huerfanas = todos()
            .filter(([, d]) => !alcanzables.has(d.tabla))
            .map(([donde, d]) => `${donde} -> ${d.tabla}`);

        expect(huerfanas).toEqual([]);
    });

    it('los valores del filtro son etiquetas, no keys', () => {
        // El filtrado compara contra `faceta.de(fila)`, que devuelve la etiqueta. Mandar la key
        // ("venta" en vez de "Venta") no falla: filtra cero filas y la lista sale vacía. Se
        // detecta chequeando que ningún valor sea una key conocida del vocabulario del backend.
        const KEYS = ['venta', 'no_show', 'cancelo', 'reagendo', 'pendiente', 'asistio',
            'segunda_llamada', 'seguimiento', 'presento_no_cerro', 'completo', 'parcial', 'cuota',
            'seña', 'agendo', 'en_conversacion', 'sin_respuesta', 'descartado', 'vencida',
            'por_vencer', 'sin_plan', 'al_dia', 'confirmada', 'sin_confirmar',
            // Las de `sena_estado`, que el backend manda como clave en la fila.
            'pago_completo', 'pago_parcial', 'en_espera', 'caida'];

        const sospechosos = todos().flatMap(([donde, d]) =>
            Object.entries(d.filtro || {}).flatMap(([clave, valor]) =>
                [valor].flat()
                    .filter(v => KEYS.includes(v))
                    .map(v => `${donde}: ${clave}="${v}" parece una key, no una etiqueta`)));

        expect(sospechosos).toEqual([]);
    });

    it('todo destino dice de qué número viene', () => {
        // Sin `de` la lista no puede mostrar el aviso de procedencia, y entonces se pierde la
        // mitad del requisito: "se ve de dónde viene el filtro".
        const sinNombre = todos().filter(([, d]) => !d.de).map(([donde]) => donde);
        expect(sinNombre).toEqual([]);
    });

    it('las facetas de sí/no solo reciben Sí o No', () => {
        const SI_NO = ['confirmada', 'asistio', 'presento', 'respondio', 'cualificado'];
        const raros = todos().flatMap(([donde, d]) =>
            Object.entries(d.filtro || {})
                .filter(([clave]) => SI_NO.includes(clave))
                .flatMap(([clave, valor]) => [valor].flat()
                    .filter(v => v !== 'Sí' && v !== 'No')
                    .map(v => `${donde}: ${clave}="${v}"`)));

        expect(raros).toEqual([]);
    });
});

describe('las etiquetas del vocabulario del backend', () => {
    /**
     * Una etiqueta renombrada en el servidor deja el destino sin encontrar filas y NO falla: la
     * clave de faceta sigue siendo válida, así que el test de arriba lo deja pasar. Ya ocurrió con
     * "Debe, sin plan" → "Sin cronograma" y "Cuota por vencer" → "Con deuda". La defensa es que
     * las etiquetas estén en un solo lugar; esto verifica que nadie las volvió a escribir a mano.
     */
    const literales = (mapa) => Object.values(mapa);

    it('ningún destino escribe a mano una etiqueta de la cartera que no salga del mapa', () => {
        const validas = new Set(literales(ESTADO_CARTERA));
        const invalidas = todos().flatMap(([donde, d]) =>
            [d.filtro?.estado].flat().filter(Boolean)
                .filter(v => d.tabla === 'clientes' && !validas.has(v))
                .map(v => `${donde}: estado="${v}" no es una etiqueta de ESTADO_CARTERA`));

        expect(invalidas).toEqual([]);
    });

    it('ningún destino escribe a mano un estado de seña que no salga del mapa', () => {
        const validas = new Set(literales(SENA_ESTADO));
        const invalidas = todos().flatMap(([donde, d]) =>
            [d.filtro?.sena_estado].flat().filter(Boolean)
                .filter(v => !validas.has(v))
                .map(v => `${donde}: sena_estado="${v}" no es una etiqueta de SENA_ESTADO`));

        expect(invalidas).toEqual([]);
    });

    it('la faceta traduce la clave que manda el backend a la etiqueta del filtro', () => {
        const faceta = TABLAS.ventas.facetas.find(f => f.key === 'sena_estado');

        // La fila trae `sena_estado: 'pago_completo'` y el destino filtra por 'Pago completo':
        // si la faceta no tradujera, el clic no encontraría ninguna fila.
        expect(faceta.de({ sena_estado: 'pago_completo' })).toBe(SENA_ESTADO.pago_completo);
        expect(faceta.de({ sena_estado: 'caida' })).toBe(SENA_ESTADO.caida);
        // Una venta que no es una seña no aporta ninguna opción a la faceta.
        expect(faceta.de({ sena_estado: null })).toBeNull();
        expect(faceta.de({})).toBeNull();
        // Y si algún día el backend mandara el chip entero, se usa su etiqueta.
        expect(faceta.de({ sena_estado: { key: 'caida', label: 'Caída' } })).toBe('Caída');
    });
});

describe('las métricas del dashboard del closer', () => {
    it('cada métrica o tiene destino, o dice por qué no lo tiene', () => {
        // Es la regla del proyecto escrita como test: un dato que no se puede cortar igual que como
        // se calculó no se hace cliqueable, pero el motivo queda anotado en vez de perderse.
        const mudas = Object.entries(METRICS)
            .filter(([, m]) => !m.destino && !m.sinDestino && !m.destinoPorFila)
            .map(([k]) => k);

        expect(mudas).toEqual([]);
    });

    it('`destino(id)` devuelve null y no undefined para un id desconocido', () => {
        expect(destino('no_existe')).toBeNull();
    });

    it('ninguna métrica tiene destino Y motivo para no tenerlo a la vez', () => {
        const ambiguas = Object.entries(METRICS)
            .filter(([, m]) => m.destino && m.sinDestino)
            .map(([k]) => k);

        expect(ambiguas).toEqual([]);
    });

    it('todo destino que mezcla fuentes trae su aviso', () => {
        // Las métricas del reporte diario y la lista de agendas reales no dan lo mismo. Si una de
        // esas no avisa, el usuario ve dos números distintos sin explicación.
        const sinAviso = Object.entries(METRICS)
            .filter(([, m]) => m.destino && m.source === 'reporte' && !m.destino.aviso)
            .map(([k]) => k);

        expect(sinAviso).toEqual([]);
    });
});

describe('el destino de un día de Variabilidad', () => {
    it('agrega la faceta del día y la faceta existe', () => {
        const d = conDia(destinoDeSerie('closers', 'agendas'), '2026-09-25');

        expect(d.filtro.dia).toBe('25/09/2026');
        expect(revisarDestino(d)).toEqual([]);
        expect(FACETAS_POR_TABLA.agendas).toContain('dia');
    });

    it('sin fecha devuelve el destino tal cual', () => {
        const base = destinoDeSerie('closers', 'agendas');
        expect(conDia(base, null)).toBe(base);
    });

    it('una sub-serie que el backend junta como resto no se hace cliqueable', () => {
        expect(serieCortable('closers', 'cash', 'Otros')).toBe(false);
        expect(serieCortable('closers', 'cash', 'Cuotas')).toBe(true);
    });

    it('una serie desconocida no devuelve un destino a medias', () => {
        expect(destinoDeSerie('closers', 'inventada')).toBeNull();
        expect(serieCortable('closers', 'inventada')).toBe(false);
    });
});

describe('la tenacidad del seguimiento', () => {
    it('el rótulo del tramo es el mismo que muestra el panel', () => {
        expect(rotuloToques(1)).toBe('1 toque');
        expect(rotuloToques(3)).toBe('3 toques');
        expect(rotuloToques(4)).toBe('4 toques o más');
        expect(rotuloToques(9)).toBe('4 toques o más');
    });

    it('el tramo "4+" del backend se traduce al mismo rótulo', () => {
        // El backend manda la clave "4+" y el panel escribe "4 toques o más": si los dos no salen
        // de la misma función, el clic filtra cero filas.
        expect(destinoToques('4+').filtro.toques).toBe('4 toques o más');
        expect(destinoToques('2').filtro.toques).toBe('2 toques');
    });

    it('la faceta `toques` de la tabla de leads produce esos mismos rótulos', () => {
        const faceta = TABLAS.leads.facetas.find(f => f.key === 'toques');

        expect(faceta.de({ mensajes: 1 })).toBe('1 toque');
        expect(faceta.de({ mensajes: 7 })).toBe('4 toques o más');
        expect(faceta.de({ mensajes: 0 })).toBeNull();
    });
});

describe('la carga que viaja en el drill-down', () => {
    it('lleva las condiciones más la procedencia', () => {
        const carga = cargaDe({ tabla: 'agendas', filtro: { asistio: 'Sí' }, de: 'Show up' });

        expect(carga).toEqual({ asistio: 'Sí', __de: 'Show up', __aviso: null });
    });

    it('un destino sin condiciones sigue llevando la procedencia', () => {
        expect(cargaDe({ tabla: 'ventas', filtro: {}, de: 'Cash' }).__de).toBe('Cash');
    });

    it('los metadatos van con doble guión bajo, que es lo que la lista descarta como faceta', () => {
        const carga = cargaDe({ tabla: 'ventas', filtro: {}, de: 'Cash', aviso: 'ojo' });
        const metadatos = Object.keys(carga).filter(k => k.startsWith('__'));

        expect(metadatos.sort()).toEqual(['__aviso', '__de']);
    });
});
