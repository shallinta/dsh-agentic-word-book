#!/usr/bin/env node
/**
 * 为「随记单词本」生成单词卡的 7 段发音，并把相对路径写回 words.json。
 *
 * 用法：
 *   node scripts/make-audio.mjs --root "<单词本根目录>" --slug <slug> [--voice <声音名>]
 *   node scripts/make-audio.mjs --root "<单词本根目录>" --all [--voice <声音名>]
 *
 * 说明：
 *   - 只依赖 Node 内置模块，以及各平台自带的语音合成工具，按系统自动选择：
 *       macOS  ：say + afconvert，输出 11025 Hz 单声道 WAV；默认声音 Samantha。
 *       Windows：powershell + System.Speech，SpeechAudioFormatInfo(11025, 16bit, Mono)。
 *       Linux  ：espeak-ng，输出采样率不保证 11025 Hz，生成后会提示自行确认。
 *   - 每个词条生成 word.wav、p1.wav–p5.wav、sentence.wav 共 7 个文件，
 *     放在 words/<slug>/ 下，路径按 words/<slug>/xxx.wav 写回词条。
 *   - 每段都检查文件存在且大于 0 字节；任何一段失败立刻退出码 1，并说明是哪一段。
 *   - 文本一律通过参数数组传给子进程，不拼 shell；Windows 的文本写进临时 .ps1，
 *     只把文件路径交给 -Command。words.json 写入保持 2 空格缩进 + 末尾换行，
 *     原文件有 BOM 就保留 BOM。
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const USAGE =
  '用法：node scripts/make-audio.mjs --root "<单词本根目录>" (--slug <slug> | --all) [--voice <声音名>]'
const MAC_DEFAULT_VOICE = 'Samantha'
const SLUG_RE = /^[a-z][a-z'-]*$/
const NO_ESPEAK_HINT =
  '找不到 espeak-ng。请先安装：Debian/Ubuntu 执行 sudo apt install espeak-ng，' +
  'Fedora 执行 sudo dnf install espeak-ng，macOS 可用 brew install espeak-ng。'

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

/* ---------- 参数 ---------- */

function parseArgs(argv) {
  const out = { root: '', slug: '', all: false, voice: '', help: false }
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
      case '--slug': out.slug = value(); break
      case '--all': out.all = true; break
      case '--voice': out.voice = value(); break
      case '-h':
      case '--help': out.help = true; break
      default: fail(`未知参数：${arg}\n${USAGE}`)
    }
  }
  return out
}

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


/* ---------- words.json ---------- */

function readWords(file) {
  if (!existsSync(file)) fail(`找不到 words.json：${file}\n请先用 scripts/create-word.mjs 建词条，或确认 --root 是否指对了。`)
  const raw = readFileSync(file, 'utf8')
  const hadBom = raw.startsWith('\uFEFF')
  let value
  try {
    value = JSON.parse(hadBom ? raw.slice(1) : raw)
  } catch (err) {
    fail(`words.json 解析失败，未做任何修改：${file}\n${err.message}`)
  }
  if (!Array.isArray(value)) fail(`words.json 顶层不是数组：${file}`)
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

/* ---------- 临时文件 ---------- */

let tmpSeq = 0
function tmpPath(ext) {
  tmpSeq += 1
  return path.join(tmpdir(), `suiji-audio-${process.pid}-${Date.now()}-${tmpSeq}${ext}`)
}

/* ---------- 各平台合成 ---------- */

const shellQuote = (text) => "'" + String(text).replace(/'/g, "''") + "'"

/* say 在声音名不存在时会静默回退并返回 0，所以先查一次系统声音列表 */
let macVoiceCache = null
function availableMacVoices() {
  if (macVoiceCache) return macVoiceCache
  const names = new Set()
  const res = spawnSync('say', ['-v', '?'], { encoding: 'utf8' })
  if (!res.error && res.status === 0) {
    for (const line of String(res.stdout || '').split(/\r?\n/)) {
      const match = line.match(/^(.+?)\s{2,}[a-z]{2}_[A-Z]{2}\s{2,}#/)
      if (!match) continue
      const name = match[1].trim()
      names.add(name)
      /* 本地化系统里会显示成「Samantha (英语（美国）)」，去掉括号后缀再收一次 */
      names.add(name.replace(/\s*\([^)]*\)\s*$/, ''))
    }
  }
  macVoiceCache = names
  return names
}

function sayOnce(text, voice, aiff) {
  /* 用数组传参，不拼 shell；文本以 - 开头时改走 -f，避免被 say 当成选项 */
  const args = []
  if (voice) args.push('-v', voice)
  args.push('-o', aiff)
  let textFile = ''
  if (text.startsWith('-')) {
    textFile = tmpPath('.txt')
    writeFileSync(textFile, text, 'utf8')
    args.push('-f', textFile)
  } else {
    args.push(text)
  }
  try {
    const res = spawnSync('say', args, { encoding: 'utf8' })
    if (res.error) {
      return {
        ok: false,
        error:
          res.error.code === 'ENOENT'
            ? '找不到 say 命令（macOS 系统应自带）'
            : `say 调用失败：${res.error.message}`
      }
    }
    if (res.status !== 0) {
      return { ok: false, error: (res.stderr || res.stdout || `退出码 ${res.status}`).trim() }
    }
    return { ok: true, error: '' }
  } finally {
    if (textFile) rmSync(textFile, { force: true })
  }
}

function synthMac(text, outWav, voice) {
  const aiff = tmpPath('.aiff')
  try {
    const voices = availableMacVoices()
    const requested = String(voice || '').trim()
    /* 候选顺序：用户指定 → Samantha → 不指定（系统默认）；列表为空时不做过滤 */
    const candidates = []
    for (const candidate of requested ? [requested, MAC_DEFAULT_VOICE, ''] : [MAC_DEFAULT_VOICE, '']) {
      if (candidates.includes(candidate)) continue
      if (candidate && voices.size && !voices.has(candidate)) continue
      candidates.push(candidate)
    }
    if (!candidates.length) candidates.push('')
    let lastError = ''
    let usedVoice = ''
    let ok = false
    for (const candidate of candidates) {
      const res = sayOnce(text, candidate, aiff)
      if (res.ok) {
        usedVoice = candidate
        ok = true
        break
      }
      lastError = res.error
    }
    if (!ok) throw new Error(`say 合成失败：${lastError}`)
    const converted = spawnSync(
      'afconvert',
      ['-f', 'WAVE', '-d', 'LEI16@11025', '-c', '1', aiff, outWav],
      { encoding: 'utf8' }
    )
    if (converted.error) {
      throw new Error(
        converted.error.code === 'ENOENT'
          ? '找不到 afconvert 命令（macOS 系统应自带）'
          : `afconvert 调用失败：${converted.error.message}`
      )
    }
    if (converted.status !== 0) {
      throw new Error(`afconvert 转码失败：${(converted.stderr || converted.stdout || '').trim()}`)
    }
    const note =
      requested && usedVoice !== requested
        ? `没有用上声音 ${requested}，已改用${usedVoice ? ` ${usedVoice}` : '系统默认声音'}`
        : ''
    return { note, voice: usedVoice || '系统默认' }
  } finally {
    rmSync(aiff, { force: true })
  }
}

function synthWindows(text, outWav, voice) {
  const psFile = tmpPath('.ps1')
  const buildScript = (voiceName) => {
    const select = voiceName ? `  $synth.SelectVoice(${shellQuote(voiceName)})\n` : ''
    return `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
${select}$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(11025, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$synth.SetOutputToWaveFile(${shellQuote(outWav)}, $format)
$synth.Speak(${shellQuote(text)})
$synth.Dispose()
`
  }
  const runOnce = (voiceName) => {
    /* Windows PowerShell 5.1 读没有 BOM 的脚本会按系统 ANSI 码页解码，
       路径里带中文就会乱码，所以这里必须写 UTF-8 BOM。 */
    writeFileSync(psFile, '\uFEFF' + buildScript(voiceName), 'utf8')
    const res = spawnSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `& ${shellQuote(psFile)}`],
      { encoding: 'utf8' }
    )
    if (res.error) {
      return {
        ok: false,
        error:
          res.error.code === 'ENOENT'
            ? '找不到 powershell 命令'
            : `powershell 调用失败：${res.error.message}`
      }
    }
    if (res.status !== 0) {
      return { ok: false, error: (res.stderr || res.stdout || `退出码 ${res.status}`).trim() }
    }
    return { ok: true, error: '' }
  }
  try {
    let lastError = ''
    if (voice) {
      const withVoice = runOnce(voice)
      if (withVoice.ok) return { note: '', voice }
      lastError = withVoice.error
      const fallback = runOnce('')
      if (fallback.ok) {
        return { note: `声音 ${voice} 不可用，已回退到系统默认声音`, voice: '系统默认' }
      }
      lastError = fallback.error
    } else {
      const res = runOnce('')
      if (res.ok) return { note: '', voice: '系统默认' }
      lastError = res.error
    }
    throw new Error(`System.Speech 合成失败：${lastError}`)
  } finally {
    rmSync(psFile, { force: true })
  }
}

function synthLinux(text, outWav, voice) {
  const res = spawnSync(
    'espeak-ng',
    ['-w', outWav, '-s', '140', '-v', 'en-us', text],
    { encoding: 'utf8' }
  )
  if (res.error) {
    throw new Error(res.error.code === 'ENOENT' ? NO_ESPEAK_HINT : `espeak-ng 调用失败：${res.error.message}`)
  }
  if (res.status !== 0) {
    throw new Error(`espeak-ng 合成失败：${(res.stderr || res.stdout || `退出码 ${res.status}`).trim()}`)
  }
  return {
    note: voice ? 'Linux 下暂不支持 --voice，固定使用 en-us' : '',
    voice: 'en-us',
    extraNote: 'espeak-ng 的输出采样率不保证是 11025 Hz，请用 file 或 ffprobe 确认。'
  }
}

function platformLabel() {
  if (process.platform === 'darwin') return 'macOS（say + afconvert）'
  if (process.platform === 'win32') return 'Windows（powershell + System.Speech）'
  if (process.platform === 'linux') return 'Linux（espeak-ng）'
  return `未知平台 ${process.platform}`
}

function synthesize(text, outWav, voice) {
  if (process.platform === 'darwin') return synthMac(text, outWav, voice)
  if (process.platform === 'win32') return synthWindows(text, outWav, voice)
  if (process.platform === 'linux') return synthLinux(text, outWav, voice)
  throw new Error(`不支持的平台：${process.platform}（只支持 macOS / Windows / Linux）`)
}

function verifyWav(file, label) {
  if (!existsSync(file)) throw new Error(`${label} 生成失败：文件不存在（${file}）`)
  const size = statSync(file).size
  if (size <= 0) throw new Error(`${label} 生成失败：文件为空（${file}）`)
  return size
}

/* ---------- 词条与分段 ---------- */

function segmentsOf(entry) {
  const slug = entry.slug
  const dir = `words/${slug}`
  const phrases = Array.isArray(entry.phrases) ? entry.phrases : []
  const sentence = entry.sentence && typeof entry.sentence === 'object' ? entry.sentence : {}
  const segs = [
    {
      label: '单词 word.wav',
      text: String(entry.word || slug || ''),
      rel: `${dir}/word.wav`,
      field: 'wordAudio'
    }
  ]
  for (let i = 0; i < 5; i++) {
    const phrase = phrases[i] && typeof phrases[i] === 'object' ? phrases[i] : {}
    segs.push({
      label: `第 ${i + 1} 条词组 p${i + 1}.wav`,
      text: String(phrase.en || ''),
      rel: `${dir}/p${i + 1}.wav`,
      field: `phrases[${i}].audio`
    })
  }
  segs.push({
    label: '例句 sentence.wav',
    text: String(sentence.en || ''),
    rel: `${dir}/sentence.wav`,
    field: 'sentence.audio'
  })
  return segs
}

function processEntry(entry, root, wordsFile, list, hadBom, voice, index) {
  const slug = entry && typeof entry.slug === 'string' ? entry.slug : ''
  if (!slug) throw new Error(`words.json 第 ${index + 1} 条词条缺少 slug`)
  if (!SLUG_RE.test(slug)) {
    throw new Error(
      `[${slug}] slug 不合法：只能是小写字母开头，后接小写字母、连字符或撇号（如 apple、ice-cream、o'clock）`
    )
  }
  mkdirSync(path.join(root, 'words', slug), { recursive: true })
  const segs = segmentsOf(entry)
  const blank = segs.find((seg) => !seg.text.trim())
  if (blank) {
    throw new Error(
      `[${slug}] ${blank.label} 的英文文本为空，请先在 words.json 里补齐该词条的 en 字段`
    )
  }

  const notes = []
  let usedVoice = voice || (process.platform === 'darwin' ? MAC_DEFAULT_VOICE : '系统默认')
  for (const seg of segs) {
    const outWav = path.join(root, seg.rel)
    try {
      const result = synthesize(seg.text, outWav, voice)
      if (result.note && !notes.includes(result.note)) notes.push(result.note)
      if (result.extraNote && !notes.includes(result.extraNote)) notes.push(result.extraNote)
      usedVoice = result.voice || usedVoice
      verifyWav(outWav, seg.label)
    } catch (err) {
      throw new Error(`[${slug}] ${seg.label}：${err.message}`)
    }
  }

  /* 全部 7 段成功后再写回路径 */
  entry.wordAudio = `words/${slug}/word.wav`
  for (let i = 0; i < 5; i++) entry.phrases[i].audio = `words/${slug}/p${i + 1}.wav`
  entry.sentence.audio = `words/${slug}/sentence.wav`
  writeWords(wordsFile, list, hadBom)

  return { usedVoice, notes }
}

/* ---------- 主流程 ---------- */

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(USAGE)
    return
  }
  if (args.slug && args.all) fail(`--slug 和 --all 只能选一个\n${USAGE}`)
  if (!args.slug && !args.all) fail(`请用 --slug <slug> 指定一个单词，或用 --all 处理全部词条\n${USAGE}`)

  const root = resolveRoot(args.root)
  const wordsFile = path.join(root, 'words.json')
  const { list, hadBom } = readWords(wordsFile)

  let targets = []
  if (args.all) {
    for (let i = 0; i < list.length; i++) {
      const entry = list[i]
      if (entry && typeof entry.slug === 'string' && entry.slug.trim()) targets.push({ entry, index: i })
      else console.warn(`⚠ 跳过 words.json 第 ${i + 1} 条：缺少 slug`)
    }
    if (!targets.length) fail(`words.json 里没有可处理的词条：${wordsFile}`)
  } else {
    const slug = args.slug.trim()
    const index = list.findIndex((entry) => entry && entry.slug === slug)
    if (index < 0) {
      const names = list.map((entry) => entry && entry.slug).filter(Boolean)
      fail(`words.json 里找不到 slug：${slug}${names.length ? `\n现有词条：${names.join(', ')}` : ''}`)
    }
    targets = [{ entry: list[index], index }]
  }

  console.log(`平台：${platformLabel()}`)
  if (args.voice) console.log(`声音：${args.voice}`)

  let done = 0
  for (const { entry, index } of targets) {
    let result
    try {
      result = processEntry(entry, root, wordsFile, list, hadBom, args.voice, index)
    } catch (err) {
      fail(err.message)
    }
    for (const note of result.notes) console.log(`⚠ ${note}`)
    console.log(`✅ ${entry.slug}：7/7 段音频已生成 → ${path.join(root, 'words', entry.slug)}`)
    console.log(`   声音：${result.usedVoice}`)
    console.log(`   word.wav · p1.wav … p5.wav · sentence.wav（WAV）`)
    console.log(`   已写回 words.json：wordAudio / phrases[].audio / sentence.audio`)
    done += 1
  }

  if (targets.length > 1) console.log(`\n共处理 ${done} 个词条。`)
}

main()
