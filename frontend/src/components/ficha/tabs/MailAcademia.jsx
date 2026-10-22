// Corregir el correo con que el alumno entra a la Academia (22/10/2026). El acceso sale de su venta:
// con una suscripción vigente, pasa a la cuenta de ese correo con la fecha de Work; sin ella solo se
// guarda el mail. Ver `corregir_mail` en `app/services/ficha_academia.py`.

import { useState } from 'react';
import { Button, FieldError, Input } from '../../standard';
import { mensajeDeError } from '../fichaApi';

export default function MailAcademia({ sugerido, onAccion, onHecho, onCerrar }) {
  const [email, setEmail] = useState(sugerido || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onAccion('mail_academia', { email: email.trim() });
      onHecho?.();
      onCerrar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="ful-gestion" onSubmit={guardar} aria-label="Corregir el mail de la Academia">
      <label className="t-sm" htmlFor="mail-academia">
        El correo con el que entra a la Academia. Si tiene una venta con acceso vigente, el acceso pasa a esa cuenta.
      </label>
      <Input id="mail-academia" type="email" value={email} required autoFocus disabled={guardando}
        placeholder="correo@ejemplo.com" onChange={(e) => setEmail(e.target.value)} />
      <div className="ful-gestion-botones">
        <Button variant="primary" type="submit" disabled={guardando || !email.trim()}>Guardar mail</Button>
        <Button variant="ghost" onClick={onCerrar} disabled={guardando}>Volver</Button>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </form>
  );
}
