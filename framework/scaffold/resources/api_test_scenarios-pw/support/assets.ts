import type { APIRequestContext, Page } from '@playwright/test';

export type TestMode = 'api' | 'ui' | 'hybrid';
export interface ContractReference { service: string; operationId: string; fingerprint: string; requestProfile?: string; }
export interface AssetMetadata { id: string; title: string; contracts?: ContractReference[]; }
export interface TestMetadata { caseId: string; title: string; mode: TestMode; contracts?: ContractReference[]; }
export interface ApiContext { request: APIRequestContext; environment: Record<string, unknown>; }
export interface UiContext { page: Page; environment: Record<string, unknown>; }

export function readEnvironment(): Record<string, unknown> {
  return JSON.parse(process.env.AIPROD_PW_ENV_JSON ?? '{}') as Record<string, unknown>;
}
