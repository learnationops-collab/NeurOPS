import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, RotateCcw, X } from 'lucide-react';
import { subirACapa } from '../../../../../components/standard/capa';
import { cierreNum } from '../../lib/closers';
import { CIERRES, ESTADOS_ANTIGUOS, FILTRO_DEFAULT, QUITAR, cuantosActivos, cuantosQuita, pasa } from '../../lib/antiguos';

// El filtro de «Antiguos» (ADR-W277): qué estados entran, a quiénes sacar y desde qué % de cierre.
// Cada opción muestra cuántos suma o saca con el resto del filtro como está.

const Opcion = ({ on, label, nota, cuenta, punto, onClick }) => (
    <button type="button" className="tl-mitem tl-mitem--sm" role="menuitemcheckbox" aria-checked={on} onClick={onClick}>
        <span className="tl-check"><Check size={12} strokeWidth={3} /></span>
        {punto && <span className="punto" style={{ '--c': punto }} />}
        <span className="lbl">{label}{nota && <small>{nota}</small>}</span>
        <span className="val">{cuenta}</span>
    </button>
);

const MenuAntiguos = ({ ancla, filas, ctx, filtro, onCambiar, onCerrar }) => {
    const menu = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useLayoutEffect(() => {
        subirACapa(menu.current);
        const ubicar = () => {
            const b = ancla.current?.getBoundingClientRect();
            const w = menu.current?.offsetWidth || 340;
            if (!b) return;
            setPos({ top: b.bottom + 10, left: Math.max(16, Math.min(b.right - w, document.documentElement.clientWidth - w - 16)) });
        };
        ubicar();
        window.addEventListener('resize', ubicar);
        window.addEventListener('scroll', ubicar, true);
        return () => {
            window.removeEventListener('resize', ubicar);
            window.removeEventListener('scroll', ubicar, true);
        };
    }, [ancla]);

    useEffect(() => {
        const fuera = (e) => {
            if (menu.current?.contains(e.target) || ancla.current?.contains(e.target)) return;
            onCerrar();
        };
        const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); ancla.current?.focus(); } };
        document.addEventListener('pointerdown', fuera);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('pointerdown', fuera);
            document.removeEventListener('keydown', tecla);
        };
    }, [ancla, onCerrar]);

    const alternar = (campo, id) => {
        const lista = filtro[campo];
        onCambiar({ ...filtro, [campo]: lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id] });
    };
    const sinEstado = filas.filter((p) => pasa(p, filtro, ctx, 'estados'));
    const sinCierre = filas.filter((p) => pasa(p, filtro, ctx, 'cierre'));

    return createPortal(
        <div className="dc-shell talent tl-capa">
            <div ref={menu} className="tl-menu tl-menu--antiguos" role="menu" aria-label="Filtrar antiguos" style={pos}>
                <div className="tl-menu-cab">
                    <span className="tl-rotulo">Filtrar antiguos</span>
                    <button type="button" className="ibtn" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
                </div>

                <p className="tl-msub">Estado</p>
                {ESTADOS_ANTIGUOS.map((e) => (
                    <Opcion key={e.id} on={filtro.estados.includes(e.id)} label={e.label} punto={e.c}
                        cuenta={sinEstado.filter((p) => p.veredicto === e.id).length} onClick={() => alternar('estados', e.id)} />
                ))}
                <p className="tl-mnota">{filtro.estados.length ? 'Solo los estados marcados.' : 'Sin marcar ninguno, entran todos.'}</p>

                <div className="tl-msep" />
                <p className="tl-msub">Sacar a los que</p>
                {QUITAR.map((o) => (
                    <Opcion key={o.id} on={filtro.quitar.includes(o.id)} label={o.label} nota={o.nota}
                        cuenta={`−${cuantosQuita(filas.filter((p) => pasa(p, filtro, ctx, o.id)), o.id, ctx)}`}
                        onClick={() => alternar('quitar', o.id)} />
                ))}

                <div className="tl-msep" />
                <p className="tl-msub">Cierre mínimo</p>
                <div className="tl-mcierre" role="group" aria-label="Cierre mínimo">
                    {CIERRES.map((n) => (
                        <button key={n} type="button" aria-pressed={filtro.cierreMin === n} onClick={() => onCambiar({ ...filtro, cierreMin: n })}>
                            {n ? `${n}%+` : 'Todos'}
                            <span>{n ? sinCierre.filter((p) => (cierreNum(p.cierre) ?? -1) >= n).length : sinCierre.length}</span>
                        </button>
                    ))}
                </div>

                <div className="tl-mpie">
                    <button type="button" className="btn btn--sm btn--linea" disabled={!cuantosActivos(filtro)} onClick={() => onCambiar(FILTRO_DEFAULT)}>
                        <RotateCcw /> Quitar filtros
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default MenuAntiguos;
