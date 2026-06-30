import type {
  IImageInpaintPort,
  InpaintRegion,
  InpaintOptions,
  InpaintResult,
  ProgressCallback,
} from '../../../../domain/ports/WatermarkRemovalPorts';

/**
 * 基于 Canvas 2D API 的图片去水印适配器
 *
 * 三种算法：
 * - fast_fill: 选区边缘像素平均色填充（最快）
 * - edge_interpolation: 边缘像素向内插值渐变（推荐）
 * - texture_synthesis: 选区外纹理采样 + 泊松融合（质量最高）
 */
export class CanvasInpaintAdapter implements IImageInpaintPort {
  async inpaint(
    image: ImageBitmap | HTMLImageElement,
    regions: InpaintRegion[],
    options: InpaintOptions,
    onProgress?: ProgressCallback,
  ): Promise<InpaintResult> {
    const canvas = document.createElement('canvas');
    const width = 'width' in image ? image.width : (image as HTMLImageElement).naturalWidth;
    const height = 'height' in image ? image.height : (image as HTMLImageElement).naturalHeight;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image as CanvasImageSource, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      this.inpaintRegion(data, width, height, region, options.algorithm);
      onProgress?.((i + 1) / regions.length);
    }

    ctx.putImageData(imageData, 0, 0);

    const mimeType = `image/png`;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), mimeType, options.quality);
    });

    return { blob, width, height };
  }

  /**
   * 对单个区域执行 Inpaint
   */
  private inpaintRegion(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    region: InpaintRegion,
    algorithm: InpaintOptions['algorithm'],
  ): void {
    // 裁剪选区到图片范围内
    const x0 = Math.max(0, Math.floor(region.x));
    const y0 = Math.max(0, Math.floor(region.y));
    const x1 = Math.min(width, Math.floor(region.x + region.width));
    const y1 = Math.min(height, Math.floor(region.y + region.height));
    if (x1 <= x0 || y1 <= y0) return;

    if (algorithm === 'fast_fill') {
      this.fastFill(data, width, x0, y0, x1, y1);
    } else if (algorithm === 'edge_interpolation') {
      this.edgeInterpolation(data, width, x0, y0, x1, y1);
    } else if (algorithm === 'texture_synthesis') {
      this.textureSynthesis(data, width, x0, y0, x1, y1);
    } else if (algorithm === 'telea') {
      this.teleaMethod(data, width, height, x0, y0, x1, y1);
    } else if (algorithm === 'navier_stokes') {
      this.navierStokes(data, width, x0, y0, x1, y1);
    } else {
      this.contentAwareFill(data, width, height, x0, y0, x1, y1);
    }
  }

  /**
   * 快速填充：取选区四周边缘像素的平均色填充
   */
  private fastFill(
    data: Uint8ClampedArray,
    width: number,
    x0: number, y0: number, x1: number, y1: number,
  ): void {
    const edgePixels: number[][] = [];
    // 采样上下左右四条边的像素
    for (let x = x0; x < x1; x += 2) {
      if (y0 > 0) edgePixels.push(this.getPixel(data, width, x, y0 - 1));
      if (y1 < width) edgePixels.push(this.getPixel(data, width, x, y1));
    }
    for (let y = y0; y < y1; y += 2) {
      if (x0 > 0) edgePixels.push(this.getPixel(data, width, x0 - 1, y));
      if (x1 < width) edgePixels.push(this.getPixel(data, width, x1, y));
    }
    if (edgePixels.length === 0) return;

    const avg = this.averageColor(edgePixels);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        this.setPixel(data, width, x, y, avg);
      }
    }
  }

  /**
   * 边缘插值：从四条边向内渐变插值
   */
  private edgeInterpolation(
    data: Uint8ClampedArray,
    width: number,
    x0: number, y0: number, x1: number, y1: number,
  ): void {
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return;

    // 缓存四条边的像素行
    const topRow: number[][] = [];
    const bottomRow: number[][] = [];
    const leftCol: number[][] = [];
    const rightCol: number[][] = [];

    for (let x = x0; x < x1; x++) {
      topRow.push(this.getPixelSafe(data, width, x, y0 - 1));
      bottomRow.push(this.getPixelSafe(data, width, x, y1));
    }
    for (let y = y0; y < y1; y++) {
      leftCol.push(this.getPixelSafe(data, width, x0 - 1, y));
      rightCol.push(this.getPixelSafe(data, width, x1, y));
    }

    for (let y = y0; y < y1; y++) {
      const ty = (y - y0) / Math.max(1, h - 1); // 0..1 纵向比例
      for (let x = x0; x < x1; x++) {
        const tx = (x - x0) / Math.max(1, w - 1); // 0..1 横向比例
        const idx = (y * width + x) * 4;
        // 四角插值：top-left, top-right, bottom-left, bottom-right
        const tl = topRow[Math.min(topRow.length - 1, Math.floor(tx * topRow.length))];
        const tr = topRow[Math.min(topRow.length - 1, Math.ceil(tx * topRow.length))];
        const bl = bottomRow[Math.min(bottomRow.length - 1, Math.floor(tx * bottomRow.length))];
        const br = bottomRow[Math.min(bottomRow.length - 1, Math.ceil(tx * bottomRow.length))];

        // 双线性插值
        for (let c = 0; c < 3; c++) {
          const top = tl[c] * (1 - tx) + tr[c] * tx;
          const bottom = bl[c] * (1 - tx) + br[c] * tx;
          data[idx + c] = Math.round(top * (1 - ty) + bottom * ty);
        }
        data[idx + 3] = 255;
      }
    }
  }

  /**
   * 纹理合成：从选区外围采样像素，向内填充并加噪声
   */
  private textureSynthesis(
    data: Uint8ClampedArray,
    width: number,
    x0: number, y0: number, x1: number, y1: number,
  ): void {
    // 先做边缘插值作为基础
    this.edgeInterpolation(data, width, x0, y0, x1, y1);

    // 从外围采样纹理并叠加噪声，减少人工痕迹
    const sampleBand = 3; // 采样带宽度
    const noiseLevel = 8; // 噪声强度

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * width + x) * 4;
        // 从最近的外围像素采样
        const sx = x < x0 + sampleBand ? x0 - 1 - (x0 - x) :
                   x > x1 - sampleBand ? x1 + (x - x1 + 1) : x;
        const sy = y < y0 + sampleBand ? y0 - 1 - (y0 - y) :
                   y > y1 - sampleBand ? y1 + (y - y1 + 1) : y;
        const sIdx = (Math.max(0, Math.min(width - 1, sx)) + Math.max(0, sy) * width) * 4;

        for (let c = 0; c < 3; c++) {
          // 在外围像素基础上叠加随机噪声
          const noise = (Math.random() - 0.5) * noiseLevel * 2;
          data[idx + c] = Math.max(0, Math.min(255, data[idx + c] * 0.7 + data[sIdx + c] * 0.3 + noise));
        }
      }
    }
  }

  /**
   * Telea 快速行进法（Fast Marching Method）
   *
   * 思想：从已知区域边缘开始，按"距离场"由近及远逐步填充，
   * 每个未知像素由其 8 邻域已知像素按距离倒数加权平均得到。
   * 相比纯边缘插值，能更好保留局部纹理走向。
   *
   * 简化实现：以到选区边缘的距离为优先级，逐圈向内传播，
   * 使用 3×3 邻域加权平均（距离倒数权重）。
   */
  private teleaMethod(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    x0: number, y0: number, x1: number, y1: number,
  ): void {
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return;

    // 已知像素标记：1=已知，0=未知（待填充）
    const known = new Uint8Array(w * h);
    // 初始化：选区边界外侧 1 圈为已知
    for (let x = 0; x < w; x++) {
      if (y0 > 0) known[x] = 1;
      if (y1 < height) known[(h - 1) * w + x] = 1;
    }
    for (let y = 0; y < h; y++) {
      if (x0 > 0) known[y * w] = 1;
      if (x1 < width) known[y * w + (w - 1)] = 1;
    }

    // 待填充队列：按到边缘的曼哈顿距离升序处理
    // 使用简单的 BFS：每一轮处理当前最外层未知像素
    const total = w * h;
    let filled = 0;
    // 用一个简单的迭代：每轮扫描一次，处理所有至少有一个已知邻居的未知像素
    // 直到全部填充（最多 max(w,h) 轮）
    const maxRounds = Math.max(w, h);
    const nextKnown = new Uint8Array(w * h);

    for (let round = 0; round < maxRounds && filled < total; round++) {
      nextKnown.set(known);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          if (known[idx]) continue;

          // 检查 8 邻域是否有已知像素
          let hasKnown = false;
          for (let dy = -1; dy <= 1 && !hasKnown; dy++) {
            for (let dx = -1; dx <= 1 && !hasKnown; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              if (known[ny * w + nx]) hasKnown = true;
            }
          }
          if (!hasKnown) continue;

          // 对该像素做加权平均（距离倒数权重）
          let r = 0, g = 0, b = 0, weightSum = 0;
          const gx = x0 + x;
          const gy = y0 + y;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              if (!known[ny * w + nx]) continue;

              // 距离倒数权重（对角线距离更远，权重更低）
              const dist = Math.sqrt(dx * dx + dy * dy);
              const weight = 1 / dist;
              const sIdx = ((y0 + ny) * width + (x0 + nx)) * 4;
              r += data[sIdx] * weight;
              g += data[sIdx + 1] * weight;
              b += data[sIdx + 2] * weight;
              weightSum += weight;
            }
          }
          if (weightSum === 0) continue;

          const pIdx = (gy * width + gx) * 4;
          data[pIdx] = Math.round(r / weightSum);
          data[pIdx + 1] = Math.round(g / weightSum);
          data[pIdx + 2] = Math.round(b / weightSum);
          data[pIdx + 3] = 255;

          nextKnown[idx] = 1;
          filled++;
        }
      }
      known.set(nextKnown);
    }
  }

  /**
   * Navier-Stokes 流体动力学方法
   *
   * 思想：将像素强度视为流体，通过求解拉普拉斯方程让边缘信息
   * 沿等强度线（isophote）向内扩散，保持边缘连续性。
   *
   * 简化实现：使用高斯-塞德尔迭代求解 ∇²I = 0（拉普拉斯方程），
   * 边界条件为选区外侧像素固定。每个通道独立求解。
   */
  private navierStokes(
    data: Uint8ClampedArray,
    width: number,
    x0: number, y0: number, x1: number, y1: number,
  ): void {
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return;

    // 提取选区为独立缓冲区（含 1 像素边界），便于迭代
    const padW = w + 2;
    const padH = h + 2;
    // 每个通道一个 Float 数组（边界固定，内部迭代）
    const bufR = new Float32Array(padW * padH);
    const bufG = new Float32Array(padW * padH);
    const bufB = new Float32Array(padW * padH);
    const isBoundary = new Uint8Array(padW * padH);

    // 读取边界像素（选区外侧）+ 内部像素初值
    for (let y = 0; y < padH; y++) {
      for (let x = 0; x < padW; x++) {
        const sx = x0 - 1 + x;
        const sy = y0 - 1 + y;
        // 越界用最接近的边缘像素
        const cx = Math.max(0, Math.min(width - 1, sx));
        const cy = Math.max(0, sy);
        const sIdx = (cy * width + cx) * 4;
        const idx = y * padW + x;
        bufR[idx] = data[sIdx];
        bufG[idx] = data[sIdx + 1];
        bufB[idx] = data[sIdx + 2];
        // 标记边界（外圈）为固定值
        if (x === 0 || x === padW - 1 || y === 0 || y === padH - 1) {
          isBoundary[idx] = 1;
        }
      }
    }

    // 高斯-塞德尔迭代：拉普拉斯方程 ∇²I = 0
    // 离散化：I[i,j] = (I[i-1,j] + I[i+1,j] + I[i,j-1] + I[i,j+1]) / 4
    const iterations = 50; // 迭代次数（精度/性能权衡）
    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 1; y < padH - 1; y++) {
        for (let x = 1; x < padW - 1; x++) {
          const idx = y * padW + x;
          if (isBoundary[idx]) continue;
          const up = (y - 1) * padW + x;
          const down = (y + 1) * padW + x;
          const left = y * padW + (x - 1);
          const right = y * padW + (x + 1);
          bufR[idx] = (bufR[up] + bufR[down] + bufR[left] + bufR[right]) / 4;
          bufG[idx] = (bufG[up] + bufG[down] + bufG[left] + bufG[right]) / 4;
          bufB[idx] = (bufB[up] + bufB[down] + bufB[left] + bufB[right]) / 4;
        }
      }
    }

    // 写回主数据缓冲区，并叠加轻微噪声消除色块感
    const noiseLevel = 3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = (y + 1) * padW + (x + 1);
        const dstIdx = ((y0 + y) * width + (x0 + x)) * 4;
        const nr = (Math.random() - 0.5) * noiseLevel * 2;
        const ng = (Math.random() - 0.5) * noiseLevel * 2;
        const nb = (Math.random() - 0.5) * noiseLevel * 2;
        data[dstIdx] = Math.max(0, Math.min(255, Math.round(bufR[srcIdx] + nr)));
        data[dstIdx + 1] = Math.max(0, Math.min(255, Math.round(bufG[srcIdx] + ng)));
        data[dstIdx + 2] = Math.max(0, Math.min(255, Math.round(bufB[srcIdx] + nb)));
        data[dstIdx + 3] = 255;
      }
    }
  }

  /**
   * 内容感知填充（Content-Aware Fill）
   *
   * 思想：在图像其他区域搜索与选区边缘最相似的小块（patch），
   * 将其复制到选区中以保留纹理特征。
   *
   * 简化实现：Patch-Match 风格——
   * 1. 把选区切成 patch 大小的网格（默认 7×7）；
   * 2. 对每个 patch，在图像其他区域随机采样若干候选位置，
   *    选择与选区边缘衔接最好的（SSD 最小）的 patch 复制过来；
   * 3. 多次迭代传播优化（取邻域 patch 的最优偏移作为起点）。
   */
  private contentAwareFill(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    x0: number, y0: number, x1: number, y1: number,
  ): void {
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return;

    // 先做边缘插值作为初始猜测（避免完全空白）
    this.edgeInterpolation(data, width, x0, y0, x1, y1);

    const patchSize = 7;
    const halfPatch = Math.floor(patchSize / 2);
    const samples = 24; // 每个候选 patch 的随机采样数
    const iterations = 3; // 传播迭代次数

    // 候选搜索区域：图像中除选区外的部分（限制在选区周边 3 倍范围内以提高性能）
    const searchMargin = Math.max(w, h) * 2;
    const sx0 = Math.max(0, x0 - searchMargin);
    const sy0 = Math.max(0, y0 - searchMargin);
    const sx1 = Math.min(width, x1 + searchMargin);
    const sy1 = Math.min(height, y1 + searchMargin);
    const searchW = sx1 - sx0;
    const searchH = sy1 - sy0;
    if (searchW <= w + 10 || searchH <= h + 10) return; // 搜索区域过小，跳过

    // 对选区分块的 patch 起点
    const stepX = patchSize;
    const stepY = patchSize;
    // patch 偏移记录（每次迭代优化）
    let offsets: Array<{ ox: number; oy: number }> = [];

    const initOffsets = (): void => {
      offsets = [];
      for (let py = 0; py < h; py += stepY) {
        for (let px = 0; px < w; px += stepX) {
          // 随机初始化一个偏移：把 (x0+px, y0+py) 映射到搜索区域中的某点
          const ox = sx0 + halfPatch + Math.floor(Math.random() * Math.max(1, searchW - patchSize));
          const oy = sy0 + halfPatch + Math.floor(Math.random() * Math.max(1, searchH - patchSize));
          offsets.push({ ox, oy });
        }
      }
    };

    /** 计算 patch 与目标位置的匹配代价（SS over 边界交集区域） */
    const computeCost = (px: number, py: number, ox: number, oy: number): number => {
      // 在选区内 patch 与在源图 patch 的重叠像素仅限于"选区边缘外"的部分
      // 即 patch 中越靠近选区边界的像素越重要（边界连续性）
      let cost = 0;
      let count = 0;
      const startX = x0 + px;
      const startY = y0 + py;
      for (let dy = -halfPatch; dy <= halfPatch; dy++) {
        for (let dx = -halfPatch; dx <= halfPatch; dx++) {
          const tx = startX + dx;
          const ty = startY + dy;
          const sxp = ox + dx;
          const syp = oy + dy;
          if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
          if (sxp < 0 || sxp >= width || syp < 0 || syp >= height) continue;

          const targetIdx = (ty * width + tx) * 4;
          const sourceIdx = (syp * width + sxp) * 4;

          // 只在选区外（已知像素）的 patch 像素上累计误差
          const isInsideTarget = tx >= x0 && tx < x1 && ty >= y0 && ty < y1;
          const isInsideSource = sxp >= x0 && sxp < x1 && syp >= y0 && syp < y1;
          // 至少一方在选区外，才计入代价（保证边界衔接）
          if (isInsideTarget && isInsideSource) continue;

          for (let c = 0; c < 3; c++) {
            const diff = data[targetIdx + c] - data[sourceIdx + c];
            cost += diff * diff;
            count++;
          }
        }
      }
      return count === 0 ? Infinity : cost / count;
    };

    /** 把指定偏移的 patch 复制到目标位置 */
    const applyPatch = (px: number, py: number, ox: number, oy: number): void => {
      const startX = x0 + px;
      const startY = y0 + py;
      for (let dy = 0; dy < patchSize; dy++) {
        for (let dx = 0; dx < patchSize; dx++) {
          const tx = startX + dx;
          const ty = startY + dy;
          const sxp = ox + dx;
          const syp = oy + dy;
          if (tx < x0 || tx >= x1 || ty < y0 || ty >= y1) continue;
          if (sxp < 0 || sxp >= width || syp < 0 || syp >= height) continue;
          const targetIdx = (ty * width + tx) * 4;
          const sourceIdx = (syp * width + sxp) * 4;
          data[targetIdx] = data[sourceIdx];
          data[targetIdx + 1] = data[sourceIdx + 1];
          data[targetIdx + 2] = data[sourceIdx + 2];
          data[targetIdx + 3] = 255;
        }
      }
    };

    initOffsets();

    for (let iter = 0; iter < iterations; iter++) {
      let patchIdx = 0;
      for (let py = 0; py < h; py += stepY) {
        for (let px = 0; px < w; px += stepX) {
          let bestOff = offsets[patchIdx];
          let bestCost = computeCost(px, py, bestOff.ox, bestOff.oy);

          // 传播：尝试使用相邻 patch 的偏移
          if (px >= stepX) {
            const left = offsets[patchIdx - 1];
            const c = computeCost(px, py, left.ox + stepX, left.oy);
            if (c < bestCost) {
              bestCost = c;
              bestOff = { ox: left.ox + stepX, oy: left.oy };
            }
          }
          if (py >= stepY) {
            const top = offsets[patchIdx - Math.ceil(w / stepX)];
            const c = computeCost(px, py, top.ox, top.oy + stepY);
            if (c < bestCost) {
              bestCost = c;
              bestOff = { ox: top.ox, oy: top.oy + stepY };
            }
          }

          // 随机搜索：在当前最优偏移附近以指数衰减半径采样
          for (let s = 0; s < samples; s++) {
            const radius = Math.max(searchW, searchH) >> (s + 1);
            if (radius < 2) break;
            const dxr = Math.floor((Math.random() * 2 - 1) * radius);
            const dyr = Math.floor((Math.random() * 2 - 1) * radius);
            const nx = Math.max(sx0 + halfPatch, Math.min(sx1 - halfPatch - 1, bestOff.ox + dxr));
            const ny = Math.max(sy0 + halfPatch, Math.min(sy1 - halfPatch - 1, bestOff.oy + dyr));
            const c = computeCost(px, py, nx, ny);
            if (c < bestCost) {
              bestCost = c;
              bestOff = { ox: nx, oy: ny };
            }
          }

          offsets[patchIdx] = bestOff;
          applyPatch(px, py, bestOff.ox, bestOff.oy);
          patchIdx++;
        }
      }
    }
  }

  /** 获取像素 RGBA */
  private getPixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
    const idx = (y * width + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  }

  /** 安全获取像素（越界返回边缘像素） */
  private getPixelSafe(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
    x = Math.max(0, Math.min(width - 1, x));
    y = Math.max(0, y);
    const idx = (y * width + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  }

  /** 设置像素 RGBA */
  private setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, color: number[]): void {
    const idx = (y * width + x) * 4;
    data[idx] = color[0];
    data[idx + 1] = color[1];
    data[idx + 2] = color[2];
    data[idx + 3] = color[3];
  }

  /** 计算平均色 */
  private averageColor(pixels: number[][]): number[] {
    const sum = [0, 0, 0, 0];
    for (const p of pixels) {
      sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; sum[3] += p[3];
    }
    return [
      Math.round(sum[0] / pixels.length),
      Math.round(sum[1] / pixels.length),
      Math.round(sum[2] / pixels.length),
      255,
    ];
  }
}
