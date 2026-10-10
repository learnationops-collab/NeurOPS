// «Mis eventos» del closer: sus propios links de agenda, siempre con él (persona fija, sin rotación).
// El formulario es opcional: sin formulario, el lead deja solo su nombre, WhatsApp y correo. Cada
// cambio se publica al guardar. La dirección comercial los ve en Agendamiento como cualquier evento;
// el closer ve solo los suyos (app/agendas_v2/servicio.py, eventos_de_closer).

import { useEffect, useState } from 'react';
import api from '../../../../services/api';
import { uid } from '../../core/util';
import { Icono, Switch, Sx } from '../../ui/base';
import { CampoMinutos } from '../team/Sesiones';

const urlDe = (link) => window.location.origin + '/agendas-v2' + link;
const SIN_FORM = '';

function Evento({ e, formularios, onCambio, onBorrar }) {
    const [nombre, setNombre] = useState(e.nombre);
    const [copiado, setCopiado] = useState(false);
    const [borrar, setBorrar] = useState(false);
    const copiar = async () => {
        try { await navigator.clipboard.writeText(urlDe(e.link)); setCopiado(true); setTimeout(() => setCopiado(false), 1600); } catch { /* sin portapapeles */ }
    };
    return (
        <article className="panel me-ev" data-id={e.id}>
            <div className="me-fila">
                <label className="sr" htmlFor={'me-n-' + e.id}>Nombre del evento</label>
                <input id={'me-n-' + e.id} className="input me-nom" maxLength={80} value={nombre} onChange={x => setNombre(x.target.value)}
                    onBlur={() => { const v = nombre.trim(); if (v && v !== e.nombre) onCambio({ nombre: v }); else setNombre(e.nombre); }} />
                <label className="me-activo">
                    <Switch on={e.activo} label={e.nombre + ' recibe agendas'} onChange={v => onCambio({ activo: v })} />
                    <span className="t-sm">{e.activo ? 'Recibe agendas' : 'Pausado'}</span>
                </label>
            </div>
            <div className="me-fila">
                <label className="ses-campo"><span>Sesión</span>
                    <CampoMinutos id={'me-dur-' + e.id} label="Duración" valor={e.duracion} onCambio={v => onCambio({ duracion: v })} />
                </label>
                <label className="ses-campo"><span>Margen</span>
                    <CampoMinutos margen id={'me-mar-' + e.id} label="Margen" valor={e.margen || 0} onCambio={v => onCambio({ margen: v })} />
                </label>
                <Sx sm label="Formulario" valor={formularios.some(f => f.id === e.formulario) ? e.formulario : SIN_FORM} onChange={v => onCambio({ formulario: v })}
                    opciones={[{ v: SIN_FORM, n: 'Sin formulario (solo contacto)', icono: 'user' }].concat(formularios.map(f => ({ v: f.id, n: f.nombre, icono: 'form' })))} />
            </div>
            <div className="me-fila">
                <span className="ev-link me-link"><Icono n="link" /><span className="trunc">{urlDe(e.link)}</span></span>
                <div className="barra-der">
                    <button type="button" className="btn btn--linea btn--sm" onClick={copiar}><Icono n={copiado ? 'check' : 'copiar'} />{copiado ? 'Copiado' : 'Copiar link'}</button>
                    {borrar ? (
                        <>
                            <button type="button" className="btn btn--linea btn--sm" onClick={() => setBorrar(false)}>Cancelar</button>
                            <button type="button" className="btn btn--borrar btn--sm" onClick={onBorrar}><Icono n="basura" />Eliminar</button>
                        </>
                    ) : (
                        <button type="button" className="ibtn ibtn--sm ibtn--peligro" aria-label={'Eliminar ' + e.nombre} title="Eliminar" onClick={() => setBorrar(true)}>
                            <Icono n="basura" s={15} />
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}

export default function MisEventos() {
    const [datos, setDatos] = useState(null); // {eventos, formularios}
    const [nuevo, setNuevo] = useState('');
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(false);

    useEffect(() => {
        api.get('/auth/me/eventos').then(r => setDatos(r.data)).catch(() => setError('No se pudieron leer tus eventos.'));
    }, []);
    const correr = async (fn) => {
        setOcupado(true); setError(null);
        try { await fn(); } catch (e) { setError(e?.response?.data?.message || 'Algo falló. Probá de nuevo.'); } finally { setOcupado(false); }
    };
    const reemplazar = (ev) => setDatos(d => ({ ...d, eventos: d.eventos.some(x => x.id === ev.id) ? d.eventos.map(x => (x.id === ev.id ? ev : x)) : [...d.eventos, ev] }));
    const guardar = (id, campos) => correr(async () => { reemplazar((await api.put('/auth/me/eventos/' + id, campos)).data.evento); });
    const crear = (e) => {
        e.preventDefault();
        const n = nuevo.replace(/\s+/g, ' ').trim();
        if (!n) return;
        guardar(uid('e'), { nombre: n, duracion: 45, formulario: SIN_FORM }).then(() => setNuevo(''));
    };
    const borrar = (id) => correr(async () => {
        await api.delete('/auth/me/eventos/' + id);
        setDatos(d => ({ ...d, eventos: d.eventos.filter(x => x.id !== id) }));
    });

    return (
        <section className="panel cu-tarjeta">
            <header className="cu-cab">
                <span className="icono-m"><Icono n="calendar" s={19} /></span>
                <div className="cu-tit">
                    <h3 className="t-h3">Mis eventos</h3>
                    <p className="t-sm mut">Tus propios links de agenda: el lead agenda directo con vos, en tu disponibilidad. El formulario es opcional.</p>
                </div>
            </header>
            {!datos ? <p className="t-sm mut">{error || 'Cargando…'}</p> : (
                <>
                    {datos.eventos.length ? (
                        <div className="lista">
                            {datos.eventos.map(e => (
                                <Evento key={e.id} e={e} formularios={datos.formularios} onCambio={c => guardar(e.id, c)} onBorrar={() => borrar(e.id)} />
                            ))}
                        </div>
                    ) : <p className="t-sm mut">Todavía no creaste eventos propios.</p>}
                    <form className="entrada" noValidate onSubmit={crear}>
                        <span className="prefijo"><Icono n="plus" /></span>
                        <label className="sr" htmlFor="me-nuevo">Nuevo evento</label>
                        <input id="me-nuevo" type="text" maxLength={80} autoComplete="off" placeholder="Nuevo evento, ej. Seguimiento" value={nuevo} onChange={e => setNuevo(e.target.value)} />
                        <button type="submit" className="btn btn--cta btn--sm" disabled={ocupado || !nuevo.trim()}>Crear</button>
                    </form>
                    {error && <p className="campo-err" role="alert"><Icono n="alerta" s={14} />{error}</p>}
                </>
            )}
        </section>
    );
}
