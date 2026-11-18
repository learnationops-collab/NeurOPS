// La herramienta «Buscar lead» (como «Alumno» de la Academia): cualquier lead por nombre, mail, Instagram o
// teléfono, desde cualquier pantalla, y su ficha. Usa la búsqueda del mazo (`/closer/leads/search`, que
// junta los clientes y las agendas viejas de la planilla). Con una intención (ventanas/buscarLead.js) la
// ficha abre en Acciones ('pago') o en «Registrar una venta» ('venta'). Al abrir la ficha la ventana se
// minimiza, para no quedar encima.
import { Suspense, lazy, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import api from '../../services/api';
import { Input } from '../../components/standard';
import { useIntencionDeBusqueda } from '../buscarLead';
import { minimizarVentana } from '../ventanasStore';

const FichaLeadModal = lazy(() => import('../../components/ficha/FichaLeadModal'));

const PISTA = {
    pago: 'Elegí a quién registrarle el pago: su ficha abre en Acciones.',
    venta: 'Elegí a quién declararle la venta: su ficha abre en «Registrar una venta».',
};

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' }) : null);

export default function BuscarLeadVentana() {
    const intencion = useIntencionDeBusqueda();
    const [q, setQ] = useState('');
    const [estado, setEstado] = useState({ cargando: false, error: false, lista: [] });
    const [ficha, setFicha] = useState(null);

    useEffect(() => {
        const texto = q.trim();
        if (texto.length < 2) { setEstado({ cargando: false, error: false, lista: [] }); return undefined; }
        let vivo = true;
        setEstado(e => ({ ...e, cargando: true }));
        const t = setTimeout(() => {
            api.get(`/closer/leads/search?q=${encodeURIComponent(texto)}`)
                .then(r => { if (vivo) setEstado({ cargando: false, error: false, lista: Array.isArray(r.data) ? r.data : [] }); })
                .catch(() => { if (vivo) setEstado({ cargando: false, error: true, lista: [] }); });
        }, 300);
        return () => { vivo = false; clearTimeout(t); };
    }, [q]);

    const abrir = (l) => {
        setFicha({ personUuid: l.person_uuid || null, clientId: l.id || null, intencion });
        minimizarVentana('buscar');
    };

    return (
        <div className="bl">
            {intencion && <p className="bl-pista">{PISTA[intencion]}</p>}
            <label className="bl-campo">
                <Search size={16} aria-hidden="true" />
                <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, mail, Instagram o teléfono"
                    aria-label="Buscar un lead" />
            </label>
            {q.trim().length < 2 && <p className="bl-nota">Escribí al menos dos letras.</p>}
            {estado.cargando && <p className="bl-nota">Buscando…</p>}
            {estado.error && <p className="bl-nota">No se pudo buscar. Probá de nuevo.</p>}
            {!estado.cargando && !estado.error && q.trim().length >= 2 && !estado.lista.length && <p className="bl-nota">No hay leads con eso.</p>}
            <ul className="bl-lista">
                {estado.lista.map((l, i) => {
                    const puede = !!(l.person_uuid || l.id);
                    const contacto = [l.instagram && `@${String(l.instagram).replace('@', '')}`, l.email, l.phone].filter(Boolean).join(' · ');
                    const agenda = l.appointment?.start_time
                        ? ['Agenda ' + fecha(l.appointment.start_time), l.appointment.setter_name && `setter ${l.appointment.setter_name}`].filter(Boolean).join(' · ')
                        : null;
                    return (
                        <li key={l.person_uuid || l.id || i}>
                            <button type="button" className="bl-item" disabled={!puede} onClick={() => abrir(l)}
                                title={puede ? undefined : 'Solo está en la planilla vieja: no tiene ficha'}>
                                <b className="trunc">{l.username || 'Sin nombre'}</b>
                                {contacto && <small className="trunc">{contacto}</small>}
                                {agenda && <small className="trunc">{agenda}</small>}
                            </button>
                        </li>
                    );
                })}
            </ul>
            {ficha && createPortal(
                <Suspense fallback={null}>
                    <FichaLeadModal personUuid={ficha.personUuid} clientId={ficha.personUuid ? null : ficha.clientId}
                        pestanaInicial={ficha.intencion === 'pago' ? 'acciones' : null} abrirEnVenta={ficha.intencion === 'venta'}
                        onCerrar={() => setFicha(null)} />
                </Suspense>,
                document.body,
            )}
        </div>
    );
}
