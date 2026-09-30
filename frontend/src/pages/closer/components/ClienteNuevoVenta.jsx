import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, UserPlus } from 'lucide-react';
import { clienteNuevoParaVender, mensajeDeError } from '../../../components/ficha/fichaApi';

// «¿No está? Registrar cliente nuevo» de «Declarar venta». La página vieja (/closer/sales/new) le
// vendía a cualquiera, estuviera o no en el sistema; en la ficha la venta cuelga de un cliente con
// agenda, así que se crea acá y se abre su ficha en la venta, donde se confirma el resto de los
// datos. Nombre y email son obligatorios: sin email el cliente nacería con uno inventado.

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Lo que se buscó y no apareció, en el campo que le corresponde. */
export function repartirBusqueda(texto = '') {
  const t = String(texto).trim();
  if (!t) return {};
  if (EMAIL.test(t)) return { email: t };
  if (t.startsWith('@')) return { instagram: t.slice(1) };
  if (/^\+?[\d\s()-]{6,}$/.test(t)) return { telefono: t };
  return { nombre: t };
}

const CAMPOS = [
  { campo: 'nombre', label: 'Nombre y apellido', requerido: true, placeholder: 'Carla Mendoza', autoComplete: 'off' },
  { campo: 'email', label: 'Email', requerido: true, tipo: 'email', placeholder: 'carla@mail.com' },
  { campo: 'instagram', label: 'Instagram', placeholder: 'carla.mendoza' },
  { campo: 'telefono', label: 'Teléfono', tipo: 'tel', placeholder: '+54 9 11 5555 1234' },
];

export default function ClienteNuevoVenta({ busqueda = '', onAbierto, onCancelar }) {
  const reducido = useReducedMotion();
  const [valores, setValores] = useState(() => ({
    nombre: '', email: '', instagram: '', telefono: '', ...repartirBusqueda(busqueda),
  }));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const listo = valores.nombre.trim() && EMAIL.test(valores.email.trim());

  const enviar = async (e) => {
    e.preventDefault();
    if (!listo || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      onAbierto(await clienteNuevoParaVender({
        nombre: valores.nombre.trim(),
        email: valores.email.trim(),
        instagram: valores.instagram.trim(),
        telefono: valores.telefono.trim(),
      }));
    } catch (err) {
      setError({ campo: err?.response?.data?.campo || null, texto: mensajeDeError(err) });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <motion.form
      onSubmit={enviar}
      aria-label="Registrar cliente nuevo"
      initial={reducido ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="max-w-7xl w-full mx-auto px-6 pb-4"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <UserPlus size={14} aria-hidden="true" className="text-emerald-300 shrink-0" />
          <b className="text-white">Cliente nuevo</b>
          <span className="text-slate-400">
            Se crea con estos datos y se abre su ficha en la venta. Si ya estaba con este email,
            Instagram o teléfono, se abre el suyo.
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CAMPOS.map((c) => (
            <div key={c.campo} className="grid gap-1">
              <label htmlFor={`cliente-nuevo-${c.campo}`} className="text-[10px] font-bold text-slate-400 uppercase">
                {c.label}{c.requerido && <span className="text-pink-500"> *</span>}
              </label>
              <input
                id={`cliente-nuevo-${c.campo}`}
                type={c.tipo || 'text'}
                value={valores[c.campo]}
                placeholder={c.placeholder}
                autoComplete={c.autoComplete || 'off'}
                autoFocus={c.campo === 'nombre'}
                aria-invalid={error?.campo === c.campo || undefined}
                onChange={(e) => setValores((v) => ({ ...v, [c.campo]: e.target.value }))}
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-bold text-white ${
                  error?.campo === c.campo ? 'border-rose-500/60' : 'border-slate-800'}`}
              />
            </div>
          ))}
        </div>
        {error && <p role="alert" className="text-xs text-rose-400">{error.texto}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!listo || enviando}
            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold inline-flex items-center gap-2 transition-colors"
          >
            {enviando && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Abrir la venta
          </button>
        </div>
      </div>
    </motion.form>
  );
}
