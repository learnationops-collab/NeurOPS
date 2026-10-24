import React from 'react';
import { Calendar, SlidersHorizontal } from 'lucide-react';

const TEXTOS = {
    proyeccion: {
        Icono: Calendar, titulo: 'Proyección',
        texto: 'Cómo cierran los datos si todo se mantiene como hasta ahora. No hay nada movido.',
    },
    simulacion: {
        Icono: SlidersHorizontal, titulo: 'Simulación',
        texto: 'Movés palancas sobre la proyección y mirás cuánto cambia. No se guarda.',
    },
};

/** Lo primero que se lee de cada pestaña: en cuál de las dos estás, con su color. */
const BandaModo = ({ modo, children }) => {
    const { Icono, titulo, texto } = TEXTOS[modo];
    return (
        <div className="sim-modo" data-modo={modo}>
            <span className="sim-modo-ic" aria-hidden="true"><Icono size={18} /></span>
            <div className="sim-modo-t">
                <p className="t-eyebrow">{titulo}</p>
                <p className="t-cap mut">{texto}</p>
            </div>
            {children && <div className="sim-modo-der">{children}</div>}
        </div>
    );
};

export default BandaModo;
