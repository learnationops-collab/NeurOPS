// Pantallas de cierre del lead: "Listo" (llamada agendada) y el fin por no calificar.
// En prueba suman "Lo que recibe el closer": nota, closer, prioridad y regla que decidió.

import { conOpciones, zonaInfo } from '../core/catalogos';
import { buscar } from '../core/datos';
import { calificar, personalizar } from '../core/formulario';
import { textoRespuesta } from '../core/reserva';
import { fechaTs, horaTxt } from '../core/tiempo';
import { fmt } from '../core/util';
import { Icono, MeetLogo } from '../ui/base';

export function Respuestas({ preguntas, resp, pais, nombre, asig, slot, d }) {
    const filas = preguntas.map(q => {
        const t = textoRespuesta(q, resp[q.id], pais);
        if (!t) return null;
        const o = conOpciones(q.tipo) && q.opciones.find(x => x.id === resp[q.id]);
        const pts = o ? (o.descalifica ? <em className="no">No califica</em> : q.peso && o.puntos != null ? <em>{o.puntos} ×{q.peso}</em> : null) : null;
        return <div key={q.id} className="rv-resp"><span>{personalizar(q.titulo, nombre)}</span><b>{t}</b>{pts}</div>;
    }).filter(Boolean);
    const nota = calificar(preguntas, resp);
    const per = slot && slot.p ? buscar(d, 'personas', slot.p) : null;
    return (
        <details className="rv-resps" open>
            <summary>Lo que recibe el closer{nota != null && <span className="rv-nota">{fmt(nota, 1)} / 10</span>}</summary>
            {asig && (
                <div className="rv-asig">
                    <Icono n="users" s={16} />
                    <span>
                        <b>{per ? per.nombre : 'Sin closer'}</b>
                        {asig.grupo ? ' · ' + asig.grupo.nombre : ''} · {asig.regla}
                        {asig.desborde ? ' · Pasó a la siguiente prioridad por falta de lugar' : ''}
                    </span>
                </div>
            )}
            {filas}
        </details>
    );
}

/**
 * Llamada agendada. prueba: muestra lo que recibe el closer y "Probar de nuevo".
 * En el link público, si el evento tiene redirección, avisa que lo lleva ahí en unos segundos.
 */
export function PasoListo({ ids, nombre, slot, s, dur, redir, preguntas, prueba, respuestas, acc }) {
    const z = zonaInfo(s.tz), tel = preguntas.find(q => q.tipo === 'telefono');
    const t = slot.t;
    return (
        <div className="rv-paso rv-paso--entra">
            <span className="rv-listo-ico"><Icono n="check" s={30} /></span>
            <h1 className="rv-q rv-q--l1" id={ids.q}>{nombre ? 'Listo, ' + nombre + '. Tu llamada quedó agendada.' : 'Listo. Tu llamada quedó agendada.'}</h1>
            <div className="rv-detalle">
                <div><Icono n="calendar" /><span><b>{fechaTs(t, s.tz)}</b>{horaTxt(t, s.tz)} a {horaTxt(t + dur * 60000, s.tz)} · {z.largo}</span></div>
                <div><MeetLogo /><span>Google Meet · el link llega con la confirmación</span></div>
                {tel && s.resp[tel.id] && <div><Icono n="whatsapp" /><span>Te confirmamos por WhatsApp al {textoRespuesta(tel, s.resp[tel.id], s.pais)}</span></div>}
                {redir && (
                    <div>
                        <Icono n="link" />
                        <span>
                            {prueba ? 'Después va a ' : 'En unos segundos te llevamos a '}
                            <a href={redir} target={prueba ? '_blank' : undefined} rel="noopener noreferrer">{redir.replace(/^https:\/\//, '')}</a>
                        </span>
                    </div>
                )}
            </div>
            {respuestas}
            {prueba && <Acciones acc={acc} />}
        </div>
    );
}

export function PasoFin({ ids, fin, nombre, prueba, respuestas, acc }) {
    return (
        <div className="rv-paso rv-paso--entra">
            <span className="rv-listo-ico rv-listo-ico--no"><Icono n="prohibido" s={30} /></span>
            <h1 className="rv-q rv-q--l1" id={ids.q}>{personalizar(fin.titulo, nombre)}</h1>
            {fin.texto && <p className="rv-ayuda">{personalizar(fin.texto, nombre)}</p>}
            {respuestas}
            {prueba && <Acciones acc={acc} />}
        </div>
    );
}

function Acciones({ acc }) {
    return (
        <div className="rv-acc">
            <button type="button" className="rv-seguir" onClick={acc.reiniciar}>Probar de nuevo<Icono n="rotar" s={18} /></button>
            {acc.salir && <button type="button" className="rv-link" onClick={acc.salir}>Volver</button>}
        </div>
    );
}
