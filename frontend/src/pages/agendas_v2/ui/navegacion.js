// Navegación entre secciones de Thalamus.

import { almacen } from '../data/hooks';
import { ui } from './estadoUi';

// Ir a una sección. Volver a tocar la sección abierta cierra el formulario o evento abierto.
export function irA(id) {
    almacen.flush();
    const e = ui.getState();
    if (id === e.seccion) {
        if (id === 'preguntas' && e.form) ui.set({ form: null });
        else if (id === 'eventos' && e.ev) ui.set({ ev: null });
        return;
    }
    ui.set({ seccion: id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
