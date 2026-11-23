// La fila de Confirmar (ADR-W201): el título, las vistas guardadas como pestañas y, a la derecha, los
// controles de la vista activa (filtro, orden, agrupación, propiedades y tipo), como en Notion.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Filter, Layers, Plus, SlidersHorizontal, X } from 'lucide-react';
import { subirACapa } from '../../../components/standard';
import PopoverVista from './PopoverVista';
import { IconoDeVista } from './iconos';
import { TIPOS_DE_VISTA } from './vistasConfirmar';

function Pestana({ vista, activa, puedeBorrar, onElegir, onRenombrar, onBorrar }) {
    const [editando, setEditando] = useState(false);
    const [nombre, setNombre] = useState(vista.nombre);
    const terminar = () => { setEditando(false); const n = nombre.trim(); if (n && n !== vista.nombre) onRenombrar(n); else setNombre(vista.nombre); };
    if (editando) {
        return (
            <span className="cv-tab cv-tab--on">
                <IconoDeVista tipo={vista.tipo} />
                <input className="cv-tab__input" value={nombre} maxLength={40} autoFocus onChange={(e) => setNombre(e.target.value)} onBlur={terminar}
                    onKeyDown={(e) => { if (e.key === 'Enter') terminar(); if (e.key === 'Escape') { setNombre(vista.nombre); setEditando(false); } }} />
            </span>
        );
    }
    return (
        <button type="button" className={`cv-tab${activa ? ' cv-tab--on' : ''}`} aria-pressed={activa} onClick={onElegir}
            onDoubleClick={() => { setNombre(vista.nombre); setEditando(true); }} title="Doble clic para renombrar">
            <IconoDeVista tipo={vista.tipo} />{vista.nombre}
            {activa && puedeBorrar && (
                <span className="cv-tab__x" role="button" tabIndex={-1} aria-label={`Borrar la vista ${vista.nombre}`}
                    onClick={(e) => { e.stopPropagation(); onBorrar(); }}><X aria-hidden="true" /></span>
            )}
        </button>
    );
}

export default function BarraVistas({
    titulo, vistas, vista, onElegir, onCambio, onCrear, onBorrar, onRestablecer, puedeCrear,
    catalogo, closers, segmentos, esTriage, semana,
}) {
    const [abierto, setAbierto] = useState(null); // { tipo, x, y }
    const popRef = useRef(null);

    const abrir = (tipo) => (e) => {
        if (abierto?.tipo === tipo) { setAbierto(null); return; }
        const r = e.currentTarget.getBoundingClientRect();
        setAbierto({ tipo, x: Math.max(8, Math.min(r.left, window.innerWidth - 316)), y: r.bottom + 6 });
    };
    useLayoutEffect(() => { if (abierto) subirACapa(popRef.current); }, [abierto]);
    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (!e.composedPath().some(n => n === popRef.current || n?.dataset?.cvPop)) setAbierto(null); };
        const tecla = (e) => { if (e.key === 'Escape') setAbierto(null); };
        document.addEventListener('pointerdown', fuera);
        document.addEventListener('keydown', tecla);
        return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
    }, [abierto]);

    const f = vista.filtro;
    const nFiltros = f.closers.length + f.etapas.length + f.segmentos.length;
    const nProps = vista.props.filter(k => catalogo.some(p => p.clave === k)).length;
    const ctl = (tipo, Icono, texto, extra = null, clase = '') => (
        <button type="button" className={`cv-ctl ${clase}`} data-cv-pop={tipo} aria-expanded={abierto?.tipo === tipo} onClick={abrir(tipo)}>
            <Icono aria-hidden="true" />{texto}{extra}
        </button>
    );

    return (
        <div className="cv-barra">
            <h2 className="cv-titulo">{titulo}</h2>
            <div className="cv-tabs">
                {vistas.map(v => (
                    <Pestana key={v.id} vista={v} activa={v.id === vista.id} puedeBorrar={vistas.length > 1}
                        onElegir={() => onElegir(v.id)} onRenombrar={(nombre) => onCambio(v.id, { nombre })} onBorrar={() => onBorrar(v.id)} />
                ))}
                {puedeCrear && (
                    <button type="button" className="cv-ctl" data-cv-pop="nueva" aria-label="Nueva vista" title="Nueva vista" onClick={abrir('nueva')}>
                        <Plus aria-hidden="true" />
                    </button>
                )}
            </div>
            <span className="cv-sep" />
            {vista.tipo === 'semana' && semana && (
                <span className="cv-semnav">
                    <button type="button" className="cv-ctl" aria-label="Semana anterior" onClick={() => semana.mover(-1)}><ChevronLeft aria-hidden="true" /></button>
                    <b>{semana.rotulo}</b>
                    <button type="button" className="cv-ctl" aria-label="Semana siguiente" onClick={() => semana.mover(1)}><ChevronRight aria-hidden="true" /></button>
                    {semana.desplazada && <button type="button" className="cv-ctl" onClick={() => semana.mover(0)}>Esta semana</button>}
                    <span className="cv-vsep" />
                </span>
            )}
            {ctl('filtro', Filter, 'Filtro', nFiltros > 0 && <span className="cv-n">{nFiltros}</span>, nFiltros ? 'cv-ctl--act' : '')}
            {ctl('orden', ArrowUpDown, 'Ordenar')}
            {vista.tipo !== 'semana' && ctl('agrupar', Layers, 'Agrupar')}
            {ctl('props', SlidersHorizontal, 'Propiedades', <span className="cv-n cv-n--suave">{nProps}</span>)}
            <span className="cv-vsep" />
            {ctl('tipo', () => <IconoDeVista tipo={vista.tipo} />, TIPOS_DE_VISTA[vista.tipo], <ChevronDown className="cv-chev" aria-hidden="true" />)}

            {abierto && (
                <div ref={popRef} className="cv-pop" style={{ left: abierto.x, top: abierto.y }} role="dialog" aria-label="Opciones de la vista">
                    <PopoverVista tipo={abierto.tipo} vista={vista} catalogo={catalogo} closers={closers} segmentos={segmentos} esTriage={esTriage}
                        onCambio={(cambios) => onCambio(vista.id, cambios)}
                        onElegirTipo={(tipo) => {
                            setAbierto(null);
                            if (abierto.tipo === 'nueva') onCrear(tipo);
                            else onCambio(vista.id, { tipo });
                        }}
                        onRestablecer={() => { setAbierto(null); onRestablecer(); }} />
                </div>
            )}
        </div>
    );
}
