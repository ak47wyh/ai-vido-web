import { useState, useCallback } from 'react';
import type { PromptCategory } from '../../domain/entities/models';

export interface AssetPickerState {
  isOpen: boolean;
  type: 'image' | 'voice' | 'prompt';
  category?: PromptCategory;
  onSelect?: (asset: any) => void;
}

const initialState: AssetPickerState = {
  isOpen: false,
  type: 'image',
};

export function useAssetPicker() {
  const [state, setState] = useState<AssetPickerState>(initialState);

  const openPicker = useCallback((
    type: 'image' | 'voice' | 'prompt',
    onSelect: (asset: any) => void,
    category?: PromptCategory,
  ) => {
    setState({ isOpen: true, type, category, onSelect });
  }, []);

  const closePicker = useCallback(() => {
    setState(initialState);
  }, []);

  return { state, openPicker, closePicker };
}
