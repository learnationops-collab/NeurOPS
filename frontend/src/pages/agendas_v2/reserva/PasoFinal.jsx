// Pantallas de cierre del lead: "Listo" (sesión agendada) y el fin por no calificar.
// En prueba suman la vista del closer: nota, closer, prioridad y regla que decidió.

import { useState } from 'react';
import { CONTACTO, conOpciones, zonaInfo } from '../core/catalogos';
import { buscar } from '../core/datos';
import { calificar, personalizar } from '../core/formulario';
import { textoRespuesta } from '../core/reserva';
import { dtf, fechaTs, gmtTxt, horaTxt } from '../core/tiempo';
import { fmt, mayus } from '../core/util';
import { Avatar, Bandera, Icono } from '../ui/base';

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
            <summary>Vista del closer (solo prueba){nota != null && <span className="rv-nota">{fmt(nota, 1)} / 10</span>}</summary>
            {asig && (
                <div className="rv-asig">
                    <Icono n="users" s={16} />
                    <span>
                        <b>{per ? per.nombre : 'Sin closer'}</b>
                        {asig.grupo ? ' · ' + asig.grupo.nombre : ''} · {asig.regla}
                        {asig.desborde ? ' · Pasó a la siguiente estrategia por falta de lugar' : ''}
                    </span>
                </div>
            )}
            {filas}
        </details>
    );
}

// El cuadro de "¿Están bien tus datos?": los de contacto que dejó (o los guardados, tapados) y el horario.
// tapados: {nombre, telefono, instagram} del lead que vuelve y confirmó sus datos (no los volvió a escribir).
export function DatosLead({ preguntas, s, tapados, hora }) {
    const filas = CONTACTO.map(c => {
        const q = preguntas.find(x => x.id === 'c-' + c.k);
        if (!q) return null;
        const propio = textoRespuesta(q, s.resp[q.id], s.pais), guardado = tapados ? tapados[c.k] : '';
        const v = guardado && c.k !== 'email' ? guardado : propio;
        if (!v) return null;
        return (
            <div key={c.k} className="rv-dato">
                <span className="rv-dato-ico" aria-hidden="true"><Icono n={c.ico} s={17} /></span>
                <dt>{c.n}</dt><dd>{q.tipo === 'telefono' && !guardado && <Bandera c={s.pais} />}{v}</dd>
            </div>
        );
    }).filter(Boolean);
    if (hora != null) {
        filas.push(
            <div key="hora" className="rv-dato">
                <span className="rv-dato-ico" aria-hidden="true"><Icono n="clock" s={17} /></span>
                <dt>Horario</dt><dd>{fechaTs(hora, s.tz)} · {horaTxt(hora, s.tz)}<small>{mayus(zonaInfo(s.tz).largo)}</small></dd>
            </div>
        );
    }
    return <dl className="rv-dl">{filas}</dl>;
}

/**
 * Sesión agendada, como en Thalamus: arriba cuándo y con quién (el consultor), abajo los datos del lead.
 * "Es correcto" lleva a la redirección del evento si tiene una (ya no redirige solo); si no, despide.
 * consultor: {nombre, color} (en la prueba, la persona del horario elegido).
 */
export function PasoListo({ ids, nombre, slot, s, dur, redir, preguntas, prueba, respuestas, acc, consultor, tapados }) {
    const [listo, setListo] = useState(false);
    const z = zonaInfo(s.tz), t = slot.t;
    if (listo) {
        const dia = dtf(s.tz, { weekday: 'long' }, 'es').format(t);
        return (
            <div className="rv-paso rv-paso--entra rv-chau">
                <span className="rv-listo-ico"><Icono n="check" s={30} /></span>
                <h1 className="rv-q rv-q--l1" id={ids.q}>{'Nos vemos el ' + dia + (nombre ? ', ' + nombre : '') + '.'}</h1>
                <p className="rv-ayuda">
                    {redir
                        ? <>Te llevamos al siguiente paso. Si no se abrió, <a className="rv-link" href={redir} target="_blank" rel="noopener noreferrer">abrilo acá</a>.</>
                        : 'Tu consultor te escribe por WhatsApp. Ya podés cerrar esta página.'}
                </p>
                {respuestas}
                {prueba && <Acciones acc={acc} />}
            </div>
        );
    }
    const mes = dtf(s.tz, { month: 'short' }, 'es').format(t).replace('.', ''), dnum = dtf(s.tz, { day: 'numeric' }, 'es').format(t);
    const esCorrecto = () => { setListo(true); if (redir && !prueba) window.location.assign(redir); };
    return (
        <div className="rv-paso rv-ok rv-paso--entra">
            <div className="rv-ok-a">
                <p className="rv-ok-eyebrow"><span className="rv-ok-punto" aria-hidden="true"><Icono n="check" s={14} /></span>Sesión agendada</p>
                <h1 className="rv-q rv-q--l1" id={ids.q}>{nombre ? 'Listo, ' + nombre + '. Tu sesión quedó agendada.' : 'Listo. Tu sesión quedó agendada.'}</h1>
                <section className="rv-ticket" aria-label="Tu sesión">
                    <div className="rv-tk-cuando">
                        <span className="rv-tk-dia" aria-hidden="true"><small>{mes}</small><b>{dnum}</b></span>
                        <div className="rv-tk-txt">
                            <p className="rv-tk-fecha">{fechaTs(t, s.tz)}</p>
                            <p className="rv-tk-hora"><b>{horaTxt(t, s.tz)} – {horaTxt(t + dur * 60000, s.tz)}</b><span>{mayus(z.largo)} · {gmtTxt(s.tz)}</span></p>
                        </div>
                    </div>
                    <div className="rv-tk-corte" aria-hidden="true" />
                    <div className="rv-tk-quien">
                        {consultor
                            ? <Avatar p={consultor} clase="rv-av" foto={false} />
                            : <span className="avatar rv-av" aria-hidden="true" style={{ '--c': 'var(--rv-acento)' }}><Icono n="user" s={20} /></span>}
                        <div><span className="rv-tk-lbl">Tu consultor</span><b className="rv-tk-nom">{consultor ? consultor.nombre : 'Te lo asignamos en breve'}</b></div>
                    </div>
                    <p className="rv-tk-wa"><Icono n="whatsapp" s={18} /><span>Te va a escribir por WhatsApp antes de la sesión.</span></p>
                </section>
            </div>
            <div className="rv-ok-b">
                <section className="rv-datos" aria-labelledby={ids.q + '-datos'}>
                    <header className="rv-datos-cab"><h2 id={ids.q + '-datos'}>¿Están bien tus datos?</h2><p>Con estos te contacta tu consultor.</p></header>
                    <DatosLead preguntas={preguntas} s={s} tapados={tapados} hora={t} />
                </section>
                <div className="rv-acc rv-acc--ok">
                    {redir && prueba
                        ? <a className="rv-seguir" href={redir} target="_blank" rel="noopener noreferrer" onClick={() => setListo(true)}>Es correcto<Icono n="check" s={18} /></a>
                        : <button type="button" className="rv-seguir" onClick={esCorrecto}>Es correcto<Icono n="check" s={18} /></button>}
                </div>
                {respuestas}
                {prueba && <Acciones acc={acc} />}
            </div>
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
