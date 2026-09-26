import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_POR_DEFECTO, useModoVista } from './useModoVista';

/**
 * El hook es chico pero tiene tres formas de fallar en producción y ninguna en desarrollo: el
 * `localStorage` que tira excepción en una ventana privada, el valor basura que dejó otra versión
 * de la app en esa clave, y el parpadeo de leer la preferencia en un efecto en vez de en el estado
 * inicial. Los tres están fijados acá.
 */

describe('useModoVista', () => {
    beforeEach(() => { window.localStorage.clear(); });
    afterEach(() => { vi.restoreAllMocks(); });

    it('arranca en lista cuando no hay nada guardado', () => {
        const { result } = renderHook(() => useModoVista());

        expect(result.current.modo).toBe('lista');
        expect(result.current.esLista).toBe(true);
        expect(result.current.esTarjetas).toBe(false);
    });

    it('recuerda la elección: la escribe al cambiar', () => {
        const { result } = renderHook(() => useModoVista());

        act(() => result.current.setModo('tarjetas'));

        expect(result.current.modo).toBe('tarjetas');
        expect(window.localStorage.getItem(CLAVE_POR_DEFECTO)).toBe('tarjetas');
    });

    it('recuerda la elección: la lee al montar de nuevo', () => {
        window.localStorage.setItem(CLAVE_POR_DEFECTO, 'tarjetas');

        const { result } = renderHook(() => useModoVista());

        // Desde el PRIMER render, no después de un efecto: leerla más tarde pinta la lista y
        // después salta a tarjetas, y ese salto se ve.
        expect(result.current.modo).toBe('tarjetas');
    });

    it('alterna entre los dos modos', () => {
        const { result } = renderHook(() => useModoVista());

        act(() => result.current.alternar());
        expect(result.current.modo).toBe('tarjetas');

        act(() => result.current.alternar());
        expect(result.current.modo).toBe('lista');
        expect(window.localStorage.getItem(CLAVE_POR_DEFECTO)).toBe('lista');
    });

    it('cada clave recuerda su propia elección', () => {
        const a = renderHook(() => useModoVista('agendas_view_mode'));
        act(() => a.result.current.setModo('tarjetas'));

        const b = renderHook(() => useModoVista('ventas_view_mode'));

        expect(b.result.current.modo).toBe('lista');
        expect(window.localStorage.getItem('agendas_view_mode')).toBe('tarjetas');
    });

    it('cambiar de clave vuelve a leer la preferencia de esa clave', () => {
        window.localStorage.setItem('ventas_view_mode', 'tarjetas');
        const { result, rerender } = renderHook(({ clave }) => useModoVista(clave),
            { initialProps: { clave: 'agendas_view_mode' } });

        expect(result.current.modo).toBe('lista');

        rerender({ clave: 'ventas_view_mode' });

        expect(result.current.modo).toBe('tarjetas');
    });

    it('un valor guardado que no es un modo válido se ignora', () => {
        // Lo pudo haber escrito otra versión de la app en la misma clave.
        window.localStorage.setItem(CLAVE_POR_DEFECTO, 'kanban');

        const { result } = renderHook(() => useModoVista());

        expect(result.current.modo).toBe('lista');
    });

    it('no se puede poner un modo que no existe', () => {
        const { result } = renderHook(() => useModoVista());

        act(() => result.current.setModo('kanban'));

        expect(result.current.modo).toBe('lista');
    });

    it('un modo inicial inválido cae en lista', () => {
        const { result } = renderHook(() => useModoVista(CLAVE_POR_DEFECTO, 'kanban'));
        expect(result.current.modo).toBe('lista');
    });

    it('respeta el modo inicial que le pasen cuando no hay nada guardado', () => {
        const { result } = renderHook(() => useModoVista(CLAVE_POR_DEFECTO, 'tarjetas'));
        expect(result.current.modo).toBe('tarjetas');
    });

    describe('sin localStorage disponible', () => {
        it('leer no puede romper el primer render', () => {
            vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
                throw new Error('SecurityError: acceso denegado');
            });

            const { result } = renderHook(() => useModoVista());

            expect(result.current.modo).toBe('lista');
        });

        it('escribir no puede romper el cambio de modo: solo se olvida', () => {
            vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

            const { result } = renderHook(() => useModoVista());
            act(() => result.current.setModo('tarjetas'));

            expect(result.current.modo).toBe('tarjetas');
        });
    });
});
