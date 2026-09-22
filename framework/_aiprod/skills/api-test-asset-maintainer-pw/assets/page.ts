import type { Locator, Page } from '@playwright/test';
import type { AssetMetadata } from '../../support/assets';

export const aiprod = { id: 'domain.page-name', title: '页面名称' } satisfies AssetMetadata;

export class BusinessPage {
  readonly submit: Locator;
  constructor(readonly page: Page) { this.submit = page.getByRole('button', { name: '提交' }); }
  async open(): Promise<void> { await this.page.goto('/replace-with-route'); }
}
