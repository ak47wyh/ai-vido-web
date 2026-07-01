import { TEXT_LIMITS } from '../../domain/constants/textLimits';

type ShowToastFn = (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;

/**
 * 文本长度超限验证工具。
 *
 * 设计原则：不做任何截断，仅检查长度是否超限。
 * 超限时通过 toast 提示用户自行调整文本。
 *
 * @param text 待验证的文本
 * @param limit 最大长度限制
 * @param fieldName 字段名称（用于提示信息，可选）
 * @param showToast toast 函数（可选，不传则仅返回验证结果）
 * @returns true 表示通过验证（未超限），false 表示超限
 */
export function validateTextLimit(
  text: string,
  limit: number,
  fieldName?: string,
  showToast?: ShowToastFn,
): boolean {
  const length = text?.length ?? 0;
  if (length > limit) {
    const label = fieldName ? `「${fieldName}」` : '文本';
    const message = `${label}超出长度限制（当前 ${length} 字，上限 ${limit} 字），请调整后重试`;
    if (showToast) {
      showToast('warning', message);
    }
    return false;
  }
  return true;
}

/**
 * 批量验证多个字段的文本长度。
 *
 * @param fields 待验证的字段数组
 * @param showToast toast 函数
 * @returns true 表示全部通过，false 表示存在超限
 */
export function validateTextLimits(
  fields: Array<{ text: string; limit: number; fieldName?: string }>,
  showToast?: ShowToastFn,
): boolean {
  for (const field of fields) {
    if (!validateTextLimit(field.text, field.limit, field.fieldName, showToast)) {
      return false;
    }
  }
  return true;
}

export { TEXT_LIMITS };
