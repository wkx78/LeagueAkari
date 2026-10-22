import { IAkariShardInitDispose, Shard } from '@shared/akari-shard'
import {
  ZHANGMENG_MAIN_NAMESPACE,
  type ZhangmengProfileFields
} from '@shared/shards/zhangmeng'

import { AkariIpcMain } from '../ipc'

// 接收渲染进程拉到的资料，供自定义模板同步读取
@Shard(ZhangmengMain.id)
export class ZhangmengMain implements IAkariShardInitDispose {
  static id = ZHANGMENG_MAIN_NAMESPACE
  static dependencies = [AkariIpcMain.id]

  private _profiles: Record<string, ZhangmengProfileFields> = {}

  constructor(private readonly _ipc: AkariIpcMain) {}

  async onInit() {
    this._ipc.onCall(
      ZhangmengMain.id,
      'update',
      (_, profiles: Record<string, ZhangmengProfileFields>) => {
        this._profiles = { ...this._profiles, ...profiles }
      }
    )
  }

  async onDispose() {}

  // 供脚本同步读取，取不到返回空串
  getField(puuid: string, field: string): string {
    const profile = this._profiles[puuid]

    if (!profile) {
      return ''
    }

    const value = profile[field]
    return value === undefined || value === null ? '' : String(value)
  }
}