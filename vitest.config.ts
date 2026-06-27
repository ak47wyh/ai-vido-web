import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/adapters/outbound/infrastructure/**/*.ts',
        'src/adapters/outbound/config/ApiConfigStoreAdapter.ts',
        'src/adapters/outbound/repositories/SnapshotRepositoryAdapter.ts',
        'src/adapters/outbound/repositories/TimelineRepositoryAdapter.ts',
        'src/adapters/outbound/repositories/ModelCacheAdapter.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});