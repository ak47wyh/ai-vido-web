import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { agentService } from '../../dependencies';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorUtils';
import type { AgentMessage } from '../../domain/services/AgentService';
import { TextAreaWithCounter } from './TextAreaWithCounter';

interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_result';
  content: string;
}

export const AgentChatPanel: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: AgentChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    const userInput = input;
    setInput('');
    setIsLoading(true);

    const agentMessages: AgentMessage[] = messages
      .filter(m => m.role !== 'tool_result')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const response = await agentService.chat(
        [...agentMessages, { role: 'user', content: userInput }]
      );
      const assistantMsg: AgentChatMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: response,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      showToast('error', getErrorMessage(e, t('agent.error')));
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: getErrorMessage(e, t('agent.error')),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: t('agent.quickCreateCharacter'), prompt: t('agent.quickCreateCharacterPrompt') },
    { label: t('agent.quickSplitStory'), prompt: t('agent.quickSplitPrompt') },
    { label: t('agent.quickGenerateImage'), prompt: t('agent.quickGenerateImagePrompt') },
    { label: t('agent.quickGenerateNarration'), prompt: t('agent.quickGenerateNarrationPrompt') },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem',
        background: 'rgba(129,140,248,0.15)',
        borderBottom: '1px solid rgba(129,140,248,0.2)',
      }}>
        <Bot size={18} style={{ color: '#818cf8', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('agent.title')}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('agent.subtitle')}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
            <Sparkles size={32} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.5 }} />
            {t('agent.welcome')}
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: msg.role === 'user' ? 'rgba(99,102,248,0.2)' : 'rgba(129,140,248,0.2)',
            }}>
              {msg.role === 'user'
                ? <User size={14} style={{ color: '#818cf8' }} />
                : <Bot size={14} style={{ color: '#a78bfa' }} />
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-muted)' }}>
                {msg.role === 'user' ? t('agent.you') : 'Agent'}
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)',
                padding: '0.75rem', fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {msg.content || (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('agent.thinking')}</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: 'rgba(129,140,248,0.2)',
            }}>
              <Bot size={14} style={{ color: '#a78bfa' }} />
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <Loader2 size={14} className="spin" />
              {t('agent.thinking')}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length === 0 && (
        <div style={{ padding: '0 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {quickActions.map(action => (
            <button
              key={action.prompt}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              onClick={() => { setInput(action.prompt); textareaRef.current?.focus(); }}
            >
              <Wand2 size={12} />
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div style={{
        padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
      }}>
        <TextAreaWithCounter
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('agent.placeholder')}
          rows={2}
          style={{ resize: 'none', flex: 1, fontSize: '0.875rem' }}
          disabled={isLoading}
          maxLength={500}
        />
        <button
          className="btn btn-primary"
          style={{ padding: '0.5rem 0.75rem', alignSelf: 'flex-end', flexShrink: 0 }}
          disabled={!input.trim() || isLoading}
          onClick={sendMessage}
        >
          {isLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};
