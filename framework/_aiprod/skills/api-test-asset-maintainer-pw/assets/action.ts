import { expect, type APIRequestContext } from '@playwright/test';
import type { AssetMetadata } from '../../support/assets';

export const aiprod = {
  id: 'domain.action-name',
  title: '业务动作名称',
  contracts: [{ service: 'service-id', operationId: 'operationId', fingerprint: 'replace-with-current-fingerprint' }],
} satisfies AssetMetadata;

export interface ActionInput { request: APIRequestContext; }
export interface ActionResult { id: string; }

export async function run(input: ActionInput): Promise<ActionResult> {
  const response = await input.request.post('/replace-with-operation');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as { code: number; data: { id: string | number } };
  expect(body.code).toBe(0);
  return { id: String(body.data.id) };
}
