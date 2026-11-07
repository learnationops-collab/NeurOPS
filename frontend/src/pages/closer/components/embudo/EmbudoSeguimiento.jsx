import { useEffect, useState } from 'react';
import { Button } from '../../../../components/standard';
import { Esqueleto, Hueso, useVentanaDeEntrada } from '../../../../components/huesos/Huesos';
import useEmbudo from './useEmbudo';
import TarjetaEmbudo from './TarjetaEmbudo';
import DiasDelEmbudo from './DiasDelEmbudo';
import './embudo.css';

const pct = (a, b) => `${Math.round((a / Math.max(1, b)) * 100)}%`;

// Lo que la ficha necesita para abrir el seguimiento (mismo formato que la pestaña Seguir).
const aFicha = (t) => ({
    id: t.id, client_id: t.client_id, person_uuid: t.person_uuid, lead_name: t.lead_name,
    instagram: t.instagram, phone: t.phone, examen: t.examen, origin: t.origin, fase: 'seg',
    tipo: t.tipo, closer_notes: t.closer_notes, call_date: t.call_date,
});

/**
 * Embudo de seguimiento después de la llamada (ADR-W120): una columna por día del embudo y la de
 * los que respondieron. Cada seguimiento se registra con «Respondió» o «No respondió»; si no
 * respondió, el lead pasa al día siguiente, y después del último vuelve al pool.
 */
const EmbudoSeguimiento = ({ refreshKey, onOpenLead }) => {
    const { datos, ultimo, ocupado, registrar, deshacer, devolver, guardarDias, olvidarUltimo } = useEmbudo(refreshKey);
    const [abierta, setAbierta] = useState(null);
    const [foco, setFoco] = useState(null);
    const [entrando, abrirEntrada] = useVentanaDeEntrada();
    const cargando = !datos;

    useEffect(() => { if (datos && !datos.error) abrirEntrada(); }, [!!datos]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!foco) return;
        document.querySelector(`[data-embudo="${foco}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [foco]);

    if (cargando) {
        return (
            <Esqueleto rotulo="Cargando el embudo…" className="emb">
                <div className="emb-resumen"><Hueso alto={92} radio={20} /><Hueso alto={92} radio={20} paso={1} /><Hueso alto={92} radio={20} paso={2} /></div>
                <div className="emb-kb" style={{ '--cols': 4 }}>
                    {[0, 1, 2, 3].map(i => <Hueso key={i} alto={260} radio={28} paso={i} />)}
                </div>
            </Esqueleto>
        );
    }
    if (datos.error) return <div className="emb-vacio">No se pudo cargar el embudo de seguimiento.</div>;

    const dias = datos.config.dias;
    const { resumen } = datos;
    const pendientes = datos.columnas.flatMap(c => c.tarjetas);
    const siguiente = [...pendientes].filter(t => !t.proximo)
        .sort((a, b) => (b.atrasado - a.atrasado) || (b.dia - a.dia))[0];
    const resueltosDe = resumen.resueltos_hoy + resumen.para_hoy;
    const siguienteDe = (d) => dias.find(x => x > d);

    const alRegistrar = async (t, resultado) => {
        const prox = siguienteDe(t.dia);
        const texto = resultado === 'respondio' ? `${t.lead_name} respondió y salió del embudo.`
            : prox ? `Seguiste a ${t.lead_name}. Pasa al Día ${prox}.`
                : `${t.lead_name} terminó el embudo sin respuesta y volvió al pool.`;
        setAbierta(null);
        setFoco(null);
        await registrar(t, resultado, texto);
    };

    const columna = (titulo, sub, clase, tarjetas, vacio, respondio, ci) => (
        <section key={titulo} className={`kcol-v6 ${clase}`}>
            <div className="kch-v6">
                <span className="dt-v6"></span>
                <b>{titulo}</b>
                <span className="n-v6">{tarjetas.length}</span>
                <small className="emb-sub">{sub}</small>
            </div>
            <div className="kbody-v6">
                {tarjetas.length ? tarjetas.map((t, i) => (
                    <TarjetaEmbudo key={t.id} t={t} respondio={respondio} orden={i * (dias.length + 1) + ci} escalonar={entrando}
                        abierta={abierta === t.id} enfocada={foco === t.id} siguienteDia={siguienteDe(t.dia)} ocupado={ocupado}
                        onAbrir={(x) => setAbierta(x.id)} onCerrar={() => setAbierta(null)}
                        onRegistrar={alRegistrar} onDevolver={devolver} onFicha={(x) => onOpenLead(aFicha(x))} />
                )) : <div className={`kempty-v6${respondio ? '' : ' done-v6'}`}>{vacio}</div>}
            </div>
        </section>
    );

    return (
        <div className="emb">
            <div className="emb-resumen">
                <div className="emb-panel emb-panel--siguiente">
                    <small className="emb-rotulo">Siguiente del embudo</small>
                    {siguiente ? (
                        <>
                            <b className="emb-nombre" title={siguiente.lead_name}>{siguiente.lead_name}</b>
                            <span className="emb-pista">Día {siguiente.dia}{siguiente.atrasado ? ' · atrasado' : ''}{siguiente.instagram ? ` · ${siguiente.instagram}` : ''}</span>
                            <Button variant="primary" onClick={() => { setFoco(siguiente.id); setAbierta(siguiente.id); }}>Ir a seguir →</Button>
                        </>
                    ) : (
                        <>
                            <b className="emb-nombre">Hoy no te queda nadie por seguir</b>
                            <span className="emb-pista">Los que respondieron están en la última columna.</span>
                        </>
                    )}
                </div>
                <div className="emb-panel">
                    <div className="emb-fila">
                        <small className="emb-rotulo">Seguimientos de hoy</small>
                        {resumen.atrasados > 0 && <span className="ktag-v6" style={{ '--c': 'var(--cl-warning)' }}>{resumen.atrasados} atrasados</span>}
                    </div>
                    <b className="emb-cifra">{pct(resumen.resueltos_hoy, resueltosDe)}</b>
                    <div className="pbarw-v6"><i style={{ width: pct(resumen.resueltos_hoy, resueltosDe) }}></i></div>
                    <div className="emb-fila">
                        <span className="emb-pista">{resumen.resueltos_hoy} de {resueltosDe} resueltos</span>
                        <span className="emb-pista">{resumen.pendientes} pendientes</span>
                    </div>
                </div>
                <div className="emb-panel">
                    <small className="emb-rotulo">Tasa de respuesta</small>
                    <b className="emb-cifra">{pct(resumen.respondieron, resumen.total)}</b>
                    <span className="emb-pista">{resumen.respondieron} de {resumen.total} respondieron dentro del embudo</span>
                    <span className="emb-pista">
                        {resumen.agotados ? `${resumen.agotados} ${resumen.agotados === 1 ? 'volvió' : 'volvieron'} al pool después del Día ${dias[dias.length - 1]}` : 'Nadie volvió al pool todavía'}
                    </span>
                </div>
            </div>

            <DiasDelEmbudo dias={dias} editable={datos.puede_editar}
                enDia={(d) => datos.columnas.find(c => c.dia === d)?.tarjetas.length || 0}
                onGuardar={guardarDias} />

            {ultimo && (
                <div className="emb-deshacer">
                    <span>{ultimo.texto}</span>
                    <div className="emb-fila">
                        <Button variant="ghost" disabled={ocupado} onClick={deshacer}>Deshacer</Button>
                        <button type="button" className="emb-link" aria-label="Cerrar" onClick={olvidarUltimo}>×</button>
                    </div>
                </div>
            )}

            <div className="kb-v6 emb-kb" style={{ '--cols': dias.length + 1 }}>
                {datos.columnas.map((c, i) => columna(`Día ${c.dia}`, c.dia === 1 ? 'Día siguiente' : `${c.dia} días después`,
                    i === 0 ? 'k2-v6' : 'k1-v6', c.tarjetas, `Nadie en el Día ${c.dia} hoy`, false, i))}
                {columna('Respondieron', 'Salen del embudo', 'k3-v6', datos.respondieron, 'Todavía nadie respondió', true, dias.length)}
            </div>
        </div>
    );
};

export default EmbudoSeguimiento;
