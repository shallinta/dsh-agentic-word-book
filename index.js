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
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/* 插件包目录：assets 里的 logo、收款码，scripts 里的跨平台脚本都从这里取 */
const PKG_DIR = path.dirname(fileURLToPath(import.meta.url))
const ASSET_DIR = path.join(PKG_DIR, 'assets')
const SCRIPTS_DIR = path.join(PKG_DIR, 'scripts')

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
  '.woff2': 'font/woff2',
}

const WORKDIR_DEFAULT = path.join(homedir(), 'Documents', 'deepseek-harness', 'suiji-word-book')

const DEFAULT_SETTINGS = {
  title: '随记单词本',
  subtitle: '随手记一个词，看图、听音、拼一遍',
  groupBy: 'date',
  order: 'desc',
  rootDir: '~/Documents/dsh/suiji-word-book',
  workDir: '~/Documents/deepseek-harness/suiji-word-book',
  workTitle: '随记',
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

/* 展开 ~ / %VAR% / $VAR，再转绝对路径 */
function expandHome(text) {
  let out = String(text || '').trim()
  if (!out) return out
  if (out === '~') out = homedir()
  else if (out.startsWith('~/') || out.startsWith('~\\')) out = homedir() + out.slice(1)
  out = out.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, function (m, name) {
    const v = process.env[name]
    return v === undefined ? m : v
  })
  out = out.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, function (m, braced, plain) {
    const v = process.env[braced || plain]
    return v === undefined ? m : v
  })
  return out
}

/* 反方向：家目录内的路径存成 ~/...，让 settings.json 可跨机器 */
function tildePath(abs) {
  const full = path.resolve(String(abs || ''))
  const home = path.resolve(homedir())
  const rel = path.relative(home, full)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return full
  return '~/' + rel.split(path.sep).join('/')
}

/* 当前根目录的指针：settings.json 是跟着根目录走的，换目录后旧目录里的 settings.json
   仍然指向老路径，所以需要一个位置固定的指针来决定启动时用哪个根目录。 */
function rootPointerPath() {
  return path.join(homedir(), '.dsh', 'suiji-word-book.root.json')
}

function readRootPointer() {
  try {
    const raw = readJson(rootPointerPath(), null)
    const value = raw && typeof raw.rootDir === 'string' ? raw.rootDir.trim() : ''
    return value ? resolveRoot(value) : ''
  } catch {
    return ''
  }
}

function writeRootPointer(rootDir) {
  try {
    const file = rootPointerPath()
    mkdirSync(path.dirname(file), { recursive: true })
    writeJson(file, { rootDir: tildePath(rootDir), updatedAt: new Date().toISOString() })
  } catch {}
}

function resolveRoot(raw) {
  const text = expandHome(raw)
  if (!text) return path.resolve(expandHome(DEFAULT_SETTINGS.rootDir))
  return path.resolve(text)
}

/* 首次安装：默认根目录还没建过就直接建出来。
   判定依据是「没有根目录指针」且「默认目录里没有任何数据文件」——真·第一次打开。
   用户后来把目录删了、或者把根目录换到别处，指针还在，这里就不插手。 */
function ensureFirstRunRoot() {
  try {
    if (existsSync(rootPointerPath())) return
    const dir = resolveRoot(DEFAULT_SETTINGS.rootDir)
    const p = paths(dir)
    if (existsSync(p.settings) || existsSync(p.meta) || existsSync(p.words)) return
    mkdirSync(dir, { recursive: true })
    writeRootPointer(dir)
  } catch {}
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
  const stored = Object.assign({}, DEFAULT_SETTINGS, readJson(p.settings, {}))
  const settings = Object.assign({}, stored, {
    rootDir,
    workDir: resolveRoot(stored.workDir || DEFAULT_SETTINGS.workDir),
    /* 界面展示用的可移植写法 */
    rootDirLabel: tildePath(rootDir),
    workDirLabel: tildePath(resolveRoot(stored.workDir || DEFAULT_SETTINGS.workDir)),
    /* 目录不存在多半是换了电脑，提示用户重新选 */
    rootDirExists: existsSync(rootDir),
    workDirExists: existsSync(resolveRoot(stored.workDir || DEFAULT_SETTINGS.workDir)),
  })
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
  const merged = Object.assign({}, current.settings, patch.settings || {}, { rootDir })
  const toDisk = Object.assign({}, merged)
  /* 这些是运行时算出来的展示/状态字段，不该落盘 */
  delete toDisk.rootDirLabel
  delete toDisk.workDirLabel
  delete toDisk.rootDirExists
  delete toDisk.workDirExists
  toDisk.rootDir = tildePath(merged.rootDir)
  toDisk.workDir = tildePath(resolveRoot(merged.workDir || DEFAULT_SETTINGS.workDir))
  writeJson(p.settings, toDisk)
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
  const title = String((settings && settings.workTitle) || '').trim() || '随记'
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

function installSkill(rootDir) {
  const dir = skillDir()
  mkdirSync(path.join(dir, 'scripts'), { recursive: true })
  writeFileSync(path.join(dir, 'SKILL.md'), renderSkill(rootDir), 'utf8')
  writeFileSync(path.join(dir, 'add-word.md'), renderAddWord(rootDir), 'utf8')
  /* 跨平台脚本直接从包里复制（create-word.mjs / make-audio.mjs），
     不再内嵌 PowerShell，Windows 和 macOS 走同一套入口。 */
  const copied = []
  if (existsSync(SCRIPTS_DIR)) {
    for (const name of readdirSync(SCRIPTS_DIR)) {
      const from = path.join(SCRIPTS_DIR, name)
      try {
        if (!statSync(from).isFile()) continue
        copyFileSync(from, path.join(dir, 'scripts', name))
        copied.push(name)
      } catch {}
    }
  }
  /* 旧版本装出来的是 create-word.ps1，留着没用，顺手删掉 */
  try { rmSync(path.join(dir, 'scripts', 'create-word.ps1'), { force: true }) } catch {}
  return { dir, scripts: copied }
}

/* ---------------- 主入口 ---------------- */

export function apply(rootCtx) {
  /* webServer 在插件激活时可能还没就绪：用 inject 等它可用再注册路由。
     否则启动瞬间注册不到，面板会读不到数据、设定也存不进去。 */
  rootCtx.inject(['webServer'], function (ctx) {
    const webServer = ctx.get('webServer')
    if (!webServer || typeof webServer.register !== 'function') return

    /* 第一次装上插件就把默认目录准备好，别让人一进来先看到「目录不存在」 */
    ensureFirstRunRoot()

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

  /* 根目录判定顺序：指针文件 → 默认目录里的 settings.json → 内置默认 */
  const bootRoot = () => {
    const fromPointer = readRootPointer()
    if (fromPointer) return fromPointer
    const bootSettings = readJson(paths(resolveRoot(DEFAULT_SETTINGS.rootDir)).settings, {})
    return resolveRoot(bootSettings.rootDir || DEFAULT_SETTINGS.rootDir)
  }
  const currentRoot = () => loadState(bootRoot()).rootDir
  const stateOf = () => loadState(bootRoot())

  const disposers = []

  disposers.push(webServer.register({
    kind: 'exact',
    path: BASE + '/state',
    handler: async (req, res) => {
      if (!trusted(req, res)) return
      try {
        const state = stateOf()
        const words = readJson(paths(state.rootDir).words, [])
        sendJson(res, 200, { ok: true, state, words: Array.isArray(words) ? words : [],
          rootPointer: rootPointerPath(),
          defaultRoot: DEFAULT_SETTINGS.rootDir, skillDir: skillDir() })
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
          /* force：用户选了「不迁移」，直接把根目录切过去（目标里的数据原样保留） */
          if (occupied && !args.migrate && !args.force) {
            return sendJson(res, 200, { ok: true, needsMigration: true, target, state })
          }
          if (occupied && args.migrate) copyTree(state.rootDir, target)
          mkdirSync(target, { recursive: true })
          const next = saveState(target, { settings: Object.assign({}, state.settings, { rootDir: target }) })
          writeRootPointer(next.rootDir)
          return sendJson(res, 200, {
            ok: true,
            migrated: Boolean(occupied && args.migrate),
            state: next,
            /* 换了根目录必须把新目录的词库一起带回去，否则界面还是旧数据 */
            words: readJson(paths(next.rootDir).words, []),
          })
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
          const installed = installSkill(state.rootDir)
          const next = saveState(state.rootDir, { settings: Object.assign({}, state.settings, { skillInstalled: true }) })
          return sendJson(res, 200, { ok: true, skillDir: installed.dir, scripts: installed.scripts, state: next })
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
        if (op === 'open-url') {
          const url = String(args.url || '').trim()
          if (!/^https?:\/\/[^\s]+$/i.test(url)) {
            return sendJson(res, 200, { ok: false, error: 'bad url' })
          }
          try {
            const child = process.platform === 'win32'
              ? spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
              : process.platform === 'darwin'
                ? spawn('open', [url], { detached: true, stdio: 'ignore' })
                : spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
            if (child && typeof child.unref === 'function') child.unref()
            return sendJson(res, 200, { ok: true, url })
          } catch (err) {
            return sendJson(res, 200, { ok: false, error: String(err?.message ?? err) })
          }
        }

        if (op === 'install-notes') {
          const controller = ctx.get('sessionController')
          if (!controller || typeof controller.create !== 'function') {
            return sendJson(res, 200, { ok: false, error: 'session controller unavailable' })
          }
          const workDir = ensureWorkDir(state.settings)
          const signal = new AbortController().signal
          const ws = await ensureWorkspace(ctx, state.settings, workDir)
          const created = await controller.create(ws ? { workspaceId: ws.id } : { cwd: workDir })
          const message = '请询问用户是否安装「随记」插件，用户同意后，安装这个随记插件：@suiji-ai/dsh-agentic-notes。' +
            '如果用户希望了解随记插件，可以打开 github 地址：https://github.com/shallinta/dsh-agentic-notes'
          if (typeof controller.prompt === 'function') {
            await controller.prompt({
              requestId: 'suiji-notes-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
              sessionId: created.sessionId,
              mode: 'queue',
              content: [{ type: 'text', text: message }],
            }, signal)
          }
          return sendJson(res, 200, {
            ok: true,
            sessionId: created.sessionId,
            workspaceId: ws ? String(ws.id) : '',
            workDir,
          })
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

  /* 包里自带的静态资源：logo、插件图标、收款码。只认 assets/ 下的文件名，不出目录 */
  disposers.push(webServer.register({
    kind: 'exact',
    path: BASE + '/asset',
    handler: async (req, res) => {
      if (!trusted(req, res)) return
      try {
        const url = new URL(req.url, 'http://localhost')
        const raw = decodeURIComponent(url.searchParams.get('name') || '').replace(/\\/g, '/')
        if (!raw || raw.startsWith('/') || raw.split('/').indexOf('..') >= 0) {
          res.statusCode = 400
          return res.end()
        }
        const root = path.resolve(ASSET_DIR)
        const file = path.resolve(root, raw)
        if (file !== root && !file.startsWith(root + path.sep)) {
          res.statusCode = 400
          return res.end()
        }
        if (!existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404
          return res.end()
        }
        const ext = path.extname(file).toLowerCase()
        const type = IMG_TYPES[ext] || 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' })
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
