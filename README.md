# 随记单词本 · `@suiji-ai/dsh-agentic-word-book`

DSH 插件。左侧菜单一个书本图标，点开占据右侧整块面板：一个词一页，插图、音标、发音、常用词组、例句，
外加**挖字母拼写练习**和**单词辨析选择题**。面板挂在全局面板槽上，**不跟会话绑定**，切走再切回来进度还在。

> 核心设计：**代码与数据分离**。插件包只有功能代码（约 105 KB），词条、插图、发音全部住在
> 「单词本根目录」里（默认 `~/Documents/dsh/suiji-word-book/`）。换电脑只需要搬走这个目录。

[![GitHub](https://img.shields.io/badge/source-GitHub-181717?logo=github)](https://github.com/shallinta/dsh-agentic-word-book)

---

## 功能

| 模块 | 说明 |
|---|---|
| 首页 | 单词卡网格；按日期 / 首字母 / 字母数量分组，可正序倒序；顶部标签筛选 |
| 单词卡 | 大插图、手写体词头、音标、英文释义、发音（4 档倍速）、常用词组、例句 |
| 拼写练习 | 挖字母填词，`Tab` 提示、`Esc` 换题、`Enter` 重听/下一题，答完自动进下一题 |
| 单词辨析 | 固定 20 题四选一；12 种题型轮换，整套题锚定当前这个词 |
| 标签 | 设定里配置标签选项，卡片右键多选打标，首页 chip 快速筛选 |
| 自定义插图 | 卡片右键「替换插图…」/「恢复默认插图」；每个单词一个资源目录 |
| 「+单词」 | 输入若干单词 → 插件新建会话、自动切过去、交给技能去制作单词卡 |

---

## 数据放在哪

```
~/Documents/dsh/suiji-word-book/          ← 单词本根目录，可在设定里改
  settings.json                           标题/副标题/分组/排序/根目录/工作目录/是否显示 +单词/完全权限开关
  meta.json                               tagList 标签选项 + tags 每词标签
  words.json                              词条数组
  words/<slug>/                           单个单词的全部资源
    <slug>.svg                            默认插图      → words.json 的 art
    custom-<时间戳>.<ext>                 自定义插图    → words.json 的 customArt
    word.wav  p1..p5.wav  sentence.wav    发音
```

`words.json` 词条字段：

| 字段 | 含义 |
|---|---|
| `slug` | 小写单词，也是资源目录名 |
| `word` / `ipa` / `pos` / `zh` / `en` | 词头、音标、词性、中文、英文释义 |
| `created` | ISO 时间，决定首页排序与日期分组 |
| `art` | **默认插图**相对路径（相对根目录） |
| `customArt` | **自定义插图**相对路径；有值显示它，空串显示 `art` |
| `wordAudio` / `phrases[].audio` / `sentence.audio` | 发音相对路径 |

页面取图只有一条规则：`src = customArt || art`。替换插图时只写 `customArt`，**默认图文件永不改动、也不允许同名覆盖**。

---

## 安装

把下面这段直接发给 DSH：

```text
请帮我安装 DSH 插件「随记单词本」：
包名 @suiji-ai/dsh-agentic-word-book
源码仓库 git@github.com:shallinta/dsh-agentic-word-book.git
装好后左侧栏应该出现「随记单词本」，没出现就检查插件状态或提示我重启。
```

> 本机已有源码时，也可以让模型从目录安装（`plugin_manager` 的 `install_bundle`，target 指向本包目录）。
> 网络不通 HTTPS 时用上面的 SSH 地址。

装好后打开面板 → 右上角「设定」：

1. 确认**单词本根目录**（默认 `~/Documents/dsh/suiji-word-book/`，可改、可恢复默认、可一键打开文件夹）
2. 点**安装技能** → 写入 `~/.agents/skills/suiji-word-book/`
3. 需要的话打开首页「+单词」按钮

---

## 宿主接口

浏览器半边通过同源 `fetch` 调宿主注册的路由。路由用
`webServer.register({ kind: 'exact', path, handler })` 注册，**handler 收到的是 Node 的 `req`/`res`**，
必须自己 `res.writeHead(...).end(...)`；返回 Web `Response` 会让请求挂住。

| 路由 | 作用 |
|---|---|
| `GET  /suiji-word-book/state` | 设定 + 标签 + `words.json` |
| `GET  /suiji-word-book/file?name=<相对路径>` | 按扩展名返回 `image/*` 或 `audio/wav` |
| `POST /suiji-word-book/api` | 见下表 |

`POST` 的 `{ op, args }`：

| op | 作用 |
|---|---|
| `save` | 保存设定 / 标签（`words.json` 只由宿主写，客户端不上传） |
| `root` | 换根目录；目标已有数据时返回 `needsMigration`，前端弹「迁移 / 不迁移」 |
| `open-folder` | 用资源管理器 / Finder 打开目录 |
| `art` / `art-clear` | 写入 / 清除某个词的自定义插图（只改 `customArt`） |
| `install-skill` | 写 `~/.agents/skills/suiji-word-book/` |
| `add-words` | 建工作空间 → 建会话 → 切「完全权限」→ 发提示词，返回 `sessionId` |

---

## 管理技能

`~/.agents/skills/suiji-word-book/`

```
SKILL.md                 目录结构、words.json 字段、常见操作、权限说明
add-word.md              新增单词流程
scripts/create-word.ps1  生成占位条目
```

技能里写明根目录、资源目录、`art`/`customArt` 两个字段的语义，agent 读完就能改设定、打标签、换插图、加单词。
模板在 `skill-template.js`（生成时把真实根目录路径写进 SKILL.md）。

---

## 开发

```powershell
cd plugins/word-book
node build.mjs          # src/client.src.js -> client.js（只是复制，不含任何词库数据）
```

**改单词数据不需要构建**，直接改根目录里的文件，面板刷新即可。只有改界面代码才需要重新构建。

### 目录结构

| 文件 | 作用 |
|---|---|
| `index.js` | 宿主半边：路由、磁盘读写、技能安装、建会话 |
| `skill-template.js` | 技能 markdown 模板 |
| `src/client.src.js` | 浏览器半边源码（React，纯 JS 无 JSX） |
| `client.js` | 构建产物（模块加载器读取） |
| `package.json` | 包描述 + `dsh.bundle` / `dsh.client` 清单 |
| `cordis.patch.yml` | 往 profile 插入 `word-book` 这一行 |
| `locale/*.json` | 插件市场里的名字和描述 |
| `icon.svg` | 插件图标 |

### 实现要点

- 面板注册在 `sidebar.panellist`（`id: word-book`）+ `main`（`key: word-book`）两个 root 槽，所以不跟会话
- `main` 是 keyed 槽，切面板会卸载组件；页面状态放在模块级 `STORE`，靠 `emit()` 订阅恢复
- 客户端 `inject` 必须有 `uiWorkspace`，否则拿不到 `openSession`
- 切会话用 `uiWorkspace.openSession(sessionId)`（**传字符串**，不是 `{kind,sessionId}` 对象），
  失败时依次退让为 `openWorkspace` 再开会话、写路由刷新
- 新会话默认权限是 `workspace-write`；插件建完会话后用 `permissionPresets.set(session, 'danger-full-access')`
  切成完全权限（可用 `settings.newSessionFullAccess=false` 关掉）

