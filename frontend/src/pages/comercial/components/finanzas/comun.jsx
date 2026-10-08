import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Humo, PillMenu, Tip } from '../Shared';
import Cifra from '../Cifra';

/**
 * Piezas que comparten las secciones Finanzas y Payroll del dashboard comercial.
 *
 * Los montos de Finanzas van CON centavos: `fmt.money` del tablero redondea al dólar, que sirve
 * para leer un período de ventas pero no para conciliar una pasarela ni pagar una nómina.
 */
export const dinero = (v) => {
    const n = Number(v) || 0;
    const texto = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${n < 0 ? '-' : ''}$${texto}`;
};

/** Diferencia con signo: «+$10.00» en verde, «-$10.00» en rojo, «$0.00» neutro. */
export const tonoDe = (n) => (n > 0.004 ? 'success' : n < -0.004 ? 'error' : 'text-muted');
export const conSigno = (n) => (n > 0.004 ? `+${dinero(n)}` : dinero(n));

const v = (tono) => `var(--${tono})`;

/**
 * Tile de cifra, el mismo `.kpi` de Analizar: rótulo con su «i», el número que cuenta hasta su
 * valor y una línea de lectura. `children` va debajo (un campo editable, por ejemplo).
 */
export const Cifron = ({ rotulo, ayuda, valor, tono, sub, humo, children }) => (
    <section className="kpi caja">
        {humo && <Humo colores={humo} />}
        <div className="kpi-cab">
            <p className="t-eyebrow">{rotulo}</p>
            <Tip texto={ayuda} titulo={rotulo} />
        </div>
        <div className="kpi-cifra">
            <Cifra tag="p" className="kpi-n" valor={valor} style={{ color: tono ? v(tono) : undefined }} />
            {sub && <p className="kpi-sub">{sub}</p>}
        </div>
        {children}
    </section>
);

export const HUMOS = {
    ingreso: [v('success'), v('info'), v('brand-primary'), v('success')],
    gasto: [v('error'), v('warning'), v('brand-primary'), v('error')],
    marca: [v('brand-secondary'), v('brand-primary'), v('brand-secondary-light'), v('brand-navy')],
    info: [v('info'), v('brand-primary'), v('info'), v('brand-navy')],
};

/**
 * Un monto que se edita en su lugar y se guarda al salir del campo (como en la página vieja).
 * Guarda solo si cambió: antes cada blur pegaba al servidor y mostraba «guardado» sin cambios.
 */
export const CampoMonto = ({ valor, onGuardar, etiqueta }) => {
    const [texto, setTexto] = useState(valor ?? '');
    useEffect(() => { setTexto(valor ?? ''); }, [valor]);
    const guardar = () => {
        const n = parseFloat(texto) || 0;
        if (n !== (Number(valor) || 0)) onGuardar(n);
    };
    return (
        <label className="fz-monto">
            <span aria-hidden="true">$</span>
            <input type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={texto}
                aria-label={etiqueta}
                onChange={(e) => setTexto(e.target.value)}
                onBlur={guardar}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        </label>
    );
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
    'octubre', 'noviembre', 'diciembre'];

export const mesActual = () => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
};

export const nombreDelMes = (mes) => {
    const [anio, m] = mes.split('-').map(Number);
    return `${MESES[m - 1]} ${anio}`;
};

/** Los últimos 18 meses, del actual hacia atrás: Finanzas se mira por mes cerrado. */
const ultimosMeses = () => {
    const hoy = new Date();
    return Array.from({ length: 18 }, (_, i) => {
        const f = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
    });
};

// El mes queda en el último elegido (por navegador): revisar un mes cerrado no obliga a volver
// a elegirlo cada vez que se entra. Es la misma clave que usaba /admin/finance.
const MES_GUARDADO = 'finanzas.mes';

export const leerMesGuardado = () => {
    try {
        const mes = localStorage.getItem(MES_GUARDADO);
        if (mes && /^\d{4}-\d{2}$/.test(mes)) return mes;
    } catch { /* sin almacenamiento: el mes actual */ }
    return mesActual();
};

export const guardarMes = (mes) => {
    try {
        localStorage.setItem(MES_GUARDADO, mes);
    } catch { /* sin almacenamiento: dura mientras la página está abierta */ }
};

/** Píldora del mes, como la del período del tablero. */
export const MenuMes = ({ mes, onCambiar }) => {
    const meses = ultimosMeses();
    if (!meses.includes(mes)) meses.push(mes);
    return (
        <PillMenu icono={<Calendar size={14} />} rotulo="mes" texto={nombreDelMes(mes)} valor={mes}
            opciones={meses.map(m => ({ key: m, label: nombreDelMes(m) }))}
            onChange={onCambiar} />
    );
};
