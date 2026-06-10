# 国际化 (i18n) 设计文档

本设计文档阐述了如何在现有的“纯前端 Local-First 六边形架构”中优雅地集成多语言（中/英文）支持。在不修改现有核心业务逻辑的前提下，通过标准的 i18n 库实现界面的多语言切换。

## 1. 技术选型

- **核心 i18n 库**：`i18next`
- **React 绑定库**：`react-i18next`
- **语言检测与缓存**：`i18next-browser-languagedetector`（用于在 localStorage 中记住用户的语言偏好设置）。

**选型理由**：`react-i18next` 是 React 社区最主流、生态最完整的国际化解决方案。它提供了 `useTranslation` Hook，可以轻松地在任何纯函数组件中替换静态文本；其配合浏览器检测插件能够自动持久化用户的语言选择。

## 2. 架构与目录设计

我们将语言相关的配置和资源文件统一归集到前端应用层（UI Layer）的专门目录中，以保持与其他核心逻辑的分离。

### 2.1 目录结构规划
```text
src/
 ├── locales/
 │    ├── en/
 │    │    └── translation.json  # 英文文案字典
 │    └── zh/
 │         └── translation.json  # 中文文案字典
 ├── i18n.ts                     # i18next 核心配置文件
 ├── ui/
 │    ├── components/
 │    │    └── LanguageSwitcher.tsx # 语言切换器组件
 ...
```

### 2.2 资源字典设计 (JSON 格式)
使用扁平或轻度嵌套的 JSON 对象来管理文案，以模块划分。例如：
```json
// zh/translation.json
{
  "nav": {
    "dashboard": "仪表盘",
    "characters": "角色库",
    "backgrounds": "背景库",
    "workbench": "故事工作台"
  },
  "character": {
    "title": "角色管理",
    "subtitle": "为你的视频分镜定义演员",
    "newBtn": "新建角色"
  }
}
```

## 3. 核心设计机制

### 3.1 i18n 实例初始化 (`i18n.ts`)
在应用的入口点（如 `main.tsx`）引入并初始化 `i18n` 实例：
- 加载 `en` 和 `zh` 两个 namespace 资源。
- 设定 fallback 语言为 `en`。
- 挂载 Browser Language Detector 插件，优先读取 `localStorage` 中的 `i18nextLng` 字段。

### 3.2 语言切换组件设计 (LanguageSwitcher)
- **UI 交互**：在应用的左侧边栏 (Sidebar) 底部或顶部导航栏右侧添加一个切换按钮 (Toggle Button 或 Dropdown)。
- **逻辑实现**：
  点击按钮时触发 `i18n.changeLanguage(newLang)`。`react-i18next` 会自动触发全局 React 组件的重新渲染，从而实现界面文案的即时切换。

### 3.3 React 组件文案替换改造
对于所有的 UI 组件，引入 `useTranslation` Hook：
```tsx
import { useTranslation } from 'react-i18next';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="page-header">
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.welcome')}</p>
    </div>
  );
};
```

## 4. 六边形架构中的 i18n 考量（领域与 UI 解耦）

在当前的六边形架构中，领域服务 (Domain Services) 或适配器 (Adapters) 可能会抛出错误信息（如 `throw new Error('Segment not found')`）。为了保持领域层的纯洁性（不直接依赖 `i18next`）：

1. **统一错误码/错误 Key (Error Keys)**：
   领域层抛出的 `Error` message 应该使用标准化的 **Translation Key**（如 `error.segment_not_found`）而不是具体的英文或中文句子。
2. **UI 层的适配解析**：
   在 UI 捕获错误时（如 `catch (e: any)`），UI 层调用 `t(e.message)` 来将领域层传出的 Key 转化为当前语言的真实提示文本。

## 5. 实施步骤规划 (未来实现指导)

1. **依赖安装**：执行 `npm install i18next react-i18next i18next-browser-languagedetector`。
2. **构建字典库**：创建 `src/locales/en` 和 `src/locales/zh` 字典，并抽离现有项目中的写死字符串。
3. **编写配置**：新建 `src/i18n.ts`，配置检测器和资源，并在 `main.tsx` 顶部引入。
4. **组件改造**：全局替换 `MainLayout.tsx`, `Dashboard.tsx` 等页面的硬编码中文字符串或英文字符串。
5. **添加切换控件**：在 `MainLayout` 的 Sidebar 增加 `LanguageSwitcher` 按钮进行切换测试。
