/**
 * secureStorage —— 基于 Web Crypto API 的 JSON 加解密工具
 *
 * 用途：将 ApiConfig 等敏感配置以密文形式持久化到 localStorage，
 * 避免在浏览器开发者工具中直接看到明文 API Key / Token。
 *
 * 算法：AES-GCM 256
 *   - 密钥由 应用密钥 + 设备指纹 经 PBKDF2(100k 迭代) 派生
 *   - 每次加密生成随机 12 字节 IV，密文格式：`enc:v1:<base64(iv)>:<base64(ciphertext)>`
 *
 * 安全说明（纯前端加密的固有限制）：
 *   - 密钥派生材料（应用密钥 + 设备指纹）与密文同源，无法抵御具备完整同源执行能力的攻击者。
 *   - 但能有效防止：①开发者工具直接查看明文 ②简单 XSS 读取明文 ③本地存储文件被直接查阅。
 *   - 这与设计约束"纯前端、无后端"一致：在不引入后端的前提下提升存储安全基线。
 */

const APP_SECRET = 'ai-video-studio::v1::config-seal';
const PBKDF2_ITERATIONS = 100_000;
const KEY_USAGES: KeyUsage[] = ['encrypt', 'decrypt'];

let cachedKey: CryptoKey | null = null;

/** 获取设备指纹（用于密钥派生的 salt 来源） */
function getDeviceFingerprint(): string {
  if (typeof navigator === 'undefined') return 'server-ssr-fallback';
  const n = navigator;
  // 组合稳定性较高的浏览器特征，不追求强唯一性，仅作为 salt
  return [
    n.userAgent,
    n.language,
    String(n.hardwareConcurrency || 0),
    String((n as Navigator & { deviceMemory?: number }).deviceMemory || 0),
  ].join('|');
}

/** 将字符串编码为 Uint8Array */
function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Base64 编码 / 解码（字节安全） */
function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** 派生 AES-GCM 密钥（带缓存，仅首次异步计算） */
async function deriveKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API 不可用，无法派生密钥');
  }
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encode(APP_SECRET) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encode(getDeviceFingerprint()) as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    KEY_USAGES,
  );
  return cachedKey;
}

/** 判断 localStorage 中的字符串是否为加密格式 */
export function isEncryptedPayload(raw: string): boolean {
  return raw.startsWith('enc:v1:');
}

/** 加密对象为密文字符串 */
export async function encryptJSON(obj: unknown): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encode(JSON.stringify(obj));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  return `enc:v1:${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

/** 解密密文字符串为对象 */
export async function decryptJSON<T>(payload: string): Promise<T> {
  const key = await deriveKey();
  const parts = payload.split(':');
  // 期望格式 enc:v1:<iv>:<ciphertext>
  if (parts.length < 4 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('无效的加密载荷格式');
  }
  const iv = fromBase64(parts[2]);
  const ciphertext = fromBase64(parts.slice(3).join(':'));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/** Web Crypto API 是否可用（不可用时降级为明文存储） */
export function isSecureStorageAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}
