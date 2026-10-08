import config from './vitest.config';

export default {
  ...config,
  test: {
    ...config.test,
    include: ['src/services/sync/real-time-sync.integration.test.ts'],
    exclude: [],
  },
};
