const MAX_IMAGE_SIZE_MB = 20;

// 图片转 Base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 校验图片文件
export const validateImageFile = (file: File): string | null => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) return '仅支持 JPG/PNG/WebP 格式';
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) return `文件大小不能超过 ${MAX_IMAGE_SIZE_MB}MB`;
  return null;
};

export const IMAGE_MAX_SIZE_MB = MAX_IMAGE_SIZE_MB;
