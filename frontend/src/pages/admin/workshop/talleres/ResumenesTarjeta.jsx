import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ExternalLink, HardDrive, PlayCircle } from 'lucide-react';
import { Bars } from '../../../../components/standard';
import { EsqueletoFilas, Tip } from '../../../comercial/components/Shared';
import { urlLoom } from '../../../../utils/loom';
import Interruptor from './Interruptor';
import { useAnunciosTaller, useLandingTaller, usePublicacion, ventanaGrabacion } from './datosTaller';
import {
    dinero, diaMes, ESTADOS_GRABACION, estadoGrabacion, estaPublicada, numero, pasosEmbudo, porcentaje,
    restante, tasaPaso,
} from './formato';

/**
 * Lo que se ve dentro de cada tarjeta según su conmutador: el embudo, los anuncios y la grabación
 * del taller, en resumen. El detalle completo de cada uno se abre desde el pie de la tarjeta.
 */

/** Una barrita que crece desde cero al montar. Cero es nada: sin barra. */
export const BarraCrece = ({ pct, color, i = 0 }) => {
    const quieto = useReducedMotion();
    const ancho = pct > 0 ? Math.max(4, Math.min(100, pct)) : 0;
    return (
        <span className="wt-riel" aria-hidden="true">
            {ancho > 0 && (
                <motion.i style={{ background: color }}
                    initial={quieto ? false : { width: 0 }} animate={{ width: `${ancho}%` }}
                    transition={quieto ? { duration: 0 } : { duration: 0.6, delay: 0.04 * i, ease: [0.22, 1, 0.36, 1] }} />
            )}
        </span>
    );
};

const colorPaso = (i, total) => {
    const mezcla = total > 1 ? Math.round((i / (total - 1)) * 100) : 100;
    return `color-mix(in oklch, var(--brand-secondary) ${mezcla}%, var(--info))`;
};

// --- Embudo -------------------------------------------------------------------------------------

export const ResumenEmbudo = ({ evento }) => {
    const pasos = pasosEmbudo(evento, { corto: true });
    // La barra en raíz: de 600 leads a 3 ventas, las últimas serían una raya.
    return (
        <Bars variant="rows" scale="sqrt" label="Embudo del taller" items={pasos.map((p, i) => ({
            key: p.key, label: p.label, value: p.n, display: numero(p.n), color: colorPaso(i, pasos.length),
            detail: i === 0 ? '' : porcentaje(tasaPaso(p.n, pasos[i - 1].n)),
        }))} />
    );
};

// --- Anuncios -----------------------------------------------------------------------------------

export const ResumenAnuncios = ({ evento }) => {
    const { datos, error } = useAnunciosTaller(evento.id);
    if (error) return <p className="t-cap mut wt-mini-vacio">No se pudieron traer los anuncios de Meta.</p>;
    if (!datos) return <EsqueletoFilas rotulo="Cargando los anuncios…" lineas={4} alto={22} />;
    if (!datos.anuncios_workshop) {
        return (
            <p className="t-cap mut wt-mini-vacio">
                Todavía no hay anuncios clasificados como Workshop.
                <Tip titulo="Anuncios de Workshop" texto="Se corrigen en Marketing › Meta Ads." />
            </p>
        );
    }
    if (!datos.campanas.length) {
        return <p className="t-cap mut wt-mini-vacio">Los anuncios de Workshop no gastaron del {diaMes(datos.desde)} al {diaMes(datos.hasta)}.</p>;
    }
    const t = datos.totales;
    const total = t.gasto || 0;
    return (
        <div className="wt-mini-anuncios">
            <dl className="pareja wt-mini-cifras" style={{ '--min': '70px', '--g': 'var(--s2)' }}>
                <div><dt>Gasto</dt><dd className="num">{dinero(t.gasto)}</dd></div>
                <div><dt>CTR</dt><dd className="num">{porcentaje(t.ctr)}</dd></div>
                <div><dt>CPC</dt><dd className="num">{t.cpc == null ? '—' : `$${Number(t.cpc).toFixed(2)}`}</dd></div>
                <div><dt>Al grupo</dt><dd className="num">{numero(t.clics_whatsapp)}</dd></div>
            </dl>
            <ul className="wt-mini-campanas" aria-label="Campañas que más gastaron">
                {datos.campanas.slice(0, 3).map((c, i) => (
                    <li key={c.campana_id}>
                        <span className="trunc" title={c.nombre}>{c.nombre}</span>
                        <b className="num">{dinero(c.gasto)}</b>
                        <BarraCrece pct={total ? (c.gasto / total) * 100 : 0} color="var(--info)" i={i} />
                    </li>
                ))}
            </ul>
            <p className="t-cap mut40 num">
                Del {diaMes(datos.desde)} al {diaMes(datos.hasta)}
                {datos.campanas.length > 3 ? ` · ${datos.campanas.length} campañas` : ''}
            </p>
        </div>
    );
};

// --- Grabación ----------------------------------------------------------------------------------

const MiniLanding = ({ evento }) => {
    const { datos, error } = useLandingTaller(evento);
    if (!ventanaGrabacion(evento)) {
        return <p className="t-cap mut40">Nunca se publicó en la landing.</p>;
    }
    if (error) return <p className="t-cap mut40">No se pudo leer la landing.</p>;
    if (!datos) return <EsqueletoFilas rotulo="Cargando la landing…" lineas={1} alto={34} />;
    const e = datos.embudo || {};
    return (
        <dl className="pareja wt-mini-cifras" style={{ '--min': '70px', '--g': 'var(--s2)' }}>
            <div><dt>Visitas</dt><dd className="num">{numero(e.visitas)}</dd></div>
            <div><dt>Registros</dt><dd className="num">{numero(e.completo_gate)}</dd></div>
            <div><dt>Play</dt><dd className="num">{numero(e.dio_play)}</dd></div>
            <div><dt>Agendar</dt><dd className="num">{numero(e.clic_agenda)}</dd></div>
        </dl>
    );
};

export const ResumenGrabacion = ({ evento, ahora, onGuardado }) => {
    const estado = estadoGrabacion(evento, ahora);
    const info = ESTADOS_GRABACION[estado.tipo];
    const publicada = estaPublicada(estado);
    const { publicar, despublicar, guardando } = usePublicacion(evento, onGuardado);
    const sinLoom = !evento.replay_loom_id;

    return (
        <div className="wt-mini-grabacion">
            <div className="wt-mini-fila">
                <span className="chip" style={{ '--c': `var(--${info.tono})` }}>{info.texto}</span>
                <span className="t-cap mut num">
                    {estado.tipo === 'activa' && `Se cierra en ${restante(estado.restanteMs)}`}
                    {estado.tipo === 'programada' && `Abre en ${restante(estado.restanteMs)}`}
                    {estado.tipo === 'vencida' && `Estuvo del ${diaMes(evento.replay_activo_desde)} al ${diaMes(evento.replay_vence_hasta)}`}
                </span>
            </div>
            <div className="wt-mini-fila">
                {sinLoom ? (
                    <span className="t-cap mut40">Sin el Loom cargado</span>
                ) : (
                    <a className="btn btn--linea btn--sm" href={urlLoom(evento.replay_loom_id)} target="_blank" rel="noopener noreferrer">
                        <PlayCircle aria-hidden="true" /> Abrir grabación <ExternalLink aria-hidden="true" />
                    </a>
                )}
                <div className="wt-mini-interruptor">
                    <span className="t-cap mut">Landing</span>
                    <Interruptor encendido={publicada} etiqueta={`Landing de la grabación de ${evento.name}`}
                        disabled={sinLoom} ocupado={guardando !== null}
                        title={sinLoom ? 'Primero cargá el Loom en la grabación del taller' : publicada ? 'Dejar de publicar' : 'Publicar 48 h'}
                        onCambiar={(prender) => (prender ? publicar({ horas: 48 }) : despublicar(estado))} />
                    <Tip titulo="Landing de la grabación"
                        texto="Prendida: publicada 48 h. La landing muestra el último." />
                </div>
            </div>
            <div className="wt-mini-fila">
                {evento.grabacion_url ? (
                    <a className="btn btn--linea btn--sm" href={evento.grabacion_url} target="_blank" rel="noopener noreferrer">
                        <HardDrive aria-hidden="true" /> Meet en Drive <ExternalLink aria-hidden="true" />
                    </a>
                ) : (
                    <span className="t-cap mut40">Sin la grabación de Drive</span>
                )}
            </div>
            <MiniLanding evento={evento} />
        </div>
    );
};
