/**
 * AgentPortAdapter —— IAgentPort 的 Service 包装实现
 *
 * 把现有 AgentService 的 chat(messages): Promise<string> 包装成
 * Port 标准的 chat(context): Promise<AgentResponse>。
 *
 * 现有 AgentService 内部已用 PlatformRouter + textPort 注入，
 * 此适配器不增加新的依赖，只翻译"消息格式"。
 */

import type { IAgentPort, AgentContext, AgentResponse, AgentResponseDelta } from '../../../domain/ports/DomainServicePorts';
import { AgentService, type AgentMessage } from '../../../domain/services/AgentService';

export class AgentPortAdapter implements IAgentPort {
  private inner: AgentService;

  constructor(inner: AgentService) {
    this.inner = inner;
  }

  async chat(context: AgentContext): Promise<AgentResponse> {
    // 把 AgentContext 转换为 AgentMessage 列表
    const messages: AgentMessage[] = context.history.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));
    const content = await this.inner.chat(messages);
    return {
      content,
      toolCalls: undefined,
      usage: undefined,
    };
  }

  async *chatStream(context: AgentContext): AsyncIterable<AgentResponseDelta> {
    // 当前 AgentService 不支持流式，一次性返回后再 emit 整段
    const resp = await this.chat(context);
    yield { deltaContent: resp.content, finishReason: 'stop' };
  }
}
