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
| \`settings.json\` | \`title\` 标题、\`subtitle\` 副标题、\`groupBy\`（date/letter/length）、\`order\`（desc/asc）、\`rootDir\` 单词本根目录、\`workDir\` 新建会话用的 DSH 工作目录、\`workTitle\` 工作空间名、\`showAddWord\`、\`skillInstalled\` |
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
- 其余 \`audio\` 字段同理，都是相对根目录的路径

## 常见操作

- **改标题/副标题/分组**：改 \`settings.json\`，不要动 \`rootDir\` / \`workDir\`
- **新建会话**：DSH 工作目录用 \`workDir\`（默认 \`~/Documents/deepseek-harness/suiji-word-book/\`），不存在就创建；工作空间名用 \`workTitle\`
- **打标签**：先把新标签加进 \`meta.json\` 的 \`tagList\`，再写进 \`tags[slug]\`
- **换插图**：图片放进 \`words/<slug>/\`，文件名以 \`custom-\` 开头（**不要覆盖 \`art\` 指向的默认图**），再把相对路径写进该词条的 \`customArt\`
- **恢复默认插图**：把 \`customArt\` 置成空串即可；默认图文件不要删
- **加单词**：见 \`add-word.md\`

改完文件后，在单词本面板刷新页面即可看到。
`
}

export function renderAddWord(rootDir) {
  return `# 新增单词

根目录：\`${rootDir}\`（以 \`settings.json\` 的 \`rootDir\` 为准）

1. 建资源目录 \`words/<slug>/\`
2. 画一张 320×240 的默认插图，存成 \`words/<slug>/<slug>.svg\`（扁平风，主题色 #FF8A5B / #8FD4FF / #FFD166 / #6FB84F）
3. 用系统 SAPI 生成 7 段 11025 Hz 单声道 WAV 放到同一目录：\`word.wav\`、\`p1.wav\`–\`p5.wav\`、\`sentence.wav\`
4. 在 \`words.json\` 追加词条：\`art\` 指向默认插图，\`customArt\` 留空串，\`wordAudio\` / \`phrases[].audio\` / \`sentence.audio\` 都指向该目录下的 wav
5. 填 \`ipa\`、\`pos\`、\`zh\`、\`en\`、5 条 \`phrases\`、1 条 \`sentence\`
6. 刷新单词本面板确认

可以用辅助脚本先生成占位条目：

\`\`\`powershell
powershell -ExecutionPolicy Bypass -File "<skill目录>/scripts/create-word.ps1" -Word "apple" -Root "${rootDir}"
\`\`\`

约定：\`created\` 用当前时间；一词 5 词组 + 1 例句；不要改 \`rootDir\`。

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
