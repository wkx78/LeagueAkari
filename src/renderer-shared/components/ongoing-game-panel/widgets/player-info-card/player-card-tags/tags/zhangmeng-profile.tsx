import { reactive } from 'vue'

import type { PlayerCardTagContext, PlayerCardTagDefinition } from '../types'

const TAG_CLASS = 'rounded-xs bg-black px-1 py-0.5 text-[11px] leading-[11px] text-white'

// 远程接口地址
const API_URL = 'http://43.143.187.222:8080/lol/zhangmeng/player-profiles'
//const API_URL = 'http://127.0.0.1:80/lol/zhangmeng/player-profiles'

// 取接口返回里的哪个字段做展示
const DISPLAY_FIELD = 'latestLocation'

const values = reactive(new Map<string, string>())
const inflight = new Set<string>()
const failed = new Set<string>()

interface PendingPlayer {
  puuid: string
  gameId: number
}

const pending = new Map<string, PendingPlayer>()
let timer: ReturnType<typeof setTimeout> | null = null

// 取该玩家最近一局的 gameId
function latestGameId(ctx: PlayerCardTagContext, puuid: string): number {
  const games = ctx.matchHistory?.[puuid]?.data ?? []

  let latest = 0
  for (const game of games) {
    if (game.gameId > latest) {
      latest = game.gameId
    }
  }

  return latest
}

function schedule(): void {
  if (timer !== null) {
    return
  }

  timer = setTimeout(() => {
    timer = null
    void flush()
  }, 80)
}

async function flush(): Promise<void> {
  const batch = Array.from(pending.values()).slice(0, 32)
  pending.clear()

  if (batch.length === 0) {
    return
  }

  for (const player of batch) {
    inflight.add(player.puuid)
  }

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        players: batch.map((p) => ({ puuid: p.puuid, gameId: p.gameId }))
      })
    })

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`)
    }

    const json = (await resp.json()) as {
      code?: number
      data?: Array<Record<string, unknown>>
    }

    for (const item of json.data ?? []) {
      const puuid = typeof item?.puuid === 'string' ? item.puuid : ''
      const value = item?.[DISPLAY_FIELD]

      if (!puuid) {
        continue
      }

      if (item?.ok && typeof value === 'string' && value) {
        values.set(puuid, value)
      } else {
        failed.add(puuid)
      }
    }
  } catch (error) {
    for (const player of batch) {
      failed.add(player.puuid)
    }

    console.warn('[zhangmeng] 查询失败：', error)
  } finally {
    for (const player of batch) {
      inflight.delete(player.puuid)
    }
  }
}

export const ZHANGMENG_PROFILE_TAG: PlayerCardTagDefinition = {
  id: 'zhangmeng-profile',
  render: (ctx) => {
    const value = values.get(ctx.puuid)

    if (value) {
      return {
        label: <div class={TAG_CLASS}>{ctx.masked(value)}</div>
      }
    }

    if (inflight.has(ctx.puuid) || pending.has(ctx.puuid) || failed.has(ctx.puuid)) {
      return null
    }

    const gameId = latestGameId(ctx, ctx.puuid)

    if (gameId <= 0) {
      return null
    }

    pending.set(ctx.puuid, { puuid: ctx.puuid, gameId })
    schedule()

    return null
  }
}
