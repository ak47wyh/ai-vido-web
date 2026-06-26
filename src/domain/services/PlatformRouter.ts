import type { ApiConfig, PlatformId } from '../../adapters/outbound/config/ApiConfigStore';
import type { IVideoGeneratorPort, IImageGeneratorPort, ITextGenerationPort } from '../ports/OutboundPorts';
import type { IThreeDGenerationPort, IContextCachePort, IBotPort, IDialogPort, IModelResponsePort } from '../ports/VolcenginePorts';

// 导入适配器
import { MiniMaxVideoAdapter } from '../../adapters/outbound/api/MiniMaxVideoAdapter';
import { MiniMaxImageAdapter } from '../../adapters/outbound/api/MiniMaxImageAdapter';
import { MiniMaxTextAdapter } from '../../adapters/outbound/api/MiniMaxTextAdapter';
import { VolcengineVideoAdapter } from '../../adapters/outbound/api/volcengine/VolcengineVideoAdapter';
import { VolcengineImageAdapter } from '../../adapters/outbound/api/volcengine/VolcengineImageAdapter';
import { VolcengineTextAdapter } from '../../adapters/outbound/api/volcengine/VolcengineTextAdapter';
import { Volcengine3DAdapter } from '../../adapters/outbound/api/volcengine/Volcengine3DAdapter';
import { VolcengineCacheAdapter } from '../../adapters/outbound/api/volcengine/VolcengineCacheAdapter';
import { VolcengineResponseAdapter } from '../../adapters/outbound/api/volcengine/VolcengineResponseAdapter';
import { CozeBotAdapter } from '../../adapters/outbound/api/coze/CozeBotAdapter';
import { CozeDialogAdapter } from '../../adapters/outbound/api/coze/CozeDialogAdapter';
import { ApiConfigStore } from '../../adapters/outbound/config/ApiConfigStore';

// 适配器实例缓存
let _videoAdapter: IVideoGeneratorPort | null = null;
let _imageAdapter: IImageGeneratorPort | null = null;
let _textAdapter: ITextGenerationPort | null = null;
let _threeDAdapter: IThreeDGenerationPort | null = null;
let _cacheAdapter: IContextCachePort | null = null;
let _botAdapter: IBotPort | null = null;
let _dialogAdapter: IDialogPort | null = null;
let _responseAdapter: IModelResponsePort | null = null;

/**
 * 简化的平台路由器
 * 根据激活的平台返回对应的适配器实例
 */
export class PlatformRouter {
  /**
   * 获取视频生成适配器
   */
  resolveVideo(config: ApiConfig): IVideoGeneratorPort {
    if (_videoAdapter && this.isMatchingPlatform(_videoAdapter, config.activePlatform, 'video')) {
      return _videoAdapter;
    }
    switch (config.activePlatform) {
      case 'volcengine':
        _videoAdapter = new VolcengineVideoAdapter(config);
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
   */
  resolveImage(config: ApiConfig): IImageGeneratorPort {
    if (_imageAdapter && this.isMatchingPlatform(_imageAdapter, config.activePlatform, 'image')) {
      return _imageAdapter;
    }
    switch (config.activePlatform) {
      case 'volcengine':
        _imageAdapter = new VolcengineImageAdapter(config);
        break;
      case 'minimax':
      default:
        _imageAdapter = new MiniMaxImageAdapter();
        break;
    }
    return _imageAdapter;
  }

  /**
   * 获取文本生成适配器
   */
  resolveText(config: ApiConfig): ITextGenerationPort {
    if (_textAdapter && this.isMatchingPlatform(_textAdapter, config.activePlatform, 'text')) {
      return _textAdapter;
    }
    switch (config.activePlatform) {
      case 'volcengine':
        _textAdapter = new VolcengineTextAdapter(config);
        break;
      case 'minimax':
      default:
        _textAdapter = new MiniMaxTextAdapter();
        break;
    }
    return _textAdapter;
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
   */
  private isMatchingPlatform(adapter: any, platform: PlatformId, capability: string): boolean {
    const adapterName = adapter.constructor.name;
    switch (platform) {
      case 'volcengine':
        return adapterName.startsWith('Volcengine');
      case 'minimax':
        return adapterName.startsWith('MiniMax');
      case 'coze':
        return adapterName.startsWith('Coze');
      default:
        return false;
    }
  }

  /**
   * 重置所有缓存的适配器实例
   * 当平台切换时调用
   */
  reset(): void {
    _videoAdapter = null;
    _imageAdapter = null;
    _textAdapter = null;
    _threeDAdapter = null;
    _cacheAdapter = null;
    _botAdapter = null;
    _dialogAdapter = null;
    _responseAdapter = null;
  }
}

// 导出单例
export const platformRouter = new PlatformRouter();