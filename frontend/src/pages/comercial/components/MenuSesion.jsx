import { useContext, useEffect, useState } from 'react';
import { DockContexto } from './dockContexto';
import useOpcionesDeReporte from '../../../components/feedback/useOpcionesDeReporte';
import useOpcionesDeAvisos from '../../../components/avisos/useOpcionesDeAvisos';
import useOpcionesDeConflictos from '../../conflictos/useOpcionesDeConflictos';
import Mascota from '../../../components/mascota/Mascota';
import { mascotaDe } from '../../../components/mascota/mascotas';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * La sesión al final del dock: tu personaje. Desde el Dock 2.0 (ADR-W162, como «tu cara» de Leadership)
 * no abre un menú: abre Configuración directo. Todo lo demás —las acciones de la pantalla, Portal,
 * avisos, conflictos, reportes, volver a tu sesión y cerrar sesión— va a Herramientas
 * (`ventanas/BotonHerramientas.jsx`): este componente se lo pasa al dock que lo contiene por
 * `DockContexto.publicar`, cada opción con su `seccion` («acciones» o «cuenta»).
 *
 * `grupos` sale de `armarMenuSesion` (sesion/menuSesion.js): las acciones de la pantalla llevan `enDock`
 * (y las que crean algo, `nuevo`); la opción `configuracion` es la que corre el avatar, con su «!»
 * cuando falta configurar algo. El personaje se elige en Configuración › Datos.
 */
const MenuSesion = ({ nombre, rol, grupos }) => {
    const [toques, setToques] = useState(0);
    const auth = useAuth();
    const usuario = auth?.user;
    const personaje = mascotaDe(usuario, nombre);
    const dock = useContext(DockContexto);

    const avisos = useOpcionesDeAvisos();
    const reportes = useOpcionesDeReporte();
    const conflictos = useOpcionesDeConflictos();
    const todas = [...grupos.flat(), ...avisos.opciones, ...conflictos.opciones,
        ...reportes.opciones.map(({ accion, ...op }) => op)];
    const configuracion = todas.find(op => op.id === 'configuracion');
    // Configuración también se publica (seccion 'config'): la barra lateral la pone en la fila de la tarjeta.
    const opciones = todas
        .map(op => ({ ...op, seccion: op.id === 'configuracion' ? 'config' : op.enDock ? 'acciones' : 'cuenta' }));
    useEffect(() => { dock?.publicar(usuario, opciones); });

    const falta = configuracion?.cuenta;
    const etiqueta = [`Configuración de ${nombre}`, rol, configuracion?.titulo].filter(Boolean).join(', ');
    return (
        <button type="button" className="dock-sesion" aria-label={etiqueta} title={etiqueta}
            onClick={() => { setToques(t => t + 1); configuracion?.onClick?.(); }}>
            <Mascota personaje={personaje} size={50} toques={toques} />
            {falta && <span className="dock-sesion-aviso" aria-hidden="true">{falta}</span>}
        </button>
    );
};

export default MenuSesion;
