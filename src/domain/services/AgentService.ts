import type { ITextGenerationPort } from '../ports/OutboundPorts';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
}

const SYSTEM_PROMPT = `你是一个专业的 AI 视频创作助手，能够根据用户的自然语言指令，调用各种工具来完成视频创作任务。

你有以下工具可以使用：

1. create_character - 创建角色（名称，外貌、性格）
2. create_background - 创建背景（名称，环境描述）
3. split_story_to_segments - 将长故事拆分为多个分镜段落
4. generate_video_prompt - 生成视频生成提示词
5. suggest_bgm_style - 推荐背景音乐风格
6. generate_image - 生成图片
7. generate_narration - 生成旁白音频
8. generate_video - 生成视频
9. apply_transition - 在两个视频片段之间应用转场效果
10. burn_subtitles - 为视频烧录字幕
11. mix_audio - 混合多个音轨
12. update_character - 更新角色信息
13. update_background - 更新背景信息

每次回复请理解用户的意图，选择合适的工具，用中文回复。如果用户闲聊或提问，直接回答，不需要调用工具。`;

export class AgentService {
  private textPort: ITextGenerationPort;
  constructor(textPort: ITextGenerationPort) { this.textPort = textPort; }

  async chat(messages: AgentMessage[]): Promise<string> {
    const systemMessages = [{ role: 'system' as const, content: SYSTEM_PROMPT }];

    const conversationMessages = messages.map(m => {
      if (m.role === 'tool') {
        return { role: 'user' as const, content: `[tool=${m.toolName}] ${m.content}` };
      }
      return { role: m.role as 'user' | 'assistant', content: m.content };
    });

    const result = await this.textPort.chatCompletion({
      model: 'MiniMax-M3',
      messages: [systemMessages[0], ...conversationMessages],
      maxTokens: 4096,
      temperature: 0.7,
    });

    return result.content;
  }

  async suggestActionPlan(userMessage: string): Promise<string[]> {
    const result = await this.textPort.chatCompletion({
      model: 'MiniMax-M3',
      messages: [
        { role: 'system', content: '你是任务规划助手。用户描述创作意图，输出逗号分隔的工具名列表。示例：输入：生成关于森林里小女孩的故事视频 输出：create_character,create_background,split_story_to_segments,suggest_bgm_style,generate_narration,generate_video' },
        { role: 'user', content: userMessage }
      ],
      maxTokens: 128,
      temperature: 0.3,
    });

    return result.content.trim().split(/[,，、\n]/).map(s => s.trim()).filter(Boolean);
  }
}
