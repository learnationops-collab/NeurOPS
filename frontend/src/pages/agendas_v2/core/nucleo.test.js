// Reglas del núcleo de Agendas 2.0. El backend (app/agendas_v2/) tiene que pasar los mismos casos.

import { describe, expect, it } from 'vitest';
import { asignacion, VENTANA_LLENAR_DIAS } from './asignacion';
import { agendaOpt, diasDelHorizonte, slotsPersona } from './disponibilidad';
import { configDe, camposPublicados, linkEvento, revision, sinPublicar, versionPublicada } from './eventos';
import { calificar, duplicarForm, grupoPorReglas, personalizar, reglasRotas, revisarSegmentacion, validarRespuesta } from './formulario';
import { normalEvento, normalForm, normalGrupo, normalPersona, normalRol, preguntasFlujo } from './normalizar';
import { armarReserva, telefonoE164 } from './reserva';
import { opcionesDeOcupacion } from '../data/almacen';

// Lunes 5 de octubre de 2026, 08:00 en La Paz (UTC-4) = 12:00 UTC.
const LUNES = Date.UTC(2026, 9, 5, 12, 0);
const H = 3600000;
const LV9a12 = { 1: [['09:00', '12:00']], 2: [['09:00', '12:00']], 3: [['09:00', '12:00']], 4: [['09:00', '12:00']], 5: [['09:00', '12:00']] };
const ag = (o = {}) => ({ reservas: { modo: 'dias', n: 30, tipo: 'corridos', desde: '', hasta: '', ...(o.reservas || {}) }, antel: { n: 0, u: 'h', ...(o.antel || {}) }, paso: { n: 60, u: 'min', ...(o.paso || {}) } });

function datos({ personas = [], grupos = [], roles = [] } = {}) {
    return { funnels: [], formularios: [], eventos: [], roles: roles.map(r => normalRol(r.id, r)), personas: personas.map(p => normalPersona(p.id, p)), grupos: grupos.map(g => normalGrupo(g.id, g)) };
}

describe('disponibilidad', () => {
    it('genera inicios cada `paso` minutos dentro del horario, en la zona de la persona', () => {
        const p = normalPersona('ana', { tz: 'America/La_Paz', horario: LV9a12 });
        const s = slotsPersona(p, 45, agendaOpt(ag({ reservas: { n: 0 } }), 45), { ahora: LUNES });
        // 09:00, 10:00 y 11:00 en La Paz; 11:00 + 45 min termina 11:45, entra.
        expect(s).toEqual([Date.UTC(2026, 9, 5, 13), Date.UTC(2026, 9, 5, 14), Date.UTC(2026, 9, 5, 15)]);
    });
    it('respeta la antelación mínima', () => {
        const p = normalPersona('ana', { tz: 'America/La_Paz', horario: LV9a12 });
        // Son las 08:00: con 3 h de antelación, lo primero que se ofrece es 11:00.
        const s = slotsPersona(p, 45, agendaOpt(ag({ reservas: { n: 0 }, antel: { n: 3, u: 'h' } }), 45), { ahora: LUNES });
        expect(s).toEqual([Date.UTC(2026, 9, 5, 15)]);
    });
    it('saltea lo ocupado', () => {
        const p = normalPersona('ana', { tz: 'America/La_Paz', horario: LV9a12 });
        const ocupado = (pid, t) => t === Date.UTC(2026, 9, 5, 14);
        expect(slotsPersona(p, 45, agendaOpt(ag({ reservas: { n: 0 } }), 45), { ahora: LUNES, ocupado })).toHaveLength(2);
    });
    it('"días hábiles" no ofrece sábados ni domingos', () => {
        const dias = diasDelHorizonte(agendaOpt(ag({ reservas: { n: 5, tipo: 'habiles' } }), 45), 'America/La_Paz', LUNES);
        expect(dias.map(x => x.dow)).toEqual([1, 2, 3, 4, 5, 1]);
    });
    it('"días corridos" incluye hoy y los N siguientes', () => {
        expect(diasDelHorizonte(agendaOpt(ag({ reservas: { n: 3 } }), 45), 'America/La_Paz', LUNES)).toHaveLength(4);
    });
    it('el rango de fechas corta en las dos puntas', () => {
        const dias = diasDelHorizonte(agendaOpt(ag({ reservas: { modo: 'rango', desde: '2026-10-07', hasta: '2026-10-09' } }), 45), 'America/La_Paz', LUNES);
        expect(dias.map(x => x.clave)).toEqual(['2026-10-07', '2026-10-08', '2026-10-09']);
    });
});

describe('formulario', () => {
    const f = normalForm('f', {
        preguntas: [
            { id: 'q1', tipo: 'opciones', peso: 2, opciones: [{ id: 'a', texto: 'A', puntos: 10 }, { id: 'b', texto: 'B', puntos: 0 }, { id: 'x', texto: 'X', descalifica: true }] },
            { id: 'q2', tipo: 'opciones', peso: 1, opciones: [{ id: 'c', texto: 'C', puntos: 5 }, { id: 'd', texto: 'D' }] },
        ],
        reglas: [{ id: 'r1', grupo: 'g1', cond: [{ q: 'q1', ops: ['a'] }, { q: 'q2', ops: ['c', 'd'] }] }, { id: 'r2', grupo: 'g2', cond: [] }],
        resto: 'g3',
    });
    it('la nota pondera puntos por peso sobre el máximo y excluye opciones sin puntos', () => {
        expect(calificar(f.preguntas, { q1: 'a', q2: 'c' })).toBe(8.3); // (20+5)/(20+10)
        expect(calificar(f.preguntas, { q1: 'a', q2: 'd' })).toBe(10);   // q2 sin puntos no cuenta
        expect(calificar(f.preguntas, {})).toBeNull();
    });
    it('la primera regla que se cumple decide; las reglas vacías se saltean; si no, va a "resto"', () => {
        expect(grupoPorReglas(f, { q1: 'a', q2: 'd' })).toEqual({ grupo: 'g1', regla: 0 });
        expect(grupoPorReglas(f, { q1: 'b', q2: 'c' })).toEqual({ grupo: 'g3', regla: null });
    });
    it('detecta reglas que apuntan a opciones borradas', () => {
        expect(reglasRotas({ ...f, reglas: [{ id: 'r', grupo: 'g', cond: [{ q: 'q1', ops: ['zz'] }] }] })).toEqual([0]);
        expect(reglasRotas(f)).toEqual([]);
    });
    it('la revisión avisa respuestas sin regla, reglas vacías, repetidas y que se pisan', () => {
        const ks = (fo) => revisarSegmentacion(fo).map(a => a.k + (a.regla != null ? a.regla : ''));
        // r1 cubre A con C o D; B no está en ninguna regla (va al resto); r2 está vacía.
        expect(ks(f)).toEqual(['sin-regla1', 'sin-cubrir']);
        expect(revisarSegmentacion(f).find(a => a.k === 'sin-cubrir')).toMatchObject({ nivel: 'info', t: expect.stringContaining('2 combinaciones') });
        const pisan = normalForm('f', {
            preguntas: f.preguntas,
            reglas: [
                { id: 'r1', grupo: 'g1', cond: [{ q: 'q1', ops: ['a', 'b'] }] },
                { id: 'r2', grupo: 'g2', cond: [{ q: 'q1', ops: ['a'] }] },              // nunca decide
                { id: 'r3', grupo: 'g3', cond: [{ q: 'q2', ops: ['c'] }] },              // la r1 le gana siempre
            ],
            resto: '',
        });
        expect(ks(pisan)).toEqual(['nunca1', 'nunca2']);
        const solapan = normalForm('f', {
            preguntas: f.preguntas,
            reglas: [{ id: 'r1', grupo: 'g1', cond: [{ q: 'q1', ops: ['a'] }] }, { id: 'r2', grupo: 'g2', cond: [{ q: 'q2', ops: ['c'] }] }],
            resto: '',
        });
        // A+C cumple las dos (gana r1); B+D no cumple ninguna y el resto no tiene estrategia.
        expect(ks(solapan)).toEqual(['repetida1', 'sin-cubrir']);
        expect(revisarSegmentacion(solapan).at(-1)).toMatchObject({ nivel: 'error', t: expect.stringContaining('B + D') });
    });
    it('duplicar remapea las reglas a las preguntas y opciones nuevas', () => {
        const c = duplicarForm(f);
        expect(c.reglas[0].cond[0].q).toBe(c.preguntas[0].id);
        expect(c.reglas[0].cond[0].ops).toEqual([c.preguntas[0].opciones[0].id]);
    });
    it('{nombre} se reemplaza, o se borra con su coma si todavía no hay nombre', () => {
        expect(personalizar('{nombre}, ¿a qué WhatsApp te escribimos?', 'Ana')).toBe('Ana, ¿a qué WhatsApp te escribimos?');
        expect(personalizar('{nombre}, ¿a qué WhatsApp te escribimos?', '')).toBe('¿A qué WhatsApp te escribimos?');
    });
    it('valida correo, teléfono e Instagram', () => {
        const q = (tipo, obligatoria = true) => ({ tipo, obligatoria });
        expect(validarRespuesta(q('email'), 'ana@x')).toBe('Revisá el correo.');
        expect(validarRespuesta(q('telefono'), '12 3')).toBe('El número parece incompleto.');
        expect(validarRespuesta(q('instagram'), 'ana.b_1')).toBe('');
        expect(validarRespuesta(q('texto', false), '')).toBe('');
        expect(validarRespuesta(q('opciones'), '')).toBe('Elegí una opción.');
    });
    it('los datos de contacto van primero y en orden fijo', () => {
        expect(preguntasFlujo(f).slice(0, 4).map(q => q.id)).toEqual(['c-email', 'c-nombre', 'c-telefono', 'c-instagram']);
    });
});

describe('asignacion', () => {
    const roles = [{ id: 'rc', nombre: 'Closer', atiende: true }];
    const ana = { id: 'ana', nombre: 'Ana', rol: 'rc', tz: 'America/La_Paz', horario: LV9a12 };
    const beto = { id: 'beto', nombre: 'Beto', rol: 'rc', tz: 'America/La_Paz', horario: LV9a12 };
    const ctx = (o = {}) => ({ preguntas: [], resp: {}, dur: 45, ag: ag(), reglas: [], resto: 'g1', ...o });

    it('"Llenar en orden": el lead ve solo la agenda del primero mientras tenga lugar en la ventana', () => {
        const d = datos({ roles, personas: [ana, beto], grupos: [{ id: 'g1', nombre: 'Top', estrategia: 'llenar', miembros: ['ana', 'beto'] }] });
        const a = asignacion(ctx(), d, { ahora: LUNES });
        expect(new Set(a.slots.map(s => s.p))).toEqual(new Set(['ana']));
    });
    it('"Llenar en orden" pasa al siguiente cuando el primero no tiene lugar en los próximos días', () => {
        const d = datos({ roles, personas: [ana, beto], grupos: [{ id: 'g1', nombre: 'Top', estrategia: 'llenar', miembros: ['ana', 'beto'] }] });
        const limite = LUNES + VENTANA_LLENAR_DIAS * 24 * H;
        const a = asignacion(ctx(), d, { ahora: LUNES, ocupado: (pid, t) => pid === 'ana' && t < limite });
        expect(a.slots[0].p).toBe('beto');
        expect(a.regla).toMatch(/anteriores están llenos/);
    });
    it('"Por horario": cada horario va al primero de la lista que lo tiene libre', () => {
        const d = datos({ roles, personas: [ana, beto], grupos: [{ id: 'g1', nombre: 'Top', estrategia: 'horario', miembros: ['ana', 'beto'] }] });
        const t0 = Date.UTC(2026, 9, 5, 13);
        const a = asignacion(ctx(), d, { ahora: LUNES, ocupado: (pid, t) => pid === 'ana' && t === t0 });
        expect(a.slots.find(s => s.t === t0).p).toBe('beto');
        expect(a.slots.find(s => s.t === t0 + H).p).toBe('ana');
    });
    it('"Distribuida" sin porcentajes: cada horario va a quien tiene menos agendas por delante', () => {
        const d = datos({ roles, personas: [ana, beto], grupos: [{ id: 'g1', nombre: 'Top', estrategia: 'repartir', miembros: ['ana', 'beto'] }] });
        const a = asignacion(ctx(), d, { ahora: LUNES, cargaDe: pid => (pid === 'ana' ? 3 : 1) });
        expect(new Set(a.slots.map(s => s.p))).toEqual(new Set(['beto']));
    });
    it('"Distribuida" con porcentajes: va a quien está más lejos de su parte', () => {
        // Ana 80% con 3 agendas (3/80) está más lejos de su parte que Beto 20% con 1 (1/20).
        const g = { id: 'g1', nombre: 'Top', estrategia: 'repartir', miembros: ['ana', 'beto'], pesos: { ana: 80, beto: 20 } };
        const a = asignacion(ctx(), datos({ roles, personas: [ana, beto], grupos: [g] }), { ahora: LUNES, cargaDe: pid => (pid === 'ana' ? 3 : 1) });
        expect(new Set(a.slots.map(s => s.p))).toEqual(new Set(['ana']));
        // Con 0% solo recibe si nadie más está libre.
        const b = asignacion(ctx(), datos({ roles, personas: [ana, beto], grupos: [{ ...g, pesos: { ana: 0, beto: 100 } }] }), { ahora: LUNES, cargaDe: pid => (pid === 'beto' ? 9 : 0) });
        expect(new Set(b.slots.map(s => s.p))).toEqual(new Set(['beto']));
    });
    it('desborde: si la prioridad no tiene closers con lugar, pasa a la siguiente', () => {
        const d = datos({
            roles, personas: [ana, { ...beto, horario: {} }],
            grupos: [{ id: 'g1', nombre: 'Top', orden: 1, estrategia: 'llenar', miembros: ['beto'] }, { id: 'g2', nombre: 'General', orden: 2, estrategia: 'repartir', miembros: ['ana'] }],
        });
        const a = asignacion(ctx(), d, { ahora: LUNES });
        expect(a.grupo.id).toBe('g2');
        expect(a.desborde).toBe(true);
        expect(a.grupoRegla).toBe('g1');
    });
    it('persona fija: solo la agenda de esa persona', () => {
        const d = datos({ roles, personas: [ana, beto] });
        expect(new Set(asignacion(ctx({ persona: 'beto' }), d, { ahora: LUNES }).slots.map(s => s.p))).toEqual(new Set(['beto']));
    });
    it('sin closers con horario: vacío en vivo, horarios genéricos solo en prueba', () => {
        const d = datos({ roles, personas: [{ ...ana, horario: {} }], grupos: [{ id: 'g1', nombre: 'Top', miembros: ['ana'] }] });
        expect(asignacion(ctx(), d, { ahora: LUNES }).slots).toEqual([]);
        const p = asignacion(ctx(), d, { ahora: LUNES, prueba: true });
        expect(p.slots.length).toBeGreaterThan(0);
        expect(p.slots[0].p).toBeNull();
    });
    it('las reservas ocupan el horario del closer y cuentan como carga', () => {
        const o = opcionesDeOcupacion([{ estado: 'agendada', closer_id: 'ana', inicio_ms: LUNES + 2 * H, fin_ms: LUNES + 2.75 * H }], LUNES);
        expect(o.ocupado('ana', LUNES + 2.5 * H, 45)).toBe(true);
        expect(o.ocupado('ana', LUNES + 3 * H, 45)).toBe(false);
        expect(o.cargaDe('ana')).toBe(1);
    });
});

describe('eventos', () => {
    const form = normalForm('f', { nombre: 'F', preguntas: [{ id: 'q', tipo: 'texto', titulo: 'Hola' }] });
    const e0 = normalEvento('e', { nombre: 'Llamada', funnel: 'fu', formulario: 'f' });
    it('publicar guarda el evento completo y una copia del formulario', () => {
        const e = { ...e0, publicado: configDe(e0, form) };
        expect(sinPublicar(e, form)).toBe(false);
        expect(versionPublicada(e).form.preguntas[0].titulo).toBe('Hola');
        const form2 = { ...form, preguntas: [{ ...form.preguntas[0], titulo: 'Chau' }] };
        expect(sinPublicar(e, form2)).toBe(true);
    });
    it('"Descartar" vuelve también los campos que estaban en su valor por defecto', () => {
        const e = { ...e0, publicado: configDe(e0, form) };
        const cambiado = { ...e, antel: { n: 9, u: 'd' }, persona: 'ana' };
        const vuelta = { ...cambiado, ...camposPublicados(cambiado) };
        expect(vuelta.antel).toEqual(e0.antel);
        expect(vuelta.persona).toBe('');
    });
    it('el link usa el slug del funnel y la revisión avisa si está repetido', () => {
        const d = { funnels: [{ id: 'fu', slug: 'workshop', nombre: 'W', activo: true }], formularios: [form], personas: [], grupos: [], roles: [], eventos: [e0, { ...e0, id: 'e2' }] };
        expect(linkEvento(d, e0)).toBe('/agenda/workshop/llamada');
        expect(revision(d, e0).find(r => /link/i.test(r[1]))[0]).toBe(0);
    });
});

describe('reserva', () => {
    it('normaliza el teléfono a formato internacional', () => {
        expect(telefonoE164('BO', '7123 4567')).toBe('+59171234567');
        expect(telefonoE164('AR', '011 2345-6789')).toBe('+541123456789');
        expect(telefonoE164('MX', '+52 55 1234 5678')).toBe('+525512345678');
    });
    it('arma el contrato con copia de preguntas y respuestas', () => {
        const form = normalForm('f', { preguntas: [{ id: 'q1', tipo: 'opciones', titulo: '¿Cuánto?', peso: 1, opciones: [{ id: 'a', texto: 'Mucho', puntos: 10 }] }] });
        const preguntas = preguntasFlujo(form);
        const r = armarReserva({
            lead: { preguntas, resp: { 'c-nombre': 'Ana Paz', 'c-telefono': '71234567', 'c-email': 'ANA@x.com', q1: 'a' }, pais: 'BO', tz: 'America/La_Paz' },
            evento: normalEvento('e', { nombre: 'Llamada', duracion: 45 }), funnel: null, form,
            asig: { grupo: { id: 'g1' }, grupoRegla: 'g1', reglaIdx: 0, desborde: false }, slot: { t: LUNES, p: 'ana' }, origen: 'juan',
        });
        expect(r.lead).toMatchObject({ nombre: 'Ana Paz', telefono: '+59171234567', email: 'ana@x.com' });
        expect(r.respuestas).toEqual([expect.objectContaining({ pregunta: '¿Cuánto?', respuesta: 'Mucho', puntos: 10 })]);
        expect(r).toMatchObject({ closer_id: 'ana', prioridad_id: 'g1', nota: 10, origen: 'juan', inicio: new Date(LUNES).toISOString() });
    });
});

describe('sesiones: duración y margen de cada closer', () => {
    it('el evento acepta duraciones y márgenes a medida dentro de los límites', () => {
        expect(normalEvento('e', { duracion: 50 }).duracion).toBe(50);
        expect(normalEvento('e', { duracion: 500 }).duracion).toBe(240);
        expect(normalEvento('e', {}).margen).toBe(0);
        expect(normalEvento('e', { margen: 25 }).margen).toBe(25);
        expect(normalEvento('e', { margen: 999 }).margen).toBe(120);
    });
    it('la persona guarda solo lo que ajustó', () => {
        const p = normalPersona('ana', { sesiones: { ev: { duracion: 30 }, otro: { margen: '15' }, vacio: {}, basura: 3 } });
        expect(p.sesiones).toEqual({ ev: { duracion: 30 }, otro: { margen: 15 } });
        expect(normalPersona('ana', {}).sesiones).toEqual({});
    });
    it('sin margen, lo publicado queda como antes', () => {
        const e = normalEvento('e', { nombre: 'Llamada' });
        expect('margen' in JSON.parse(configDe(e, null)).ev).toBe(false);
        expect(JSON.parse(configDe({ ...e, margen: 10 }, null)).ev.margen).toBe(10);
    });
    it('la sesión entra en el horario y el último margen puede pasarse', () => {
        const p = normalPersona('ana', { tz: 'America/La_Paz', horario: LV9a12 });
        const o = agendaOpt(ag({ reservas: { n: 0 }, paso: { n: 30 } }), 30);
        const nueve = Date.UTC(2026, 9, 5, 13), once = Date.UTC(2026, 9, 5, 15);
        const reservas = [
            { estado: 'agendada', closer_id: 'ana', inicio_ms: nueve, fin_ms: nueve + H / 2, margen_min: 20 },
            { estado: 'agendada', closer_id: 'ana', inicio_ms: once, fin_ms: once + H / 2 },
        ];
        const { ocupado } = opcionesDeOcupacion(reservas, LUNES);
        expect(slotsPersona(p, 30, o, { ahora: LUNES, ocupado, margen: 20 })).toEqual([Date.UTC(2026, 9, 5, 14), Date.UTC(2026, 9, 5, 15, 30)]);
    });
    it('cada closer ofrece con su propia sesión', () => {
        const ana = { id: 'ana', rol: 'closer', tz: 'America/La_Paz', horario: LV9a12, sesiones: { ev: { duracion: 30 } } };
        const beto = { id: 'beto', rol: 'closer', tz: 'America/La_Paz', horario: LV9a12 };
        const d = datos({ personas: [ana, beto] });
        const ctx = { dur: 60, margen: 0, eventoId: 'ev', ag: ag({ reservas: { n: 0 }, paso: { n: 30 } }) };
        expect(asignacion({ ...ctx, persona: 'ana' }, d, { ahora: LUNES }).slots).toHaveLength(6);
        expect(asignacion({ ...ctx, persona: 'beto' }, d, { ahora: LUNES }).slots).toHaveLength(5);
        expect(asignacion({ ...ctx, eventoId: 'otro', persona: 'ana' }, d, { ahora: LUNES }).slots).toHaveLength(5);
    });
    it('la reserva guarda la sesión del closer que tocó', () => {
        const lead = { preguntas: [], resp: { 'c-nombre': 'Ana' }, pais: 'BO', tz: 'America/La_Paz' };
        const e = normalEvento('e', { duracion: 60, margen: 10 });
        let r = armarReserva({ lead, evento: e, slot: { t: LUNES, p: 'ana', dur: 30, margen: 20 } });
        expect([r.duracion_min, r.margen_min]).toEqual([30, 20]);
        r = armarReserva({ lead, evento: e, slot: { t: LUNES, p: 'ana' } });
        expect([r.duracion_min, r.margen_min]).toEqual([60, 10]);
    });
});
