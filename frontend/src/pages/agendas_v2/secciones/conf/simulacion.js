// Simulador de roles: entrar y salir. Al simular, la interfaz muestra solo lo que ese rol o esa
// persona puede ver y hacer. Los permisos reales los va a aplicar el servidor.

import { almacen } from '../../data/hooks';
import { ui } from '../../ui/estadoUi';
import { toast } from '../../ui/toast';
import { horasOk, nombreSim, secOk } from '../../core/permisos';

const SECCIONES_SIM = ['preguntas', 'team', 'eventos', 'estadisticas'];

// sim: {tipo:'rol'|'persona', id}. Cierra Configuración y lo abierto, y lleva a una sección permitida.
export function iniciarSim(sim) {
    almacen.flush();
    const { d, perfil } = almacen.getState();
    const e = ui.getState();
    const horas = horasOk(d, sim, perfil);
    let seccion = e.seccion;
    if (!secOk(d, sim, perfil, seccion) || (seccion !== 'horas' && horas)) {
        seccion = horas ? 'horas' : SECCIONES_SIM.find(s => secOk(d, sim, perfil, s)) || seccion;
    }
    ui.set({ sim, menu: null, conf: null, form: null, ev: null, prueba: null, seccion });
    toast(sim.tipo === 'persona' ? 'Simulando a ' + nombreSim(d, sim) : 'Simulando ' + nombreSim(d, sim));
}

export function salirSim() {
    const { d, perfil } = almacen.getState();
    const e = ui.getState();
    ui.set({ sim: null, menu: null, seccion: secOk(d, null, perfil, e.seccion) ? e.seccion : 'preguntas' });
    toast('Volviste a tu sesión');
}
