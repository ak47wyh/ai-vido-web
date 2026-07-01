/**
 * 文本输入框长度限制常量。
 *
 * 设计原则（详见 TextInputLengthDesign.md）：
 *  - UI 层用 TEXT_LIMITS：取跨平台最小兼容值，浏览器原生 maxLength 硬限制。
 *  - 适配器层用 ADAPTER_TEXT_LIMITS：各平台官方硬限，slice 截断兜底防御。
 *
 * 统一配置源规则：
 *  - UI 层、适配器层、Service 层必须从本文件引用常量，禁止任何层硬编码数字。
 *  - 适配器/Service 层需要使用常量但本文件中不存在时，必须在本文件中声明。
 *
 * 数据来源：官方 API 文档原文核对（2026-07）。
 */

/**
 * UI 层通用 maxLength 常量（跨平台最小兼容值）。
 */
export const TEXT_LIMITS = {
  // 图像/视频生成 prompt（UI 层跨平台取最小兼容值）
  IMAGE_PROMPT_MAX: 1500,            // MiniMax 1500 / 万相 5000 / 混元 1024
  VIDEO_PROMPT_MAX: 2000,            // 恢复改造前值；adapter 各平台值均 ≤ 2000，由 adapter 兜底

  // TTS（核对官方文档后修订）
  TTS_TEXT_MAX: 10000,                 // MiniMax 同步 TTS 官方"<500字符"
  TTS_ASYNC_TEXT_MAX: 10000,         // MiniMax 异步长文本上限（火山异步 10 万字符远大于此）
  VOICE_CLONE_PROMPT_MAX: 1500,
  VOICE_DESIGN_PROMPT_MAX: 1500,
  VOICE_DESIGN_PREVIEW_MAX: 1500,
  VOICE_NAME_MAX: 100,

  // 音乐（核对 MiniMax 音乐 API 后修订）
  MUSIC_PROMPT_MAX: 2000,            // music-2.6 模式
  MUSIC_LYRICS_MAX: 3500,            // music-2.6 模式
  MUSIC_LYRICS_INPUT_MAX: 3500,      // 需修改歌词输入
  MUSIC_COVER_PROMPT_MAX: 300,       // music-cover 翻唱模式硬限 [10, 300]
  MUSIC_COVER_LYRICS_MAX: 1000,      // music-cover 翻唱模式硬限 [10, 1000]
  MUSIC_LYRICS_PROMPT_MAX: 2000,     // 歌词生成描述（MiniMax 文本对话，保守值）
  SONG_TITLE_MAX: 100,

  // 文本对话
  CHAT_INPUT_MAX: 8000,
  REFINE_INPUT_MAX: 8000,
  AGENT_INPUT_MAX: 500,

  // 故事
  STORY_TITLE_MAX: 100,
  STORY_CONTENT_MAX: 10000,

  // 角色/背景
  CHAR_NAME_MAX: 100,
  CHAR_APPEARANCE_MAX: 1000,
  CHAR_PERSONALITY_MAX: 1000,
  CHAR_BACKGROUND_MAX: 2000,         // 恢复改造前值，不拼入外部接口，无需 adapter 截断
  BG_NAME_MAX: 100,
  BG_ENV_PROMPT_MAX: 1000,

  // 分镜
  SEGMENT_ACTION_MAX: 500,           // 拼入视频 prompt，混元硬限 200，UI 取 500
  DRAFT_NAME_MAX: 50,
  DRAFT_PROMPT_MAX: 1000,
  SUBTITLE_CLIP_TEXT_MAX: 200,
  SUBTITLE_TEXT_MAX: 5000,
  CINEMATOGRAPHY_PROMPT_MAX: 1000,

  // BGM（与 MusicLab music-2.6 一致）
  BGM_PROMPT_MAX: 2000,
  BGM_LYRICS_MAX: 3500,

  // 本地管理
  SPACE_NAME_MAX: 50,
  SPACE_DESC_MAX: 500,
  ASSET_NAME_MAX: 100,
  ASSET_TAGS_MAX: 200,
  SEARCH_KEYWORD_MAX: 50,
  LOG_SEARCH_MAX: 100,

  // URL / 配置
  URL_MAX: 2048,
  API_KEY_MAX: 200,
  BASE_URL_MAX: 500,
  SPACE_ID_MAX: 100,
  PATH_PREFIX_MAX: 200,
} as const;

/**
 * 各平台适配器层硬限（用于 slice 截断兜底，与 UI 层常量分离）。
 * 详见设计文档第 4.2 节"需在适配器层补充截断兜底的接口"。
 */
export const ADAPTER_TEXT_LIMITS = {
  // 视频生成
  HUNYUAN_VIDEO_PROMPT_MAX: 200,     // 腾讯混元视频"最多支持200个utf-8字符"（最严格）
  ZHIPU_VIDEO_PROMPT_MAX: 800,       // 智谱 CogVideoX 226 token ≈ 800 中文字符
  MINIMAX_VIDEO_PROMPT_MAX: 2000,    // MiniMax 视频"最大支持2000字符"
  VIDU_VIDEO_PROMPT_MAX: 1500,       // Vidu "字符长度不能超过1500个字符"
  KLING_VIDEO_PROMPT_MAX: 2500,      // 可灵"不超过2500个字符"
  WAN_VIDEO_PROMPT_MAX: 5000,        // 万相 2.7 "超过部分会自动截断"
  WAN_VIDEO_NEGATIVE_PROMPT_MAX: 500,// 万相 2.7 negative_prompt
  VOLC_VIDEO_PROMPT_MAX: 500,        // 火山视频 Seedance content[].text（建议中文≤500字）

  // 图像生成
  HUNYUAN_IMAGE_PROMPT_MAX: 1024,    // 腾讯混元生图"最多可传1024个utf-8字符"
  MINIMAX_IMAGE_PROMPT_MAX: 1500,    // MiniMax 图像（已在代码中实现）
  VOLC_IMAGE_PROMPT_MAX: 1500,       // 火山图像 Seedream（官方未明确硬限，保守取 1500）
  KLING_IMAGE_PROMPT_MAX: 1500,      // 可灵图像（官方未明确硬限，保守取 1500）
  WAN_IMAGE_PROMPT_MAX: 1500,        // 万相图像（官方未明确硬限，保守取 1500）
  ZHIPU_IMAGE_PROMPT_MAX: 1500,      // 智谱图像 CogView（官方未明确硬限，保守取 1500）
  VIDU_IMAGE_PROMPT_MAX: 1500,       // Vidu 图像（官方未明确硬限，保守取 1500）

  // TTS
  MINIMAX_TTS_SYNC_MAX: 500,         // MiniMax T2A 同步"<500字符"
  MINIMAX_TTS_ASYNC_MAX: 10000,      // MiniMax 异步长文本
  VOLC_TTS_SYNC_MAX_BYTES: 1024,     // 火山旧 TTS 同步 1024 字节 UTF-8（约 340 中文字）
  VOLC_TTS_ASYNC_MAX: 100000,        // 火山异步长文本 10 万字符

  // 声音克隆/设计（官方未明确硬限，保守取同步 TTS 值 500）
  MINIMAX_VOICE_CLONE_TEXT_MAX: 500,       // MiniMax 声音克隆试听 text
  MINIMAX_VOICE_CLONE_PROMPT_MAX: 500,     // MiniMax 声音克隆 clone_prompt.prompt_text
  MINIMAX_VOICE_DESIGN_PROMPT_MAX: 500,    // MiniMax 声音设计 prompt
  MINIMAX_VOICE_DESIGN_PREVIEW_MAX: 500,   // MiniMax 声音设计 preview_text

  // 音乐
  MINIMAX_MUSIC_PROMPT_MAX: 2000,    // music-2.6
  MINIMAX_MUSIC_COVER_PROMPT_MAX: 300, // music-cover
  MINIMAX_MUSIC_LYRICS_MAX: 3500,    // music-2.6
  MINIMAX_MUSIC_COVER_LYRICS_MAX: 1000, // music-cover
} as const;
