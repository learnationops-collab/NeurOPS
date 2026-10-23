import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Fraccion, Pct, Riel, n, plural } from './piezasCierres';
import ModalCierres from './ModalCierres';
import './cierres-reales.css';

/**
 * El close rate real, arriba de la matriz de cierres (pedido del usuario, 23/10/2026).
 *
 * Las tarjetas de abajo miden las LLAMADAS del período: cuántas terminaron en venta. Una seña de la
 * llamada del mes pasado que se paga este mes no está entre esas llamadas, así que no entra ahí
 * aunque sea una venta de este mes (9 ventas en el ticket y 4 en el close rate). Esta tarjeta cuenta
 * por COBRO: cada cierre, venga de la llamada de este período o de una de antes (una seña, un
 * seguimiento, una segunda llamada). La llamada anterior suma también al denominador, por eso la tasa
 * nunca pasa de 100%.
 *
 * La barra es la base entera (llamadas con show up + cierres de llamadas anteriores) y su relleno son
 * los cierres, partidos en dos colores según de dónde vienen. Lo que falta para llenarla son las
 * oportunidades que no cerraron. Los cobros sin llamada (un upsell, una venta directa) no son una
 * oportunidad del período: quedan fuera de la tasa y se cuentan aparte.
 *
 * Una sola pieza para los dos tableros: viene del bloque `cierres.reales` (ver `cierres_reales.py`).
 * El modal lista cada cobro con su origen; las filas ya vienen en el bloque, no hay pedido.
 */

const AYUDA = 'Cierres cobrados en el período ÷ (llamadas con show up + cierres de llamadas '
    + 'anteriores). Cada pago completo o split pay cuenta cuando se cobró, venga de una llamada de '
    + 'este período o de una de antes (una seña, un seguimiento, una segunda llamada). La llamada '
    + 'anterior suma también a la base: por eso nunca pasa de 100%. Los cobros sin llamada (un '
    + 'upsell, una venta directa) quedan fuera y se cuentan aparte.';

const Marca = ({ tono }) => <i className={`mcr-marca mcr-marca--${tono}`} aria-hidden="true" />;

const Dato = ({ tono, numero, texto, nota }) => (
    <li className="mcr-dato">
        <Marca tono={tono} />
        <b>{n(numero)}</b>
        <small className="mcr-dato-txt">{texto}</small>
        {nota && <small className="mcr-nota">{nota}</small>}
    </li>
);

const CierresReales = ({ reales, Ayuda }) => {
    const [lista, setLista] = useState(false);
    if (!reales) return null;
    const { cierres, del_periodo: delPeriodo, anteriores, sin_llamada: sinLlamada, por_cuota: porCuota,
        asistieron, base, pct, filas = [] } = reales;
    const cobros = cierres + sinLlamada;
    const ancho = (parte) => (base ? (parte / base) * 100 : 0);
    const texto = `Cierres ÷ (llamadas con show up + cierres de llamadas anteriores): ${n(cierres)} de ${n(base)}. `
        + AYUDA;

    return (
        <section className="mcr" aria-label="Close rate real">
            <i className="mcr-brillo" aria-hidden="true" />
            <div className="mcr-cab">
                <span className="mcr-titulo">
                    <small className="mc-eyebrow">Close rate real</small>
                    {Ayuda && <span className="mc-ayuda"><Ayuda titulo="Close rate real" texto={texto} /></span>}
                </span>
                {cobros > 0 && (
                    <button type="button" className="mcr-ver" onClick={() => setLista(true)}
                        aria-label={`Ver los ${plural(cobros, 'cobro', 'cobros')} y de qué llamada salió cada uno`}>
                        <small>Ver {plural(cobros, 'cobro', 'cobros')}</small>
                        <ChevronRight size={14} aria-hidden="true" />
                    </button>
                )}
            </div>

            <div className="mcr-cuerpo">
                <span className="mcr-cifra">
                    <Pct valor={pct} className="mcr-pct" />
                    <Fraccion num={cierres} den={base} />
                </span>
                <div className="mcr-barra">
                    <Riel className="mcr-riel" tramos={[
                        { tono: 'periodo', ancho: ancho(delPeriodo), demora: 140 },
                        { tono: 'anterior', ancho: ancho(anteriores), demora: 380 },
                    ]} />
                    <small className="mcr-base">
                        Base: <b>{n(asistieron)}</b> {asistieron === 1 ? 'llamada' : 'llamadas'} con show up
                        {anteriores > 0 && <> + <b>{n(anteriores)}</b> {anteriores === 1 ? 'llamada anterior' : 'llamadas anteriores'} que cerraron</>}
                    </small>
                </div>
            </div>

            <ul className="mcr-datos">
                <Dato tono="periodo" numero={delPeriodo} texto={delPeriodo === 1 ? 'de una llamada del período' : 'de llamadas del período'} />
                <Dato tono="anterior" numero={anteriores}
                    texto={anteriores === 1 ? 'de una llamada anterior' : 'de llamadas anteriores'}
                    nota="seña, seguimiento o segunda llamada" />
                {sinLlamada > 0 && (
                    <Dato tono="sin" numero={sinLlamada} texto={sinLlamada === 1 ? 'cobro sin llamada' : 'cobros sin llamada'}
                        nota="fuera de la tasa" />
                )}
                {porCuota > 0 && (
                    <Dato tono="cuota" numero={porCuota}
                        texto={porCuota === 1 ? 'seña completada con cuota' : 'señas completadas con cuota'} />
                )}
            </ul>

            {lista && <ModalCierres filas={filas} total={cobros} onCerrar={() => setLista(false)} />}
        </section>
    );
};

export default CierresReales;
