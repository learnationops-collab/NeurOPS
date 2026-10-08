import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Filter, Columns, ArrowDownWideNarrow, Rows, SlidersHorizontal, RotateCcw, ChevronRight, ChevronLeft, X, Check,
} from 'lucide-react';
import {
    COLS, ESENCIALES, ORDENES, AGRUPAR, PAISES, PIDE_TOPE, colsVisibles, esVistaDefault, filtrosActivos, vistaDefault,
} from '../lib/vista';
import { Bandera } from './Piezas';

// El menú «Vista» del botón del embudo: filtrar, columnas, ordenar y agrupar la
// tabla. Vive en un portal fijo (la cabecera lo recortaría) y se ubica debajo de
// su botón, pegado al borde derecho.

const Cab = ({ titulo, volver, onVolver, onCerrar }) => (
    <div className="tl-menu-cab">
        {volver
            ? <button type="button" className="tl-menu-volver" onClick={onVolver}><ChevronLeft size={16} />{titulo}</button>
            : <span className="tl-rotulo">{titulo}</span>}
        <button type="button" className="ibtn" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
    </div>
);

const Item = ({ icono: Icono, label, val, onClick, disabled }) => (
    <button type="button" className="tl-mitem" onClick={onClick} disabled={disabled}>
        <Icono size={17} />
        <span className="lbl">{label}</span>
        {val != null && <span className="val">{val}</span>}
        {val != null && <ChevronRight size={16} />}
    </button>
);

const Check1 = ({ on, label, onClick, extra, fija }) => (
    <button type="button" className="tl-mitem tl-mitem--sm" role="menuitemcheckbox" aria-checked={on} onClick={onClick} disabled={fija}>
        <span className="tl-check"><Check size={12} strokeWidth={3} /></span>
        {extra}
        <span className="lbl">{label}</span>
        {fija && <span className="val">Fija</span>}
    </button>
);

const Radio = ({ on, label, onClick }) => (
    <button type="button" className="tl-mitem tl-mitem--sm" role="menuitemradio" aria-checked={on} onClick={onClick}>
        <span className="tl-radio" />
        <span className="lbl">{label}</span>
    </button>
);

const pideTxt = (v) => (v ? `Hasta ${v} USD` : 'Sin límite');

const MenuVista = ({ ancla, cfg, onCambiar, onCerrar, onCriterios }) => {
    const [pagina, setPagina] = useState('main');
    const menu = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useLayoutEffect(() => {
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
    }, [ancla, pagina]);

    // Afuera o Escape lo cierra (el botón que lo abrió se encarga de su propio clic).
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

    const f = cfg.filtros;
    const setFiltros = (cambio) => onCambiar({ ...cfg, filtros: { ...f, ...cambio } });
    const volver = () => setPagina('main');
    const nf = filtrosActivos(cfg);
    const ord = ORDENES.find((o) => o.id === cfg.orden.campo) || ORDENES[0];
    const anchosPropios = Object.keys(cfg.anchos || {}).length > 0;

    let cuerpo;
    if (pagina === 'filtrar') {
        cuerpo = (
            <>
                <Cab titulo="Filtrar" volver onVolver={volver} onCerrar={onCerrar} />
                <p className="tl-msub">País</p>
                {PAISES.map((p) => (
                    <Check1 key={p} label={p} on={f.paises.includes(p)} extra={<Bandera de={p} />}
                        onClick={() => setFiltros({ paises: f.paises.includes(p) ? f.paises.filter((x) => x !== p) : [...f.paises, p] })} />
                ))}
                <div className="tl-msep" />
                <Check1 label="Solo con video verificado" on={f.soloVideo} onClick={() => setFiltros({ soloVideo: !f.soloVideo })} />
                <div className="tl-msep" />
                <div className="tl-mrango">
                    <span><label htmlFor="tl-f-score">Score mínimo</label><b>{f.scoreMin || 'Cualquiera'}</b></span>
                    <input className="slider" id="tl-f-score" type="range" min="0" max="95" step="5" value={f.scoreMin}
                        onChange={(e) => setFiltros({ scoreMin: Number(e.target.value) })} />
                </div>
                <div className="tl-mrango">
                    <span><label htmlFor="tl-f-pide">Lo que pide</label><b>{pideTxt(f.pideMax)}</b></span>
                    <input className="slider" id="tl-f-pide" type="range" min="200" max={PIDE_TOPE} step="10" value={f.pideMax || PIDE_TOPE}
                        onChange={(e) => { const v = Number(e.target.value); setFiltros({ pideMax: v >= PIDE_TOPE ? 0 : v }); }} />
                </div>
                <div className="tl-mpie">
                    <button type="button" className="btn btn--sm btn--linea" disabled={!nf}
                        onClick={() => onCambiar({ ...cfg, filtros: vistaDefault().filtros })}>
                        <X /> Quitar filtros
                    </button>
                </div>
            </>
        );
    } else if (pagina === 'columnas') {
        cuerpo = (
            <>
                <Cab titulo="Columnas" volver onVolver={volver} onCerrar={onCerrar} />
                {COLS.map((c) => (
                    <Check1 key={c.id} label={c.label} fija={c.fija} on={c.fija || cfg.cols.includes(c.id)}
                        onClick={() => onCambiar({
                            ...cfg,
                            cols: cfg.cols.includes(c.id) ? cfg.cols.filter((x) => x !== c.id) : COLS.map((x) => x.id).filter((id) => id === c.id || cfg.cols.includes(id)),
                        })} />
                ))}
                <div className="tl-mpie">
                    <button type="button" className="btn btn--sm btn--linea" onClick={() => onCambiar({ ...cfg, cols: COLS.map((c) => c.id) })}>Mostrar todas</button>
                    <button type="button" className="btn btn--sm btn--linea" onClick={() => onCambiar({ ...cfg, cols: ESENCIALES })}>Solo lo esencial</button>
                    <button type="button" className="btn btn--sm btn--linea" disabled={!anchosPropios} onClick={() => onCambiar({ ...cfg, anchos: {} })}>
                        <RotateCcw /> Anchos
                    </button>
                </div>
                <p className="tl-mnota">Para cambiar el ancho, arrastrá el borde derecho de cada encabezado (o enfocalo y usá las flechas).</p>
            </>
        );
    } else if (pagina === 'ordenar') {
        cuerpo = (
            <>
                <Cab titulo="Ordenar" volver onVolver={volver} onCerrar={onCerrar} />
                {ORDENES.map((o) => (
                    <Radio key={o.id} label={o.label} on={o.id === cfg.orden.campo}
                        onClick={() => onCambiar({ ...cfg, orden: { campo: o.id, dir: o.dir } })} />
                ))}
                <div className="tl-mpie">
                    <div className="seg" role="group" aria-label="Dirección">
                        {['desc', 'asc'].map((d) => (
                            <button key={d} type="button" aria-pressed={cfg.orden.dir === d}
                                onClick={() => onCambiar({ ...cfg, orden: { ...cfg.orden, dir: d } })}>
                                {ord.txt[d]}
                            </button>
                        ))}
                    </div>
                </div>
            </>
        );
    } else if (pagina === 'agrupar') {
        cuerpo = (
            <>
                <Cab titulo="Agrupar" volver onVolver={volver} onCerrar={onCerrar} />
                {AGRUPAR.map((a) => (
                    <Radio key={a.id} label={a.label} on={a.id === cfg.agrupar} onClick={() => onCambiar({ ...cfg, agrupar: a.id })} />
                ))}
            </>
        );
    } else {
        const ag = AGRUPAR.find((a) => a.id === cfg.agrupar) || AGRUPAR[0];
        cuerpo = (
            <>
                <Cab titulo="Vista" onCerrar={onCerrar} />
                <Item icono={Filter} label="Filtrar" val={nf ? `${nf} ${nf === 1 ? 'filtro' : 'filtros'}` : 'Sin filtros'} onClick={() => setPagina('filtrar')} />
                <Item icono={Columns} label="Columnas" val={`${colsVisibles(cfg).length} de ${COLS.length}${anchosPropios ? ' · anchos propios' : ''}`} onClick={() => setPagina('columnas')} />
                <Item icono={ArrowDownWideNarrow} label="Ordenar" val={ord.label} onClick={() => setPagina('ordenar')} />
                <Item icono={Rows} label="Agrupar" val={ag.label} onClick={() => setPagina('agrupar')} />
                <div className="tl-msep" />
                <button type="button" className="tl-mitem" onClick={onCriterios}>
                    <SlidersHorizontal size={17} /><span className="lbl">Administrar criterios</span><ChevronRight size={16} />
                </button>
                <Item icono={RotateCcw} label="Restablecer vista" disabled={esVistaDefault(cfg)} onClick={() => onCambiar(vistaDefault())} />
            </>
        );
    }

    return createPortal(
        <div className="dc-shell talent tl-capa">
            <div ref={menu} className="tl-menu" role="menu" aria-label="Vista" style={pos}>
                {cuerpo}
            </div>
        </div>,
        document.body,
    );
};

export default MenuVista;
