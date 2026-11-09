import React from 'react';
import { fmt, Tip, useMontado } from './Shared';
import Cifra from './Cifra';
import { abrir } from '../../../components/dashboard/MetricaClicable';
import { DESTINOS_CLOSER as D } from './destinos';
import { Panel, PanelCab, v } from './PiezasAnalizar';
import { Tocable } from './PanelCash';

/**
 * Por cobrar a hoy (09/11/2026, separado de Cash por pedido de Mario): el saldo de las inscripciones vivas,
 * partido en vencido, por vencer y sin cronograma. No es del período: no cambia con las fechas ni compara.
 * El total arriba con la barra partida (cada tramo abre su lista) y una tarjeta-botón por parte.
 */
const PARTES = [
    { label: 'Vencido', campo: 'vencido', tone: 'error', destino: 'por_cobrar_vencido',
        help: 'Cuotas con vencimiento ya pasado y sin pagar: plata que había que cobrar y no se cobró.' },
    { label: 'Por vencer', campo: 'por_vencer', tone: 'info', destino: 'por_cobrar_por_vencer',
        help: 'Cuotas con fecha futura: el cronograma normal.' },
    { label: 'Sin cronograma', campo: 'sin_plan', tone: 'warning', destino: 'por_cobrar_sin_plan',
        help: 'Saldo sin ninguna cuota programada: nadie le armó un plan de cobro.' },
];

const PanelPorCobrar = ({ porCobrar, irA }) => {
    const montado = useMontado();
    const total = porCobrar.total || 0;
    const pct = (x) => (total ? Math.round((x / total) * 100) : 0);
    return (
        <Panel id="p-por-cobrar" className="pp" cab={
            <PanelCab titulo="Por cobrar"
                ayuda={'El precio que negoció cada cliente menos lo que ya pagó, a hoy. No depende del período '
                    + 'elegido arriba.'}>
                <span className="pp-hoy">a hoy</span>
            </PanelCab>
        }>
            <div className="pp-top">
                <Tocable className="pp-total" onClick={abrir(irA, D.por_cobrar)} titulo="Ver todos los saldos">
                    <Cifra className="pp-total-n num" valor={fmt.money(total)} />
                    <span className="pp-chips">
                        <small className="num">{fmt.plural(porCobrar.clientes, 'cliente', 'clientes')} con saldo</small>
                        {porCobrar.clientes_vencido > 0 && (
                            <small className="num pp-chip-mal">{porCobrar.clientes_vencido} con cuota vencida</small>
                        )}
                    </span>
                </Tocable>
                <div className="pp-barra">
                    {PARTES.map(x => porCobrar[x.campo] > 0 && (
                        <button key={x.campo} type="button" onClick={abrir(irA, D[x.destino])}
                            title={`${x.label}: ${fmt.money(porCobrar[x.campo])} (${pct(porCobrar[x.campo])}%)`}
                            style={{ flex: montado ? porCobrar[x.campo] : 0.0001, background: v(x.tone) }}>
                            {pct(porCobrar[x.campo]) >= 12 && <span className="num">{pct(porCobrar[x.campo])}%</span>}
                        </button>
                    ))}
                </div>
            </div>
            <div className="pp-partes">
                {PARTES.map((x, i) => (
                    <Tocable key={x.campo} className="pp-parte" style={{ '--c': v(x.tone), '--i': i }}
                        onClick={porCobrar[x.campo] ? abrir(irA, D[x.destino]) : undefined}
                        titulo={`Ver las cuotas: ${x.label.toLowerCase()}`}>
                        <span className="pp-rot"><i />{x.label}<Tip titulo={x.label} texto={x.help} /></span>
                        <Cifra className="pp-n num" valor={fmt.money(porCobrar[x.campo])} />
                        <span className="pp-meter" aria-hidden="true">
                            <i style={{ width: montado ? `${pct(porCobrar[x.campo])}%` : 0 }} />
                        </span>
                        <small className="pp-pct num">{pct(porCobrar[x.campo])}% del total</small>
                    </Tocable>
                ))}
            </div>
        </Panel>
    );
};

export default PanelPorCobrar;
