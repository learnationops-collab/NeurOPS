// La cabecera de la lista (ADR-W247; antes «5 conversaciones · por último mensaje · 1 sin leer» en texto): el número
// grande que entra con un pop, cómo está ordenada, una barrita con cuántas esperan a tiempo (< 5 min), atentas (5-30)
// y tarde (> 30) y las sin leer latiendo.
import { ArrowUpDown } from 'lucide-react';
import { esperaMin } from './colas';

export default function ListaCab({ visibles, orden, ahora }) {
    const n = visibles.length;
    const sinLeer = visibles.filter((c) => c.sin_leer > 0).length;
    const esperas = visibles.map((c) => esperaMin(c, ahora)).filter((m) => m != null);
    const tramos = [
        ['ok', esperas.filter((m) => m < 5).length, 'a tiempo (menos de 5 min)'],
        ['atento', esperas.filter((m) => m >= 5 && m < 30).length, 'atentas (5 a 30 min)'],
        ['tarde', esperas.filter((m) => m >= 30).length, 'tarde (más de 30 min)'],
    ].filter(([, k]) => k > 0);
    return (
        <div className="cv-lc">
            <span className="cv-lc-n" key={n}>{n}</span>
            {/* El orden ya no va escrito (Mario, 27/11/2026: menos texto): una flechita que lo dice al pasar el mouse. */}
            <span className="cv-lc-t">
                <b>{n === 1 ? 'conversación' : 'conversaciones'}</b>
                <small className="cv-lc-orden" data-tip={`Orden|${orden.corto}`} aria-label={`Orden: ${orden.corto}`}><ArrowUpDown size={11} aria-hidden="true" /></small>
            </span>
            {esperas.length > 0 && (
                <span className="cv-lc-barra" data-tip={`Esperan respuesta · ${esperas.length}|${tramos.map(([, k, t]) => `${k} ${t}`).join(' · ')}`}>
                    {tramos.map(([c, k], i) => <i key={c} className={`cv-lc-${c}`} style={{ flexGrow: k, '--i': i }} />)}
                </span>
            )}
            {sinLeer > 0 && <span className="cv-lc-nuevos" data-tip={`${sinLeer} sin leer`}><i />{sinLeer}</span>}
        </div>
    );
}
