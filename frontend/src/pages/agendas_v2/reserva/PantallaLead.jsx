// Pantalla del lead: formulario de a una pregunta por vez, calendario y confirmación.
// Port de ctxNuevo … rvAtras, montarRv y los manejadores rv-* del prototipo.
//
// modo:
//   'prueba'   → a pantalla completa desde Thalamus (no se agenda nada; Salir/Escape cierra)
//   'embebida' → vista previa dentro del editor (no se agenda nada; Reiniciar en vez de Salir)
//   'publico'  → el link real: confirma con proveedor.reservar y registra a los que no califican
//
// proveedor (reserva/proveedores.js): de dónde salen los horarios y dónde se agenda. El local calcula
// todo al instante; el de la API trae los horarios del servidor (con "Buscando horarios…" mientras tanto).

import '../thalamus.css';
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FIN_DEF, conOpciones, detectarPais, paisDe } from '../core/catalogos';
import { buscar } from '../core/datos';
import { grupoPorReglas, limpiarRespuesta, nombreLead, opcionDescalifica, personalizar, validarRespuesta } from '../core/formulario';
import { COLECCIONES, normalForm, preguntasFlujo } from '../core/normalizar';
import { Humo, Icono } from '../ui/base';
import { rutaGracias } from './gracias/contenido';
import PasoCalendario from './PasoCalendario';
import PasoConocido, { PasoPrevias } from './PasoConocido';
import { PasoFin, PasoListo, Respuestas } from './PasoFinal';
import PasoPregunta, { opcionesVisibles } from './PasoPregunta';

const HUMO_RV = ['var(--rv-humo-a)', 'var(--rv-humo-b)', 'var(--rv-humo-b)', 'var(--rv-humo-a)'];
const AUTO_AVANCE = 380;
const MSG_OCUPADO = 'Ese horario se acaba de ocupar. Elegí otro.';
const MSG_FALLO = 'No pudimos agendar la llamada. Revisá tu conexión y probá de nuevo.';
const MSG_LIMITE = 'Demasiados intentos, probá en un minuto.';
const MSG_HORARIOS = 'No pudimos traer los horarios. Revisá tu conexión y probá de nuevo.';
// Sin datos locales (proveedor de la API): colecciones vacías para que buscar() no falle.
const SIN_DATOS = Object.fromEntries(COLECCIONES.map(c => [c, []]));
const SIN_REMOTO = { clave: '', resp: null, asig: null, error: '' };

// Lo fijo de esta pantalla: preguntas (con las de contacto adelante), textos del evento y reglas de agenda.
function armarCtx(form, ev, persona, d) {
    const fo = form ? (form.contacto ? form : normalForm('x', form)) : null;
    const preguntas = (fo ? preguntasFlujo(fo) : []).map(q => ({ ...q, opciones: q.opciones.filter(x => x.texto.trim()) }));
    let per = persona || (ev && ev.persona) || null;
    const perId = typeof per === 'string' ? per : per ? per.id : null;
    if (typeof per === 'string') per = buscar(d, 'personas', per) || null;
    return {
        form: fo, evento: ev, preguntas, fin: fo ? fo.fin : FIN_DEF,
        eyebrow: ev ? ev.nombre : per ? 'Llamada con ' + per.nombre : fo ? fo.nombre : 'Llamada',
        // La duración que ve el lead es la propuesta del evento; al agendar se le confirma la del closer.
        dur: ev ? ev.duracion : per && per.ldur ? per.ldur : 45, margen: ev ? ev.margen || 0 : 0, eventoId: ev ? ev.id : '',
        reglas: fo ? fo.reglas || [] : null, resto: fo ? fo.resto || '' : '', persona: perId,
        ag: ev ? { reservas: ev.reservas, antel: ev.antel, paso: ev.paso } : null,
        // Después de confirmar: la página de gracias del evento si tiene una; si no, su link de redirección.
        redir: ev ? (ev.gracias ? window.location.origin + rutaGracias(ev.gracias) : ev.redir) : '', tzFija: ev && ev.zona && ev.zona.modo === 'fija' ? ev.zona.tz : '',
    };
}

// resp/fin/finUrl: la prueba por segmento arranca con el lead de prueba ya cargado (o directo en el fin).
function estadoInicial(ctx, { desde = 0, ejemplo = '', resp = null, fin = false, finUrl = '' } = {}, enfocar = true) {
    const p0 = detectarPais();
    return {
        idx: Math.min(desde || 0, ctx.preguntas.length), resp: resp ? { ...resp } : {}, ejemplo: ejemplo || '', tel: (resp && resp['c-telefono']) || '',
        pais: p0.c, tz: ctx.tzFija || p0.tz, mes: null, dia: null, hora: null,
        error: '', errN: 0, paisAbierto: false, zonaAbierta: false, busca: '',
        fin: !!fin, finUrl: finUrl || '', listo: false, slot: null, asigFinal: null, recalc: 0, vuelta: 0,
        // El lead que vuelve: buscando (la pregunta, WhatsApp o correo, con la que se lo busca), visto (con
        // cuál se lo reconoció: no se lo vuelve a buscar con la otra), reco (lo que se encontró) y su paso,
        // siYaTiene (lo que eligió con la sesión que ya tenía), guardados/tapados (confirmó sus datos guardados),
        // previas (ya respondió este formulario) y usaPrevias (null: no eligió; true: las confirmó; false: responde).
        buscando: '', visto: '', recoN: 0, reco: null, siYaTiene: null, guardados: false, tapados: null, consultor: null,
        previas: null, usaPrevias: null, invitacion: '', durReal: null,
        foco: enfocar ? 'entra' : null, focoN: enfocar ? 1 : 0,
    };
}

// Pide mover el foco después de pintar: 'entra' (primer campo del paso nuevo) o un selector.
const conFoco = (p, foco) => ({ ...p, foco, focoN: p.focoN + 1 });

// Guarda limpio lo escrito en la pregunta actual (sin espacios de más; Instagram sin @).
function fijarTexto(p, preguntas) {
    const q = preguntas[p.idx];
    if (!q || conOpciones(q.tipo)) return p;
    return { ...p, resp: { ...p.resp, [q.id]: limpiarRespuesta(q, p.resp[q.id]) } };
}

// Lo que la segmentación decide al terminar las preguntas: {url} (una regla lo manda a otra página) o
// {no} (lo manda a «No califica»). En los dos casos no agenda. Con persona fija no hay segmentación.
function cortePorReglas(ctx, resp) {
    if (!ctx || !ctx.form || ctx.persona) return { url: '', no: false };
    const r = grupoPorReglas(ctx.form, resp);
    return { url: r.url || '', no: !!r.no };
}

// Con qué se reconoce al lead que vuelve: su WhatsApp o su correo (el que deje primero).
const IDENTIFICA = ['c-telefono', 'c-email'];
const primeraDelForm = (preguntas) => preguntas.findIndex(q => !q.id.startsWith('c-'));

// Ya respondió este formulario: antes de la primera pregunta se le pregunta si sigue todo igual.
function ofrecePrevias(p, preguntas) {
    return !!p.previas && p.usaPrevias === null && !p.listo && !p.fin && !p.reco && p.idx < preguntas.length && p.idx === primeraDelForm(preguntas);
}

// reconocer: el proveedor sabe buscar al lead que vuelve; al dejar el WhatsApp o el correo se lo busca
// antes de seguir (con el segundo, solo si con el primero no apareció).
// ctx: al terminar las preguntas, una regla con url (o a «No califica») corta como un descalificado.
function seguirDe(p, preguntas, reconocer = false, ctx = null) {
    if (p.idx >= preguntas.length || p.listo || p.fin || p.buscando || p.reco || ofrecePrevias(p, preguntas)) return p;
    const q = preguntas[p.idx], p1 = fijarTexto(p, preguntas);
    const err = validarRespuesta(q, p1.resp[q.id] || '');
    if (err) return { ...p1, error: err, errN: p1.errN + 1 };
    const cerrado = { ...p1, error: '', paisAbierto: false, zonaAbierta: false };
    if (reconocer && IDENTIFICA.includes(q.id) && p1.resp[q.id] && (!p1.visto || p1.visto === q.id)) {
        return { ...cerrado, buscando: q.id, visto: '', recoN: p1.recoN + 1, guardados: false, tapados: null, siYaTiene: null, previas: null, usaPrevias: null };
    }
    if (opcionDescalifica(q, p1.resp)) return conFoco({ ...cerrado, fin: true }, 'entra');
    const corte = p1.idx + 1 >= preguntas.length ? cortePorReglas(ctx, p1.resp) : { url: '', no: false };
    if (corte.url) return conFoco({ ...cerrado, fin: true, finUrl: corte.url }, 'entra');
    if (corte.no) return conFoco({ ...cerrado, fin: true }, 'entra');
    return conFoco({ ...cerrado, idx: p1.idx + 1, busca: '' }, 'entra');
}

function atrasDe(p, preguntas) {
    if (p.listo || p.fin) return p;
    // Desde "no es tu primera vez" se vuelve a donde se lo reconoció (WhatsApp o correo).
    if (p.reco) return conFoco({ ...p, reco: null, siYaTiene: null }, 'entra');
    if (p.idx === 0) return p;
    const p1 = fijarTexto(p, preguntas);
    let idx = Math.min(p1.idx, preguntas.length) - 1;
    // Confirmó sus respuestas guardadas: las preguntas se saltearon, así que se vuelve a preguntarle si sigue igual.
    if (p1.usaPrevias && preguntas[idx] && !preguntas[idx].id.startsWith('c-')) {
        return conFoco({ ...p1, idx: primeraDelForm(preguntas), usaPrevias: null, error: '', busca: '' }, 'entra');
    }
    // Confirmó sus datos guardados: las preguntas de contacto se saltearon, así que se vuelve a donde se lo reconoció.
    if (p1.guardados && preguntas[idx] && preguntas[idx].id.startsWith('c-')) {
        idx = Math.max(0, preguntas.findIndex(q => q.id === (p1.visto || 'c-email')));
        return conFoco({ ...p1, idx, guardados: false, tapados: null, siYaTiene: null, previas: null, usaPrevias: null, error: '', busca: '' }, 'entra');
    }
    return conFoco({ ...p1, idx, error: '', busca: '', paisAbierto: false, zonaAbierta: false }, 'entra');
}

// El lead que vuelve: su nombre viene escrito (lo puede corregir en la pregunta).
function conNombre(p, r) {
    const nom = r && r.datos ? r.datos.nombre_completo || r.datos.nombre : '';
    return nom && !p.resp['c-nombre'] ? { ...p, resp: { ...p.resp, 'c-nombre': nom } } : p;
}

// El lead que vuelve con los datos completos no los escribe de nuevo: se saltean las preguntas de contacto.
// Si le faltan, sigue después del correo con el nombre precargado.
function usarGuardados(p, r, preguntas) {
    const base = { ...p, buscando: '', reco: null, busca: '', previas: r.respuestas || null, usaPrevias: null };
    if (!r.completos) return conFoco({ ...conNombre(base, r), idx: p.idx + 1 }, 'entra');
    const i = preguntas.findIndex(q => !q.id.startsWith('c-'));
    const resp = { ...p.resp, ...(r.resp || {}) };
    if (!resp['c-nombre'] && r.datos.nombre) resp['c-nombre'] = r.datos.nombre;
    return conFoco({ ...base, resp, guardados: true, tapados: r.datos, idx: i < 0 ? preguntas.length : i }, 'entra');
}

// Sí, sigue igual: se saltean las preguntas y termina como si las hubiera respondido (calendario, «No
// califica» u otra página). La API no manda las respuestas: dice cómo termina y el servidor las completa.
function elegirPrevias(p, si, preguntas, ctx) {
    if (!ofrecePrevias(p, preguntas)) return p;
    if (!si) return conFoco({ ...p, usaPrevias: false }, 'entra');
    const resp = { ...p.resp, ...(p.previas.resp || {}) };
    let corte = p.previas.resp ? null : { url: p.previas.url || '', no: !!p.previas.no };
    if (!corte) corte = preguntas.some(q => opcionDescalifica(q, resp)) ? { url: '', no: true } : cortePorReglas(ctx, resp);
    const p1 = { ...p, resp, usaPrevias: true, idx: preguntas.length, busca: '', error: '' };
    if (corte.url) return conFoco({ ...p1, fin: true, finUrl: corte.url }, 'entra');
    if (corte.no) return conFoco({ ...p1, fin: true }, 'entra');
    return conFoco(p1, 'entra');
}

// Tab no sale de la pantalla a pantalla completa.
function atrapar(e, cont) {
    const fs = Array.from(cont.querySelectorAll('button,input,textarea,select,a[href]')).filter(x => !x.disabled && x.offsetParent !== null);
    if (!fs.length) return;
    const a = fs[0], z = fs[fs.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
}

/**
 * fuente: {form, evento?, persona?, desde?, ejemplo?, resp?, fin?, finUrl?, etiqueta?}. En el link público, evento y form son la versión publicada.
 * etiqueta: lo que se está probando (va junto a «Prueba»).
 * proveedor: proveedorLocal(...) o proveedorApi() (reserva/proveedores.js).
 * origen: slug de ?o=; setter: id de la persona del origen (lo resuelve la página pública en modo local).
 * onReiniciar: en vez de volver a empezar acá, «Probar de nuevo» hace esto (la prueba por segmento vuelve a elegir).
 */
export default function PantallaLead({ fuente, proveedor, modo = 'prueba', prevModo = 'escritorio', origen = '', setter = null, onSalir, onReiniciar }) {
    const d = proveedor.d || SIN_DATOS;
    const sinc = proveedor.sinc !== false;
    const prueba = modo !== 'publico';
    const ctx = useMemo(() => armarCtx(fuente.form, fuente.evento || null, fuente.persona || null, d),
        [fuente.form, fuente.evento, fuente.persona, d]);
    const [s, setS] = useState(() => estadoInicial(ctx, fuente, modo !== 'embebida'));
    const [envio, setEnvio] = useState({ enviando: false, error: '', n: 0 });
    const uid = useId();
    const ids = { q: uid + 'q', lista: uid + 'lista', zsel: uid + 'zsel' };
    const rootRef = useRef(null), cuerpoRef = useRef(null), timerRef = useRef(null), vivoRef = useRef(true), descRef = useRef(false);
    const sRef = useRef(s), accRef = useRef(null), teclaRef = useRef(null);

    const { preguntas } = ctx;
    const n = preguntas.length;
    const reconocer = typeof proveedor.conocido === 'function' && !!ctx.evento;
    const idx = Math.min(s.idx, n);
    const nombre = nombreLead(s.resp, s.ejemplo);
    const enCal = idx >= n && !s.listo && !s.fin;

    const ctxAsig = (p) => ({ preguntas, resp: p.resp, dur: ctx.dur, margen: ctx.margen, eventoId: ctx.eventoId, ag: ctx.ag, reglas: ctx.reglas, resto: ctx.resto, persona: ctx.persona });
    // Proveedor local: la asignación sale al instante (sin parpadeo). Las reservas bloquean horarios;
    // cambiar de zona o un "ocupado" (recalc) vuelve a calcular.
    const asigSinc = useMemo(() => {
        if (!enCal || !sinc) return null;
        return proveedor.horarios({ ctx: ctxAsig(s), evento: ctx.evento, resp: s.resp, tz: s.tz, prueba });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enCal, sinc, proveedor, ctx, s.resp, s.tz, s.recalc, prueba]);

    // Proveedor de la API: los horarios llegan después. Cada pedido tiene una clave (respuestas, zona y
    // recalc); uno viejo se cancela. Mientras llega el nuevo se siguen mostrando los horarios anteriores
    // de las mismas respuestas, si los había (cambiar de zona o un "ocupado" no deja la pantalla en blanco).
    const clavePedido = enCal && !sinc ? JSON.stringify([ctx.evento ? ctx.evento.id : '', s.resp, s.tz, s.recalc, s.usaPrevias === true]) : '';
    const [remoto, setRemoto] = useState(SIN_REMOTO);
    useEffect(() => {
        if (!clavePedido) return undefined;
        const ctl = new AbortController(), { resp, tz, pais, usaPrevias } = sRef.current;
        proveedor.horarios({ evento: ctx.evento, resp, tz, pais, guardadas: usaPrevias === true, signal: ctl.signal }).then((asig) => {
            if (!ctl.signal.aborted && vivoRef.current) setRemoto({ clave: clavePedido, resp, asig, error: '' });
        }, (e) => {
            if (ctl.signal.aborted || !vivoRef.current || (e && e.code === 'cancelado')) return;
            setRemoto(r => ({ ...r, clave: clavePedido, error: e && e.code === 'limite' ? MSG_LIMITE : MSG_HORARIOS }));
        });
        return () => ctl.abort();
    }, [clavePedido, proveedor, ctx.evento]);
    const buscando = !!clavePedido && remoto.clave !== clavePedido;
    const errorHorarios = clavePedido && remoto.clave === clavePedido ? remoto.error : '';
    const asigViva = sinc ? asigSinc : (remoto.resp === s.resp ? remoto.asig : null);

    useEffect(() => {
        vivoRef.current = true;
        return () => { vivoRef.current = false; clearTimeout(timerRef.current); };
    }, []);

    // Foco después de cada cambio de paso o acción, como rvPintar(entra, foco).
    useLayoutEffect(() => {
        if (!s.focoN) return;
        const c = cuerpoRef.current, root = rootRef.current;
        if (!c || !root) return;
        let el = null;
        if (s.foco === 'entra') {
            c.scrollTop = 0;
            el = c.querySelector('[data-rv="in"],[data-rv="busca"]') || c.querySelector('.rv-op[aria-checked="true"],.rv-op[aria-selected="true"]')
                || c.querySelector('.rv-op,.rv-dia[aria-pressed="true"],.rv-seguir');
        } else if (s.foco) el = root.querySelector(s.foco);
        if (el) el.focus({ preventScroll: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [s.focoN]);

    // Link público: el que no califica queda registrado (sin horario) para contarlo después. Una sola vez.
    // Si una regla lo manda a otra página, se lo lleva ahí después de registrarlo (o a los 3 s, si tarda).
    useEffect(() => {
        if (modo !== 'publico' || !s.fin || descRef.current || !ctx.evento) return;
        descRef.current = true;
        // Si una regla lo manda a otra página, se lo lleva ahí después de registrarlo (o a los 3 s, si tarda).
        const url = s.finUrl;
        let ido = false;
        const ir = () => { if (url && !ido && vivoRef.current) { ido = true; window.location.assign(url); } };
        if (url) setTimeout(ir, 3000);
        try {
            Promise.resolve(proveedor.reservar({ lead: { preguntas, resp: s.resp, pais: s.pais, tz: s.tz }, ctx: ctxAsig(s), evento: ctx.evento, form: ctx.form, asig: null, slot: null, origen, setter, datosGuardados: s.guardados, respuestasGuardadas: s.usaPrevias === true }))
                .catch(() => { /* no frena al lead */ }).then(ir);
        } catch { ir(); /* no frena al lead */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [s.fin]);

    // Link público: desde que dejó sus datos, cada paso queda registrado (Stats ve dónde se caen).
    // Cuenta el paso al que llegó; el que agenda o no califica lo cierra el servidor al reservar.
    const nContacto = preguntas.filter(q => q.id.startsWith('c-')).length;
    useEffect(() => {
        if (modo !== 'publico' || typeof proveedor.avance !== 'function' || !ctx.evento || s.fin || s.listo || s.reco || s.buscando) return;
        // Sin correo (escrito o guardado) no hay a quién seguir (el servidor tampoco lo registraría).
        if ((idx < nContacto && !s.guardados) || (!s.resp['c-email'] && !s.guardados)) return;
        proveedor.avance({ evento: ctx.evento, resp: s.resp, pais: s.pais, origen, enCalendario: idx >= n, datosGuardados: s.guardados, respuestasGuardadas: s.usaPrevias === true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idx, s.reco, s.buscando, s.usaPrevias]);

    // El lead dejó su WhatsApp o su correo: ¿ya agendó antes? Si no (o si falla la búsqueda), sigue como siempre.
    useEffect(() => {
        if (!s.buscando) return undefined;
        const n0 = s.recoN, seguir = (p) => conFoco({ ...p, buscando: '', idx: p.idx + 1, busca: '' }, 'entra');
        const por = s.buscando, valor = s.resp[por];
        const quien = por === 'c-email' ? { email: valor } : { telefono: valor, pais: s.pais };
        let vivo = true;
        Promise.resolve().then(() => proveedor.conocido({ evento: ctx.evento, form: ctx.form, ...quien })).then((r) => {
            if (!vivo || !vivoRef.current) return;
            setS(p => {
                if (p.recoN !== n0 || !p.buscando) return p;
                if (!r || !r.conocido) return seguir(p);
                const visto = { ...p, visto: por };
                if (!r.proxima) return usarGuardados(visto, r, preguntas);
                return conFoco({ ...visto, buscando: '', reco: r }, 'entra');
            });
        }, () => { if (vivo && vivoRef.current) setS(p => (p.recoN === n0 && p.buscando ? seguir(p) : p)); });
        return () => { vivo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [s.recoN]);

    // Clic afuera cierra el selector de país o de zona.
    useEffect(() => {
        if (!s.paisAbierto && !s.zonaAbierta) return undefined;
        const fn = (e) => {
            const t = e.target;
            if (t.closest && t.closest('.rv-pais-caja,.rv-tzbar') && rootRef.current && rootRef.current.contains(t)) return;
            setS(p => ({ ...p, paisAbierto: false, zonaAbierta: false }));
        };
        document.addEventListener('click', fn);
        return () => document.removeEventListener('click', fn);
    }, [s.paisAbierto, s.zonaAbierta]);

    const limpiarEnvio = () => setEnvio(x => (x.error || x.yaTiene ? { ...x, error: '', yaTiene: null } : x));

    const acc = {
        escribir(v) {
            setS(p => {
                const q = preguntas[p.idx];
                if (!q) return p;
                const r = { ...p, resp: { ...p.resp, [q.id]: v }, error: '' };
                if (q.tipo === 'telefono') r.tel = v;
                return r;
            });
        },
        elegirOp(id) {
            const i = sRef.current.idx, vuelta = sRef.current.vuelta;
            setS(p => {
                const q = preguntas[p.idx];
                return q ? { ...p, resp: { ...p.resp, [q.id]: id }, error: '' } : p;
            });
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setS(p => (p.vuelta === vuelta && p.idx === i && !p.fin && !p.listo ? seguirDe(p, preguntas, reconocer, ctx) : p));
            }, AUTO_AVANCE);
        },
        buscar(v) { setS(p => ({ ...p, busca: v })); },
        seguir() { setS(p => seguirDe(p, preguntas, reconocer, ctx)); },
        // El lead que vuelve con una sesión próxima: la reprograma o suma otra.
        elegirProxima(v) { setS(p => (p.reco ? usarGuardados({ ...p, siYaTiene: v }, p.reco, preguntas) : p)); },
        // Ya respondió este formulario: true confirma sus respuestas, false las responde de nuevo.
        elegirPrevias(si) { setS(p => elegirPrevias(p, si, preguntas, ctx)); },
        atras() { setS(p => atrasDe(p, preguntas)); },
        alternarPais() {
            setS(p => conFoco({ ...p, paisAbierto: !p.paisAbierto }, p.paisAbierto ? '.rv-pais' : '.rv-pais-op[aria-selected="true"]'));
        },
        elegirPais(c) {
            setS(p => {
                const pz = paisDe(c);
                // «Otro país» no tiene zonas propias: queda la que tenía.
                const tz = !ctx.tzFija && pz.z.length && !pz.z.some(z => z[0] === p.tz) ? pz.z[0][0] : p.tz;
                return conFoco({ ...p, pais: c, tz, paisAbierto: false, dia: null, mes: null, hora: null }, '[data-rv="in"]');
            });
        },
        elegirZonaSelect(tz) { setS(p => conFoco({ ...p, tz, dia: null, mes: null, hora: null }, '.rv-zona select')); },
        alternarZona() {
            setS(p => conFoco({ ...p, zonaAbierta: !p.zonaAbierta }, p.zonaAbierta ? '.rv-tzbar .rv-link' : '.rv-zpop [aria-selected="true"]'));
        },
        elegirTz(tz) { limpiarEnvio(); setS(p => conFoco({ ...p, tz, zonaAbierta: false, dia: null, mes: null, hora: null }, '.rv-tzbar .rv-link')); },
        cambiarMes(mes, dlt) {
            const [y, m] = mes.split('-').map(Number), dm = new Date(Date.UTC(y, m - 1 + dlt, 1));
            const nuevo = dm.getUTCFullYear() + '-' + String(dm.getUTCMonth() + 1).padStart(2, '0');
            setS(p => conFoco({ ...p, mes: nuevo, dia: null, hora: null }, '[data-mes="' + dlt + '"]:not(:disabled)'));
        },
        elegirDia(k) { limpiarEnvio(); setS(p => conFoco({ ...p, dia: k, hora: null }, '.rv-dia[data-k="' + k + '"]')); },
        elegirHora(t) { limpiarEnvio(); setS(p => conFoco({ ...p, hora: t }, '[data-rv="confirmar"]')); },
        reintentarHorarios() { setS(p => ({ ...p, recalc: p.recalc + 1 })); },
        // siYaTiene: la respuesta del lead que ya tenía otra agenda ('reprogramar' | 'adicional').
        confirmar(hora, siYaTiene) {
            const asig = asigViva, slot = asig && asig.slots.find(x => x.t === hora);
            if (!slot) return;
            const per = slot.p ? buscar(d, 'personas', slot.p) : null;
            const delSlot = per ? { nombre: per.nombre, color: per.color } : null;
            if (prueba) { setS(p => conFoco({ ...p, listo: true, slot, asigFinal: asig, consultor: delSlot, invitacion: p.resp['c-email'] || '' }, 'entra')); return; }
            if (envio.enviando) return;
            setEnvio(x => ({ ...x, enviando: true, error: '', yaTiene: null }));
            const p = sRef.current;
            let envioP;
            try {
                envioP = proveedor.reservar({ lead: { preguntas, resp: p.resp, pais: p.pais, tz: p.tz }, ctx: ctxAsig(p), evento: ctx.evento, form: ctx.form, asig, slot, origen, setter,
                    siYaTiene: siYaTiene || p.siYaTiene || undefined, datosGuardados: p.guardados, respuestasGuardadas: p.usaPrevias === true });
            } catch (e) { envioP = Promise.reject(e); }
            envioP.then((r) => {
                if (!vivoRef.current) return;
                const consultor = (r && r.reserva && r.reserva.consultor) || delSlot;
                setEnvio(x => ({ ...x, enviando: false, error: '' }));
                const rr = (r && r.reserva) || r || {};
                const durReal = rr.duracion || rr.duracion_min || null;
                // El correo al que Google mandó la invitación al evento (vacío si no hubo evento o correo).
                const invitacion = (r && r.reserva && r.reserva.invitacion) || '';
                setS(q => conFoco({ ...q, listo: true, slot, asigFinal: asig, consultor, durReal, invitacion }, 'entra'));
            }, (e) => {
                if (!vivoRef.current) return;
                if (e && e.code === 'ya_tiene' && e.agenda) {
                    // No se agendó nada todavía: se le pregunta qué quiere hacer con la que ya tiene.
                    setEnvio(x => ({ ...x, enviando: false, yaTiene: { inicio: Date.parse(e.agenda.inicio), hora } }));
                } else if (e && e.code === 'ocupado') {
                    setEnvio(x => ({ enviando: false, error: MSG_OCUPADO, n: x.n + 1 }));
                    setS(q => ({ ...q, hora: null, recalc: q.recalc + 1 }));
                } else setEnvio(x => ({ enviando: false, error: e && e.code === 'limite' ? MSG_LIMITE : MSG_FALLO, n: x.n + 1 }));
            });
        },
        reiniciar() {
            if (onReiniciar) { onReiniciar(); return; }
            clearTimeout(timerRef.current);
            descRef.current = false;
            setEnvio({ enviando: false, error: '', n: 0 });
            setS(p => ({ ...estadoInicial(ctx), vuelta: p.vuelta + 1, foco: 'entra', focoN: p.focoN + 1 }));
        },
        salir: onSalir || null,
    };

    // Teclado: Enter sigue (Shift+Enter es salto en un párrafo), letras eligen, Escape cierra.
    const tecla = (e) => {
        const root = rootRef.current;
        if (!root) return;
        const t = e.target, dentro = root.contains(t), p = sRef.current, a = accRef.current;
        if (modo === 'embebida' && !dentro) return;
        if (e.key === 'Escape') {
            if (p.paisAbierto || p.zonaAbierta) {
                e.preventDefault();
                const era = p.paisAbierto;
                setS(x => conFoco({ ...x, paisAbierto: false, zonaAbierta: false }, era ? '.rv-pais' : '.rv-tzbar .rv-link'));
            } else if (modo === 'prueba' && onSalir) { e.preventDefault(); onSalir(); }
            return;
        }
        if (e.key === 'Tab') { if (modo === 'prueba') atrapar(e, root); return; }
        const q = preguntas[Math.min(p.idx, n)];
        const rv = t.dataset ? t.dataset.rv : '';
        if (e.key === 'Enter' && !e.isComposing) {
            if (rv === 'in' && (t.tagName !== 'TEXTAREA' || !e.shiftKey)) { e.preventDefault(); a.seguir(); return; }
            if (rv === 'busca' && q) {
                e.preventDefault();
                const vis = opcionesVisibles(q, p.busca);
                if (vis.length === 1) a.elegirOp(vis[0].id); else a.seguir();
                return;
            }
        }
        if (q && !p.listo && !p.fin && !ofrecePrevias(p, preguntas) && q.tipo === 'opciones' && /^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) {
            const o = q.opciones[e.key.toUpperCase().charCodeAt(0) - 65];
            if (o) { e.preventDefault(); a.elegirOp(o.id); }
        }
    };
    // Los manejadores de afuera (teclado, temporizadores) leen siempre lo último.
    useLayoutEffect(() => { sRef.current = s; accRef.current = acc; teclaRef.current = tecla; });
    useEffect(() => {
        const fn = (e) => teclaRef.current && teclaRef.current(e);
        document.addEventListener('keydown', fn);
        return () => document.removeEventListener('keydown', fn);
    }, []);

    const respuestas = prueba
        ? <Respuestas preguntas={preguntas} resp={s.resp} pais={s.pais} nombre={nombre} asig={s.listo ? s.asigFinal : null} slot={s.slot} d={d} />
        : null;

    let paso, clave;
    if (s.fin) {
        clave = 'fin';
        paso = <PasoFin ids={ids} fin={ctx.fin} nombre={nombre} prueba={prueba} respuestas={respuestas} acc={acc} url={s.finUrl} />;
    } else if (s.listo) {
        clave = 'listo';
        paso = <PasoListo ids={ids} nombre={nombre} slot={s.slot} s={s} dur={s.durReal || ctx.dur} redir={ctx.redir} preguntas={preguntas} prueba={prueba} respuestas={respuestas} acc={acc}
            consultor={s.consultor} invitacion={s.invitacion} tapados={s.guardados ? s.tapados : null} />;
    } else if (s.reco) {
        clave = 'reco';
        paso = <PasoConocido ids={ids} reco={s.reco} tz={s.tz} acc={acc} />;
    } else if (ofrecePrevias(s, preguntas)) {
        clave = 'previas';
        paso = <PasoPrevias ids={ids} nombre={nombre} acc={acc} />;
    } else if (idx < n) {
        const q = preguntas[idx];
        clave = 'q' + idx;
        paso = (
            <PasoPregunta q={q} s={s} ids={ids} titulo={personalizar(q.titulo, nombre) || 'Pregunta sin escribir'}
                ayuda={q.ayuda.trim() ? personalizar(q.ayuda, nombre) : ''} ultima={idx === n - 1} tzFija={ctx.tzFija} acc={acc} />
        );
    } else {
        clave = 'cal';
        paso = (
            <PasoCalendario s={s} asig={asigViva} nombre={nombre} ids={ids} dur={ctx.dur} tzFija={ctx.tzFija}
                aviso={prueba && asigViva ? asigViva.aviso : ''} envio={prueba ? null : envio} acc={acc}
                buscando={buscando} errorHorarios={errorHorarios} />
        );
    }

    const emb = modo === 'embebida', cel = modo === 'prueba' && prevModo === 'celular';
    const terminado = s.listo || s.fin, tot = n + 1, cur = terminado ? tot : idx;
    const puntos = [];
    for (let i = 0; i < tot; i++) puntos.push(<i key={i} className={i <= cur ? 'on' : undefined} />);

    return (
        <div ref={rootRef} className={'reserva' + (emb ? ' reserva--embebida' : cel ? ' reserva--cel' : '')}
            role={modo === 'prueba' ? 'dialog' : undefined} aria-modal={modo === 'prueba' ? true : undefined}
            aria-label={modo === 'prueba' ? 'Prueba de la agenda' : emb ? 'Vista previa interactiva' : undefined}>
            <Humo cols={HUMO_RV} />
            <header className="rv-top"><span className="rv-marca">Learnation</span><span className="rv-evento">{ctx.eyebrow}</span></header>
            <div className="rv-progreso" role="progressbar" aria-label="Avance" aria-valuemin={1} aria-valuemax={tot} aria-valuenow={Math.min(idx + 1, tot)}>{puntos}</div>
            <main className="rv-cuerpo" ref={cuerpoRef}><Fragment key={s.vuelta + '-' + clave}>{paso}</Fragment></main>
            <div className="rv-control">
                {prueba && <span className="rv-prueba"><Icono n="play" s={13} />Prueba<span className="rv-prueba-largo">&nbsp;· {fuente.etiqueta ? fuente.etiqueta + ' · ' : ''}no se agenda nada</span></span>}
                <div className="rv-nav">
                    <button type="button" className="rv-navbtn" aria-label="Anterior" disabled={(idx === 0 && !s.reco) || terminado} onClick={acc.atras}><Icono n="chevron-up" s={18} /></button>
                    <button type="button" className="rv-navbtn" aria-label="Siguiente" disabled={idx >= n || terminado || !!s.reco || !!s.buscando || ofrecePrevias(s, preguntas)} onClick={acc.seguir}><Icono n="chevron-down" s={18} /></button>
                    {emb && <button type="button" className="rv-salir" onClick={acc.reiniciar}><Icono n="rotar" s={16} /><span>Reiniciar</span></button>}
                    {modo === 'prueba' && onSalir && <button type="button" className="rv-salir" onClick={onSalir}><Icono n="x" s={16} /><span>Salir</span></button>}
                </div>
            </div>
        </div>
    );
}
