// Estado de la interfaz (qué sección, qué está abierto, simulación, tema). No se guarda en el
// almacén de datos: es de cada pantalla. Algunas preferencias se recuerdan en este navegador.

const PREFS = 'thalamus-ui';
function leerPrefs() { try { return JSON.parse(localStorage.getItem(PREFS) || '{}') || {}; } catch { return {}; } }
function guardarPrefs(e) {
    try { localStorage.setItem(PREFS, JSON.stringify({ seccion: e.seccion, tema: e.tema, prevModo: e.prevModo, confVis: e.confVis })); } catch { /* sin storage */ }
}

const p = leerPrefs();
let estado = {
    seccion: ['preguntas', 'team', 'horas', 'eventos', 'estadisticas'].includes(p.seccion) ? p.seccion : 'preguntas',
    tema: ['oscuro', 'claro', 'sistema'].includes(p.tema) ? p.tema : 'sistema',
    prevModo: p.prevModo === 'celular' ? 'celular' : 'escritorio',   // vista previa del lead
    confVis: p.confVis === 'completa' ? 'completa' : 'flotante',     // Configuración flotante o a pantalla completa
    sim: null,              // {tipo:'rol'|'persona', id}
    form: null,             // {id, vista:'preguntas'|'ruteo'|'previa'} formulario abierto en el editor
    ev: null,               // {id, tab:'config'|'flujo'} evento abierto
    team: { tab: 'personas', horario: null },  // horario: id de la persona con el modal de horario abierto
    funnel: null,           // modal del funnel: {id} para editarlo, {} para crear uno
    prueba: null,           // {evento?, form?, persona?} pantalla del lead a pantalla completa
    crear: false,           // menú de crear rápido
    menu: null,             // menú del perfil: 'main'|'rol'|'persona'
};
const subs = new Set();

export const ui = {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    getState() { return estado; },
    set(parcial) {
        estado = { ...estado, ...(typeof parcial === 'function' ? parcial(estado) : parcial) };
        guardarPrefs(estado);
        subs.forEach(fn => fn());
    },
};
