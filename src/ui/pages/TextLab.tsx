import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare, Send, Bot, User, RefreshCw, Sparkles, BookmarkPlus,
  Film, Users, Image as ImageIcon, Music, Wand2, ChevronDown, ChevronUp,
  Copy, CheckCircle2, ArrowRight, Settings, Database,
} from 'lucide-react';
import { textLabService, modelManagementService, assetLibraryService } from '../../dependencies';
import type { TextModel, TextGenerationMessage, TextGenerationResult, ModelInfo } from '../../domain/ports/OutboundPorts';
import type { TextRefineScene, RefineStyle } from '../../domain/services/TextLabService';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorUtils';
import { useSpace } from '../contexts/SpaceContext';
import { AssetSaveDialog } from '../components/AssetPicker';
import { ThinkingBlock } from '../components/ThinkingBlock';
import { TokenUsageBar } from '../components/TokenUsageBar';
import { LabPageLayout } from '../components/LabPageLayout';

type TextLabTab = 'chat' | 'refine' | 'models';

// ==================== 模型配置 ====================
const MODEL_OPTIONS: { value: TextModel; label: string; desc: string; multimodal: boolean }[] = [
  { value: 'MiniMax-M3', label: 'MiniMax-M3', desc: '多模态+深度思考', multimodal: true },
  { value: 'MiniMax-M2.7', label: 'M2.7', desc: '高质量文本', multimodal: false },
  { value: 'MiniMax-M2.7-highspeed', label: 'M2.7-fast', desc: '快速文本', multimodal: false },
  { value: 'MiniMax-M2.5', label: 'M2.5', desc: '性价比文本', multimodal: false },
  { value: 'MiniMax-M2.5-highspeed', label: 'M2.5-fast', desc: '快速文本', multimodal: false },
  { value: 'MiniMax-M2.1', label: 'M2.1', desc: '基础文本', multimodal: false },
  { value: 'MiniMax-M2.1-highspeed', label: 'M2.1-fast', desc: '快速基础', multimodal: false },
  { value: 'MiniMax-M2', label: 'M2', desc: '入门级', multimodal: false },
];

// ==================== 场景模板 ====================
const SCENE_TEMPLATES: { key: TextRefineScene; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'script', label: '剧本润色', icon: <Film size={16} />, color: '#8b5cf6' },
  { key: 'storyboard', label: '分镜描述', icon: <ImageIcon size={16} />, color: '#3b82f6' },
  { key: 'character', label: '角色刻画', icon: <Users size={16} />, color: '#ec4899' },
  { key: 'scene', label: '场景描写', icon: <ImageIcon size={16} />, color: '#10b981' },
  { key: 'bgm_style', label: 'BGM 风格', icon: <Music size={16} />, color: '#f59e0b' },
  { key: 'prompt_optimize', label: '提示词优化', icon: <Wand2 size={16} />, color: '#6366f1' },
];

// ==================== 聊天消息类型 ====================
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  usage?: TextGenerationResult['usage'];
  isStreaming?: boolean;
}

export const TextLab: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { currentSpaceId } = useSpace();

  const [activeTab, setActiveTab] = useState<TextLabTab>('chat');

  // ==================== Chat Tab State ====================
  const [chatModel, setChatModel] = useState<TextModel>('MiniMax-M3');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '您好！我是文本助理。我可以帮您润色提示词、头脑风暴视频剧本、或回答任何问题。请问今天需要什么帮助？' },
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.95);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [enableThinking, setEnableThinking] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveContent, setSaveContent] = useState('');

  // ==================== Refine Tab State ====================
  const [refineScene, setRefineScene] = useState<TextRefineScene>('script');
  const [refineInput, setRefineInput] = useState('');
  const [refineStyle, setRefineStyle] = useState<RefineStyle>('standard');
  const [refineModel, setRefineModel] = useState<TextModel>('MiniMax-M3');
  const [isRefining, setIsRefining] = useState(false);
  const [refineResult, setRefineResult] = useState<{ content: string; thinking?: string; usage?: TextGenerationResult['usage'] } | null>(null);
  const [refineStreamingContent, setRefineStreamingContent] = useState('');
  const [refineStreamingThinking, setRefineStreamingThinking] = useState('');
  const refineAbortRef = useRef<AbortController | null>(null);
  const [copied, setCopied] = useState(false);

  // ==================== Models Tab State ====================
  const [modelList, setModelList] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // ==================== Auto-scroll ====================
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ==================== Chat Handlers ====================
  const handleSend = useCallback(() => {
    if (!input.trim() || isGenerating) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);

    // Add streaming placeholder
    const assistantIdx = newMessages.length;
    setMessages([...newMessages, { role: 'assistant', content: '', isStreaming: true }]);

    const apiMessages: TextGenerationMessage[] = newMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    let fullContent = '';
    let fullThinking = '';
    // eslint-disable-next-line prefer-const
    let usageData: TextGenerationResult['usage'] = undefined;

    const controller = textLabService.chatStream(apiMessages, {
      onTextDelta: (text) => {
        fullContent += text;
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIdx] = { role: 'assistant', content: fullContent, thinking: fullThinking || undefined, isStreaming: true, usage: usageData };
          return updated;
        });
      },
      onThinkingDelta: (thinking) => {
        fullThinking += thinking;
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIdx] = { role: 'assistant', content: fullContent, thinking: fullThinking || undefined, isStreaming: true, usage: usageData };
          return updated;
        });
      },
      onComplete: (result) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIdx] = { role: 'assistant', content: result.content || fullContent, thinking: result.thinking || fullThinking || undefined, isStreaming: false, usage: result.usage || usageData };
          return updated;
        });
        setIsGenerating(false);
      },
      onError: (error) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIdx] = { role: 'assistant', content: `*请求失败: ${error.message}*`, isStreaming: false };
          return updated;
        });
        setIsGenerating(false);
      },
    }, {
      model: chatModel,
      temperature,
      topP,
      maxTokens,
      thinking: enableThinking,
    });

    abortRef.current = controller;
  }, [input, isGenerating, messages, chatModel, temperature, topP, maxTokens, enableThinking]);

  const handleStopGenerating = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      { role: 'assistant', content: '您好！我是文本助理。我可以帮您润色提示词、头脑风暴视频剧本、或回答任何问题。请问今天需要什么帮助？' },
    ]);
  };

  // ==================== Refine Handlers ====================
  const handleRefine = useCallback(() => {
    if (!refineInput.trim() || isRefining) return;
    setIsRefining(true);
    setRefineResult(null);
    setRefineStreamingContent('');
    setRefineStreamingThinking('');

    let fullContent = '';
    let fullThinking = '';
    // eslint-disable-next-line prefer-const
    let usageData: TextGenerationResult['usage'] = undefined;

    const controller = textLabService.refineBySceneStream(
      refineScene,
      refineInput,
      refineStyle,
      {
        onTextDelta: (text) => {
          fullContent += text;
          setRefineStreamingContent(fullContent);
        },
        onThinkingDelta: (thinking) => {
          fullThinking += thinking;
          setRefineStreamingThinking(fullThinking);
        },
        onComplete: (result) => {
          setRefineResult({
            content: result.content || fullContent,
            thinking: result.thinking || fullThinking || undefined,
            usage: result.usage || usageData,
          });
          setRefineStreamingContent('');
          setRefineStreamingThinking('');
          setIsRefining(false);
        },
        onError: (error) => {
          showToast('error', getErrorMessage(error, t('textLab.refineFailed', '润色失败')));
          setIsRefining(false);
        },
      },
      refineModel,
    );

    refineAbortRef.current = controller;
  }, [refineInput, refineScene, refineStyle, refineModel, isRefining, showToast, t]);

  const handleCopyResult = useCallback(() => {
    const text = refineResult?.content || refineStreamingContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [refineResult, refineStreamingContent]);

  // ==================== Models Handlers ====================
  const loadModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const result = await modelManagementService.getModels();
      setModelList(result);
    } catch (e) {
      showToast('error', getErrorMessage(e, t('textLab.modelLoadFailed', '获取模型列表失败')));
    } finally {
      setIsLoadingModels(false);
    }
  }, [showToast, t]);

  // ==================== Save to Library ====================
  const handleCollectPrompt = (content: string) => {
    setSaveContent(content);
    setShowSaveDialog(true);
  };

  const handleSavePrompt = async (name: string, tags: string) => {
    if (!currentSpaceId || !saveContent) return;
    try {
      await assetLibraryService.savePrompt({
        spaceId: currentSpaceId,
        name,
        content: saveContent,
        category: 'other',
        tags: tags ? tags.split(',').map(tg => tg.trim()).filter(Boolean) : [],
        sourceType: 'lab',
      });
      showToast('success', t('assetLibrary.collectSuccess', '提示词收藏成功'));
      setShowSaveDialog(false);
    } catch (e) {
      showToast('error', getErrorMessage(e, t('assetLibrary.saveFailed', '素材保存失败')));
    }
  };

  // ==================== Tab 配置 ====================
  const tabs: { key: TextLabTab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'chat', label: t('textLab.tabChat', '智能对话'), icon: <MessageSquare size={16} />, color: '#34d399' },
    { key: 'refine', label: t('textLab.tabRefine', '场景润色'), icon: <Sparkles size={16} />, color: '#8b5cf6' },
    { key: 'models', label: t('textLab.tabModels', '模型管理'), icon: <Settings size={16} />, color: '#06b6d4' },
  ];

  // 当前展示的润色结果（流式或最终）
  const displayRefineContent = refineStreamingContent || refineResult?.content || '';
  const displayRefineThinking = refineStreamingThinking || refineResult?.thinking || '';
  const displayRefineUsage = refineResult?.usage;

  return (
    <LabPageLayout
      icon={<MessageSquare size={32} />}
      iconBg="rgba(52,211,153,0.1)"
      iconColor="#34d399"
      title={t('textLab.title', '文本实验室 (Text Lab)')}
      subtitle={t('textLab.desc', 'AI 文本润色、剧本创作、提示词优化，支持多模型与思维链')}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(key) => setActiveTab(key as TextLabTab)}
    >
      {/* ==================== Chat Tab ==================== */}
      {activeTab === 'chat' && (
        <div className="chat-layout">
          {/* Top bar */}
          <div className="chat-top-bar">
            <select className="form-select" style={{ width: 'auto' }} value={chatModel} onChange={e => setChatModel(e.target.value as TextModel)}>
              {MODEL_OPTIONS.map(m => (
                <option key={m.value} value={m.value}>{m.label} — {m.desc}</option>
              ))}
            </select>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {t('textLab.advanced', '高级参数')}
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={clearChat}>
              <RefreshCw size={14} /> {t('textLab.clearChat', '清空对话')}
            </button>
          </div>

          {/* Advanced settings */}
          {showAdvanced && (
            <div className="chat-advanced">
              <div className="chat-advanced-item">
                <label className="form-label">{t('textLab.temperature', '温度')} ({temperature})</label>
                <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#34d399' }} />
              </div>
              <div className="chat-advanced-item">
                <label className="form-label">{t('textLab.topP', 'Top P')} ({topP})</label>
                <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#34d399' }} />
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label className="form-label">{t('textLab.maxTokens', 'Max Tokens')}</label>
                <select className="form-select" value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))}>
                  <option value={2048}>2048</option>
                  <option value={4096}>4096</option>
                  <option value={8192}>8192</option>
                  <option value={16384}>16384</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={enableThinking} onChange={e => setEnableThinking(e.target.checked)} style={{ width: '14px', height: '14px', accentColor: '#8b5cf6' }} />
                  {t('textLab.enableThinking', '开启 Thinking (M3)')}
                </label>
              </div>
            </div>
          )}

          {/* Chat area */}
          <div className="glass-panel chat-panel">
            <div className="chat-messages">
              {messages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role === 'user' ? 'chat-message-user' : ''}`}>
                  <div className={`chat-avatar ${msg.role === 'user' ? 'chat-avatar-user' : 'chat-avatar-assistant'}`}>
                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                    {msg.isStreaming && !msg.content ? (
                      <span style={{ color: 'var(--text-muted)' }}>
                        <Sparkles size={14} className="spin" /> {t('textLab.thinking', '正在思考中...')}
                      </span>
                    ) : (
                      <>
                        {msg.content}
                        {msg.isStreaming && <span className="blink-cursor" style={{ borderRight: '2px solid var(--primary-color)', marginLeft: '2px' }}>&nbsp;</span>}
                      </>
                    )}
                    {/* Thinking block */}
                    {msg.role === 'assistant' && msg.thinking && !msg.isStreaming && (
                      <ThinkingBlock thinking={msg.thinking} />
                    )}
                    {/* Token usage */}
                    {msg.role === 'assistant' && msg.usage && !msg.isStreaming && (
                      <TokenUsageBar usage={msg.usage} style={{ marginTop: '0.5rem' }} />
                    )}
                    {/* Actions */}
                    {msg.role === 'assistant' && idx > 0 && !msg.isStreaming && (
                      <div className="chat-action-btn">
                        <button
                          onClick={() => handleCollectPrompt(msg.content)}
                          title={t('assetLibrary.collectBtn', '收藏')}
                        >
                          <BookmarkPlus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-area">
              <div className="chat-input-row">
                <textarea
                  className="form-input"
                  style={{ flex: 1, resize: 'none', padding: '0.8rem', fontSize: '1rem' }}
                  rows={2}
                  placeholder={t('textLab.inputPlaceholder', '输入您的提示词、文案或任何问题... (Shift+Enter 换行)')}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '0 1.5rem', height: 'auto', background: isGenerating ? '#ef4444' : '#34d399', border: 'none', color: '#000' }}
                  disabled={!input.trim() && !isGenerating}
                  onClick={isGenerating ? handleStopGenerating : handleSend}
                >
                  {isGenerating ? <RefreshCw size={20} /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Refine Tab ==================== */}
      {activeTab === 'refine' && (
        <div className="glass-panel slide-up" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 场景选择 */}
          <div>
            <label className="form-label">{t('textLab.selectScene', '选择润色场景')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
              {SCENE_TEMPLATES.map(s => (
                <button
                  key={s.key}
                  className={`btn ${refineScene === s.key ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', background: refineScene === s.key ? s.color : undefined, justifyContent: 'center' }}
                  onClick={() => { setRefineScene(s.key); setRefineResult(null); }}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 输入 */}
          <div>
            <label className="form-label">{t('textLab.refineInput', '输入原始文本')}</label>
            <textarea
              className="form-input"
              rows={6}
              placeholder={t('textLab.refineInputPlaceholder', '粘贴或输入需要润色的文本...')}
              value={refineInput}
              onChange={e => setRefineInput(e.target.value)}
              style={{ fontSize: '0.95rem', padding: '1rem' }}
            />
          </div>

          {/* 风格 + 模型 */}
          <div className="form-section">
            <div>
              <label className="form-label">{t('textLab.refineStyle', '润色风格')}</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['concise', 'standard', 'detailed'] as RefineStyle[]).map(s => (
                  <button
                    key={s}
                    className={`btn ${refineStyle === s ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem' }}
                    onClick={() => setRefineStyle(s)}
                  >
                    {s === 'concise' ? '简洁' : s === 'standard' ? '标准' : '详细'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-section-item">
              <label className="form-label">{t('textLab.refineModel', '润色模型')}</label>
              <select className="form-select" value={refineModel} onChange={e => setRefineModel(e.target.value as TextModel)}>
                {MODEL_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>{m.label} — {m.desc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 润色按钮 */}
          <button
            className="btn btn-primary btn-generate"
            style={{ background: '#8b5cf6' }}
            disabled={!refineInput.trim() || isRefining}
            onClick={handleRefine}
          >
            {isRefining ? <RefreshCw className="spin" size={20} /> : <Sparkles size={20} />}
            {isRefining ? t('textLab.refining', '正在润色...') : t('textLab.refineBtn', '一键润色')}
          </button>

          {/* 润色结果 */}
          {(displayRefineContent || isRefining) && (
            <div className="result-panel" style={{ background: 'rgba(139,92,246,0.1)', borderColor: 'rgba(139,92,246,0.3)' }}>
              <div className="result-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} style={{ color: '#a78bfa' }} />
                  <span style={{ color: '#a78bfa', fontWeight: 600 }}>{t('textLab.refineResult', '润色结果')}</span>
                  {isRefining && <RefreshCw size={14} className="spin" style={{ color: '#a78bfa' }} />}
                </div>
              </div>
              <div style={{
                fontSize: '0.95rem', lineHeight: 1.8, color: 'var(--text-color)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {displayRefineContent}
                {isRefining && <span style={{ borderRight: '2px solid #8b5cf6', marginLeft: '2px' }}>&nbsp;</span>}
              </div>
              {/* Thinking */}
              {displayRefineThinking && !isRefining && (
                <ThinkingBlock thinking={displayRefineThinking} />
              )}
              {/* Token usage */}
              {displayRefineUsage && !isRefining && (
                <TokenUsageBar usage={displayRefineUsage} style={{ marginTop: '0.75rem' }} />
              )}
              {/* Actions */}
              {!isRefining && displayRefineContent && (
                <div className="result-panel-actions">
                  <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={handleCopyResult}>
                    {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copied ? t('textLab.copied', '已复制') : t('textLab.copy', '复制结果')}
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => handleCollectPrompt(displayRefineContent)}>
                    <BookmarkPlus size={14} /> {t('assetLibrary.collectBtn', '收藏')}
                  </button>
                  {refineScene === 'bgm_style' && (
                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem', background: '#8b5cf6', color: '#fff' }} onClick={() => { showToast('success', t('textLab.applied', '已复制到剪贴板，可粘贴到音乐实验室')); navigator.clipboard.writeText(displayRefineContent); }}>
                      <ArrowRight size={14} /> {t('textLab.useForMusic', '用于音乐生成')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== Models Tab ==================== */}
      {activeTab === 'models' && (
        <div className="glass-panel slide-up" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="flex items-center justify-between">
            <h3 style={{ margin: 0 }}>{t('textLab.availableModels', '可用模型')}</h3>
            <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={loadModels} disabled={isLoadingModels}>
              {isLoadingModels ? <RefreshCw className="spin" size={14} /> : <Database size={14} />} {t('textLab.refreshModels', '刷新模型列表')}
            </button>
          </div>

          {/* 模型能力矩阵 */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-muted)' }}>模型</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>文本</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>图片理解</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>Thinking</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>工具调用</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-muted)' }}>推荐场景</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: 'MiniMax-M3', text: true, image: true, thinking: 'adaptive', tools: true, rec: '深度思考、多模态' },
                  { id: 'MiniMax-M2.7', text: true, image: false, thinking: 'always', tools: true, rec: '高质量文本' },
                  { id: 'MiniMax-M2.7-highspeed', text: true, image: false, thinking: 'always', tools: true, rec: '快速文本' },
                  { id: 'MiniMax-M2.5', text: true, image: false, thinking: 'always', tools: true, rec: '性价比文本' },
                  { id: 'MiniMax-M2.5-highspeed', text: true, image: false, thinking: 'always', tools: true, rec: '快速文本' },
                  { id: 'MiniMax-M2.1', text: true, image: false, thinking: 'always', tools: true, rec: '基础文本' },
                  { id: 'MiniMax-M2.1-highspeed', text: true, image: false, thinking: 'always', tools: true, rec: '快速基础' },
                  { id: 'MiniMax-M2', text: true, image: false, thinking: 'always', tools: true, rec: '入门级' },
                ].map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{m.id}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{m.text ? '✅' : '—'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{m.image ? '✅' : '—'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', color: m.thinking === 'adaptive' ? '#8b5cf6' : 'var(--text-muted)' }}>
                      {m.thinking === 'adaptive' ? '可控' : '始终'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{m.tools ? '✅' : '—'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{m.rec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* API 返回的模型列表 */}
          {modelList.length > 0 && (
            <div>
              <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--text-muted)' }}>{t('textLab.apiModels', 'API 返回的模型列表')}</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {modelList.map(m => (
                  <span key={m.id} style={{
                    padding: '0.4rem 0.8rem', background: 'rgba(0,0,0,0.2)',
                    borderRadius: 'var(--radius-md)', fontSize: '0.8rem',
                  }}>
                    {m.displayName || m.id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== 保存对话框 ==================== */}
      {showSaveDialog && (
        <AssetSaveDialog
          title={t('assetLibrary.collectBtn', '收藏提示词')}
          defaultName={saveContent.slice(0, 20) + (saveContent.length > 20 ? '...' : '')}
          onSave={handleSavePrompt}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </LabPageLayout>
  );
};
