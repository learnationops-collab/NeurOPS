import React, { useState } from 'react';
import { Button, Chip, FieldError, Input, Select } from '../../standard';
import { mensajeDeError } from '../fichaApi';

/**
 * Todos los datos de la persona (docs/plan_personas.md, Etapa 2a): sus mails, teléfonos,
 * instagrams e ids externos, cuál es el principal, para qué uso es cada uno (el de pago, el de la
 * Academia) y los que se dieron de baja. Lo arma el backend en `identidad.identidades`.
 *
 * Dos acciones distintas, a propósito:
 *  · Corregir (el lápiz de la cabecera): el dato estaba mal; el nuevo pasa a principal y el
 *    anterior queda dado de baja.
 *  · Agregar (acá): otro dato que también es válido; se suma y el principal no cambia.
 */
const TIPOS = {
    email: 'Correo',
    phone: 'Teléfono',
    instagram: 'Instagram',
    manychat_id: 'ManyChat',
    learnation_user_id: 'Academia (id)',
};
const USOS = { pago: 'Para pagos', academia: 'Para la Academia' };

// Lo que se puede agregar: las claves de `PATCH /ficha/<id>/datos`.
const AGREGABLES = [
    { value: 'email', label: 'Correo', tipo: 'email', placeholder: 'nombre@correo.com' },
    { value: 'telefono', label: 'Teléfono', tipo: 'tel', placeholder: '+52 55 1234 5678' },
    { value: 'instagram', label: 'Instagram', tipo: 'text', placeholder: 'usuario' },
];

const Fila = ({ dato }) => {
    const apagado = !!dato.baja || !!dato.revisar;
    return (
        <li className="fi-ident" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)',
            flexWrap: 'wrap', padding: 'var(--s2) 0', opacity: apagado ? 0.6 : 1 }}>
            <small className="t-rotulo" style={{ minWidth: 96 }}>{TIPOS[dato.tipo] || dato.tipo}</small>
            <span className="t-sm trunc" style={{ fontWeight: 600,
                textDecoration: dato.baja ? 'line-through' : undefined }}>
                {dato.tipo === 'instagram' ? `@${dato.valor}` : dato.valor}
            </span>
            {dato.principal && !apagado && <Chip color="var(--success)" subtle>Principal</Chip>}
            {dato.uso && !apagado && <Chip subtle>{USOS[dato.uso] || dato.uso}</Chip>}
            {dato.baja && <Chip subtle>Dado de baja</Chip>}
            {dato.revisar && <Chip color="var(--warning)" subtle data-tip={dato.revisar}>Es de otra persona</Chip>}
        </li>
    );
};

const IdentidadesPersona = ({ identidades = [], puedeAgregar = false, onAccion }) => {
    const [campo, setCampo] = useState('email');
    const [valor, setValor] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);
    const elegido = AGREGABLES.find(a => a.value === campo) || AGREGABLES[0];

    const agregar = async () => {
        const limpio = valor.trim();
        if (!limpio || guardando) return;
        setGuardando(true);
        setError(null);
        try {
            await onAccion?.('editar_datos', { [campo]: limpio, agregar: [campo] });
            setValor('');
        } catch (err) {
            setError(mensajeDeError(err));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fi-identidades" style={{ display: 'grid', gap: 'var(--s3)', paddingTop: 'var(--s3)' }}>
            {identidades.length ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {identidades.map(d => <Fila key={d.id ?? `${d.tipo}-${d.valor}`} dato={d} />)}
                </ul>
            ) : (
                <p className="t-sm mut">Todavía no tiene datos registrados como persona.</p>
            )}
            {puedeAgregar && (
                <div style={{ display: 'grid', gap: 'var(--s2)' }}>
                    <small className="t-rotulo">Agregar otro dato válido (el principal no cambia)</small>
                    <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <Select label="Tipo de dato" value={campo} options={AGREGABLES}
                            onChange={(v) => { setCampo(v); setError(null); }} />
                        <Input value={valor} type={elegido.tipo} placeholder={elegido.placeholder}
                            aria-label={`${elegido.label} para agregar`} invalid={!!error}
                            style={{ flex: '1 1 220px', minWidth: 0 }}
                            onChange={(e) => { setValor(e.target.value); setError(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }} />
                        <Button variant="primary" disabled={!valor.trim() || guardando} onClick={agregar}>
                            {guardando ? 'Agregando…' : 'Agregar'}
                        </Button>
                    </div>
                    {error && <FieldError>{error}</FieldError>}
                </div>
            )}
        </div>
    );
};

export default IdentidadesPersona;
