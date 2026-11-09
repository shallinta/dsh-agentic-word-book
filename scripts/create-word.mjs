#!/usr/bin/env node
/**
 * 为「随记单词本」创建一个占位单词卡：目录、占位插图、words.json 词条。
 *
 * 用法：
 *   node scripts/create-word.mjs --root "<单词本根目录>" --word "<单词>" [--force]
 *
 * 说明：
 *   - 只依赖 Node 内置模块，macOS / Windows / Linux 通用。
 *   - slug 取单词小写，必须匹配 /^[a-z][a-z'-]*$/，也是资源目录名。
 *   - 生成 words/<slug>/<slug>.svg（320×240 扁平风占位图，临时用），
 *     并向 words.json 追加占位词条（字段与插件一致）。
 *   - 真正的插图要在 add-word.md 第 3 步画好后替换默认插图：
 *     覆盖 words/<slug>/<slug>.svg，或存成 words/<slug>/<slug>.<ext> 并改 art；
 *     新词卡的 customArt 始终保持空串。
 *   - slug 已存在（目录或词条）时，没有 --force 会拒绝执行；
 *     带 --force 会重画占位图，并只补空缺字段，不覆盖已填写的内容。
 *   - words.json 解析失败时报错退出，绝不覆盖原文件；写入保持 2 空格缩进、
 *     末尾换行，原文件有 BOM 就保留 BOM。
 *   - 退出码：成功 0，参数错误/已存在/解析失败 1。
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

const USAGE = '用法：node scripts/create-word.mjs --root "<单词本根目录>" --word "<单词>" [--force]'
const SLUG_RE = /^[a-z][a-z'-]*$/
const PALETTE = ['#FF8A5B', '#8FD4FF', '#FFD166', '#6FB84F']

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

/* ---------- 参数 ---------- */

function parseArgs(argv) {
  const out = { root: '', word: '', force: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const eq = arg.indexOf('=')
    const key = arg.startsWith('--') && eq > 2 ? arg.slice(0, eq) : arg
    const inline = arg.startsWith('--') && eq > 2 ? arg.slice(eq + 1) : null
    const value = () => {
      if (inline !== null) return inline
      const next = argv[++i]
      if (next === undefined) fail(`${key} 缺少参数值\n${USAGE}`)
      return next
    }
    switch (key) {
      case '--root': out.root = value(); break
      case '--word': out.word = value(); break
      case '--force': out.force = true; break
      case '-h':
      case '--help': out.help = true; break
      default: fail(`未知参数：${arg}\n${USAGE}`)
    }
  }
  return out
}

/* ---------- 路径与时间 ---------- */

/* 展开开头的 ~，再转绝对路径；所有路径都用 node:path 处理 */
function resolveRoot(input) {
  let root = String(input || '').trim()
  if (!root) fail(`缺少 --root\n${USAGE}`)
  if (root === '~') root = homedir()
  else if (root.startsWith('~/') || root.startsWith('~\\')) root = path.join(homedir(), root.slice(2))
  root = expandEnv(root)
  return path.resolve(root)
}

/* 环境变量展开：%VAR%（Windows 习惯）和 ${VAR} / $VAR（shell 习惯）都认，
   和宿主 index.js 里的 expandHome 保持一致 */
function expandEnv(text) {
  return String(text || '')
    .replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (m, name) => (process.env[name] === undefined ? m : process.env[name]))
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (m, braced, plain) => {
      const value = process.env[braced || plain]
      return value === undefined ? m : value
    })
}


/* 本地时间，格式与插件里 created 字段一致：2026-11-08T14:31:00 */
function localStamp(date = new Date()) {
  const padded = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${padded(date.getMonth() + 1)}-${padded(date.getDate())}` +
    `T${padded(date.getHours())}:${padded(date.getMinutes())}:${padded(date.getSeconds())}`
  )
}

/* ---------- words.json ---------- */

function readWords(file) {
  if (!existsSync(file)) return { list: [], hadBom: false }
  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch (err) {
    fail(`读取 words.json 失败，未做任何修改：${file}\n${err.message}`)
  }
  const hadBom = raw.startsWith('\uFEFF')
  const text = hadBom ? raw.slice(1) : raw
  if (!text.trim()) return { list: [], hadBom }
  let value
  try {
    value = JSON.parse(text)
  } catch (err) {
    fail(`words.json 解析失败，未做任何修改：${file}\n${err.message}`)
  }
  if (!Array.isArray(value)) fail(`words.json 顶层不是数组，未做任何修改：${file}`)
  return { list: value, hadBom }
}

function writeWords(file, list, hadBom) {
  const body = JSON.stringify(list, null, 2) + '\n'
  try {
    writeFileSync(file, (hadBom ? '\uFEFF' : '') + body, 'utf8')
  } catch (err) {
    fail(`写入 words.json 失败：${file}\n${err.message}`)
  }
}

/* ---------- 占位插图 ---------- */

/* 320×240 扁平风：底色 + 太阳 + 丘陵 + 大字母，配色固定为插件主题色 */
function buildSvg(slug) {
  const letter = slug[0] ? slug[0].toUpperCase() : 'A'
  const variant = slug.charCodeAt(0) % 3
  const [orange, blue, yellow, green] = PALETTE
  const sunX = [250, 68, 244][variant]
  const sunY = [64, 58, 70][variant]
  const hillShift = [0, 22, -18][variant]
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240" role="img" aria-label="${letter}">
  <rect width="320" height="240" rx="18" fill="#FFF6EE"/>
  <circle cx="${sunX}" cy="${sunY}" r="30" fill="${yellow}"/>
  <circle cx="${sunX + 34}" cy="${sunY + 6}" r="9" fill="${orange}" opacity="0.85"/>
  <path d="M0 196 Q 80 ${150 + hillShift} 160 190 T 320 186 L320 240 L0 240 Z" fill="${blue}"/>
  <path d="M0 218 Q 100 ${186 + hillShift} 200 214 T 320 210 L320 240 L0 240 Z" fill="${green}"/>
  <rect x="36" y="38" width="132" height="132" rx="26" fill="#FFFFFF" opacity="0.92"/>
  <text x="102" y="140" text-anchor="middle" font-family="'Arial Rounded MT Bold','Segoe UI','PingFang SC',sans-serif" font-size="92" font-weight="700" fill="${orange}">${letter}</text>
  <circle cx="256" cy="190" r="10" fill="${yellow}"/>
  <circle cx="282" cy="164" r="6" fill="${orange}"/>
</svg>
`
}

/* ---------- 占位词条 ---------- */

function placeholderEntry(slug) {
  const dir = `words/${slug}`
  return {
    slug,
    word: slug,
    created: localStamp(),
    ipa: '/?/',
    pos: 'n.',
    zh: '待填写',
    en: '待填写',
    art: `${dir}/${slug}.svg`,
    customArt: '',
    artAlt: '待填写',
    wordAudio: '',
    phrases: [1, 2, 3, 4, 5].map((n) => ({ en: `${slug} ${n}`, zh: '待填写', audio: '' })),
    sentence: { en: `This is ${slug}.`, zh: '待填写', audio: '' }
  }
}

const isBlank = (v) => v === undefined || v === null || v === '' || (typeof v === 'string' && !v.trim())

/* 只补空缺字段，已有内容原样保留 */
function fillBlank(target, defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    if (key === 'slug' || key === 'word') continue
    const current = target[key]
    if (key === 'phrases') {
      const list = Array.isArray(current) ? current : []
      while (list.length < 5) list.push({ en: '', zh: '', audio: '' })
      list.forEach((phrase, i) => {
        if (!phrase || typeof phrase !== 'object') list[i] = defaults.phrases[i]
        else {
          for (const field of ['en', 'zh', 'audio']) {
            if (isBlank(list[i][field])) list[i][field] = defaults.phrases[i][field]
          }
        }
      })
      target.phrases = list
      continue
    }
    if (key === 'sentence') {
      if (!current || typeof current !== 'object') target.sentence = defaults.sentence
      else {
        for (const field of ['en', 'zh', 'audio']) {
          if (isBlank(current[field])) current[field] = defaults.sentence[field]
        }
      }
      continue
    }
    if (isBlank(current)) target[key] = value
  }
  return target
}

/* ---------- 主流程 ---------- */

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(USAGE)
    return
  }

  const root = resolveRoot(args.root)
  const word = String(args.word || '').trim()
  if (!word) fail(`缺少 --word\n${USAGE}`)

  const slug = word.toLowerCase()
  if (!SLUG_RE.test(slug)) {
    fail(
      `单词不合法：${JSON.stringify(word)}\n` +
        `slug 只能是小写英文字母开头，后接小写字母、连字符或撇号（如 apple、ice-cream、o'clock）。`
    )
  }

  const wordsFile = path.join(root, 'words.json')
  const wordsDir = path.join(root, 'words')
  const wordDir = path.join(wordsDir, slug)
  const svgFile = path.join(wordDir, `${slug}.svg`)

  const { list, hadBom } = readWords(wordsFile)
  const existingIndex = list.findIndex((entry) => entry && entry.slug === slug)
  const exists = existingIndex >= 0 || existsSync(wordDir)
  if (exists && !args.force) {
    fail(
      `词条已存在：${slug}\n` +
        `  ${existingIndex >= 0 ? `words.json 中已有该词条；` : ''}${existsSync(wordDir) ? `目录已存在：${wordDir}；` : ''}\n` +
        `  确认要重建占位内容，请加 --force。`
    )
  }

  mkdirSync(wordDir, { recursive: true })
  const svg = buildSvg(slug)
  try {
    writeFileSync(svgFile, svg, 'utf8')
  } catch (err) {
    fail(`写入占位插图失败：${svgFile}\n${err.message}`)
  }

  const placeholder = placeholderEntry(slug)
  let action
  let index
  if (existingIndex >= 0) {
    fillBlank(list[existingIndex], placeholder)
    index = existingIndex
    action = '更新'
  } else {
    list.push(placeholder)
    index = list.length - 1
    action = '新建'
  }
  writeWords(wordsFile, list, hadBom)

  const svgExists = existsSync(svgFile) && statSync(svgFile).size > 0
  console.log(`✅ 已${action}占位词条：${slug}`)
  console.log(`   根目录：${root}`)
  console.log(`   资源目录：${wordDir}`)
  console.log(`   占位插图：words/${slug}/${slug}.svg（320×240，${svgExists ? '已写入' : '写入校验失败'}）`)
  console.log(`   词条位置：words.json 第 ${index + 1} 条${action === '更新' ? '（已填写的内容保持不变）' : ''}`)
  console.log(`   下一步：填 ipa / pos / zh / en / artAlt / 5 条 phrases / sentence，`)
  console.log(`           再画真正的插图替换占位图（覆盖 words/${slug}/${slug}.svg，或改 art 指向新文件），`)
  console.log(`           然后运行 scripts/make-audio.mjs 生成发音。`)
  if (!svgExists) fail(`占位插图写入失败：${svgFile}`)
}

main()
