import type { ApiConfig, PlatformId } from '../../adapters/outbound/config/ApiConfigStore';
import type { IVideoGeneratorPort, IImageGeneratorPort, ITextGenerationPort, IVoicePort, IMusicPort } from '../ports/OutboundPorts';
import type { IThreeDGenerationPort, IContextCachePort, IBotPort, IDialogPort, IModelResponsePort } from '../ports/VolcenginePorts';

// 导入适配器 —— 已有平台
import { MiniMaxVideoAdapter } from '../../adapters/outbound/api/MiniMaxVideoAdapter';
import { MiniMaxImageAdapter } from '../../adapters/outbound/api/MiniMaxImageAdapter';
import { MiniMaxTextAdapter } from '../../adapters/outbound/api/MiniMaxTextAdapter';
import { MiniMaxVoiceAdapter } from '../../adapters/outbound/api/MiniMaxVoiceAdapter';
import { MiniMaxMusicAdapter } from '../../adapters/outbound/api/MiniMaxMusicAdapter';
import { VolcengineVideoAdapter } from '../../adapters/outbound/api/volcengine/VolcengineVideoAdapter';
import { VolcengineImageAdapter } from '../../adapters/outbound/api/volcengine/VolcengineImageAdapter';
import { VolcengineTextAdapter } from '../../adapters/outbound/api/volcengine/VolcengineTextAdapter';
import { Volcengine3DAdapter } from '../../adapters/outbound/api/volcengine/Volcengine3DAdapter';
import { VolcengineCacheAdapter } from '../../adapters/outbound/api/volcengine/VolcengineCacheAdapter';
import { VolcengineResponseAdapter } from '../../adapters/outbound/api/volcengine/VolcengineResponseAdapter';
import { CozeBotAdapter } from '../../adapters/outbound/api/coze/CozeBotAdapter';
import { CozeDialogAdapter } from '../../adapters/outbound/api/coze/CozeDialogAdapter';

// 导入适配器 —— 新增 5 个平台
import { KlingVideoAdapter } from '../../adapters/outbound/api/kling/KlingVideoAdapter';
import { KlingImageAdapter } from '../../adapters/outbound/api/kling/KlingImageAdapter';
import { WanVideoAdapter } from '../../adapters/outbound/api/wan/WanVideoAdapter';
import { WanImageAdapter } from '../../adapters/outbound/api/wan/WanImageAdapter';
import { WanTextAdapter } from '../../adapters/outbound/api/wan/WanTextAdapter';
import { WanVoiceAdapter } from '../../adapters/outbound/api/wan/WanVoiceAdapter';
import { HunyuanVideoAdapter } from '../../adapters/outbound/api/hunyuan/HunyuanVideoAdapter';
import { HunyuanTextAdapter } from '../../adapters/outbound/api/hunyuan/HunyuanTextAdapter';
import { HunyuanVoiceAdapter } from '../../adapters/outbound/api/hunyuan/HunyuanVoiceAdapter';
import { ZhipuVideoAdapter } from '../../adapters/outbound/api/zhipu/ZhipuVideoAdapter';
import { ZhipuImageAdapter } from '../../adapters/outbound/api/zhipu/ZhipuImageAdapter';
import { ZhipuTextAdapter } from '../../adapters/outbound/api/zhipu/ZhipuTextAdapter';
import { ZhipuVoiceAdapter } from '../../adapters/outbound/api/zhipu/ZhipuVoiceAdapter';
import { ViduVideoAdapter } from '../../adapters/outbound/api/vidu/ViduVideoAdapter';

import { ApiConfigStore } from '../../adapters/outbound/config/ApiConfigStore';
import { hasCapability } from './platformCapabilities';

// 适配器实例缓存
let _videoAdapter: IVideoGeneratorPort | null = null;
let _imageAdapter: IImageGeneratorPort | null = null;
let _textAdapter: ITextGenerationPort | null = null;
let _voiceAdapter: IVoicePort | null = null;
let _musicAdapter: IMusicPort | null = null;
let _threeDAdapter: IThreeDGenerationPort | null = null;
let _cacheAdapter: IContextCachePort | null = null;
let _botAdapter: IBotPort | null = null;
let _dialogAdapter: IDialogPort | null = null;
let _responseAdapter: IModelResponsePort | null = null;

/**
 * 平台路由器
 *
 * 根据 ApiConfig.activePlatform 返回对应平台的适配器实例。
 * 切换平台时调用 reset() 清空缓存，下次 resolve 重新创建适配器。
 *
 * 能力降级：当激活平台不支持某能力时，resolve 对应方法返回 null（或抛错），
 * 调用方/服务层可据此降级。
 */
export class PlatformRouter {
  /**
   * 通用能力路由（向后兼容入口）
   * 根据能力字符串分发到具体的 resolve 方法。
   */
  resolve(capability: 'video', config: ApiConfig): IVideoGeneratorPort;
  resolve(capability: 'image', config: ApiConfig): IImageGeneratorPort;
  resolve(capability: 'text', config: ApiConfig): ITextGenerationPort;
  resolve(capability: 'voice', config: ApiConfig): IVoicePort;
  resolve(capability: 'music', config: ApiConfig): IMusicPort;
  resolve(capability: string, config: ApiConfig): unknown {
    switch (capability) {
      case 'video': return this.resolveVideo(config);
      case 'image': return this.resolveImage(config);
      case 'text': return this.resolveText(config);
      case 'voice': return this.resolveVoice(config);
      case 'music': return this.resolveMusic(config);
      default: throw new Error(`Unsupported capability: ${capability}`);
    }
  }

  /**
   * 获取视频生成适配器
   */
  resolveVideo(config: ApiConfig): IVideoGeneratorPort {
    if (_videoAdapter && this.isMatchingPlatform(_videoAdapter, config.activePlatform)) {
      return _videoAdapter;
    }
    switch (config.activePlatform) {
      case 'volcengine':
        _videoAdapter = new VolcengineVideoAdapter(config);
        break;
      case 'kling':
        _videoAdapter = new KlingVideoAdapter(config);
        break;
      case 'wan':
        _videoAdapter = new WanVideoAdapter(config);
        break;
      case 'hunyuan':
        _videoAdapter = new HunyuanVideoAdapter(config);
        break;
      case 'zhipu':
        _videoAdapter = new ZhipuVideoAdapter(config);
        break;
      case 'vidu':
        _videoAdapter = new ViduVideoAdapter(config);
        break;
      case 'minimax':
      default:
        _videoAdapter = new MiniMaxVideoAdapter();
        break;
    }
    return _videoAdapter;
  }

  /**
   * 获取图片生成适配器
   * 不支持图片的平台（hunyuan / vidu）回退到 MiniMax 以保证 Mock 兼容。
   */
  resolveImage(config: ApiConfig): IImageGeneratorPort {
    if (_imageAdapter && this.isMatchingPlatform(_imageAdapter, config.activePlatform)) {
      return _imageAdapter;
    }
    switch (config.activePlatform) {
      case 'volcengine':
        _imageAdapter = new VolcengineImageAdapter(config);
        break;
      case 'kling':
        _imageAdapter = new KlingImageAdapter(config);
        break;
      case 'wan':
        _imageAdapter = new WanImageAdapter(config);
        break;
      case 'zhipu':
        _imageAdapter = new ZhipuImageAdapter(config);
        break;
      // hunyuan / vidu 不支持图片生成 → 回退 MiniMax（Mock 模式）
      case 'hunyuan':
      case 'vidu':
      case 'minimax':
      default:
        _imageAdapter = new MiniMaxImageAdapter();
        break;
    }
    return _imageAdapter;
  }

  /**
   * 获取文本生成适配器
   * 不支持文本的平台（kling / vidu）回退到 MiniMax 以保证 Mock 兼容。
   */
  resolveText(config: ApiConfig): ITextGenerationPort {
    if (_textAdapter && this.isMatchingPlatform(_textAdapter, config.activePlatform)) {
      return _textAdapter;
    }
    switch (config.activePlatform) {
      case 'volcengine':
        _textAdapter = new VolcengineTextAdapter(config);
        break;
      case 'wan':
        _textAdapter = new WanTextAdapter(config);
        break;
      case 'hunyuan':
        _textAdapter = new HunyuanTextAdapter(config);
        break;
      case 'zhipu':
        _textAdapter = new ZhipuTextAdapter(config);
        break;
      // kling / vidu 不支持文本生成 → 回退 MiniMax（Mock 模式）
      case 'kling':
      case 'vidu':
      case 'minimax':
      default:
        _textAdapter = new MiniMaxTextAdapter();
        break;
    }
    return _textAdapter;
  }

  /**
   * 获取语音合成适配器
   * 不支持语音的平台（kling / vidu）回退到 MiniMax 以保证 Mock 兼容。
   */
  resolveVoice(config: ApiConfig): IVoicePort {
    if (_voiceAdapter && this.isMatchingPlatform(_voiceAdapter, config.activePlatform)) {
      return _voiceAdapter;
    }
    switch (config.activePlatform) {
      case 'wan':
        _voiceAdapter = new WanVoiceAdapter(config);
        break;
      case 'hunyuan':
        _voiceAdapter = new HunyuanVoiceAdapter(config);
        break;
      case 'zhipu':
        _voiceAdapter = new ZhipuVoiceAdapter(config);
        break;
      // kling / vidu / volcengine 不支持语音 → 回退 MiniMax
      case 'kling':
      case 'vidu':
      case 'volcengine':
      case 'minimax':
      default:
        _voiceAdapter = new MiniMaxVoiceAdapter();
        break;
    }
    return _voiceAdapter;
  }

  /**
   * 获取音乐生成适配器
   * 仅 MiniMax 支持音乐生成，其余平台回退到 MiniMaxMusicAdapter（Mock 模式）。
   * UI 层应通过 hasCapability(platform, 'music') 判断是否展示入口。
   */
  resolveMusic(config: ApiConfig): IMusicPort {
    if (_musicAdapter && this.isMatchingPlatform(_musicAdapter, config.activePlatform)) {
      return _musicAdapter;
    }
    // 所有平台均回退 MiniMaxMusicAdapter（仅 minimax 真实可用，其余为 Mock）
    _musicAdapter = new MiniMaxMusicAdapter();
    return _musicAdapter;
  }

  /**
   * 获取 3D 生成适配器（仅 volcengine）
   */
  resolve3D(config: ApiConfig): IThreeDGenerationPort {
    if (_threeDAdapter) return _threeDAdapter;
    _threeDAdapter = new Volcengine3DAdapter(config, 'volcengine-seed3d');
    return _threeDAdapter;
  }

  /**
   * 获取缓存适配器（仅 volcengine）
   */
  resolveCache(config: ApiConfig): IContextCachePort {
    if (_cacheAdapter) return _cacheAdapter;
    _cacheAdapter = new VolcengineCacheAdapter(config);
    return _cacheAdapter;
  }

  /**
   * 获取 Bot 适配器（仅 coze）
   */
  resolveBot(config: ApiConfig): IBotPort {
    if (_botAdapter) return _botAdapter;
    _botAdapter = new CozeBotAdapter(config);
    return _botAdapter;
  }

  /**
   * 获取对话适配器（仅 coze）
   */
  resolveDialog(config: ApiConfig): IDialogPort {
    if (_dialogAdapter) return _dialogAdapter;
    _dialogAdapter = new CozeDialogAdapter(config);
    return _dialogAdapter;
  }

  /**
   * 获取响应适配器（仅 volcengine）
   */
  resolveResponse(config: ApiConfig): IModelResponsePort {
    if (_responseAdapter) return _responseAdapter;
    _responseAdapter = new VolcengineResponseAdapter(config);
    return _responseAdapter;
  }

  /**
   * 检查适配器是否匹配指定平台
   * 通过适配器类名前缀判断（MiniMax* / Volcengine* / Kling* / Wan* / Hunyuan* / Zhipu* / Vidu* / Coze*）
   */
  private isMatchingPlatform(adapter: { constructor: { name: string } }, platform: PlatformId): boolean {
    const adapterName = adapter.constructor.name;
    const platformPrefix: Record<PlatformId, string> = {
      minimax: 'MiniMax',
      volcengine: 'Volcengine',
      coze: 'Coze',
      kling: 'Kling',
      wan: 'Wan',
      hunyuan: 'Hunyuan',
      zhipu: 'Zhipu',
      vidu: 'Vidu',
    };
    return adapterName.startsWith(platformPrefix[platform]);
  }

  /**
   * 判断当前激活平台是否具备指定能力
   * 用于 UI 层入口可用性判断。
   */
  hasCapability(capability: 'video' | 'videoFl2v' | 'videoS2v' | 'image' | 'text' | 'voice' | 'music'): boolean {
    return hasCapability(this.getActivePlatform(), capability);
  }

  /** 获取当前激活平台 */
  getActivePlatform(): PlatformId {
    return ApiConfigStore.getActivePlatform();
  }

  /**
   * 重置所有缓存的适配器实例
   * 当平台切换时调用
   */
  reset(): void {
    _videoAdapter = null;
    _imageAdapter = null;
    _textAdapter = null;
    _voiceAdapter = null;
    _musicAdapter = null;
    _threeDAdapter = null;
    _cacheAdapter = null;
    _botAdapter = null;
    _dialogAdapter = null;
    _responseAdapter = null;
  }
}

// 导出单例
export const platformRouter = new PlatformRouter();
