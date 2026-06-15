import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Volume2, Upload, RefreshCw, Save, BookmarkPlus } from 'lucide-react';
import { voiceService, assetLibraryService } from '../../dependencies';
import type { T2ASyncModel } from '../../domain/ports/OutboundPorts';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorUtils';
import { useSpace } from '../contexts/SpaceContext';
import { AssetSaveDialog } from '../components/AssetPicker';

export const VoiceLab: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'tts' | 'clone'>('tts');

  // TTS State
  const [ttsText, setTtsText] = useState('欢迎使用 AI 音色实验室。在这里，您可以单独体验声音生成和克隆技术。');
  const [ttsModel, setTtsModel] = useState<T2ASyncModel>('speech-2.8-turbo');
  const [ttsVoiceId, setTtsVoiceId] = useState('female-shaonv');
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const { currentSpaceId } = useSpace();

  // Clone State
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneText, setCloneText] = useState('你好，这是我刚刚克隆出的声音，听起来怎么样？');
  const [cloneName, setCloneName] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);

  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) return;
    setIsGeneratingTTS(true);
    setTtsAudioUrl(null);
    try {
      const res = await voiceService.synthesizeSync(ttsText, ttsVoiceId, ttsModel);
      if (res.audioUrl) {
        setTtsAudioUrl(res.audioUrl);
        showToast('success', '音频生成成功');
      } else {
        throw new Error('未返回音频 URL');
      }
    } catch (e) {
      showToast('error', getErrorMessage(e, '音频生成失败'));
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const handleCloneVoice = async () => {
    if (!cloneFile || !cloneName.trim()) return;
    setIsCloning(true);
    setClonedVoiceId(null);
    try {
      const customVoiceId = `clone_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const newVoiceId = await voiceService.cloneVoice(cloneFile, customVoiceId, cloneText);
      setClonedVoiceId(newVoiceId);
      setTtsVoiceId(newVoiceId);
      showToast('success', `音色克隆成功！ID: ${newVoiceId}`);
    } catch (e) {
      showToast('error', getErrorMessage(e, '克隆失败'));
    } finally {
      setIsCloning(false);
    }
  };

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

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', background: 'rgba(236,72,153,0.1)', borderRadius: 'var(--radius-lg)', color: '#ec4899' }}>
          <Mic size={32} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            音色实验室 (Voice Lab)
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            单独调用文本转语音 (TTS) 与声音克隆引擎，打造专属声线。
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <button 
          className={`btn ${activeTab === 'tts' ? 'btn-primary' : 'btn-secondary'}`} 
          onClick={() => setActiveTab('tts')}
          style={{ background: activeTab === 'tts' ? 'var(--primary-color)' : 'transparent', border: activeTab === 'tts' ? 'none' : '1px solid var(--border-color)' }}
        >
          <Volume2 size={16} /> 文本配音 (TTS)
        </button>
        <button 
          className={`btn ${activeTab === 'clone' ? 'btn-primary' : 'btn-secondary'}`} 
          onClick={() => setActiveTab('clone')}
          style={{ background: activeTab === 'clone' ? '#ec4899' : 'transparent', border: activeTab === 'clone' ? 'none' : '1px solid var(--border-color)' }}
        >
          <Mic size={16} /> 音色克隆 (Cloning)
        </button>
      </div>

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
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label">发音人 (Voice ID)</label>
              <input 
                type="text" 
                className="form-input" 
                value={ttsVoiceId} 
                onChange={e => setTtsVoiceId(e.target.value)} 
                placeholder="例如: female-shaonv, male-qn-qingse"
              />
            </div>
            
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">TTS 模型</label>
              <select className="form-select" value={ttsModel} onChange={e => setTtsModel(e.target.value as T2ASyncModel)}>
                <option value="speech-2.8-turbo">2.8 Turbo</option>
                <option value="speech-2.8-hd">2.8 HD</option>
                <option value="speech-2.6-turbo">2.6 Turbo</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">语速 ({ttsSpeed}x)</label>
              <input 
                type="range" 
                min="0.5" max="2" step="0.1" 
                value={ttsSpeed} 
                onChange={e => setTtsSpeed(parseFloat(e.target.value))} 
                style={{ width: '100%', accentColor: 'var(--primary-color)', marginTop: '0.5rem' }}
              />
            </div>
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

      {activeTab === 'clone' && (
        <div className="glass-panel slide-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label className="form-label">上传参考音频 (清晰、无背景噪音的人声, &gt;5s)</label>
            <div 
              style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '2rem', textAlign: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.1)' }}
              onClick={() => document.getElementById('cloneFileInput')?.click()}
            >
              <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <p style={{ margin: 0, color: 'var(--text-color)' }}>
                {cloneFile ? cloneFile.name : '点击选择本地音频文件 (.mp3, .wav, .m4a)'}
              </p>
              <input 
                id="cloneFileInput" 
                type="file" 
                accept="audio/*" 
                style={{ display: 'none' }} 
                onChange={e => e.target.files && setCloneFile(e.target.files[0])} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label">音色名称</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="给这个新声音起个名字"
                value={cloneName}
                onChange={e => setCloneName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">试听生成文本 (将用克隆出的声音朗读这段话)</label>
            <textarea
              className="form-input"
              rows={3}
              value={cloneText}
              onChange={e => setCloneText(e.target.value)}
            />
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
            <div style={{ padding: '1rem', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 'var(--radius-md)', color: '#34d399', textAlign: 'center' }}>
              克隆成功！系统分配的 Voice ID: <strong>{clonedVoiceId}</strong>
            </div>
          )}
        </div>
      )}

      {ttsAudioUrl && (
        <div className="glass-panel slide-up" style={{ marginTop: '2rem', padding: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>生成结果</h3>
          <audio src={ttsAudioUrl} controls autoPlay style={{ width: '100%', maxWidth: '600px', height: '40px' }} />
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setShowSaveDialog(true)}>
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
