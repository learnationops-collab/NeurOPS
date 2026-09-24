import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import api from '../../services/api';

// Mismo vocabulario de tonos que manda el backend en `etapa_cobro.tono` (lead_cobro_service),
// resuelto con las variables del design system para que el panel se vea nativo en las dos
// pantallas donde vive: el dashboard comercial y la pestaña Cliente del setter.
const TONOS = {
    error: { fondo: 'rgba(232,92,74,.12)', borde: 'rgba(232,92,74,.32)', texto: '#E85C4A' },
    warning: { fondo: 'rgba(217,164,65,.12)', borde: 'rgba(217,164,65,.32)', texto: '#D9A441' },
    primary: { fondo: 'rgba(78,139,216,.12)', borde: 'rgba(78,139,216,.32)', texto: '#4E8BD8' },
    success: { fondo: 'rgba(47,191,143,.12)', borde: 'rgba(47,191,143,.32)', texto: '#2FBF8F' },
};

const moneda = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

const Cifra = ({ rotulo, valor, color }) => (
    <div>
        <small style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.08em',
                        textTransform: 'uppercase', opacity: 0.55 }}>{rotulo}</small>
        <b style={{ fontSize: 15, fontWeight: 800, color }}>{valor}</b>
    </div>
);

/**
 * En qué momento del cobro está un cliente. **Solo lectura, a propósito.**
 *
 * El cockpit del closer resuelve el cobro: arma el plan de cuotas, registra el pago, reporta el
 * contacto. Nada de eso aplica acá — ni el setter ni la dirección comercial cobran, y los
 * endpoints que escriben (`POST /closer/deck/<id>`, `/closer/installments`) les responden 403.
 * Mostrarles los botones sería ofrecerles acciones que el backend les niega.
 *
 * Lo que sí les sirve es la lectura: al setter, saber en qué terminó el lead que agendó; a la
 * dirección, ver la cartera sin tener que pedírsela al closer. Por eso se alimenta de
 * `GET /comercial/clientes/<id>`, que es de su propia superficie y no escribe nada.
 */
const EstadoCobroCliente = ({ clientId, compacto = false }) => {
    const [ficha, setFicha] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [sinFicha, setSinFicha] = useState(false);

    useEffect(() => {
        let vigente = true;
        if (!clientId) { setCargando(false); setSinFicha(true); return undefined; }
        setCargando(true);
        setSinFicha(false);
        api.get(`/comercial/clientes/${clientId}`)
            .then(({ data }) => { if (vigente) setFicha(data); })
            .catch((err) => {
                // 404 = este cliente todavía no compró nada, que no es un error: es una respuesta.
                if (vigente) setSinFicha(true);
                if (err?.response?.status !== 404) console.error('No se pudo traer la ficha de cobro:', err);
            })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [clientId]);

    if (cargando) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                <Loader2 className="animate-spin" size={18} style={{ opacity: 0.5 }} />
            </div>
        );
    }

    if (sinFicha || !ficha) {
        return (
            <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, textAlign: 'center', padding: '16px 0' }}>
                Sin ventas registradas: todavía no hay cobro que seguir.
            </p>
        );
    }

    const { cliente, cuotas } = ficha;
    const etapa = cliente.etapa_cobro || {};
    const tono = TONOS[etapa.tono] || TONOS.primary;
    const pagado = (cliente.pagos || []).reduce((total, p) => total + (p.monto || 0), 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
            <div style={{ background: tono.fondo, border: `1px solid ${tono.borde}`,
                          borderRadius: 16, padding: '10px 14px', textAlign: 'center' }}>
                {/* Solo el título: el subtítulo que manda el backend está escrito para el closer
                    y es una orden ("cobrá o dejá agendado el próximo intento"), que no tiene
                    sentido darle a quien no puede cobrar. El título es el estado, que es lo que
                    acá se viene a ver. */}
                <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.06em',
                            textTransform: 'uppercase', color: tono.texto, margin: 0 }}>
                    {etapa.titulo || 'Cliente'}
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                <Cifra rotulo="Programa" valor={cliente.programa_nombre || 'Sin programa'} />
                <Cifra rotulo="Pagado" valor={moneda(pagado)} color={TONOS.success.texto} />
                <Cifra rotulo="Debe" valor={moneda(cliente.deuda)}
                       color={cliente.deuda > 0.01 ? TONOS.error.texto : TONOS.success.texto} />
            </div>

            {cuotas.length > 0 && (
                <div>
                    <small style={{ display: 'block', fontSize: 10, fontWeight: 800,
                                    letterSpacing: '.08em', textTransform: 'uppercase',
                                    opacity: 0.55, marginBottom: 6 }}>Plan de cuotas</small>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {cuotas.map(c => {
                            const t = c.estado === 'pagado' ? TONOS.success
                                : c.estado === 'vencido' ? TONOS.error : TONOS.warning;
                            return (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                                                         fontSize: 11, fontWeight: 700 }}>
                                    <span style={{ flex: 1 }}>Cuota {c.numero_cuota}</span>
                                    <span>{moneda(c.monto)}</span>
                                    <span style={{ opacity: 0.6 }}>{c.fecha_vencimiento}</span>
                                    <span style={{ color: t.texto, background: t.fondo,
                                                   border: `1px solid ${t.borde}`, borderRadius: 6,
                                                   padding: '1px 6px', fontSize: 9, fontWeight: 900,
                                                   textTransform: 'uppercase' }}>{c.estado}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {!compacto && (cliente.pagos || []).length > 0 && (
                <div>
                    <small style={{ display: 'block', fontSize: 10, fontWeight: 800,
                                    letterSpacing: '.08em', textTransform: 'uppercase',
                                    opacity: 0.55, marginBottom: 6 }}>Pagos cobrados</small>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {cliente.pagos.map((p, i) => (
                            <div key={`${p.date}-${i}`} style={{ display: 'flex', alignItems: 'center',
                                                                 gap: 10, fontSize: 11, fontWeight: 700 }}>
                                <span style={{ flex: 1, textTransform: 'capitalize' }}>{p.tipo || 'Pago'}</span>
                                <span>{moneda(p.monto)}</span>
                                <span style={{ opacity: 0.6 }}>{(p.date || '').slice(0, 10)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default EstadoCobroCliente;
