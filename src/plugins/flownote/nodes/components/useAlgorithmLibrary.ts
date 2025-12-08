import { useState, useEffect } from 'react';
import { INodeSchema } from '../../types';

/**
 * 算法库 Hook
 * 统一管理算法库的获取逻辑，避免重复代码
 */
export const useAlgorithmLibrary = () => {
  const [library, setLibrary] = useState<Record<string, INodeSchema[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const response = await fetch('/aiserver/function-library');
        if (response.ok) {
          const json = await response.json();
          setLibrary(json || {});
        } else {
          setError(`Failed to fetch: ${response.statusText}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        console.error('useAlgorithmLibrary: fetch error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchLibrary();
  }, []);

  const allSchemas: INodeSchema[] = Object.values(library).flat();

  return { library, allSchemas, loading, error };
};
