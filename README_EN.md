[中文](./README.md) | English

# AI Video Studio
Currently only MiniMax is supported, everyone is welcome to help optimize it.
An AI short video creation platform built with React + TypeScript. Input your story text, and AI automatically handles character extraction, scene splitting, image/video/voiceover/BGM generation, and finally composes a complete short video via FFmpeg post-processing.

## Core Features

- **Story Creation** — Input story text, AI automatically splits it into storyboards, extracts characters and scenes
- **Image Generation** — Generate character/scene images via MiniMax Image API
- **Video Generation** — Support T2V / I2V / FL2V / S2V multiple video generation modes
- **Voice Synthesis** — Support voice cloning, voice design, and streaming synthesis
- **Music Generation** — AI-generated background music, lyric creation, and cover songs
- **Text Enhancement** — AI text enhancement and rewriting
- **Post-Processing** — FFmpeg WASM for video concatenation, subtitle burning, and audio mixing
- **One-Click Production** — Pipeline full-process orchestration, from story to finished video automatically
- **AI Assistant** — Agent-based conversational creation assistant
- **Multi-Language** — Support 10 languages: Chinese / English / Japanese / Korean / French / German / Spanish / Russian / Portuguese / Italian

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| Routing | React Router DOM 7 |
| Database | Dexie (IndexedDB ORM) |
| Video Processing | FFmpeg WASM |
| HTTP | Axios |
| i18n | i18next + react-i18next |
| Icons | Lucide React |
| AI Services | MiniMax API (Text / Image / Video / Voice / Music) |

## Architecture

This project adopts a **Hexagonal Architecture (Ports & Adapters)**, fully decoupling business logic from external dependencies:

```
UI Layer (React)                    ← Pages, Components, Hooks, Context
       │
Dependency Injection (dependencies.ts) ← Assembles all dependencies
       │
Domain Services                      ← Core business logic
       │
Domain Ports (Interfaces)            ← Outbound port contracts
       │
Domain Entities                      ← Data model definitions
       │
Adapters (Implementations)           ← MiniMax API / FFmpeg / IndexedDB
```

## Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation & Running

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build

# Preview build result
npm run preview

# Lint
npm run lint
```

### API Configuration

1. After starting, visit `http://localhost:5173`
2. Navigate to the **Settings** page to configure your MiniMax API Key and Group ID

## Project Structure

```
src/
├── adapters/outbound/        # Adapter layer — External system implementations
│   ├── api/                  #   MiniMax / FFmpeg / Whisper API adapters
│   ├── config/               #   API configuration management (ApiConfigStore)
│   └── repositories/         #   IndexedDB repository adapters (Dexie)
├── domain/                   # Domain layer — Core business logic
│   ├── entities/models.ts    #   Data models (Story, Character, VideoTask...)
│   ├── ports/                #   Port interfaces (IVideoGeneratorPort, IVoicePort...)
│   ├── services/             #   Domain services (StoryService, PipelineService...)
│   └── data/                 #   Static data (system voice list)
├── ui/                       # UI presentation layer
│   ├── pages/                #   Page components (12 pages)
│   ├── components/           #   Common components (24 components)
│   ├── hooks/                #   Custom Hooks (9 hooks)
│   ├── contexts/             #   React Context (Space/Toast/Confirm)
│   ├── layouts/              #   Layouts (MainLayout)
│   └── utils/                #   UI utility functions
├── utils/                    #   General utilities (offline cache / retry / monitoring)
├── locales/                  #   i18n translation files (10 languages)
├── App.tsx                   #   App entry & route definitions
├── dependencies.ts           #   Dependency injection container
├── i18n.ts                   #   i18n configuration
└── main.tsx                  #   Render entry
```

## Page Navigation

| Path | Page | Description |
|------|------|-------------|
| `/` | Dashboard | Project overview |
| `/characters` | Character Management | Create/edit characters, bind voices |
| `/backgrounds` | Scene Management | Create/edit scene backgrounds |
| `/workbench` | Story Workbench | Core creation entry point |
| `/export` | Export Center | Finished video download & preview |
| `/labs/image` | Image Lab | AI image generation |
| `/labs/video` | Video Lab | AI video generation |
| `/labs/voice` | Voice Lab | Voice cloning / synthesis |
| `/labs/music` | Music Lab | AI music / lyric generation |
| `/labs/text` | Text Lab | AI text enhancement |
| `/spaces` | Space Management | Creative space switching |
| `/settings` | Settings | API Key configuration |

## Core Business Flow

```
Story Text → AI Storyboard Splitting → Generate Images/Narration/BGM → Generate Video → Post-Processing → Export Finished Video
```

### Video Generation Modes

| Mode | Description |
|------|-------------|
| T2V | Text-to-Video |
| I2V | Image-to-Video |
| FL2V | First-Last Frame to Video |
| S2V | Subject Reference to Video |

## Data Storage

All data is stored in the browser's IndexedDB (via Dexie.js), requiring no backend service. The database is currently at version v8, containing 11 tables with automatic version migration support.

## Development Notes

- The Vite dev server automatically proxies `/anthropic` paths to the MiniMax API, resolving CORS issues
- In production, requests go directly to `https://api.minimaxi.com/anthropic`
- Smart fallback: When AI splitting/decomposition services are unavailable, the system automatically falls back to a local mock implementation

## Detailed Documentation

For complete code documentation, please refer to [CODE_WIKI_EN.md](./CODE_WIKI_EN.md)
