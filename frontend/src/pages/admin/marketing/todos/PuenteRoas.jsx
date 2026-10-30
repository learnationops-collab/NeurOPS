import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import api from '../../../../services/api';
import { useDatosCacheados } from '../../../../services/cacheDeVistas';
import { CifraConCuenta } from '../../../../components/standard';
import MarcaDeBase from '../anuncios/MarcaDeBase';
import { dinero, formatear } from '../anuncios/metricas';
import { WORKSHOP, parte } from './comparacion';
import { puenteRoas, talleresDelPeriodo } from './calculoPuente';
import './puenteRoas.css';

/**
 * De un ROAS de Workshop al otro, en números (Kerwin, 29/10/2026, ADR-W027): «Todos» (todo lo cobrado del período ÷ gasto de
 * Meta del período) a «Talleres» (lo que trajo la cohorte de los talleres del período ÷ lo invertido en ellos). Cada paso
 * dice cuánto resta al ROAS y su cuenta al pasarle el mouse; el primero abre la lista de lo cobrado de ventas anteriores.
 * Las cuentas, en `calculoPuente.js`. Sin talleres en el período, o con un segmento elegido, no se dibuja.
 */
const PASOS = {
    anterior: { rotulo: 'ventas anteriores', titulo: 'Cobrado de ventas anteriores' },
    cohorte: { rotulo: 'solo talleres', titulo: 'Solo lo que trajeron los talleres' },
    gasto: { rotulo: 'más inversión', titulo: 'Inversión de los talleres' },
};

const veces = (v) => formatear(v, 'veces');
const delta = (v) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(2)}x`;
const dia = (iso) => iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/');

const Paso = ({ paso, tip, onVer }) => {
    const { rotulo } = PASOS[paso.id];
    const tono = paso.delta < -0.005 ? 'var(--error)' : paso.delta > 0.005 ? 'var(--success)' : 'var(--text-muted)';
    const cuerpo = (
        <>
            <b className="num" style={{ color: tono }}>{delta(paso.delta)}</b>
            <small>{rotulo}</small>
        </>
    );
    return onVer && paso.lista
        ? <button type="button" className="mk-puente-paso" data-tip={tip} onClick={() => onVer(paso.lista, PASOS[paso.id].titulo)}>{cuerpo}</button>
        : <span className="mk-puente-paso" data-tip={tip} tabIndex={0}>{cuerpo}</span>;
};

const PuenteRoas = ({ fuente, rango, moneda, onVer = null }) => {
    const { datos: eventos } = useDatosCacheados('ws:events', (signal) => api.get('workshop/events', { signal }).then((r) => r.data));
    const talleres = useMemo(() => talleresDelPeriodo(Array.isArray(eventos) ? eventos : [], rango.desde, rango.hasta), [eventos, rango.desde, rango.hasta]);
    const puente = useMemo(
        () => (fuente ? puenteRoas({ cash: fuente.cash_total, anterior: fuente.cash_anterior, gasto: fuente.gasto }, talleres) : null),
        [fuente, talleres],
    );
    if (!puente) return null;
    const d = (v) => dinero(v, moneda);
    const [anterior, cohorte, gasto] = puente.pasos;
    const tips = {
        anterior: `${PASOS.anterior.titulo}: ${d(anterior.de)} de ${d(anterior.sobre)} cobrados`,
        cohorte: `${PASOS.cohorte.titulo}: ${d(cohorte.a)} de ${d(cohorte.de)} del período`,
        gasto: `${PASOS.gasto.titulo}: ${d(gasto.a)} de talleres contra ${d(gasto.de)} del período`,
    };
    const fechas = talleres.map((t) => dia(t.date)).join(', ');
    const enWorkshop = `/admin/workshops?tab=resumen&rf=periodo&rd=${rango.desde}&rh=${rango.hasta}`;
    return (
        <section className="panel mk-puente" aria-label="De un ROAS Total al otro">
            <div className="mk-puente-extremo">
                <MarcaDeBase base="periodo" color={WORKSHOP.color} detalle={`${d(fuente.cash_total)} de ${d(gasto.de)}`} />
                <CifraConCuenta color={WORKSHOP.color} rotulo="Todo lo cobrado del período"
                    cuenta={{ a: parte(d(fuente.cash_total), 'cash_total'), b: parte(`${d(gasto.de)} gastados`, 'gasto') }} onVer={onVer}>
                    <b className="num mk-puente-cifra" style={{ color: WORKSHOP.color }}>{veces(puente.todos)}</b>
                </CifraConCuenta>
            </div>
            {puente.pasos.map((p) => (
                <span key={p.id} className="mk-puente-tramo"><ArrowRight size={14} aria-hidden="true" /><Paso paso={p} tip={tips[p.id]} onVer={onVer} /></span>
            ))}
            <ArrowRight size={14} aria-hidden="true" className="mk-puente-flecha" />
            <div className="mk-puente-extremo">
                <MarcaDeBase base="taller" color={WORKSHOP.color} titulo={`${puente.cantidad} ${puente.cantidad === 1 ? 'taller' : 'talleres'}`} detalle={fechas} />
                <Link to={enWorkshop} className="mk-puente-enlace" data-tip={`Ver ${puente.cantidad === 1 ? 'el taller' : 'los talleres'} en Workshop: ${d(puente.cobradoTalleres)} de ${d(puente.invertido)}`}>
                    <b className="num mk-puente-cifra" style={{ color: WORKSHOP.color }}>{veces(puente.talleres)}</b>
                </Link>
            </div>
        </section>
    );
};

export default PuenteRoas;
