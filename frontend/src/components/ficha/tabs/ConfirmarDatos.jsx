// Los datos que ya tenemos (nombre, correo, Instagram, teléfono) se confirman de un vistazo en vez de
// revisarse campo por campo: una tarjeta con lo que trae la agenda y «Corregir» para abrir los campos.
// Santiago, 30/10/2026: muchos errores venían de closers que volvían a cargar datos que ya teníamos.
import { Pencil } from 'lucide-react';

// Los campos `confirmar` que vienen precargados y siguen igual: esos van a la tarjeta. Si el closer
// ya cambió alguno, o la pregunta tiene un error (un correo inválido), se muestran los campos.
export function confirmables(pregunta, respuestas, precarga) {
  const lista = pregunta.campos.filter((c) => c.confirmar && String(precarga?.[c.campo] ?? '').trim());
  if (!lista.length) return [];
  const igual = lista.every((c) => String(respuestas[c.campo] ?? '').trim() === String(precarga[c.campo]).trim());
  const errores = pregunta.validar ? pregunta.validar(respuestas) : [];
  return igual && !errores.length ? lista : [];
}

export default function ConfirmarDatos({ campos, respuestas, onCorregir }) {
  const correo = campos.find((c) => c.destacado);
  return (
    <div className="fi-acceso">
      <div style={{ display: 'grid', gap: 'var(--s2)' }}>
        {campos.map((c) => (
          <div key={c.campo} style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <small className="ln-t-body-sm ln-muted" style={{ minWidth: 140 }}>{c.label}</small>
            <strong style={c === correo ? { fontSize: '1.15rem' } : undefined}>
              {c.prefijo || ''}{respuestas[c.campo]}
            </strong>
          </div>
        ))}
      </div>
      {correo && <small className="ln-t-body-sm">{correo.destacado}</small>}
      <div>
        <button type="button" className="btn btn--linea btn--sm" onClick={onCorregir}>
          <Pencil /> Corregir
        </button>
      </div>
    </div>
  );
}
