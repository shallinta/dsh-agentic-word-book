/**
 * 「单词本管理技能」的两个 markdown 模板。
 * 单独放一个文件，避免把大段中文模板塞进 index.js 的补丁里。
 */

export function renderSkill(rootDir) {
  return `---
name: suiji-word-book
description: 管理「随记单词本」的数据与设定（单词、标签、自定义插图、首页设定）。当用户要求添加/修改单词卡、调整单词本设定、给单词打标签或换插图时使用。
---

# 随记单词本管理

## 根目录

\`\`\`
${rootDir}
\`\`\`

所有数据都在这个目录下。**不要写死路径**，先读 \`settings.json\` 里的 \`rootDir\`。

| 路径 | 作用 |
|---|---|
| \`settings.json\` | \`title\` 标题、\`subtitle\` 副标题、\`groupBy\`（date/letter/length）、\`order\`（desc/asc）、\`rootDir\` 单词本根目录、\`workDir\` 新建会话用的 DSH 工作目录、\`workTitle\` 工作空间名、\`showAddWord\`、\`skillInstalled\`、\`fontWord\`、\`fontPhrase\` |
| \`meta.json\` | \`tagList\` 标签选项；\`tags\` 形如 \`{ "dog": ["动物"] }\` |
| \`words.json\` | 词条数组，字段见下 |
| \`words/<slug>/\` | **单个单词的全部资源**：默认插图、\`custom-*\` 自定义插图、各段发音 |

## words.json 字段

\`\`\`json
[
  {
    "slug": "dog",
    "word": "dog",
    "created": "2026-11-08T14:31:00",
    "ipa": "/dɔːɡ/",
    "pos": "n.",
    "zh": "狗",
    "en": "a pet that barks and wags its tail",
    "art": "words/dog/dog.svg",
    "customArt": "",
    "artAlt": "一只棕色小狗",
    "wordAudio": "words/dog/word.wav",
    "phrases": [{ "en": "a big dog", "zh": "大狗", "audio": "words/dog/p1.wav" }],
    "sentence": { "en": "The dog can run fast.", "zh": "这只狗跑得很快。", "audio": "words/dog/sentence.wav" }
  }
]
\`\`\`

- \`slug\`：小写单词，也是资源目录名
- \`created\`：ISO 时间，决定首页排序
- \`art\`：**默认插图**的相对路径（相对根目录），始终指向 \`words/<slug>/...\`
- \`customArt\`：**自定义插图**的相对路径；有值就显示它，空串就显示 \`art\`
- \`customWordAudio\`：**自定义主音频**的相对路径；有值就播它，空串就播 \`wordAudio\`；文件放 \`words/<slug>/custom-audio-*\`
- 其余 \`audio\` 字段同理，都是相对根目录的路径
- 一个词可以有多个词性/释义，放在 \`senses\` 数组里：每个 sense 有自己的 \`pos\` / \`zh\` / \`en\` / \`sentence\`，例句音频从 \`sentence-1.wav\` 起按序号命名；没有 \`senses\` 时用旧的单套字段（\`sentence\` 对应 \`sentence.wav\`）

## 常见操作

- **改标题/副标题/分组**：改 \`settings.json\`，不要动 \`rootDir\` / \`workDir\`；标题和副标题的对齐分别用 \`titleAlign\` / \`subtitleAlign\`，取值 \`left\` / \`center\` / \`right\`；颜色用 \`titleColor\` / \`subtitleColor\`，写 \`#rrggbb\`
- **换主题**：改 \`settings.json\` 的 \`theme\`，取 \`auto\`（晨昏，默认）、\`morning\`（晨光）、\`midnight\`（子夜）或 \`dust\`（雨滴，毛玻璃）
- **新建会话**：DSH 工作目录用 \`workDir\`（默认 \`~/Documents/deepseek-harness/suiji-ai/\`），不存在就创建；工作空间名用 \`workTitle\`（默认「随记」）
- **打标签**：先把新标签加进 \`meta.json\` 的 \`tagList\`，再写进 \`tags[slug]\`
- **换插图**：用户明确要给某张已有词卡换图时才用。图片放进 \`words/<slug>/\`，文件名以 \`custom-\` 开头（**不要覆盖 \`art\` 指向的默认图**），再把相对路径写进该词条的 \`customArt\`
- **换主音频**：音频放进 \`words/<slug>/\`，文件名以 \`custom-audio-\` 开头，再把相对路径写进该词条的 \`customWordAudio\`
- **恢复默认主音频**：把 \`customWordAudio\` 置成空串即可；默认音频文件不要删
- **恢复默认插图**：把 \`customArt\` 置成空串即可；默认图文件不要删
- **新词卡的插图**：画好后直接作为默认插图（覆盖 \`words/<slug>/<slug>.svg\` 或改 \`art\` 指向新文件），\`customArt\` 保持空串
- **加单词**：见 \`add-word.md\`（用 \`scripts/create-word.mjs\` 建占位词条、\`scripts/make-audio.mjs\` 生成发音，macOS / Windows 通用）

改完文件后，在单词本面板刷新页面即可看到。
`
}

export function renderAddWord(rootDir) {
  return `# 新增单词

根目录：\`${rootDir}\`（以 \`settings.json\` 的 \`rootDir\` 为准）

整个流程用技能自带的两个 Node 脚本完成。脚本只依赖系统自带的语音工具，**自动按操作系统选择合成方式**（macOS 用 \`say\` + \`afconvert\`，Windows 用 PowerShell 的 \`System.Speech\`），不用你手动选，也不在文档里写死某一种。

## 1. 建占位词条

\`\`\`text
node "<skill目录>/scripts/create-word.mjs" --root "${rootDir}" --word "apple"
\`\`\`

技能目录通常是 \`~/.agents/skills/suiji-word-book\`，Windows 上是 \`%USERPROFILE%\\.agents\\skills\\suiji-word-book\`。这一步会：

- 建资源目录 \`words/<slug>/\`
- 写一张 320×240 的占位插图 \`words/<slug>/<slug>.svg\`（扁平风，主色 #FF8A5B / #8FD4FF / #FFD166 / #6FB84F）。它只是临时顶着，最后会被第 3 步画的真正插图替换
- 在 \`words.json\` 追加占位词条

\`slug\` 由单词小写得到，只能是小写字母开头，后接小写字母、连字符或撇号（如 \`apple\`、\`ice-cream\`、\`o'clock\`）。词条已存在时脚本会拒绝执行；确需重建占位内容时加 \`--force\`（只补空缺字段，不覆盖已填内容）。

## 2. 填字段

先判断这个单词有几个词性，再决定用哪种结构。

- **一个词性**：沿用旧结构，直接填 \`ipa\`、\`pos\`、\`zh\`、\`en\`、\`artAlt\`、5 条 \`phrases[].en\` / \`phrases[].zh\`、\`sentence.en\` / \`sentence.zh\`。例句音频仍然叫 \`sentence.wav\`。
- **多个词性**：建 \`senses\` 数组，一个词性一条，各自填 \`pos\`、\`zh\`、\`en\`、\`sentence\`，尽量每个词性都配一个例句；顶层的 \`pos\` / \`zh\` / \`en\` / \`sentence\` 保留成第一个词性的副本，不要删。

每个词性默认只写一个中文释义。只有用户明确要求同一个词性下增加释义时，才再补一条同 \`pos\` 的 sense。

\`place\`（n. 地方 / v. 放置）的片段：

\`\`\`json
"senses": [
  {
    "pos": "n.",
    "zh": "地方",
    "en": "a particular position or area",
    "sentence": { "en": "This is a quiet place.", "zh": "这是个安静的地方。", "audio": "words/place/sentence-1.wav" }
  },
  {
    "pos": "v.",
    "zh": "放置",
    "en": "to put something somewhere",
    "sentence": { "en": "Place the cup on the table.", "zh": "把杯子放在桌上。", "audio": "words/place/sentence-2.wav" }
  }
]
\`\`\`

\`audio\` 留空串也行，下一步生成后会自动写回。\`art\` 指向默认插图，\`customArt\` 留空串；\`customWordAudio\` 也留空串；\`created\` 用脚本写入的时间，不要改。

## 3. 画插图

按单词的意思画一张 320×240 的插图，把它变成**默认插图**：

- 画成 SVG：直接覆盖 \`words/<slug>/<slug>.svg\`，\`art\` 路径不用改（还是 \`words/<slug>/<slug>.svg\`）
- 只能输出位图：存成 \`words/<slug>/<slug>.png\`（或 .webp / .jpg），把词条的 \`art\` 改成这个路径，并删掉占位用的 \`<slug>.svg\`

\`customArt\` 保持空串。新词卡的插图就是默认插图，不是自定义插图。

## 4. 生成音频

\`\`\`text
node "<skill目录>/scripts/make-audio.mjs" --root "${rootDir}" --slug apple
\`\`\`

每个词条先写 \`word.wav\`、\`p1.wav\`–\`p5.wav\`，再按结构写例句音频，全部是 11025 Hz 单声道 WAV，放在 \`words/<slug>/\`：

- 旧结构（单个 \`sentence\`）：\`sentence.wav\`
- 多词性（\`senses\` 数组）：第 1 个 sense 用 \`sentence-1.wav\`，第 2 个用 \`sentence-2.wav\`，序号按 sense 的位置算；某个 sense 没写例句就跳过，后面的文件序号不挪位
- 顶层 \`sentences\` 数组：第 1 条 \`sentence-1.wav\`，第 2 条 \`sentence-2.wav\`，以此类推

句子英文为空的不生成音频，\`audio\` 留空串。路径会自动写回 \`wordAudio\`、\`phrases[].audio\`，例句写回 \`sentence.audio\`、\`senses[i].sentence.audio\` 或 \`sentences[i].audio\`。

- macOS：\`say\`（默认用系统声音，可用 \`--voice "名字"\` 指定）+ \`afconvert\`
- Windows：PowerShell 调用 \`System.Speech\`，\`--voice\` 对应 \`SelectVoice\`
- Linux：\`espeak-ng\`，输出采样率不保证 11025 Hz

要处理全部词条可把 \`--slug apple\` 换成 \`--all\`。任何一段生成失败，脚本都会指出是哪个文件并以非 0 退出；结束时打印生成了几段例句音频。

## 5. 刷新单词本面板确认

约定：\`created\` 用当前时间；一词 5 词组 + 1 条例句（多词性时每个词性各配一条）；不要改 \`rootDir\`。

## 权限

**用首页「+单词」建出来的会话，插件已经自动切到「完全权限（danger-full-access）」。**
正常情况下你不会收到授权请求，也不需要跟用户讨论权限。

只有这两种情况才需要提一句：

1. 你确实被要求授权 —— 说明自动切换没生效（可能用户在设置里关掉了 \`newSessionFullAccess\`）
2. 用户主动问为什么又要授权

这时说明：「新会话默认会被插件切成完全权限；现在没生效，可能是设置里关掉了。你可以自己在会话权限菜单里切，我这边改不了。」
—— **不要说「我来帮你切」**，也不要把「切换成完全权限」写进 \`ask_user_question\` 的选项里，你无法执行这个动作。

- 每次审批通常只对当次调用有效
- 无论哪种权限，都不要改 \`settings.json\` 里的 \`rootDir\` / \`workDir\`
`
}
