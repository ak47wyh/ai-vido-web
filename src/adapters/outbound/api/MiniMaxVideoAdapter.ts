import type { IVideoGeneratorPort, VideoPromptContext, VideoTaskResult } from '../../../domain/ports/OutboundPorts';
import { v4 as uuidv4 } from 'uuid';

/**
 * Adapter for MiniMax Video Generation API.
 * In a real scenario, you'd securely call your backend proxy which holds the API key,
 * or use the API key directly (not recommended for production).
 * Here we mock the actual network call to simulate the experience since we don't have a real API key.
 */
export class MiniMaxVideoAdapter implements IVideoGeneratorPort {
  
  async submitVideoTask(context: VideoPromptContext): Promise<string> {
    // 1. Build the prompt according to the best practice formula: 
    // "主体 + 动作 + 环境 + 镜头语言"
    let promptStr = '';
    
    // Add characters
    if (context.characters && context.characters.length > 0) {
      promptStr += context.characters.map(c => `${c.appearancePrompt}`).join('和') + '，';
    }

    // Add background
    if (context.background) {
      promptStr += `在${context.background.environmentPrompt}中，`;
    }

    // Add action
    promptStr += `${context.actionContent}。`;

    console.log('[MiniMaxVideoAdapter] Sending generation request with prompt:', promptStr);
    
    // Simulating API latency
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulating returned external task ID
    return `ext-minimax-${uuidv4()}`;
  }

  async queryTaskStatus(externalTaskId: string): Promise<VideoTaskResult> {
    console.log(`[MiniMaxVideoAdapter] Polling status for ${externalTaskId}...`);
    
    // Simulating API latency
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Randomly decide if it's done (simulate processing time)
    const isDone = Math.random() > 0.7; // 30% chance to finish per poll
    
    if (isDone) {
      return {
        status: 'SUCCESS',
        videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' // Mock video URL
      };
    }

    return { status: 'PROCESSING' };
  }
}
