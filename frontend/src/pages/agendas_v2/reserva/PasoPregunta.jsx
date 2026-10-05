// Un paso del formulario en la pantalla del lead: la pregunta, su campo y el botón para seguir.
// Mismo marcado y clases que el prototipo (rvPreguntaHTML / rvTelHTML / rvOp).

import { PAISES, paisDe, tipo, zonaInfo } from '../core/catalogos';
import { gmtTxt } from '../core/tiempo';
import { letra, mayus } from '../core/util';
import { AreaAuto, Bandera, Icono } from '../ui/base';

// Opciones de una lista que coinciden con lo que el lead escribió en el buscador.
export function opcionesVisibles(q, busca) {
    const term = String(busca || '').trim().toLowerCase();
    return q.opciones.filter(o => !term || o.texto.toLowerCase().includes(term));
}

function Opcion({ o, j, val, rol, oculta, onElegir }) {
    const marcada = o.id === val;
    return (
        <button type="button" className="rv-op" role={rol} data-op={o.id} hidden={oculta}
            aria-checked={rol === 'radio' ? marcada : undefined} aria-selected={rol === 'option' ? marcada : undefined}
            onClick={() => onElegir(o.id)}>
            <kbd>{letra(j)}</kbd><span>{o.texto}</span><Icono n="check" s={18} />
        </button>
    );
}

function Telefono({ s, ids, tzFija, acc }) {
    const p = paisDe(s.pais), z = zonaInfo(s.tz);
    return (
        <>
            <div className="rv-tel">
                <div className="rv-pais-caja">
                    <button type="button" className="rv-pais" aria-haspopup="listbox" aria-expanded={s.paisAbierto} aria-label={'País: ' + p.n + ' ' + p.d}
                        onClick={acc.alternarPais}>
                        <Bandera c={p.c} /><b>{p.c}</b><span>{p.d}</span><Icono n="chevron-down" s={16} />
                    </button>
                    {s.paisAbierto && (
                        <div className="rv-paises" role="listbox" aria-label="País">
                            {PAISES.map(x => (
                                <button key={x.c} type="button" className="rv-pais-op" role="option" aria-selected={x.c === p.c} onClick={() => acc.elegirPais(x.c)}>
                                    <Bandera c={x.c} /><span>{x.n}</span><span>{x.d}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="rv-linea rv-linea--tel">
                    <input className="rv-input" data-rv="in" type="tel" inputMode="tel" autoComplete="tel-national" placeholder={p.ej}
                        value={s.tel} aria-labelledby={ids.q} onChange={e => acc.escribir(e.target.value)} />
                </div>
            </div>
            {tzFija ? (
                <div className="rv-zona"><Icono n="candado" s={16} /><span><b>{mayus(z.largo)}</b> · {gmtTxt(s.tz)}</span></div>
            ) : (
                <div className="rv-zona">
                    <Icono n="globo" s={16} />
                    {p.z.length > 1 ? (
                        <>
                            <label className="sr" htmlFor={ids.zsel}>Zona horaria</label>
                            <select id={ids.zsel} value={s.tz} onChange={e => acc.elegirZonaSelect(e.target.value)}>
                                {/* Si la zona actual no es de este país, el navegador muestra la primera. */}
                                {p.z.map(zz => <option key={zz[0]} value={zz[0]}>{mayus(zz[2])} · {gmtTxt(zz[0])}</option>)}
                            </select>
                        </>
                    ) : (
                        <span><b>{mayus(z.largo)}</b> · {gmtTxt(s.tz)}</span>
                    )}
                </div>
            )}
        </>
    );
}

/**
 * q: pregunta actual; s: estado de la pantalla; ultima: si es la última antes del calendario.
 * acc: {escribir, elegirOp, buscar, seguir, alternarPais, elegirPais, elegirZonaSelect}
 */
export default function PasoPregunta({ q, s, ids, titulo, ayuda, ultima, tzFija, acc }) {
    const val = s.resp[q.id] || '';
    const ph = q.placeholder || tipo(q.tipo).ph;
    const l = titulo.length;
    const tecla = q.tipo === 'parrafo' ? <>o apretá <b>Enter</b></>
        : q.tipo === 'opciones' ? <>o apretá la <b>letra</b></>
            : <>o apretá <b>Enter</b> <Icono n="enter" s={14} /></>;
    const visibles = q.tipo === 'lista' ? opcionesVisibles(q, s.busca).map(o => o.id) : null;

    let campo = null;
    if (q.tipo === 'texto' || q.tipo === 'email') {
        campo = (
            <div className="rv-linea">
                <input className="rv-input" data-rv="in" type={q.tipo === 'email' ? 'email' : 'text'}
                    autoComplete={q.tipo === 'email' ? 'email' : q.esNombre ? 'name' : 'off'} placeholder={ph}
                    value={val} aria-labelledby={ids.q} onChange={e => acc.escribir(e.target.value)} />
            </div>
        );
    } else if (q.tipo === 'parrafo') {
        campo = (
            <div className="rv-linea">
                <AreaAuto className="rv-input rv-area" data-rv="in" rows={2} placeholder={ph} value={val} aria-labelledby={ids.q}
                    onChange={e => acc.escribir(e.target.value)} />
            </div>
        );
    } else if (q.tipo === 'instagram') {
        campo = (
            <div className="rv-linea">
                <span className="rv-pre" aria-hidden="true">@</span>
                <input className="rv-input" data-rv="in" type="text" autoCapitalize="off" autoComplete="off" spellCheck="false" placeholder={ph}
                    value={val} aria-labelledby={ids.q} onChange={e => acc.escribir(e.target.value)} />
            </div>
        );
    } else if (q.tipo === 'telefono') {
        campo = <Telefono s={s} ids={ids} tzFija={tzFija} acc={acc} />;
    } else if (q.tipo === 'opciones') {
        campo = (
            <div className="rv-ops" role="radiogroup" aria-labelledby={ids.q}>
                {q.opciones.map((o, j) => <Opcion key={o.id} o={o} j={j} val={val} rol="radio" onElegir={acc.elegirOp} />)}
            </div>
        );
    } else if (q.tipo === 'lista') {
        campo = (
            <>
                <div className="rv-linea">
                    <input className="rv-input" data-rv="busca" type="text" autoComplete="off" placeholder={ph} value={s.busca}
                        aria-label="Buscar" aria-controls={ids.lista} onChange={e => acc.buscar(e.target.value)} />
                </div>
                <div className="rv-ops rv-ops--lista" id={ids.lista} role="listbox" aria-labelledby={ids.q}>
                    {q.opciones.map((o, j) => <Opcion key={o.id} o={o} j={j} val={val} rol="option" oculta={!visibles.includes(o.id)} onElegir={acc.elegirOp} />)}
                    <p className="rv-nada" hidden={visibles.length > 0}>Sin resultados.</p>
                </div>
            </>
        );
    }

    return (
        <div className="rv-paso rv-paso--entra">
            <h1 className={'rv-q' + (l > 100 ? ' rv-q--l2' : l > 56 ? ' rv-q--l1' : '')} id={ids.q}>{titulo}</h1>
            {ayuda && <p className="rv-ayuda">{ayuda}</p>}
            {campo}
            {/* La key cambia con cada error: el aviso se vuelve a montar y se sacude de nuevo. */}
            <p key={s.errN} className={'rv-err' + (s.errN ? ' rv-sacude' : '')} role="alert" hidden={!s.error}>
                <Icono n="alerta" s={16} /><span>{s.error}</span>
            </p>
            <div className="rv-acc">
                <button type="button" className="rv-seguir" onClick={acc.seguir}>{ultima ? 'Elegir horario' : 'Seguir'}<Icono n="check" s={18} /></button>
                <span className="rv-enter">{tecla}</span>
            </div>
        </div>
    );
}
