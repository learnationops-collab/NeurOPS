import React from 'react';
import { ChipCanal, Numero } from './Piezas';
import { BIENVENIDAS, CANALES, fmtInt, tasa } from './modelo';
import './reporteDiario.css';

/**
 * Lo nuevo del reporte v2 en la Vista General de /admin/ventas › Setters: entrantes,
 * cualificación, aperturas y agendas por canal, y las bienvenidas. Es la vista con la que la
 * dirección analiza, así que se SUMA a lo que ya mostraba (no reemplaza nada).
 *
 * Lee `por_canal` de las estadísticas de setters (`setter_reporte_v2.sumar`): los canales suman solo los
 * reportes v2; lo que vino del formulario anterior queda aparte, sin repartir. Con «Promedio» los
 * números son por reporte (de los que tienen canales). Con la comparación prendida, al lado de
 * cada número va el del período anterior.
 *
 * Vive en su isla `.dc-shell`, como el resto del reporte nuevo: la página que la contiene es la del
 * Tailwind viejo, y el reset de botones del shell no puede alcanzarla.
 */

const porReporte = (valor, reportes, promedio) => (promedio && reportes ? Math.round((valor / reportes) * 10) / 10 : valor);

const Cifra = ({ rotulo, valor, tipo, antes }) => (
    <div className="rd-cifra">
        <span className="rd-k">{rotulo}</span>
        <Numero valor={valor} tipo={tipo} />
        {antes !== undefined && (
            <small className="rd-antes">Ant: {tipo === 'pct' ? (antes === null ? '—' : `${Math.round(antes * 10) / 10}%`) : fmtInt(antes)}</small>
        )}
    </div>
);

const CanalesSetter = ({ stats, promedio = false, comparar = false }) => {
    const pc = stats?.por_canal;
    if (!pc) return null;
    const previo = comparar ? stats.comparison?.por_canal : null;
    const n = pc.reportes_v2;
    const nAntes = previo?.reportes_v2 || 0;
    const v1 = stats.reportes_por_version?.v1 || 0;

    const columna = (c, i) => {
        const d = pc.canales[c.k];
        const a = previo?.canales?.[c.k];
        return (
            <div key={c.k} className="rd-rcol rd-canal-col" style={{ '--c': c.c, '--i': i }}>
                <div className="rd-rcab"><ChipCanal canal={c} /></div>
                <div className="rd-cifras">
                    <Cifra rotulo="Entrantes" valor={porReporte(d.entrantes, n, promedio)}
                        antes={a ? porReporte(a.entrantes, nAntes, promedio) : undefined} />
                    <Cifra rotulo="Cualificación" tipo="pct" valor={tasa(d.cualificados, d.entrantes)}
                        antes={a ? tasa(a.cualificados, a.entrantes) : undefined} />
                    <Cifra rotulo="Apertura" tipo="pct" valor={tasa(d.aperturas, d.entrantes)}
                        antes={a ? tasa(a.aperturas, a.entrantes) : undefined} />
                    <Cifra rotulo="Agendas" valor={porReporte(d.agendas, n, promedio)}
                        antes={a ? porReporte(a.agendas, nAntes, promedio) : undefined} />
                </div>
            </div>
        );
    };

    const b = pc.bienvenidas;
    const bA = previo?.bienvenidas;
    return (
        <section className="dc-shell dc-shell--embebido rd rd-canales" aria-label="Por canal">
            <div className="rd-canales-cab">
                <div>
                    <p className="rd-k">Reporte por canal</p>
                    <h3 className="rd-canales-titulo">Anuncios, inbound y bienvenidas</h3>
                </div>
                <span className="rd-chip" style={{ '--c': 'var(--text-muted)' }}>
                    <span>{n} {n === 1 ? 'reporte' : 'reportes'} por canal{promedio ? ' · promedio por reporte' : ''}</span>
                </span>
            </div>
            {n === 0 ? (
                <p className="rd-vacio rd-vidrio">Ningún reporte del período se cargó por canal todavía.</p>
            ) : (
                <div className="rd-resultado rd-vidrio rd-canales-grid">
                    {CANALES.map(columna)}
                    <div className="rd-rcol rd-canal-col" style={{ '--c': BIENVENIDAS.c, '--i': 2 }}>
                        <div className="rd-rcab"><ChipCanal canal={BIENVENIDAS} /></div>
                        <div className="rd-cifras">
                            <Cifra rotulo="Hechas" valor={porReporte(b.hechas, n, promedio)}
                                antes={bA ? porReporte(bA.hechas, nAntes, promedio) : undefined} />
                            <Cifra rotulo="Respuesta" tipo="pct" valor={tasa(b.respondidas, b.hechas)}
                                antes={bA ? tasa(bA.respondidas, bA.hechas) : undefined} />
                            <Cifra rotulo="Apertura" tipo="pct" valor={tasa(b.aperturas, b.respondidas)}
                                antes={bA ? tasa(bA.aperturas, bA.respondidas) : undefined} />
                            <Cifra rotulo="Respondidas" valor={porReporte(b.respondidas, n, promedio)}
                                antes={bA ? porReporte(bA.respondidas, nAntes, promedio) : undefined} />
                        </div>
                    </div>
                </div>
            )}
            {(v1 > 0 || n > 0) && (
                <p className="rd-canales-nota">
                    {v1 > 0 && (
                        <>Además, {fmtInt(pc.sin_canal.entrantes)} entrantes y {fmtInt(pc.sin_canal.agendas)} agendas
                            de {v1} {v1 === 1 ? 'reporte' : 'reportes'} del formulario anterior, sin canal. </>
                    )}
                    {n > 0 && 'La respuesta a aperturas de arriba se mide solo con el formulario anterior: el nuevo no la pide.'}
                </p>
            )}
        </section>
    );
};

export default CanalesSetter;
