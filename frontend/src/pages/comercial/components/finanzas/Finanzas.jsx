import React, { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import InlineConfirm from '../../../../components/ui/InlineConfirm';
import { EsqueletoFilas, EsqueletoTablero, PanelCab, Tip } from '../Shared';
import { CampoMonto, Cifron, HUMOS, conSigno, dinero, nombreDelMes, tonoDe } from './comun';
import * as apiFz from './finanzasApi';

/**
 * Sección Finanzas del dashboard comercial (desde el 08/10/2026; antes /admin/finance).
 *
 * Las cinco vistas son las mismas de siempre y van en la barra de pestañas de arriba, como las de
 * Analizar: Resumen, Medios de pago, Anuncios, Nómina y Software. El mes lo elige la píldora de
 * la derecha (`MenuMes`) y queda guardado en el navegador. Cada vista pide lo suyo al abrirse.
 */
export const TABS_FINANZAS = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'medios', label: 'Medios de pago' },
    { key: 'anuncios', label: 'Anuncios' },
    { key: 'nomina', label: 'Nómina' },
    { key: 'software', label: 'Software' },
];

const v = (tono) => `var(--${tono})`;
const PASARELAS = ['Mercury', 'AirTM'];

/** Pide al montar y cada vez que cambia `clave`; `recargar` vuelve a pedir sin parpadeo. */
const useDatos = (pedir, clave) => {
    const [datos, setDatos] = useState(null);
    const recargar = useCallback(() => pedir().then(setDatos)
        .catch(() => toast.error('No se pudieron cargar los datos de Finanzas')), [pedir]);
    useEffect(() => {
        setDatos(null);
        recargar();
    }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
    return [datos, recargar, setDatos];
};

// ------------------------------------------------------------------------------------------------
// Resumen

const Resumen = ({ mes }) => {
    const pedir = useCallback(async () => {
        const [resumen, ahorros] = await Promise.all([apiFz.getResumen(mes), apiFz.getAhorros(mes)]);
        return { ...resumen, ahorros: ahorros.savings };
    }, [mes]);
    const [datos, recargar] = useDatos(pedir, mes);

    if (!datos) return <EsqueletoTablero rotulo="Cargando el resumen…" />;
    const { kpis, expenses_breakdown: gastos, income_breakdown: ingresos } = datos;

    const guardarAhorros = async (n) => {
        try {
            await apiFz.guardarAhorros(mes, n);
            await recargar();
            toast.success('Ahorros guardados');
        } catch {
            toast.error('No se pudieron guardar los ahorros');
        }
    };

    const rubros = [
        { key: 'sueldos', label: 'Equipo (nómina)', tono: 'error', ayuda: 'Sueldos fijos, comisiones y bonos del equipo en el mes.' },
        { key: 'anuncios', label: 'Inversión en anuncios', tono: 'brand-secondary', ayuda: 'El presupuesto de anuncios cargado para el mes.' },
        { key: 'software', label: 'Software', tono: 'warning', ayuda: 'Suscripciones y herramientas registradas en el mes.' },
    ];
    const totalGastos = kpis.total_expenses || 0;

    return (
        <>
            <div className="fz-grid fz-grid--4">
                <Cifron rotulo="Ingresos" valor={dinero(kpis.total_income)} tono="success" humo={HUMOS.ingreso}
                    sub="Cash collect neto de ventas completadas"
                    ayuda="Monto neto de las ventas completadas y confirmadas del mes, ya sin la comisión de la pasarela (4,5% Stripe, 8,9% Hotmart)." />
                <Cifron rotulo="Gastos" valor={dinero(totalGastos)} tono="error" humo={HUMOS.gasto}
                    sub="Nómina, anuncios y software"
                    ayuda="La suma de la nómina del equipo, el presupuesto de anuncios y el software del mes." />
                <Cifron rotulo="Profit" valor={dinero(kpis.profit)} tono={tonoDe(kpis.profit)} humo={HUMOS.marca}
                    sub="Ingresos menos gastos" ayuda="Ingresos del mes menos sus gastos." />
                <Cifron rotulo="Balance neto" valor={dinero(kpis.balance_neto)} tono={tonoDe(kpis.balance_neto)}
                    humo={HUMOS.info} sub="Profit más los ahorros del mes"
                    ayuda="(Ingresos − Gastos) + los ahorros cargados a mano para el mes." />
            </div>

            <div className="fz-grid fz-grid--2">
                <section className="panel">
                    <PanelCab titulo="Distribución de gastos"
                        tip="Los egresos del mes en sus tres rubros, con lo que pesa cada uno sobre el total." />
                    <div className="fz-tabla" style={{ '--cols': 'minmax(0,1fr) 120px 56px' }}>
                        <div className="fz-cab"><span>Rubro</span><span className="fz-der">Monto</span><span className="fz-der">%</span></div>
                        {rubros.map(r => (
                            <div key={r.key} className="fz-fila">
                                <span className="fila" style={{ gap: 9 }}>
                                    <span className="cab-punto" style={{ background: v(r.tono) }} />
                                    <span className="trunc">{r.label}</span>
                                    <Tip texto={r.ayuda} titulo={r.label} />
                                </span>
                                <span className="fz-n fz-der">{dinero(gastos[r.key])}</span>
                                <span className="tdatos-p">
                                    {totalGastos ? `${Math.round((gastos[r.key] / totalGastos) * 100)}%` : '—'}
                                </span>
                            </div>
                        ))}
                        <div className="fz-fila fz-total">
                            <span className="fz-rot">Total</span>
                            <span className="fz-n fz-der">{dinero(totalGastos)}</span>
                            <span />
                        </div>
                    </div>
                </section>

                <section className="panel">
                    <PanelCab titulo="Ingresos por medio de pago"
                        tip="Lo recaudado en el mes por cada pasarela, neto de su comisión." />
                    <div className="fz-tabla" style={{ '--cols': 'minmax(0,1fr) 80px 120px' }}>
                        <div className="fz-cab"><span>Medio</span><span className="fz-der">Ventas</span><span className="fz-der">Neto</span></div>
                        {ingresos.map(i => (
                            <div key={i.metodo_pago} className="fz-fila">
                                <span className="trunc" style={{ fontWeight: 700 }}>{i.metodo_pago}</span>
                                <span className="tdatos-p">{i.count}</span>
                                <span className="fz-n fz-der" style={{ color: v('success') }}>{dinero(i.total)}</span>
                            </div>
                        ))}
                        {ingresos.length === 0 && <p className="fz-vacio">No hubo ingresos este mes.</p>}
                    </div>
                </section>
            </div>

            <section className="panel">
                <PanelCab titulo="Balance del período"
                    tip="Ingresos menos gastos, más los ahorros que se cargan a mano: el resultado del mes." />
                <div className="fz-grid fz-grid--4">
                    <div className="mini fz-dato">
                        <p className="t-rotulo">Ingresos (A)</p>
                        <b style={{ color: v('success') }}>{dinero(kpis.total_income)}</b>
                    </div>
                    <div className="mini fz-dato">
                        <p className="t-rotulo">Gastos (B)</p>
                        <b style={{ color: v('error') }}>{dinero(-totalGastos)}</b>
                    </div>
                    <div className="mini fz-dato">
                        <p className="t-rotulo">Ahorros (C) · a mano</p>
                        <CampoMonto valor={datos.ahorros} onGuardar={guardarAhorros} etiqueta="Ahorros del mes" />
                    </div>
                    <div className="mini fz-dato">
                        <p className="t-rotulo">Balance neto (A − B + C)</p>
                        <b style={{ color: v(tonoDe(kpis.balance_neto)) }}>{dinero(kpis.balance_neto)}</b>
                    </div>
                </div>
            </section>
        </>
    );
};

// ------------------------------------------------------------------------------------------------
// Medios de pago

const MediosDePago = ({ mes }) => {
    const pedir = useCallback(() => apiFz.getSaldos(mes), [mes]);
    const [datos, recargar] = useDatos(pedir, mes);

    const guardar = async (metodo, n) => {
        try {
            await apiFz.guardarSaldo(mes, metodo, 'actual_amount', n);
            await recargar();
        } catch {
            toast.error('No se pudo guardar el saldo');
        }
    };

    if (!datos) return <section className="panel"><EsqueletoFilas rotulo="Cargando los saldos…" lineas={3} /></section>;
    const filas = datos.balances;
    const totalActual = filas.reduce((s, b) => s + b.actual_amount, 0);
    const totalPorPagar = filas.reduce((s, b) => s + b.expected_amount, 0);
    const cols = { '--cols': 'minmax(120px,1fr) 160px 150px 150px', '--min': '600px' };

    return (
        <section className="panel">
            <PanelCab titulo="Saldos en medios de pago"
                tip="Lo que hay en cada pasarela contra lo que hay que pagarle al equipo por ella. El saldo se carga a mano; lo que hay que pagar sale de la nómina del mes." />
            <div className="fz-scroll">
                <div className="fz-tabla" style={cols}>
                    <div className="fz-cab">
                        <span>Pasarela</span>
                        <span className="fz-der">Saldo actual <Tip texto="Lo que hay hoy en la cuenta. Se carga a mano." titulo="Saldo actual" /></span>
                        <span className="fz-der">Por pagar <Tip texto="Sueldos, comisiones y bonos del mes de quienes cobran por esta pasarela." titulo="Por pagar" /></span>
                        <span className="fz-der">Diferencia</span>
                    </div>
                    {filas.map(b => {
                        const diferencia = b.actual_amount - b.expected_amount;
                        return (
                            <div key={b.payment_method} className="fz-fila">
                                <span style={{ fontWeight: 800 }}>{b.payment_method}</span>
                                <CampoMonto valor={b.actual_amount} etiqueta={`Saldo actual de ${b.payment_method}`}
                                    onGuardar={(n) => guardar(b.payment_method, n)} />
                                <span className="fz-n fz-der" style={{ color: v('warning') }}>{dinero(b.expected_amount)}</span>
                                <span className="fz-n fz-der" style={{ color: v(tonoDe(diferencia)) }}>{conSigno(diferencia)}</span>
                            </div>
                        );
                    })}
                    <div className="fz-fila fz-total">
                        <span className="fz-rot">Total</span>
                        <span className="fz-n fz-der">{dinero(totalActual)}</span>
                        <span className="fz-n fz-der" style={{ color: v('warning') }}>{dinero(totalPorPagar)}</span>
                        <span className="fz-n fz-der" style={{ color: v(tonoDe(totalActual - totalPorPagar)) }}>
                            {conSigno(totalActual - totalPorPagar)}
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ------------------------------------------------------------------------------------------------
// Anuncios

const Anuncios = ({ mes }) => {
    const pedir = useCallback(() => apiFz.getAnuncios(mes), [mes]);
    const [datos, , setDatos] = useDatos(pedir, mes);

    const guardar = async (n) => {
        try {
            setDatos(await apiFz.guardarAnuncios(mes, n));
            toast.success('Presupuesto de anuncios guardado');
        } catch {
            toast.error('No se pudo guardar el presupuesto');
        }
    };

    if (!datos) return <EsqueletoTablero rotulo="Cargando los anuncios…" />;
    const diferencia = (datos.budget || 0) - (datos.spent || 0);

    return (
        <div className="fz-grid fz-grid--3">
            <Cifron rotulo="Presupuesto (A)" valor={dinero(datos.budget)} humo={HUMOS.marca}
                ayuda="Lo que se planea invertir en anuncios este mes. Es el monto que entra en los gastos del resumen.">
                <CampoMonto valor={datos.budget} onGuardar={guardar} etiqueta="Presupuesto de anuncios" />
            </Cifron>
            <Cifron rotulo="Gastado (B)" valor={dinero(datos.spent)} tono="warning" humo={HUMOS.gasto}
                sub="Sale del registro de inversión de Marketing"
                ayuda="La inversión real del mes según los períodos de gasto cargados en Marketing." />
            <Cifron rotulo="Diferencia (A − B)" valor={conSigno(diferencia)} tono={tonoDe(diferencia)}
                humo={HUMOS.info} sub={diferencia >= 0 ? 'Queda presupuesto' : 'Se pasó del presupuesto'}
                ayuda="Presupuesto menos lo gastado: positivo si sobra, negativo si se gastó de más." />
        </div>
    );
};

// ------------------------------------------------------------------------------------------------
// Nómina

const INTEGRANTE_VACIO = { name: '', role: '', salary_type: 'fijo', base_salary: '', payment_method: 'Mercury' };

const ModalIntegrante = ({ integrante, onGuardar, onCerrar }) => {
    const [form, setForm] = useState(integrante
        ? { name: integrante.name, role: integrante.role, salary_type: integrante.salary_type,
            base_salary: integrante.base_salary, payment_method: integrante.payment_method || 'Mercury' }
        : INTEGRANTE_VACIO);
    const [guardando, setGuardando] = useState(false);
    const cambiar = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }));

    const enviar = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            await onGuardar({ ...form, base_salary: parseFloat(form.base_salary) || 0 });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
            <form className="modal" role="dialog" aria-modal="true" style={{ width: 'min(520px, 100%)' }}
                aria-label={integrante ? 'Editar integrante' : 'Nuevo integrante'} onSubmit={enviar}>
                <div className="modal-cab" style={{ alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="t-eyebrow">Configuración salarial</p>
                        <h2 className="t-h3">{integrante ? `Editar a ${integrante.name}` : 'Nuevo integrante'}</h2>
                    </div>
                    <button type="button" className="ibtn" onClick={onCerrar} aria-label="Cerrar"><X /></button>
                </div>
                <div style={{ display: 'grid', gap: 'var(--s4)' }}>
                    <label className="campo">
                        <span className="t-rotulo">Nombre</span>
                        <input required value={form.name} onChange={cambiar('name')} placeholder="Ej: Juan Pérez" />
                    </label>
                    <div className="fz-grid fz-grid--2">
                        <label className="campo">
                            <span className="t-rotulo">Rol</span>
                            <input required value={form.role} onChange={cambiar('role')} placeholder="Ej: Setter, Closer" />
                        </label>
                        <label className="campo">
                            <span className="t-rotulo">Tipo de sueldo</span>
                            <select className="fz-select" value={form.salary_type} onChange={cambiar('salary_type')}>
                                <option value="fijo">Fijo</option>
                                <option value="variable">Variable (comisión)</option>
                            </select>
                        </label>
                    </div>
                    <div className="fz-grid fz-grid--2">
                        <label className="campo">
                            <span className="t-rotulo">Sueldo base ($)</span>
                            <input type="number" step="0.01" value={form.base_salary} onChange={cambiar('base_salary')} placeholder="0.00" />
                        </label>
                        <label className="campo">
                            <span className="t-rotulo">Medio de pago</span>
                            <select className="fz-select" value={form.payment_method} onChange={cambiar('payment_method')}>
                                {PASARELAS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </label>
                    </div>
                </div>
                <div className="fila" style={{ justifyContent: 'flex-end', marginTop: 'var(--s6)' }}>
                    <button type="button" className="btn btn--linea btn--sm" onClick={onCerrar}>Cancelar</button>
                    <button type="submit" className="btn btn--cta btn--sm" disabled={guardando}>
                        {guardando ? 'Guardando…' : integrante ? 'Guardar cambios' : 'Crear integrante'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// La comisión es más ancha que los otros montos: a su lado va la marca «manual» cuando la hay.
const COLS_NOMINA = { '--cols': 'minmax(150px,1.3fr) 130px 200px 130px 120px 120px 64px 82px', '--min': '1070px' };

/**
 * La marca de una comisión cargada a mano (08/10/2026): la calculada ya no la pisa hasta que se
 * vuelve a ella con un clic. En el `title` va la calculada, para ver qué se recupera. Sin el campo
 * (un backend que todavía no lo manda) no hay marca.
 */
const MarcaManual = ({ fila, onVolver }) => {
    const calculada = fila.commissions_auto == null ? null : dinero(fila.commissions_auto);
    return (
        <button type="button" className="fz-manual" onClick={onVolver}
            title={calculada ? `Cargada a mano. La calculada es ${calculada}: tocá para volver a ella.`
                : 'Cargada a mano: tocá para volver a la calculada.'}
            aria-label={`Volver a la comisión calculada de ${fila.member_name}${calculada ? ` (${calculada})` : ''}`}>
            <small>manual</small>
            <RotateCcw aria-hidden="true" />
        </button>
    );
};

const FilaNomina = ({ fila, integrante, onCambiar, onEditar, onEliminar }) => {
    // Un medio que no es una pasarela ('Stripe' de los integrantes viejos) se paga por Mercury:
    // es lo que suma «Medios de pago» (ver `manage_balances`), así que es lo que se muestra.
    const medio = PASARELAS.includes(fila.payment_method) ? fila.payment_method : 'Mercury';
    const total = (fila.base_salary || 0) + (fila.commissions || 0) + (fila.bonuses || 0);
    return (
        <div className="fz-fila" style={fila.is_paid ? { opacity: 0.7 } : undefined}>
            <span className="fz-nom">
                <b>{fila.member_name}</b>
                <small>{integrante?.role || 'Integrante'}</small>
            </span>
            <CampoMonto valor={fila.base_salary} etiqueta={`Sueldo base de ${fila.member_name}`}
                onGuardar={(n) => onCambiar(fila, 'base_salary', n)} />
            <span className="fz-comision">
                {fila.commissions_manual && (
                    <MarcaManual fila={fila} onVolver={() => onCambiar(fila, 'commissions_manual', false)} />
                )}
                <CampoMonto valor={fila.commissions} etiqueta={`Comisión de ${fila.member_name}`}
                    onGuardar={(n) => onCambiar(fila, 'commissions', n)} />
            </span>
            <CampoMonto valor={fila.bonuses} etiqueta={`Bonos de ${fila.member_name}`}
                onGuardar={(n) => onCambiar(fila, 'bonuses', n)} />
            <span className="fz-n fz-der">{dinero(total)}</span>
            <select className="fz-select" value={medio} aria-label={`Medio de pago de ${fila.member_name}`}
                onChange={(e) => onCambiar(fila, 'payment_method', e.target.value)}>
                {PASARELAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <span className="fz-centro" style={{ display: 'flex' }}>
                <button type="button" className="fz-check" aria-pressed={!!fila.is_paid}
                    aria-label={`${fila.is_paid ? 'Desmarcar' : 'Marcar'} como pagado a ${fila.member_name}`}
                    onClick={() => onCambiar(fila, 'is_paid', !fila.is_paid)}>
                    <Check />
                </button>
            </span>
            <span className="fz-acciones">
                <button type="button" className="ibtn ibtn--sm" title="Editar" aria-label={`Editar a ${fila.member_name}`}
                    onClick={() => onEditar(integrante)} disabled={!integrante}>
                    <Pencil />
                </button>
                <InlineConfirm tema="oscuro" compacto alto={32} tamIcono={13} label={`Eliminar a ${fila.member_name}`}
                    question="¿Borrar?" confirmLabel="Sí" doneLabel="Borrado"
                    onConfirm={() => onEliminar(fila)} />
            </span>
        </div>
    );
};

const totalNomina = (filas) => filas.reduce((s, f) => s + (f.base_salary || 0) + (f.commissions || 0) + (f.bonuses || 0), 0);
const nIntegrantes = (n) => `${n} ${n === 1 ? 'integrante' : 'integrantes'}`;

/**
 * Las tres cifras de arriba de la nómina (08/10/2026): el total, lo pagado (las filas tildadas) y
 * lo que falta pagar (las que no). Al tildar una fila las dos últimas cuentan hasta su valor nuevo.
 */
const TotalesNomina = ({ filas, rotulo }) => {
    const pagadas = filas.filter(f => f.is_paid);
    const total = totalNomina(filas);
    const pagado = totalNomina(pagadas);
    return (
        <div className="fz-grid fz-grid--3">
            <Cifron rotulo={rotulo} valor={dinero(total)} humo={HUMOS.marca} sub={nIntegrantes(filas.length)}
                ayuda="Sueldos, comisiones y bonos de todo el equipo: lo mismo que suma la fila Total de la tabla." />
            <Cifron rotulo="Pagado" valor={dinero(pagado)} tono="success" humo={HUMOS.ingreso}
                sub={`${pagadas.length} de ${nIntegrantes(filas.length)}`}
                ayuda="La suma de las filas tildadas como pagadas." />
            <Cifron rotulo="Por pagar" valor={dinero(total - pagado)} tono="warning" humo={HUMOS.gasto}
                sub={`${filas.length - pagadas.length} de ${nIntegrantes(filas.length)}`}
                ayuda="La suma de las filas que todavía no se tildaron como pagadas." />
        </div>
    );
};

const Nomina = ({ mes }) => {
    const pedir = useCallback(() => apiFz.getNomina(mes), [mes]);
    const [datos, recargar, setDatos] = useDatos(pedir, mes);
    const [modal, setModal] = useState(null); // null | { integrante } (integrante null = nuevo)

    if (!datos) return <section className="panel"><EsqueletoFilas rotulo="Cargando la nómina…" lineas={8} /></section>;
    const { nomina, integrantes } = datos;
    const integranteDe = (fila) => integrantes.find(i => i.id === fila.member_id);

    // Solo el campo que cambió (08/10/2026). Antes iba la fila entera: tildar «pagado» o tocar el
    // sueldo guardaba también la comisión de ese momento, y cambiar después los % en Payroll ya no
    // se reflejaba. Ahora la comisión queda en el cálculo hasta que se la edita (y se marca manual).
    const cambiar = async (fila, campo, valor) => {
        try {
            const guardada = await apiFz.guardarNomina({ member_id: fila.member_id, month: mes, [campo]: valor });
            setDatos(d => ({ ...d, nomina: d.nomina.map(p => (p.member_id === fila.member_id ? guardada : p)) }));
            toast.success('Nómina guardada');
        } catch {
            toast.error('No se pudo guardar el cambio');
        }
    };

    const guardarIntegrante = async (form) => {
        try {
            if (modal.integrante) await apiFz.editarIntegrante(modal.integrante.id, form);
            else await apiFz.crearIntegrante(form);
            toast.success(modal.integrante ? 'Integrante actualizado' : 'Integrante creado');
            setModal(null);
            await recargar();
        } catch {
            toast.error('No se pudo guardar el integrante');
        }
    };

    const eliminar = async (fila) => {
        try {
            await apiFz.eliminarIntegrante(fila.member_id);
            setDatos(d => ({ ...d, nomina: d.nomina.filter(p => p.member_id !== fila.member_id),
                integrantes: d.integrantes.filter(i => i.id !== fila.member_id) }));
        } catch {
            toast.error('No se pudo eliminar el integrante');
        }
    };

    const grupos = [
        { key: 'fijo', label: 'Equipo fijo', tono: 'info', filas: nomina.filter(f => integranteDe(f)?.salary_type !== 'variable') },
        { key: 'variable', label: 'Equipo variable · comisiones', tono: 'success', filas: nomina.filter(f => integranteDe(f)?.salary_type === 'variable') },
    ];
    const total = totalNomina(nomina);

    return (
        <>
            <TotalesNomina filas={nomina} rotulo="Total del mes" />
            <section className="panel">
                <PanelCab titulo="Nómina del mes"
                    tip="Sueldo fijo, comisión y bonos de cada integrante. La comisión se calcula sola desde las ventas con los porcentajes de Payroll, y sigue al cálculo aunque se cambie el sueldo, los bonos, el medio o el pagado. Si la escribís a mano queda marcada «manual» y vale esa, hasta que vuelvas a la calculada desde la marca.">
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => setModal({ integrante: null })}>
                        <Plus /> Nuevo integrante
                    </button>
                </PanelCab>
                <div className="fz-scroll">
                    <div className="fz-tabla" style={COLS_NOMINA}>
                        <div className="fz-cab">
                            <span>Integrante</span>
                            <span className="fz-der">Sueldo base</span>
                            <span className="fz-der">Comisión</span>
                            <span className="fz-der">Bonos</span>
                            <span className="fz-der">Total</span>
                            <span>Medio de pago</span>
                            <span className="fz-centro">Pagado</span>
                            <span />
                        </div>
                        {grupos.map(g => (
                            <React.Fragment key={g.key}>
                                <p className="fz-grupo" style={{ '--c': v(g.tono) }}><i />{g.label}</p>
                                {g.filas.map(fila => (
                                    <FilaNomina key={fila.member_id} fila={fila} integrante={integranteDe(fila)}
                                        onCambiar={cambiar} onEliminar={eliminar}
                                        onEditar={(integrante) => setModal({ integrante })} />
                                ))}
                                {g.filas.length === 0 && <p className="fz-vacio">Nadie en este grupo.</p>}
                            </React.Fragment>
                        ))}
                        <div className="fz-fila fz-total">
                            <span className="fz-rot">Total del mes · {nombreDelMes(mes)}</span>
                            <span /><span /><span />
                            <span className="fz-n fz-der">{dinero(total)}</span>
                            <span /><span /><span />
                        </div>
                    </div>
                </div>
                {modal && <ModalIntegrante integrante={modal.integrante} onGuardar={guardarIntegrante} onCerrar={() => setModal(null)} />}
            </section>
        </>
    );
};

// ------------------------------------------------------------------------------------------------
// Software

const hoyIso = () => new Date().toISOString().slice(0, 10);

const Software = ({ mes }) => {
    const pedir = useCallback(() => apiFz.getGastosSoftware(mes), [mes]);
    const [gastos, recargar, setGastos] = useDatos(pedir, mes);
    const [nuevo, setNuevo] = useState({ description: '', amount: '', date: hoyIso() });
    const [guardando, setGuardando] = useState(false);

    const registrar = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            await apiFz.crearGasto({ ...nuevo, amount: parseFloat(nuevo.amount) });
            toast.success('Gasto registrado');
            setNuevo({ description: '', amount: '', date: hoyIso() });
            await recargar();
        } catch {
            toast.error('No se pudo registrar el gasto');
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async (gasto) => {
        try {
            await apiFz.eliminarGasto(gasto.id);
            setGastos(lista => lista.filter(g => g.id !== gasto.id));
        } catch {
            toast.error('No se pudo eliminar el gasto');
        }
    };

    const total = (gastos || []).reduce((s, g) => s + (g.amount || 0), 0);

    return (
        <div className="fz-grid fz-grid--2" style={{ alignItems: 'start' }}>
            <form className="panel" onSubmit={registrar}>
                <PanelCab titulo="Nuevo gasto" tip="Una suscripción o herramienta pagada. Entra en los gastos del mes de su fecha." />
                <div style={{ display: 'grid', gap: 'var(--s4)' }}>
                    <label className="campo">
                        <span className="t-rotulo">Descripción</span>
                        <input required value={nuevo.description} placeholder="Ej: Suscripción de Zoom"
                            onChange={(e) => setNuevo(n => ({ ...n, description: e.target.value }))} />
                    </label>
                    <div className="fz-grid fz-grid--2">
                        <label className="campo">
                            <span className="t-rotulo">Monto ($)</span>
                            <input required type="number" step="0.01" value={nuevo.amount} placeholder="0.00"
                                onChange={(e) => setNuevo(n => ({ ...n, amount: e.target.value }))} />
                        </label>
                        <label className="campo">
                            <span className="t-rotulo">Fecha de pago</span>
                            <input required type="date" value={nuevo.date}
                                onChange={(e) => setNuevo(n => ({ ...n, date: e.target.value }))} />
                        </label>
                    </div>
                    <button type="submit" className="btn btn--cta" disabled={guardando}>
                        <Plus /> {guardando ? 'Registrando…' : 'Registrar gasto'}
                    </button>
                </div>
            </form>

            <section className="panel">
                <PanelCab titulo="Software del mes" tip="Los gastos de software con fecha en el mes elegido.">
                    {gastos && <span className="chip" style={{ '--c': v('warning') }}>{dinero(total)}</span>}
                </PanelCab>
                {!gastos ? <EsqueletoFilas rotulo="Cargando los gastos…" lineas={4} /> : (
                    <div className="fz-tabla" style={{ '--cols': 'minmax(0,1fr) 70px 110px 40px' }}>
                        <div className="fz-cab"><span>Descripción</span><span>Fecha</span><span className="fz-der">Monto</span><span /></div>
                        {gastos.map(g => (
                            <div key={g.id} className="fz-fila">
                                <span className="trunc" style={{ fontWeight: 700 }}>{g.description}</span>
                                <span className="tdatos-p" style={{ textAlign: 'left' }}>{g.date?.slice(8, 10)}/{g.date?.slice(5, 7)}</span>
                                <span className="fz-n fz-der" style={{ color: v('error') }}>{dinero(-(g.amount || 0))}</span>
                                <span className="fz-acciones">
                                    <InlineConfirm tema="oscuro" compacto alto={32} tamIcono={13} label={`Eliminar ${g.description}`}
                                        question="¿Borrar?" confirmLabel="Sí" doneLabel="Borrado" onConfirm={() => eliminar(g)} />
                                </span>
                            </div>
                        ))}
                        {gastos.length === 0 && <p className="fz-vacio">No hay gastos de software este mes.</p>}
                    </div>
                )}
            </section>
        </div>
    );
};

// ------------------------------------------------------------------------------------------------

const VISTAS = { resumen: Resumen, medios: MediosDePago, anuncios: Anuncios, nomina: Nomina, software: Software };

const Finanzas = ({ tab, mes }) => {
    const Vista = VISTAS[tab] || Resumen;
    return <Vista key={`${tab}-${mes}`} mes={mes} />;
};

export default Finanzas;
