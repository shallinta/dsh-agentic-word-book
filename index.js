/**
 * word-book 宿主半边：把单词本的设定 / 标签 / 自定义插图落到「单词本根目录」。
 *
 * 浏览器半边用同源 fetch 调这些路由（Node req/res 形态，见 registerWebRoute）。
 *
 * 目录结构（默认 ~/Documents/dsh/suiji-word-book/）：
 *   settings.json    首页设定（标题/副标题/分组/排序/根目录/是否显示 +单词）
 *   meta.json        标签选项 + 每词标签
 *   words.json       词条（art = 默认插图路径，customArt = 自定义插图路径）
 *   words/<slug>/    单个单词的全部资源：默认插图、custom-*.xxx 自定义插图、各段发音
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, copyFileSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { renderSkill, renderAddWord } from './skill-template.js'
import { homedir } from 'node:os'
import path from 'node:path'

const BASE = '/suiji-word-book'
const IMG_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.pjpeg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

const WORKDIR_DEFAULT = path.join(homedir(), 'Documents', 'deepseek-harness', 'suiji-word-book')

const DEFAULT_SETTINGS = {
  title: '随记单词本',
  subtitle: '点一个单词：看图片、听发音、读词组，再玩拼写游戏',
  groupBy: 'date',
  order: 'desc',
  rootDir: path.join(homedir(), 'Documents', 'dsh', 'suiji-word-book'),
  workDir: WORKDIR_DEFAULT,
  workTitle: '随记单词本',
  newSessionFullAccess: true,   // 用 +单词 新建的会话直接给完全权限
  showAddWord: false,
  skillInstalled: false,
}

function sendJson(res, code, value) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function readJson(file, fallback) {
  try {
    /* 文件可能被编辑器/脚本写成带 BOM 的 UTF-8，先剥掉 */
    const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    const value = JSON.parse(raw)
    return value && typeof value === 'object' ? value : fallback
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

function resolveRoot(raw) {
  const text = String(raw || '').trim()
  if (!text) return DEFAULT_SETTINGS.rootDir
  const expanded = text.startsWith('~') ? path.join(homedir(), text.slice(1)) : text
  return path.resolve(expanded)
}

function paths(rootDir) {
  return {
    settings: path.join(rootDir, 'settings.json'),
    meta: path.join(rootDir, 'meta.json'),
    words: path.join(rootDir, 'words.json'),
    art: path.join(rootDir, 'art'),
  }
}

function loadState(rootDir) {
  const p = paths(rootDir)
  const settings = Object.assign({}, DEFAULT_SETTINGS, readJson(p.settings, {}), { rootDir })
  const meta = readJson(p.meta, {})
  const tagList = Array.isArray(meta.tagList) ? meta.tagList.filter((t) => typeof t === 'string' && t.trim()) : []
  const tags = {}
  if (meta.tags && typeof meta.tags === 'object') {
    for (const slug of Object.keys(meta.tags)) {
      if (Array.isArray(meta.tags[slug])) tags[slug] = meta.tags[slug].filter((t) => typeof t === 'string' && t.trim())
    }
  }
  return { rootDir, settings, tagList, tags }
}

function saveState(rootDir, patch) {
  const p = paths(rootDir)
  mkdirSync(rootDir, { recursive: true })
  const current = loadState(rootDir)
  const settings = Object.assign({}, current.settings, patch.settings || {}, { rootDir })
  writeJson(p.settings, settings)
  writeJson(p.meta, {
    tagList: patch.tagList || current.tagList,
    tags: patch.tags || current.tags,
  })
  return loadState(rootDir)
}

/* 确保工作目录有一个带名字的 workspace；返回它（可能为 undefined） */
async function ensureWorkspace(ctx, settings, workDir) {
  const registry = ctx.get('workspaceRegistry')
  if (!registry || typeof registry.create !== 'function') return undefined
  const title = String((settings && settings.workTitle) || '').trim() || '随记单词本'
  let ws
  try {
    ws = await registry.create(workDir, title)
  } catch {
    return undefined
  }
  if (ws && ws.title !== title && typeof ws.setTitle === 'function') {
    try { await ws.setTitle(title) } catch {}
  }
  return ws
}
function ensureWorkDir(settings) {
  const raw = String((settings && settings.workDir) || '').trim() || WORKDIR_DEFAULT
  const dir = resolveRoot(raw)
  mkdirSync(dir, { recursive: true })
  return dir
}
function hasData(dir) {
  try {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return false
    return readdirSync(dir).some((n) => n === 'settings.json' || n === 'meta.json' || n === 'words.json')
  } catch {
    return false
  }
}

function copyTree(from, to) {
  if (!existsSync(from)) return
  mkdirSync(to, { recursive: true })
  for (const name of readdirSync(from)) {
    const src = path.join(from, name)
    const dst = path.join(to, name)
    if (statSync(src).isDirectory()) copyTree(src, dst)
    else copyFileSync(src, dst)
  }
}

function extOf(mime) {
  if (/jpe?g/i.test(mime)) return '.jpg'
  if (/png/i.test(mime)) return '.png'
  if (/webp/i.test(mime)) return '.webp'
  if (/svg/i.test(mime)) return '.svg'
  if (/gif/i.test(mime)) return '.gif'
  return '.png'
}

/* ---------------- 技能安装 ---------------- */

const SKILL_NAME = 'suiji-word-book'

function skillDir() {
  return path.join(homedir(), '.agents', 'skills', SKILL_NAME)
}

const CREATE_WORD_PS1 = `param(
  [Parameter(Mandatory = $true)][string]$Word,
  [string]$Root = ''
)
$ErrorActionPreference = 'Stop'
if (-not $Root) {
  $settingsPath = Join-Path $env:USERPROFILE 'Documents\\dsh\\suiji-word-book\\settings.json'
  if (Test-Path $settingsPath) { $Root = (Get-Content $settingsPath -Raw | ConvertFrom-Json).rootDir }
  if (-not $Root) { $Root = Join-Path $env:USERPROFILE 'Documents\\dsh\\suiji-word-book' }
}
$slug = $Word.Trim().ToLower()
if (-not $slug) { throw 'word is empty' }
foreach ($d in @($Root, (Join-Path $Root 'words'), (Join-Path $Root "words\$slug"))) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}
$entry = [ordered]@{
  slug = $slug
  word = $slug
  created = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')
  ipa = '/?/'
  pos = 'n.'
  zh = '待填写'
  en = '待填写'
  art = "words/$slug/$slug.svg"
  customArt = ""
  phrases = @(
    [ordered]@{ en = "$slug one"; zh = '待填写' },
    [ordered]@{ en = "$slug two"; zh = '待填写' },
    [ordered]@{ en = "$slug three"; zh = '待填写' },
    [ordered]@{ en = "$slug four"; zh = '待填写' },
    [ordered]@{ en = "$slug five"; zh = '待填写' }
  )
  sentence = [ordered]@{ en = "This is $slug."; zh = '待填写' }
}
$out = Join-Path $Root 'words.new.json'
Set-Content -Path $out -Value (ConvertTo-Json -InputObject @($entry) -Depth 8) -Encoding UTF8
Write-Output "wrote $out"
`

function installSkill(rootDir) {
  const dir = skillDir()
  mkdirSync(path.join(dir, 'scripts'), { recursive: true })
  writeFileSync(path.join(dir, 'SKILL.md'), renderSkill(rootDir), 'utf8')
  writeFileSync(path.join(dir, 'add-word.md'), renderAddWord(rootDir), 'utf8')
  writeFileSync(path.join(dir, 'scripts', 'create-word.ps1'), CREATE_WORD_PS1, 'utf8')
  return dir
}

/* ---------------- 主入口 ---------------- */

export function apply(rootCtx) {
  /* webServer 在插件激活时可能还没就绪：用 inject 等它可用再注册路由。
     否则启动瞬间注册不到，面板会读不到数据、设定也存不进去。 */
  rootCtx.inject(['webServer'], function (ctx) {
    const webServer = ctx.get('webServer')
    if (!webServer || typeof webServer.register !== 'function') return

  const trusted = (req, res) => {
    try {
      const conn = ctx.get('connection')
      if (!conn || typeof conn.requestRejection !== 'function') return true
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return true
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return false
    } catch {
      return true
    }
  }

  const currentRoot = () => loadState(resolveRoot(readJson(paths(DEFAULT_SETTINGS.rootDir).settings, {}).rootDir)).rootDir
  const stateOf = () => {
    const bootSettings = readJson(paths(DEFAULT_SETTINGS.rootDir).settings, {})
    const rootDir = resolveRoot(bootSettings.rootDir)
    return loadState(rootDir)
  }

  const disposers = []

  disposers.push(webServer.register({
    kind: 'exact',
    path: BASE + '/state',
    handler: async (req, res) => {
      if (!trusted(req, res)) return
      try {
        const state = stateOf()
        const words = readJson(paths(state.rootDir).words, [])
        sendJson(res, 200, { ok: true, state, words: Array.isArray(words) ? words : [], defaultRoot: DEFAULT_SETTINGS.rootDir, skillDir: skillDir() })
      } catch (err) {
        sendJson(res, 200, { ok: false, error: String(err?.message ?? err) })
      }
    },
  }))

  disposers.push(webServer.register({
    kind: 'exact',
    path: BASE + '/api',
    handler: async (req, res) => {
      if (!trusted(req, res)) return
      try {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' })
        const body = JSON.parse((await readBody(req)) || '{}')
        const op = String(body.op || '')
        const args = body.args && typeof body.args === 'object' ? body.args : {}
        const state = stateOf()

        if (op === 'save') {
          const next = saveState(state.rootDir, {
            settings: args.settings,
            tagList: Array.isArray(args.tagList) ? args.tagList : undefined,
            tags: args.tags,
          })
          return sendJson(res, 200, { ok: true, state: next })
        }

        if (op === 'root') {
          const target = resolveRoot(args.rootDir)
          const occupied = target !== state.rootDir && hasData(target)
          if (occupied && !args.migrate) {
            return sendJson(res, 200, { ok: true, needsMigration: true, target, state })
          }
          if (occupied && args.migrate) copyTree(state.rootDir, target)
          mkdirSync(target, { recursive: true })
          const next = saveState(target, { settings: Object.assign({}, state.settings, { rootDir: target }) })
          return sendJson(res, 200, { ok: true, migrated: Boolean(occupied && args.migrate), state: next })
        }

        if (op === 'art') {
          const slug = String(args.slug || '').trim().toLowerCase()
          const m = /^data:([^;,]+);base64,(.+)$/.exec(String(args.dataUrl || ''))
          if (!slug || !m) return sendJson(res, 200, { ok: false, error: 'bad request' })
          const wordsFile = paths(state.rootDir).words
          const list = readJson(wordsFile, [])
          const target = list.find(function (w) { return w.slug === slug })
          if (!target) return sendJson(res, 200, { ok: false, error: 'unknown word' })
          const dir = path.join(state.rootDir, 'words', slug)
          mkdirSync(dir, { recursive: true })
          for (const old of readdirSync(dir)) {
            if (old.indexOf('custom-') === 0) {
              try { rmSync(path.join(dir, old), { force: true }) } catch {}
            }
          }
          const ext = extOf(m[1]).slice(1)
          const file = 'custom-' + Date.now().toString(36) + '.' + ext
          writeFileSync(path.join(dir, file), Buffer.from(m[2], 'base64'))
          target.customArt = 'words/' + slug + '/' + file
          writeJson(wordsFile, list)
          return sendJson(res, 200, { ok: true, file: target.customArt, words: list })
        }

        if (op === 'art-clear') {
          const slug = String(args.slug || '').trim().toLowerCase()
          const wordsFile = paths(state.rootDir).words
          const list = readJson(wordsFile, [])
          const target = list.find(function (w) { return w.slug === slug })
          if (!target) return sendJson(res, 200, { ok: false, error: 'unknown word' })
          if (target.customArt) {
            try { rmSync(path.join(state.rootDir, target.customArt), { force: true }) } catch {}
          }
          target.customArt = ''
          writeJson(wordsFile, list)
          return sendJson(res, 200, { ok: true, words: list })
        }

        if (op === 'install-skill') {
          const dir = installSkill(state.rootDir)
          const next = saveState(state.rootDir, { settings: Object.assign({}, state.settings, { skillInstalled: true }) })
          return sendJson(res, 200, { ok: true, skillDir: dir, state: next })
        }

        if (op === 'pick-folder') {
          const picker = ctx.get('directoryPicker')
          if (!picker || typeof picker.capability !== 'function') {
            return sendJson(res, 200, { ok: false, error: '系统目录选择器不可用' })
          }
          const cap = picker.capability()
          if (!cap || cap.kind !== 'native' || typeof cap.pick !== 'function') {
            return sendJson(res, 200, { ok: false, error: '当前平台不支持原生目录选择' })
          }
          const chosen = await cap.pick(new AbortController().signal)
          return sendJson(res, 200, { ok: true, path: chosen || '' })
        }

        if (op === 'open-folder') {
          const target = resolveRoot(args.path || state.settings.rootDir)
          mkdirSync(target, { recursive: true })
          try {
            const child = process.platform === 'win32'
              ? spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' })
              : process.platform === 'darwin'
                ? spawn('open', [target], { detached: true, stdio: 'ignore' })
                : spawn('xdg-open', [target], { detached: true, stdio: 'ignore' })
            if (child && typeof child.unref === 'function') child.unref()
            return sendJson(res, 200, { ok: true, path: target })
          } catch (err) {
            return sendJson(res, 200, { ok: false, error: String(err?.message ?? err) })
          }
        }
        if (op === 'add-words') {
          const words = (Array.isArray(args.words) ? args.words : [])
            .map((w) => String(w || '').trim().toLowerCase())
            .filter((w) => /^[a-z][a-z'-]*$/.test(w))
          if (!words.length) return sendJson(res, 200, { ok: false, error: 'no valid words' })
          const controller = ctx.get('sessionController')
          if (!controller || typeof controller.create !== 'function') {
            return sendJson(res, 200, { ok: false, error: 'session controller unavailable' })
          }
          const workDir = ensureWorkDir(state.settings)
          const signal = new AbortController().signal
          const ws = await ensureWorkspace(ctx, state.settings, workDir)
          const created = await controller.create(ws ? { workspaceId: ws.id } : { cwd: workDir })
          const message = '请使用 /suiji-word-book 技能，为单词本新增这些单词卡：' + words.join('、') +
            '。单词本根目录是 ' + state.rootDir + '。每张卡要有音标、词性、中文释义、英文释义、5 条词组、1 条例句和一张 320x240 插图，并生成发音。'
          /* 新会话默认工作在 workspace-write，写 words.json / 音频会被逐次审批；
             这里直接切到完全权限（可用 settings.newSessionFullAccess=false 关掉） */
          let presetApplied = ''
          try {
            const perm = ctx.get('permissionPresets')
            if (perm && state.settings.newSessionFullAccess !== false && typeof perm.set === 'function') {
              const resolved = typeof controller.resolveAgent === 'function'
                ? await controller.resolveAgent(created.sessionId)
                : null
              const session = resolved && resolved.agent && resolved.agent.session
              const options = perm.catalog ? (perm.catalog().options || []) : []
              const full = options.some(function (o) { return o && o.value === 'danger-full-access' })
              if (session && full) {
                perm.set(session, 'danger-full-access')
                presetApplied = 'danger-full-access'
              }
            }
          } catch (e) {}

          if (typeof controller.prompt === 'function') {
            await controller.prompt({
              requestId: 'suiji-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
              sessionId: created.sessionId,
              mode: 'queue',
              content: [{ type: 'text', text: message }],
            }, signal)
          }
          return sendJson(res, 200, { ok: true, sessionId: created.sessionId, workspaceId: ws ? String(ws.id) : '', workDir, presetApplied, words })
        }
        return sendJson(res, 200, { ok: false, error: 'unknown op: ' + op })
      } catch (err) {
        sendJson(res, 200, { ok: false, error: String(err?.message ?? err) })
      }
    },
  }))

  disposers.push(webServer.register({
    kind: 'exact',
    path: BASE + '/file',
    handler: async (req, res) => {
      if (!trusted(req, res)) return
      try {
        const state = stateOf()
        const url = new URL(req.url, 'http://localhost')
        const name = decodeURIComponent(url.searchParams.get('name') || '')
        if (!name || name.includes('..') || name.includes('\\')) {
          res.statusCode = 400
          return res.end()
        }
        const file = path.join(state.rootDir, name)
        if (!existsSync(file)) {
          res.statusCode = 404
          return res.end()
        }
        const ext = path.extname(name).toLowerCase()
        const type = IMG_TYPES[ext] || (ext === '.wav' ? 'audio/wav' : 'application/octet-stream')
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=60' })
        res.end(readFileSync(file))
      } catch {
        res.statusCode = 404
        res.end()
      }
    },
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { if (typeof dispose === 'function') dispose() } catch {}
    }
  })
  })
}
