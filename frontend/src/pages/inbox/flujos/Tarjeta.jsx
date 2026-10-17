// Tarjeta de un flujo: resultado de los últimos días (entradas, completan, en curso), su embudo por
// paso y una alerta cuando un paso pierde gente. Tocar una barra abre el lienzo en ese paso.
import { AlertTriangle, Eye, Pause, Pencil, Play, Trash2, Workflow } from 'lucide-react';
import { Bars, Button, Card, ConfirmDelete, IconButton, Status } from '../../../components/standard';
import { estadoDe, porciento, rotuloPaso } from '../estadoFlujo';

// Antes de la caída, sano; la caída, en foco; después, neutro. Pausado, todo gris.
function colorBarra(paso, mayor, pausado) {
    if (pausado) return 'var(--idle)';
    if (!mayor) return 'var(--success)';
    if (paso.id === mayor.id) return 'var(--brand-secondary)';
    return paso.numero < mayor.numero ? 'var(--success)' : 'var(--info)';
}

function Alerta({ f, m }) {
    if (!f.version) return <p className="fl-alerta mut40">Sin publicar todavía.</p>;
    if (!m?.entradas) return <p className="fl-alerta mut40">Nadie entró en los últimos {m?.dias || 7} días.</p>;
    if (!m.suficiente) return <p className="fl-alerta mut40">Muestra insuficiente: {m.entradas} {m.entradas === 1 ? 'entrada' : 'entradas'} en {m.dias} días.</p>;
    if (!m.mayor_caida) return <p className="fl-alerta mut">Sin caídas para revisar.</p>;
    return (
        <p className="fl-alerta fl-alerta--caida">
            <AlertTriangle size={14} aria-hidden="true" />
            Caída de {porciento(m.mayor_caida.caida)} en <b>{rotuloPaso(m.mayor_caida)}</b>
        </p>
    );
}

export default function Tarjeta({ f, puedeEditar, borrando, onBorrando, onAbrir, onBorrar, onPausar }) {
    const est = estadoDe(f);
    const m = f.metricas;
    const palabras = f.palabras_clave.filter(Boolean);
    const pausado = f.estado === 'pausado';
    const sub = [palabras.length ? palabras.map((p) => `#${p}`).join(' ') : 'Sin palabra clave', f.version && `v${f.version}`].filter(Boolean).join(' · ');
    const embudo = (m?.embudo || []).map((p) => ({
        key: p.id, value: p.alcance, label: `Paso ${p.numero}`, color: colorBarra(p, m.mayor_caida, pausado),
        tip: `Paso ${p.numero}|${p.alcance} ${p.alcance === 1 ? 'persona' : 'personas'} en ${m.dias} días`,
    }));
    return (
        <Card as="article" className={`fcard fl-card${m?.mayor_caida && !pausado ? ' fl-card--alerta' : ''}`}>
            <div className="fcard-cab">
                <span className="icono-m"><Workflow /></span>
                <div className="fl-titulo">
                    <button type="button" className="fcard-nom" onClick={() => onAbrir(f.id)}>{f.nombre}</button>
                    <span className={`t-cap ${palabras.length ? 'mut' : 'fl-sin-palabra'}`}>{sub}</span>
                </div>
                <div className="fl-estado">
                    <Status color={est.color}>{est.texto.split(' · ')[0]}</Status>
                    {f.version && f.cambios_sin_publicar && (
                        <Status color="var(--warning)" data-tip="Cambios sin publicar|Lo que corre es la última versión publicada.">Sin publicar</Status>
                    )}
                </div>
            </div>
            <div className="datos">
                <div className="dato"><b>{m?.entradas ?? '–'}</b><span>Entradas {m?.dias || 7} d</span></div>
                <div className="dato"><b>{m?.suficiente ? porciento(m.completan) : '–'}</b><span>Completan</span></div>
                <div className="dato"><b>{f.ejecuciones_abiertas}</b><span>En curso</span></div>
            </div>
            {embudo.some((x) => x.value > 0) && (
                <Bars className="fl-embudo" label={`Embudo de ${f.nombre} por paso`} items={embudo} onSelect={(id) => onAbrir(f.id, id)} />
            )}
            <Alerta f={f} m={m} />
            {borrando ? (
                <ConfirmDelete name={f.nombre} detail="No se puede deshacer." icon={<Trash2 />} onCancel={() => onBorrando(null)} onConfirm={() => onBorrar(f)} />
            ) : (
                <div className="fcard-pie">
                    {/* Uno publicado ya corrió con leads: se pausa, no se borra. */}
                    {puedeEditar && !f.version && (
                        <IconButton label={`Eliminar ${f.nombre}`} icon={<Trash2 />} size="sm" danger data-tip="Eliminar" onClick={() => onBorrando(f.id)} />
                    )}
                    {puedeEditar && f.version && (
                        <Button icon={pausado ? <Play /> : <Pause />} onClick={() => onPausar(f)}>{pausado ? 'Reanudar' : 'Pausar'}</Button>
                    )}
                    <div className="der">
                        <Button icon={puedeEditar ? <Pencil /> : <Eye />} onClick={() => onAbrir(f.id)}>{puedeEditar ? 'Editar' : 'Ver'}</Button>
                    </div>
                </div>
            )}
        </Card>
    );
}
