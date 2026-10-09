import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Calendar, Check, Copy, Eye, EyeOff, Ghost, KeyRound, Link2, Mail, Pencil, Search, Star, Trash2, UserPlus } from 'lucide-react';
import api from '../../../services/api';
import Modal from '../../../components/ui/Modal';
import ElegirRolAlSimular, { tieneVariosRoles } from '../../../components/shared/ElegirRolAlSimular';
import VincularCuentasModal from './VincularCuentasModal';
import { Segmented } from '../../comercial/components/Shared';
import '../../comercial/comercial.css';
import '../../../components/learnation-ds/learnation-ds.css';
import './equipo.css';
import { saveSession } from '../../../utils/sessionStore';
import { roleLandingPath } from '../../../utils/roleLanding';

/**
 * Gestión de equipo. Una persona puede tener varios roles (`roles`): entra con el principal (`role`)
 * y cambia a los otros desde su menú de sesión. Con el sistema de diseño Learnation (`ln-*`), sobre
 * su propio fondo navy para verse igual con cualquier tema.
 *
 * `embebido`: va dentro de otra pantalla (configuración del admin, espacio del operador), que ya
 * pone su propio título.
 */

export const ROLES = [
    { id: 'admin', label: 'Administrador', plural: 'Admins', desc: 'Acceso total, finanzas opcional' },
    { id: 'operator', label: 'Operador', plural: 'Operadores', desc: 'Configuración técnica y datos' },
    { id: 'director_comercial', label: 'Dirección comercial', plural: 'Dirección comercial', desc: 'Dashboard comercial y Agendamiento' },
    { id: 'director_marketing', label: 'Dirección de marketing', plural: 'Marketing', desc: 'Workshops y campañas' },
    { id: 'closer', label: 'Closer', plural: 'Closers', desc: 'Mazo de llamadas y cartera' },
    { id: 'setter', label: 'Setter', plural: 'Setters', desc: 'Calificación de leads' },
    { id: 'triage', label: 'Call confirmer', plural: 'Call confirmers', desc: 'Confirma las llamadas' },
    { id: 'hiring', label: 'Hiring', plural: 'Hiring', desc: 'Asistente de contratación' },
];
const rotulo = (id) => ROLES.find(r => r.id === id)?.label || id;
const rolesDe = (u) => (u.roles && u.roles.length ? u.roles : [u.role]);
// Quién puede tener «ver finanzas»: con uno de estos roles ve Finanzas y Payroll en Finances, /finanzas
// (`puede_ver_finanzas` en el backend). Con otro rol el permiso no abre nada.
const ROLES_FINANZAS = ['admin', 'director_comercial'];
const veFinanzas = (roles) => roles.some(r => ROLES_FINANZAS.includes(r));
const iniciales = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const VACIO = {
    username: '', email: '', password: '', roles: ['closer'], role: 'closer',
    timezone: 'America/La_Paz', two_chat_number: '', is_active: true, can_view_finance: false,
};

function Interruptor({ id, label, hint, valor, onChange }) {
    return (
        <div className="ln-choice">
            <input id={id} type="checkbox" role="switch" className="ln-choice-input" checked={valor} onChange={e => onChange(e.target.checked)} />
            <label htmlFor={id} className="ln-choice-label">
                <span className="ln-switch"><span className="ln-switch-knob" /></span>
                <span className="ln-choice-text">{label}{hint && <span className="ln-choice-hint">{hint}</span>}</span>
            </label>
        </div>
    );
}

function Campo({ label, hint, children }) {
    return (
        <label className="ln-field-wrap">
            <span className="ln-field-label">{label}</span>
            <span className="ln-field">{children}</span>
            {hint && <span className="ln-field-hint">{hint}</span>}
        </label>
    );
}

/** Elegir los roles de la persona y con cuál entra (el principal). */
function ElegirRoles({ roles, principal, onChange }) {
    const alternar = (id) => {
        const nuevos = roles.includes(id) ? roles.filter(r => r !== id) : [...roles, id];
        if (!nuevos.length) return;
        onChange(nuevos, nuevos.includes(principal) ? principal : nuevos[0]);
    };
    return (
        <fieldset className="eq-roles">
            <legend className="ln-field-label">Roles · la estrella marca con cuál entra</legend>
            {ROLES.map(r => {
                const tiene = roles.includes(r.id);
                return (
                    <div key={r.id} className={`eq-rol${tiene ? ' eq-rol--on' : ''}`}>
                        <div className="ln-choice">
                            <input id={`rol-${r.id}`} type="checkbox" className="ln-choice-input" checked={tiene} onChange={() => alternar(r.id)} />
                            <label htmlFor={`rol-${r.id}`} className="ln-choice-label">
                                <span className="ln-check"><Check /></span>
                                <span className="ln-choice-text">{r.label}<span className="ln-choice-hint">{r.desc}</span></span>
                            </label>
                        </div>
                        {tiene && (
                            <button type="button" className={`eq-estrella${principal === r.id ? ' eq-estrella--on' : ''}`}
                                aria-pressed={principal === r.id} aria-label={`Entra como ${r.label}`}
                                title={principal === r.id ? 'Entra con este rol' : 'Entrar con este rol'}
                                onClick={() => onChange(roles, r.id)}>
                                <Star size={16} />
                            </button>
                        )}
                    </div>
                );
            })}
        </fieldset>
    );
}

const TeamManagementPage = ({ embebido = false }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeRole, setActiveRole] = useState('all');
    const [impersonatingId, setImpersonatingId] = useState(null);
    const [simulando, setSimulando] = useState(null); // { persona, nuevaPestana }: eligiendo con qué rol
    const [showDeactivated, setShowDeactivated] = useState(false);
    const [vinculando, setVinculando] = useState(false);

    const [modal, setModal] = useState({ show: false, type: 'create', user: null });
    const [formData, setFormData] = useState(VACIO);
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState(null);
    const errorRef = useRef(null);
    const set = (cambios) => setFormData(f => ({ ...f, ...cambios }));

    const cerrarModal = () => setModal(m => ({ ...m, show: false }));

    useEffect(() => {
        if (modalError) errorRef.current?.scrollIntoView?.({ block: 'nearest' });
    }, [modalError]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/users?show_deactivated=${showDeactivated}`);
            setUsers(res.data);
        } catch (err) {
            console.error('Error fetching users', err);
        } finally {
            setLoading(false);
        }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchUsers(); }, [showDeactivated]);

    const handleOpenModal = (type, user = null) => {
        setModal({ show: true, type, user });
        setModalError(null);
        setFormData(type === 'edit' && user ? {
            username: user.username,
            email: user.email || '',
            password: '',
            roles: rolesDe(user),
            role: user.role,
            timezone: user.timezone || 'America/La_Paz',
            two_chat_number: user.two_chat_number || '',
            is_active: user.is_active,
            can_view_finance: user.can_view_finance || false,
        } : VACIO);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setModalError(null);
        try {
            if (modal.type === 'create') await api.post('/admin/users', formData);
            else await api.put(`/admin/users/${modal.user.id}`, formData);
            setModal({ show: false, type: 'create', user: null });
            fetchUsers();
        } catch (err) {
            setModalError(err.response?.data?.message || 'Error al procesar la solicitud');
        } finally {
            setSubmitting(false);
        }
    };

    // Simular: con varios roles se pregunta con cuál (ElegirRolAlSimular); con uno, entra directo.
    // `nuevaPestana` recuerda si fue clic derecho para seguir después de elegir.
    const iniciarSimulacion = (targetUser, nuevaPestana) => {
        if (!targetUser.is_active) return;
        if (tieneVariosRoles(targetUser)) setSimulando({ persona: targetUser, nuevaPestana });
        else return nuevaPestana ? simularEnPestanaNueva(targetUser) : simularAqui(targetUser);
    };

    const simularAqui = async (targetUser, rol = null) => {
        setImpersonatingId(targetUser.id);
        try {
            const res = await api.post('/auth/impersonate', { user_id: targetUser.id, ...(rol ? { role: rol } : {}) });
            const { user: impersonatedUser, token } = res.data;
            saveSession(impersonatedUser, token);
            window.location.href = roleLandingPath(impersonatedUser.role);
        } catch (err) {
            setImpersonatingId(null);
            throw err;
        }
    };

    // Clic derecho sobre "Simular": abre al usuario simulado en una pestaña NUEVA, aislada (se pueden
    // simular varios a la vez). window.open() va síncrono, antes del await: los navegadores bloquean
    // como popup cualquier window.open() después de una espera.
    const simularEnPestanaNueva = async (targetUser, rol = null) => {
        const newTab = window.open('', '_blank');
        try {
            const res = await api.post('/auth/impersonate', { user_id: targetUser.id, isolated: true, ...(rol ? { role: rol } : {}) });
            const { user: impersonatedUser, token } = res.data;
            const params = new URLSearchParams({ token, u: JSON.stringify(impersonatedUser), next: roleLandingPath(impersonatedUser.role) });
            if (newTab) newTab.location.href = `/session-entry?${params.toString()}`;
            else alert('El navegador bloqueó la pestaña nueva. Habilita las ventanas emergentes para este sitio e intenta de nuevo.');
        } catch (err) {
            if (newTab) newTab.close();
            throw err;
        }
    };

    const handleImpersonate = (targetUser) => {
        const r = iniciarSimulacion(targetUser, false);
        r?.catch((err) => alert(err.response?.data?.message || 'Error al iniciar simulación'));
    };

    const handleImpersonateNewTab = (e, targetUser) => {
        e.preventDefault();
        const r = iniciarSimulacion(targetUser, true);
        r?.catch((err) => alert(err.response?.data?.message || 'Error al iniciar simulación'));
    };

    // Ya eligió el rol: aquí no se captura el error, ElegirRolAlSimular lo muestra en su pantalla.
    const simularConRol = async (rol) => {
        const { persona, nuevaPestana } = simulando;
        if (nuevaPestana) {
            await simularEnPestanaNueva(persona, rol);
            setSimulando(null);
        } else {
            await simularAqui(persona, rol);
        }
    };

    // Contraseña temporal nueva: se muestra una sola vez para pasársela a la persona.
    const [reseteada, setReseteada] = useState(null); // {username, password}
    const [copiada, setCopiada] = useState(false);
    const handleReset = async (user) => {
        if (!window.confirm(`¿Resetear la contraseña de ${user.username}? La actual deja de servir.`)) return;
        try {
            const r = await api.post(`/admin/users/${user.id}/reset-password`);
            setCopiada(false);
            setReseteada(r.data);
        } catch (err) {
            alert(err.response?.data?.message || 'No se pudo resetear la contraseña');
        }
    };

    const handleDelete = async (user) => {
        if (!window.confirm(`¿Eliminar a ${user.username}? Si solo deja de trabajar, mejor desactivalo.`)) return;
        try {
            await api.delete(`/admin/users/${user.id}`);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.message || 'Error al eliminar usuario');
        }
    };

    const q = searchTerm.toLowerCase();
    const filteredUsers = users.filter(u =>
        (u.username.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
        && (activeRole === 'all' || rolesDe(u).includes(activeRole)));
    const pestanasDeRol = [{ id: 'all', plural: 'Todos' }, ...ROLES].map(r => ({
        key: r.id,
        label: r.plural,
        cuenta: r.id === 'all' ? users.length : users.filter(u => rolesDe(u).includes(r.id)).length,
    })).filter(p => p.key === 'all' || p.cuenta > 0 || p.key === activeRole);

    return (
        <div className={`dc-shell dc-shell--embebido equipo${embebido ? ' equipo--embebido' : ''}`}>
            <header className="eq-cab">
                <div>
                    {!embebido && <h1 className="ln-t-h1">Gestión de equipo</h1>}
                    <p className="ln-t-body-sm ln-muted">
                        {users.length} {users.length === 1 ? 'persona' : 'personas'}{showDeactivated ? ', incluidas las inactivas' : ''}.
                        Cada una entra con su rol principal y cambia a los otros desde su menú.
                    </p>
                </div>
                <div className="ln-btn-row">
                    <button type="button" className="btn btn--linea" aria-pressed={showDeactivated}
                        onClick={() => setShowDeactivated(!showDeactivated)}>
                        {showDeactivated ? <EyeOff /> : <Eye />}{showDeactivated ? 'Ocultar inactivos' : 'Ver inactivos'}
                    </button>
                    <button type="button" className="btn btn--linea" onClick={() => setVinculando(true)}>
                        <Link2 />Vincular cuentas
                    </button>
                    <button type="button" className="btn btn--cta" onClick={() => handleOpenModal('create')}>
                        <UserPlus />Nuevo miembro
                    </button>
                </div>
            </header>

            <div className="eq-barra">
                <span className="ln-field eq-busca">
                    <Search />
                    <input type="text" placeholder="Buscar por nombre o email" aria-label="Buscar miembro"
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </span>
                <div className="eq-pestanas">
                    <Segmented opciones={pestanasDeRol} valor={activeRole} onChange={setActiveRole} ariaLabel="Filtrar el equipo por rol" />
                </div>
            </div>

            {loading ? (
                <div className="ln-empty"><span className="ln-spinner" /><p className="ln-empty-desc">Cargando el equipo…</p></div>
            ) : filteredUsers.length === 0 ? (
                <div className="ln-empty"><p className="ln-empty-title">Nadie con ese filtro</p></div>
            ) : (
                <div className="ln-table eq-tabla">
                    <div className="ln-table-head"><span>Persona</span><span>Roles</span><span>Estado</span><span /></div>
                    {filteredUsers.map(u => (
                        <div key={u.id} className={`ln-table-row${u.is_active ? '' : ' eq-fila--inactiva'}`}>
                            <div className="ln-cell--title eq-persona">
                                <span className="eq-avatar" aria-hidden="true">{iniciales(u.username)}</span>
                                <div className="eq-persona-txt">
                                    <div className="ln-cell-label">{u.username}</div>
                                    <div className="ln-cell-sublabel eq-mail"><Mail size={12} />{u.email || 'Sin email'}</div>
                                </div>
                            </div>
                            <div className="eq-chips">
                                {rolesDe(u).map(r => (
                                    <span key={r} className={`ln-chip ln-chip--sm ${r === u.role ? 'ln-chip--brand' : 'ln-chip--idle'}`}
                                        title={r === u.role ? 'Rol principal: entra con este' : undefined}>
                                        {r === u.role && <Star />}{rotulo(r)}
                                    </span>
                                ))}
                                {u.persona_id && <span className="ln-chip ln-chip--sm ln-chip--info">Cuentas vinculadas</span>}
                            </div>
                            <div className="eq-chips">
                                {!u.is_active
                                    ? <span className="ln-chip ln-chip--sm ln-chip--error">Inactivo</span>
                                    : <span className="ln-chip ln-chip--sm ln-chip--success">Activo</span>}
                                {u.calendar && <span className="ln-chip ln-chip--sm ln-chip--info" title="Google Calendar conectado"><Calendar />Calendar</span>}
                                {veFinanzas(rolesDe(u)) && u.can_view_finance && <span className="ln-chip ln-chip--sm ln-chip--warning">Finanzas</span>}
                            </div>
                            <div className="eq-acciones">
                                <button type="button" className="btn btn--linea btn--sm"
                                    onClick={() => handleImpersonate(u)} onContextMenu={(e) => handleImpersonateNewTab(e, u)}
                                    disabled={!u.is_active || impersonatingId === u.id}
                                    title="Clic: simular en esta pestaña. Clic derecho: en una pestaña nueva.">
                                    {impersonatingId === u.id ? <span className="ln-spinner" /> : <Ghost />}Simular
                                </button>
                                <button type="button" className="ibtn ibtn--sm" title="Resetear contraseña" aria-label={`Resetear la contraseña de ${u.username}`} onClick={() => handleReset(u)}>
                                    <KeyRound />
                                </button>
                                <button type="button" className="ibtn ibtn--sm" title="Editar" aria-label={`Editar a ${u.username}`} onClick={() => handleOpenModal('edit', u)}>
                                    <Pencil />
                                </button>
                                <button type="button" className="ibtn ibtn--sm eq-borrar" title="Eliminar" aria-label={`Eliminar a ${u.username}`} onClick={() => handleDelete(u)}>
                                    <Trash2 />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {simulando && (
                <ElegirRolAlSimular persona={simulando.persona} onElegir={simularConRol} onCancelar={() => setSimulando(null)} />
            )}

            {reseteada && (
                <Modal tono="slate" titulo="Contraseña nueva" subtitulo={reseteada.username} onCerrar={() => setReseteada(null)}>
                    <div className="eq-reset">
                        <p>Pasásela a {reseteada.username}. No se vuelve a mostrar; puede cambiarla después.</p>
                        <div className="eq-reset-clave">
                            <code>{reseteada.password}</code>
                            <button type="button" className="ln-btn ln-btn--ghost ln-btn--sm"
                                onClick={() => navigator.clipboard?.writeText(reseteada.password).then(() => setCopiada(true), () => {})}>
                                {copiada ? <Check /> : <Copy />}{copiada ? 'Copiada' : 'Copiar'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {vinculando && <VincularCuentasModal users={users} onCerrar={() => setVinculando(false)} onCambio={fetchUsers} />}

            {modal.show && (
                <Modal
                    tono="slate"
                    ancho="xl"
                    titulo={modal.type === 'create' ? 'Nuevo Miembro' : 'Editar Miembro'}
                    subtitulo={modal.type === 'create' ? 'Acceso, roles y estado' : modal.user?.username}
                    onCerrar={cerrarModal}
                    onSubmit={handleSubmit}
                    cerrable={!submitting}
                    pie={(
                        <div className="dc-shell dc-shell--embebido ln-btn-row eq-pie">
                            <button type="button" className="btn btn--linea" onClick={cerrarModal} disabled={submitting}>Cancelar</button>
                            <button type="submit" className="btn btn--cta" disabled={submitting}>
                                {submitting ? <span className="ln-spinner" /> : <Check />}
                                {modal.type === 'create' ? 'Crear Miembro' : 'Guardar Cambios'}
                            </button>
                        </div>
                    )}
                >
                    <div className="dc-shell dc-shell--embebido eq-form">
                        {modalError && (
                            <div ref={errorRef} role="alert" className="ln-alert ln-alert--error">
                                <AlertCircle className="ln-alert-ico" /><div className="ln-alert-body"><div className="ln-alert-desc">{modalError}</div></div>
                            </div>
                        )}
                        <div className="ln-grid ln-grid-2">
                            <Campo label="Nombre de usuario">
                                <input type="text" required placeholder="Ej.: Ana Paz" value={formData.username} onChange={(e) => set({ username: e.target.value })} />
                            </Campo>
                            <Campo label="Email" hint="Con este entra con Google y se cruza con Agendas 2.0.">
                                <input type="email" placeholder="ana@gmail.com" value={formData.email} onChange={(e) => set({ email: e.target.value })} />
                            </Campo>
                            <Campo label="Contraseña">
                                <input type="password" autoComplete="new-password" required={modal.type === 'create'}
                                    placeholder={modal.type === 'edit' ? 'Vacía para no cambiarla' : '••••••••'}
                                    value={formData.password} onChange={(e) => set({ password: e.target.value })} />
                            </Campo>
                            <Campo label="WhatsApp (avisos de seguimiento)" hint="Código de país y número, sin +. Opcional.">
                                <input type="text" placeholder="525620873819" value={formData.two_chat_number} onChange={(e) => set({ two_chat_number: e.target.value })} />
                            </Campo>
                        </div>

                        <ElegirRoles roles={formData.roles} principal={formData.role}
                            onChange={(roles, role) => set({ roles, role })} />

                        <div className="eq-switches">
                            <Interruptor id="eq-activo" label="Cuenta activa" hint={formData.is_active ? 'Puede entrar' : 'No puede entrar; su historial queda'}
                                valor={formData.is_active} onChange={(v) => set({ is_active: v })} />
                            {veFinanzas(formData.roles) && (
                                <Interruptor id="eq-finanzas" label="Acceso a finanzas" hint="Finanzas y Payroll en Finances"
                                    valor={formData.can_view_finance} onChange={(v) => set({ can_view_finance: v })} />
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default TeamManagementPage;
