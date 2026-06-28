/**
 * MemoryEventBusAdapter 单元测试
 *
 * 验证：
 * - emit/on 双向通信
 * - 类型安全的 payload
 * - onAny 接收所有事件
 * - unsubscribe 正确解除订阅
 * - handler 抛错不影响其他 handler
 */

import { describe, it, expect, vi } from 'vitest';
import { MemoryEventBusAdapter } from '../../adapters/outbound/infrastructure/MemoryEventBusAdapter';

describe('MemoryEventBusAdapter', () => {
  it('emits and receives typed events', () => {
    const bus = new MemoryEventBusAdapter();
    const handler = vi.fn();
    bus.on('platform.changed', handler);

    bus.emit('platform.changed', { from: 'minimax', to: 'kling' });
    expect(handler).toHaveBeenCalledWith({ from: 'minimax', to: 'kling' });
  });

  it('routes events to the correct handler by type', () => {
    const bus = new MemoryEventBusAdapter();
    const changeHandler = vi.fn();
    const deleteHandler = vi.fn();

    bus.on('platform.changed', changeHandler);
    bus.on('space.deleted', deleteHandler);

    bus.emit('platform.changed', { from: 'a', to: 'b' });
    expect(changeHandler).toHaveBeenCalledTimes(1);
    expect(deleteHandler).not.toHaveBeenCalled();

    bus.emit('space.deleted', { spaceId: 's1' });
    expect(deleteHandler).toHaveBeenCalledWith({ spaceId: 's1' });
  });

  it('returns an unsubscribe function that stops the listener', () => {
    const bus = new MemoryEventBusAdapter();
    const handler = vi.fn();
    const unsub = bus.on('video.task.completed', handler);

    bus.emit('video.task.completed', { taskId: 't1', videoUrl: 'v1' });
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    bus.emit('video.task.completed', { taskId: 't2', videoUrl: 'v2' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('onAny receives all event types', () => {
    const bus = new MemoryEventBusAdapter();
    const handler = vi.fn();
    bus.onAny(handler);

    bus.emit('platform.changed', { from: 'a', to: 'b' });
    bus.emit('video.task.failed', { taskId: 't', error: 'e' });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('isolates handler errors from other handlers', () => {
    const bus = new MemoryEventBusAdapter();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const goodHandler = vi.fn();

    bus.on('platform.changed', () => { throw new Error('boom'); });
    bus.on('platform.changed', goodHandler);

    bus.emit('platform.changed', { from: 'a', to: 'b' });
    expect(consoleSpy).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('handles multiple subscribers on the same event', () => {
    const bus = new MemoryEventBusAdapter();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('voice.cloned', h1);
    bus.on('voice.cloned', h2);

    bus.emit('voice.cloned', { voiceId: 'v1' });
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });
});