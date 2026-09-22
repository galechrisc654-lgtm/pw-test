import { test as base } from '@playwright/test';
import { readEnvironment } from './assets';

export interface AiProdFixtures {
  environment: Record<string, unknown>;
}

export const test = base.extend<AiProdFixtures>({
  environment: async ({}, use) => {
    await use(readEnvironment());
  },
});

export { expect } from '@playwright/test';
