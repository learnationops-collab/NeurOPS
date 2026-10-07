// Pantalla de elección al entrar, con el formato de Learnation Marketing: la hora arriba a la izquierda,
// el isotipo, un saludo con el primer nombre y una tarjeta por opción. La usan el rol (en el login,
// si la persona tiene más de uno) y el área (/inicio, si el rol tiene más de una).

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Isotipo } from '../comercial/components/Shared';
import './login.css';

export function saludo(fecha = new Date()) {
    const h = fecha.getHours();
    return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

// "mario_bueller" → "Mario".
export function primerNombre(nombre) {
    const p = String(nombre || '').trim().split(/[\s._-]+/)[0] || '';
    return p ? p.charAt(0).toUpperCase() + p.slice(1) : '';
}

function Reloj() {
    const [ahora, setAhora] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setAhora(new Date()), 15000);
        return () => clearInterval(t);
    }, []);
    const hora = ahora.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const fecha = ahora.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    return (
        <div className="el-reloj" aria-hidden="true">
            <b>{hora}</b>
            <span>{fecha}</span>
        </div>
    );
}

/**
 * nombre: el de la cuenta. pregunta: el texto bajo el saludo.
 * opciones: [{ clave, titulo, detalle?, Icono, onElegir?, pronto? }]. Sin onElegir (o con pronto) queda
 * deshabilitada con «Pronto». eligiendo: la clave que está cargando. pie: lo que va debajo (el toggle).
 */
export default function Eleccion({ nombre, pregunta, opciones, eligiendo = null, error = null, pie = null }) {
    const n = primerNombre(nombre);
    return (
        <div className="lg lg--abierto el">
            <div className="lg-fondo" aria-hidden="true"><i /><i /><i /></div>
            <Reloj />
            <main className="el-centro">
                <span className="el-logo"><Isotipo idGrad="lnGradEleccion" /></span>
                <h1 className="el-hola">{saludo()}{n ? ', ' + n : ''}</h1>
                {pregunta && <p className="el-pregunta">{pregunta}</p>}
                <div className="el-tarjetas" role="group" aria-label={pregunta || 'Opciones'}>
                    {opciones.map((o, i) => {
                        const pronto = o.pronto || !o.onElegir;
                        return (
                            <button key={o.clave} type="button" className={'el-tarjeta' + (i === 0 && !pronto ? ' el-tarjeta--primera' : '')}
                                disabled={pronto || !!eligiendo} onClick={() => o.onElegir(o)}>
                                <span className="el-ico">{o.Icono && <o.Icono size={20} />}</span>
                                <span className="el-num">{pronto ? 'Pronto' : String(i + 1).padStart(2, '0')}</span>
                                <span className="el-txt">
                                    <b>{o.titulo}</b>
                                    {o.detalle && <em>{o.detalle}</em>}
                                </span>
                                {eligiendo === o.clave && <Loader2 size={18} className="lg-gira el-cargando" />}
                            </button>
                        );
                    })}
                </div>
                {error && <p className="lg-error" role="alert">{error}</p>}
                {pie}
            </main>
        </div>
    );
}
