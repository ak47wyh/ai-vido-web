import type { IImageGeneratorPort, ImageGenerationContext } from '../ports/OutboundPorts';
import type { ICharacterRepository, IBackgroundRepository } from '../ports/OutboundPorts';

/**
 * 领域服务：图片生成
 * - 为角色生成形象图：基于 appearancePrompt + personalityPrompt，可选参考图（图生图）
 * - 为背景生成环境图：基于 environmentPrompt
 */
export class ImageGenerationService {
  imageGeneratorPort: IImageGeneratorPort;
  characterRepo: ICharacterRepository;
  backgroundRepo: IBackgroundRepository;

  constructor(
    imageGeneratorPort: IImageGeneratorPort,
    characterRepo: ICharacterRepository,
    backgroundRepo: IBackgroundRepository
  ) {
    this.imageGeneratorPort = imageGeneratorPort;
    this.characterRepo = characterRepo;
    this.backgroundRepo = backgroundRepo;
  }

  async generateCharacterImage(characterId: string, aspectRatio: string = '1:1'): Promise<string> {
    const character = await this.characterRepo.findById(characterId);
    if (!character) throw new Error('Character not found');

    const parts: string[] = [];
    if (character.appearancePrompt) parts.push(character.appearancePrompt);
    if (character.personalityPrompt) parts.push(character.personalityPrompt);
    if (parts.length === 0) {
      throw new Error('Character has no appearance or personality prompt to generate image from');
    }

    const context: ImageGenerationContext = {
      prompt: parts.join(', '),
      aspectRatio,
      subjectReferenceUrl: character.referenceImageUrl?.startsWith('http')
        ? character.referenceImageUrl
        : undefined,
    };

    const result = await this.imageGeneratorPort.generateImage(context);

    character.referenceImageUrl = result.imageDataUri;
    await this.characterRepo.save(character);

    return result.imageDataUri;
  }

  async generateBackgroundImage(backgroundId: string, aspectRatio: string = '16:9'): Promise<string> {
    const background = await this.backgroundRepo.findById(backgroundId);
    if (!background) throw new Error('Background not found');

    if (!background.environmentPrompt) {
      throw new Error('Background has no environment prompt to generate image from');
    }

    const context: ImageGenerationContext = {
      prompt: background.environmentPrompt,
      aspectRatio,
    };

    const result = await this.imageGeneratorPort.generateImage(context);

    background.referenceImageUrl = result.imageDataUri;
    await this.backgroundRepo.save(background);

    return result.imageDataUri;
  }
}
