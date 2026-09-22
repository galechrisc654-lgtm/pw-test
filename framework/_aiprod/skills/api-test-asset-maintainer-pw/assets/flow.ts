import type { AssetMetadata, ApiContext } from '../../support/assets';

export const aiprod = { id: 'domain.flow-name', title: '业务状态准备流程' } satisfies AssetMetadata;

export type Stage = 'CREATED' | 'COMPLETED';
export interface FlowInput extends ApiContext { profileName?: string; targetStage: Stage; override?: Record<string, unknown>; }
export interface FlowResult { reachedStage: Stage; objects: Array<{ id: string }>; }

export async function prepare(input: FlowInput): Promise<FlowResult> {
  // 从同目录 profiles.json 选择纯数据基线，再为本次实例深拷贝并应用 override。
  const profile = structuredClone({ name: input.profileName ?? 'default' });
  void profile;
  // 按固定业务顺序调用 Action；每到一个阶段就核验状态并按 targetStage 返回。
  throw new Error('Implement the stable business flow before use.');
}
