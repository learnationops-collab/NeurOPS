// El acceso del alumno arriba del reporte de una Momentum (ADR-W276): cuánto le queda o hace cuánto venció.
import { motion } from 'framer-motion';
import { KeyRound } from 'lucide-react';
import { diaLegible } from '../piezas';

const dias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

function lectura({ dias: n }) {
  if (n < 0) return { tono: 'error', texto: `Se le venció hace ${dias(-n)}` };
  if (n === 0) return { tono: 'error', texto: 'Se le vence hoy' };
  return { tono: n <= 14 ? 'warning' : 'success', texto: `Le quedan ${dias(n)} de acceso` };
}

export default function AccesoMomentum({ acceso }) {
  const { tono, texto } = lectura(acceso);
  return (
    <motion.div className="fi-acceso" style={{ '--c': `var(--${tono})` }}
      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <span className="fi-acceso-ico" aria-hidden="true"><KeyRound size={16} /></span>
      <span className="fi-acceso-txt">{texto}</span>
      <span className="fi-acceso-sub">
        {acceso.dias < 0 ? 'Venció' : 'Vence'} el {diaLegible(acceso.vence)}
        {acceso.estimado ? ' · 4 meses desde que ingresó' : ''}
      </span>
    </motion.div>
  );
}
