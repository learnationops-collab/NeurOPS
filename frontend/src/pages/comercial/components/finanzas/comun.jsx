import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Humo, PillMenu, Tip } from '../Shared';
import Cifra from '../Cifra';
import RangoFechas, { rangoDe, textoRango } from '../RangoFechas';

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

// ------------------------------------------------------------------------------------------------
// El período de Finanzas (08/10/2026): un mes, como siempre, o un rango personalizado de fechas.
//
// Lo que se elige es {tipo: 'mes', mes} o {tipo: 'custom', desde, hasta}. Las vistas reciben el
// período ya resuelto, {desde, hasta, mes}: `mes` ('YYYY-MM') existe solo si el período es justo un
// mes calendario, y un rango del 1 al último día de un mes cuenta como ese mes. Los libros
// mensuales (nómina, saldos, anuncios, ahorros) se editan solo con `mes`; con un rango se muestran
// sumados, en solo lectura. Las fechas son días de calendario local (ver RangoFechas).

const diasDelMes = (mes) => {
    const [anio, m] = mes.split('-').map(Number);
    return new Date(anio, m, 0).getDate();
};

/** Del 1 al último día del mes 'YYYY-MM'. */
export const rangoDelMes = (mes) => ({ desde: `${mes}-01`, hasta: `${mes}-${String(diasDelMes(mes)).padStart(2, '0')}` });

/** El 'YYYY-MM' si el rango es justo un mes calendario; si no, null. */
export const mesExacto = (desde, hasta) => {
    const mes = desde.slice(0, 7);
    const entero = rangoDelMes(mes);
    return entero.desde === desde && entero.hasta === hasta ? mes : null;
};

/** {desde, hasta, mes} de lo elegido en la píldora. */
export const periodoDe = (eleccion) => {
    if (eleccion.tipo === 'custom') return { desde: eleccion.desde, hasta: eleccion.hasta, mes: mesExacto(eleccion.desde, eleccion.hasta) };
    return { ...rangoDelMes(eleccion.mes), mes: eleccion.mes };
};

/**
 * [{mes, parte}] de cada mes calendario que toca el rango: parte es 1 si el rango lo cubre entero y,
 * si lo corta, los días del rango en ese mes sobre los días del mes. Es la regla del backend para
 * los libros mensuales (`meses_del_rango` en finance.py); acá la usa la nómina de varios meses.
 */
export const mesesDelRango = (desde, hasta) => {
    const meses = [];
    let mes = desde.slice(0, 7);
    while (mes <= hasta.slice(0, 7)) {
        const entero = rangoDelMes(mes);
        const inicio = desde > entero.desde ? desde : entero.desde;
        const fin = hasta < entero.hasta ? hasta : entero.hasta;
        const dias = Number(fin.slice(8, 10)) - Number(inicio.slice(8, 10)) + 1;
        meses.push({ mes, parte: dias / diasDelMes(mes) });
        const [anio, m] = mes.split('-').map(Number);
        mes = m === 12 ? `${anio + 1}-01` : `${anio}-${String(m + 1).padStart(2, '0')}`;
    }
    return meses;
};

/** «septiembre 2026», o «16/09 – 15/10» si no es un mes justo. */
export const textoPeriodo = (periodo) => (periodo.mes ? nombreDelMes(periodo.mes) : textoRango(periodo));

// Queda lo último elegido (por navegador): revisar un mes cerrado no obliga a volver a elegirlo cada
// vez que se entra. El mes va en la clave que usaba /admin/finance (y se sigue leyendo); un rango
// personalizado va en otra, que manda mientras exista.
const MES_GUARDADO = 'finanzas.mes';
const RANGO_GUARDADO = 'finanzas.periodo';

const leerRangoGuardado = () => {
    try {
        const guardado = JSON.parse(localStorage.getItem(RANGO_GUARDADO) || 'null');
        return (guardado && rangoDe(guardado.desde, guardado.hasta)) || null;
    } catch {
        return null; // sin almacenamiento o un valor roto: como si no hubiera
    }
};

export const leerPeriodoGuardado = () => {
    const rango = leerRangoGuardado();
    if (rango) return { tipo: 'custom', ...rango };
    try {
        const mes = localStorage.getItem(MES_GUARDADO);
        if (mes && /^\d{4}-\d{2}$/.test(mes)) return { tipo: 'mes', mes };
    } catch { /* sin almacenamiento: el mes actual */ }
    return { tipo: 'mes', mes: mesActual() };
};

export const guardarPeriodo = (eleccion) => {
    try {
        if (eleccion.tipo === 'custom') {
            localStorage.setItem(RANGO_GUARDADO, JSON.stringify({ desde: eleccion.desde, hasta: eleccion.hasta }));
        } else {
            localStorage.setItem(MES_GUARDADO, eleccion.mes);
            localStorage.removeItem(RANGO_GUARDADO);
        }
    } catch { /* sin almacenamiento: dura mientras la página está abierta */ }
};

/**
 * La píldora del período de Finanzas, como la del período del tablero: «Personalizado» arriba (con
 * 18 meses abajo quedaba fuera de la vista) y los meses del actual hacia atrás. Con «Personalizado»
 * la píldora dice el rango y el menú queda abierto con las dos fechas al pie, que no se van al
 * scrollear los meses (ver `.fz-periodo` en finanzas.css). Arranca en el mes que se estaba viendo.
 */
export const MenuPeriodoFinanzas = ({ eleccion, onCambiar }) => {
    const custom = eleccion.tipo === 'custom';
    const meses = ultimosMeses();
    if (!custom && !meses.includes(eleccion.mes)) meses.push(eleccion.mes);
    const opciones = [
        { key: 'custom', label: <span className="fz-periodo">Personalizado</span>, quedaAbierto: true },
        ...meses.map(m => ({ key: m, label: nombreDelMes(m) })),
    ];
    return (
        <PillMenu icono={<Calendar size={14} />} rotulo="período"
            texto={custom ? textoRango(eleccion) : nombreDelMes(eleccion.mes)}
            // 340 y no los 324 de Payroll: la barra de los meses le come el ancho a las dos fechas,
            // y debajo de ~300px `.rango` las apila una sobre otra.
            valor={custom ? 'custom' : eleccion.mes} opciones={opciones} ancho={custom ? 340 : undefined}
            pie={custom ? (
                <RangoFechas rotulo="Período" desde={eleccion.desde} hasta={eleccion.hasta}
                    onCambiar={({ desde, hasta }) => {
                        const rango = rangoDe(desde, hasta);
                        if (rango) onCambiar({ tipo: 'custom', ...rango });
                    }} />
            ) : null}
            onChange={(k) => {
                if (k !== 'custom') onCambiar({ tipo: 'mes', mes: k });
                else if (!custom) onCambiar({ tipo: 'custom', ...rangoDelMes(eleccion.mes) });
            }} />
    );
};
