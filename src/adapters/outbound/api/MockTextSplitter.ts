import type { ITextSplitterPort, SegmentDraft } from '../../../domain/ports/OutboundPorts';

export class MockTextSplitterAdapter implements ITextSplitterPort {
  async splitStoryToSegments(text: string, knownCharacterNames: string[]): Promise<SegmentDraft[]> {
    console.log('[MockTextSplitterAdapter] Splitting text:', text.substring(0, 50) + '...');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simple mock logic: split by newlines or sentences, and find characters
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');
    
    if (paragraphs.length === 0) return [];

    return paragraphs.map(p => {
      // Find which known characters are mentioned in this paragraph
      const mentioned = knownCharacterNames.filter(name => p.includes(name));
      
      return {
        content: p.trim(),
        mentionedCharacters: mentioned
      };
    });
  }
}
