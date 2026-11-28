import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, PlayCircle, X } from 'lucide-react';
import { href } from '../../lib/escalas';
import { fechaCorta, minAncho, plantillaCols } from '../../lib/vista';
import { cierreNum } from '../../lib/closers';
import { waReinvitar } from '../../lib/antiguos';
import { Bandera, Chip, Inicial, Riel } from '../Piezas';
import { VEREDICTO } from '../comun';
import { Encabezado } from '../TablaPostulaciones';
import FichaCloser from './FichaCloser';
import logoWhatsapp from '../../assets/apps/whatsapp.png';

// «Antiguos» de Analyze y Winners con Closers elegido (27/11/2026): los closers de búsquedas anteriores
// (archivados, ADR-W193) en una sola lista, de cualquier estado, para volver a contactarlos. Lo justo
// para decidir a quién escribirle: estado, cierre, si dejó video y su WhatsApp. La lista ya llega
// filtrada (ver lib/antiguos.js y ControlesAntiguos).

const COLS = [
    { id: 'cand', label: 'Candidato', w: 'minmax(220px,1.6fr)', min: 200 },
    { id: 'estado', label: 'Estado', w: '140px', min: 110 },
    { id: 'cierre', label: 'Cierre', w: '120px', min: 96 },
    { id: 'video', label: 'Video', w: '92px', min: 72, cen: true },
    { id: 'wa', label: 'WhatsApp', w: '190px', min: 150 },
    { id: 'fecha', label: 'Postuló', w: '96px', min: 84 },
];
const CLAVE_ANCHOS = 'neurops-talent-anchos-antiguos-v1';
const leerAnchos = () => {
    try { return JSON.parse(window.localStorage.getItem(CLAVE_ANCHOS) || '{}') || {}; } catch { return {}; }
};

const Fila = ({ p, onAbrir }) => {
    const v = VEREDICTO[p.veredicto] || VEREDICTO.sin_calificar;
    const cierre = cierreNum(p.cierre);
    const wa = waReinvitar(p.whatsapp);
    const video = href(p.video);
    return (
        <div className="tl-fila" role="row" tabIndex={0} onClick={() => onAbrir(p.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onAbrir(p.id); }}>
            <div className="tl-c-cand" role="cell">
                <Inicial nombre={p.nombre} />
                <div>
                    <span className="tl-c-nom trunc">{p.nombre}</span>
                    <span className="tl-c-sub"><Bandera de={p.pais} /><span className="trunc">{p.pais || '—'}</span></span>
                </div>
            </div>
            <div role="cell"><Chip c={v.fg} chico>{v.label}</Chip></div>
            <div className="tl-c-pide" role="cell">
                {cierre != null ? (
                    <>
                        <b>{cierre}<small>%</small></b>
                        <Riel pct={cierre} color={cierre >= 30 ? 'var(--success)' : 'var(--barra)'} />
                    </>
                ) : <b className="mut40">{p.cierre === 'nada' ? 'No mide' : '—'}</b>}
            </div>
            <div className="cen" role="cell">
                {video ? (
                    <a className="tl-ok" href={video} target="_blank" rel="noreferrer" title="Ver su video de presentación"
                        onClick={(e) => e.stopPropagation()}><PlayCircle size={18} /></a>
                ) : <span className="tl-no" title="Sin video"><PlayCircle size={18} style={{ opacity: 0.45 }} /></span>}
            </div>
            <div role="cell">
                {wa ? (
                    <a className="tl-wa" href={wa} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Abrir WhatsApp con la invitación a la vacante ya escrita">
                        <img src={logoWhatsapp} alt="" />
                        <span className="trunc">{String(p.whatsapp).replace(/^\+\d{1,3}\s*/, '')}</span>
                    </a>
                ) : <span className="tl-c-txt mut40">Sin WhatsApp</span>}
            </div>
            <div className="tl-c-fecha" role="cell"><b>{fechaCorta(p.created_at) || '—'}</b></div>
            <div className="tl-c-fin" role="cell"><ChevronRight size={18} className="tl-c-go" /></div>
        </div>
    );
};

const AntiguosCloser = ({ closers, lista, filtrando, onLimpiar }) => {
    const { archivadas, cargarArchivadas } = closers;
    const [abierta, setAbierta] = useState(null);
    const [anchos, setAnchos] = useState(leerAnchos);
    const tabla = useRef(null);

    useEffect(() => { if (archivadas === null) cargarArchivadas(); }, [archivadas, cargarArchivadas]);
    useEffect(() => {
        const t = tabla.current;
        if (!t) return undefined;
        t.classList.add('entra');
        const id = setTimeout(() => t.classList.remove('entra'), 1100);
        return () => clearTimeout(id);
    }, [lista.length]);

    const ids = useMemo(() => lista.map((p) => p.id), [lista]);

    const cambiarAncho = (id, px, persistir) => setAnchos((prev) => {
        let nuevos = prev;
        if (px !== null) {
            nuevos = { ...prev };
            if (px === undefined) delete nuevos[id];
            else nuevos[id] = px;
        }
        if (persistir) {
            try { window.localStorage.setItem(CLAVE_ANCHOS, JSON.stringify(nuevos)); } catch { /* sin almacenamiento: dura la sesión */ }
        }
        return nuevos;
    });

    return (
        <>
            <div className="tl-tabla-scroll">
                <div ref={tabla} className="tl-tabla" role="table" aria-label="Closers de búsquedas anteriores"
                    style={{ '--cols': plantillaCols(COLS, anchos), '--minw': `${Math.max(900, minAncho(COLS, anchos))}px` }}>
                    <div className="tl-tcab" role="row">
                        {COLS.map((c) => <Encabezado key={c.id} col={c} etiqueta={c.label} onAncho={cambiarAncho} ancho={anchos[c.id]} />)}
                        <span />
                    </div>
                    {lista.length === 0 && (
                        <div className="tl-vacio">
                            <p className={archivadas === null ? 't-cap mut40' : 't-h3'}>
                                {archivadas === null ? 'Cargando postulaciones…' : 'Nadie cumple el filtro'}
                            </p>
                            {archivadas !== null && filtrando && (
                                <button type="button" className="btn btn--linea btn--sm" onClick={onLimpiar}><X /> Quitar filtros</button>
                            )}
                        </div>
                    )}
                    {lista.map((p) => <Fila key={p.id} p={p} onAbrir={setAbierta} />)}
                    <div className="tl-tpie">
                        Mostrando <b>{lista.length}</b> de {(archivadas || []).length}
                        <span className="sep" />
                        Búsquedas anteriores · las más recientes primero
                    </div>
                </div>
            </div>
            {abierta && (
                <FichaCloser applicationId={abierta} ids={ids.includes(abierta) ? ids : [abierta]}
                    onClose={() => setAbierta(null)} onNavigate={setAbierta} onDecidido={() => cargarArchivadas()} />
            )}
        </>
    );
};

export default AntiguosCloser;
