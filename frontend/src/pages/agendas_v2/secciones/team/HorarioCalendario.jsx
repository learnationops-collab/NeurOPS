// Vista Calendario del horario semanal (HorarioEditor): una columna por día y los horarios como bloques.
// Arrastrar sobre lo vacío marca un horario (si se cruza a otros días, lo marca en todos); arrastrar un
// bloque lo mueve; sus bordes cambian el inicio o el fin; la × lo quita. De a 30 minutos. Los horarios que
// se tocan o se pisan en un día quedan unidos en uno.

import { useRef, useState } from 'react';
import { DIAS, aMin } from '../../core/catalogos';
import { clonar } from '../../core/util';
import { Icono } from '../../ui/base';
import { toast } from '../../ui/toast';
import { MAX_FRANJAS } from './cobertura';
import { CopiarA } from './Horario';

const PASO = 30;
const FIN = 1440;
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

/** Ordena y une los horarios de un día que se pisan o se tocan. Los inválidos (fin ≤ inicio) se descartan. */
export function unirFranjas(rs) {
    const ord = rs.map(r => [aMin(r[0]), aMin(r[1])]).filter(r => r[1] > r[0]).sort((a, b) => a[0] - b[0]);
    const out = [];
    ord.forEach(r => {
        const u = out[out.length - 1];
        if (u && r[0] <= u[1]) u[1] = Math.max(u[1], r[1]);
        else out.push([...r]);
    });
    return out.map(r => [hhmm(r[0]), hhmm(r[1])]);
}

const horasDe = (rs) => rs.reduce((s, r) => s + Math.max(0, aMin(r[1]) - aMin(r[0])), 0) / 60;

export default function HorarioCalendario({ horario, bloqueado = false, onCambio }) {
    const raiz = useRef(null);
    const [arrastre, setArrastre] = useState(null);
    const [copiar, setCopiar] = useState(null);
    const minimo = Math.min(360, ...DIAS.flatMap(dd => (horario[dd.d] || []).map(r => Math.floor(aMin(r[0]) / 60) * 60)));
    const filas = (FIN - minimo) / PASO;
    const pct = (m) => ((m - minimo) / (FIN - minimo)) * 100;

    // Columna y fila (de a 30 min) bajo el puntero.
    const celda = (e) => {
        const cuerpos = [...raiz.current.querySelectorAll('.hcal-cuerpo')];
        const r0 = cuerpos[0].getBoundingClientRect();
        let col = cuerpos.findIndex(c => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; });
        if (col < 0) col = e.clientX < r0.left ? 0 : cuerpos.length - 1;
        const fila = Math.max(0, Math.min(filas - 1, Math.floor(((e.clientY - r0.top) / r0.height) * filas)));
        return { col, fila };
    };
    const empezar = (e, datos) => {
        if (bloqueado || e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        raiz.current.setPointerCapture(e.pointerId);
        const c = celda(e);
        setArrastre({ ...datos, c0: c, c1: c });
    };
    const mover = (e) => { if (arrastre) { const c = celda(e); if (c.col !== arrastre.c1.col || c.fila !== arrastre.c1.fila) setArrastre({ ...arrastre, c1: c }); } };

    // Cómo queda el horario con el arrastre en curso (también es la vista previa).
    const aplicar = (a) => {
        const hz = clonar(horario);
        if (a.modo === 'crear') {
            const ini = minimo + Math.min(a.c0.fila, a.c1.fila) * PASO, fin = minimo + (Math.max(a.c0.fila, a.c1.fila) + 1) * PASO;
            const [d0, d1] = [Math.min(a.c0.col, a.c1.col), Math.max(a.c0.col, a.c1.col)];
            for (let i = d0; i <= d1; i++) hz[DIAS[i].d] = unirFranjas([...(hz[DIAS[i].d] || []), [hhmm(ini), hhmm(fin)]]);
            return hz;
        }
        const dia = hz[a.dow] || [];
        let [ini, fin] = dia[a.j].map(aMin);
        const delta = (a.c1.fila - a.c0.fila) * PASO;
        if (a.modo === 'mover') {
            const d = Math.max(minimo - ini, Math.min(FIN - fin, delta));
            ini += d; fin += d;
        } else if (a.modo === 'ini') ini = Math.min(fin - PASO, Math.max(minimo, ini + delta));
        else fin = Math.max(ini + PASO, Math.min(FIN, fin + delta));
        dia[a.j] = [hhmm(ini), hhmm(fin)];
        hz[a.dow] = a.modo === 'mover' ? dia : unirFranjas(dia);
        return hz;
    };
    const soltar = () => {
        if (!arrastre) return;
        const hz = aplicar(arrastre);
        setArrastre(null);
        const llenos = DIAS.filter(dd => (hz[dd.d] || []).length > MAX_FRANJAS);
        if (llenos.length) { toast('Hasta ' + MAX_FRANJAS + ' horarios por día'); return; }
        if (arrastre.modo === 'mover') DIAS.forEach(dd => { if (hz[dd.d]?.length) hz[dd.d] = unirFranjas(hz[dd.d]); });
        onCambio(hz);
    };
    const quitar = (dow, j) => { const hz = clonar(horario); hz[dow].splice(j, 1); onCambio(hz); };

    const vista = arrastre ? aplicar(arrastre) : horario;
    return (
        <div className={'hcal' + (arrastre ? ' hcal--arrastrando' : '') + (bloqueado ? ' hcal--bloqueado' : '')} ref={raiz}
            onPointerMove={mover} onPointerUp={soltar} onPointerCancel={() => setArrastre(null)} style={{ '--filas': filas }}>
            <div className="hcal-eje" aria-hidden="true">
                {Array.from({ length: (FIN - minimo) / 120 + 1 }, (_, i) => minimo + i * 120).map(m => (
                    <span key={m} style={{ top: pct(m) + '%' }}>{m / 60}</span>
                ))}
            </div>
            {DIAS.map((dd, i) => {
                const rs = vista[dd.d] || [];
                const hs = horasDe(rs);
                return (
                    <div key={dd.d} className={'hcal-col' + (rs.length ? '' : ' hcal-col--off')} data-dia={dd.d} style={{ '--i': i }}>
                        <div className="hcal-cab">
                            <span className="dia-l" title={dd.n}>{dd.c}</span>
                            <small>{hs ? (Number.isInteger(hs) ? hs : hs.toFixed(1)) + ' h' : '—'}</small>
                            {!bloqueado && rs.length > 0 && (
                                <button type="button" className="hcal-copiar" data-copiar-btn="" aria-label={'Copiar el ' + dd.n + ' a otros días'}
                                    data-tip={'Copiar el ' + dd.n + '|A los días que elijas'} aria-expanded={copiar === dd.d}
                                    onClick={() => setCopiar(copiar === dd.d ? null : dd.d)}><Icono n="copiar" s={13} /></button>
                            )}
                            {copiar === dd.d && (
                                <div className={'hcal-pop' + (i > 3 ? ' hcal-pop--der' : '')}>
                                    <CopiarA desde={dd.d} onCerrar={() => setCopiar(null)}
                                        onAplicar={(destinos) => {
                                            const hz = clonar(horario);
                                            destinos.forEach(x => { hz[x] = clonar(horario[dd.d] || []); });
                                            setCopiar(null);
                                            if (destinos.length) { onCambio(hz); toast('Horas copiadas'); }
                                        }} />
                                </div>
                            )}
                        </div>
                        <div className="hcal-cuerpo" onPointerDown={e => empezar(e, { modo: 'crear' })}
                            data-tip={rs.length || bloqueado ? undefined : 'No disponible|Arrastrá para marcar un horario'}>
                            {rs.map((r, j) => {
                                const a = aMin(r[0]), b = aMin(r[1]);
                                const alto = pct(b) - pct(a);
                                return (
                                    <div key={j} className={'hcal-bloque' + (alto < 6 ? ' hcal-bloque--chico' : '')}
                                        style={{ top: pct(a) + '%', height: alto + '%' }}
                                        data-tip={`${r[0]}–${r[1]}|Arrastrá para moverlo; los bordes cambian la hora`}
                                        onPointerDown={e => empezar(e, { modo: 'mover', dow: dd.d, j })}>
                                        <i className="hcal-borde hcal-borde--ini" onPointerDown={e => empezar(e, { modo: 'ini', dow: dd.d, j })} />
                                        <span className="hcal-hora">{r[0]}</span>
                                        <span className="hcal-hora hcal-hora--fin">{r[1]}</span>
                                        {!bloqueado && (
                                            <button type="button" className="hcal-x" aria-label={'Quitar ' + r[0] + '–' + r[1] + ', ' + dd.n}
                                                data-tip="Quitar este horario" onPointerDown={e => e.stopPropagation()} onClick={() => quitar(dd.d, j)}>
                                                <Icono n="x" s={11} />
                                            </button>
                                        )}
                                        <i className="hcal-borde hcal-borde--fin" onPointerDown={e => empezar(e, { modo: 'fin', dow: dd.d, j })} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
