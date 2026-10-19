import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIGENCIA_MS, guardarCache, leerCache, olvidarCache, useDatosCacheados } from './cacheDeVistas';

describe('useDatosCacheados', () => {
    afterEach(() => vi.useRealTimers());

    it('volver a montar la misma vista no vuelve a pedir', async () => {
        const pedir = vi.fn().mockResolvedValue({ n: 1 });
        const primera = renderHook(() => useDatosCacheados('v:a', pedir));
        await waitFor(() => expect(primera.result.current.datos).toEqual({ n: 1 }));
        primera.unmount();

        const segunda = renderHook(() => useDatosCacheados('v:a', pedir));
        expect(segunda.result.current.datos).toEqual({ n: 1 });
        expect(segunda.result.current.cargando).toBe(false);
        expect(pedir).toHaveBeenCalledTimes(1);
    });

    it('recargar (version) siempre pide', async () => {
        const pedir = vi.fn().mockResolvedValueOnce('viejo').mockResolvedValueOnce('nuevo');
        const { result, rerender } = renderHook(({ version }) => useDatosCacheados('v:b', pedir, { version }),
            { initialProps: { version: 0 } });
        await waitFor(() => expect(result.current.datos).toBe('viejo'));
        rerender({ version: 1 });
        await waitFor(() => expect(result.current.datos).toBe('nuevo'));
        expect(pedir).toHaveBeenCalledTimes(2);
    });

    it('lo viejo se muestra al instante y se actualiza en silencio', async () => {
        guardarCache('v:c', 'viejo');
        vi.spyOn(Date, 'now').mockReturnValue(leerCache('v:c').t + VIGENCIA_MS + 1);
        const pedir = vi.fn().mockResolvedValue('nuevo');
        const { result } = renderHook(() => useDatosCacheados('v:c', pedir));
        expect(result.current.datos).toBe('viejo');
        expect(result.current.cargando).toBe(false);
        await waitFor(() => expect(result.current.datos).toBe('nuevo'));
        vi.restoreAllMocks();
    });

    it('otro período no muestra los datos del anterior y setDatos guarda en el recuerdo', async () => {
        const pedir = vi.fn((signal) => new Promise(() => signal))
            .mockResolvedValueOnce([1]);
        const { result, rerender } = renderHook(({ clave }) => useDatosCacheados(clave, pedir), { initialProps: { clave: 'v:d1' } });
        await waitFor(() => expect(result.current.datos).toEqual([1]));
        act(() => result.current.setDatos((d) => [...d, 2]));
        expect(leerCache('v:d1').datos).toEqual([1, 2]);
        rerender({ clave: 'v:d2' });
        expect(result.current.datos).toBeNull();
        olvidarCache('v:');
        expect(leerCache('v:d1')).toBeUndefined();
    });
});
