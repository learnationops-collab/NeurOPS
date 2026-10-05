// Caja para crear algo nuevo con solo un nombre. Sin nada creado todavía ocupa el centro (vacío).
// onCrear(nombre) devuelve un texto de error, o nada si creó. sug: contenido extra abajo (sugerencias).

import { useState } from 'react';
import { Humo, HUMO_MARCA, Icono } from '../../ui/base';

export default function Compo({ vacio, tit, soloTit, ph, onCrear, sug, id = 'nuevo-nombre', maxLength = 80 }) {
    const [valor, setValor] = useState('');
    const [err, setErr] = useState('');
    const enviar = (e) => {
        e.preventDefault();
        const r = onCrear(valor.replace(/\s+/g, ' ').trim());
        if (r) { setErr(r); return; }
        setErr('');
        setValor('');
        const i = e.currentTarget.querySelector('input');
        if (i && document.body.contains(i)) i.focus();
    };
    return (
        <section className={'compo caja' + (vacio ? ' compo--solo' : '')}>
            <Humo clase="humo--hero" cols={HUMO_MARCA} />
            <div className="compo-txt">
                <span className="compo-icono"><Icono n="plus" s={19} /></span>
                <div style={{ display: 'grid', gap: 4 }}><h2 className="t-h3">{vacio ? soloTit : tit}</h2></div>
            </div>
            <div className="compo-accion">
                <form className="entrada" noValidate onSubmit={enviar}>
                    <label className="sr" htmlFor={id}>{tit}</label>
                    <input id={id} type="text" maxLength={maxLength} autoComplete="off" placeholder={ph} value={valor}
                        aria-invalid={err ? true : undefined} aria-describedby={err ? id + '-err' : undefined}
                        onChange={e => { setValor(e.target.value); if (err) setErr(''); }} />
                    <button type="submit" className="btn btn--cta btn--sm"><Icono n="plus" />Crear</button>
                </form>
                {err && <p className="campo-err" id={id + '-err'} role="alert"><Icono n="alerta" s={14} /><span>{err}</span></p>}
                {sug}
            </div>
        </section>
    );
}
