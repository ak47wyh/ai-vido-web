import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { InpaintRegion } from '../../../domain/ports/WatermarkRemovalPorts';

export type SelectionMode = 'rect' | 'brush';

interface RegionSelectorProps {
  /** 图片/帧的显示宽度 */
  displayWidth: number;
  /** 图片/帧的显示高度 */
  displayHeight: number;
  /** 原始图片宽度（用于坐标换算） */
  naturalWidth: number;
  /** 原始图片高度 */
  naturalHeight: number;
  /** 当前选区列表 */
  regions: InpaintRegion[];
  /** 选区变化回调 */
  onRegionsChange: (regions: InpaintRegion[]) => void;
  /** 选区模式 */
  mode: SelectionMode;
  /** 画笔大小 */
  brushSize: number;
  /** 是否禁用交互 */
  disabled?: boolean;
  /** 显示的图片 URL */
  imageSrc?: string;
}

/**
 * 选区编辑器
 * 支持矩形框选和自由涂抹两种模式
 */
export const RegionSelector: React.FC<RegionSelectorProps> = ({
  displayWidth,
  displayHeight,
  naturalWidth,
  naturalHeight,
  regions,
  onRegionsChange,
  mode,
  brushSize,
  disabled = false,
  imageSrc,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  // 显示坐标 → 原始坐标 的缩放比
  const scaleX = naturalWidth / displayWidth;
  const scaleY = naturalHeight / displayHeight;

  /** 获取鼠标在 canvas 上的坐标 */
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  /** 绘制选区覆盖层 */
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制所有已确认的选区
    for (const region of regions) {
      // 将原始坐标转回显示坐标
      const dx = region.x / scaleX;
      const dy = region.y / scaleY;
      const dw = region.width / scaleX;
      const dh = region.height / scaleY;

      ctx.fillStyle = 'rgba(244, 114, 182, 0.3)';
      ctx.fillRect(dx, dy, dw, dh);

      ctx.strokeStyle = 'rgba(244, 114, 182, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(dx, dy, dw, dh);
    }

    // 绘制当前正在拖拽的矩形
    if (isDrawing && mode === 'rect') {
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const w = Math.abs(currentPos.x - startPos.x);
      const h = Math.abs(currentPos.y - startPos.y);

      ctx.fillStyle = 'rgba(129, 140, 248, 0.3)';
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = 'rgba(129, 140, 248, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [regions, isDrawing, startPos, currentPos, mode, scaleX, scaleY]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // 矩形框选模式
  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    if (mode === 'rect') {
      setIsDrawing(true);
      setStartPos(pos);
      setCurrentPos(pos);
    } else if (mode === 'brush') {
      // 涂抹模式：直接创建一个画笔大小的选区
      const region: InpaintRegion = {
        x: (pos.x - brushSize / 2) * scaleX,
        y: (pos.y - brushSize / 2) * scaleY,
        width: brushSize * scaleX,
        height: brushSize * scaleY,
      };
      onRegionsChange([...regions, region]);
      setIsDrawing(true);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || !isDrawing) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    setCurrentPos(pos);

    if (mode === 'brush') {
      // 涂抹模式：持续添加选区
      const region: InpaintRegion = {
        x: (pos.x - brushSize / 2) * scaleX,
        y: (pos.y - brushSize / 2) * scaleY,
        width: brushSize * scaleX,
        height: brushSize * scaleY,
      };
      onRegionsChange([...regions, region]);
    }
  };

  const handleEnd = () => {
    if (disabled || !isDrawing) return;
    if (mode === 'rect') {
      // 矩形模式：确认选区
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const w = Math.abs(currentPos.x - startPos.x);
      const h = Math.abs(currentPos.y - startPos.y);

      if (w > 5 && h > 5) {
        const region: InpaintRegion = {
          x: x * scaleX,
          y: y * scaleY,
          width: w * scaleX,
          height: h * scaleY,
        };
        onRegionsChange([...regions, region]);
      }
    }
    setIsDrawing(false);
  };

  return (
    <div style={{ position: 'relative', width: displayWidth, height: displayHeight }}>
      {imageSrc && (
        <img
          src={imageSrc}
          alt="preview"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: displayWidth,
            height: displayHeight,
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        width={displayWidth}
        height={displayHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: mode === 'rect' ? 'crosshair' : 'cell',
          touchAction: 'none',
        }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </div>
  );
};
