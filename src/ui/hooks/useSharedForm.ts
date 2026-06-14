import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type ImageInputMode = 'url' | 'upload' | 'generate';

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

type GenerateImageFn = (aspectRatio: string) => Promise<string>;

export function useImageUpload(prefix: 'character' | 'background', generateFn?: GenerateImageFn) {
  const { t } = useTranslation();
  const [imageInputMode, setImageInputMode] = useState<ImageInputMode>('url');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploadError, setImageUploadError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageUploadError(t(`${prefix}.uploadInvalidType`));
      e.currentTarget.value = '';
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setImageUploadError(t(`${prefix}.uploadTooLarge`));
      e.currentTarget.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setImageUploadError('');
      } else {
        setImageUploadError(t(`${prefix}.uploadReadFailed`));
      }
    };
    reader.onerror = () => {
      setImageUploadError(t(`${prefix}.uploadReadFailed`));
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateImage = async (aspectRatio: string = prefix === 'character' ? '1:1' : '16:9') => {
    if (!generateFn) return;
    setIsGenerating(true);
    setImageUploadError('');
    try {
      const dataUri = await generateFn(aspectRatio);
      setImageUrl(dataUri);
      setImageInputMode('url');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Image generation failed';
      setImageUploadError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const switchImageMode = (mode: ImageInputMode) => {
    setImageInputMode(mode);
    setImageUploadError('');
    setImageUrl('');
  };

  const resetImageState = () => {
    setImageInputMode('url');
    setImageUrl('');
    setImageUploadError('');
    setIsGenerating(false);
  };

  return {
    imageInputMode,
    imageUrl,
    imageUploadError,
    isGenerating,
    setImageUrl,
    handleImageUpload,
    handleGenerateImage,
    switchImageMode,
    resetImageState,
  };
}

export function useCopyToSpace() {
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyTargetSpaceId, setCopyTargetSpaceId] = useState('');

  const startCopy = (id: string) => {
    setCopyingId(copyingId === id ? null : id);
    setCopyTargetSpaceId('');
  };

  const finishCopy = () => {
    setCopyingId(null);
    setCopyTargetSpaceId('');
  };

  return {
    copyingId,
    copyTargetSpaceId,
    setCopyTargetSpaceId,
    startCopy,
    finishCopy,
  };
}
