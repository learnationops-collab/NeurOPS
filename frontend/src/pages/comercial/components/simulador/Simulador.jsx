import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { EsqueletoPanel, FalloCarga } from '../Shared';
import Proyeccion from './Proyeccion';
import Simulacion from './Simulacion';
import useSimulador from './useSimulador';
import './simulador.css';

/**
 * Simulador (sección del dock, solo la dirección comercial; 24/10/2026), en dos pestañas:
 * **Proyección** (cómo cierran los datos si todo se mantiene) y **Simulación** (mover palancas
 * sobre esa proyección). El estado vive acá y no en cada pestaña, así cambiar de una a otra no
 * borra lo elegido ni las palancas. Las cuentas están en `modelo.js`; los datos, en
 * `GET /comercial/simulador/base`.
 */
const Simulador = ({ permitido, tab = 'proyeccion', onTab = null }) => {
    const s = useSimulador(permitido);

    if (!permitido) {
        return (
            <section className="panel">
                <div className="vacio-grande">
                    <span className="vacio-icono"><SlidersHorizontal size={24} /></span>
                    <h2 className="t-h2">Sin acceso al Simulador</h2>
                    <p className="t-sm mut">El Simulador es de la dirección comercial.</p>
                </div>
            </section>
        );
    }
    if (s.falla) return <FalloCarga texto="No se pudo cargar el Simulador" onReintentar={s.cargar} />;
    if (!s.base) return <EsqueletoPanel rotulo="Cargando el Simulador…" lineas={8} />;

    if (tab === 'simulacion') {
        if (!s.actual) {
            return (
                <section className="panel">
                    <div className="vacio-grande">
                        <h2 className="t-h2">Todavía no hay datos para simular</h2>
                        <p className="t-sm mut">Hace falta al menos un día hábil cerrado en la línea base elegida.</p>
                    </div>
                </section>
            );
        }
        return <Simulacion s={s} onTab={onTab} />;
    }
    return <Proyeccion s={s} />;
};

export default Simulador;
