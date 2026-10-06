import { useCallback, useMemo, useState } from 'react';

interface UseAsyncSearchOptionsParams<TItem, TOption> {
    loader: (searchQuery: string) => Promise<TItem[]>;
    mapOption: (item: TItem) => TOption;
}

export function useAsyncSearchOptions<TItem, TOption>({
    loader,
    mapOption,
}: UseAsyncSearchOptionsParams<TItem, TOption>) {
    const [items, setItems] = useState<TItem[]>([]);
    const [loading, setLoading] = useState(false);

    const loadOptions = useCallback(async (searchQuery: string) => {
        setLoading(true);
        try {
            const nextItems = await loader(searchQuery);
            setItems(nextItems);
        } catch (error) {
            console.error('Failed to load async options', error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [loader]);

    const options = useMemo(() => items.map(mapOption), [items, mapOption]);

    return {
        items,
        options,
        loading,
        loadOptions,
        setItems,
    };
}
