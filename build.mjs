/**
 * 把 src/client.src.js 复制成 client.js（模块加载器读的就是这个文件）。
 *
 * 词库不在包里：单词、插图、音频全部住在「单词本根目录」，运行时由宿主半边提供。
 *
 *   node build.mjs
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const srcFile = join(here, 'src/client.src.js')
const outFile = join(here, 'client.js')

writeFileSync(outFile, readFileSync(srcFile, 'utf8'), 'utf8')

console.log('client :', (statSync(outFile).size / 1024).toFixed(1) + ' KB ->', outFile)
