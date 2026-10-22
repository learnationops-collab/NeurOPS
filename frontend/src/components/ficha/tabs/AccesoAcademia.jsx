// El acceso a la Academia desde Fulfillment (22/10/2026): prórroga, corregir el mail y quitar.
//
// Fulfillment ya no da ni renueva accesos con una fecha elegida: el acceso sale de la venta
// (Resultado → suscripción en Work). Sin pago solo hay prórrogas de un tipo fijo y con motivo, y si
// el alumno entra con otro correo se corrige el mail (el acceso de su venta pasa a esa cuenta).
// Quitar lleva el `InlineConfirm` de la casa: el pedido se manda recién cuando se agota la ventana.
//
// Solo lo ve quien puede cobrar (`permisos.cobrar`).

import { useState } from 'react';
import { AtSign, CalendarClock } from 'lucide-react';
import InlineConfirm from '../../ui/InlineConfirm';
import Tip from '../../../pages/comercial/components/Tip';
import { Button } from '../../standard';
import { localToday } from '../../../utils/datetime';
import { mensajeDeError } from '../fichaApi';
import MotivoDelFallo from '../historial/MotivoDelFallo';
import { AYUDA_ACCESO, baseDeRenovacion } from '../fulfillment';
import MailAcademia from './MailAcademia';
import ProrrogaAcademia from './ProrrogaAcademia';

export default function AccesoAcademia({ datos, ficha, onAccion, onHecho }) {
  const [abierto, setAbierto] = useState(null); // 'prorroga' | 'mail'
  const [errorQuitar, setErrorQuitar] = useState(null);

  // Con la Academia caída no se ofrece nada: no se sabe qué tiene, y el pedido fallaría igual.
  if (!ficha?.permisos?.cobrar || !onAccion || !datos || datos.error) return null;
  if (!datos.programa?.product_slug) return null;

  const pagado = datos.producto_pagado;
  const conAcceso = !!datos.vinculado && !!pagado;
  const cerrar = () => setAbierto(null);

  if (abierto === 'prorroga') {
    return (
      <ProrrogaAcademia tipos={datos.prorrogas} base={baseDeRenovacion(pagado, localToday())}
        sena={!!pagado?.is_deposit} onAccion={onAccion} onHecho={onHecho} onCerrar={cerrar} />
    );
  }
  if (abierto === 'mail') {
    return (
      <MailAcademia sugerido={datos.alumno?.email || datos.email_sugerido} onAccion={onAccion}
        onHecho={onHecho} onCerrar={cerrar} />
    );
  }

  const quitar = async () => {
    setErrorQuitar(null);
    try {
      await onAccion('quitar_acceso_academia', { confirmo: true });
      onHecho?.();
    } catch (err) {
      setErrorQuitar(mensajeDeError(err));
    }
  };

  return (
    <div className="ful-gestion">
      <div className="ful-gestion-botones">
        {conAcceso && !!datos.prorrogas?.length && (
          <Button icon={<CalendarClock />} onClick={() => setAbierto('prorroga')}>Prórroga</Button>
        )}
        <Button icon={<AtSign />} onClick={() => setAbierto('mail')}>Corregir mail</Button>
        {conAcceso && (
          // `alto` 34: el mismo que el botón de al lado.
          <InlineConfirm tema="oscuro" compacto={false} alto={34} tamIcono={13}
            label="Quitar acceso" question="¿Le quitás el acceso?" confirmLabel="Sí, quitar"
            doneLabel="Acceso quitado" title="Hace vencer hoy su acceso a la Academia"
            onConfirm={quitar} />
        )}
        <Tip titulo="Prórroga, mail o quitar" texto={AYUDA_ACCESO.gestionar} />
      </div>
      <MotivoDelFallo motivo={errorQuitar} />
    </div>
  );
}
