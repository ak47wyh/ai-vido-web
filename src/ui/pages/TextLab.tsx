import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, Bot, User, RefreshCw, Sparkles } from 'lucide-react';
import { textGenerationService } from '../../dependencies';
import type { TextGenerationMessage } from '../../domain/ports/OutboundPorts';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorUtils';

export const TextLab: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  
  const [messages, setMessages] = useState<TextGenerationMessage[]>([
    { role: 'assistant', content: '您好！我是文本助理。我可以帮您润色提示词、头脑风暴视频剧本、或回答任何问题。请问今天需要什么帮助？' }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [model, setModel] = useState<'MiniMax-M3' | 'MiniMax-M2.5'>('MiniMax-M3');
  
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    
    const userMessage: TextGenerationMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);
    
    try {
      const res = await textGenerationService.textPort.chatCompletion({
        model: model,
        messages: newMessages.filter(m => m.role === 'user' || m.role === 'assistant'),
        maxTokens: 2048,
        temperature: 0.7
      });
      
      setMessages([...newMessages, { role: 'assistant', content: res.content }]);
    } catch (e) {
      showToast('error', getErrorMessage(e, '对话请求失败'));
      setMessages([...newMessages, { role: 'assistant', content: '*请求失败，请稍后重试*' }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      { role: 'assistant', content: '您好！我是文本助理。我可以帮您润色提示词、头脑风暴视频剧本、或回答任何问题。请问今天需要什么帮助？' }
    ]);
  };

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(52,211,153,0.1)', borderRadius: 'var(--radius-lg)', color: '#34d399' }}>
            <MessageSquare size={32} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              文本实验室 (Text Lab)
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
              与 MiniMax 大语言模型对话，获取视频创作灵感与文案润色。
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select className="form-select" value={model} onChange={e => setModel(e.target.value as any)}>
            <option value="MiniMax-M3">MiniMax-M3 (智能更强)</option>
            <option value="MiniMax-M2.5">MiniMax-M2.5 (速度更快)</option>
          </select>
          <button className="btn btn-secondary" onClick={clearChat} style={{ fontSize: '0.85rem' }}>
            <RefreshCw size={14} /> 清空对话
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Chat History */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '1rem', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ 
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: msg.role === 'user' ? 'var(--primary-color)' : 'rgba(52,211,153,0.2)',
                color: msg.role === 'user' ? '#fff' : '#34d399'
              }}>
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
              </div>
              <div style={{ 
                maxWidth: '75%', padding: '1rem', borderRadius: 'var(--radius-lg)',
                background: msg.role === 'user' ? 'var(--primary-color)' : 'rgba(0,0,0,0.2)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)',
                lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                borderTopRightRadius: msg.role === 'user' ? 0 : 'var(--radius-lg)',
                borderTopLeftRadius: msg.role === 'assistant' ? 0 : 'var(--radius-lg)',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {isGenerating && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(52,211,153,0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={20} className="spin" />
              </div>
              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-lg)', borderTopLeftRadius: 0, color: 'var(--text-muted)' }}>
                正在思考中...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'rgba(20,20,30,0.5)' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <textarea
              className="form-input"
              style={{ flex: 1, resize: 'none', padding: '0.8rem', fontSize: '1rem' }}
              rows={2}
              placeholder="输入您的提示词、文案或任何问题... (Shift+Enter 换行)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button 
              className="btn btn-primary" 
              style={{ padding: '0 1.5rem', height: 'auto', background: '#34d399', border: 'none', color: '#000' }}
              disabled={!input.trim() || isGenerating}
              onClick={handleSend}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
