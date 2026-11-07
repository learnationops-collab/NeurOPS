import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import * as apiFz from '../finanzasApi';
import { mesesDelRango } from '../comun';
import { persona, puenteDe, sumarNomina } from './modelo';

/**
 * Los datos de la app de Finanzas para un período ({desde, hasta, mes}) y las acciones que los cambian.
 *
 * Cada bloque tiene su pedido y su estado (`null` = cargando), así la pantalla dibuja lo que llegó sin
 * esperar al más lento. Cambiar un estado, el método o un ajuste se ve al instante (la fila guardada
 * vuelve del servidor y reemplaza a la local) y solo se puede con un mes justo: los estados de pago
 * son de la nómina de un mes. Con `activo` en false (el tablero fuera de /finanzas) no pide nada.
 */
const useFinanzasApp = (periodo, activo = true) => {
    const { desde, hasta, mes } = periodo;
    const clave = `${desde}|${hasta}`;
    const [nomina, setNomina] = useState(null);
    const [payroll, setPayroll] = useState(null);
    const [cobros, setCobros] = useState(null);
    const [foto, setFoto] = useState(undefined);
    const [anuncios, setAnuncios] = useState(null);
    const [fallo, setFallo] = useState(null);
    const vigente = useRef(clave);

    const cargarNomina = useCallback(async () => {
        if (mes) return (await apiFz.getNomina(mes)).nomina;
        const meses = mesesDelRango(desde, hasta).map((m) => m.mes);
        return sumarNomina((await apiFz.getNominas(meses)).nominas);
    }, [desde, hasta, mes]);

    const cargar = useCallback((solo = null) => {
        if (!activo) return;
        const k = clave;
        const pedir = (nombre, promesa, set) => {
            if (solo && !solo.includes(nombre)) return;
            promesa().then((d) => { if (vigente.current === k) set(d); })
                .catch(() => { if (vigente.current === k) setFallo(nombre); });
        };
        pedir('nomina', cargarNomina, setNomina);
        pedir('payroll', () => apiFz.getPayroll(desde, hasta), setPayroll);
        pedir('cobros', () => apiFz.getCobros(periodo), setCobros);
        pedir('anuncios', () => apiFz.getAnuncios(periodo), setAnuncios);
        pedir('foto', () => (mes ? apiFz.getLiquidez(mes) : Promise.resolve(null)), setFoto);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave, cargarNomina, activo]);

    useEffect(() => {
        vigente.current = clave;
        setNomina(null); setPayroll(null); setCobros(null); setFoto(undefined); setAnuncios(null); setFallo(null);
        cargar();
    }, [clave, cargar]);

    const personas = useMemo(() => (nomina ? nomina.map(persona) : null), [nomina]);
    const puente = useMemo(() => (cobros ? puenteDe(cobros) : null), [cobros]);

    /** Un cambio de la fila de un integrante: se ve ya y se guarda; si falla, vuelve a la de antes. */
    const cambiar = useCallback(async (memberId, cambio) => {
        if (!mes) { toast.error('Elegí un mes para marcar pagos'); return; }
        const antes = nomina;
        setNomina((n) => n.map((it) => (it.member_id === memberId ? { ...it, ...cambio } : it)));
        try {
            const fila = await apiFz.guardarNomina({ member_id: memberId, month: mes, ...cambio });
            if (vigente.current === clave) setNomina((n) => n.map((it) => (it.member_id === memberId ? { ...it, ...fila } : it)));
        } catch (error) {
            setNomina(antes);
            toast.error(error?.response?.data?.error || 'No se pudo guardar el cambio');
        }
    }, [mes, nomina, clave]);

    const estado = useCallback((p, nuevo) => {
        const sale = (e) => e === 'pagado' || e === 'transito';
        // Lo mismo que hará el servidor, para que Profit no salte mientras guarda.
        const enviado = sale(nuevo) && !sale(p.estado) ? new Date().toISOString() : sale(nuevo) ? undefined : null;
        cambiar(p.k, { status: nuevo, is_paid: nuevo === 'pagado', ...(enviado !== undefined ? { sent_at: enviado } : {}) });
    }, [cambiar]);
    const metodo = useCallback((p) => cambiar(p.k, { payment_method: p.metodo === 'airtm' ? 'Mercury' : 'AirTM' }), [cambiar]);
    const movimientos = useCallback((p, movs) => cambiar(p.k, { movements: movs }), [cambiar]);

    const guardarFoto = useCallback(async (nueva) => {
        try {
            const f = await apiFz.guardarLiquidez(mes, nueva);
            setFoto(f);
            toast.success('Saldos guardados');
        } catch (error) {
            toast.error(error?.response?.data?.error || 'No se pudieron guardar los saldos');
        }
    }, [mes]);

    /** Sacar o devolver una venta a la nómina: cambia comisiones, así que vuelve a pedir las dos. */
    const excluir = useCallback(async (ventaId, sacar) => {
        try {
            await apiFz.marcarExclusion(ventaId, sacar);
            cargar(['nomina', 'payroll']);
        } catch {
            toast.error('No se pudo cambiar la venta');
        }
    }, [cargar]);

    return {
        personas, payroll, cobros, foto, anuncios, puente, fallo, editable: !!mes,
        estado, metodo, movimientos, guardarFoto, excluir,
        recargarComisiones: () => cargar(['nomina', 'payroll']),
        recargar: () => cargar(),
    };
};

export default useFinanzasApp;
