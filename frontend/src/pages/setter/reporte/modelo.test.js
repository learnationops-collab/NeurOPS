import { describe, expect, it } from 'vitest';
import {
    aPayload, aplicarPrecarga, calcular, conRuta, desdeLectura, estadoDelPaso, fmtPct, fusionar,
    primerError, proporcion, referenciaDe, topeDeArrastre, vacio,
} from './modelo';

/**
 * Las cuentas del reporte diario v2: lo que el setter ve mientras carga y lo que bloquea el envío.
 * El día de ejemplo es el del diseño que aprobó Kerwin (anuncios 10/1/0, inbound 6/0/1...), con los
 * leads y las respuestas a las aperturas del 15/10/2026: todos contestaron (leads = la cuenta de antes)
 * y respondieron la mitad de las aperturas.
 */
const diaDelDiseno = () => {
    let s = vacio();
    s = fusionar(s, {
        anuncios: { entrantes: 10, leads: 9, no_lead: 1, inabribles: 0, ap_entrantes: 3, ap_dolor: 5,
            ap_entrantes_resp: 1, ap_dolor_resp: 3, agendas: 2 },
        inbound: { entrantes: 6, leads: 5, no_lead: 0, inabribles: 1, ap_entrantes: 1, ap_dolor: 3,
            ap_entrantes_resp: 0, ap_dolor_resp: 2, agendas: 1 },
        bienvenidas: { hechas: 12, respondidas: 5, aperturas: 4, aperturas_resp: 2 },
        embudo: { dolor: 10, oferta: 7, link: 5 },
        followups: { entrantes: 9, dolor: 5, oferta: 3, link: 3 },
        followups_respondidos: { entrantes: 4, dolor: 2, oferta: 1, link: 1 },
    });
    return s;
};

describe('calcular', () => {
    it('los cualificados de cada canal son sus leads menos los no leads, con sus tasas', () => {
        const { num } = calcular(diaDelDiseno());

        expect(num['anuncios.net']).toBe(8);
        expect(num['inbound.net']).toBe(5);
        expect(num['anuncios.cualRate']).toBe(80);
        expect(num['inbound.cualRate']).toBeCloseTo(83.333, 2);
        expect(num['tot.entr']).toBe(16);
        expect(num['tot.net']).toBe(13);
        expect(num['tot.cualRate']).toBe(81.25);
        expect(num['tot.apRate']).toBe(75);
        expect(num['tot.agendas']).toBe(3);
        expect(num['tot.convRate']).toBeCloseTo(23.08, 1);
        expect(num['tot.fuTot']).toBe(20);
        expect(num['tot.fuResp']).toBe(8);
        expect(num['tot.fuRate']).toBe(40);
        expect(num['bienvenidas.rate']).toBeCloseTo(41.67, 1);
        expect(num['bienvenidas.apRate']).toBe(80);
    });

    it('lo que sobra de los mensajes no contestó, y cada apertura tiene su % de respuesta', () => {
        const s = conRuta(diaDelDiseno(), 'anuncios.leads', 6);
        const { num } = calcular(s);

        expect(num['anuncios.noCont']).toBe(4);
        expect(num['anuncios.cualRate']).toBe(50);
        expect(num['inbound.noCont']).toBe(0);
        expect(num['anuncios.respRate']).toBe(50);
        expect(num['tot.apResp']).toBe(6);
        expect(num['tot.respRate']).toBe(50);
        expect(num['bienvenidas.respRate']).toBe(50);
    });

    it('más respuestas que aperturas es advertencia del paso Aperturas', () => {
        let s = conRuta(diaDelDiseno(), 'anuncios.ap_dolor_resp', 6);
        s = conRuta(s, 'bienvenidas.aperturas_resp', 5);
        const { avisos, marcas } = calcular(s);

        expect(avisos.map(a => a.msg)).toEqual([
            'Anuncios: más respuestas que aperturas en dolor (5)',
            'Bienvenidas: más respuestas que aperturas (4)',
        ]);
        expect(marcas.get('anuncios.ap_dolor_resp')).toBe('warn');
        expect(estadoDelPaso(avisos, 'aperturas')).toBe('warn');
        expect(referenciaDe(s, 'anuncios.ap_dolor_resp')).toBe(5);
        expect(referenciaDe(s, 'anuncios.leads')).toBe(10);
    });

    it('sin denominador una tasa es null (se muestra «—», no 0%)', () => {
        const { num } = calcular(vacio());

        expect(num['tot.cualRate']).toBeNull();
        expect(fmtPct(num['tot.cualRate'])).toBe('—');
        expect(fmtPct(87.5)).toBe('87,5%');
    });

    it('el embudo total va de los cualificados de los dos canales a las agendas', () => {
        const { G, convG } = calcular(diaDelDiseno());

        expect(G).toEqual([13, 10, 7, 5, 3]);
        expect(convG[0]).toBeNull();
        expect(convG[4]).toBe(60);
    });

    it('un día sin problemas no tiene avisos', () => {
        expect(calcular(diaDelDiseno()).avisos).toEqual([]);
    });

    it('leads + no leads + in-abribles por encima de los mensajes se acepta: es lo que dice el setter', () => {
        // Kerwin, 17/10/2026: califican también a gente que escribió otros días.
        const s = conRuta(diaDelDiseno(), 'inbound.no_lead', 2);    // 5 + 2 + 1 > 6 mensajes
        const { avisos, marcas, num } = calcular(s);

        expect(avisos).toEqual([]);
        expect(marcas.get('inbound.no_lead')).toBeUndefined();
        expect(primerError(avisos)).toBeFalsy();
        expect(num['inbound.noCont']).toBe(0);
    });

    it('el resto son advertencias: se ven pero no bloquean', () => {
        let s = diaDelDiseno();
        s = conRuta(s, 'anuncios.ap_dolor', 9);          // 3 + 9 > 10 entrantes
        s = conRuta(s, 'bienvenidas.respondidas', 13);   // más que las 12 hechas
        s = conRuta(s, 'embudo.oferta', 11);             // oferta > dolor
        const { avisos, marcas } = calcular(s);

        expect(avisos.map(a => a.msg)).toEqual([
            'Anuncios: más aperturas que entrantes (10)',
            'Bienvenidas: más respondidas que hechas',
            'Oferta supera a dolor (10)',
            'Dolor es menor que las aperturas en dolor (12)',
        ]);
        expect(avisos.every(a => a.nivel === 'warn')).toBe(true);
        expect(primerError(avisos)).toBeNull();
        expect(marcas.get('anuncios.ap_entrantes')).toBe('warn');
        expect(marcas.get('embudo.dolor')).toBe('warn');
        expect(estadoDelPaso(avisos, 'aperturas')).toBe('warn');
        expect(estadoDelPaso(avisos, 'followups')).toBeNull();
    });

    it('más respuestas que follow-ups enviados es advertencia del paso Follow-ups', () => {
        const { avisos, marcas } = calcular(conRuta(diaDelDiseno(), 'followups_respondidos.oferta', 4));

        expect(avisos).toEqual([{ paso: 'followups', nivel: 'warn', msg: 'Oferta: más respuestas que follow-ups (3)' }]);
        expect(marcas.get('followups_respondidos.oferta')).toBe('warn');
        expect(estadoDelPaso(avisos, 'followups')).toBe('warn');
    });

    it('sin follow-ups enviados la respuesta es «—»', () => {
        expect(fmtPct(calcular(vacio()).num['tot.fuRate'])).toBe('—');
    });

    it('agendas por encima del link marcan las agendas de los dos canales', () => {
        const { marcas } = calcular(conRuta(diaDelDiseno(), 'embudo.link', 2));

        expect(marcas.get('anuncios.agendas')).toBe('warn');
        expect(marcas.get('inbound.agendas')).toBe('warn');
    });
});

describe('el relleno de cada celda', () => {
    it('se mide contra su tope natural: la etapa anterior o los entrantes del canal', () => {
        const s = diaDelDiseno();

        expect(referenciaDe(s, 'anuncios.no_lead')).toBe(10);
        expect(referenciaDe(s, 'embudo.dolor')).toBe(13);
        expect(referenciaDe(s, 'anuncios.agendas')).toBe(5);
        expect(referenciaDe(s, 'bienvenidas.aperturas')).toBe(5);
        expect(proporcion(s, 'anuncios.ap_dolor')).toBe(0.5);
        expect(proporcion(s, 'embudo.oferta')).toBe(0.7);
        // Los respondidos de un follow-up, contra lo enviado en esa etapa.
        expect(referenciaDe(s, 'followups_respondidos.dolor')).toBe(5);
        expect(proporcion(s, 'followups_respondidos.dolor')).toBe(0.4);
        expect(topeDeArrastre(s, 'followups_respondidos.dolor')).toBe(5);
    });

    it('sin tope natural se compara con sus pares, y nunca pasa de lleno', () => {
        const s = diaDelDiseno();

        expect(referenciaDe(s, 'anuncios.entrantes')).toBeNull();
        expect(proporcion(s, 'anuncios.entrantes')).toBe(1);
        expect(proporcion(s, 'inbound.entrantes')).toBe(0.6);
        expect(proporcion(s, 'followups.dolor')).toBeCloseTo(5 / 9);
        expect(proporcion(conRuta(s, 'anuncios.ap_dolor', 50), 'anuncios.ap_dolor')).toBe(1);
    });

    it('arrastrar de punta a punta llega hasta el tope (o a una escala redonda si no tiene)', () => {
        const s = diaDelDiseno();

        expect(topeDeArrastre(s, 'anuncios.no_lead')).toBe(10);
        expect(topeDeArrastre(vacio(), 'anuncios.no_lead')).toBe(1);
        expect(topeDeArrastre(s, 'anuncios.entrantes')).toBe(20);
        expect(topeDeArrastre(conRuta(s, 'anuncios.entrantes', 40), 'anuncios.entrantes')).toBe(60);
    });
});

describe('ida y vuelta con el backend', () => {
    it('el payload es la forma de vacio() con quién, qué día y version 2', () => {
        const p = aPayload(diaDelDiseno(), '2026-10-10', 7);

        expect(p).toMatchObject({ setter_id: 7, date: '2026-10-10', version: 2, is_non_working_day: false });
        expect(p.anuncios).toEqual({ entrantes: 10, leads: 9, no_lead: 1, inabribles: 0, ap_entrantes: 3, ap_dolor: 5,
            ap_entrantes_resp: 1, ap_dolor_resp: 3, agendas: 2 });
        expect(p.bienvenidas.aperturas_resp).toBe(2);
        expect(Object.keys(p).sort()).toEqual(['anuncios', 'bienvenidas', 'date', 'embudo', 'followups',
            'followups_respondidos', 'inbound', 'is_non_working_day', 'reflexion', 'setter_id', 'version']);
        expect(p.followups_respondidos).toEqual({ entrantes: 4, dolor: 2, oferta: 1, link: 1 });
    });

    it('una lectura v2 del backend vuelve a la forma del formulario', () => {
        const lectura = {
            version: 2, no_laborable: false,
            canales: {
                anuncios: { entrantes: 10, no_lead: 1, inabribles: 0, ap_entrantes: 3, ap_dolor: 5, agendas: 2, cualificados: 8, aperturas: 8 },
                inbound: { entrantes: 6, no_lead: 0, inabribles: 1, ap_entrantes: 1, ap_dolor: 3, agendas: 1, cualificados: 5, aperturas: 4 },
            },
            bienvenidas: { hechas: 12, respondidas: 5, aperturas: 4 },
            totales: { entrantes: 16 },
            embudo: { cualificados: 13, dolor: 10, oferta: 7, link: 5, agendas: 3 },
            followups: { entrantes: 9, dolor: 5, oferta: 3, link: 3 },
            followups_respondidos: { entrantes: 4, dolor: 2, oferta: 1, link: 1 },
            reflexion: { flujo_trabajo: 'Abrí 40', win_del_dia: 'Una fría' },
        };

        const s = desdeLectura(lectura);
        expect(s.followups_respondidos).toEqual({ entrantes: 4, dolor: 2, oferta: 1, link: 1 });

        // Un reporte de antes del 15/10 no trae leads: el campo toma sus cualificados (la cuenta de
        // antes), así editarlo no los baja a cero. Las respuestas que no cargó vuelven en cero.
        expect(s.anuncios).toEqual({ ...diaDelDiseno().anuncios, ap_entrantes_resp: 0, ap_dolor_resp: 0 });
        expect(s.embudo).toEqual({ dolor: 10, oferta: 7, link: 5 });
        expect(s.reflexion.win_del_dia).toBe('Una fría');
        expect(calcular(s).num['tot.net']).toBe(13);
    });

    it('un v1 vuelve sin canales: no se inventa en qué canal entró cada uno', () => {
        const s = desdeLectura({ version: 1, canales: null, bienvenidas: null, no_laborable: false,
            embudo: { cualificados: 13, dolor: 8, oferta: 4, link: 2, agendas: 2 },
            followups: { entrantes: 6, dolor: 2, oferta: 0, link: 0 },
            reflexion: { flujo_trabajo: '', win_del_dia: '' } });

        expect(s.anuncios.entrantes).toBe(0);
        expect(s.embudo.dolor).toBe(8);
        expect(s.followups.entrantes).toBe(6);
    });

    it('un borrador viejo con otra forma no mete claves sueltas ni negativos', () => {
        const s = fusionar(vacio(), { anuncios: { entrantes: '12', no_lead: -3, cualquiera: 5 }, otra: { x: 1 } });

        expect(s.anuncios).toEqual({ ...vacio().anuncios, entrantes: 12, no_lead: 0 });
        expect(s).not.toHaveProperty('otra');
    });
});

describe('la precarga del sistema', () => {
    const precarga = {
        anuncios: { entrantes: 14, no_lead: 2, inabribles: 3, agendas: 2 },
        inbound: { entrantes: 1, no_lead: 0, inabribles: 0, agendas: 1 },
    };

    it('solo llena las agendas: los mensajes, no leads e in-abribles los cuenta el setter', () => {
        // Kerwin, 17/10/2026: ManyChat cuenta solo a quien escribió ese día por primera vez.
        const s = aplicarPrecarga(vacio(), precarga, new Set());

        expect(s.anuncios).toMatchObject({ entrantes: 0, no_lead: 0, inabribles: 0, agendas: 2 });
        expect(s.inbound.agendas).toBe(1);
        expect(s.anuncios.ap_dolor).toBe(0);
    });

    it('no pisa lo que el setter ya escribió', () => {
        const escrito = conRuta(vacio(), 'anuncios.agendas', 5);
        const s = aplicarPrecarga(escrito, precarga, new Set(['anuncios.agendas']));

        expect(s.anuncios.agendas).toBe(5);
        expect(s.inbound.agendas).toBe(1);
    });
});
