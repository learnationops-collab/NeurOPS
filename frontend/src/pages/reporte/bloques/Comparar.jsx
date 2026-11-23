// Bloque «comparar»: columnas lado a lado (1.ª/2.ª, Anuncios/Inbound). `corr` permite corregir las celdas.
import { useState } from 'react';
import Exp from '../Exp';
import { Cuenta, useLleno } from '../animar';
import { aNumero } from './comun';

function CeldaEditable({ celda, etiqueta, onCambio }) {
    const [txt, setTxt] = useState(celda.v == null ? '' : String(celda.v));
    return (
        <span className="rp-cmp__c">
            <input className="rp-cmp__in" inputMode="numeric" value={txt} aria-label={etiqueta}
                onChange={(e) => { setTxt(e.target.value); onCambio(aNumero(e.target.value)); }} />
        </span>
    );
}

export default function Comparar({ b, d = 0, fecha, editando, onEditar, onCorregir }) {
    const lleno = useLleno();
    const n = b.cols.length + (b.conv ? 1 : 0);
    const conMano = b.filas.some((f) => f.celdas.some((c) => c.mano));
    return (
        <>
            <h4>
                {b.tit}{conMano && <em className="rp-tag-m">a mano</em>}
                {b.corr && <button type="button" onClick={onCorregir}>{editando ? 'Listo' : 'Corregir'}</button>}
            </h4>
            <div className="rp-cmp" style={{ '--n': n }}>
                <span />
                {b.cols.map((c) => <span key={c} className="h">{c}</span>)}
                {b.conv && <span className="h">Resp.</span>}
                {b.filas.map((f, fi) => {
                    const max = Math.max(1, ...f.celdas.map((c) => c.v || 0));
                    const [a, r] = f.celdas;
                    const pct = b.conv && a?.v && r?.v != null ? Math.round(r.v / a.v * 100) : null;
                    return [
                        <span key={`l${fi}`} className="l">{f.l}</span>,
                        ...f.celdas.map((c, ci) => (editando && !c.mano
                            ? <CeldaEditable key={`${fi}-${ci}`} celda={c} etiqueta={`${f.l} ${b.cols[ci]}`}
                                onCambio={(v) => onEditar({ correcciones: { [c.clave]: v } })} />
                            : (
                                <Exp key={`${fi}-${ci}`} as="span" className="rp-cmp__c"
                                    dato={{ clave: c.clave, l: `${f.l} · ${b.cols[ci]}`, v: c.v, mano: c.mano, corr: b.corr, bloque: b.tit, fecha }}>
                                    <b><Cuenta v={c.v} delay={fi * 40} /></b>
                                    <span className="mini"><i style={{ width: lleno && c.v ? `${(c.v / max * 100).toFixed(0)}%` : 0, transitionDelay: `${d + 200 + fi * 60}ms` }} /></span>
                                </Exp>
                            ))),
                        b.conv && (
                            <Exp key={`p${fi}`} as="span" className="rp-cmp__c pct"
                                dato={{ clave: f.clave_conv || r?.clave, l: `${f.l} · respuesta`, v: pct, f: '%', mano: true, fecha }}>
                                {pct == null ? '—' : `${pct}%`}
                            </Exp>
                        ),
                    ];
                })}
            </div>
        </>
    );
}
