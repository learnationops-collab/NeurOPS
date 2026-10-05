// Simulador de roles. Sin simulación todo está permitido: los permisos reales los va a aplicar el
// servidor (director_comercial). Esto solo muestra qué vería y podría hacer cada rol.

import { buscar, esCloser, ord } from './datos';

export const SEC_PERM = { preguntas: 'forms.ver', team: 'team.ver', eventos: 'events.ver', estadisticas: 'stats.ver' };
const SIN_ROL = { nombre: 'Sin rol', accesos: [], atiende: false };

// sim: null | {tipo: 'rol'|'persona', id}
export function rolSim(d, sim) {
    if (!sim) return null;
    if (sim.tipo === 'rol') return buscar(d, 'roles', sim.id) || SIN_ROL;
    const p = buscar(d, 'personas', sim.id);
    return (p && buscar(d, 'roles', p.rol)) || SIN_ROL;
}
export function nombreSim(d, sim) {
    if (!sim) return '';
    if (sim.tipo === 'rol') return rolSim(d, sim).nombre;
    const p = buscar(d, 'personas', sim.id);
    return p ? p.nombre : '';
}
// La persona de Team que es "uno mismo": la simulada, o la que se vinculó en el perfil.
export function yoPersona(d, sim, perfil) {
    if (sim) return sim.tipo === 'persona' ? buscar(d, 'personas', sim.id) || null : ord(d, 'personas').find(p => p.rol === sim.id) || null;
    return buscar(d, 'personas', perfil && perfil.persona) || null;
}
export function puede(d, sim, k) { return !sim || rolSim(d, sim).accesos.includes(k); }
export function horasOk(d, sim, perfil) { const yo = yoPersona(d, sim, perfil); return !!(yo && esCloser(d, yo)); }
export function secOk(d, sim, perfil, id) { return id === 'horas' ? horasOk(d, sim, perfil) : puede(d, sim, SEC_PERM[id]); }
export function tabConfOk(d, sim, t) {
    if (t === 'perfil') return true;
    if (t === 'miembros' || t === 'roles' || t === 'accesos') return puede(d, sim, 'conf.miembros');
    if (t === 'funnels' || t === 'ia') return puede(d, sim, 'conf.funnels');
    if (t === 'integraciones') return puede(d, sim, 'conf.integraciones');
    return true;
}
export function puedeHorarioDe(d, sim, perfil, p) {
    if (!sim) return true;
    const yo = yoPersona(d, sim, perfil);
    return puede(d, sim, 'team.horarios') || !!(yo && p && yo.id === p.id);
}
// Vista de closer: al simular a alguien que atiende llamadas y no maneja el equipo. Ve solo lo suyo.
export function modoCloser(d, sim, perfil) {
    const yo = yoPersona(d, sim, perfil);
    return sim && yo && esCloser(d, yo) && !puede(d, sim, 'team.horarios') ? yo : null;
}
export function confVisible(d, sim) { return !sim || ['conf.miembros', 'conf.funnels', 'conf.integraciones'].some(k => puede(d, sim, k)); }

// ¿La pantalla actual es de solo lectura para el rol simulado?
// ui: {seccion, formVista ('preguntas'|'ruteo'|'previa'|null), teamTab}
export function soloLectura(d, sim, perfil, ui) {
    if (!sim) return false;
    if (ui.seccion === 'preguntas') {
        if (ui.formVista === 'ruteo') return !puede(d, sim, 'forms.ruteo');
        if (ui.formVista === 'previa') return false;
        return !puede(d, sim, 'forms.editar');
    }
    if (ui.seccion === 'team') return ui.teamTab === 'grupos' ? !puede(d, sim, 'team.prioridades') : !puede(d, sim, 'team.horarios');
    if (ui.seccion === 'eventos') return modoCloser(d, sim, perfil) ? false : !puede(d, sim, 'events.editar');
    return false;
}
