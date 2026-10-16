import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Edit2 } from 'lucide-react';
import { Segmented } from '../../../comercial/components/Shared';
import InlineConfirm from '../../../../components/ui/InlineConfirm';
import { ResumenAnuncios, ResumenEmbudo, ResumenGrabacion } from './ResumenesTarjeta';
import { cac, dinero, porcentaje, roasRotulo, roasTono, veces } from './formato';

/**
 * Un taller como tarjeta: sus números de arriba y, con su propio conmutador, el resumen de su
 * embudo, de sus anuncios o de su grabación. «Ver completo» abre el detalle en la misma vista que
 * se está mirando (el embudo con el desglose vivo, la tabla de anuncios, la config del replay).
 */

export const VISTAS_TALLER = [
    { key: 'embudo', label: 'Embudo' },
    { key: 'anuncios', label: 'Anuncios' },
    { key: 'grabacion', label: 'Grabación' },
];

const TarjetaTaller = ({
    evento, i = 0, ahora, formatDate, elegido, onComparar, onAbrir, onEditar, onEliminar, onGuardado,
}) => {
    const [vista, setVista] = useState('embudo');
    const quieto = useReducedMotion();
    const e = evento;
    const tono = roasTono(e.roas);

    return (
        <motion.article className={`wt-tarjeta${elegido ? ' wt-tarjeta--elegida' : ''}`}
            aria-label={`${e.name}, ${formatDate(e.date)}`}
            initial={quieto ? false : { opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={quieto ? { duration: 0 } : { duration: 0.36, delay: Math.min(i, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}>
            <header className="wt-tarjeta-cab">
                <p className="t-rotulo num">{formatDate(e.date)}</p>
                <div className="wt-tarjeta-acciones">
                    <button type="button" className={`wt-comparar${elegido ? ' wt-comparar--on' : ''}`}
                        aria-pressed={!!elegido} onClick={() => onComparar(e.id)}
                        title="Sumar a la comparación (hasta 4)">
                        <span className="wt-comparar-caja" aria-hidden="true">{elegido && <Check />}</span>
                        Comparar
                    </button>
                    <button type="button" className="ibtn ibtn--sm" onClick={() => onEditar(e)}
                        title="Editar taller" aria-label={`Editar ${e.name}`}>
                        <Edit2 aria-hidden="true" />
                    </button>
                    <InlineConfirm compacto alto={32} corner={999} tamIcono={14} label="Eliminar taller"
                        doneLabel="Eliminado" title={`Eliminar ${e.name}`} onConfirm={() => onEliminar(e)} />
                </div>
            </header>

            <h3 className="wt-tarjeta-nom" title={e.name}>{e.name}</h3>

            <dl className="pareja wt-tarjeta-cifras" style={{ '--min': '78px', '--g': 'var(--s2)' }}>
                <div><dt>Inversión</dt><dd className="num">{dinero(e.inversion)}</dd></div>
                <div><dt>Cash</dt><dd className="num">{dinero(e.cash_collected)}</dd></div>
                <div>
                    <dt>ROAS</dt>
                    <dd className="num" style={{ color: `var(--${tono})` }} title={roasRotulo(e.roas)}>{veces(e.roas)}</dd>
                </div>
                <div>
                    <dt>Ventas</dt>
                    <dd className="num">{e.sales}<small className="mut40"> · {porcentaje(e.pct_close_rate)}</small></dd>
                </div>
            </dl>
            <p className="wt-tarjeta-sub t-cap mut40 num">
                CPL {dinero(e.cpl)} · costo por agenda {dinero(e.costo_por_agenda)} · CAC {dinero(cac(e))}
            </p>

            <Segmented chico opciones={VISTAS_TALLER} valor={vista} onChange={setVista}
                ariaLabel={`Qué ver de ${e.name}`} />

            <motion.div key={vista} className="wt-tarjeta-cuerpo" role="tabpanel"
                initial={quieto ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={quieto ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}>
                {vista === 'embudo' && <ResumenEmbudo evento={e} />}
                {vista === 'anuncios' && <ResumenAnuncios evento={e} />}
                {vista === 'grabacion' && <ResumenGrabacion evento={e} ahora={ahora} onGuardado={onGuardado} />}
            </motion.div>

            <button type="button" className="wt-tarjeta-pie" onClick={() => onAbrir(e, vista)}>
                {vista === 'embudo' ? 'Embudo completo' : vista === 'anuncios' ? 'Todos los anuncios' : 'Configurar la grabación'}
                <ArrowRight aria-hidden="true" />
            </button>
        </motion.article>
    );
};

export default TarjetaTaller;
