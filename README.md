中文 | [English](./README_EN.md)

# AI Video Studio

目前仅支持MiniMax欢迎所有人参与优化
基于 React + TypeScript 的 AI 短视频创作平台。输入故事文本，AI 自动完成角色提取、场景拆分、图片/视频/配音/BGM 生成，最终通过 FFmpeg 后期合成完整短视频。

## 核心功能

- **故事创作** — 输入故事文本，AI 自动拆分为分镜、提取角色和场景
- **图片生成** — 基于 MiniMax Image API 生成角色/场景图片
- **视频生成** — 支持 T2V / I2V / FL2V / S2V 多种视频生成模式
- **语音合成** — 支持语音克隆、语音设计、流式合成
- **音乐生成** — AI 生成背景音乐、歌词创作、翻唱
- **文本润色** — AI 文本增强与改写
- **后期处理** — FFmpeg WASM 实现视频拼接、字幕烧录、音频混合
- **一键成片** — Pipeline 全流程编排，从故事到成片自动完成
- **AI 助手** — Agent 对话式创作辅助
- **多语言** — 支持中/英/日/韩/法/德/西/俄/葡/意 10 种语言

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript 6 |
| 构建 | Vite 8 |
| 路由 | React Router DOM 7 |
| 数据库 | Dexie (IndexedDB ORM) |
| 视频处理 | FFmpeg WASM |
| HTTP | Axios |
| 国际化 | i18next + react-i18next |
| 图标 | Lucide React |
| AI 服务 | MiniMax API (文本/图片/视频/语音/音乐) |

## 架构

本项目采用**六边形架构 (Ports & Adapters)**，业务逻辑与外部依赖彻底解耦：

```
UI Layer (React)                    ← 页面、组件、Hooks、Context
       │
Dependency Injection (dependencies.ts) ← 组装所有依赖
       │
Domain Services                      ← 核心业务逻辑
       │
Domain Ports (Interfaces)            ← 出站端口契约
       │
Domain Entities                      ← 数据模型定义
       │
Adapters (Implementations)           ← MiniMax API / FFmpeg / IndexedDB
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint
```

### API 配置

1. 启动后访问 `http://localhost:5173`
2. 进入 **设置** 页面配置 MiniMax API Key 和 Group ID

## 项目结构

```
src/
├── adapters/outbound/        # 适配器层 — 外部系统实现
│   ├── api/                  #   MiniMax / FFmpeg / Whisper API 适配器
│   ├── config/               #   API 配置管理 (ApiConfigStore)
│   └── repositories/         #   IndexedDB 仓储适配器 (Dexie)
├── domain/                   # 领域层 — 核心业务逻辑
│   ├── entities/models.ts    #   数据模型 (Story, Character, VideoTask...)
│   ├── ports/                #   端口接口 (IVideoGeneratorPort, IVoicePort...)
│   ├── services/             #   领域服务 (StoryService, PipelineService...)
│   └── data/                 #   静态数据 (系统音色列表)
├── ui/                       # UI 展示层
│   ├── pages/                #   页面组件 (12 个页面)
│   ├── components/           #   通用组件 (24 个组件)
│   ├── hooks/                #   自定义 Hooks (9 个)
│   ├── contexts/             #   React Context (Space/Toast/Confirm)
│   ├── layouts/              #   布局 (MainLayout)
│   └── utils/                #   UI 工具函数
├── utils/                    #   通用工具 (离线缓存/重试/监控)
├── locales/                  #   国际化翻译文件 (10 种语言)
├── App.tsx                   #   应用入口 & 路由定义
├── dependencies.ts           #   依赖注入容器
├── i18n.ts                   #   国际化配置
└── main.tsx                  #   渲染入口
```

## 页面导航

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | 仪表盘 | 项目概览 |
| `/characters` | 角色管理 | 创建/编辑角色、绑定音色 |
| `/backgrounds` | 场景管理 | 创建/编辑场景背景 |
| `/workbench` | 故事工作台 | 核心创作入口 |
| `/export` | 导出中心 | 成片下载与预览 |
| `/labs/image` | 图片实验室 | AI 图片生成 |
| `/labs/video` | 视频实验室 | AI 视频生成 |
| `/labs/voice` | 语音实验室 | 语音克隆/合成 |
| `/labs/music` | 音乐实验室 | AI 音乐/歌词生成 |
| `/labs/text` | 文本实验室 | AI 文本润色 |
| `/spaces` | 空间管理 | 创作空间切换 |
| `/settings` | 设置 | API Key 配置 |

## 核心业务流程

```
故事文本 → AI 拆分分镜 → 生成图片/旁白/BGM → 生成视频 → 后期合成 → 成片导出
```

### 视频生成模式

| 模式 | 说明 |
|------|------|
| T2V | 文本生成视频 |
| I2V | 图片生成视频 |
| FL2V | 首尾帧生成视频 |
| S2V | 主体参考生成视频 |

## 数据存储

所有数据存储在浏览器 IndexedDB 中（基于 Dexie.js），无需后端服务。数据库当前版本 v8，包含 11 张表，支持自动版本迁移。

## 开发说明

- Vite 开发服务器自动代理 `/anthropic` 路径到 MiniMax API，解决 CORS 问题
- 生产环境直接请求 `https://api.minimaxi.com/anthropic`
- 智能降级：AI 拆分/分解服务不可用时自动降级到本地 Mock 实现

## 详细文档

完整代码文档请参阅 [CODE_WIKI.md](./CODE_WIKI.md)
