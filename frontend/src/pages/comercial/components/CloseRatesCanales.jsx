import React, { useState } from 'react';
import ModalCierres from '../../../components/dashboard/ModalCierres';
import { abrir } from '../../../components/dashboard/MetricaClicable';
import { fmt } from './Shared';
import { destinoAsistieronCanal } from './destinos';
import { CANALES } from './embudoCanales';

/**
 * Los tres close rates reales del embudo de Closing (02/11/2026): el total, el de las agendas directas y el de las
 * que vienen del triage. Los tres son la misma cuenta (`cierres_reales`): cierres cobrados ÷ (asistieron + cierres de
 * llamadas anteriores), pago completo o split pay, nunca la seña. Cada cifra abre su lista: los cierres, el modal de
 * cobros del close rate real (con el canal de cada uno); los que asistieron, la tabla de agendas.
 */
const Cifra = ({ onClick, titulo, children }) => (onClick
    ? <button type="button" onClick={onClick} title={titulo}>{children}</button>
    : <>{children}</>);

const CloseRatesCanales = ({ reales, irA }) => {
    // undefined = cerrado; null = todos los cobros; 'directa' | 'triage' = los de ese canal.
    const [lista, setLista] = useState(undefined);
    if (!reales?.por_canal) return null;

    const filas = [
        { clave: null, nombre: 'Total', color: 'var(--text-muted)', datos: reales },
        ...CANALES.map(c => ({ ...c, datos: reales.por_canal[c.clave] })),
    ];
    const cobrosDe = (clave) => (clave ? (reales.filas || []).filter(f => f.canal === clave) : (reales.filas || []));

    return (
        <div className="dc-canales-cr" role="group" aria-label="Close rate real por origen">
            {filas.map(({ clave, nombre, color, datos }) => {
                const { cierres, asistieron, anteriores, pct } = datos;
                const abrirCobros = cierres > 0 ? () => setLista(clave) : undefined;
                const abrirAsistieron = asistieron > 0 ? abrir(irA, destinoAsistieronCanal(clave)) : undefined;
                return (
                    <div className="dc-canales-cr-fila" key={nombre}>
                        <span className="dc-canales-cr-nombre">
                            <i className="dato-punto" style={{ background: color }} />
                            Close rate · {nombre}
                        </span>
                        <span className="dc-canales-cr-pct" title="Cierres ÷ (asistieron + de llamadas anteriores)">
                            {fmt.pct(pct)}
                        </span>
                        <span className="t-cap mut num">
                            <Cifra onClick={abrirCobros} titulo="Ver los cobros de estos cierres">
                                {cierres} {cierres === 1 ? 'cierre' : 'cierres'}
                            </Cifra>
                            {' · '}
                            <Cifra onClick={abrirAsistieron} titulo="Ver las agendas que asistieron">
                                {asistieron} asistieron
                            </Cifra>
                            {anteriores > 0 && (
                                <>
                                    {' + '}
                                    <Cifra onClick={abrirCobros} titulo="Cierres de llamadas de antes del período">
                                        {anteriores} {anteriores === 1 ? 'anterior' : 'anteriores'}
                                    </Cifra>
                                </>
                            )}
                        </span>
                    </div>
                );
            })}
            {lista !== undefined && (
                <ModalCierres filas={cobrosDe(lista)}
                    total={lista ? cobrosDe(lista).length : reales.cierres + reales.sin_llamada}
                    onCerrar={() => setLista(undefined)} />
            )}
        </div>
    );
};

export default CloseRatesCanales;
