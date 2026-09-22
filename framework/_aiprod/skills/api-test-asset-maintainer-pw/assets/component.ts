import type { Locator } from '@playwright/test';
import type { AssetMetadata } from '../../support/assets';

export const aiprod = { id: 'domain.component-name', title: '组件名称' } satisfies AssetMetadata;

export class BusinessComponent {
  readonly submit: Locator;
  constructor(readonly root: Locator) { this.submit = root.getByRole('button', { name: '提交' }); }
}
