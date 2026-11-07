import React, { useState } from 'react';
import EditorTasas from './EditorTasas';
import PanelComision from './PanelComision';
import { money, sum } from './modelo';
import { Titulo } from './piezas';

/**
 * Comisiones: quién cobra comisión en el período, cuánto y sobre qué cobros (cada persona se abre con
 * su detalle y su recibo PDF), y los porcentajes editables con «Guardar y aplicar».
 */
const VistaComisiones = ({ app, titulo, mes }) => {
    const [abierta, setAbierta] = useState(null);
    const conCom = (app.personas || []).filter((p) => p.clave && !p.fijo);
    const mx = Math.max(1, ...conCom.map((p) => p.com));
    const color = (p) => (p.a === 'ventas' ? 'var(--mag)' : 'var(--neu)');
    return (
        <>
            <Titulo num="02" texto="Comisiones" chip={money(sum(conCom, (p) => p.com))} />
            {!app.personas ? <section className="card"><div className="vacio">Cargando…</div></section> : (
                <section className="card">
                    <div className="head"><div><div className="eyebrow">Del período</div><h2>Quién cobra comisión</h2></div></div>
                    <div className="hb">
                        {conCom.map((p, i) => (
                            <div key={p.k} className="hbo">
                                <button type="button" className="hr hrb" style={{ '--c': color(p) }} aria-expanded={abierta === p.k}
                                    onClick={() => setAbierta(abierta === p.k ? null : p.k)}>
                                    <div><b>{p.n}</b><small>{p.rol}</small></div>
                                    <div className="tr"><i className="grow" style={{ width: `${(p.com / mx) * 100}%`, '--d': `${i * 0.08}s` }} /></div>
                                    <b>{money(p.com)}</b>
                                </button>
                                {abierta === p.k && <PanelComision p={p} payroll={app.payroll} titulo={titulo} editable={app.editable} onExcluir={app.excluir} />}
                            </div>
                        ))}
                    </div>
                </section>
            )}
            {mes ? <EditorTasas mes={mes} payroll={app.payroll} onGuardado={app.recargarComisiones} />
                : <section className="card"><div className="vacio">Elegí un mes para editar los porcentajes.</div></section>}
        </>
    );
};

export default VistaComisiones;
