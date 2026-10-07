// Configuración › Equipo: los closers y setters de la app, si tienen Google Calendar y WhatsApp y si
// están en Team. «Simular» entra como ese closer directo a su Configuración, para cargarle lo que le
// falta. Los roles y accesos se manejan en NeurOPS: acá solo se ven.

import { useEffect, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { simularA } from '../../../../utils/impersonation';
import { rotuloDeRol } from '../../../../utils/cuentasVinculadas';
import { almacen, useDatos } from '../../data/hooks';
import { Icono } from '../../ui/base';
import { toast } from '../../ui/toast';

// Quién puede simular a un closer (lo decide el backend, /auth/impersonate; esto evita ofrecerlo de más).
export const SIMULAN_CLOSERS = ['director_comercial', 'admin', 'operator'];
export const CONFIG_DEL_CLOSER = '/closer/deck?vista=configuracion';

export async function simularParaConfigurar(userId) {
    try { await simularA(userId, CONFIG_DEL_CLOSER, 'closer'); } catch (e) { toast(e?.response?.data?.message || 'No se pudo simular a esa persona.', 'error'); }
}

function Marca({ ok, n }) {
    return <span className={'eq-marca' + (ok ? ' eq-marca--ok' : '')} title={(ok ? 'Con ' : 'Sin ') + n}><Icono n={ok ? 'check' : 'x'} s={13} />{n}</span>;
}

export default function TabEquipo() {
    const { user } = useAuth();
    const { d } = useDatos();
    const [gente, setGente] = useState(null);
    useEffect(() => {
        const ad = almacen.adaptador;
        let vivo = true;
        Promise.all(ad.usuarios ? [ad.usuarios(), ad.usuarios('setter')] : [[], []])
            .then(([cs, ss]) => { if (vivo) setGente([...cs, ...ss]); }, () => { if (vivo) setGente([]); });
        return () => { vivo = false; };
    }, []);

    const rolReal = user?.is_impersonating ? user?.original_user_role : user?.role;
    const simula = SIMULAN_CLOSERS.includes(rolReal);
    const enTeam = new Set(d.personas.map(p => (p.email || '').toLowerCase()).filter(Boolean));

    if (gente === null) return <p className="t-sm mut">Cargando el equipo…</p>;
    if (!gente.length) return <p className="t-sm mut">No hay closers ni setters activos en la app.</p>;
    return (
        <>
            <p className="t-sm mut">Para recibir agendas, cada closer necesita Google Calendar y WhatsApp confirmado. Los roles y accesos se cambian en NeurOPS.</p>
            <ul className="eq-lista">
                {gente.map(u => {
                    const closer = u.rol !== 'setter', yo = user && u.id === user.id;
                    const listo = !closer || (u.calendar && u.whatsapp);
                    return (
                        <li key={u.id} className="eq-fila">
                            <span className="avatar avatar--sm" style={{ '--c': closer ? 'var(--fc-azul)' : 'var(--fc-violeta)' }}>{(u.nombre || '?').slice(0, 2).toUpperCase()}</span>
                            <div className="eq-id">
                                <b className="trunc">{u.nombre}{yo && <span className="pc-vos" style={{ marginLeft: 8 }}>Vos</span>}</b>
                                <span className="t-cap mut trunc">{rotuloDeRol(u.rol)}{u.email ? ' · ' + u.email : ''}</span>
                            </div>
                            <div className="eq-marcas">
                                {closer && <Marca ok={u.calendar} n="Calendar" />}
                                {closer && <Marca ok={u.whatsapp} n="WhatsApp" />}
                                <Marca ok={enTeam.has((u.email || '').toLowerCase())} n="En Team" />
                            </div>
                            {closer && simula && !yo ? (
                                <button type="button" className={'btn btn--sm ' + (listo ? 'btn--linea' : 'btn--cta')} onClick={() => simularParaConfigurar(u.id)}>
                                    <Icono n="mascara" />{listo ? 'Simular' : 'Simular para configurar'}
                                </button>
                            ) : <span />}
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
