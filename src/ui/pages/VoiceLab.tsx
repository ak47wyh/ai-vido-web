import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Volume2, Upload, RefreshCw, Save, BookmarkPlus, Palette, FileText, Settings, Trash2, Play, Search, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { voiceService, assetLibraryService } from '../../dependencies';
import type { T2ASyncModel, VoiceListResult } from '../../domain/ports/OutboundPorts';
import { VOICES_BY_LANGUAGE, LANGUAGE_LABELS } from '../../domain/data/systemVoices';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorUtils';
import { useSpace } from '../contexts/SpaceContext';
import { AssetSaveDialog } from '../components/AssetPicker';
import { AudioPreviewPlayer } from '../components/AudioPreviewPlayer';

type VoiceLabTab = 'tts' | 'clone' | 'design' | 'async' | 'manage';

// 音色设计快捷模板
const VOICE_DESIGN_TEMPLATES = [
  { name: '悬疑播讲', prompt: '讲述悬疑故事的播音员，声音低沉富有磁性，语速时快时慢，营造紧张神秘的氛围。', previewText: '夜深了，古屋里只有他一人。窗外传来若有若无的脚步声，他屏住呼吸，慢慢地走向那扇吱呀作响的门……' },
  { name: '温暖旁白', prompt: '温柔的女声旁白，像春风一样温暖，语速适中，适合讲述感人的故事。', previewText: '那年夏天，阳光透过树叶洒在小路上，微风带着花香，一切都那么美好。' },
  { name: '新闻播报', prompt: '专业的新闻主播，声音沉稳有力，吐字清晰，语速适中偏快。', previewText: '各位观众朋友们，欢迎收看今日新闻。今天我们关注的是科技领域的最新动态。' },
  { name: '儿童故事', prompt: '活泼可爱的女声，像幼儿园老师讲故事，语速偏慢，充满童趣。', previewText: '从前有一座大山，山里住着一只可爱的小白兔，它每天都会去采蘑菇。' },
  { name: '有声书', prompt: '沉稳的男声，像资深播音员，语速平稳，适合长篇朗读。', previewText: '第一章 黎明 在那个遥远的年代，人们还不知道什么是电，什么是网络。' },
  { name: '角色对白', prompt: '年轻男性角色，声音略带沙哑，有故事感，适合演绎内心独白。', previewText: '我从来没想过，事情会变成这样。也许从一开始，结局就已经注定了。' },
];

// 语气词标签列表
const EMOTION_TAGS = ['(laughs)', '(sighs)', '(breath)', '(coughs)', '(chuckle)', '(gasps)', '(pant)', '(inhale)', '(exhale)', '(sneezes)'];

/** hex 编码音频转 Blob URL */
function hexToAudioUrl(hex: string, format = 'mp3'): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  const blob = new Blob([bytes], { type: `audio/${format}` });
  return URL.createObjectURL(blob);
}

export const VoiceLab: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { currentSpaceId } = useSpace();

  const [activeTab, setActiveTab] = useState<VoiceLabTab>('tts');

  // ==================== TTS Tab State ====================
  const [ttsText, setTtsText] = useState('欢迎使用 AI 音色实验室。在这里，您可以单独体验声音生成和克隆技术。');
  const [ttsModel, setTtsModel] = useState<T2ASyncModel>('speech-2.8-turbo');
  const [ttsVoiceId, setTtsVoiceId] = useState('female-shaonv');
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [ttsVolume, setTtsVolume] = useState(1);
  const [ttsPitch, setTtsPitch] = useState(0);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showAdvancedTTS, setShowAdvancedTTS] = useState(false);
  const [ttsEmotion, setTtsEmotion] = useState('');
  const [ttsLanguageBoost, setTtsLanguageBoost] = useState('auto');
  const [ttsAudioFormat, setTtsAudioFormat] = useState('mp3');
  const [ttsSampleRate, setTtsSampleRate] = useState(32000);
  const [ttsOutputFormat, setTtsOutputFormat] = useState<'hex' | 'url'>('url');
  const [ttsSubtitleEnable, setTtsSubtitleEnable] = useState(false);

  // ==================== Clone Tab State ====================
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneText, setCloneText] = useState('你好，这是我刚刚克隆出的声音，听起来怎么样？');
  const [cloneName, setCloneName] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [clonePreviewAudioUrl, setClonePreviewAudioUrl] = useState<string | null>(null);
  const [promptAudioFile, setPromptAudioFile] = useState<File | null>(null);
  const [promptText, setPromptText] = useState('');
  const [cloneNeedNoiseReduction, setCloneNeedNoiseReduction] = useState(false);
  const [cloneNeedVolumeNorm, setCloneNeedVolumeNorm] = useState(false);
  const [showAdvancedClone, setShowAdvancedClone] = useState(false);

  // ==================== Design Tab State ====================
  const [designPrompt, setDesignPrompt] = useState('');
  const [designPreviewText, setDesignPreviewText] = useState('');
  const [isDesigning, setIsDesigning] = useState(false);
  const [designResult, setDesignResult] = useState<{ voiceId: string; audioUrl: string } | null>(null);

  // ==================== Async Tab State ====================
  const [asyncText, setAsyncText] = useState('');
  const [asyncVoiceId, setAsyncVoiceId] = useState('female-shaonv');
  const [asyncModel, setAsyncModel] = useState<string>('speech-2.8-hd');
  const [isCreatingAsyncTask, setIsCreatingAsyncTask] = useState(false);
  const [asyncTasks, setAsyncTasks] = useState<Array<{ taskId: string; text: string; status: string; audioUrl?: string; fileId?: string; error?: string }>>([]);
  const pollingRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // ==================== Manage Tab State ====================
  const [voiceList, setVoiceList] = useState<VoiceListResult | null>(null);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<'all' | 'system' | 'voice_cloning' | 'voice_generation'>('all');
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null);

  // ==================== TTS Handlers ====================
  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) return;
    setIsGeneratingTTS(true);
    setTtsAudioUrl(null);
    try {
      const res = await voiceService.synthesizeSync(ttsText, ttsVoiceId, ttsModel, {
        speed: ttsSpeed,
        volume: ttsVolume,
        pitch: ttsPitch,
        emotion: ttsEmotion || undefined,
        audioFormat: ttsAudioFormat,
        sampleRate: ttsSampleRate,
        outputFormat: ttsOutputFormat,
        languageBoost: ttsLanguageBoost,
        subtitleEnable: ttsSubtitleEnable,
      });
      // 统一通过 resolveAudioUrl 转为可播放的 Blob URL
      const blobUrl = await voiceService.resolveAudioUrl(res);
      setTtsAudioUrl(blobUrl);
      showToast('success', '音频生成成功');
    } catch (e) {
      showToast('error', getErrorMessage(e, '音频生成失败'));
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const insertEmotionTag = (tag: string) => {
    setTtsText(prev => prev + tag);
  };

  // ==================== Clone Handlers ====================
  const handleCloneVoice = async () => {
    if (!cloneFile || !cloneName.trim()) return;
    setIsCloning(true);
      setClonedVoiceId(null);
      setClonePreviewAudioUrl(null);
      try {
        const customVoiceId = `clone_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const newVoiceId = await voiceService.cloneVoice(
          cloneFile,
          customVoiceId,
          cloneText,
          promptAudioFile || undefined,
          promptText || undefined,
          {
            needNoiseReduction: cloneNeedNoiseReduction,
            needVolumeNormalization: cloneNeedVolumeNorm,
          }
        );
        setClonedVoiceId(newVoiceId);
        setTtsVoiceId(newVoiceId);
        // 克隆成功后，用新音色试听
        try {
          const previewUrl = await voiceService.previewVoice(newVoiceId, cloneText);
          setClonePreviewAudioUrl(previewUrl);
        } catch {
          // 试听失败不影响克隆成功
        }
        showToast('success', `音色克隆成功！ID: ${newVoiceId}`);
    } catch (e) {
      showToast('error', getErrorMessage(e, '克隆失败'));
    } finally {
      setIsCloning(false);
    }
  };

  // ==================== Design Handlers ====================
  const handleDesignVoice = async () => {
    if (!designPrompt.trim() || !designPreviewText.trim()) return;
    setIsDesigning(true);
    setDesignResult(null);
    try {
      const result = await voiceService.designVoice(designPrompt, designPreviewText);
      const audioUrl = hexToAudioUrl(result.trialAudioHex);
      setDesignResult({ voiceId: result.voiceId, audioUrl });
      showToast('success', `音色设计成功！ID: ${result.voiceId}`);
    } catch (e) {
      showToast('error', getErrorMessage(e, '音色设计失败'));
    } finally {
      setIsDesigning(false);
    }
  };

  const applyTemplate = (template: typeof VOICE_DESIGN_TEMPLATES[0]) => {
    setDesignPrompt(template.prompt);
    setDesignPreviewText(template.previewText);
  };

  // ==================== Async Handlers ====================
  const handleCreateAsyncTask = async () => {
    if (!asyncText.trim()) return;
    setIsCreatingAsyncTask(true);
    try {
      const taskId = await voiceService.createAsyncTask(asyncText, asyncVoiceId, { model: asyncModel });
      setAsyncTasks(prev => [...prev, { taskId, text: asyncText.substring(0, 50), status: 'processing' }]);
      startPolling(taskId);
      showToast('success', '异步合成任务已提交');
    } catch (e) {
      showToast('error', getErrorMessage(e, '任务创建失败'));
    } finally {
      setIsCreatingAsyncTask(false);
    }
  };

  const startPolling = (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await voiceService.queryNarrationStatus(taskId);
        if (status.status === 'success') {
          clearInterval(interval);
          pollingRef.current.delete(taskId);
          // 异步任务完成后，需要带认证下载音频转 Blob URL
          let blobUrl: string | undefined;
          if (status.audioUrl) {
            try {
              blobUrl = await voiceService.voicePort.fetchAudioAsBlobUrl(status.audioUrl);
            } catch {
              // 下载失败，使用原始 URL 作为降级
              blobUrl = status.audioUrl;
            }
          }
          setAsyncTasks(prev => prev.map(t => t.taskId === taskId ? { ...t, status: 'success', audioUrl: blobUrl, fileId: status.fileId } : t));
        } else if (status.status === 'failed' || status.status === 'expired') {
          clearInterval(interval);
          pollingRef.current.delete(taskId);
          setAsyncTasks(prev => prev.map(t => t.taskId === taskId ? { ...t, status: 'failed', error: status.errorMessage } : t));
        }
      } catch {
        clearInterval(interval);
        pollingRef.current.delete(taskId);
        setAsyncTasks(prev => prev.map(t => t.taskId === taskId ? { ...t, status: 'failed', error: '查询失败' } : t));
      }
    }, 3000);
    pollingRef.current.set(taskId, interval);
  };

  // ==================== Manage Handlers ====================
  const loadVoices = async () => {
    setIsLoadingVoices(true);
    try {
      const result = await voiceService.getAvailableVoices(voiceFilter === 'all' ? 'all' : voiceFilter);
      setVoiceList(result);
    } catch (e) {
      showToast('error', getErrorMessage(e, '获取音色列表失败'));
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const handleTabChange = (tab: VoiceLabTab) => {
    setActiveTab(tab);
    if (tab === 'manage') {
      loadVoices();
    }
  };

  const handlePreviewVoice = async (voiceId: string) => {
    setPreviewingVoiceId(voiceId);
    setIsPreviewing(true);
    setPreviewAudioUrl(null);
    try {
      // previewVoice 内部已通过 resolveAudioUrl 转为 Blob URL
      const url = await voiceService.previewVoice(voiceId);
      setPreviewAudioUrl(url);
    } catch (e) {
      showToast('error', getErrorMessage(e, '试听失败'));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleDeleteVoice = async (voiceType: 'voice_cloning' | 'voice_generation', voiceId: string) => {
    if (!confirm(`确认删除音色 ${voiceId}？删除后不可恢复。`)) return;
    setDeletingVoiceId(voiceId);
    try {
      await voiceService.deleteVoice(voiceType, voiceId);
      showToast('success', '音色已删除');
      loadVoices();
    } catch (e) {
      showToast('error', getErrorMessage(e, '删除失败'));
    } finally {
      setDeletingVoiceId(null);
    }
  };

  // ==================== Save to Library ====================
  const handleSaveToLibrary = async (name: string, tags: string) => {
    if (!ttsAudioUrl || !currentSpaceId) return;
    try {
      await assetLibraryService.saveVoiceFromUrl({
        spaceId: currentSpaceId,
        name,
        audioUrl: ttsAudioUrl,
        voiceId: ttsVoiceId,
        model: ttsModel,
        speed: ttsSpeed,
        sampleText: ttsText,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        sourceType: 'lab',
      });
      showToast('success', t('assetLibrary.saveSuccess', '素材保存成功'));
      setShowSaveDialog(false);
    } catch (e) {
      showToast('error', getErrorMessage(e, t('assetLibrary.saveFailed', '素材保存失败')));
    }
  };

  // ==================== Download Audio ====================
  const handleDownloadAudio = (blobUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', '开始下载');
  };

  // 清理轮询
  useEffect(() => {
    const current = pollingRef.current;
    return () => {
      current.forEach(interval => clearInterval(interval));
    };
  }, []);

  // ==================== Tab Buttons ====================
  const tabs: { key: VoiceLabTab; label: string; icon: React.ReactNode; color?: string }[] = [
    { key: 'tts', label: '文本配音', icon: <Volume2 size={16} /> },
    { key: 'clone', label: '音色克隆', icon: <Mic size={16} />, color: '#ec4899' },
    { key: 'design', label: '音色设计', icon: <Palette size={16} />, color: '#8b5cf6' },
    { key: 'async', label: '长文本合成', icon: <FileText size={16} />, color: '#f59e0b' },
    { key: 'manage', label: '音色管理', icon: <Settings size={16} />, color: '#06b6d4' },
  ];

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', background: 'rgba(236,72,153,0.1)', borderRadius: 'var(--radius-lg)', color: '#ec4899' }}>
          <Mic size={32} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            音色实验室 (Voice Lab)
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            文本转语音、声音克隆、音色设计、长文本合成与音色管理
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleTabChange(tab.key)}
            style={{
              background: activeTab === tab.key ? (tab.color || 'var(--primary-color)') : 'transparent',
              border: activeTab === tab.key ? 'none' : '1px solid var(--border-color)',
              fontSize: '0.85rem',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== TTS Tab ==================== */}
      {activeTab === 'tts' && (
        <div className="glass-panel slide-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label className="form-label">配音文本</label>
            <textarea
              className="form-input"
              rows={4}
              value={ttsText}
              onChange={e => setTtsText(e.target.value)}
              style={{ fontSize: '1rem', padding: '1rem' }}
            />
            {/* 语气词快捷插入 */}
            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.3rem' }}>语气词:</span>
              {EMOTION_TAGS.map(tag => (
                <button key={tag} className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }} onClick={() => insertEmotionTag(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label">发音人 (Voice ID)</label>
              <select className="form-select" value={ttsVoiceId} onChange={e => setTtsVoiceId(e.target.value)}>
                {Object.entries(VOICES_BY_LANGUAGE).map(([lang, voices]) => (
                  <optgroup key={lang} label={LANGUAGE_LABELS[lang] || lang}>
                    {voices.map(v => <option key={v.voiceId} value={v.voiceId}>{v.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">TTS 模型</label>
              <select className="form-select" value={ttsModel} onChange={e => setTtsModel(e.target.value as T2ASyncModel)}>
                <option value="speech-2.8-turbo">2.8 Turbo</option>
                <option value="speech-2.8-hd">2.8 HD</option>
                <option value="speech-2.6-turbo">2.6 Turbo</option>
                <option value="speech-2.6-hd">2.6 HD</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">语速 ({ttsSpeed}x)</label>
              <input type="range" min="0.5" max="2" step="0.1" value={ttsSpeed} onChange={e => setTtsSpeed(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary-color)', marginTop: '0.5rem' }} />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">音量 ({ttsVolume})</label>
              <input type="range" min="0" max="10" step="0.5" value={ttsVolume} onChange={e => setTtsVolume(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary-color)', marginTop: '0.5rem' }} />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">音调 ({ttsPitch})</label>
              <input type="range" min="-12" max="12" step="1" value={ttsPitch} onChange={e => setTtsPitch(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary-color)', marginTop: '0.5rem' }} />
            </div>
          </div>

          {/* 高级设置 */}
          <div>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setShowAdvancedTTS(!showAdvancedTTS)}>
              {showAdvancedTTS ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 高级设置
            </button>
            {showAdvancedTTS && (
              <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label className="form-label">情感</label>
                  <select className="form-select" value={ttsEmotion} onChange={e => setTtsEmotion(e.target.value)}>
                    <option value="">默认</option>
                    <option value="happy">开心</option>
                    <option value="sad">悲伤</option>
                    <option value="angry">愤怒</option>
                    <option value="fearful">恐惧</option>
                    <option value="disgusted">厌恶</option>
                    <option value="surprised">惊讶</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label className="form-label">语种增强</label>
                  <select className="form-select" value={ttsLanguageBoost} onChange={e => setTtsLanguageBoost(e.target.value)}>
                    <option value="auto">自动</option>
                    <option value="Chinese">中文</option>
                    <option value="Chinese,Yue">中文+粤语</option>
                    <option value="English">英语</option>
                    <option value="Japanese">日语</option>
                    <option value="Korean">韩语</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label className="form-label">音频格式</label>
                  <select className="form-select" value={ttsAudioFormat} onChange={e => setTtsAudioFormat(e.target.value)}>
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                    <option value="flac">FLAC</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label className="form-label">采样率</label>
                  <select className="form-select" value={ttsSampleRate} onChange={e => setTtsSampleRate(Number(e.target.value))}>
                    <option value={16000}>16000</option>
                    <option value={24000}>24000</option>
                    <option value={32000}>32000</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label className="form-label">输出格式</label>
                  <select className="form-select" value={ttsOutputFormat} onChange={e => setTtsOutputFormat(e.target.value as 'hex' | 'url')}>
                    <option value="url">URL (24h有效)</option>
                    <option value="hex">HEX</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.2rem' }}>
                  <input type="checkbox" checked={ttsSubtitleEnable} onChange={e => setTtsSubtitleEnable(e.target.checked)} />
                  <label style={{ fontSize: '0.85rem' }}>开启字幕</label>
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            style={{ padding: '1rem', fontSize: '1.1rem', justifyContent: 'center' }}
            disabled={!ttsText.trim() || !ttsVoiceId.trim() || isGeneratingTTS}
            onClick={handleGenerateTTS}
          >
            {isGeneratingTTS ? <RefreshCw className="spin" size={20} /> : <Volume2 size={20} />}
            {isGeneratingTTS ? '正在合成语音...' : '生成配音'}
          </button>
        </div>
      )}

      {/* ==================== Clone Tab ==================== */}
      {activeTab === 'clone' && (
        <div className="glass-panel slide-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label className="form-label">上传复刻音频 (清晰人声, 10秒~5分钟, ≤20MB)</label>
            <div
              style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '2rem', textAlign: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.1)' }}
              onClick={() => document.getElementById('cloneFileInput')?.click()}
            >
              <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <p style={{ margin: 0, color: 'var(--text-color)' }}>
                {cloneFile ? cloneFile.name : '点击选择本地音频文件 (.mp3, .wav, .m4a)'}
              </p>
              <input id="cloneFileInput" type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => e.target.files && setCloneFile(e.target.files[0])} />
            </div>
          </div>

          <div>
            <label className="form-label">示例音频（可选，少于8秒，增强克隆效果）</label>
            <div
              style={{ border: '2px dashed rgba(139,92,246,0.3)', borderRadius: 'var(--radius-md)', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: 'rgba(139,92,246,0.05)' }}
              onClick={() => document.getElementById('promptFileInput')?.click()}
            >
              <p style={{ margin: 0, color: 'var(--text-color)', fontSize: '0.85rem' }}>
                {promptAudioFile ? promptAudioFile.name : '点击上传示例音频'}
              </p>
              <input id="promptFileInput" type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => e.target.files && setPromptAudioFile(e.target.files[0])} />
            </div>
            {promptAudioFile && (
              <input className="form-input" style={{ marginTop: '0.5rem' }} placeholder="示例音频对应文本（可选）" value={promptText} onChange={e => setPromptText(e.target.value)} />
            )}
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label">音色名称</label>
              <input type="text" className="form-input" placeholder="给这个新声音起个名字" value={cloneName} onChange={e => setCloneName(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="form-label">试听文本</label>
            <textarea className="form-input" rows={3} value={cloneText} onChange={e => setCloneText(e.target.value)} placeholder="将用克隆出的声音朗读这段话" />
          </div>

          {/* 高级克隆选项 */}
          <div>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setShowAdvancedClone(!showAdvancedClone)}>
              {showAdvancedClone ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 高级选项
            </button>
            {showAdvancedClone && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={cloneNeedNoiseReduction} onChange={e => setCloneNeedNoiseReduction(e.target.checked)} /> 开启降噪
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={cloneNeedVolumeNorm} onChange={e => setCloneNeedVolumeNorm(e.target.checked)} /> 音量归一化
                </label>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            style={{ padding: '1rem', fontSize: '1.1rem', justifyContent: 'center', background: '#ec4899' }}
            disabled={!cloneFile || !cloneName.trim() || isCloning}
            onClick={handleCloneVoice}
          >
            {isCloning ? <RefreshCw className="spin" size={20} /> : <Save size={20} />}
            {isCloning ? '正在分析特征并克隆...' : '开始克隆音色'}
          </button>

          {clonedVoiceId && (
            <div style={{ padding: '1rem', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ color: '#34d399', margin: '0 0 0.5rem 0' }}>克隆成功！Voice ID: <strong>{clonedVoiceId}</strong></p>
              {clonePreviewAudioUrl && (
                <AudioPreviewPlayer
                  src={clonePreviewAudioUrl}
                  autoPlay
                  accentColor="#34d399"
                  downloadFilename={`clone_${clonedVoiceId}.mp3`}
                  onDownload={handleDownloadAudio}
                />
              )}
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>
                <AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> 请在 7 天内使用此音色合成一次语音，否则音色将被系统删除
              </p>
            </div>
          )}
        </div>
      )}

      {/* ==================== Design Tab ==================== */}
      {activeTab === 'design' && (
        <div className="glass-panel slide-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label className="form-label">音色描述</label>
            <textarea
              className="form-input"
              rows={3}
              value={designPrompt}
              onChange={e => setDesignPrompt(e.target.value)}
              placeholder="描述你想要的声音特征，例如：温柔的女声，像春风一样，语速适中，适合讲故事"
            />
          </div>

          <div>
            <label className="form-label">试听文本 ({designPreviewText.length}/500)</label>
            <textarea
              className="form-input"
              rows={3}
              value={designPreviewText}
              onChange={e => setDesignPreviewText(e.target.value.substring(0, 500))}
              placeholder="输入试听文本，将用设计的音色朗读"
            />
          </div>

          {/* 快捷模板 */}
          <div>
            <label className="form-label">快捷模板</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {VOICE_DESIGN_TEMPLATES.map(tpl => (
                <button key={tpl.name} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }} onClick={() => applyTemplate(tpl)}>
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ padding: '1rem', fontSize: '1.1rem', justifyContent: 'center', background: '#8b5cf6' }}
            disabled={!designPrompt.trim() || !designPreviewText.trim() || isDesigning}
            onClick={handleDesignVoice}
          >
            {isDesigning ? <RefreshCw className="spin" size={20} /> : <Palette size={20} />}
            {isDesigning ? '正在设计音色...' : '生成音色'}
          </button>

          {designResult && (
            <div style={{ padding: '1rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ color: '#8b5cf6', margin: '0 0 0.5rem 0' }}>音色设计成功！Voice ID: <strong>{designResult.voiceId}</strong></p>
              <AudioPreviewPlayer
                src={designResult.audioUrl}
                autoPlay
                accentColor="#8b5cf6"
                downloadFilename={`design_${designResult.voiceId}.mp3`}
                onDownload={handleDownloadAudio}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>
                <AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> 请在 7 天内使用此音色合成一次语音
              </p>
            </div>
          )}
        </div>
      )}

      {/* ==================== Async Tab ==================== */}
      {activeTab === 'async' && (
        <div className="glass-panel slide-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label className="form-label">长文本内容（≤ 50,000 字符）</label>
            <textarea
              className="form-input"
              rows={8}
              value={asyncText}
              onChange={e => setAsyncText(e.target.value)}
              placeholder="输入或粘贴长文本内容，适合整篇故事、有声书等场景..."
              style={{ fontSize: '0.95rem', padding: '1rem' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              当前字数: {asyncText.length} / 50000
            </p>
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label">音色</label>
              <select className="form-select" value={asyncVoiceId} onChange={e => setAsyncVoiceId(e.target.value)}>
                {Object.entries(VOICES_BY_LANGUAGE).map(([lang, voices]) => (
                  <optgroup key={lang} label={LANGUAGE_LABELS[lang] || lang}>
                    {voices.map(v => <option key={v.voiceId} value={v.voiceId}>{v.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">模型</label>
              <select className="form-select" value={asyncModel} onChange={e => setAsyncModel(e.target.value)}>
                <option value="speech-2.8-hd">2.8 HD（推荐）</option>
                <option value="speech-2.8-turbo">2.8 Turbo</option>
                <option value="speech-2.6-hd">2.6 HD</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ padding: '1rem', fontSize: '1.1rem', justifyContent: 'center', background: '#f59e0b' }}
            disabled={!asyncText.trim() || isCreatingAsyncTask}
            onClick={handleCreateAsyncTask}
          >
            {isCreatingAsyncTask ? <RefreshCw className="spin" size={20} /> : <FileText size={20} />}
            {isCreatingAsyncTask ? '正在提交任务...' : '提交异步合成任务'}
          </button>

          {/* 任务列表 */}
          {asyncTasks.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <label className="form-label">任务列表</label>
              {asyncTasks.map((task, idx) => (
                <div key={task.taskId} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', flex: 1 }}>
                    任务 #{idx + 1}: "{task.text}..."
                  </span>
                  {task.status === 'processing' && (
                    <span style={{ color: '#f59e0b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <RefreshCw size={14} className="spin" /> 处理中...
                    </span>
                  )}
                  {task.status === 'success' && (
                    <>
                      <span style={{ color: '#34d399', fontSize: '0.85rem' }}>已完成</span>
                      {task.audioUrl && (
                        <AudioPreviewPlayer
                          src={task.audioUrl}
                          compact
                          accentColor="#f59e0b"
                          showWaveform={false}
                          downloadFilename={`async_${task.taskId}.mp3`}
                          onDownload={handleDownloadAudio}
                          style={{ flex: 1, minWidth: '200px' }}
                        />
                      )}
                    </>
                  )}
                  {task.status === 'failed' && (
                    <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>失败: {task.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== Manage Tab ==================== */}
      {activeTab === 'manage' && (
        <div className="glass-panel slide-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: '2.2rem' }} placeholder="搜索音色..." value={voiceSearch} onChange={e => setVoiceSearch(e.target.value)} />
              </div>
            </div>
            <select className="form-select" style={{ width: 'auto' }} value={voiceFilter} onChange={e => { setVoiceFilter(e.target.value as typeof voiceFilter); loadVoices(); }}>
              <option value="all">全部</option>
              <option value="system">系统音色</option>
              <option value="voice_cloning">克隆音色</option>
              <option value="voice_generation">设计音色</option>
            </select>
            <button className="btn btn-secondary" onClick={loadVoices} disabled={isLoadingVoices}>
              {isLoadingVoices ? <RefreshCw className="spin" size={14} /> : <RefreshCw size={14} />} 刷新
            </button>
          </div>

          {/* 系统音色 */}
          {voiceList?.systemVoices && voiceFilter !== 'voice_cloning' && voiceFilter !== 'voice_generation' && (
            <div>
              <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem 0', color: 'var(--text-muted)' }}>系统音色 ({voiceList.systemVoices.length})</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {voiceList.systemVoices
                  .filter(v => !voiceSearch || v.voiceId.toLowerCase().includes(voiceSearch.toLowerCase()) || v.voiceName.toLowerCase().includes(voiceSearch.toLowerCase()))
                  .map(v => (
                  <div key={v.voiceId} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)' }}>
                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '0.9rem' }}>{v.voiceName}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.voiceId}</p>
                    {v.description && <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.description}</p>}
                    <button className="btn btn-secondary" style={{ fontSize: '0.75rem', marginTop: '0.5rem', padding: '0.2rem 0.5rem' }}
                      disabled={isPreviewing && previewingVoiceId === v.voiceId}
                      onClick={() => handlePreviewVoice(v.voiceId)}>
                      <Play size={12} /> 试听
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 克隆音色 */}
          {voiceList?.clonedVoices && voiceFilter !== 'system' && voiceFilter !== 'voice_generation' && (
            <div>
              <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem 0', color: '#ec4899' }}>克隆音色 ({voiceList.clonedVoices.length})</h3>
              {voiceList.clonedVoices
                .filter(v => !voiceSearch || v.voiceId.toLowerCase().includes(voiceSearch.toLowerCase()))
                .map(v => (
                <div key={v.voiceId} style={{ padding: '0.75rem', background: 'rgba(236,72,153,0.05)', border: '1px solid rgba(236,72,153,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{v.voiceName || v.voiceId}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>创建: {v.createdTime || '未知'}</p>
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    disabled={isPreviewing && previewingVoiceId === v.voiceId}
                    onClick={() => handlePreviewVoice(v.voiceId)}>
                    <Play size={12} /> 试听
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: '#ef4444' }}
                    disabled={deletingVoiceId === v.voiceId}
                    onClick={() => handleDeleteVoice('voice_cloning', v.voiceId)}>
                    <Trash2 size={12} /> 删除
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 设计音色 */}
          {voiceList?.designedVoices && voiceFilter !== 'system' && voiceFilter !== 'voice_cloning' && (
            <div>
              <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem 0', color: '#8b5cf6' }}>设计音色 ({voiceList.designedVoices.length})</h3>
              {voiceList.designedVoices
                .filter(v => !voiceSearch || v.voiceId.toLowerCase().includes(voiceSearch.toLowerCase()))
                .map(v => (
                <div key={v.voiceId} style={{ padding: '0.75rem', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{v.voiceName || v.voiceId}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>创建: {v.createdTime || '未知'}</p>
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    disabled={isPreviewing && previewingVoiceId === v.voiceId}
                    onClick={() => handlePreviewVoice(v.voiceId)}>
                    <Play size={12} /> 试听
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: '#ef4444' }}
                    disabled={deletingVoiceId === v.voiceId}
                    onClick={() => handleDeleteVoice('voice_generation', v.voiceId)}>
                    <Trash2 size={12} /> 删除
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 试听播放器 */}
          {previewAudioUrl && (
            <AudioPreviewPlayer
              src={previewAudioUrl}
              autoPlay
              accentColor="#06b6d4"
              title={previewingVoiceId || undefined}
              downloadFilename={`preview_${previewingVoiceId || 'voice'}.mp3`}
              onDownload={handleDownloadAudio}
            />
          )}
        </div>
      )}

      {/* ==================== 通用: TTS 结果 + 保存 + 下载 ==================== */}
      {ttsAudioUrl && activeTab === 'tts' && (
        <div className="glass-panel slide-up" style={{ marginTop: '2rem', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>生成结果</h3>
          <AudioPreviewPlayer
            src={ttsAudioUrl}
            autoPlay
            downloadFilename={`tts_${ttsVoiceId}.${ttsAudioFormat}`}
            onDownload={handleDownloadAudio}
          />
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setShowSaveDialog(true)}>
              <BookmarkPlus size={16} /> {t('assetLibrary.saveBtn', '保存到素材库')}
            </button>
          </div>
        </div>
      )}

      {showSaveDialog && (
        <AssetSaveDialog
          title={t('assetLibrary.saveBtn', '保存到素材库')}
          defaultName={`${ttsVoiceId} - ${ttsModel}`}
          onSave={handleSaveToLibrary}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
};
