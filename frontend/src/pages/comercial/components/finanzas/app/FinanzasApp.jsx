import React from 'react';
import { BarChart3, Banknote, BookOpen, GitCompareArrows, Percent, TrendingUp } from 'lucide-react';
import { textoPeriodo } from '../comun';
import VistaComisiones from './VistaComisiones';
import VistaDashboard from './VistaDashboard';
import VistaDiferencias from './VistaDiferencias';
import VistaPayroll from './VistaPayroll';
import VistaProfit from './VistaProfit';
import { heroDe, money, montoParaBanco } from './modelo';
import { copiar } from './piezas';
import './finanzasApp.css';

/**
 * La app de /finanzas (07/11/2026): el artifact «Payroll Octubre» llevado a la plataforma y a
 * cualquier período. Cinco vistas en el dock (Dashboard, Payroll, Comisiones, Diferencias, Profit) y
 * Registros, con las pestañas de siempre (nómina e integrantes, software, anuncios, medios de pago,
 * CSV y cobros). El shell (dock, Learnito, menú de sesión, período) es el del dashboard comercial.
 */
export const SECCIONES_FINANZAS = [
    { id: 'dashboard', label: 'Dashboard', Icono: BarChart3 },
    { id: 'payroll', label: 'Payroll', Icono: Banknote },
    { id: 'comisiones', label: 'Comisiones', Icono: Percent },
    { id: 'diferencias', label: 'Diferencias', Icono: GitCompareArrows },
    { id: 'profit', label: 'Profit', Icono: TrendingUp },
];
export const SECCION_REGISTROS = { id: 'registros', label: 'Registros', Icono: BookOpen };
export const IDS_FINANZAS = SECCIONES_FINANZAS.map((s) => s.id);

const titular = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const FinanzasApp = ({ seccion, periodo, app, onIr }) => {
    const titulo = titular(textoPeriodo(periodo));
    return (
        <div className="fz">
            <div className="vista-in" key={seccion} style={{ display: 'grid', gap: 20, minWidth: 0 }}>
                {seccion === 'dashboard' && <VistaDashboard app={app} periodo={periodo} onIr={onIr} />}
                {seccion === 'payroll' && <VistaPayroll app={app} titulo={titulo} />}
                {seccion === 'comisiones' && <VistaComisiones app={app} titulo={titulo} mes={periodo.mes} />}
                {seccion === 'diferencias' && <VistaDiferencias app={app} periodo={periodo} />}
                {seccion === 'profit' && <VistaProfit app={app} />}
            </div>
        </div>
    );
};

/** La lista de lo que falta pagar, para pegar en un mensaje (la chispa ⚡ del artifact). */
export const copiarFaltantes = async (personas) => {
    const faltan = (personas || []).filter((p) => !p.fijo && p.falta > 0);
    if (!faltan.length) return 'nada';
    const ok = await copiar(faltan.map((p) => `${p.n} · ${p.metodo === 'airtm' ? 'AirTM' : 'Mercury'} · ${montoParaBanco(p)}`).join('\n'));
    return ok ? 'ok' : 'error';
};

/** «Falta pagar»: el widget del dock con el anillo de lo pagado; lleva a Payroll. */
export const FlujoFalta = ({ personas, onIr }) => {
    if (!personas) return null;
    const h = heroDe(personas);
    const falta = h.faltan.reduce((s, p) => s + p.falta, 0);
    const pagado = h.tot ? Math.min(1, Math.max(0, (h.tot - falta) / h.tot)) : 1;
    const listo = falta < 0.005;
    return (
        <button type="button" className={`fz-flow${listo ? ' listo' : ''}`} onClick={() => onIr('payroll')}
            title={listo ? 'Payroll al día' : 'Lo que falta transferir'}>
            <span className="fs" aria-hidden="true">
                <svg viewBox="0 0 64 64">
                    <rect className="fs-c" x="2" y="2" width="60" height="60" rx="18" />
                    <circle className="fs-p" cx="32" cy="32" r="18" />
                    <circle className="fs-a" cx="32" cy="32" r="18" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - pagado * 100} />
                    <circle className="fs-n" cx="32" cy="32" r="6" />
                </svg>
            </span>
            <span className="fl-tx">
                <b className="fk">{listo ? 'Al día' : 'Falta pagar'}</b>
                <b className="ft">{money(falta, 0)}</b>
                <span className="fn">{listo ? 'todo transferido' : `${h.faltan.length} ${h.faltan.length === 1 ? 'persona' : 'personas'}`}</span>
            </span>
        </button>
    );
};

export default FinanzasApp;
