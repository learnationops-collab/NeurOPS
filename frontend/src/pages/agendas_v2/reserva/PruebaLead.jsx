// Prueba de la agenda a pantalla completa (ui.prueba): la pantalla del lead tal como la ve,
// con el cambio Computadora / Teléfono. No se agenda nada.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buscar } from '../core/datos';
import { useDatos, useUi } from '../data/hooks';
import { Icono } from '../ui/base';
import { ui } from '../ui/estadoUi';
import PantallaLead from './PantallaLead';
import { proveedorLocal } from './proveedores';

// ui.prueba acepta los documentos o sus ids.
function resolver(prueba, d) {
    const doc = (col, x) => (typeof x === 'string' ? buscar(d, col, x) || null : x || null);
    const evento = doc('eventos', prueba.evento);
    const form = doc('formularios', prueba.form) || (evento ? buscar(d, 'formularios', evento.formulario) || null : null);
    return { form, evento, persona: prueba.persona || null, desde: prueba.desde || 0, ejemplo: prueba.ejemplo || '' };
}

export default function PruebaLead() {
    const { prueba, prevModo } = useUi();
    const { d, reservas } = useDatos();
    // La prueba calcula en el navegador con los datos cargados y no agenda nada.
    const proveedor = useMemo(() => proveedorLocal(d, reservas), [d, reservas]);
    const fuente = useMemo(() => (prueba ? resolver(prueba, d) : null), [prueba, d]);
    const salir = useCallback(() => ui.set({ prueba: null }), []);

    // Lo que tenía el foco al abrir, tomado antes de que la pantalla del lead enfoque su primer campo.
    const [volver] = useState(() => document.activeElement);
    // Bloquea el scroll de la página y, al cerrar, devuelve el foco a lo que abrió la prueba.
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
            if (volver && volver !== document.body && document.body.contains(volver) && volver.focus) volver.focus({ preventScroll: true });
        };
    }, [volver]);

    if (!fuente) return null;
    const cel = prevModo === 'celular';
    const dispo = (v) => ui.set({ prevModo: v });
    return (
        <>
            <div className="rv-fondo" aria-hidden="true" />
            <PantallaLead fuente={fuente} proveedor={proveedor} modo="prueba" prevModo={prevModo} onSalir={salir} />
            <div className="seg seg--sm rv-dispo" role="group" aria-label="Pantalla">
                <button type="button" data-nav="" aria-pressed={!cel} onClick={() => dispo('escritorio')}><Icono n="monitor" />Computadora</button>
                <button type="button" data-nav="" aria-pressed={cel} onClick={() => dispo('celular')}><Icono n="celular" />Teléfono</button>
            </div>
        </>
    );
}
