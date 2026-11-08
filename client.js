window.__ModuleLoader__.load({
  id: '@suiji-ai/dsh-agentic-word-book',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useRef, useEffect } = React;

    /* 词库不打包：启动时从「单词本根目录」的 words.json 载入 */
    const DATA = { words: [] };
    /* created 只用于排序与分组，界面不显示 */
    function createdMs(e) {
      const t = Date.parse(e.created || '');
      return Number.isFinite(t) ? t : 0;
    }
    /* 基准顺序：加入时间从早到晚；首页再按设定分组/排序 */
    const WORDS = (DATA.words || []).slice().sort(function (a, b) { return createdMs(a) - createdMs(b); });

    /* ============================== 样式 ==============================
       视觉语言照搬网页版 words/styles.css：奶白底 + 三色光晕、白卡 28 圆角、
       mono 大字、珊瑚渐变 pill 按钮、青色喇叭、琥珀色例句框。
       只是把 :root 变量收进 .wb-root，类名统一加 wb- 前缀避免和宿主冲突。 */
    const CSS = `
.wb-root{
  --wb-ink:#3A3550;--wb-ink-soft:#615C7A;--wb-muted:#948FAC;
  --wb-line:#F0EAF7;--wb-line-strong:#E2DAEE;--wb-card:#fff;--wb-bg:#FFF9F0;
  --wb-coral:#FF8A5B;--wb-coral-2:#F2703F;--wb-mint:#3ECFB2;--wb-sky:#6C8CFF;--wb-red:#E5484D;
  --wb-mono:"JetBrains Mono","Cascadia Mono",ui-monospace,Consolas,monospace;
  --wb-hand:"Segoe Print","Segoe Script","Bradley Hand","Comic Sans MS",cursive;
  --wb-fun:"Comic Sans MS","Segoe Print","Segoe Script",cursive;
  --wb-sans:"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;
  --wb-shadow:0 22px 48px -28px rgba(80,60,120,.5);
  --wb-shadow-sm:0 10px 22px -14px rgba(80,60,120,.45);
  --wb-r:26px;--wb-scale:1.17;
  position:relative;display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;
  color:var(--wb-ink);background-color:var(--wb-bg);
  background-image:
    radial-gradient(900px 520px at 6% -12%,rgba(255,209,102,.30),transparent 62%),
    radial-gradient(820px 520px at 102% -4%,rgba(62,207,178,.20),transparent 58%),
    radial-gradient(760px 520px at 50% 112%,rgba(255,138,91,.14),transparent 60%);
  font-family:var(--wb-sans);font-size:calc(15px * var(--wb-scale));line-height:1.6;color-scheme:light;
  padding-top:var(--dsh-frame-top-clearance,0px);
}
.wb-root *{box-sizing:border-box}
/* 用 :where() 把权重压到 0 —— 否则 .wb-root button 会盖掉 .wb-btn/.wb-card 的底色和边框 */
:where(.wb-root) button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer}
.wb-root :focus-visible{outline:3px solid var(--wb-sky);outline-offset:3px;border-radius:10px}

.wb-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}
.wb-wrap{width:100%;max-width:1200px;margin:0 auto;padding:10px 12px 40px}

/* ---------- 顶栏：返回 + 主操作 ---------- */
.wb-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.wb-topbar-side{display:flex;align-items:center;gap:10px;margin-left:auto}
.wb-back{display:inline-flex;align-items:center;gap:7px;font-size:calc(14px * var(--wb-scale));color:var(--wb-ink-soft);background:rgba(255,255,255,.75);border:1px solid var(--wb-line-strong);padding:8px 15px;border-radius:999px;box-shadow:var(--wb-shadow-sm);transition:transform .16s,background .16s}
.wb-back:hover{transform:translateX(-2px);background:#fff}
.wb-back b{font-size:calc(15px * var(--wb-scale));line-height:1}

/* ---------- 按钮 ---------- */
.wb-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;background:linear-gradient(180deg,#FFA177,var(--wb-coral));color:#fff;font-size:calc(17px * var(--wb-scale));font-weight:700;padding:13px 30px;border-radius:999px;box-shadow:0 14px 26px -12px rgba(242,112,63,.85);transition:transform .16s,box-shadow .16s,filter .16s}
.wb-btn:hover{transform:translateY(-2px);filter:brightness(1.03);box-shadow:0 18px 30px -12px rgba(242,112,63,.9)}
.wb-btn:active{transform:translateY(0) scale(.98)}
.wb-btn--sm{font-size:calc(14px * var(--wb-scale));padding:9px 18px}
.wb-mini{font-size:calc(13px * var(--wb-scale));color:var(--wb-ink-soft);background:#FAF7FF;border:1px solid var(--wb-line-strong);border-radius:999px;padding:8px 16px;transition:background .16s,border-color .16s}
.wb-mini:hover{background:#F3EDFF}

/* ---------- 首页 ---------- */
.wb-hero{text-align:center;padding:8px 0 0}
.wb-hero h1{margin:0 0 8px;font-size:calc(34px * var(--wb-scale));font-weight:700;letter-spacing:.01em}
.wb-hero p{margin:0;color:var(--wb-ink-soft);font-size:calc(15px * var(--wb-scale));line-height:1.7}
/* 每行几张卡由「这一组有几张」决定：
   1–2 张 → 两列（各占一半）；3 张 → 三列（各占 1/3）；4 张及以上 → 四列（各占 1/4）。
   gap 是固定值，列宽 = (100% - gap × (列数-1)) / 列数，所以「排除卡片之间的间距」。 */
.wb-grid{display:grid;gap:16px;margin:18px auto 0;max-width:980px}
.wb-grid--2{grid-template-columns:repeat(2,minmax(0,1fr))}
.wb-grid--3{grid-template-columns:repeat(3,minmax(0,1fr))}
.wb-grid--4{grid-template-columns:repeat(4,minmax(0,1fr))}
.wb-card{display:flex;flex-direction:column;text-align:left;cursor:pointer;background:var(--wb-card);border:1px solid var(--wb-line);border-radius:var(--wb-r);padding:12px 12px 16px;box-shadow:var(--wb-shadow);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;overflow:hidden}
.wb-card:hover{transform:translateY(-5px);border-color:var(--wb-line-strong);box-shadow:0 30px 60px -30px rgba(80,60,120,.55)}
.wb-thumb{border-radius:18px;overflow:hidden;background:#F6F3FF;aspect-ratio:4/3;display:grid;place-items:center}
.wb-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.wb-meta{padding:12px 4px 0;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.wb-meta b{font-family:var(--wb-hand);font-size:calc(24px * var(--wb-scale));letter-spacing:.01em;font-weight:400}
.wb-meta span{font-size:calc(13px * var(--wb-scale));color:var(--wb-muted)}
.wb-foot{text-align:center;color:var(--wb-muted);font-size:calc(13px * var(--wb-scale));margin-top:20px}

/* ---------- 学习卡 ---------- */
.wb-learn{position:relative;background:var(--wb-card);border:1px solid var(--wb-line);border-radius:var(--wb-r);box-shadow:var(--wb-shadow);padding:22px;overflow:hidden}
/* 单词卡区域（虚线以上）右侧、竖排的倍速按钮，底端对齐（end） */
.wb-rate{display:flex;flex-direction:column;gap:9px;align-self:end;justify-self:end;z-index:2}
.wb-rate button{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:66px;padding:9px 11px;border-radius:999px;background:#EFF3FF;border:1px solid #DCE4FF;color:var(--wb-sky);font-family:var(--wb-mono);font-size:calc(11.5px * var(--wb-scale));font-weight:600;line-height:1.1;white-space:nowrap;transition:background .14s,border-color .14s,transform .12s}
.wb-rate button:hover{background:#E3EAFF;border-color:#C9D6FF;transform:scale(1.04)}
.wb-rate button:active{transform:scale(.95)}
.wb-rate svg{width:12px;height:12px;display:block;flex:none}
.wb-learn-top{position:relative;display:grid;grid-template-columns:280px minmax(0,1fr) auto;gap:24px;align-items:center}
/* 单词卡区域右上角的标签：绝对定位在右上，窄屏时回到第一行右对齐 */
.wb-hero-tags{position:absolute;top:0;right:0;display:flex;gap:6px;max-width:70%;z-index:2;padding-bottom:6px}
.wb-hero-tag{font-size:calc(12px * var(--wb-scale));color:#7A6BA8;background:#F3EFFF;border:1px solid #E4DBFA;border-radius:999px;padding:3px 11px;white-space:nowrap;line-height:1.5}
.wb-hero-tag--more{color:#9C8EC0;background:transparent;border-style:dashed}
.wb-art{border-radius:22px;overflow:hidden;background:#F7FBFF;aspect-ratio:4/3;display:grid;place-items:center;border:1px solid var(--wb-line)}
.wb-art img{width:100%;height:100%;object-fit:cover;display:block}
.wb-headword{min-width:0}
.wb-word{margin:0;font-family:var(--wb-hand);font-weight:700;line-height:1.02;font-size:calc(80px * var(--wb-scale));letter-spacing:.01em;word-break:break-word}
.wb-word-btn{font:inherit;color:inherit;letter-spacing:inherit;line-height:inherit;text-align:left;border-radius:8px;transition:color .15s}
.wb-word-btn:hover{color:var(--wb-coral-2)}
.wb-pron{display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap}
.wb-ipa{font-family:var(--wb-mono);font-size:calc(17px * var(--wb-scale));color:#7C88A8}
.wb-dot{color:var(--wb-line-strong);line-height:1}
.wb-endef{font-size:calc(13.5px * var(--wb-scale));color:var(--wb-muted);font-style:italic}
.wb-mean{margin-top:10px;font-size:calc(20px * var(--wb-scale));line-height:1.5;color:var(--wb-ink-soft)}
.wb-pos{display:inline-block;font-size:calc(12px * var(--wb-scale));font-weight:700;color:var(--wb-coral-2);background:#FFF0E9;border-radius:8px;padding:2px 8px;margin-right:8px;vertical-align:2px}

/* ---------- 喇叭 ---------- */
.wb-speak{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:#EFF3FF;color:var(--wb-sky);border:1px solid #DCE4FF;transition:transform .15s,background .18s}
.wb-speak:hover{background:#E3EAFF;transform:scale(1.05)}
.wb-speak:active{transform:scale(.94)}
.wb-speak svg{width:22px;height:22px;display:block}
.wb-speak--sm{width:34px;height:34px;background:#F1FBF8;color:#20A98F;border-color:#D5F2EA}
.wb-speak--sm:hover{background:#E4F8F2}
.wb-speak--sm svg{width:17px;height:17px}
.wb-speak--amber{background:#FFF1DA;border-color:#F8E0B8;color:#C98419}
.wb-speak--amber:hover{background:#FFE9C8}

/* ---------- 词组 / 例句 ---------- */
.wb-section{margin-top:20px;padding-top:16px;border-top:1px dashed var(--wb-line-strong)}
.wb-section h2{margin:0 0 10px;font-size:calc(13.5px * var(--wb-scale));letter-spacing:.14em;color:var(--wb-muted);font-weight:700}
.wb-phrs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 76px}
.wb-phr{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:14px;cursor:pointer;transition:background .16s}
.wb-phr:hover{background:#FFF7F2}
.wb-phr .en{font-family:var(--wb-fun);font-size:calc(18.5px * var(--wb-scale));font-weight:400}
.wb-phr .zh{font-size:calc(15.5px * var(--wb-scale));color:var(--wb-ink-soft);margin-left:auto;text-align:right}
.wb-sent{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 14px;align-items:center;padding:14px 16px;background:#FFFAF2;border-radius:16px;border:1px solid #F7E9D2;cursor:pointer}
.wb-sent .wb-speak{grid-column:1;grid-row:1 / span 2;align-self:start;margin-top:1px}
.wb-sent .en{grid-column:2;grid-row:1;font-family:var(--wb-fun);font-size:calc(16.5px * var(--wb-scale));font-weight:400}
.wb-sent .zh{grid-column:2;grid-row:2;font-size:calc(14.5px * var(--wb-scale));color:var(--wb-ink-soft)}

/* ---------- 拼写测试 ---------- */
.wb-test{position:relative;background:var(--wb-card);border:1px solid var(--wb-line);border-radius:var(--wb-r);box-shadow:var(--wb-shadow);padding:26px 30px 28px;overflow:hidden}
.wb-test-art{display:grid;place-items:center;margin:18px 0 4px}
.wb-test-art img{width:clamp(208px,24vw,304px);aspect-ratio:4/3;object-fit:cover;border-radius:14px;border:1px solid var(--wb-line);background:#F7FBFF;display:block}
.wb-qhead{display:flex;align-items:center;justify-content:space-between;gap:12px}
.wb-qcount{font-size:calc(13px * var(--wb-scale));color:var(--wb-muted);letter-spacing:.06em}
.wb-qcount b{font-family:var(--wb-mono);color:var(--wb-ink);font-size:calc(16px * var(--wb-scale))}
.wb-listen{display:inline-flex;align-items:center;gap:7px;font-size:calc(13.5px * var(--wb-scale));color:var(--wb-sky);background:#EFF3FF;border:1px solid #DCE4FF;border-radius:999px;padding:8px 14px;transition:background .16s}
.wb-listen:hover{background:#E3EAFF}
.wb-listen svg{width:16px;height:16px}
.wb-qbar{height:6px;background:#F3EFFA;border-radius:999px;overflow:hidden;margin:16px 0 6px}
.wb-qbar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--wb-sky),var(--wb-mint));transition:width .4s ease}
.wb-prompt{text-align:center;margin:24px 0 4px;font-size:calc(19px * var(--wb-scale));color:var(--wb-ink-soft)}
.wb-letters{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;align-content:center;gap:6px 9px;padding:30px 8px 26px;min-height:160px;font-family:var(--wb-hand);font-weight:700;font-size:clamp(calc(40px * var(--wb-scale)),6vw,calc(60px * var(--wb-scale)));line-height:1;outline:none;cursor:text;border-radius:12px}
/* 所有格子同高：下划线用伪元素画，不占布局高度，填进去的字母和已有字母基线才对得齐 */
.wb-lcell{display:inline-flex;align-items:center;justify-content:center;line-height:1;height:1.16em;color:#B9B2CC;position:relative}
.wb-lcell--blank{min-width:.98em;color:var(--wb-ink);transition:color .16s ease}
.wb-lcell--blank::before{content:"";position:absolute;left:0;right:0;bottom:0;height:6px;border-radius:6px;background:var(--wb-bar,var(--wb-line-strong))}
.wb-lcell--cur{--wb-bar:var(--wb-sky)}
.wb-lcell--cur::after{content:"";position:absolute;left:50%;bottom:.13em;width:3px;height:.84em;border-radius:3px;background:var(--wb-sky);transform:translateX(-50%);animation:wb-blink 1.05s steps(1) infinite}
.wb-lcell--filled{--wb-bar:#BFEFE4;animation:wb-pop .16s ease-out}
.wb-lcell--bad{--wb-bar:var(--wb-red);color:var(--wb-red);animation:wb-shake .24s ease-in-out}
.wb-lcell--done{--wb-bar:#BFEFE4;color:#27B394}
@keyframes wb-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes wb-pop{from{transform:translateY(5px);opacity:.3}to{transform:none;opacity:1}}
@keyframes wb-shake{0%,100%{transform:translateX(0)}30%{transform:translateX(-6px)}70%{transform:translateX(6px)}}
@keyframes wb-fade{from{opacity:0}to{opacity:1}}
.wb-feedback{min-height:28px;margin-top:6px;text-align:center;font-size:calc(14.5px * var(--wb-scale));color:var(--wb-muted);transition:color .2s}
.wb-feedback--ok{color:#20A98F;font-weight:600}
.wb-feedback--bad{color:var(--wb-red)}
.wb-testrow{display:flex;justify-content:center;gap:12px;margin-top:20px;flex-wrap:wrap}
.wb-keys{display:flex;justify-content:space-around;align-items:center;gap:10px;margin-top:18px;font-size:calc(12.5px * var(--wb-scale));color:var(--wb-muted)}
.wb-keys > span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.wb-keys kbd{font-family:var(--wb-mono);font-size:calc(12px * var(--wb-scale));border:1px solid var(--wb-line-strong);border-bottom-width:2px;border-radius:6px;padding:1px 6px;margin:0;background:#FCFAFE}
.wb-finish{position:absolute;inset:0;background:rgba(255,255,255,.985);backdrop-filter:blur(6px);display:grid;place-items:center;text-align:center;padding:32px;animation:wb-fade .25s ease-out}
.wb-finish .icon{font-size:46px;margin-bottom:6px;line-height:1}
.wb-finish h2{margin:0 0 8px;font-size:calc(22px * var(--wb-scale));font-weight:700}
.wb-finish p{margin:0 0 18px;color:var(--wb-ink-soft);font-size:calc(14px * var(--wb-scale));line-height:1.7}
.wb-finish .acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}

/* ---------- 首页分组 ---------- */
.wb-group{margin-top:24px}
.wb-group h3{margin:0 0 12px;font-size:calc(12.5px * var(--wb-scale));letter-spacing:.14em;color:var(--wb-muted);font-weight:700}
.wb-group .wb-grid{margin-top:0}

/* ---------- 单词辨析 ---------- */
.wb-rec-prompt{display:grid;place-items:center;gap:10px;margin:20px 0 8px;min-height:200px}
.wb-rec-tip{font-size:calc(13.5px * var(--wb-scale));color:var(--wb-muted);letter-spacing:.04em}
.wb-rec-word{font-family:var(--wb-hand);font-weight:700;font-size:calc(58px * var(--wb-scale));line-height:1.05;letter-spacing:.01em;word-break:break-word;text-align:center}
.wb-rec-zh{font-size:calc(24px * var(--wb-scale));color:var(--wb-ink-soft);text-align:center}
.wb-rec-art{width:clamp(160px,22vw,250px);aspect-ratio:4/3;object-fit:cover;border-radius:16px;border:1px solid var(--wb-line);background:#F7FBFF;display:block}
.wb-speak--lg{width:84px;height:84px}
.wb-speak--lg svg{width:38px;height:38px}
.wb-rec-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:10px}
.wb-rec-opt{position:relative;display:grid;place-items:center;gap:8px;min-height:184px;padding:18px 14px;border-radius:16px;border:1px solid var(--wb-line-strong);background:#FCFAFE;color:var(--wb-ink);cursor:pointer;transition:border-color .14s,background .14s,transform .12s}
.wb-rec-opt:hover{border-color:#FFCBD3;background:#fff;transform:translateY(-1px)}
.wb-rec-opt:active{transform:scale(.99)}
.wb-rec-opt:focus-visible{outline:3px solid var(--wb-sky);outline-offset:3px;border-radius:16px}
.wb-rec-opt .badge{position:absolute;left:9px;top:7px;font-size:calc(11px * var(--wb-scale));color:var(--wb-muted);font-family:var(--wb-mono)}
.wb-rec-opt--word{font-family:var(--wb-hand);font-size:calc(44px * var(--wb-scale));font-weight:400;line-height:1.05}
.wb-rec-opt--zh{font-size:calc(24px * var(--wb-scale));line-height:1.45;text-align:center}
.wb-rec-opt img{width:100%;max-width:230px;aspect-ratio:4/3;object-fit:cover;border-radius:10px;display:block}
/* 声音选项：播放区（喇叭）与选择热区是分开的 */
.wb-rec-opt--audio{grid-template-rows:1fr auto;gap:10px}
.wb-rec-play{display:flex;flex-direction:column;align-items:center;gap:8px}
.wb-rec-play .wb-speak{width:56px;height:56px}
.wb-rec-play .wb-speak svg{width:26px;height:26px}
.wb-rec-playhint{font-size:calc(12px * var(--wb-scale));color:var(--wb-muted);letter-spacing:.06em}
.wb-rec-pick{font-size:calc(12.5px * var(--wb-scale));color:var(--wb-ink-soft);background:#FFF1EC;border:1px solid #FFD8CC;border-radius:999px;padding:5px 14px;letter-spacing:.08em}
/* 选中后的状态样式：选择器权重 0,3,0，高于 .wb-rec-opt:hover 的 0,2,0，
   所以鼠标停在已判题的选项上不会再被 hover 的白底/粉色边框盖掉 */
.wb-rec-opts .wb-rec-opt.wb-rec-opt--ok{border-color:#7FD9C4;background:#F1FBF8;transform:none;cursor:default}
.wb-rec-opts .wb-rec-opt.wb-rec-opt--ok .badge{color:#20A98F}
.wb-rec-opts .wb-rec-opt.wb-rec-opt--bad{border-color:var(--wb-red);background:#FFF2F2;transform:none;cursor:default}
.wb-rec-opts .wb-rec-opt.wb-rec-opt--bad .badge{color:var(--wb-red)}
.wb-rec-opts .wb-rec-opt.wb-rec-opt--muted{opacity:.55;background:#FCFAFE;border-color:var(--wb-line-strong);transform:none;cursor:default}
.wb-rec-finish{text-align:center;padding:16px 6px 6px}
.wb-rec-finish .icon{font-size:46px;line-height:1}
.wb-rec-finish h2{margin:10px 0 8px;font-size:calc(22px * var(--wb-scale));font-weight:700}
.wb-rec-finish p{margin:0 0 18px;color:var(--wb-ink-soft);font-size:calc(15px * var(--wb-scale));line-height:1.7}
.wb-rec-finish .acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}

/* ---------- 单词设置 ---------- */
.wb-art-preview{width:136px;aspect-ratio:4/3;object-fit:cover;border-radius:12px;border:1px solid var(--wb-line);background:#F7FBFF;flex:none}
.wb-art-acts{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
/* ---------- 标签 ---------- */
.wb-filters{display:flex;flex-wrap:wrap;gap:8px;margin:16px auto 0;max-width:980px}
.wb-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;background:#FBF8FF;border:1px solid var(--wb-line-strong);color:var(--wb-ink-soft);font-size:calc(13px * var(--wb-scale));transition:background .14s,border-color .14s,color .14s}
.wb-chip:hover{background:#F4EEFF;border-color:#E0D2FA}
.wb-chip[aria-pressed="true"]{background:linear-gradient(180deg,#FFA177,var(--wb-coral));border-color:var(--wb-coral);color:#fff;font-weight:600}
.wb-chip[aria-pressed="true"]:hover{background:linear-gradient(180deg,#FFA177,var(--wb-coral))}
.wb-chip-n{font-size:.82em;opacity:.7;font-family:var(--wb-mono)}
.wb-chip--clear{background:transparent;border-style:dashed;color:var(--wb-muted)}
.wb-tags{display:flex;flex-wrap:wrap;gap:5px;padding:8px 4px 0}
.wb-tag{font-size:calc(11px * var(--wb-scale));color:#7A6BA8;background:#F3EFFF;border:1px solid #E4DBFA;border-radius:999px;padding:2px 9px;line-height:1.6}

/* ---------- 新增单词浮层 ---------- */
.wb-pop-mask{position:fixed;inset:0;z-index:40}
.wb-pop{position:fixed;z-index:41;width:460px;background:#fff;border:1px solid var(--wb-line-strong);border-radius:16px;box-shadow:0 28px 56px -26px rgba(70,50,110,.55);padding:14px;animation:wb-fade .12s ease-out}
.wb-pop-head{font-size:calc(11.5px * var(--wb-scale));color:var(--wb-muted);letter-spacing:.08em;margin-bottom:9px}
.wb-pop-row{display:flex;gap:8px;align-items:center}
.wb-pop-row .wb-input{flex:1}
.wb-pop-hint{margin-top:9px;font-size:calc(11.5px * var(--wb-scale));color:var(--wb-muted);line-height:1.5}
/* 卡片右键菜单 */
.wb-menu-mask{position:fixed;inset:0;z-index:40}
.wb-menu{position:fixed;z-index:41;width:248px;background:#fff;border:1px solid var(--wb-line-strong);border-radius:16px;box-shadow:0 28px 56px -26px rgba(70,50,110,.55);padding:10px;animation:wb-fade .12s ease-out}
.wb-menu-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:2px 6px 10px}
.wb-menu-head b{font-family:var(--wb-hand);font-size:calc(21px * var(--wb-scale));font-weight:700}
.wb-menu-head span{font-size:calc(11.5px * var(--wb-scale));color:var(--wb-muted)}
.wb-menu-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 10px;border-radius:10px;background:transparent;border:0;color:var(--wb-ink);font-size:calc(13.5px * var(--wb-scale));line-height:1.4;cursor:pointer}
.wb-menu-item:hover{background:#F7F2FF}
.wb-menu-item[aria-checked="true"]{background:#F3FFF9;color:#1F8A73}
.wb-menu-item .tick{width:16px;text-align:center;font-weight:700;color:#20A98F}
.wb-menu-sep{margin:8px 6px;border-top:1px solid var(--wb-line)}
.wb-menu-empty{padding:10px 8px;color:var(--wb-muted);font-size:calc(12.5px * var(--wb-scale));line-height:1.7}

/* 设定里的标签编辑 */
.wb-taglist{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;min-height:28px}
.wb-tagitem{display:inline-flex;align-items:center;gap:6px;background:#F5F0FF;border:1px solid #E4DBFA;border-radius:999px;padding:4px 5px 4px 12px;font-size:calc(13px * var(--wb-scale));color:#6B5B94}
.wb-tagitem em{font-style:normal;font-family:var(--wb-mono);font-size:.8em;color:#9C8EC0;background:#EFE7FF;border-radius:999px;padding:1px 6px}
.wb-tagx{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:#E8DFFB;color:#6B5B94;font-size:12px;line-height:1;border:0;cursor:pointer}
.wb-tagx:hover{background:var(--wb-red);color:#fff}
.wb-tagnone{color:var(--wb-muted);font-size:calc(12.5px * var(--wb-scale));line-height:1.8}
.wb-tagadd{display:flex;gap:8px;align-items:center}
.wb-tagadd .wb-input{flex:1}

/* ---------- 设定面板 ---------- */
.wb-set-btn{display:inline-flex;align-items:center;gap:6px}
.wb-mask{position:absolute;inset:0;z-index:20;background:rgba(58,53,80,.32);backdrop-filter:blur(3px);display:grid;place-items:center;padding:24px;animation:wb-fade .18s ease-out}
.wb-settings{width:min(560px,100%);max-height:100%;overflow:auto;background:var(--wb-card);border-radius:22px;box-shadow:0 30px 60px -30px rgba(80,60,120,.6);padding:20px 24px 22px}
.wb-set-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.wb-set-head h2{margin:0;font-size:calc(18px * var(--wb-scale));font-weight:700}
.wb-set-close{width:32px;height:32px;border-radius:50%;font-size:20px;line-height:1;color:var(--wb-ink-soft);background:#FAF7FF;border:1px solid var(--wb-line-strong);display:grid;place-items:center}
.wb-set-close:hover{background:#F3EDFF;color:var(--wb-ink)}
.wb-field{display:block;margin-bottom:16px}
.wb-field > span{display:block;font-size:calc(12.5px * var(--wb-scale));color:var(--wb-muted);letter-spacing:.1em;margin-bottom:7px;font-weight:600}
.wb-path{display:block;padding:9px 12px;border-radius:10px;background:#FAF7FF;border:1px solid var(--wb-line-strong);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:calc(12.5px * var(--wb-scale));color:var(--wb-ink);line-height:1.55;word-break:break-all;user-select:all}
.wb-input{width:100%;font:inherit;font-size:calc(15px * var(--wb-scale));color:var(--wb-ink);background:#FCFAFE;border:1px solid var(--wb-line-strong);border-radius:10px;padding:9px 12px}
.wb-input::placeholder{color:#B9B2CC}
.wb-input:focus{outline:2px solid var(--wb-sky);outline-offset:1px;border-color:var(--wb-sky)}
.wb-seg{display:flex;gap:8px;flex-wrap:wrap}
.wb-seg button{font-size:calc(13px * var(--wb-scale));color:var(--wb-ink-soft);background:#FAF7FF;border:1px solid var(--wb-line-strong);border-radius:999px;padding:8px 16px;transition:background .16s,border-color .16s,color .16s}
.wb-seg button:hover{background:#F3EDFF}
.wb-seg button[aria-pressed="true"]{background:linear-gradient(180deg,#FFA177,var(--wb-coral));border-color:var(--wb-coral);color:#fff;font-weight:600}
.wb-set-note{margin:2px 0 18px;font-size:calc(12px * var(--wb-scale));line-height:1.7;color:var(--wb-muted)}
.wb-set-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}
.wb-set-hint{color:var(--wb-muted);font-size:calc(11.5px * var(--wb-scale))}

/* ---------- 空态 ---------- */
.wb-empty{margin:24px auto 0;max-width:980px;background:#fff;border:1px solid var(--wb-line);border-radius:var(--wb-r);padding:40px 24px;text-align:center;box-shadow:var(--wb-shadow);color:var(--wb-ink-soft);font-size:calc(14px * var(--wb-scale))}

/* ---------- 窄窗口 ---------- */
@media (max-width:820px){
  .wb-wrap{padding:8px 10px 32px}
  .wb-learn{padding:16px}
  .wb-rate{flex-direction:row;flex-wrap:wrap;justify-content:flex-end;justify-self:end;gap:7px}
  .wb-rate button{min-width:54px;padding:7px 7px;font-size:calc(10.5px * var(--wb-scale))}
  .wb-rate svg{display:none}
  .wb-learn-top{grid-template-columns:1fr;gap:14px}
  .wb-hero-tags{position:static;max-width:none;justify-content:flex-end;flex-wrap:wrap;padding-bottom:0;margin-bottom:2px}
  .wb-word{font-size:calc(52px * var(--wb-scale))}
  .wb-test{padding:16px 14px 18px}
  .wb-letters{padding:18px 0 14px;min-height:116px}
  .wb-hero h1{font-size:calc(28px * var(--wb-scale))}
  .wb-meta b{font-size:calc(21px * var(--wb-scale))}
}
/* 词组固定两栏，只有很窄时才收成一栏 */
@media (max-width:620px){
  .wb-phrs{grid-template-columns:1fr}
}
/* 面板太窄时降列数，避免卡片被压成一条 */
@media (max-width:760px){
  .wb-grid--4{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media (max-width:600px){
  .wb-grid--3,.wb-grid--4{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:460px){
  .wb-grid--2,.wb-grid--3,.wb-grid--4{grid-template-columns:1fr}
}
`;

    /* ============================== 持久状态 ==============================
       面板挂在 keyed 的 main 槽上：切到别的面板时组件会被卸载。
       状态放在模块作用域，重新挂载时原样取回，所以「切走再切回」不会丢进度。 */
    /* ============================== 设定 ==============================
       数据落在「单词本根目录」（宿主半边写盘），localStorage 只作为首屏缓存与迁移来源。 */
    const SETTINGS_KEY = 'wb.settings.v1';
    const HOST_BASE = '/suiji-word-book';
    const DEFAULT_ROOT_LABEL = '~/Documents/dsh/suiji-word-book/';
    const DEFAULT_WORKDIR_LABEL = '~/Documents/deepseek-harness/suiji-word-book/';
    const DEFAULT_SETTINGS = {
      title: '随记单词本',
      subtitle: '随手记一个词，看图、听音、拼一遍',
      groupBy: 'date',   // date | letter | length
      order: 'desc',     // desc | asc
      rootDir: '',
      showAddWord: false,
      skillInstalled: false,
      newSessionFullAccess: true
    };

    function loadSettings() {
      const out = Object.assign({}, DEFAULT_SETTINGS);
      try {
        const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
        if (raw && typeof raw === 'object') {
          if (typeof raw.title === 'string') out.title = raw.title;
          if (typeof raw.subtitle === 'string') out.subtitle = raw.subtitle;
          if (raw.groupBy === 'date' || raw.groupBy === 'letter' || raw.groupBy === 'length') out.groupBy = raw.groupBy;
          if (raw.order === 'asc' || raw.order === 'desc') out.order = raw.order;
        }
      } catch (e) {}
      return out;
    }

    /* ---------- 宿主通道 ---------- */
    function hostGet(path) {
      if (typeof fetch !== 'function') return Promise.resolve(null);
      return fetch(HOST_BASE + path, { headers: { accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }

    function hostOp(op, args) {
      if (typeof fetch !== 'function') return Promise.resolve(null);
      return fetch(HOST_BASE + '/api', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: op, args: args || {} })
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }

    /* ---------- 词库：全部来自「单词本根目录」 ---------- */
    function assetUrl(kind, rel) {
      const text = String(rel || '')
      if (!text) return ''
      if (/^(data:|https?:|\/)/.test(text)) return text
      return HOST_BASE + '/file?name=' + encodeURIComponent(text)
    }

    function applyDiskWords(list) {
      if (!Array.isArray(list) || !list.length) return false
      const out = list.map(function (w) {
        return {
          slug: w.slug,
          word: w.word,
          created: w.created || '',
          ipa: w.ipa || '',
          pos: w.pos || '',
          zh: w.zh || '',
          en: w.en || '',
          art: assetUrl('art', w.art),            // 默认插图资源路径
          customArt: assetUrl('art', w.customArt), // 自定义插图资源路径（空串表示没有）
          artAlt: w.artAlt || w.word,
          wordAudio: assetUrl('audio', w.wordAudio),
          phrases: (w.phrases || []).map(function (p) {
            return { en: p.en, zh: p.zh, audio: assetUrl('audio', p.audio) }
          }),
          sentence: w.sentence
            ? { en: w.sentence.en, zh: w.sentence.zh || '', audio: assetUrl('audio', w.sentence.audio) }
            : null
        }
      })
      out.sort(function (a, b) { return createdMs(a) - createdMs(b) })
      WORDS.length = 0
      out.forEach(function (w) { WORDS.push(w) })
      /* 给 UI 用的“有没有自定义插图”映射 */
      STORE.art = Object.create(null)
      list.forEach(function (w) { if (w.customArt) STORE.art[w.slug] = w.customArt })
      return true
    }
    function applyHostState(state, withSettings) {
      if (!state || typeof state !== 'object') return;
      if (withSettings !== false && state.settings && typeof state.settings === 'object') {
        STORE.settings = Object.assign({}, STORE.settings, state.settings);
      }
      if (Array.isArray(state.tagList)) STORE.tagList = state.tagList.slice();
      if (state.tags && typeof state.tags === 'object') STORE.tags = Object.assign(Object.create(null), state.tags);
      if (typeof state.rootDir === 'string' && state.rootDir) STORE.settings.rootDir = state.rootDir;
    }

    let saveTimer = null;
    let hostReady = false;

    function queueSave() {
      if (!hostReady) return;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        saveTimer = null;
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(STORE.settings)); } catch (e) {}
        hostOp('save', {
          settings: STORE.settings,
          tagList: STORE.tagList,
          tags: STORE.tags,
        }).then(function (res) { if (res && res.state) applyHostState(res.state, false); });
      }, 260);
    }

    /* 读一次磁盘状态：词库可能被外部（技能/agent）改过，所以每次挂载都刷新 */
    function refreshHostState() {
      return hostGet('/state').then(function (res) {
        if (!res || !res.ok) return
        const state = res.state || {}
        applyHostState(state)
        applyDiskWords(res.words)
        hostReady = true
        STORE.hostLoaded = true
        emit()
      })
    }

    /* 首次挂载：读磁盘上的状态；磁盘还空就把 localStorage 里的旧配置迁过去 */
    function bootHostState() {
      if (hostReady) return refreshHostState();
      return hostGet('/state').then(function (res) {
        if (!res || !res.ok) return;
        const state = res.state || {};
        const diskEmpty = !(state.tagList && state.tagList.length)
          && !(state.tags && Object.keys(state.tags).length)
          && (!state.settings || state.settings.title === DEFAULT_SETTINGS.title);
        const legacySettings = loadSettings();
        const legacyTags = loadTags();
        const legacyTagList = loadTagList();
        const hasLegacy = legacySettings.title !== DEFAULT_SETTINGS.title
          || legacyTagList.length > 0
          || Object.keys(legacyTags).length > 0;
        applyHostState(state);
        applyDiskWords(res.words);
        hostReady = true;
        if (diskEmpty && hasLegacy) {
          STORE.settings = Object.assign({}, STORE.settings, {
            title: legacySettings.title,
            subtitle: legacySettings.subtitle,
            groupBy: legacySettings.groupBy,
            order: legacySettings.order
          });
          if (!STORE.tagList.length) STORE.tagList = legacyTagList;
          if (!Object.keys(STORE.tags).length) STORE.tags = legacyTags;
          queueSave();
        }
        STORE.hostLoaded = true;
        emit();
      });
    }

    /* ---------- 标签：可选项存在 taglist，每个词的标签存在 tags ---------- */
    const TAGS_KEY = 'wb.tags.v1';
    const TAGLIST_KEY = 'wb.taglist.v1';

    function loadTagList() {
      const out = [];
      try {
        const raw = JSON.parse(localStorage.getItem(TAGLIST_KEY) || '[]');
        if (Array.isArray(raw)) {
          raw.forEach(function (t) {
            if (typeof t !== 'string') return;
            const s = t.trim();
            if (s && out.indexOf(s) < 0) out.push(s);
          });
        }
      } catch (e) {}
      return out;
    }

    function loadTags() {
      const out = Object.create(null);
      try {
        const raw = JSON.parse(localStorage.getItem(TAGS_KEY) || '{}');
        if (raw && typeof raw === 'object') {
          Object.keys(raw).forEach(function (k) {
            if (!Array.isArray(raw[k])) return;
            const list = [];
            raw[k].forEach(function (t) {
              if (typeof t !== 'string') return;
              const s = t.trim();
              if (s && list.indexOf(s) < 0) list.push(s);
            });
            if (list.length) out[k] = list;
          });
        }
      } catch (e) {}
      return out;
    }

    function saveTagList() {
      try { localStorage.setItem(TAGLIST_KEY, JSON.stringify(STORE.tagList)); } catch (e) {}
      queueSave();
    }
    function saveTags() {
      try { localStorage.setItem(TAGS_KEY, JSON.stringify(STORE.tags)); } catch (e) {}
      queueSave();
    }

    const STORE = {
      slug: null,      // null = 首页；否则是单词 slug
      testing: false,
      tests: Object.create(null),  // slug -> 练习进度
      settings: loadSettings(),
      settingsOpen: false,
      recognition: null,   // 单词辨认：{ questions, idx, picked, correct, done }
      tagList: loadTagList(),  // 可选的标签
      tags: loadTags(),        // slug -> ['学校', ...]
      art: Object.create(null), // slug -> 自定义插图相对路径（有值说明这个词换过图）
      pendingRoot: null,       // 换目录时等待用户确认是否迁移
      addWordState: '',        // 「+单词」提交后的提示
      addWordPop: null,        // 「+单词」浮层 { x, y }
      wordSettings: null,      // 单词详情设置弹窗 { slug }
      hostLoaded: false,        // 是否已从根目录读到状态
      filters: [],             // 首页正在筛选的标签
      menu: null,              // 右键菜单 { slug, x, y }
      lastView: '',
      listeners: new Set()
    };
    let pending = null;   // 自动翻题的延时句柄
    let badTimer = null;  // 答错闪红的复位句柄
    let lastAutoKey = null;  // 上一道自动发音过的题（slug#idx），避免同一题重复响
    let lastRecKey = null;   // 单词辨认里上一道自动播放的题号
    let tagDraft = '';       // 设定里正在输入的新标签名

    function subscribe(fn) {
      STORE.listeners.add(fn);
      return function () { STORE.listeners.delete(fn); };
    }
    function emit() {
      STORE.listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
    }
    function clearPending() {
      if (pending) { clearTimeout(pending); pending = null; }
    }

    function useStore() {
      const [, setTick] = useState(0);
      useEffect(function () {
        let alive = true;
        const off = subscribe(function () {
          if (alive) setTick(function (n) { return n + 1; });
        });
        return function () { alive = false; off(); };
      }, []);
      return STORE;
    }

    function findWord(slug) {
      for (let i = 0; i < WORDS.length; i++) if (WORDS[i].slug === slug) return WORDS[i];
      return null;
    }

    /* ============================== 工具 ============================== */
    const audioCache = new Map();
    /* rate 只作用这一次播放，不落任何全局设置；缓存的是同一个 Audio 对象，
       所以每次都要显式写回 playbackRate（正常播放就是 1） */
    function play(src, rate) {
      if (!src) return;
      let a = audioCache.get(src);
      if (!a) {
        a = new Audio(src);
        audioCache.set(src, a);
      }
      try {
        a.preservesPitch = true;          // 变速不变调（默认就是 true，写明以防万一）
        a.playbackRate = rate || 1;
      } catch (e) {}
      try { a.currentTime = 0; } catch (e) {}
      const p = a.play();
      if (p && p.catch) p.catch(function () {});
    }

    const SPEAKER = h('svg', { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
      h('path', { d: 'M4 9.5v5a1 1 0 0 0 1 1h3l4.2 3.4A1 1 0 0 0 14 18V6a1 1 0 0 0-1.6-.8L8 8.5H5a1 1 0 0 0-1 1z', fill: 'currentColor' }),
      h('path', { d: 'M17.2 8.6a5 5 0 0 1 0 6.8M19.6 6.2a8.4 8.4 0 0 1 0 11.6', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' })
    );

    /* 单词卡右边缘的倍速选项（1× 就是正常那一下，不必重复列） */
    const RATE_STEPS = [0.5, 0.75, 1.25, 1.5];

    /* 书本图标：currentColor，跟随侧栏图标色 */
    function BookGlyph(props) {
      const size = props && props.size ? props.size : 22;
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.55, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true
      },
        h('path', { d: 'M12 6.5C10.4 5.2 8.4 4.6 6.3 4.6H4.7v13.2h1.6c2.1 0 4.1.6 5.7 1.7 1.6-1.1 3.6-1.7 5.7-1.7h1.6V4.6h-1.6c-2.1 0-4.1.6-5.7 1.9z', fill: 'currentColor', fillOpacity: .14 }),
        h('path', { d: 'M12 6.7v12.7' })
      );
    }

    /* 喇叭按钮：tone = mint（词组）/ amber（例句） */
    function Speak(props) {
      let cls = 'wb-speak';
      if (props.small) cls += ' wb-speak--sm';
      if (props.tone) cls += ' wb-speak--' + props.tone;
      return h('button', {
        type: 'button',
        className: cls,
        title: props.title || '发音',
        'aria-label': props.title || '发音',
        onClick: function (e) { e.stopPropagation(); play(props.src); }
      }, SPEAKER);
    }

    /* ============================== 出题 ============================== */
    function letterIdx(word) {
      const out = [];
      for (let i = 0; i < word.length; i++) if (/[a-z]/i.test(word[i])) out.push(i);
      return out;
    }

    function planCounts(n, total) {
      const seq = [1];
      if (n >= 3) seq.push(1);
      for (let k = 2; k <= n; k++) seq.push(k);
      while (seq.length < total - 1) seq.push(1 + Math.floor(Math.random() * Math.max(1, n - 1)));
      if (seq[seq.length - 1] === n) seq.push(1);
      seq.push(n);
      return seq;
    }

    /* 加权抽空：被挖过的字母权重降低，整轮下来每个字母都能轮到 */
    function chooseMask(letters, k, used) {
      const pool = letters.slice();
      const picked = [];
      const take = Math.min(k, pool.length);
      if (take === letters.length) return letters.slice();
      while (picked.length < take) {
        const w = [];
        let total = 0;
        for (let i = 0; i < pool.length; i++) {
          const wt = 1 / (1 + (used[pool[i]] || 0));
          w.push(wt);
          total += wt;
        }
        let r = Math.random() * total;
        let acc = 0;
        let pick = pool.length - 1;
        for (let i = 0; i < pool.length; i++) {
          acc += w[i];
          if (r <= acc) { pick = i; break; }
        }
        picked.push(pool.splice(pick, 1)[0]);
      }
      picked.sort(function (a, b) { return a - b; });
      return picked;
    }

    function buildPlan(word) {
      const letters = letterIdx(word);
      const n = letters.length;
      const total = Math.max(10, Math.min(30, n + 6));
      const used = {};
      let prev = '';
      return planCounts(n, total).map(function (k) {
        let mask = chooseMask(letters, k, used);
        let key = mask.join(',');
        let guard = 0;
        while (key === prev && guard < 40 && k < n) {
          mask = chooseMask(letters, k, used);
          key = mask.join(',');
          guard++;
        }
        for (let i = 0; i < mask.length; i++) used[mask[i]] = (used[mask[i]] || 0) + 1;
        prev = key;
        return mask;
      });
    }

    function mkRound(mask) {
      return { mask: mask, filled: [], ptr: 0, err: 0, hints: 0 };
    }

    function freshTest(slug) {
      const w = findWord(slug);
      const plan = w ? buildPlan(w.word) : [1];
      return { plan: plan, idx: 0, round: mkRound(plan[0]), solved: false, done: false, bad: null, stats: { keys: 0, wrong: 0, clean: 0, skips: 0 } };
    }

    function testOf(slug) {
      let t = STORE.tests[slug];
      if (!t) t = STORE.tests[slug] = freshTest(slug);
      return t;
    }

    /* ============================== 导航动作 ============================== */
    function openWord(slug) {
      clearPending();
      STORE.slug = slug;
      STORE.testing = false;
      STORE.menu = null;
      emit();
    }
    function goHome() {
      clearPending();
      STORE.slug = null;
      STORE.testing = false;
      STORE.menu = null;
      emit();
    }
    function startTest() {
      if (STORE.slug) testOf(STORE.slug);
      lastAutoKey = null;
      STORE.testing = true;
      emit();
    }
    function exitTest() {
      clearPending();
      STORE.testing = false;
      emit();
    }

    /* ============================== 练习动作 ============================== */
    function goTo(slug, i) {
      const t = testOf(slug);
      t.idx = i;
      t.round = mkRound(t.plan[i]);
      t.solved = false;
      t.bad = null;
      emit();
    }

    function flashBad(slug) {
      const t = testOf(slug);
      t.bad = t.round.ptr;
      emit();
      if (badTimer) clearTimeout(badTimer);
      badTimer = setTimeout(function () {
        badTimer = null;
        const x = STORE.tests[slug];
        if (x) { x.bad = null; emit(); }
      }, 300);
    }

    function afterSolved(slug) {
      const t = STORE.tests[slug];
      if (!t) return;
      if (t.idx + 1 >= t.plan.length) t.done = true;
      else {
        t.idx += 1;
        t.round = mkRound(t.plan[t.idx]);
        t.solved = false;
        t.bad = null;
      }
      emit();
    }

    function solve(slug) {
      const t = testOf(slug);
      const clean = t.round.err === 0 && t.round.hints === 0;
      t.solved = true;
      t.stats.keys += 1;
      if (clean) t.stats.clean += 1;
      play(findWord(slug).wordAudio);
      clearPending();
      pending = setTimeout(function () { pending = null; afterSolved(slug); }, 950);
      emit();
    }

    function typeChar(slug, ch) {
      const t = testOf(slug);
      if (t.solved || t.done) return;
      const word = findWord(slug).word;
      const target = String(word[t.round.mask[t.round.ptr]]).toLowerCase();
      if (ch === target) {
        t.round.filled[t.round.ptr] = ch;
        t.round.ptr += 1;
        if (t.round.ptr >= t.round.mask.length) solve(slug);
        else { t.stats.keys += 1; emit(); }
      } else {
        t.round.err += 1;
        t.stats.keys += 1;
        t.stats.wrong += 1;
        flashBad(slug);
      }
    }

    function hintChar(slug) {
      const t = testOf(slug);
      if (t.solved || t.done) return;
      if (t.round.ptr >= t.round.mask.length) return;
      const word = findWord(slug).word;
      t.round.filled[t.round.ptr] = word[t.round.mask[t.round.ptr]];
      t.round.hints += 1;
      t.round.ptr += 1;
      if (t.round.ptr >= t.round.mask.length) solve(slug);
      else emit();
    }

    function skipRound(slug) {
      const t = testOf(slug);
      if (t.done) return;
      t.stats.skips += 1;
      clearPending();
      if (t.idx + 1 >= t.plan.length) { t.done = true; emit(); }
      else goTo(slug, t.idx + 1);
    }

    function nextRound(slug) {
      const t = testOf(slug);
      clearPending();
      if (t.idx + 1 >= t.plan.length) { t.done = true; emit(); }
      else goTo(slug, t.idx + 1);
    }

    function restartTest(slug) {
      clearPending();
      STORE.tests[slug] = freshTest(slug);
      lastAutoKey = null;
      emit();
    }

    /* ============================== 单词辨认 ==============================
       12 种题型 = {听音, 看词, 看图, 看释义} × {选单词, 选释义, 选图, 选声音}
       里所有「提示 ≠ 答案」的组合。固定 20 题、题目不重复、每题 4 个选项且顺序随机。
       图和声音的干扰项只能来自词库；单词和释义的干扰项 = 词库里的 + 相近写法/相近释义。 */
    const REC_TOTAL = 20;
    const REC_KINDS = ['audio', 'word', 'art', 'zh'];
    const REC_TYPES = [];
    REC_KINDS.forEach(function (p) {
      REC_KINDS.forEach(function (a) { if (p !== a) REC_TYPES.push({ p: p, a: a }); });
    });

    const REC_LABEL = {
      'audio>word': '听发音，选出单词',
      'audio>zh': '听发音，选出中文意思',
      'audio>art': '听发音，选出对应的图片',
      'word>audio': '看单词，选出它的发音',
      'word>zh': '看单词，选出中文意思',
      'word>art': '看单词，选出对应的图片',
      'art>audio': '看图片，选出它的发音',
      'art>word': '看图片，选出对应的单词',
      'art>zh': '看图片，选出中文意思',
      'zh>audio': '看中文意思，选出它的发音',
      'zh>word': '看中文意思，选出单词',
      'zh>art': '看中文意思，选出对应的图片'
    };

    /* 近义干扰项：不是这个词的释义，但意思贴近，用来当混淆项 */
    const ZH_NEAR = {
      move: ['挪动；移开', '走动'],
      forward: ['朝前；正前方', '前进的'],
      turn: ['旋转；拐弯', '转动方向'],
      left: ['左边；左手边', '左边的'],
      right: ['右边；右手边', '右边的'],
      name: ['称呼；姓名', '叫法'],
      space: ['空位；地方', '空地儿'],
      shear: ['剪下；割掉', '修剪'],
      include: ['包含在内', '算在一起'],
      return: ['返回；交还', '回程'],
      destroy: ['毁掉；弄坏', '破坏掉'],
      touch: ['碰到；接触', '触碰一下'],
      main: ['次要的', '一般的'],
      for: ['和；跟', '在……上面'],
      book: ['本子；练习本', '册子'],
      dog: ['狗崽', '狗狗'],
      listen: ['听见；听到', '倾听'],
      look: ['看见；看到', '瞧一瞧'],
      me: ['我自己', '我的'],
      to: ['朝；往', '给'],
      you: ['你自己', '您的'],
      door: ['门口', '大门'],
      open: ['开；开启', '张开'],
      the: ['一个；某个', '每一个'],
      classroom: ['课堂；班上', '学校里'],
      game: ['比赛；球赛', '玩具']
    };

    function shuffle(list) {
      const a = list.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    /* 编辑距离：用来挑「长得像」的**真词**当干扰项（绝不做拼写错误的假词） */
    function editDistance(a, b) {
      const m = a.length, n = b.length;
      let prev = [];
      for (let j = 0; j <= n; j++) prev[j] = j;
      for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
          cur[j] = Math.min(
            prev[j] + 1,
            cur[j - 1] + 1,
            prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
          );
        }
        prev = cur;
      }
      return prev[n];
    }

    /* 词库之外的真实近义词候选：用来做「长得像」的干扰项。
       全部是标准英语单词，不是拼音字符串；不会与词库里的词重复（下面会过滤）。 */
    const NEAR_WORDS = {
      move: ['movie', 'remove', 'mood', 'love', 'more', 'mole'],
      forward: ['foreword', 'toward', 'onward', 'upward', 'backward', 'afterwards'],
      turn: ['return', 'burn', 'turnip', 'tune', 'torn', 'churn'],
      left: ['lift', 'loft', 'felt', 'lent', 'deft', 'cleft'],
      right: ['bright', 'light', 'night', 'tight', 'fight', 'sight'],
      name: ['game', 'frame', 'same', 'lame', 'fame', 'tame'],
      space: ['pace', 'place', 'spice', 'spare', 'stage', 'spark'],
      shear: ['share', 'sheer', 'spear', 'smear', 'swear', 'sharp'],
      include: ['exclude', 'conclude', 'preclude', 'closure', 'inclusive'],
      return: ['retort', 'refund', 'retail', 'retire', 'retain', 'turn'],
      destroy: ['destruct', 'destroyer', 'detour', 'deploy', 'detect', 'delight'],
      touch: ['tough', 'torch', 'couch', 'taught', 'touchy'],
      main: ['rain', 'mail', 'gain', 'man', 'mind', 'pain'],
      for: ['far', 'four', 'fork', 'form', 'fur'],
      book: ['cook', 'took', 'hook', 'broke', 'brook'],
      dog: ['dig', 'log', 'dot', 'doll', 'fog', 'dug'],
      listen: ['glisten', 'lesson', 'listless', 'listener'],
      look: ['cook', 'took', 'hook', 'lock', 'nook'],
      me: ['be', 'we', 'he', 'my', 'men', 'meet'],
      to: ['do', 'so', 'two', 'too', 'top', 'toe'],
      you: ['your', 'yours', 'youth', 'young'],
      door: ['poor', 'deer', 'dear', 'doom', 'doze'],
      open: ['oven', 'pen', 'opener', 'happen'],
      the: ['them', 'then', 'they', 'these', 'those'],
      classroom: ['classmate', 'classwork', 'schoolroom', 'class'],
      game: ['gate', 'came', 'fame', 'lame', 'tame']
    };

    /* 选单词题的三个干扰项：**一半相近拼写、一半来自词库**
       —— 相近拼写优先取词库外近义词表里距离最短的（最多 2 个），再补 1 个词库里的常用词。 */
    function wordDistractors(target, count) {
      const used = Object.create(null);
      used[target.word] = 1;
      const out = [];

      const near = (NEAR_WORDS[target.slug] || [])
        .map(function (v) { return String(v || '').toLowerCase(); })
        .filter(function (v) { return /^[a-z]+$/.test(v) && !used[v]; })
        .map(function (v) { return { v: v, d: editDistance(target.word, v) }; })
        .sort(function (a, b) { return a.d - b.d; })
        .slice(0, 4);

      const nearWant = Math.min(2, Math.max(0, count - 1));
      shuffle(near).slice(0, nearWant).forEach(function (x) {
        if (out.length >= count || used[x.v]) return;
        used[x.v] = 1;
        out.push(x.v);
      });

      /* 剩下的从词库里补：优先挑跟目标词距离最近的若干个，再随机（池子放宽到 6 个，避免总是同一个词） */
      const bank = WORDS
        .filter(function (w) { return w.slug !== target.slug && !used[w.word]; })
        .map(function (w) { return { v: w.word, d: editDistance(target.word, w.word) }; })
        .sort(function (a, b) { return a.d - b.d; })
        .slice(0, 6);

      shuffle(bank).forEach(function (x) {
        if (out.length >= count || used[x.v]) return;
        used[x.v] = 1;
        out.push(x.v);
      });

      /* 极端兜底：还不够就再用词库里的其他词 */
      WORDS.forEach(function (w) {
        if (out.length >= count || used[w.word]) return;
        used[w.word] = 1;
        out.push(w.word);
      });

      return out.slice(0, count);
    }

    function makeRecognition(word, type) {
      const others = shuffle(WORDS.filter(function (w) { return w.slug !== word.slug; }));
      const opts = [];

      if (type.a === 'art' || type.a === 'audio') {
        /* 图片 / 声音只能从词库里取 */
        opts.push({ entry: word, correct: true });
        others.slice(0, 3).forEach(function (w) { opts.push({ entry: w, correct: false }); });
      } else if (type.a === 'zh') {
        opts.push({ value: word.zh, correct: true });
        others.slice(0, 2).forEach(function (w) { opts.push({ value: w.zh, correct: false }); });
        const near = shuffle(ZH_NEAR[word.slug] || []).filter(function (s) {
          return s !== word.zh;
        })[0];
        opts.push(near ? { value: near, correct: false, near: true }
                       : { value: others[2].zh, correct: false });
      } else {
        /* 选单词：三个干扰项都是**真实存在的英语单词**（词库内或词库外都行），只是长得像 */
        opts.push({ value: word.word, correct: true });
        wordDistractors(word, 3).forEach(function (v) {
          opts.push({ value: v, correct: false, near: true });
        });
      }

      /* 兜底去重：万一两个干扰项撞了，补一个没被用过的词库项 */
      const seen = Object.create(null);
      const dedup = [];
      opts.forEach(function (o) {
        const k = o.entry ? 'e:' + o.entry.slug : 'v:' + o.value;
        if (seen[k]) return;
        seen[k] = 1;
        dedup.push(o);
      });
      if (dedup.length < 4) {
        others.forEach(function (w) {
          if (dedup.length >= 4) return;
          const k = type.a === 'word' ? w.word : w.zh;
          const key = 'v:' + k;
          if (seen[key]) return;
          seen[key] = 1;
          dedup.push({ value: k, correct: false });
        });
      }

      return { word: word, p: type.p, a: type.a, options: shuffle(dedup.slice(0, 4)) };
    }

    /* 整套题都围绕「当前这个词」：12 种题型先各来一次，再随机补到 20 题，
       所以有 8 种题型会出现两次；同题型的干扰项每次重新抽，题目不会完全一样。 */
    function buildRecognition(anchorSlug) {
      const anchor = findWord(anchorSlug) || WORDS[0];
      const total = Math.max(REC_TYPES.length, REC_TOTAL);
      let types = shuffle(REC_TYPES);
      while (types.length < total) types = types.concat(shuffle(REC_TYPES));
      types = shuffle(types.slice(0, total));
      const questions = types.map(function (t) { return makeRecognition(anchor, t); });
      return { anchor: anchor.slug, questions: questions, idx: 0, picked: -1, correct: 0, done: false };
    }

    function startRecognition() {
      const anchor = (STORE.recognition && STORE.recognition.anchor) || STORE.slug || (WORDS[0] && WORDS[0].slug);
      clearPending();
      lastRecKey = null;
      STORE.recognition = buildRecognition(anchor);
      emit();
    }
    function exitRecognition() {
      clearPending();
      lastRecKey = null;
      STORE.recognition = null;
      emit();
    }
    function answerRecognition(i) {
      const r = STORE.recognition;
      if (!r || r.done || r.picked >= 0) return;
      const q = r.questions[r.idx];
      const opt = q.options[i];
      r.picked = i;
      if (opt && opt.correct) r.correct += 1;
      emit();
      clearPending();
      pending = setTimeout(function () {
        pending = null;
        nextRecognition();
      }, opt && opt.correct ? 850 : 1500);
    }
    function nextRecognition() {
      const r = STORE.recognition;
      if (!r) return;
      clearPending();
      if (r.idx + 1 >= r.questions.length) { r.done = true; r.picked = -1; emit(); return; }
      r.idx += 1;
      r.picked = -1;
      emit();
    }

    /* ============================== 设定动作 ============================== */
    function saveSettings() {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(STORE.settings)); } catch (e) {}
      queueSave();
    }
    function patchSettings(patch) {
      Object.assign(STORE.settings, patch);
      saveSettings();
      emit();
    }
    function resetSettings() {
      Object.assign(STORE.settings, DEFAULT_SETTINGS);
      saveSettings();
      emit();
    }
    function openSettings() { STORE.settingsOpen = true; emit(); }
    function closeSettings() { STORE.settingsOpen = false; emit(); }

    /* ============================== 标签动作 ============================== */
    function tagsOf(slug) { return STORE.tags[slug] || []; }

    function toggleWordTag(slug, tag) {
      const cur = tagsOf(slug);
      const next = cur.indexOf(tag) >= 0
        ? cur.filter(function (t) { return t !== tag; })
        : cur.concat(tag);
      if (next.length) STORE.tags[slug] = next;
      else delete STORE.tags[slug];
      saveTags();
      emit();
    }

    function addTagOption(name) {
      const t = String(name || '').trim();
      if (!t) return false;
      if (STORE.tagList.indexOf(t) >= 0) return false;
      STORE.tagList = STORE.tagList.concat(t);
      saveTagList();
      emit();
      return true;
    }

    function removeTagOption(name) {
      if (STORE.tagList.indexOf(name) < 0) return;
      STORE.tagList = STORE.tagList.filter(function (t) { return t !== name; });
      Object.keys(STORE.tags).forEach(function (k) {
        STORE.tags[k] = STORE.tags[k].filter(function (t) { return t !== name; });
        if (!STORE.tags[k].length) delete STORE.tags[k];
      });
      STORE.filters = STORE.filters.filter(function (t) { return t !== name; });
      saveTagList();
      saveTags();
      emit();
    }

    function toggleFilter(tag) {
      const on = STORE.filters.indexOf(tag) >= 0;
      STORE.filters = on
        ? STORE.filters.filter(function (t) { return t !== tag; })
        : STORE.filters.concat(tag);
      emit();
    }

    function clearFilters() {
      if (!STORE.filters.length) return;
      STORE.filters = [];
      emit();
    }

    /* ---------- 根目录 / 技能 / 自定义插图 ---------- */
    let rootDraft = '';   // 输入中的根目录；空 = 用设置里的值

    /* 页面用图就一句：自定义有值用自定义，否则用默认 */
    function artOf(w) {
      if (!w) return '';
      return w.customArt || w.art || '';
    }

    function applyHostResult(res, withSettings) {
      if (!res) return;
      if (res.state) applyHostState(res.state, withSettings);
      if (res.skillDir) STORE.settings.skillInstalled = true;
      rootDraft = STORE.settings.rootDir || '';
      emit();
    }

    /* 用系统原生的目录选择对话框挑一个目录（宿主弹窗，桌面端同一台机器） */
    function pickFolder(kind) {
      hostOp('pick-folder', {}).then(function (res) {
        if (!res) return;
        if (!res.ok) { STORE.addWordState = res.error || '打开目录选择器失败'; emit(); return; }
        const chosen = String(res.path || '').trim();
        if (!chosen) return;
        if (kind === 'workDir') { patchSettings({ workDir: chosen }); return; }
        rootDraft = chosen;
        emit();
        applyRootDir(chosen);
      });
    }

    function openRootFolder(dir) {
      hostOp('open-folder', { path: dir || '' }).then(function (res) {
        if (res && res.ok) {
          STORE.addWordState = '已打开 ' + res.path;
        }
      });
    }
    function applyRootDir(value) {
      const next = String(value == null ? rootDraft : value).trim();
      hostOp('root', { rootDir: next }).then(function (res) {
        if (!res) return;
        if (res.needsMigration) {
          STORE.pendingRoot = res.target;
          emit();
          return;
        }
        applyHostResult(res);
      });
    }

    function confirmRootDir(migrate) {
      const target = STORE.pendingRoot;
      if (!target) return;
      STORE.pendingRoot = null;
      hostOp('root', { rootDir: target, migrate: Boolean(migrate) }).then(applyHostResult);
    }

    function installSkill() {
      hostOp('install-skill', {}).then(function (res) {
        if (res && res.ok) {
          patchSettings({ skillInstalled: true });
          applyHostResult(res, false);
        }
      });
    }

    function setWordArt(slug, dataUrl) {
      hostOp('art', { slug: slug, dataUrl: dataUrl }).then(function (res) {
        if (res && res.words) applyDiskWords(res.words);
        applyHostResult(res);
        emit();
      });
    }

    function clearWordArt(slug) {
      hostOp('art-clear', { slug: slug }).then(function (res) {
        if (res && res.words) applyDiskWords(res.words);
        applyHostResult(res);
        emit();
      });
    }

    /* 打开系统文件选择框，选完把图片交给宿主写进根目录 */
    function pickWordArt(slug) {
      if (typeof document === 'undefined') return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = function () {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () { setWordArt(slug, String(reader.result || '')); };
        reader.readAsDataURL(file);
      };
      input.click();
    }
    /* ---------- 新增单词（交给技能去做） ---------- */
    let addWordDraft = '';

    /* 新建会话后切过去。
       官方用法是 ctx.uiWorkspace.openSession(sessionId)（直接传 id 字符串，见 ui-chat 里的调用）；
       传成 { kind: 'session', sessionId } 会被当成无效目标，界面就落到空白会话上。
       切不动时依次退让：先 openWorkspace(工作区) 再 openSession，最后写路由刷新。 */
    function clientWorkspaceId(res) {
      const svc = ctxRef && ctxRef.get ? ctxRef.get('uiWorkspace') : null
      try {
        const items = svc && svc.workspaces && svc.workspaces.model && svc.workspaces.model.items
        if (Array.isArray(items)) {
          const hit = items.find(function (w) { return w && w.path === res.workDir })
          if (hit) return hit.workspaceId || hit.id || ''
        }
      } catch (e) {}
      return res.workspaceId || ''
    }

    function openCreatedSession(res) {
      if (!res || !res.sessionId) return
      const svc = ctxRef && ctxRef.get ? ctxRef.get('uiWorkspace') : null
      if (!svc) return
      const onPanel = function () { return !!document.querySelector('.wb-root') }
      const open = function () {
        try { svc.openSession(res.sessionId) } catch (e) {}
      }

      STORE.addWordState = '会话已创建，正在切过去…'
      emit()

      /* 等会话在客户端就绪 */
      setTimeout(function () {
        open()
        setTimeout(function () {
          if (!onPanel()) return
          const id = clientWorkspaceId(res)
          if (id && typeof svc.openWorkspace === 'function') {
            Promise.resolve()
              .then(function () { return svc.openWorkspace(id) })
              .then(function () { open() })
              .catch(function () { open() })
          }
          /* 最后兜底：写路由并刷新 */
          setTimeout(function () {
            if (!onPanel()) return
            try {
              localStorage.setItem('dsh.sessions.current', JSON.stringify({
                subagentAddress: { kind: 'session', sessionId: res.sessionId }
              }))
              location.reload()
            } catch (e) {}
          }, 1200)
        }, 900)
      }, 700)
    }
    function submitAddWords() {
      const words = String(addWordDraft || '')
        .split(/[,，\s]+/)
        .map(function (w) { return w.trim().toLowerCase(); })
        .filter(function (w) { return /^[a-z][a-z'-]*$/.test(w); });
      if (!words.length) return;
      STORE.addWordState = '正在新建会话…';
      emit();
      hostOp('add-words', { words: words }).then(function (res) {
        if (res && res.ok) {
          STORE.addWordState = '已新建会话，正在让技能制作 ' + words.length + ' 张单词卡';
          addWordDraft = '';
          STORE.addWordPop = null;
          openCreatedSession(res);
        } else {
          STORE.addWordState = (res && res.error) || '没能新建会话';
        }
        emit();
      });
    }

    let ctxRef = null;

    /* ---------- 单词详情设置弹窗 ---------- */
    function openWordSettings(slug) { STORE.wordSettings = { slug: slug }; emit(); }
    function closeWordSettings() { STORE.wordSettings = null; emit(); }
    function openTagMenu(slug, x, y) {
      STORE.menu = { slug: slug, x: Number(x) || 0, y: Number(y) || 0 };
      emit();
    }
    function closeTagMenu() {
      if (!STORE.menu) return;
      STORE.menu = null;
      emit();
    }

    /* ============================== 分组 ============================== */
    function groupKeyOf(w, mode) {
      if (mode === 'letter') return (w.word[0] || '').toUpperCase();
      if (mode === 'length') return String(w.word.replace(/[^a-zA-Z]/g, '').length);
      return String(w.created || '').slice(0, 10);
    }
    function groupLabelOf(mode, key) {
      if (mode === 'letter') return key || '其他';
      if (mode === 'length') return key + ' 个字母';
      return key || '未标注日期';
    }
    /* 组内始终按加入时间从早到晚（沿用「同一日期按时间顺序」的约定），
       排序方向只作用于**组与组之间** */
    function groupedWords() {
      const mode = STORE.settings.groupBy;
      const dir = STORE.settings.order === 'asc' ? 1 : -1;
      const map = new Map();
      visibleWords().forEach(function (w) {
        const k = groupKeyOf(w, mode);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(w);
      });
      const keys = Array.from(map.keys()).sort(function (a, b) {
        let r;
        if (mode === 'length') r = Number(a) - Number(b);
        else if (a === b) r = 0;
        else r = String(a) < String(b) ? -1 : 1;
        return r * dir;
      });
      return keys.map(function (k) {
        return { key: k, label: groupLabelOf(mode, k), words: map.get(k) };
      });
    }

    /* 首页可见的单词：没有筛选就是全部，否则是「命中任意一个选中标签」的词 */
    function visibleWords() {
      if (!STORE.filters.length) return WORDS;
      return WORDS.filter(function (w) {
        const t = tagsOf(w.slug);
        return STORE.filters.some(function (f) { return t.indexOf(f) >= 0; });
      });
    }

    /* ============================== 视图 ============================== */
    function WordCard(props) {
      const w = props.entry;
      return h('button', {
        type: 'button',
        className: 'wb-card',
        'data-slug': w.slug,
        title: '左键打开，右键选标签',
        onClick: function () { openWord(w.slug); },
        onContextMenu: function (ev) {
          if (ev && ev.preventDefault) ev.preventDefault();
          openTagMenu(w.slug, ev && ev.clientX, ev && ev.clientY);
        }
      },
        h('span', { className: 'wb-thumb' },
          artOf(w) ? h('img', { src: artOf(w), alt: w.artAlt || w.word, draggable: false })
            : h('span', { style: { fontSize: '34px' } }, '📖')
        ),
        h('span', { className: 'wb-meta' },
          h('b', null, w.word),
          h('span', null, w.zh)
        ),
        tagsOf(w.slug).length ? h('span', { className: 'wb-tags' },
          tagsOf(w.slug).map(function (t) { return h('span', { className: 'wb-tag', key: t }, t); })
        ) : null
      );
    }

    /* 顶部的标签筛选（多选，命中任意一个即显示） */
    function TagFilters() {
      if (!STORE.tagList.length) return null;
      return h('div', { className: 'wb-filters', role: 'group', 'aria-label': '按标签筛选' },
        STORE.tagList.map(function (t) {
          const active = STORE.filters.indexOf(t) >= 0;
          const n = WORDS.filter(function (w) { return tagsOf(w.slug).indexOf(t) >= 0; }).length;
          return h('button', {
            key: t,
            type: 'button',
            className: 'wb-chip',
            'aria-pressed': active ? 'true' : 'false',
            title: active ? '取消筛选 ' + t : '只看 ' + t,
            onClick: function () { toggleFilter(t); }
          }, t, h('span', { className: 'wb-chip-n' }, String(n)));
        }),
        STORE.filters.length ? h('button', {
          type: 'button',
          className: 'wb-chip wb-chip--clear',
          onClick: clearFilters
        }, '清除筛选') : null
      );
    }

    function Home() {
      const s = STORE.settings;
      const groups = groupedWords();
      const total = visibleWords().length;
      return h('div', null,
        h('div', { className: 'wb-hero' },
          h('h1', null, s.title || DEFAULT_SETTINGS.title),
          s.subtitle ? h('p', null, s.subtitle) : null
        ),
        h(TagFilters),
        groups.map(function (g) {
          const cols = g.words.length <= 2 ? 2 : (g.words.length === 3 ? 3 : 4);
          return h('div', { className: 'wb-group', key: 'g-' + g.key },
            h('h3', null, g.label),
            h('div', { className: 'wb-grid wb-grid--' + cols },
              g.words.map(function (w) { return h(WordCard, { key: w.slug, entry: w }); })
            )
          );
        }),
        !groups.length
          ? h('div', { className: 'wb-empty' }, '这些标签下还没有单词。右键卡片给单词加标签。')
          : null,
        h('p', { className: 'wb-foot' },
          STORE.filters.length
            ? '筛选出 ' + total + ' 个单词（共 ' + WORDS.length + ' 个）'
            : '共 ' + WORDS.length + ' 个单词')
      );
    }

    /* 分段选择器 */
    function Seg(props) {
      return h('div', { className: 'wb-seg' },
        props.options.map(function (o) {
          return h('button', {
            key: o.v,
            type: 'button',
            'aria-pressed': props.value === o.v ? 'true' : 'false',
            onClick: function () {
              const patch = {};
              patch[props.field] = o.v;
              patchSettings(patch);
            }
          }, o.label);
        })
      );
    }

    function SettingsPanel() {
      const s = STORE.settings;
      return h('div', {
        className: 'wb-mask',
        onClick: function (ev) { if (ev.target === ev.currentTarget) closeSettings(); }
      },
        h('div', { className: 'wb-settings', role: 'dialog', 'aria-modal': 'true', 'aria-label': '设定' },
          h('div', { className: 'wb-set-head' },
            h('h2', null, '设定'),
            h('button', { type: 'button', className: 'wb-set-close', onClick: closeSettings, 'aria-label': '关闭' }, '×')
          ),
          h('label', { className: 'wb-field' },
            h('span', null, '首页标题'),
            h('input', {
              className: 'wb-input',
              value: s.title,
              maxLength: 24,
              placeholder: DEFAULT_SETTINGS.title,
              onChange: function (ev) { patchSettings({ title: ev.target.value }); }
            })
          ),
          h('label', { className: 'wb-field' },
            h('span', null, '副标题'),
            h('input', {
              className: 'wb-input',
              value: s.subtitle,
              maxLength: 80,
              placeholder: DEFAULT_SETTINGS.subtitle,
              onChange: function (ev) { patchSettings({ subtitle: ev.target.value }); }
            })
          ),
          h('div', { className: 'wb-field' },
            h('span', null, '分组方式'),
            h(Seg, {
              field: 'groupBy',
              value: s.groupBy,
              options: [
                { v: 'date', label: '按日期' },
                { v: 'letter', label: '按首字母' },
                { v: 'length', label: '按字母数量' }
              ]
            })
          ),
          h('div', { className: 'wb-field' },
            h('span', null, '排序方向'),
            h(Seg, {
              field: 'order',
              value: s.order,
              options: [
                { v: 'desc', label: '倒序' },
                { v: 'asc', label: '顺序' }
              ]
            })
          ),
          h('p', { className: 'wb-set-note' }, '排序方向决定组与组之间的先后；每组内部始终按加入时间从早到晚。'),
          h('div', { className: 'wb-field' },
            h('span', null, '标签'),
            h('div', { className: 'wb-taglist' },
              STORE.tagList.length
                ? STORE.tagList.map(function (t) {
                  const used = Object.keys(STORE.tags).filter(function (k) {
                    return STORE.tags[k].indexOf(t) >= 0;
                  }).length;
                  return h('span', { className: 'wb-tagitem', key: t },
                    t,
                    h('em', null, String(used)),
                    h('button', {
                      type: 'button',
                      className: 'wb-tagx',
                      title: '删除标签 ' + t,
                      'aria-label': '删除标签 ' + t,
                      onClick: function () { removeTagOption(t); }
                    }, '×')
                  );
                })
                : h('span', { className: 'wb-tagnone' }, '还没有标签，在下面加一个')
            ),
            h('div', { className: 'wb-tagadd' },
              h('input', {
                className: 'wb-input',
                value: tagDraft,
                maxLength: 8,
                placeholder: '新标签，比如「学校」',
                onChange: function (ev) { tagDraft = ev.target.value; emit(); },
                onKeyDown: function (ev) {
                  if (ev.key !== 'Enter') return;
                  ev.preventDefault();
                  if (addTagOption(tagDraft)) { tagDraft = ''; emit(); }
                }
              }),
              h('button', {
                type: 'button',
                className: 'wb-btn wb-btn--sm',
                onClick: function () { if (addTagOption(tagDraft)) { tagDraft = ''; emit(); } }
              }, '添加')
            )
          ),
          h('p', { className: 'wb-set-note' }, '首页卡片上右键可以给单词选标签（可多选）；顶部标签可快速筛选。删掉标签时，单词上的这个标签也会一起移除。'),
          h('div', { className: 'wb-field' },
            h('span', null, '单词本根目录'),
            h('code', { className: 'wb-path' }, String(s.rootDirLabel || s.rootDir || DEFAULT_ROOT_LABEL)),
            h('div', { className: 'wb-set-row' },
              h('button', { type: 'button', className: 'wb-mini', onClick: function () { pickFolder('rootDir'); } }, '选择文件夹…'),
              h('button', { type: 'button', className: 'wb-mini', onClick: function () { openRootFolder(s.rootDir); } }, '打开文件夹'),
              h('button', { type: 'button', className: 'wb-mini', onClick: function () { applyRootDir(''); } }, '恢复默认目录')
            )
          ),
          h('div', { className: 'wb-field' },
            h('span', null, '会话工作目录'),
            h('code', { className: 'wb-path' }, String(s.workDirLabel || s.workDir || DEFAULT_WORKDIR_LABEL)),
            h('div', { className: 'wb-set-row' },
              h('button', { type: 'button', className: 'wb-mini', onClick: function () { pickFolder('workDir'); } }, '选择文件夹…'),
              h('span', { className: 'wb-set-hint' }, '「+单词」新建的会话都用这个 DSH 工作目录，不存在会自动创建')
            )
          ),          STORE.pendingRoot ? h('div', { className: 'wb-set-warn' },
            h('b', null, '目标目录里已经有单词数据'),
            h('p', null, '要把现有数据一起迁移到 ' + STORE.pendingRoot + ' 吗？'),
            h('div', { className: 'wb-set-row' },
              h('button', { type: 'button', className: 'wb-btn wb-btn--sm', onClick: function () { confirmRootDir(true); } }, '迁移过去'),
              h('button', { type: 'button', className: 'wb-mini', onClick: function () { confirmRootDir(false); } }, '不迁移，直接用空目录')
            )
          ) : null,
          h('div', { className: 'wb-field' },
            h('span', null, '工作空间名称'),
            h('input', {
              className: 'wb-input',
              value: String(s.workTitle || ''),
              placeholder: '随记单词本',
              onChange: function (ev) { patchSettings({ workTitle: ev.target.value }); }
            }),
            h('div', { className: 'wb-set-row' },
              h('span', { className: 'wb-set-hint' }, '新建会话时会把这个目录注册成同名的 DSH 工作空间')
            )
          ),          h('div', { className: 'wb-field' },
            h('span', null, '管理技能'),
            h('div', { className: 'wb-set-row' },
              h('button', {
                type: 'button',
                className: 'wb-btn wb-btn--sm',
                onClick: function () { installSkill(); }
              }, s.skillInstalled ? '重新安装技能' : '安装技能'),
              h('span', { className: 'wb-set-hint' }, s.skillInstalled ? '已安装：~/.agents/skills/suiji-word-book/' : '装好后可用 /suiji-word-book 管理单词本')
            )
          ),
          h('div', { className: 'wb-field' },
            h('span', null, '首页「+单词」按钮'),
            h('div', { className: 'wb-set-row' },
              h('button', {
                type: 'button',
                className: 'wb-mini',
                disabled: !s.skillInstalled,
                title: s.skillInstalled ? '' : '先安装技能才能开启',
                onClick: function () { patchSettings({ showAddWord: !s.showAddWord }); }
              }, s.showAddWord ? '已显示（点我隐藏）' : '隐藏中（点我显示）'),
              h('span', { className: 'wb-set-hint' }, s.skillInstalled ? '点击后用 DSH 新建会话，让技能来加单词' : '需先安装技能')
            )
          ),
          h('div', { className: 'wb-field' },
            h('span', null, '新建会话使用完全权限'),
            h('div', { className: 'wb-set-row' },
              h('button', {
                type: 'button',
                className: 'wb-mini',
                onClick: function () { patchSettings({ newSessionFullAccess: !(s.newSessionFullAccess !== false) }); }
              }, (s.newSessionFullAccess !== false) ? '已开启（点我关闭）' : '已关闭（点我开启）'),
              h('span', { className: 'wb-set-hint' }, '开启后「+单词」新建的会话自动切成 danger-full-access，不再逐次授权')
            )
          ),
          h('div', { className: 'wb-set-foot' },
            h('button', { type: 'button', className: 'wb-mini', onClick: resetSettings }, '恢复默认')
          )
        )
      );
    }

    /* ============================== 卡片右键标签菜单 ============================== */
    function TagMenu() {
      const m = STORE.menu;

      /* Esc 关闭（照着 mount 一次注册一次） */
      useEffect(function () {
        if (typeof document === 'undefined') return;
        function onKey(ev) { if (ev && ev.key === 'Escape') closeTagMenu(); }
        document.addEventListener('keydown', onKey);
        return function () { document.removeEventListener('keydown', onKey); };
      }, []);

      if (!m) return null;
      const w = findWord(m.slug);
      if (!w) return null;
      const cur = tagsOf(m.slug);

      const vw = (typeof window !== 'undefined' && window.innerWidth) || 1024;
      const vh = (typeof window !== 'undefined' && window.innerHeight) || 768;
      const width = 224;
      const height = 74 + Math.max(1, STORE.tagList.length) * 38;
      const left = Math.max(8, Math.min(m.x, vw - width - 12));
      const top = Math.max(8, Math.min(m.y, vh - height - 12));

      return h('div', {
        className: 'wb-menu-mask',
        onClick: closeTagMenu,
        onContextMenu: function (ev) {
          ev.preventDefault();
          const stack = (typeof document !== 'undefined' && document.elementsFromPoint)
            ? document.elementsFromPoint(ev.clientX, ev.clientY) : [];
          for (let i = 0; i < stack.length; i++) {
            const card = stack[i] && stack[i].closest ? stack[i].closest('[data-slug]') : null;
            if (card) { openTagMenu(card.getAttribute('data-slug'), ev.clientX, ev.clientY); return; }
          }
          closeTagMenu();
        }
      },
        h('div', {
          className: 'wb-menu',
          role: 'menu',
          'aria-label': w.word + ' 的标签',
          style: { left: left + 'px', top: top + 'px' },
          onClick: function (ev) { ev.stopPropagation(); }
        },
          h('div', { className: 'wb-menu-head' },
            h('b', null, w.word),
            h('span', null, '快捷设置')
          ),
          STORE.tagList.length
            ? STORE.tagList.map(function (t) {
              const on = cur.indexOf(t) >= 0;
              return h('button', {
                key: t,
                type: 'button',
                role: 'menuitemcheckbox',
                className: 'wb-menu-item',
                'aria-checked': on ? 'true' : 'false',
                'aria-label': t,
                onClick: function () { toggleWordTag(m.slug, t); }
              },
                h('span', { className: 'tick' }, on ? '✓' : ''),
                t
              );
            })
            : h('div', { className: 'wb-menu-empty' }, '还没有标签。去右上角「设定」里加几个吧。'),
          h('div', { className: 'wb-menu-sep' }),
          h('button', {
            type: 'button',
            role: 'menuitem',
            className: 'wb-menu-item',
            onClick: function () { closeTagMenu(); pickWordArt(m.slug); }
          }, '替换插图…'),
          STORE.art[m.slug] ? h('button', {
            type: 'button',
            role: 'menuitem',
            className: 'wb-menu-item',
            onClick: function () { clearWordArt(m.slug); }
          }, '恢复默认插图') : null,
        )
      );
    }

    function Learn(props) {
      const e = props.entry;
      const hasPhrases = !!(e.phrases && e.phrases.length);
      const hasSentence = !!(e.sentence && e.sentence.en);
      const heroTags = tagsOf(e.slug);
      return h('section', { className: 'wb-learn' },
        h('div', { className: 'wb-learn-top' },
          /* 单词卡区域右上角的标签（窄屏时变成第一行右对齐） */
          heroTags.length ? h('div', { className: 'wb-hero-tags', 'aria-label': '这个单词的标签' },
            heroTags.slice(0, 4).map(function (t) {
              return h('span', { className: 'wb-hero-tag', key: t }, t);
            }),
            heroTags.length > 4 ? h('span', { className: 'wb-hero-tag wb-hero-tag--more' }, '+' + (heroTags.length - 4)) : null
          ) : null,
          h('div', { className: 'wb-art' }, h('img', { src: artOf(e), alt: e.artAlt || e.word, draggable: false })),
          h('div', { className: 'wb-headword' },
            h('h1', { className: 'wb-word' },
              h('button', {
                type: 'button',
                className: 'wb-word-btn',
                title: '点击发音',
                'aria-label': '播放 ' + e.word + ' 的发音',
                onClick: function () { play(e.wordAudio); }
              }, e.word)
            ),
            h('div', { className: 'wb-pron' },
              h(Speak, { src: e.wordAudio, title: '听发音' }),
              e.ipa ? h('span', { className: 'wb-ipa' }, e.ipa) : null,
              (e.ipa && e.en) ? h('span', { className: 'wb-dot', 'aria-hidden': true }, '·') : null,
              e.en ? h('span', { className: 'wb-endef' }, e.en) : null
            ),
            h('div', { className: 'wb-mean' },
              e.pos ? h('span', { className: 'wb-pos' }, e.pos) : null,
              e.zh
            )
          ),
          /* 单词卡区域（分隔线以上）的右侧，竖排倍速按钮，垂直居中 */
          h('div', { className: 'wb-rate', role: 'group', 'aria-label': '倍速播放单词' },
            RATE_STEPS.map(function (r) {
              return h('button', {
                key: r,
                type: 'button',
                title: r + '× 播放 ' + e.word,
                'aria-label': '以 ' + r + ' 倍速播放 ' + e.word,
                onClick: function () { play(e.wordAudio, r); }
              }, SPEAKER, r + '×');
            })
          )
        ),
        hasPhrases ? h('div', { className: 'wb-section' },
          h('h2', null, '常用词组'),
          h('div', { className: 'wb-phrs' },
            e.phrases.map(function (p, i) {
              return h('div', {
                key: 'p' + i,
                className: 'wb-phr',
                role: 'button',
                tabIndex: 0,
                onClick: function () { play(p.audio); },
                onKeyDown: function (ev) {
                  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); play(p.audio); }
                }
              },
                h(Speak, { src: p.audio, small: true, tone: 'mint', title: '听 ' + p.en }),
                h('span', { className: 'en' }, p.en),
                h('span', { className: 'zh' }, p.zh)
              );
            })
          )
        ) : null,
        hasSentence ? h('div', { className: 'wb-section' },
          h('h2', null, '例句'),
          h('div', {
            className: 'wb-sent',
            role: 'button',
            tabIndex: 0,
            onClick: function () { play(e.sentence.audio); },
            onKeyDown: function (ev) {
              if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); play(e.sentence.audio); }
            }
          },
            h(Speak, { src: e.sentence.audio, small: true, tone: 'amber', title: '听例句' }),
            h('span', { className: 'en' }, e.sentence.en),
            h('span', { className: 'zh' }, e.sentence.zh || '')
          )
        ) : null
      );
    }

    function TestView(props) {
      const e = props.entry;
      const slug = e.slug;
      const word = e.word;
      const t = testOf(slug);
      const box = useRef(null);

      useEffect(function () {
        if (box.current) box.current.focus();
      }, [slug, t.idx]);

      /* 每题开始自动播一次单词发音；同一题只响一次（切走再回来不会重复） */
      useEffect(function () {
        if (t.done) return;
        const key = slug + '#' + t.idx;
        if (lastAutoKey === key) return;
        lastAutoKey = key;
        play(e.wordAudio);
      }, [slug, t.idx]);

      function onKey(ev) {
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        const k = ev.key;
        if (k === 'Tab') { ev.preventDefault(); hintChar(slug); }
        else if (k === 'Escape') { ev.preventDefault(); skipRound(slug); }
        else if (k === 'Backspace') { ev.preventDefault(); }
        else if (k === 'Enter' || k === ' ') {
          ev.preventDefault();
          if (t.solved) nextRound(slug);
          else play(e.wordAudio);
        } else if (k.length === 1 && /[a-z]/i.test(k)) {
          ev.preventDefault();
          if (!t.solved) typeChar(slug, k.toLowerCase());
        }
      }

      const round = t.round;
      const total = t.plan.length;
      const doneCount = t.idx + (t.solved ? 1 : 0);

      let b = 0;
      const cellNodes = [];
      for (let i = 0; i < word.length; i++) {
        const isBlank = round.mask.indexOf(i) >= 0;
        if (isBlank) {
          const bi = b++;
          const ch = round.filled[bi];
          let cls = 'wb-lcell wb-lcell--blank';
          if (ch) cls += ' wb-lcell--filled';
          if (t.solved) cls += ' wb-lcell--done';
          if (!t.solved && bi === round.ptr) cls += ' wb-lcell--cur';
          if (t.bad === bi) cls += ' wb-lcell--bad';
          cellNodes.push(h('span', { key: 'c' + i, className: cls }, t.solved ? word[i] : (ch || '')));
        } else {
          cellNodes.push(h('span', { key: 'c' + i, className: 'wb-lcell' + (t.solved ? ' wb-lcell--done' : '') }, word[i]));
        }
      }

      const tip = t.solved
        ? (round.err === 0 && round.hints === 0 ? '✓ 全对！' : '✓ 拼好了')
        : t.bad !== null ? '这个字母不对，再试一次'
          : round.mask.length === word.length ? '这次整个单词都要自己拼哦'
            : '把缺少的 ' + (round.mask.length - round.ptr) + ' 个字母补上';

      const keys = t.stats.keys;
      const acc = keys ? Math.round((1 - t.stats.wrong / keys) * 100) : 100;
      const parts = ['共 ' + total + ' 题', '一次全对 ' + t.stats.clean + ' 题'];
      if (t.stats.skips) parts.push('跳过 ' + t.stats.skips + ' 题');
      if (keys) parts.push('正确率 ' + acc + '%');
      const stat = parts.join(' · ');

      return h('section', { className: 'wb-test' },
        h('div', { className: 'wb-qhead' },
          h('span', { className: 'wb-qcount' }, '第 ', h('b', null, String(t.idx + 1)), ' / ' + total + ' 题'),
          h('button', {
            type: 'button',
            className: 'wb-listen',
            onClick: function () { play(e.wordAudio); }
          }, SPEAKER, '听发音')
        ),
        h('div', { className: 'wb-qbar' },
          h('i', { style: { width: (t.done ? 100 : doneCount / total * 100) + '%' } })
        ),
        artOf(e) ? h('div', { className: 'wb-test-art' },
          h('img', { src: artOf(e), alt: e.artAlt || e.word, draggable: false })
        ) : null,
        h('div', { className: 'wb-prompt' }, e.zh),
        h('div', {
          className: 'wb-letters',
          tabIndex: 0,
          ref: box,
          onKeyDown: onKey,
          onMouseDown: function () { if (box.current) box.current.focus(); },
          role: 'application',
          'aria-label': '拼写输入：' + e.zh
        }, cellNodes),
        h('div', {
          className: 'wb-feedback' + (t.solved ? ' wb-feedback--ok' : t.bad !== null ? ' wb-feedback--bad' : ''),
          role: 'status',
          'aria-live': 'polite'
        }, tip),
        h('div', { className: 'wb-testrow' },
          h('button', { type: 'button', className: 'wb-mini', onClick: function () { hintChar(slug); } }, '提示（Tab）'),
          h('button', { type: 'button', className: 'wb-mini', onClick: function () { skipRound(slug); } }, '换一题（Esc）')
        ),
        h('div', { className: 'wb-keys' },
          h('span', null, h('kbd', null, 'Enter'), '重听 / 下一题'),
          h('span', null, h('kbd', null, 'Esc'), '换一题'),
          h('span', null, h('kbd', null, 'Tab'), '提示')
        ),
        t.done ? h('div', { className: 'wb-finish' },
          h('div', null,
            h('div', { className: 'icon' }, '🎉'),
            h('h2', null, '拼写完成！'),
            h('p', null, stat),
            h('div', { className: 'acts' },
              h('button', { type: 'button', className: 'wb-btn wb-btn--sm', onClick: function () { restartTest(slug); } }, '再练一遍'),
              h('button', { type: 'button', className: 'wb-mini', onClick: exitTest }, '看看单词')
            )
          )
        ) : null
      );
    }

    /* ============================== 单词辨认视图 ============================== */
    function RecognitionView() {
      const r = STORE.recognition;
      const q = r.questions[r.idx];
      const t = q.word;
      const answered = r.picked >= 0;
      const total = r.questions.length;

      /* 提示是声音时，进来就自动播一次 */
      useEffect(function () {
        if (q.p !== 'audio' || r.done) return;
        const key = 'rec#' + r.idx;
        if (lastRecKey === key) return;
        lastRecKey = key;
        play(t.wordAudio);
      }, [r.idx]);

      if (r.done) {
        const pct = Math.round((r.correct / total) * 100);
        return h('section', { className: 'wb-test' },
          h('div', { className: 'wb-rec-finish' },
            h('div', { className: 'icon' }, '🎯'),
            h('h2', null, '辨析完成！'),
            h('p', null, '共 ' + total + ' 题 · 答对 ' + r.correct + ' 题 · 正确率 ' + pct + '%'),
            h('div', { className: 'acts' },
              h('button', { type: 'button', className: 'wb-btn wb-btn--sm', onClick: startRecognition }, '再来一轮'),
              h('button', { type: 'button', className: 'wb-mini', onClick: exitRecognition }, '回单词卡')
            )
          )
        );
      }

      function promptNode() {
        if (q.p === 'word') return h('div', { className: 'wb-rec-word' }, t.word);
        if (q.p === 'zh') return h('div', { className: 'wb-rec-zh' }, t.zh);
        if (q.p === 'art') return h('img', { className: 'wb-rec-art', src: artOf(t), alt: t.artAlt || t.word, draggable: false });
        return h('button', {
          type: 'button',
          className: 'wb-speak wb-speak--lg',
          title: '再听一次',
          'aria-label': '再听一次',
          onClick: function () { play(t.wordAudio); }
        }, SPEAKER);
      }

      function optionNode(o, i) {
        const letter = String.fromCharCode(65 + i);
        let cls = 'wb-rec-opt wb-rec-opt--' + q.a;
        if (answered) {
          if (o.correct) cls += ' wb-rec-opt--ok';
          else if (i === r.picked) cls += ' wb-rec-opt--bad';
          else cls += ' wb-rec-opt--muted';
        }

        let body;
        if (q.a === 'art') {
          body = h('img', { src: artOf(o.entry), alt: o.entry.artAlt || o.entry.word, draggable: false });
        } else if (q.a === 'audio') {
          /* 喇叭只负责播放，整张卡才是选择热区 */
          body = h('div', { className: 'wb-rec-play' },
            h('button', {
              type: 'button',
              className: 'wb-speak',
              title: '播放 ' + letter + ' 选项',
              'aria-label': '播放 ' + letter + ' 选项的读音',
              onClick: function (ev) {
                ev.stopPropagation();
                if (o.entry) play(o.entry.wordAudio);
              }
            }, SPEAKER),
            h('span', { className: 'wb-rec-playhint' }, '点喇叭试听')
          );
        } else {
          body = h('span', null, o.value);
        }

        return h('div', {
          key: 'o' + i,
          className: cls,
          role: 'button',
          tabIndex: 0,
          'aria-label': letter + ' ' + (q.a === 'audio' ? '选项，回车选择；喇叭单独试听' : '选项'),
          onClick: function (ev) {
            const el = ev && ev.target;
            if (el && el.closest && el.closest('.wb-rec-play')) return;  // 点在喇叭上只试听
            if (answered) return;
            answerRecognition(i);
          },
          onKeyDown: function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              if (!answered) answerRecognition(i);
            }
          }
        },
          h('span', { className: 'badge' }, letter),
          body,
          (q.a === 'audio' && !answered) ? h('span', { className: 'wb-rec-pick' }, '选这个') : null
        );
      }

      const doneCount = r.idx + (answered ? 1 : 0);
      const picked = answered ? q.options[r.picked] : null;
      const tip = !answered ? '选一个答案'
        : picked && picked.correct ? '✓ 答对了'
          : '✗ 正确答案已标出';

      return h('section', { className: 'wb-test' },
        h('div', { className: 'wb-qhead' },
          h('span', { className: 'wb-qcount' }, '第 ', h('b', null, String(r.idx + 1)), ' / ' + total, ' 题'),
          h('span', { className: 'wb-rec-tip' }, REC_LABEL[q.p + '>' + q.a] || '')
        ),
        h('div', { className: 'wb-qbar' },
          h('i', { style: { width: (doneCount / total * 100) + '%' } })
        ),
        h('div', { className: 'wb-rec-prompt' }, promptNode()),
        h('div', { className: 'wb-rec-opts' }, q.options.map(optionNode)),
        h('div', {
          className: 'wb-feedback' + (answered ? (picked && picked.correct ? ' wb-feedback--ok' : ' wb-feedback--bad') : ''),
          role: 'status',
          'aria-live': 'polite'
        }, tip),
        h('div', { className: 'wb-testrow' },
          answered ? h('button', { type: 'button', className: 'wb-mini', onClick: nextRecognition }, '下一题') : null,
          h('button', { type: 'button', className: 'wb-mini', onClick: exitRecognition }, '退出辨析')
        )
      );
    }

    /* ============================== 新增单词浮层 ============================== */
    function closeAddWord() {
      if (!STORE.addWordPop) return;
      STORE.addWordPop = null;
      emit();
    }

    function AddWordPopover() {
      const pop = STORE.addWordPop;
      const inputRef = useRef(null);

      useEffect(function () {
        if (typeof document === 'undefined' || !pop) return;
        function onKey(ev) { if (ev && ev.key === 'Escape') closeAddWord(); }
        document.addEventListener('keydown', onKey);
        return function () { document.removeEventListener('keydown', onKey); };
      }, []);

      useEffect(function () {
        const el = inputRef.current;
        if (el && typeof el.focus === 'function') { el.focus(); if (el.select) el.select(); }
      }, []);

      if (!pop) return null;
      const vw = (typeof window !== 'undefined' && window.innerWidth) || 1024;
      const width = 460;
      const left = Math.max(8, Math.min(pop.x, vw - width - 12));

      return h('div', {
        className: 'wb-pop-mask',
        onClick: closeAddWord,
        onContextMenu: function (ev) { ev.preventDefault(); closeAddWord(); }
      },
        h('div', {
          className: 'wb-pop',
          role: 'dialog',
          'aria-label': '新增单词',
          style: { left: left + 'px', top: pop.y + 'px' },
          onClick: function (ev) { ev.stopPropagation(); }
        },
          h('div', { className: 'wb-pop-head' }, '新增单词'),
          h('div', { className: 'wb-pop-row' },
            h('input', {
              ref: inputRef,
              className: 'wb-input',
              value: addWordDraft,
              autoFocus: true,
              placeholder: '多个单词用逗号或空格分隔',
              onChange: function (ev) { addWordDraft = ev.target.value; emit(); },
              onKeyDown: function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); submitAddWords(); } }
            }),
            h('button', { type: 'button', className: 'wb-btn wb-btn--sm', onClick: submitAddWords }, '提交')
          ),
          STORE.addWordState ? h('div', { className: 'wb-pop-hint' }, STORE.addWordState) : null,
        )
      );
    }
    /* ============================== 单词设置弹窗 ============================== */
    function WordSettingsDialog() {
      const ws = STORE.wordSettings;
      if (!ws) return null;
      const w = findWord(ws.slug);
      if (!w) return null;
      const on = tagsOf(w.slug);
      return h('div', {
        className: 'wb-mask',
        onClick: function (ev) { if (ev.target === ev.currentTarget) closeWordSettings(); }
      },
        h('div', { className: 'wb-settings', role: 'dialog', 'aria-modal': 'true', 'aria-label': w.word + ' 的设置' },
          h('div', { className: 'wb-set-head' },
            h('h2', null, w.word + ' 的设置'),
            h('button', { type: 'button', className: 'wb-set-close', onClick: closeWordSettings, 'aria-label': '关闭' }, '×')
          ),
          h('div', { className: 'wb-field' },
            h('span', null, '插图'),
            h('div', { className: 'wb-set-row' },
              h('img', { className: 'wb-art-preview', src: artOf(w), alt: w.artAlt || w.word }),
              h('div', { className: 'wb-art-acts' },
                h('button', { type: 'button', className: 'wb-btn wb-btn--sm', onClick: function () { pickWordArt(w.slug); } }, '替换插图…'),
                STORE.art[w.slug] ? h('button', { type: 'button', className: 'wb-mini', onClick: function () { clearWordArt(w.slug); } }, '恢复默认插图') : null,
                h('span', { className: 'wb-set-hint' }, STORE.art[w.slug] ? '正在用自定义插图' : '正在用默认插图')
              )
            )
          ),
          h('div', { className: 'wb-field' },
            h('span', null, '标签'),
            h('div', { className: 'wb-taglist' },
              STORE.tagList.length
                ? STORE.tagList.map(function (t) {
                  const active = on.indexOf(t) >= 0;
                  return h('button', {
                    key: t,
                    type: 'button',
                    className: 'wb-chip',
                    'aria-pressed': active ? 'true' : 'false',
                    onClick: function () { toggleWordTag(w.slug, t); }
                  }, t);
                })
                : h('span', { className: 'wb-tagnone' }, '还没有标签，去「设定」里加几个')
            )
          ),
          h('p', { className: 'wb-set-note' }, '以后单词级的新设置项都会加在这里。')
        )
      );
    }
    /* ============================== 面板外壳 ============================== */
    function Panel() {
      const st = useStore();
      const entry = st.slug ? findWord(st.slug) : null;
      const testing = !!(entry && st.testing);
      const rec = !!st.recognition;
      const viewKey = rec ? 'recognition' : (entry ? (testing ? entry.slug + ':test' : entry.slug) : 'home');
      const scroll = useRef(null);

      /* 首次挂载从「单词本根目录」读状态（宿主半边写盘） */
      useEffect(function () { bootHostState(); }, []);

      /* 面板被切走会卸载：重新挂载时保持原来的滚动位置，只在真正换页时回到顶部 */
      useEffect(function () {
        if (STORE.lastView !== viewKey) {
          STORE.lastView = viewKey;
          if (scroll.current) scroll.current.scrollTop = 0;
        }
      }, [viewKey]);

      return h('div', { className: 'wb-root' },
        h('style', null, CSS),
        h('div', { className: 'wb-scroll', ref: scroll },
          h('div', { className: 'wb-wrap' },
            h('div', { className: 'wb-topbar' },
              entry ? h('button', {
                type: 'button',
                className: 'wb-back',
                onClick: rec ? exitRecognition : (testing ? exitTest : goHome)
              }, h('b', null, '←'), (testing || rec) ? '单词卡' : '单词本') : null,
              h('div', { className: 'wb-topbar-side' },
                (!entry && st.settings.skillInstalled && st.settings.showAddWord) ? h('button', {
                  type: 'button',
                  className: 'wb-mini',
                  onClick: function (ev) {
                    STORE.addWordState = '';
                    const rect = ev && ev.currentTarget ? ev.currentTarget.getBoundingClientRect() : null;
                    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1024;
                    STORE.addWordPop = {
                      x: rect ? Math.round(rect.right - 460) : Math.round(vw / 2 - 230),
                      y: rect ? Math.round(rect.bottom + 10) : 120
                    };
                    emit();
                  }
                }, '+单词') : null,
                !entry ? h('button', { type: 'button', className: 'wb-mini wb-set-btn', onClick: openSettings }, '设定') : null,
                (entry && !testing && !rec) ? h('button', { type: 'button', className: 'wb-mini', onClick: function () { openWordSettings(entry.slug); } }, '设置') : null,
                (entry && !testing && !rec) ? h('button', { type: 'button', className: 'wb-btn wb-btn--sm', onClick: startTest }, '拼写练习') : null,
                (entry && !testing && !rec) ? h('button', { type: 'button', className: 'wb-btn wb-btn--sm', onClick: startRecognition }, '单词辨析') : null
              )
            ),
            !WORDS.length
              ? h('div', { className: 'wb-empty' }, '还没有单词。用「+单词」让技能添加，或在设定里确认「单词本根目录」。')
              : rec
                ? h(RecognitionView)
                : !entry
                  ? h(Home)
                  : testing
                    ? h(TestView, { key: entry.slug, entry: entry })
                    : h(Learn, { key: entry.slug, entry: entry })
          )
        ),
        STORE.settingsOpen ? h(SettingsPanel) : null,
        STORE.addWordPop ? h(AddWordPopover) : null,
        STORE.wordSettings ? h(WordSettingsDialog) : null,
        STORE.menu ? h(TagMenu) : null
      );
    }

    /* ============================== 侧栏图标 ============================== */
    let layoutRef = null;   // apply 里拿到 ctx.layout，作为点图标切面板的兜底

    function PanelIcon(props) {
      const size = (props && typeof props.size === 'number') ? props.size : 20;
      return h('span', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          opacity: (props && props.active) ? 1 : .78
        },
        onClick: function () {
          if (layoutRef && layoutRef.selectPanel) {
            try { layoutRef.selectPanel('word-book'); } catch (e) {}
          }
        }
      }, h(BookGlyph, { size: size }));
    }

    return {
      inject: ['slots', 'layout', 'uiWorkspace'],
      /* 只给离线测试用（模块加载器忽略多余字段）：不参与运行时的任何逻辑 */
      __wordBookTest: {
        buildRecognition: buildRecognition,
        makeRecognition: makeRecognition,
        wordDistractors: wordDistractors,
        words: function () { return WORDS.slice(); }
      },
      apply(ctx) {
        layoutRef = ctx.layout;
        ctxRef = ctx;
        ctx.slots.inject('sidebar.panellist', function () {
          return ctx.slots.register({
            name: 'sidebar.panellist',
            id: 'word-book',
            order: 20,
            label: '随记单词本'
          }, PanelIcon);
        });

        /* 右侧整块面板，key 与侧栏条目 id 相同，且不是会话槽位 —— 不跟随会话切换 */
        ctx.slots.inject('main', function () {
          return ctx.slots.register({
            name: 'main',
            key: 'word-book'
          }, Panel);
        });
      }
    };
  }
});
