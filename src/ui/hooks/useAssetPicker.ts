import { useState, useCallback } from 'react';
import type { PromptCategory, SavedImage, SavedVoice, SavedPrompt } from '../../domain/entities/models';

type AssetItem = SavedImage | SavedVoice | SavedPrompt;

export interface AssetPickerState {
  isOpen: boolean;
  type: 'image' | 'voice' | 'prompt';
  category?: PromptCategory;
  onSelect?: (asset: AssetItem) => void;
}

const initialState: AssetPickerState = {
  isOpen: false,
  type: 'image',
};

export function useAssetPicker() {
  const [state, setState] = useState<AssetPickerState>(initialState);

  const openPicker = useCallback((
    type: 'image' | 'voice' | 'prompt',
    onSelect: (asset: AssetItem) => void,
    category?: PromptCategory,
  ) => {
    setState({ isOpen: true, type, category, onSelect });
  }, []);

  const closePicker = useCallback(() => {
    setState(initialState);
  }, []);

  return { state, openPicker, closePicker };
}
