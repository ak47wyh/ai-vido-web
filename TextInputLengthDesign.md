# 文本输入框长度限制设计文档

> 版本：v1.0
> 编写日期：2026-07-01
> 范围：`src/ui` 目录下全部文本输入框（含原生 `<input>` / `<textarea>` 及封装组件 `InputWithCounter` / `TextAreaWithCounter` / `FormField`）
> 目标：对所有涉及调用外部接口的文本输入框，按接口实际字数限制设置输入长度上限；对纯本地存储/搜索类输入框，按存储与体验合理设置上限。

---

## 一、背景与目标

### 1.1 背景
项目是一个多平台 AI 视频/图像/语音/音乐/文本生成工作台，前端通过 `src/adapters/outbound/api` 下的适配器调用 MiniMax、火山引擎、可灵、万相、混元、智谱、Vidu、Coze 等多家外部 AI 服务。

经调研发现：
- 适配器层几乎未对文本字段做长度校验或截断（仅 `MiniMaxImageAdapter` 对 `prompt` 做了 1500 字符截断）。
- UI 层 86 处文本输入中，仅 18 处设置了 `maxLength`，其余 68 处处于"无上限"状态。
- 当用户输入超出接口限制时，会直接收到外部 API 的 4xx 错误，体验差且难以定位原因。

### 1.2 目标
1. **接口类输入**：按所调用接口的最小字数限制设置 `maxLength`，从源头避免超长请求。
2. **本地类输入**：按本地存储合理上限与使用场景设置 `maxLength`，避免异常长文本污染数据。
3. **统一交互**：所有带字数限制的输入框均显示字符计数器，超限时视觉提示。
4. **统一实现**：优先复用现有 `InputWithCounter` / `TextAreaWithCounter` 组件，减少原生标签裸用。

### 1.3 设计原则
- **取最小值原则**：当一个输入框的内容会路由到多个平台接口时，UI 层 `maxLength` 取所有平台限制中的**最小值**，确保任意平台都可接受；如需更精细控制，可在适配器层按平台动态截断。
- **UI 层硬限 + 适配器层兜底**：UI 层用 `maxLength` 做硬限制（浏览器原生阻止输入），适配器层保留 `slice` 截断作为兜底防御。
- **字符计数器**：所有有限制的输入框显示 `当前长度/上限`，超限时变红。
- **不破坏现有数据**：已设置且合理的 `maxLength` 保持不变；本次仅对"未设置"或"设置不合理"的项进行调整。
- **URL 类输入**：统一采用 2048 字符（主流浏览器 URL 长度上限的保守值）。

---

## 二、外部接口字数限制调研结果（已核对官方文档）

### 2.1 各平台接口文本字段限制（官方文档原文核对）

| 平台 | 接口/字段 | 限制值 | 来源 | 代码中是否已截断 |
|---|---|---|---|---|
| MiniMax | 图像生成 `prompt` | **1500 字符** | 代码常量 `MAX_PROMPT_LENGTH` | ✅ `MiniMaxImageAdapter.ts:34-41` |
| MiniMax | T2A 同步语音合成 `text` | **500 字符**（官方原文"长度限制<500字符"） | [T2A 文档](https://platform.minimaxi.com/document/T2A?key=667bde023be2027f69b71d5a) | ❌ 裸传 |
| MiniMax | T2A 异步长文本 `text` | **10000 字符** | 异步 TTS 接口文档 | ❌ 裸传 |
| MiniMax | 视频生成 `prompt` | **2000 字符**（官方原文"最大支持2000字符"） | [视频生成文档](https://platform.minimaxi.com/document/video_generation?key=66d1439376e52fcee2853049) | ❌ 裸传 |
| MiniMax | 音乐生成 `prompt`（music-2.6 非纯音乐） | **2000 字符** | [音乐生成 API 参考](https://platform.minimaxi.com/docs/api-reference/music-generation) | ❌ 裸传 |
| MiniMax | 音乐生成 `prompt`（music-cover 翻唱） | **300 字符**（[10, 300]） | 同上 | ❌ 裸传 |
| MiniMax | 音乐生成 `lyrics`（music-2.6） | **3500 字符**（[1, 3500]） | 同上 | ❌ 裸传 |
| MiniMax | 音乐生成 `lyrics`（music-cover 翻唱） | **1000 字符**（[10, 1000]） | 同上 | ❌ 裸传 |
| MiniMax | 文本对话 `messages[].content` | 按 token 计（数十万 token 上下文） | 官方文档 | ❌ 裸传 |
| 可灵 Kling | 视频生成 `prompt` | **2500 字符** | [可灵 API 文档](https://www.aiping.cn/docs/API/VideoAPI/KLING_VIDEO_API_DOC) | ❌ 裸传 |
| 可灵 Kling | 视频生成 `negative_prompt` | **2500 字符** | 同上 | ❌ 代码未实际传 |
| 可灵 Kling | 多镜头分镜 `prompt` | **512 字符** | 同上 | ❌ 裸传 |
| Vidu | 视频生成 `prompt` | **1500 字符**（"字符长度不能超过 1500 个字符"） | [Vidu API 文档](https://apifox.chatgptten.com/api-324616980) | ❌ 裸传 |
| 智谱 CogVideoX | 视频生成 `prompt` | **226 token**（约 800 中文字符） | [CogVideoX 文档](https://doc.damodel.com/profile/best_practice/CogVideoX-6B/CogVideoX-6B.html) | ❌ 裸传 |
| 万相 Wan 2.7 | 视频/图像生成 `prompt` | **5000 字符**（"超过部分会自动截断"） | [万相文生视频 API](https://help.aliyun.com/zh/model-studio/text-to-video-api-reference) | ❌ 裸传 |
| 万相 Wan 2.7 | 视频生成 `negative_prompt` | **500 字符** | 同上 | ❌ 裸传 |
| 万相 Wan 2.1（旧版） | 视频生成 `prompt` | **800 字符** | 社区文档（早期版本） | ❌ 裸传 |
| 混元 Hunyuan | 图像生成 `Prompt` / `NegativePrompt` | **1024 utf-8 字符** | [混元生图文档](https://cloud.tencent.com/document/api/1668/120721) | ❌ 裸传 |
| 混元 Hunyuan | 视频生成 `Prompt` | **200 utf-8 字符**（官方原文"最多支持200个utf-8字符"） | [混元生视频文档](https://cloud.tencent.com/developer/article/2696379) | ❌ 裸传 |
| 火山引擎豆包 | TTS 同步 `text`（旧 TTS 接口） | **1024 字节 UTF-8**（约 340 中文字） | [参数说明文档](https://www.volcengine.com/docs/6561/79823) | ❌ 裸传 |
| 火山引擎豆包 | TTS 异步长文本 `input` | **100000 字符** | [异步长文本文档](https://www.volcengine.com/docs/6561/1829010) | ❌ 裸传 |
| 火山引擎豆包 | 视频生成 `content[].text`（Seedance） | 官方建议中文 ≤500 字、英文 ≤1000 词（建议值非硬限） | [视频生成文档](https://www.volcengine.com/docs/82379/1520757) | ❌ 裸传 |
| 火山引擎豆包 | 即梦视频 `prompt` | 建议 ≤400 字、不超过 800 字 | [即梦视频 API](https://www.aiping.cn/docs/API/VideoAPI/VOLCENGINE_VIDEO_API_DOC) | ❌ 裸传 |
| Coze | 对话 `query` / `messages[].content` | 按 token 计（无明确字符硬限） | 官方文档 | ❌ 裸传 |

### 2.2 关键结论（核对后修订）

1. **视频生成 prompt 的 UI 层通用上限**：跨平台官方硬限差异极大，最小值=混元 200 字符，最大值=可灵 2500 字符。
   - **折中方案**：UI 层统一取 **1500 字符**（兼容 Vidu / 万相旧版 / MiniMax；可灵 2500 与万相 2.7 的 5000 远超该值，无影响）。
   - 适配器层兜底：**混元** `slice(0, 200)`、**智谱** `slice(0, 800)`，避免直接请求失败。
   - VideoLab #3-#6 当前 2000 仍超过 Vidu/万相旧版 1500 上限，**需下调至 1500**。

2. **图像生成 prompt 的 UI 层通用上限**：跨平台最小值=混元 1024 字符，MiniMax/万相 1500/5000。
   - **方案**：UI 层取 **1500 字符**（与现有 MiniMax 实现一致），混元适配器层 `slice(0, 1024)` 兜底。

3. **TTS 同步文本 UI 层上限**：MiniMax 同步 TTS 限制 **500 字符**（非之前估计的 10000），火山旧 TTS 限制 1024 字节（约 340 中文字）。
   - **方案**：UI 层同步 TTS 取 **500 字符**（取最小值，确保所有平台兼容）。
   - VoiceLab #8 `ttsText` 当前 5000 **需下调至 500**。

4. **TTS 异步长文本 UI 层上限**：火山异步 10 万字符、MiniMax 异步 1 万字符。
   - **方案**：UI 层取 **10000 字符**（取最小值 MiniMax 异步上限）。
   - VoiceLab #14 `asyncText` 当前 UI 显示 50000 **需下调至 10000**，或在适配器层针对火山走异步、MiniMax 走分片。

5. **音乐生成 prompt 上限**：music-2.6 模式 2000 字符，music-cover 翻唱模式仅 300 字符。
   - **方案**：UI 层作曲模式取 **2000 字符**；翻唱模式取 **300 字符**。

6. **音乐生成 lyrics 上限**：music-2.6 模式 3500 字符，music-cover 翻唱模式 1000 字符。
   - **方案**：UI 层作曲歌词取 **3500 字符**；翻唱歌词取 **1000 字符**。

---

## 三、文本输入框长度配置清单

> 说明：
> - **当前值**：现状（含"无"表示未设置 maxLength）。
> - **建议值**：本设计文档推荐的 maxLength。
> - **接口限制**：该输入框内容最终调用的接口及其字数限制（纯本地输入标注"本地"）。
> - **状态**：✅ 符合（无需改动） / ⚠️ 需补充 maxLength / 🔁 建议迁移到封装组件。

### 3.1 图像生成类（ImageLab）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | `ui/pages/ImageLab.tsx` | 358 | T2I 画面描述 `t2iPrompt` | 各平台图像生成 prompt | 1500 字符 | 1500 | 1500 | ✅ |
| 2 | `ui/pages/ImageLab.tsx` | 434 | I2I 画面描述 `i2iPrompt` | 各平台图像生成 prompt | 1500 字符 | 1500 | 1500 | ✅ |

### 3.2 视频生成类（VideoLab）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 3 | `ui/pages/VideoLab.tsx` | 435 | T2V 视频描述 `t2vPrompt` | 各平台视频生成 prompt | 1500（智谱 800） | 2000 | **1500** | ⚠️ |
| 4 | `ui/pages/VideoLab.tsx` | 481 | I2V 视频描述 `i2vPrompt` | 各平台视频生成 prompt | 1500（智谱 800） | 2000 | **1500** | ⚠️ |
| 5 | `ui/pages/VideoLab.tsx` | 547 | FL2V 视频描述 `fl2vPrompt` | 各平台视频生成 prompt | 1500（智谱 800） | 2000 | **1500** | ⚠️ |
| 6 | `ui/pages/VideoLab.tsx` | 595 | S2V 视频描述 `s2vPrompt` | 各平台视频生成 prompt | 1500（智谱 800） | 2000 | **1500** | ⚠️ |
| 7 | `ui/pages/VideoLab.tsx` | 645 | Agent 描述文本 `agentTextInput` | MiniMax Agent `text_inputs` | 保守 2000 | 无 | **2000** | ⚠️ |

> 备注：#3-#6 当前 2000 超过 Vidu/MiniMax 的 1500 上限，需下调。智谱的 800 限制建议在 `ZhipuVideoAdapter` 内补充 `slice(0, 800)` 兜底，UI 层不强制降到 800 以免影响其他平台表达力。

### 3.3 语音合成类（VoiceLab）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 8 | `ui/pages/VoiceLab.tsx` | 440 | TTS 配音文本 `ttsText` | 各平台同步 TTS `text` | MiniMax 500 / 火山 340 中文字 | 5000 | **500** | ⚠️ 需下调 |
| 9 | `ui/pages/VoiceLab.tsx` | 596 | 克隆示例音频对应文本 `promptText` | MiniMax 声音克隆 `promptText` | 官方未明确，保守 500 | 500 | 500 | ✅ |
| 10 | `ui/pages/VoiceLab.tsx` | 610 | 克隆音色名称 `cloneName` | 本地 + 接口音色命名 | 本地 | 100 | 100 | ✅ |
| 11 | `ui/pages/VoiceLab.tsx` | 623 | 克隆试听文本 `cloneText` | MiniMax TTS `text` | 500 | 500 | 500 | ✅ |
| 12 | `ui/pages/VoiceLab.tsx` | 691 | 音色设计描述 `designPrompt` | MiniMax 声音设计 `prompt` | 官方未明确，保守 500 | 无 | **500** | ⚠️ |
| 13 | `ui/pages/VoiceLab.tsx` | 702 | 设计试听文本 `designPreviewText` | MiniMax TTS `preview_text` | 500 | 无（onChange 截 500） | **500** | ⚠️ 改用 maxLength |
| 14 | `ui/pages/VoiceLab.tsx` | 759 | 长文本内容 `asyncText` | 火山异步 TTS `input` / MiniMax 异步 | 火山 100000 / MiniMax 10000 | 无（UI 显示 /50000） | **10000** | ⚠️ 改用 maxLength，下调至 10000 |
| 15 | `ui/pages/VoiceLab.tsx` | 847 | 音色搜索 `voiceSearch` | 本地搜索 | 本地 | 无 | **50** | ⚠️ |

### 3.4 音乐生成类（MusicLab）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 16 | `ui/pages/MusicLab.tsx` | 311 | 歌曲描述 `composePrompt` | MiniMax 音乐 `prompt`（music-2.6） | 2000 字符 | 1000 | **2000** | ⚠️ 可上调 |
| 17 | `ui/pages/MusicLab.tsx` | 336 | 歌词 `composeLyrics` | MiniMax 音乐 `lyrics`（music-2.6） | 3500 字符 | 无 | **3500** | ⚠️ |
| 18 | `ui/pages/MusicLab.tsx` | 473 | 歌曲标题 `lyricsTitle` | 本地 + 接口 | 本地 | 无 | **100** | ⚠️ |
| 19 | `ui/pages/MusicLab.tsx` | 486 | 歌词生成描述 `lyricsPrompt` | MiniMax 文本对话 | 按 token，保守 2000 | 无 | **2000** | ⚠️ |
| 20 | `ui/pages/MusicLab.tsx` | 497 | 需修改的歌词 `lyricsInput` | MiniMax 音乐 `lyrics`（music-2.6） | 3500 字符 | 无 | **3500** | ⚠️ |
| 21 | `ui/pages/MusicLab.tsx` | 612 | 翻唱风格描述 `coverPrompt` | MiniMax 音乐 `prompt`（music-cover） | **300 字符** | 无 | **300** | ⚠️ 翻唱硬限 |
| 22 | `ui/pages/MusicLab.tsx` | 624 | 翻唱歌词 `coverLyrics` | MiniMax 音乐 `lyrics`（music-cover） | **1000 字符** | 无 | **1000** | ⚠️ 翻唱硬限 |

### 3.5 文本对话类（TextLab）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 23 | `ui/pages/TextLab.tsx` | 384 | 聊天输入 `input` | 各平台文本对话 `messages` | 按 token 计，保守 8000 字符 | 无 | **8000** | ⚠️ |
| 24 | `ui/pages/TextLab.tsx` | 426 | 润色输入 `refineInput` | 各平台文本对话 `messages` | 保守 8000 字符 | 无 | **8000** | ⚠️ |

### 3.6 Agent 对话类

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 25 | `ui/components/AgentChatPanel.tsx` | 177 | 聊天消息输入 | Coze/MiniMax 对话 `query` | 保守 500 | 500 | 500 | ✅ |

### 3.7 角色管理（CharacterManagement）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 26 | `ui/pages/CharacterManagement.tsx` | 174 | 角色名称 `name` | 本地 + 拼入 prompt | 本地 | 100 | 100 | ✅ |
| 27 | `ui/pages/CharacterManagement.tsx` | 187 | 角色外观 `appearance` | 拼入图像生成 prompt | 跨平台最小 1024（混元） | 1000 | 1000 | ✅（保守合理） |
| 28 | `ui/pages/CharacterManagement.tsx` | 211 | 角色性格 `personality` | 拼入 prompt | 跨平台最小 1024（混元） | 1000 | 1000 | ✅ |
| 29 | `ui/pages/CharacterManagement.tsx` | 235 | 角色背景 `characterBackground` | 拼入 prompt | 跨平台最小 1024（混元） | 2000 | **1500** | ⚠️ 超图像 prompt 上限 |
| 30 | `ui/pages/CharacterManagement.tsx` | 285 | 克隆提示文本 `promptText` | MiniMax 声音克隆 | 官方未明确，保守 500 | 无 | **500** | ⚠️ |
| 31 | `ui/pages/CharacterManagement.tsx` | 313 | 音色设计描述 `voiceDesignPrompt` | MiniMax 声音设计 `prompt` | 官方未明确，保守 500 | 无 | **500** | ⚠️ |
| 32 | `ui/pages/CharacterManagement.tsx` | 318 | 音色设计试听文本 `voiceDesignPreviewText` | MiniMax TTS `text` | **500 字符** | 无 | **500** | ⚠️ |
| 33 | `ui/pages/CharacterManagement.tsx` | 360 | 角色 图片 URL `imageUrl` | URL 输入 | 2048 | 无 | **2048** | ⚠️ |

### 3.8 背景管理（BackgroundManagement）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 34 | `ui/pages/BackgroundManagement.tsx` | 146 | 背景名称 `name` | 本地 + 拼入 prompt | 本地 | 100 | 100 | ✅ |
| 35 | `ui/pages/BackgroundManagement.tsx` | 157 | 环境描述提示词 `envPrompt` | 拼入图像生成 prompt | 1500 | 1000 | 1000 | ✅ |
| 36 | `ui/pages/BackgroundManagement.tsx` | 201 | 图片 URL `imageUrl` | URL 输入 | 2048 | 无 | **2048** | ⚠️ |

### 3.9 故事工作台（StoryWorkbench / StoryListPanel / BreakdownPreview / SegmentCard）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 37 | `ui/components/StoryListPanel.tsx` | 67 | 新建故事标题 `title` | 本地 | 本地 | 无 | **100** | ⚠️ |
| 38 | `ui/components/StoryListPanel.tsx` | 70 | 新建故事内容 `originalText` | MiniMax 故事分镜 `text`（user message） | 按 token，保守 10000 | 无 | **10000** | ⚠️ |
| 39 | `ui/components/StoryListPanel.tsx` | 114 | 编辑故事标题 `editTitle` | 本地 | 本地 | 无 | **100** | ⚠️ |
| 40 | `ui/components/StoryListPanel.tsx` | 117 | 编辑故事内容 `editOriginalText` | MiniMax 故事分镜 `text` | 按 token，保守 10000 | 无 | **10000** | ⚠️ |
| 41 | `ui/components/BreakdownPreview.tsx` | 101 | 草稿角色名称 `c.name` | 本地 + 拼入 prompt | 本地 | 无 | **50** | ⚠️ |
| 42 | `ui/components/BreakdownPreview.tsx` | 116 | 草稿角色外观 `c.appearancePrompt` | 拼入图像 prompt | 跨平台最小 1024（混元） | 无 | **1000** | ⚠️ |
| 43 | `ui/components/BreakdownPreview.tsx` | 125 | 草稿角色性格 `c.personalityPrompt` | 拼入 prompt | 跨平台最小 1024（混元） | 无 | **1000** | ⚠️ |
| 44 | `ui/components/BreakdownPreview.tsx` | 179 | 草稿背景名称 `bg.name` | 本地 + 拼入 prompt | 本地 | 无 | **50** | ⚠️ |
| 45 | `ui/components/BreakdownPreview.tsx` | 194 | 草稿背景环境 `bg.environmentPrompt` | 拼入图像 prompt | 跨平台最小 1024（混元） | 无 | **1000** | ⚠️ |
| 46 | `ui/components/SegmentCard.tsx` | 163 | 运镜与动作提示词 `segment.actionContent` | 拼入视频生成 prompt | 跨平台最小 200（混元） | 无 | **500** | ⚠️ |
| 47 | `ui/components/SegmentCard.tsx` | 176 | 视频参考图 URL `segment.firstFrameImage` | URL 输入 | 2048 | 无 | **2048** | ⚠️ |

### 3.10 BGM 配置（BGMPanel）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 48 | `ui/components/BGMPanel.tsx` | 96 | BGM 描述 `bgmPrompt` | MiniMax 音乐 `prompt`（music-2.6） | **2000 字符** | 无 | **2000** | ⚠️ |
| 49 | `ui/components/BGMPanel.tsx` | 111 | BGM 歌词 `bgmLyrics` | MiniMax 音乐 `lyrics`（music-2.6） | **3500 字符** | 无 | **3500** | ⚠️ |
| 50 | `ui/components/BGMPanel.tsx` | 119 | 翻唱音频 URL | URL 输入 | 2048 | 无 | **2048** | ⚠️ |

### 3.11 后期制作（PostProductionPanel / InspectorPanel）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 51 | `ui/components/PostProductionPanel.tsx` | 268 | 字幕文本 `subtitleText` | Whisper/字幕接口 | 保守 5000 | 无 | **5000** | ⚠️ |
| 52 | `ui/components/PostProductionPanel.tsx` | 307 | 摄影提示词 `cinematographyPrompt` | MiniMax 文本对话 | 保守 1000 | 无 | **1000** | ⚠️ |
| 53 | `ui/pages/editor/InspectorPanel.tsx` | 137 | 字幕片段文本 `clip.text` | 本地（单条字幕） | 本地 | 无 | **200** | ⚠️ |

### 3.12 故事空间管理（StorySpaceManagement）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 54 | `ui/pages/StorySpaceManagement.tsx` | 128 | 空间名称 `newName` | 本地 | 本地 | 无 | **50** | ⚠️ |
| 55 | `ui/pages/StorySpaceManagement.tsx` | 132 | 空间描述 `newDesc` | 本地 | 本地 | 无 | **500** | ⚠️ |
| 56 | `ui/pages/StorySpaceManagement.tsx` | 147 | 编辑空间名称 `editName` | 本地 | 本地 | 无 | **50** | ⚠️ |
| 57 | `ui/pages/StorySpaceManagement.tsx` | 151 | 编辑空间描述 `editDesc` | 本地 | 本地 | 无 | **500** | ⚠️ |

### 3.13 素材库（AssetPicker）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 58 | `ui/components/AssetPicker.tsx` | 92 | 素材搜索关键词 `keyword` | 本地搜索 | 本地 | 无 | **50** | ⚠️ |
| 59 | `ui/components/AssetPicker.tsx` | 301 | 素材名称 `name` | 本地存储 | 本地 | 无 | **100** | ⚠️ |
| 60 | `ui/components/AssetPicker.tsx` | 310 | 素材标签 `tags` | 本地存储 | 本地 | 无 | **200** | ⚠️ |

### 3.14 上传字段（AudioUploadField / ImageUploadField）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 61 | `ui/components/AudioUploadField.tsx` | 123 | 音频 URL `urlInput` | URL 输入 | 2048 | 无 | **2048** | ⚠️ |
| 62 | `ui/components/ImageUploadField.tsx` | 84 | 图片 URL `urlInput` | URL 输入 | 2048 | 无 | **2048** | ⚠️ |

### 3.15 日志查看器（LogFilterBar）

| # | 文件 | 行号 | 用途 | 调用接口 | 接口限制 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 63 | `ui/components/LogViewer/LogFilterBar.tsx` | 28 | 日志搜索关键词 `filter.keyword` | 本地搜索 | 本地 | 无 | **100** | ⚠️ |

### 3.16 设置页（Settings，经 FormField 渲染）

> 设置页字段为本地配置存储，不直接调用外部接口。API Key 类字段按各平台 Key 长度保守取值；Base URL 类按 URL 长度取值。

| # | 文件 | 行号 | 用途 | 类型 | 当前值 | 建议值 | 状态 |
|---|---|---|---|---|---|---|---|
| 64 | `ui/pages/Settings.tsx` | 523 | MiniMax API Key | password | 无 | **200** | ⚠️ |
| 65 | `ui/pages/Settings.tsx` | 532 | MiniMax Base URL | text | 无 | **500** | ⚠️ |
| 66 | `ui/pages/Settings.tsx` | 538 | MiniMax Anthropic Base URL | text | 无 | **500** | ⚠️ |
| 67 | `ui/pages/Settings.tsx` | 564 | 火山 Ark API Key | password | 无 | **200** | ⚠️ |
| 68 | `ui/pages/Settings.tsx` | 573 | 火山 Ark Base URL | text | 无 | **500** | ⚠️ |
| 69 | `ui/pages/Settings.tsx` | 598 | Coze PAT Token | password | 无 | **200** | ⚠️ |
| 70 | `ui/pages/Settings.tsx` | 607 | Coze Base URL | text | 无 | **500** | ⚠️ |
| 71 | `ui/pages/Settings.tsx` | 613 | Coze Space ID | text | 无 | **100** | ⚠️ |
| 72 | `ui/pages/Settings.tsx` | 638 | 可灵 AccessKey | password | 无 | **200** | ⚠️ |
| 73 | `ui/pages/Settings.tsx` | 647 | 可灵 SecretKey | password | 无 | **200** | ⚠️ |
| 74 | `ui/pages/Settings.tsx` | 656 | 可灵 Base URL | text | 无 | **500** | ⚠️ |
| 75 | `ui/pages/Settings.tsx` | 681 | 万相 API-Key | password | 无 | **200** | ⚠️ |
| 76 | `ui/pages/Settings.tsx` | 690 | 万相 Base URL | text | 无 | **500** | ⚠️ |
| 77 | `ui/pages/Settings.tsx` | 715 | 混元 SecretId | password | 无 | **200** | ⚠️ |
| 78 | `ui/pages/Settings.tsx` | 724 | 混元 SecretKey | password | 无 | **200** | ⚠️ |
| 79 | `ui/pages/Settings.tsx` | 733 | 混元 Base URL | text | 无 | **500** | ⚠️ |
| 80 | `ui/pages/Settings.tsx` | 758 | 智谱 API-Key | password | 无 | **200** | ⚠️ |
| 81 | `ui/pages/Settings.tsx` | 767 | 智谱 Base URL | text | 无 | **500** | ⚠️ |
| 82 | `ui/pages/Settings.tsx` | 792 | Vidu API-Key | password | 无 | **200** | ⚠️ |
| 83 | `ui/pages/Settings.tsx` | 801 | Vidu Base URL | text | 无 | **500** | ⚠️ |
| 84 | `ui/pages/Settings.tsx` | 1145 | 服务端保存目录 | text | 无 | **500** | ⚠️ |
| 85 | `ui/pages/Settings.tsx` | 1155 | API 路由前缀 | text | 无 | **200** | ⚠️ |
| 86 | `ui/pages/Settings.tsx` | 1166 | 静态访问前缀 | text | 无 | **200** | ⚠️ |

---

## 四、汇总统计

### 4.1 改动项统计

| 类别 | 总数 | 已符合 ✅ | 需补充/调整 ⚠️ |
|---|---|---|---|
| 图像生成类 | 2 | 2 | 0 |
| 视频生成类 | 5 | 0 | 5 |
| 语音合成类 | 8 | 4 | 4 |
| 音乐生成类 | 7 | 1 | 6 |
| 文本对话类 | 2 | 0 | 2 |
| Agent 对话类 | 1 | 1 | 0 |
| 角色管理 | 8 | 4 | 4 |
| 背景管理 | 3 | 2 | 1 |
| 故事工作台 | 11 | 0 | 11 |
| BGM 配置 | 3 | 0 | 3 |
| 后期制作 | 3 | 0 | 3 |
| 故事空间管理 | 4 | 0 | 4 |
| 素材库 | 3 | 0 | 3 |
| 上传字段 | 2 | 0 | 2 |
| 日志查看器 | 1 | 0 | 1 |
| 设置页 | 23 | 0 | 23 |
| **合计** | **86** | **14** | **72** |

### 4.2 需在适配器层补充截断兜底的接口（核对官方文档后）

| 适配器文件 | 字段 | 建议截断值 | 官方限制来源 |
|---|---|---|---|
| `adapters/outbound/api/hunyuan/HunyuanVideoAdapter.ts` | `Prompt` | **200** | 腾讯混元视频官方"最多支持200个utf-8字符" |
| `adapters/outbound/api/hunyuan/HunyuanImageAdapter.ts` | `Prompt` / `NegativePrompt` | **1024** | 腾讯混元生图官方"最多可传1024个utf-8字符" |
| `adapters/outbound/api/zhipu/ZhipuVideoAdapter.ts` | `prompt` | **800** | 智谱 CogVideoX 226 token 限制（约 800 中文字符） |
| `adapters/outbound/api/MiniMaxVideoAdapter.ts` | `prompt` | **2000** | MiniMax 视频生成"最大支持2000字符" |
| `adapters/outbound/api/MiniMaxVoiceAdapter.ts` | `text`（同步 TTS） | **500** | MiniMax T2A 同步"长度限制<500字符" |
| `adapters/outbound/api/MiniMaxVoiceAdapter.ts` | `text`（异步 TTS） | **10000** | MiniMax 异步长文本上限 |
| `adapters/outbound/api/MiniMaxMusicAdapter.ts` | `prompt` | **2000**（music-2.6）/ **300**（music-cover） | MiniMax 音乐 API |
| `adapters/outbound/api/MiniMaxMusicAdapter.ts` | `lyrics` | **3500**（music-2.6）/ **1000**（music-cover） | MiniMax 音乐 API |
| `adapters/outbound/api/volcengine/VolcengineVoiceAdapter.ts` | `input`（异步） | **100000** | 火山异步长文本"10万字符" |
| `adapters/outbound/api/kling/KlingVideoAdapter.ts` | `prompt` / `negative_prompt` | **2500** | 可灵官方"不超过2500个字符" |
| `adapters/outbound/api/vidu/ViduVideoAdapter.ts` | `prompt` | **1500** | Vidu 官方"字符长度不能超过1500个字符" |
| `adapters/outbound/api/wan/WanVideoAdapter.ts` | `prompt` / `negative_prompt` | **5000** / **500** | 万相 2.7 官方限制 |

> 注：图像生成类适配器中，除 `MiniMaxImageAdapter`（已实现 1500 截断）外，建议其他平台图像适配器（`HunyuanImageAdapter` 1024、`ZhipuImageAdapter`、`WanImageAdapter`、`VolcengineImageAdapter`、`KlingImageAdapter`、`ViduImageAdapter`）也补充对应 `prompt.slice(0, N)` 兜底。
>
> **特别提醒**：`HunyuanVideoAdapter` 的 200 字符硬限非常严格，是所有视频平台中最小的，必须在适配器层强制截断，否则用户输入超过 200 字符直接请求会被腾讯云拒绝。

---

## 五、实施建议

### 5.1 实施优先级

1. **P0（高优先级，直接影响接口调用成功率）**：
   - 视频生成类 #3-#6（当前 2000 超过 Vidu/MiniMax 的 1500 上限，会导致请求失败）
   - VoiceLab #13-#14（试听文本/长文本未用 maxLength，依赖截断或软限制）
   - 角色背景 #29（2000 超过图像 prompt 1500 上限）

2. **P1（中优先级，提升体验与数据一致性）**：
   - 语音/音乐/文本/故事类所有"无"→补充 maxLength 的项
   - 适配器层截断兜底（第 4.2 节）

3. **P2（低优先级，本地输入规范化）**：
   - 设置页、素材库、日志搜索、空间管理等纯本地输入

### 5.2 实施方式建议

为保持交互一致性与代码简洁，建议：

1. **统一迁移到封装组件**：将原生 `<input type="text">` 迁移到 `InputWithCounter`，将原生 `<textarea>` 迁移到 `TextAreaWithCounter`。这两个组件已内置 `maxLength` 与字符计数器，仅需传入 `maxLength` 属性即可。

2. **FormField 增强**：`ui/components/settings/FormField.tsx` 当前未透传 `maxLength`。建议在 `FormField` 中增加 `maxLength` 属性透传，并在内部根据 `type` 渲染对应计数器，使设置页 23 个字段可统一配置。

3. **删除 onChange 中的 substring 截断**：如 `VoiceLab.tsx:702` 的 `e.target.value.substring(0, 500)`，改用 `maxLength={500}` 由浏览器原生阻止输入，逻辑更简洁。

4. **常量集中管理**：建议在 `src/domain/entities/models.ts` 或新建 `src/domain/constants/textLimits.ts` 中集中定义各接口字数限制常量（如 `IMAGE_PROMPT_MAX = 1500`、`VIDEO_PROMPT_MAX = 1500`、`TTS_TEXT_MAX = 500`、`HUNYUAN_VIDEO_PROMPT_MAX = 200` 等），UI 层与适配器层共同引用，避免魔数散落。详见第六节附录。

### 5.3 验证方式

1. **类型检查**：`npm run typecheck` 通过。
2. **单元测试**：补充对 `FormField` 透传 `maxLength` 的测试；对适配器截断逻辑补充测试。
3. **手工验证**：在每个 Lab 页面粘贴超长文本，确认被 `maxLength` 阻止且计数器变红；调用接口确认不再返回 4xx 长度错误。
4. **回归**：现有 17 处已设置 `maxLength` 的输入框行为不变。

---

## 六、附录：常量建议定义

> 以下常量值已根据第二节"官方文档核对结果"同步修订。UI 层取跨平台最小兼容值；各平台适配器层另有更严格的硬限（详见 4.2 节）。

```ts
// src/domain/constants/textLimits.ts （建议新建）
export const TEXT_LIMITS = {
  // 图像/视频生成 prompt（UI 层跨平台取最小兼容值）
  IMAGE_PROMPT_MAX: 1500,            // MiniMax 1500 / 万相 5000 / 混元 1024
  VIDEO_PROMPT_MAX: 1500,            // Vidu 1500 / 万相旧版 800 / MiniMax 2000 / 可灵 2500

  // TTS（核对官方文档后修订）
  TTS_TEXT_MAX: 500,                 // MiniMax 同步 TTS 官方"<500字符"（非旧值 5000）
  TTS_ASYNC_TEXT_MAX: 10000,         // MiniMax 异步长文本上限（非旧值 50000；火山异步 10 万字符远大于此）
  VOICE_CLONE_PROMPT_MAX: 500,
  VOICE_DESIGN_PROMPT_MAX: 500,
  VOICE_DESIGN_PREVIEW_MAX: 500,
  VOICE_NAME_MAX: 100,

  // 音乐（核对 MiniMax 音乐 API 后修订）
  MUSIC_PROMPT_MAX: 2000,            // music-2.6 模式（非旧值 1000）
  MUSIC_LYRICS_MAX: 3500,            // music-2.6 模式（非旧值 2000）
  MUSIC_LYRICS_INPUT_MAX: 3500,      // 需修改歌词输入（非旧值 5000）
  MUSIC_COVER_PROMPT_MAX: 300,       // music-cover 翻唱模式硬限 [10, 300]
  MUSIC_COVER_LYRICS_MAX: 1000,      // music-cover 翻唱模式硬限 [10, 1000]
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
  CHAR_BACKGROUND_MAX: 1500,
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
  BGM_PROMPT_MAX: 2000,              // 非旧值 1000
  BGM_LYRICS_MAX: 3500,              // 非旧值 2000

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
 * 各平台适配器层硬限（用于 slice 截断兜底，与 UI 层常量分离）
 * 详见第 4.2 节"需在适配器层补充截断兜底的接口"
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

  // 图像生成
  HUNYUAN_IMAGE_PROMPT_MAX: 1024,    // 腾讯混元生图"最多可传1024个utf-8字符"
  MINIMAX_IMAGE_PROMPT_MAX: 1500,    // MiniMax 图像（已在代码中实现）

  // TTS
  MINIMAX_TTS_SYNC_MAX: 500,         // MiniMax T2A 同步"<500字符"
  MINIMAX_TTS_ASYNC_MAX: 10000,      // MiniMax 异步长文本
  VOLC_TTS_SYNC_MAX_BYTES: 1024,     // 火山旧 TTS 同步 1024 字节 UTF-8（约 340 中文字）
  VOLC_TTS_ASYNC_MAX: 100000,        // 火山异步长文本 10 万字符

  // 音乐
  MINIMAX_MUSIC_PROMPT_MAX: 2000,    // music-2.6
  MINIMAX_MUSIC_COVER_PROMPT_MAX: 300, // music-cover
  MINIMAX_MUSIC_LYRICS_MAX: 3500,    // music-2.6
  MINIMAX_MUSIC_COVER_LYRICS_MAX: 1000, // music-cover
} as const;
```

---

## 七、参考来源（已核对官方文档）

### 7.1 MiniMax 平台
- MiniMax 图像生成 prompt 1500 限制：`src/adapters/outbound/api/MiniMaxImageAdapter.ts:34` 代码常量
- MiniMax T2A 同步语音合成 **500 字符**限制：[T2A 文档](https://platform.minimaxi.com/document/T2A?key=667bde023be2027f69b71d5a)（官方原文"长度限制<500字符"）
- MiniMax T2A 异步长文本 10000 字符：[异步 TTS 接口文档](https://platform.minimaxi.com/document/T2A?key=667bde023be2027f69b71d5a)
- MiniMax 视频生成 **2000 字符**限制：[视频生成文档](https://platform.minimaxi.com/document/video_generation?key=66d1439376e52fcee2853049)（官方原文"最大支持2000字符"）
- MiniMax 音乐生成 prompt/lyrics 限制：[音乐生成 API 参考](https://platform.minimaxi.com/docs/api-reference/music-generation)

### 7.2 火山引擎豆包
- 火山引擎豆包 TTS 同步 1024 字节限制：[参数说明文档](https://www.volcengine.com/docs/6561/79823)
- 火山引擎豆包 TTS 异步长文本 10 万字符：[异步长文本文档](https://www.volcengine.com/docs/6561/1829010)
- 火山引擎豆包视频生成（Seedance）建议值：[视频生成文档](https://www.volcengine.com/docs/82379/1520757)（"中文提示词不超过500字，英文提示词不超过1000词"）
- 火山引擎即梦视频建议值：[即梦视频 API](https://www.aiping.cn/docs/API/VideoAPI/VOLCENGINE_VIDEO_API_DOC)（"建议≤400字、不超过800字"）

### 7.3 腾讯混元 Hunyuan
- 混元图像生成 1024 utf-8 字符限制：[混元生图文档](https://cloud.tencent.com/document/api/1668/120721)（"最多可传1024个utf-8字符"）
- 混元视频生成 **200 utf-8 字符**限制：[混元生视频文档](https://cloud.tencent.com/developer/article/2696379)（"最多支持200个utf-8字符"，**所有视频平台中最严格**）

### 7.4 可灵 Kling
- 可灵视频 prompt / negative_prompt 2500 字符：[可灵 API 文档](https://www.aiping.cn/docs/API/VideoAPI/KLING_VIDEO_API_DOC)
- 可灵多镜头分镜 prompt 512 字符：同上

### 7.5 万相 Wan
- 万相 2.7 视频/图像生成 prompt 5000 字符：[万相文生视频 API](https://help.aliyun.com/zh/model-studio/text-to-video-api-reference)（"超过部分会自动截断"）
- 万相 2.7 视频生成 negative_prompt 500 字符：同上

### 7.6 智谱 / Vidu
- 智谱 CogVideoX 视频 prompt 226 token（约 800 中文字符）：[CogVideoX 文档](https://doc.damodel.com/profile/best_practice/CogVideoX-6B/CogVideoX-6B.html)
- Vidu 视频 prompt 1500 字符：[Vidu API 文档](https://apifox.chatgptten.com/api-324616980)（"字符长度不能超过1500个字符"）

### 7.7 Coze
- Coze 对话按 token 计（无明确字符硬限）：官方文档
