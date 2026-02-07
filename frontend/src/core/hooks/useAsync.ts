/**
 * useAsync Hook
 * 
 * Async operation wrapper with loading/error states.
 */

import { useState, useCallback } from 'react';

export interface UseAsyncReturn<T> {
    data: T | null;
    isLoading: boolean;
    error: string | null;
    execute: () => Promise<T | null>;
    reset: () => void;
}

export function useAsync<T>(asyncFn: () => Promise<T>): UseAsyncReturn<T> {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (): Promise<T | null> => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await asyncFn();
            setData(result);
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setError(errorMessage);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [asyncFn]);

    const reset = useCallback(() => {
        setData(null);
        setIsLoading(false);
        setError(null);
    }, []);

    return { data, isLoading, error, execute, reset };
}

/**
 * useAsyncCallback Hook
 * 
 * Similar to useAsync but for callbacks that take parameters.
 */
export interface UseAsyncCallbackReturn<T, Args extends unknown[]> {
    data: T | null;
    isLoading: boolean;
    error: string | null;
    execute: (...args: Args) => Promise<T | null>;
    reset: () => void;
}

export function useAsyncCallback<T, Args extends unknown[]>(
    asyncFn: (...args: Args) => Promise<T>
): UseAsyncCallbackReturn<T, Args> {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (...args: Args): Promise<T | null> => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await asyncFn(...args);
            setData(result);
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setError(errorMessage);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [asyncFn]);

    const reset = useCallback(() => {
        setData(null);
        setIsLoading(false);
        setError(null);
    }, []);

    return { data, isLoading, error, execute, reset };
}
