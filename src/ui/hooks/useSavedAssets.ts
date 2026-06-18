import { useState, useEffect, useCallback } from 'react';
import { assetLibraryService } from '../../dependencies';
import type { SavedImage, SavedVoice, SavedPrompt } from '../../domain/entities/models';
import type { AssetQueryParams } from '../../domain/ports/AssetLibraryPorts';

/** 查询当前空间下保存的图片素材 */
export function useSavedImages(spaceId: string, params?: Omit<AssetQueryParams, 'spaceId'>) {
  const [images, setImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    setError(null);
    try {
      const results = await assetLibraryService.queryImages({ spaceId, ...params });
      setImages(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  }, [spaceId, paramsKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
  }, [refetch]);

  return { images, loading, error, refetch };
}

/** 查询当前空间下保存的音色素材 */
export function useSavedVoices(spaceId: string, params?: Omit<AssetQueryParams, 'spaceId'>) {
  const [voices, setVoices] = useState<SavedVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    setError(null);
    try {
      const results = await assetLibraryService.queryVoices({ spaceId, ...params });
      setVoices(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load voices');
    } finally {
      setLoading(false);
    }
  }, [spaceId, paramsKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
  }, [refetch]);

  return { voices, loading, error, refetch };
}

/** 查询当前空间下保存的提示词素材 */
export function useSavedPrompts(spaceId: string, params?: Omit<AssetQueryParams, 'spaceId'>) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    setError(null);
    try {
      const results = await assetLibraryService.queryPrompts({ spaceId, ...params });
      setPrompts(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, [spaceId, paramsKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
  }, [refetch]);

  return { prompts, loading, error, refetch };
}
