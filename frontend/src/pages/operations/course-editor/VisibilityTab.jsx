import { Info } from 'lucide-react';
import { ROLE_OPTIONS } from './constants';

const VisibilityTab = ({ form, setForm }) => {
    const toggleRole = (role) => setForm((f) => ({
        ...f, target_roles: f.target_roles.includes(role) ? f.target_roles.filter((r) => r !== role) : [...f.target_roles, role],
    }));

    return (
        <>
            <div className="form-field">
                <label className="form-label">¿A quién se le muestra?</label>
                <p className="form-hint">Si no seleccionás ninguno, se muestra a todo el equipo.</p>
                <div className="role-pill-group">
                    {ROLE_OPTIONS.map((r) => (
                        <button key={r.value} type="button" className={`role-pill${form.target_roles.includes(r.value) ? ' is-selected' : ''}`} onClick={() => toggleRole(r.value)}>
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="toggle-row">
                <button type="button" className={`toggle-switch${form.is_active ? ' is-on' : ''}`} onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))} aria-pressed={form.is_active} aria-label="Publicada">
                    <span className="toggle-switch__thumb" />
                </button>
                <div className="toggle-copy">
                    <strong>Publicada</strong>
                    <span>Visible para los usuarios que tengan alguno de los roles de arriba.</span>
                </div>
            </div>

            <div className="info-box">
                <Info size={16} />
                <div>
                    <strong>
                        {form.is_active
                            ? (form.target_roles.length ? `Publicada para ${form.target_roles.length} rol(es)` : 'Publicada para todo el equipo')
                            : 'Sin publicar'}
                    </strong>
                    <p>{form.is_active ? 'Cambiá los roles de arriba para ampliar o achicar quién la ve.' : 'Nadie la ve todavía, ni aunque tenga los roles marcados.'}</p>
                </div>
            </div>
        </>
    );
};

export default VisibilityTab;
