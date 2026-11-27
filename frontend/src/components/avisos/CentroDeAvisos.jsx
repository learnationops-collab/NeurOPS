import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, EmptyState, Modal, ModalHeader } from '../standard';
import { useAuth } from '../../contexts/AuthContext';
import { AVISOS_EVENT, publicarSinLeer } from '../../utils/avisosBus';
import api from '../../services/api';
import { abrirVentana } from '../../ventanas/ventanasStore';
import './avisos.css';

// La ficha se baja recién al tocar un aviso: App la monta en todas las pantallas.
const FichaLeadModal = lazy(() => import('../ficha/FichaLeadModal'));
const CADA = 60000;
// Pedir actualización (ADR-W275): estos avisos se miran cada 15 s y salen en un toast apenas llegan.
const PEDIDOS = ['pedido_actualizacion', 'respuesta_actualizacion'];
const CADA_URGENTE = 15000;
const MOSTRADOS = 'avisos_urgentes_mostrados';
const yaMostrados = () => new Set(JSON.parse(sessionStorage.getItem(MOSTRADOS) || '[]'));

const cuando = (iso) => new Date(iso).toLocaleString('es-AR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

/**
 * La campanita (docs/plan_notas_avisos_settings.md, etapa 3): los avisos de `avisos_service.avisar`.
 * Se monta una vez en App, como el widget de reportes: el closer trabaja en /closer/deck, que no usa
 * MainLayout. Sondea la cuenta cada minuto y la publica para el avatar del dock; la lista se abre desde
 * «Avisos» del menú de sesión. Tocar un aviso lo marca leído y, si es de un lead, abre su ficha.
 */
const CentroDeAvisos = () => {
    const { user } = useAuth();
    const [abierto, setAbierto] = useState(false);
    const [avisos, setAvisos] = useState(null);
    const [ficha, setFicha] = useState(null);

    const contar = useCallback(() => {
        api.get('/avisos/cuenta').then(({ data }) => publicarSinLeer(data.sin_leer)).catch(() => {});
    }, []);

    const cargar = useCallback(() => {
        api.get('/avisos').then(({ data }) => {
            setAvisos(data.avisos);
            publicarSinLeer(data.sin_leer);
        }).catch(() => setAvisos([]));
    }, []);

    useEffect(() => {
        if (!user) return undefined;
        contar();
        const id = setInterval(contar, CADA);
        window.addEventListener('focus', contar);
        return () => { clearInterval(id); window.removeEventListener('focus', contar); };
    }, [user, contar]);

    useEffect(() => {
        if (!user) return undefined;
        const mirar = () => {
            if (document.visibilityState !== 'visible') return;
            api.get('/avisos/urgentes').then(({ data }) => {
                const vistos = yaMostrados();
                const nuevos = data.avisos.filter((a) => !vistos.has(a.id));
                if (!nuevos.length) return;
                nuevos.forEach((a) => vistos.add(a.id));
                sessionStorage.setItem(MOSTRADOS, JSON.stringify([...vistos].slice(-200)));
                contar();
                nuevos.slice(0, 3).forEach((a) => toast((t) => (
                    <button type="button" className="aviso-toast" onClick={() => { toast.dismiss(t.id); leerRef.current(a); }}>
                        <BellRing size={16} aria-hidden="true" />
                        <span><strong>{a.asunto}</strong>{a.descripcion && <small>{a.descripcion}</small>}</span>
                    </button>
                ), { duration: 12000, id: `aviso-${a.id}` }));
            }).catch(() => {});
        };
        mirar();
        const id = setInterval(mirar, CADA_URGENTE);
        return () => clearInterval(id);
    }, [user, contar]);

    useEffect(() => {
        const abrir = () => { setAbierto(true); cargar(); };
        window.addEventListener(AVISOS_EVENT, abrir);
        return () => window.removeEventListener(AVISOS_EVENT, abrir);
    }, [cargar]);

    const leer = (aviso) => {
        if (!aviso.leido) {
            setAvisos((lista) => lista && lista.map((a) => (a.id === aviso.id ? { ...a, leido: true } : a)));
            api.post(`/avisos/${aviso.id}/leido`).then(contar).catch(() => {});
        }
        // Una etiqueta del chat del equipo (ADR-W174): abre la ventana Chat.
        if (aviso.origen === 'chat') {
            setAbierto(false);
            abrirVentana('chat');
            return;
        }
        if (aviso.person_uuid || (PEDIDOS.includes(aviso.tipo) && aviso.origen_id)) {
            setAbierto(false);
            setFicha({
                personUuid: aviso.person_uuid,
                appointmentId: aviso.origen === 'appointment' ? aviso.origen_id : null,
                pestana: aviso.tipo === 'nota' ? 'com' : PEDIDOS.includes(aviso.tipo) ? 'conf' : null,
            });
        }
    };

    const leerRef = useRef(leer);
    useEffect(() => { leerRef.current = leer; });

    const leerTodos = () => {
        setAvisos((lista) => lista.map((a) => ({ ...a, leido: true })));
        api.post('/avisos/leidos').then(contar).catch(() => {});
    };

    if (!user) return null;
    const hayNuevos = avisos?.some((a) => !a.leido);

    return (
        <>
            {abierto && (
                <Modal onClose={() => setAbierto(false)} labelledBy="avisos-titulo" className="avisos-modal">
                    <ModalHeader titleId="avisos-titulo" title="Avisos" icon={<Bell size={20} />}
                        subtitle="Los últimos tres meses"
                        actions={hayNuevos && <Button size="sm" variant="ghost" onClick={leerTodos}>Marcar todo como leído</Button>}
                        onClose={() => setAbierto(false)} />
                    {avisos && !avisos.length && (
                        <EmptyState icon={<Bell size={28} />} title="Sin avisos">
                            Acá aparecen las notas sobre tus leads, las agendas nuevas y lo que el sistema necesita que mires.
                        </EmptyState>
                    )}
                    {avisos?.length > 0 && (
                        <ul className="avisos-lista">
                            {avisos.map((a) => (
                                <li key={a.id}>
                                    <button type="button" className={`aviso${a.leido ? '' : ' aviso--nuevo'}`} onClick={() => leer(a)}>
                                        <span className="aviso__cab">
                                            <span className="aviso__rotulo">{a.rotulo}</span>
                                            <time dateTime={a.created_at}>{cuando(a.created_at)}</time>
                                        </span>
                                        <strong className="aviso__asunto">{a.asunto}</strong>
                                        {a.descripcion && <span className="aviso__texto">{a.descripcion}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Modal>
            )}
            {ficha && createPortal(
                <Suspense fallback={null}>
                    <FichaLeadModal personUuid={ficha.personUuid} appointmentId={ficha.appointmentId}
                        pestanaInicial={ficha.pestana} onCerrar={() => { setFicha(null); contar(); }} />
                </Suspense>,
                document.body,
            )}
        </>
    );
};

export default CentroDeAvisos;
