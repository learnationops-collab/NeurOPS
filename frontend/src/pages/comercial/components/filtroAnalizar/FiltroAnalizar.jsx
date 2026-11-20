import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, Plus, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import toast from 'react-hot-toast';
import PanelConfigurar from '../PanelConfigurar';
import { Tip, fmt } from '../Shared';
import { Tile, tasa, v } from '../PiezasAnalizar';
import { criteriosDe, rotuloDe } from '../filtroFacetas';
import { DEF_AGENDAS } from './useFiltroAnalizar';
import { armarPrompt, motivosDe } from './motivosPrompt';

/**
 * Copia texto al portapapeles. Si el navegador niega la API moderna (un navegador embebido, una página sin
 * permiso), usa un área de texto oculta con `execCommand('copy')`, que sigue andando dentro de un clic.
 */
const copiarTexto = async (texto) => {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch (e) {
        console.error(`Copiar motivos (portapapeles): ${e}`);
    }
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch (e) {
        console.error(`Copiar motivos (execCommand): ${e}`);
    }
    document.body.removeChild(area);
    return ok;
};

/** Cuántas agendas del bloque terminaron en un estado (`estados_de`) y con qué etiqueta lo filtra Revisar. */
const estadoDe = (bloque, clave) => {
    const e = (bloque?.estados || []).find(x => x.key === clave);
    return { n: e?.n || 0, filtro: e?.filtro };
};

/** Las cuatro cifras de la tira: agendas y el porcentaje de cada destino que no llegó a la llamada. */
const TIRA = [
    { clave: 'cancelo', label: 'Cancelaciones', color: 'warning', help: 'Agendas que el lead canceló, sobre las agendas del filtro.' },
    { clave: 'reagendo', label: 'Reprogramaciones', color: 'info', help: 'Agendas que se movieron a otra fecha, sobre las agendas del filtro.' },
    { clave: 'no_show', label: 'No show', color: 'error', help: 'Agendas a las que el lead no se presentó, sobre las agendas del filtro.' },
];

const TiraFiltro = ({ bloque, previo, vsLabel, irA, base }) => (
    <div className="grid grid--4">
        <Tile label="Agendas" valor={fmt.num(bloque.agendas)} color={v('text-on-surface')}
            help="Las agendas de closing del período que deja pasar el filtro. Todo el tablero sale de ellas y de sus leads."
            antes={previo ? { actual: bloque.agendas, previo: previo.agendas, texto: fmt.num(previo.agendas), vs: vsLabel } : null}
            humo={[v('brand-secondary'), v('brand-primary'), v('info'), v('brand-navy')]}
            ver={irA ? () => irA('agendas', { ...base, __chip: 'todas_las', __de: 'Agendas' }) : null} />
        {TIRA.map(t => {
            const { n, filtro } = estadoDe(bloque, t.clave);
            const p = tasa(n, bloque.agendas);
            const antes = previo ? tasa(estadoDe(previo, t.clave).n, previo.agendas) : null;
            return (
                <Tile key={t.clave} label={t.label} valor={fmt.pct(p)} color={v(t.color)} help={t.help}
                    cuenta={{ a: String(n), b: fmt.plural(bloque.agendas, 'agenda', 'agendas') }}
                    antes={previo ? { actual: p, previo: antes, texto: fmt.pct(antes), vs: vsLabel, mejorBaja: true } : null}
                    humo={[v(t.color), v('brand-primary'), v(t.color), v('brand-navy')]}
                    ver={irA && filtro ? () => irA('agendas', { ...base, estado: [filtro], __chip: 'todas_las', __de: t.label }) : null} />
            );
        })}
    </div>
);

/**
 * El Filtro completo arriba de Analizar (ADR-W190): el mismo panel y las mismas etiquetas que Revisar, sobre el
 * filtro que comparten (`filtro`, `onCambiar`). Debajo, la tira de agendas y destinos ya filtrada.
 */
const FiltroAnalizar = ({ filas, filtradas, filtro, onCambiar, datos, vsLabel, irA, alcance, listo, deTriage = 0 }) => {
    const [abierto, setAbierto] = useState(false);
    const caja = useRef(null);
    const facetas = filtro.facetas || {};
    const modo = filtro.modo || 'todas';
    const criterios = criteriosDe(DEF_AGENDAS, facetas);

    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
        const escape = (e) => { if (e.key === 'Escape') setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [abierto]);

    const poner = (nuevas) => onCambiar({ facetas: nuevas, modo });
    const quitar = (c) => poner({ ...facetas, [c.clave]: (facetas[c.clave] || []).filter(x => x !== c.valor) });

    const copiar = async () => {
        const motivos = motivosDe(filtradas);
        if (!motivos.length) {
            toast('No hay motivos escritos en estas agendas');
            return;
        }
        if (await copiarTexto(armarPrompt(motivos, { alcance, criterios }))) {
            toast.success(`${fmt.plural(motivos.length, 'motivo copiado', 'motivos copiados')} con el prompt`);
        } else {
            toast.error('No se pudo copiar al portapapeles');
        }
    };

    // Lo que trae cada número a Revisar: el filtro de acá (Revisar lo suma solo) más su condición.
    const base = {};
    const bloque = datos?.actual;

    return (
        <section className="panel filtro-analizar">
            <div className="fila barra-tabla" ref={caja}>
                <div className="config-envoltura">
                    <button type="button" className={`pastilla${criterios.length ? ' pastilla--on' : ''}`}
                        aria-expanded={abierto} aria-haspopup="dialog" onClick={() => setAbierto(a => !a)}>
                        <SlidersHorizontal size={15} />
                        Filtro completo
                        {criterios.length > 0 && <span className="cuenta-burbuja">{criterios.length}</span>}
                        <ChevronDown size={14} />
                    </button>
                    {abierto && (
                        <PanelConfigurar def={DEF_AGENDAS} filas={filas} facetas={facetas} setFacetas={poner}
                            modo={modo} setModo={(m) => onCambiar({ facetas, modo: m })} tabla="agendas"
                            onLimpiar={() => poner({})} onCerrar={() => setAbierto(false)} />
                    )}
                </div>
                <button type="button" className="pastilla" onClick={copiar} disabled={!listo}
                    title="Copia los motivos de las agendas filtradas con un prompt para pegar en cualquier IA">
                    <Copy size={15} />
                    Copiar motivos para IA
                </button>
                <span className="barra-cuenta">
                    <span className="t-cap mut40 num">
                        {listo ? `${fmt.num(filtradas.length)} de ${fmt.plural(filas.length, 'agenda', 'agendas')} de closing` : 'cargando agendas…'}
                        {listo && deTriage > 0 ? ` · Revisar suma ${fmt.plural(deTriage, 'de triage', 'de triage')}` : ''}
                    </span>
                    {irA && (
                        <button type="button" className="btn btn--linea btn--sm"
                            onClick={() => irA('agendas', { __chip: 'todas_las' })}>
                            Ver en Revisar
                        </button>
                    )}
                    <Tip titulo="Filtro completo"
                        texto="El mismo filtro de Revisar › Agendas: lo que elegís acá se ve allá y al revés. Todo el tablero se recalcula con estas agendas y sus leads." />
                </span>
            </div>

            {criterios.length > 0 && (
                <div className="fila filtro-fila">
                    <span className="filtro-rotulo">
                        <span className="t-rotulo">{modo === 'alguna' ? 'Cumple alguna:' : 'Cumple todas:'}</span>
                    </span>
                    {criterios.map(c => (
                        <button key={`${c.clave}-${c.valor}`} type="button" className="chip filtro-tag"
                            style={{ '--c': 'var(--brand-secondary)', textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}
                            aria-label={`Quitar ${c.faceta}: ${c.valor}`} onClick={() => quitar(c)}>
                            {rotuloDe(c)}
                            <X size={12} />
                        </button>
                    ))}
                    <button type="button" className="chip filtro-mas" aria-label="Agregar filtro" title="Agregar filtro"
                        onClick={() => setAbierto(true)}>
                        <Plus size={14} />
                    </button>
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => poner({})}>
                        <RotateCcw size={13} />
                        Limpiar
                    </button>
                </div>
            )}

            {bloque && (
                <div style={{ marginTop: 'var(--s4)' }}>
                    <TiraFiltro bloque={bloque} previo={datos.previo} vsLabel={vsLabel} irA={irA} base={base} />
                </div>
            )}
        </section>
    );
};

export default FiltroAnalizar;
