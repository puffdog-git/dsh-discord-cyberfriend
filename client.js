/**
 * client.js — dsh-discord-cyberfriend 前端（建置產物）
 * 由 scripts/build-client.mjs 從 client-src/ 產生；請修改 client-src/ 後重新建置。
 */
window.__ModuleLoader__.load({
  id: 'dsh-discord-cyberfriend',
  factory: (require) => {
// ---- styles.css
const CSS = "/* dsh-discord-cyberfriend 設定介面樣式。\n   色彩、圓角一律取宿主 --dsw-* 變數（附後備值），深淺色跟隨宿主，不自行強制。 */\n\n.dpl {\n  --dpl-fg: var(--dsw-alias-label-primary, light-dark(#1f2328, #e6edf3));\n  --dpl-muted: var(--dsw-alias-label-secondary, color-mix(in srgb, currentColor 62%, transparent));\n  --dpl-faint: var(--dsw-alias-label-tertiary, color-mix(in srgb, currentColor 45%, transparent));\n  --dpl-bg: var(--dsw-alias-bg-layer-3, var(--background-color, light-dark(#ffffff, #202127)));\n  --dpl-surface: var(--dsw-alias-bg-layer-2, var(--dpl-bg));\n  --dpl-sunken: var(--dsw-alias-bg-module-platform, color-mix(in srgb, currentColor 5%, transparent));\n  --dpl-line: var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 12%, transparent));\n  --dpl-line-strong: var(--dsw-alias-border-l4, color-mix(in srgb, currentColor 24%, transparent));\n  --dpl-hover: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 6%, transparent));\n  --dpl-soft: color-mix(in srgb, currentColor 5%, transparent);\n  --dpl-softer: color-mix(in srgb, currentColor 3%, transparent);\n  --dpl-accent: var(--dsw-alias-brand-primary, #4d6bfe);\n  --dpl-accent-soft: color-mix(in srgb, var(--dpl-accent) 12%, transparent);\n  /* 強調色底上的文字色。宿主的強調色可能是白或黑（單色主題），不能寫死白字。 */\n  --dpl-on-accent: var(--dsw-alias-bg-layer-3, light-dark(#ffffff, #1c1f23));\n  --dpl-ok: var(--dsw-alias-state-success-primary, #1f9d55);\n  --dpl-warn: var(--dsw-alias-state-warn-primary, #b7791f);\n  --dpl-err: var(--dsw-alias-state-error-primary, #d64545);\n  --dpl-user: var(--dpl-accent);\n  --dpl-bot: #9b6bdf;\n  --dpl-r-sm: var(--dsw-radius-sm, 8px);\n  --dpl-r-md: var(--dsw-radius-md, 12px);\n  --dpl-r-lg: var(--dsw-radius-lg, 16px);\n  display: flex; flex-direction: column; gap: 16px;\n  color: var(--dpl-fg); font-size: 13px; line-height: 1.55;\n  container-type: inline-size; min-width: 0;\n}\n.dpl * { box-sizing: border-box; }\n.dpl button:not(.dpl-switch):not(.dpl-eye) { flex-shrink: 0; white-space: nowrap; }\n.dpl h1 { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: -.01em; }\n.dpl h2 { margin: 0; font-size: 14px; font-weight: 650; }\n.dpl :focus-visible { outline: 2px solid var(--dpl-accent); outline-offset: 2px; }\n\n/* ------------------------------------------------------------ 頁首 */\n.dpl-top { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }\n.dpl-top-title { display: flex; gap: 12px; align-items: center; min-width: 0; }\n.dpl-logo { width: 36px; height: 36px; border-radius: var(--dpl-r-md); display: grid; place-items: center; flex: 0 0 auto;\n  background: var(--dpl-accent-soft); color: var(--dpl-accent); }\n.dpl-sub { margin: 1px 0 0; color: var(--dpl-muted); font-size: 12px; }\n.dpl-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }\n.dpl-lang { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; white-space: nowrap; font-size: 12px; color: var(--dpl-muted); }\n.dpl-lang select { font: inherit; color: var(--dpl-fg); background: var(--dpl-sunken); border: 0; border-radius: var(--dpl-r-sm);\n  padding: 5px 8px; color-scheme: inherit; cursor: pointer; }\n\n/* ------------------------------------------------------------ 導覽 */\n.dpl-navwrap { display: flex; flex-direction: column; gap: 8px; }\n.dpl-navbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }\n.dpl-groups { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; border-radius: var(--dpl-r-md); background: var(--dpl-sunken); flex: 1 1 420px; }\n.dpl-group { flex: 1 1 96px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 36px; padding: 6px 12px;\n  border: 0; border-radius: var(--dpl-r-sm); background: transparent; color: var(--dpl-muted); font: inherit; font-size: 13px; font-weight: 560;\n  cursor: pointer; transition: background .12s, color .12s; }\n.dpl-group:hover { color: var(--dpl-fg); background: var(--dpl-hover); }\n.dpl-group[data-active=\"true\"] { background: var(--dpl-bg); color: var(--dpl-fg); font-weight: 650; box-shadow: 0 1px 2px rgba(0, 0, 0, .12); }\n.dpl-search { flex: 1 1 200px; max-width: 320px; }\n.dpl-section-modules { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }\n.dpl-group-desc { color: var(--dpl-faint); font-size: 12px; margin-left: 4px; }\n.dpl-nav-item { display: inline-flex; align-items: center; gap: 7px; min-height: 32px; padding: 5px 12px; border-radius: 99px;\n  border: 1px solid var(--dpl-line); background: transparent; color: var(--dpl-muted); font: inherit; font-size: 12.5px;\n  cursor: pointer; transition: background .12s, color .12s, border-color .12s; }\n.dpl-nav-item:hover { background: var(--dpl-hover); color: var(--dpl-fg); }\n.dpl-nav-item[data-active=\"true\"] { background: var(--dpl-accent-soft); border-color: color-mix(in srgb, var(--dpl-accent) 45%, transparent);\n  color: var(--dpl-accent); font-weight: 620; }\n.dpl-nav-dot { width: 6px; height: 6px; border-radius: 99px; background: var(--dpl-ok); }\n.dpl-nav-dot[data-off=\"true\"] { background: color-mix(in srgb, currentColor 30%, transparent); }\n\n.dpl-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }\n.dpl-content { display: flex; flex-direction: column; gap: 14px; min-width: 0; }\n\n/* ------------------------------------------------------------ 按鈕 */\n.dpl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 6px 12px;\n  border-radius: var(--dpl-r-sm); border: 1px solid var(--dpl-line-strong); background: transparent; color: inherit; font: inherit;\n  font-size: 12.5px; font-weight: 560; cursor: pointer; transition: background .15s, border-color .15s, opacity .15s; }\n.dpl-btn:hover:not(:disabled) { background: var(--dpl-hover); }\n.dpl-btn:disabled { opacity: .45; cursor: not-allowed; }\n.dpl-btn-primary { background: var(--dpl-accent); border-color: var(--dpl-accent); color: var(--dpl-on-accent); }\n.dpl-btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--dpl-accent) 88%, #000); }\n.dpl-btn-danger { color: var(--dpl-err); border-color: color-mix(in srgb, var(--dpl-err) 45%, transparent); }\n.dpl-btn-ghost { border-color: transparent; }\n.dpl-btn-sm { min-height: 28px; padding: 3px 10px; font-size: 12px; }\n.dpl-btn-lg { min-height: 38px; padding: 8px 18px; font-size: 13.5px; }\n.dpl-link { border: 0; background: none; padding: 0; color: var(--dpl-accent); font: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }\n\n/* ------------------------------------------------------------ 卡片 */\n.dpl-card { border: 1px solid var(--dpl-line); border-radius: var(--dpl-r-lg); background: var(--dpl-surface); overflow: hidden; }\n.dpl-card-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; justify-content: space-between; padding: 14px 16px 0; }\n.dpl-card-head > div:first-child { flex: 1 1 200px; min-width: 0; }\n.dpl-card-title { display: flex; align-items: center; gap: 8px; font-weight: 650; font-size: 14px; }\n.dpl-card-desc { margin: 3px 0 0; color: var(--dpl-muted); font-size: 12px; max-width: 68ch; }\n.dpl-card-body { padding: 10px 16px 14px; display: flex; flex-direction: column; gap: 2px; }\n\n/* ------------------------------------------------------------ 設定列 */\n.dpl-row { display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: flex-start; justify-content: space-between; padding: 12px 0;\n  border-bottom: 1px solid var(--dpl-line); }\n.dpl-row:last-child { border-bottom: 0; }\n.dpl-row-main { min-width: 0; flex: 1 1 220px; }\n.dpl-row-label { display: flex; align-items: center; gap: 7px; font-weight: 560; font-size: 13px; flex-wrap: wrap; }\n.dpl-row-help { color: var(--dpl-muted); font-size: 12px; margin-top: 2px; max-width: 60ch; }\n.dpl-row-control { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; max-width: 100%; min-width: 0; flex-wrap: wrap; }\n.dpl-row[data-type=\"textarea\"] .dpl-row-control,\n.dpl-row[data-type=\"tags\"] .dpl-row-control { flex: 1 1 300px; max-width: 440px; }\n.dpl-fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }\n.dpl-fieldset:disabled { opacity: .48; }\n.dpl-subhead { display: flex; align-items: center; gap: 8px; padding: 14px 0 4px; font-size: 12px; font-weight: 650; color: var(--dpl-muted);\n  letter-spacing: .02em; }\n.dpl-subhead:first-child { padding-top: 2px; }\n.dpl-more { margin-top: 4px; border-top: 1px solid var(--dpl-line); }\n.dpl-more > summary { padding: 10px 0; cursor: pointer; color: var(--dpl-muted); font-size: 12.5px; font-weight: 560; }\n.dpl-more > summary:hover { color: var(--dpl-fg); }\n.dpl details > summary { cursor: pointer; }\n\n.dpl-badge { font-size: 10.5px; padding: 1px 7px; border-radius: 99px; border: 1px solid var(--dpl-line-strong); color: var(--dpl-muted);\n  font-weight: 560; white-space: nowrap; }\n.dpl-badge-user { color: var(--dpl-user); border-color: color-mix(in srgb, var(--dpl-user) 40%, transparent); background: color-mix(in srgb, var(--dpl-user) 10%, transparent); }\n.dpl-badge-bot { color: var(--dpl-bot); border-color: color-mix(in srgb, var(--dpl-bot) 40%, transparent); background: color-mix(in srgb, var(--dpl-bot) 10%, transparent); }\n.dpl-badge-dirty { color: var(--dpl-warn); border-color: color-mix(in srgb, var(--dpl-warn) 45%, transparent); background: color-mix(in srgb, var(--dpl-warn) 10%, transparent); }\n\n.dpl-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 99px; flex-shrink: 0; font-size: 12px;\n  border: 1px solid var(--dpl-line-strong); color: var(--dpl-muted); font-weight: 560; background: transparent; font-family: inherit; }\nbutton.dpl-pill { cursor: pointer; }\nbutton.dpl-pill:hover { background: var(--dpl-hover); }\n.dpl-pill[data-tone=\"ok\"] { color: var(--dpl-ok); border-color: color-mix(in srgb, var(--dpl-ok) 45%, transparent); background: color-mix(in srgb, var(--dpl-ok) 10%, transparent); }\n.dpl-pill[data-tone=\"warn\"] { color: var(--dpl-warn); border-color: color-mix(in srgb, var(--dpl-warn) 45%, transparent); background: color-mix(in srgb, var(--dpl-warn) 10%, transparent); }\n.dpl-pill[data-tone=\"err\"] { color: var(--dpl-err); border-color: color-mix(in srgb, var(--dpl-err) 45%, transparent); background: color-mix(in srgb, var(--dpl-err) 10%, transparent); }\n.dpl-dot { width: 6px; height: 6px; border-radius: 99px; background: currentColor; }\n\n/* ------------------------------------------------------------ 控制項 */\n.dpl-switch { position: relative; width: 36px; height: 20px; border-radius: 99px; border: 0; background: color-mix(in srgb, currentColor 22%, transparent);\n  cursor: pointer; padding: 0; flex: 0 0 auto; transition: background .16s; }\n.dpl-switch::after { content: \"\"; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 99px; background: #fff;\n  box-shadow: 0 1px 2px rgba(0, 0, 0, .25); transition: transform .16s; }\n.dpl-switch[data-on=\"true\"] { background: var(--dpl-accent); }\n.dpl-switch[data-on=\"true\"]::after { transform: translateX(16px); }\n.dpl-switch:disabled { opacity: .45; cursor: not-allowed; }\n.dpl-switch-label { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 560; }\n\n.dpl-input, .dpl-select, .dpl-textarea { font: inherit; font-size: 12.5px; color: inherit; background: var(--dpl-bg);\n  border: 1px solid var(--dpl-line-strong); border-radius: var(--dpl-r-sm); padding: 6px 10px; min-height: 32px; min-width: 0; width: 100%; outline: none; }\n.dpl-input:focus, .dpl-select:focus, .dpl-textarea:focus { border-color: var(--dpl-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dpl-accent) 16%, transparent); }\n.dpl-input[data-invalid=\"true\"] { border-color: var(--dpl-err); }\n.dpl-select { appearance: none; -webkit-appearance: none; min-height: 36px; line-height: 1.4; padding: 7px 34px 7px 12px; cursor: pointer; color-scheme: inherit;\n  background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\");\n  background-repeat: no-repeat; background-position: right 10px center; }\n.dpl-select option, .dpl-select optgroup { color: inherit; background: var(--dpl-bg); }\n.dpl-select:disabled { cursor: not-allowed; opacity: .5; }\n.dpl-input[data-mono=\"true\"] { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }\n.dpl-textarea { resize: vertical; min-height: 64px; line-height: 1.5; }\n.dpl-input-wrap { position: relative; display: flex; align-items: center; width: 100%; }\n.dpl-input-wrap .dpl-input { padding-right: 34px; }\n.dpl-eye { position: absolute; right: 5px; border: 0; background: transparent; color: var(--dpl-muted); cursor: pointer; padding: 3px; border-radius: 6px;\n  display: grid; place-items: center; }\n.dpl-eye:hover { color: inherit; background: var(--dpl-hover); }\n.dpl-seg { display: inline-flex; max-width: 100%; flex-wrap: wrap; gap: 2px; padding: 2px; border-radius: var(--dpl-r-sm); background: var(--dpl-sunken); }\n.dpl-seg button { border: 0; background: transparent; color: var(--dpl-muted); font: inherit; font-size: 12.5px; min-height: 30px; padding: 4px 12px;\n  border-radius: 6px; cursor: pointer; transition: background .15s, color .15s; }\n.dpl-seg button:hover:not(:disabled) { color: var(--dpl-fg); }\n.dpl-seg button[data-on=\"true\"] { background: var(--dpl-bg); color: var(--dpl-fg); font-weight: 620; box-shadow: 0 1px 2px rgba(0, 0, 0, .12); }\n.dpl-tags { display: flex; flex-wrap: wrap; gap: 5px; padding: 5px; border: 1px solid var(--dpl-line-strong); border-radius: var(--dpl-r-sm);\n  background: var(--dpl-bg); min-height: 32px; align-items: center; width: 100%; }\n.dpl-tag { display: inline-flex; align-items: center; gap: 5px; padding: 1px 8px; border-radius: 6px; background: var(--dpl-accent-soft); font-size: 12px;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }\n.dpl-tag button { border: 0; background: transparent; color: inherit; cursor: pointer; opacity: .65; padding: 0; font-size: 13px; line-height: 1; }\n.dpl-tag button:hover { opacity: 1; }\n.dpl-tags input { border: 0; background: transparent; color: inherit; font: inherit; font-size: 12.5px; outline: none; flex: 1 1 90px; min-width: 70px; padding: 2px; }\n.dpl-range { display: flex; align-items: center; gap: 9px; width: 200px; max-width: 100%; }\n.dpl-range input[type=\"range\"] { flex: 1; accent-color: var(--dpl-accent); }\n.dpl-range-value { font-variant-numeric: tabular-nums; font-size: 12px; min-width: 38px; text-align: right; }\n\n/* ------------------------------------------------------------ 狀態區塊（載入／空白／失敗／未開啟） */\n.dpl-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 26px 16px; text-align: center; color: var(--dpl-muted);\n  border: 1px dashed var(--dpl-line-strong); border-radius: var(--dpl-r-md); }\n.dpl-state-title { font-weight: 620; color: var(--dpl-fg); font-size: 13px; }\n.dpl-state-body { font-size: 12px; max-width: 52ch; }\n.dpl-state[data-kind=\"error\"] { border-style: solid; border-color: color-mix(in srgb, var(--dpl-err) 40%, transparent); background: color-mix(in srgb, var(--dpl-err) 7%, transparent); }\n.dpl-state[data-kind=\"error\"] .dpl-state-title { color: var(--dpl-err); }\n.dpl-state[data-kind=\"off\"] { border-style: solid; border-color: color-mix(in srgb, var(--dpl-warn) 40%, transparent); background: color-mix(in srgb, var(--dpl-warn) 7%, transparent); }\n.dpl-spinner { width: 18px; height: 18px; border-radius: 99px; border: 2px solid var(--dpl-line-strong); border-top-color: var(--dpl-accent); animation: dpl-spin .8s linear infinite; }\n@keyframes dpl-spin { to { transform: rotate(360deg); } }\n@media (prefers-reduced-motion: reduce) { .dpl-spinner { animation: none; } }\n.dpl-empty { padding: 22px 12px; text-align: center; color: var(--dpl-muted); font-size: 12.5px; }\n\n.dpl-note { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--dpl-r-sm); font-size: 12.5px;\n  border: 1px solid color-mix(in srgb, var(--dpl-warn) 35%, transparent); background: color-mix(in srgb, var(--dpl-warn) 8%, transparent); }\n.dpl-note[data-tone=\"err\"] { border-color: color-mix(in srgb, var(--dpl-err) 40%, transparent); background: color-mix(in srgb, var(--dpl-err) 8%, transparent); }\n.dpl-note[data-tone=\"info\"] { border-color: color-mix(in srgb, var(--dpl-accent) 30%, transparent); background: var(--dpl-accent-soft); }\n.dpl-note-title { font-weight: 650; }\n.dpl-note-body { color: var(--dpl-muted); line-height: 1.65; }\n.dpl-risk { border: 1px solid color-mix(in srgb, var(--dpl-warn) 60%, transparent) !important; background: color-mix(in srgb, var(--dpl-warn) 10%, transparent) !important; }\n\n/* ------------------------------------------------------------ 總覽與快速設定 */\n.dpl-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }\n.dpl-kpi { border: 1px solid var(--dpl-line); border-radius: var(--dpl-r-md); padding: 11px 13px; background: var(--dpl-surface); }\n.dpl-kpi-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }\n.dpl-kpi-label { font-size: 12px; color: var(--dpl-muted); }\n.dpl-kpi-value { font-size: 20px; font-weight: 650; font-variant-numeric: tabular-nums; }\n.dpl-kpi-cap { font-size: 11.5px; color: var(--dpl-faint); font-variant-numeric: tabular-nums; }\n.dpl-bar { height: 4px; border-radius: 99px; background: var(--dpl-sunken); overflow: hidden; margin-top: 8px; }\n.dpl-bar-fill { height: 100%; border-radius: 99px; transition: width .4s ease; }\n\n.dpl-checklist { display: flex; flex-direction: column; }\n.dpl-check { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--dpl-line); }\n.dpl-check:last-child { border-bottom: 0; }\n.dpl-check-mark { width: 22px; height: 22px; flex: 0 0 auto; border-radius: 99px; display: grid; place-items: center; font-size: 12px; font-weight: 650;\n  border: 1.5px solid var(--dpl-line-strong); color: var(--dpl-muted); margin-top: 1px; }\n.dpl-check[data-done=\"true\"] .dpl-check-mark { background: var(--dpl-ok); border-color: var(--dpl-ok); color: #fff; }\n.dpl-check-main { flex: 1 1 auto; min-width: 0; }\n.dpl-check-title { font-weight: 600; }\n.dpl-check[data-done=\"true\"] .dpl-check-title { color: var(--dpl-muted); }\n.dpl-check-body { color: var(--dpl-muted); font-size: 12px; margin-top: 1px; }\n.dpl-check-control { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }\n.dpl-check-control .dpl-input { flex: 1 1 220px; max-width: 340px; }\n\n.dpl-choice-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 10px; }\n.dpl-choice { display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 12px 14px; border-radius: var(--dpl-r-md);\n  border: 1.5px solid var(--dpl-line); background: transparent; color: inherit; font: inherit; cursor: pointer; white-space: normal !important;\n  transition: border-color .12s, background .12s; }\n.dpl-choice:hover { background: var(--dpl-hover); }\n.dpl-choice[data-on=\"true\"] { border-color: var(--dpl-accent); background: var(--dpl-accent-soft); }\n.dpl-choice-title { font-weight: 640; font-size: 13px; }\n.dpl-choice-body { color: var(--dpl-muted); font-size: 12px; white-space: normal; }\n.dpl-change-list { margin: 6px 0 0; padding: 0; list-style: none; font-size: 12px; }\n.dpl-change-list li { display: flex; gap: 8px; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--dpl-line); }\n.dpl-change-list li:last-child { border-bottom: 0; }\n\n/* ------------------------------------------------------------ 儲存列 */\n.dpl-savebar { position: sticky; bottom: 8px; z-index: 6; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;\n  padding: 10px 14px; border-radius: var(--dpl-r-md); border: 1px solid var(--dpl-line-strong); background: var(--dpl-bg);\n  box-shadow: 0 8px 24px rgba(0, 0, 0, .16); }\n.dpl-savebar-text { flex: 1 1 200px; min-width: 0; font-size: 12.5px; }\n.dpl-savebar-text strong { font-weight: 650; }\n.dpl-savebar-keys { color: var(--dpl-muted); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n\n.dpl-toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); z-index: 60; padding: 9px 16px; border-radius: var(--dpl-r-sm);\n  font-size: 12.5px; font-weight: 560; color: #fff; background: color-mix(in srgb, var(--dpl-ok) 92%, #000); box-shadow: 0 8px 24px rgba(0, 0, 0, .28);\n  max-width: min(92vw, 560px); }\n.dpl-toast[data-tone=\"err\"] { background: color-mix(in srgb, var(--dpl-err) 92%, #000); }\n.dpl-toast[data-tone=\"warn\"] { background: color-mix(in srgb, var(--dpl-warn) 92%, #000); }\n.dpl-foot { display: flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap; padding-top: 4px; color: var(--dpl-faint); font-size: 11.5px; }\n\n/* ------------------------------------------------------------ 列表、記錄與素材 */\n.dpl-list-row { display: flex; gap: 10px; align-items: center; padding: 8px 2px; font-size: 12.5px; border-bottom: 1px solid var(--dpl-line); flex-wrap: wrap; }\n.dpl-list-row:last-child { border-bottom: 0; }\n.dpl-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: var(--dpl-muted); overflow-wrap: anywhere; }\n.dpl-grow { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.dpl-log { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.6; max-height: 320px; overflow: auto;\n  padding: 9px 12px; display: flex; flex-direction: column; gap: 1px; background: var(--dpl-sunken); border-radius: var(--dpl-r-sm); }\n.dpl-log-row { display: flex; gap: 8px; align-items: baseline; }\n.dpl-log-time { color: var(--dpl-faint); flex: 0 0 auto; font-variant-numeric: tabular-nums; }\n.dpl-log-level { flex: 0 0 auto; width: 42px; font-weight: 650; font-size: 10.5px; text-transform: uppercase; }\n.dpl-log-level[data-level=\"info\"] { color: var(--dpl-accent); }\n.dpl-log-level[data-level=\"warn\"] { color: var(--dpl-warn); }\n.dpl-log-level[data-level=\"error\"] { color: var(--dpl-err); }\n.dpl-log-level[data-level=\"debug\"] { color: var(--dpl-muted); }\n.dpl-log-event { font-weight: 600; flex: 0 0 auto; }\n.dpl-log-summary { color: var(--dpl-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.dpl-gif-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }\n.dpl-gif-grid img { width: 100%; height: 76px; object-fit: cover; border-radius: 7px; border: 1px solid var(--dpl-line); }\n.dpl-hist-list { max-height: 220px; overflow: auto; }\n.dpl-hist-msg { display: flex; gap: 8px; padding: 5px 2px; font-size: 12px; border-bottom: 1px solid var(--dpl-line); }\n.dpl-hist-author { font-weight: 600; flex: 0 0 auto; }\n.dpl-hist-text { color: var(--dpl-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.dpl-library-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr)); gap: 12px; }\n.dpl-asset { border: 1px solid var(--dpl-line); padding: 14px; border-radius: var(--dpl-r-md); overflow-wrap: anywhere; }\n.dpl-asset label { display: block; margin: 12px 0 5px; font-weight: 600; }\n.dpl-asset textarea, .dpl-asset input, .dpl-asset select { width: 100%; box-sizing: border-box; }\n.dpl-asset p { white-space: pre-wrap; }\n.dpl-asset input[type=checkbox] { width: auto; margin-right: 8px; }\n.dpl-asset.selected { outline: 2px solid var(--dpl-accent); }\n\n/* 面板內未套用元件類別的原生控制項，給一致的基本外觀。 */\n.dpl-card-body input:not([class]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),\n.dpl-card-body select:not([class]), .dpl-card-body textarea:not([class]) {\n  font: inherit; font-size: 12.5px; color: inherit; background: var(--dpl-bg); border: 1px solid var(--dpl-line-strong);\n  border-radius: var(--dpl-r-sm); padding: 6px 10px; min-height: 32px; max-width: 100%; color-scheme: inherit; }\n.dpl-card-body pre { max-width: 100%; overflow: auto; background: var(--dpl-sunken); padding: 10px; border-radius: var(--dpl-r-sm); font-size: 11.5px; }\n\n/* ------------------------------------------------------------ 窄版 */\n@container (max-width: 720px) {\n  .dpl-row { flex-direction: column; gap: 8px; }\n  .dpl-row-main { width: 100%; flex: 0 1 auto; }\n  .dpl-row-control { width: 100%; max-width: none !important; flex: 0 1 auto !important; justify-content: flex-start; }\n  .dpl-row-control .dpl-input, .dpl-row-control .dpl-select, .dpl-row-control .dpl-textarea { width: 100% !important; }\n  .dpl-group { flex: 1 1 30%; padding: 6px 8px; }\n  .dpl-search { max-width: none; }\n  .dpl-group-desc { display: none; }\n  .dpl-card-head { padding: 12px 12px 0; }\n  .dpl-card-body { padding: 8px 12px 12px; }\n}\n\n.dpl-field-group { border-bottom: 1px solid var(--dpl-line); }\n.dpl-field-group:last-child { border-bottom: 0; }\n.dpl-field-group > summary.dpl-subhead { padding: 12px 0; font-size: 13px; color: var(--dpl-fg); }\n.dpl-field-group[open] > summary.dpl-subhead { padding-bottom: 4px; }\n.dpl-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }\n.dpl-check-control .dpl-input-wrap { flex: 1 1 220px; max-width: 340px; width: auto; }\n.dpl-check-control .dpl-input-wrap .dpl-input { max-width: none; }\n.dpl-field-group > summary.dpl-subhead { list-style: none; }\n.dpl-field-group > summary.dpl-subhead::-webkit-details-marker { display: none; }\n.dpl-field-group > summary.dpl-subhead::before { content: \"\"; width: 6px; height: 6px; margin: 0 3px 0 2px; border-right: 1.5px solid currentColor;\n  border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform .12s; opacity: .6; }\n.dpl-field-group[open] > summary.dpl-subhead::before { transform: rotate(45deg); }\n.dpl-field-group > summary.dpl-subhead:hover { color: var(--dpl-accent); }\n\n/* 以 data-on 表示選取狀態的按鈕（各工作台的選項鈕） */\n.dpl-btn[data-on=\"true\"] { background: var(--dpl-accent-soft); border-color: color-mix(in srgb, var(--dpl-accent) 55%, transparent); color: var(--dpl-accent); font-weight: 640; }\n.dpl h3, .dpl h4 { margin: 14px 0 6px; font-size: 13px; font-weight: 650; }\n.dpl-card-body p { margin: 4px 0; }\n\n/* 尚未逐一改版的工作台：直接放在卡片內的按鈕不撐滿整列，標籤與輸入框上下排列。 */\n.dpl-card-body > button, .dpl-card-body > .dpl-btn { align-self: flex-start; }\n.dpl-card-body > label:not(.dpl-row), .dpl-card-body details > label:not(.dpl-row) { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; font-size: 12.5px; font-weight: 560; }\n.dpl-card-body > label:not(.dpl-row) > input, .dpl-card-body > label:not(.dpl-row) > select, .dpl-card-body > label:not(.dpl-row) > textarea { font-weight: 400; }\n.dpl-card-body > details:not(.dpl-field-group):not(.dpl-more) { border: 1px solid var(--dpl-line); border-radius: var(--dpl-r-sm); padding: 8px 12px; margin-top: 8px; }\n.dpl-card-body > details:not(.dpl-field-group):not(.dpl-more) > summary { font-weight: 600; }\n.dpl-card-body > .dpl-actions { margin-top: 8px; }\n\n.dpl-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 10px 14px; align-items: end; }\n.dpl-form-grid > label { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 560; min-width: 0; }\n.dpl-form-grid > button { justify-self: start; }\n.dpl-card-body > .dpl-subhead { margin-top: 10px; padding-top: 12px; border-top: 1px solid var(--dpl-line); color: var(--dpl-fg); font-size: 13px; }\n.dpl-card-body > .dpl-subhead:first-child { margin-top: 0; border-top: 0; }\n.dpl-card-body > textarea.dpl-textarea, .dpl-card-body > textarea.dpl-input { width: 100%; }\n\n/* 工具列中的搜尋框與下拉選單並排，不各自撐滿整列 */\n.dpl-actions > .dpl-input { width: auto; flex: 1 1 200px; }\n.dpl-actions > .dpl-select { width: auto; flex: 0 1 190px; }\n\n/* 卡片內的小表單（.dpl-asset 直接包含欄位標籤時）：欄位多欄並排，標題、說明與長文字佔滿整列。 */\n.dpl-asset:has(> label) { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr)); gap: 10px 14px; align-items: end; }\n.dpl-asset:has(> label) > * { margin: 0; min-width: 0; }\n.dpl-asset:has(> label) > label { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 560; }\n.dpl-asset:has(> label) > :is(h3, h4, p, details, div, article, pre, strong),\n.dpl-asset:has(> label) > label:has(textarea) { grid-column: 1 / -1; }\n.dpl-asset:has(> label) > label:has(input[type=checkbox]) { flex-direction: row; align-items: center; gap: 8px; font-weight: 400; align-self: center; }\n.dpl-asset:has(> label) > button { justify-self: start; }\n.dpl-asset h3 { margin: 0 0 4px; font-size: 13.5px; }\n.dpl-asset + .dpl-asset, .dpl-card-body > .dpl-asset { margin-top: 10px; }\n\n/* 空狀態：沿用舊類別的面板也顯示成虛線框，與狀態區塊一致 */\n.dpl-empty { border: 1px dashed var(--dpl-line-strong); border-radius: var(--dpl-r-md); margin-top: 8px; }\n.dpl-asset > .dpl-actions { margin-top: 8px; }\n.dpl-asset small { color: var(--dpl-muted); }\n\n/* 提示框：一般說明用中性色；只有警示（data-tone=warn、role=alert、風險提示）才用黃色。 */\n.dpl-note { border-color: var(--dpl-line); background: var(--dpl-sunken); }\n.dpl-note[data-tone=\"warn\"], .dpl-note[role=\"alert\"], .dpl-note.dpl-risk { border-color: color-mix(in srgb, var(--dpl-warn) 40%, transparent); background: color-mix(in srgb, var(--dpl-warn) 9%, transparent); }\n.dpl-note[data-tone=\"err\"] { border-color: color-mix(in srgb, var(--dpl-err) 40%, transparent); background: color-mix(in srgb, var(--dpl-err) 8%, transparent); }\n.dpl-note[data-tone=\"info\"] { border-color: color-mix(in srgb, var(--dpl-accent) 30%, transparent); background: var(--dpl-accent-soft); }\n/* 卡片內直接擺放的欄位不撐滿整個寬度 */\n.dpl-card-body > label:not(.dpl-row), .dpl-card-body > .dpl-input:not(textarea), .dpl-card-body > .dpl-select,\n.dpl-card-body > input:not([type=checkbox]):not([type=radio]), .dpl-card-body > select { max-width: 520px; }\n.dpl-card-body > label:not(.dpl-row):has(> input[type=checkbox]), .dpl-card-body details > label:not(.dpl-row):has(> input[type=checkbox]) { flex-direction: row; align-items: center; gap: 8px; font-weight: 400; }\n/* 沒有套用類別的原生按鈕，外觀與一般按鈕一致 */\n.dpl-card-body button:not([class]) { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 6px 12px; border-radius: var(--dpl-r-sm);\n  border: 1px solid var(--dpl-line-strong); background: transparent; color: inherit; font: inherit; font-size: 12.5px; font-weight: 560; cursor: pointer; align-self: flex-start; }\n.dpl-card-body button:not([class]):hover:not(:disabled) { background: var(--dpl-hover); }\n.dpl-card-body button:not([class]):disabled { opacity: .45; cursor: not-allowed; }\n\n/* 單色主題（強調色為白或黑）下仍要看得出選取與開啟狀態 */\n.dpl-switch[data-on=\"true\"]::after { background: var(--dpl-on-accent); }\n.dpl-group[data-active=\"true\"], .dpl-seg button[data-on=\"true\"] { background: color-mix(in srgb, currentColor 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent); }\n.dpl-nav-item[data-active=\"true\"] { background: color-mix(in srgb, currentColor 14%, transparent); border-color: color-mix(in srgb, currentColor 45%, transparent); color: var(--dpl-fg); }\n.dpl-choice[data-on=\"true\"] { background: color-mix(in srgb, currentColor 9%, transparent); }\n.dpl-btn[data-on=\"true\"] { background: color-mix(in srgb, currentColor 14%, transparent); border-color: color-mix(in srgb, currentColor 45%, transparent); color: var(--dpl-fg); }\n.dpl-tag { background: color-mix(in srgb, currentColor 10%, transparent); }\n\n/* 清單挑選器 */\n.dpl-picker-wrap { display: flex; flex-direction: column; gap: 6px; width: 100%; align-items: flex-start; }\n.dpl-picker { width: 100%; display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--dpl-line); border-radius: var(--dpl-r-sm); background: var(--dpl-sunken); }\n.dpl-picker > .dpl-actions:last-child { max-height: 220px; overflow: auto; }\n\n/* 依實機調整：設定頁內容區約 560px 寬。群組頁籤維持單列，用量四格排成 2×2。 */\n.dpl-groups { flex-wrap: nowrap; flex: 1 1 100%; }\n.dpl-group { flex: 1 1 0; min-width: 0; padding: 6px 4px; white-space: nowrap; }\n@container (max-width: 720px) {\n  .dpl-group { flex: 1 1 0; gap: 5px; font-size: 12.5px; }\n  .dpl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n  .dpl-search { flex: 1 1 100%; max-width: none; }\n}\n@container (max-width: 430px) {\n  .dpl-groups { flex-wrap: wrap; }\n  .dpl-group { flex: 1 1 30%; }\n}\n\n/* 儲存列的變更預覽：最多顯示約八項高度，超過可捲動。 */\n.dpl-savebar .dpl-change-list { max-height: 220px; overflow: auto; margin-top: 8px; }\n.dpl-change-list li span { min-width: 0; overflow-wrap: anywhere; }\n.dpl-change-list li strong { text-align: right; overflow-wrap: anywhere; }\n\n/* 表情選擇器 */\n.dpl-emoji-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); gap: 4px; margin: 4px 0 8px; max-height: 300px; overflow: auto; }\n.dpl-emoji-cell { appearance: none; display: inline-flex; align-items: center; justify-content: center; height: 38px; padding: 0; font-size: 20px; line-height: 1; cursor: pointer;\n  border: 1px solid var(--dpl-line); border-radius: var(--dpl-r-sm); background: var(--dpl-surface); color: inherit; }\n.dpl-emoji-cell:hover:not(:disabled) { background: var(--dpl-sunken); }\n.dpl-emoji-cell[data-on=\"true\"] { border-color: var(--dpl-fg); background: var(--dpl-sunken); box-shadow: inset 0 0 0 1px var(--dpl-fg); }\n.dpl-emoji-cell:disabled { opacity: .35; cursor: not-allowed; }\n.dpl-tag img { margin-right: 2px; }\n";
// ---- 01-locale-store.js
// UI-only dictionary: never convert configuration values, prompts or chat payloads.
const UiReact = require('react');
const uiLocaleKey = Symbol.for('dsh.voice.ui.locale.v1');
const uiLocale =
  window[uiLocaleKey] ||
  (window[uiLocaleKey] = (() => {
    let language = 'zh-Hant';
    try {
      if (localStorage.getItem('dsh.voice.ui.locale') === 'zh-Hans') language = 'zh-Hans';
    } catch {}
    const listeners = new Set();
    const store = {
      dictionary: Object.create(null),
      get: () => language,
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      set(next) {
        if (!['zh-Hant', 'zh-Hans'].includes(next) || next === language) return;
        language = next;
        try {
          localStorage.setItem('dsh.voice.ui.locale', next);
        } catch {}
        for (const fn of listeners) fn();
      },
    };
    window.addEventListener?.('storage', (event) => {
      if (event.key === 'dsh.voice.ui.locale') store.set(event.newValue || 'zh-Hant');
    });
    return store;
  })());
// OpenCC-JS 1.4.2: MIT code, Apache-2.0 dictionary. See UI-LOCALE-NOTICE.md.
// ---- 02-opencc.vendor.js
    if (!uiLocale.convert) { let openccConvert = null; const buildOpencc = () => { const module={exports:{}}; const exports=module.exports;
!function(n,e){"object"==typeof exports&&"undefined"!=typeof module?e(exports):"function"==typeof define&&define.amd?define(["exports"],e):e((n="undefined"!=typeof globalThis?globalThis:n||self).OpenCC={})}(this,function(n){"use strict";class e{constructor(){this.map=new Map}addWord(n,e){let{map:t}=this;for(const e of n){const n=e.codePointAt(0),r=t.get(n);if(null==r){const e=new Map;t.set(n,e),t=e}else t=r}t.trie_val=e}loadDict(n){if("string"==typeof n){n=n.split("|");for(const e of n){const[n,t]=e.split(" ");if("string"!=typeof t)throw new TypeError('Invalid dictionary entry: expected string entries to use "source replacement" format.');this.addWord(n,t)}}else for(const e of n){if(!Array.isArray(e)||"string"!=typeof e[0]||"string"!=typeof e[1])throw new TypeError("Invalid dictionary entry: expected [source, replacement] pairs. If you are passing locale dictionaries to ConverterFactory, spread them, for example: ConverterFactory(...Locale.from.cn, ...Locale.to.hk).");const[n,t]=e;this.addWord(n,t)}}loadDictGroup(n){n.slice().reverse().forEach(n=>{this.loadDict(n)})}matchPrefix(n,e){const t=n.length;let r,o=this.map,i=0;for(let a=e;a<t;){const e=n.codePointAt(a);a+=e>65535?2:1;const t=o.get(e);if(void 0===t)break;o=t;const l=o.trie_val;void 0!==l&&(i=a,r=l)}return i>0?{end:i,value:r}:null}segment(n){const e=n.length,t=[];let r=null;for(let i=0;i<e;){const e=this.matchPrefix(n,i);e?(null!==r&&(t.push(n.slice(r,i)),r=null),t.push(n.slice(i,e.end)),i=e.end):(null===r&&(r=i),i+=o(n,i))}return null!==r&&t.push(n.slice(r,e)),t}convert(n){const e=n.length,t=[];let r=null;for(let i=0;i<e;){const e=this.matchPrefix(n,i);e?(null!==r&&(t.push(n.slice(r,i)),r=null),t.push(e.value),i=e.end):(null===r&&(r=i),i+=o(n,i))}return null!==r&&t.push(n.slice(r,e)),t.join("")}}function t(n,e){return n.codePointAt(e)>65535?2:1}function r(n,e){const o=function(n){return n>=12272&&n<=12273?2:n>=12274&&n<=12275?3:n>=12276&&n<=12287?2:0}(n.codePointAt(e));if(0===o)return 0;let i=e+t(n,e);for(let e=0;e<o;e+=1){if(i>=n.length)return 0;i=r(n,i)||i+t(n,i)}return i}function o(n,e){const o=r(n,e);return o>e?o-e:t(n,e)}function i(...n){const t=function(n){return n.flatMap(n=>{if(function(n){return Array.isArray(n)&&n.every(c)}(n))return n;if(c(n))return[n];if(!Array.isArray(n))throw new TypeError("Invalid ConverterFactory argument: expected a dictionary group or locale dictionary collection.");const e=[];let t=0;for(;t<n.length&&c(n[t]);)e.push(n[t].slice()),t+=1;const r=n.slice(t);return e.length>0&&r.length>0&&r.every(l)?(e[e.length-1].push(...r),e):[n]})}(n).map(n=>{const t=new e;return t.loadDictGroup(n),t});return function(n){return t.reduce((n,e)=>e.convert(n),n)}}function a(n){return Array.isArray(n)&&"string"==typeof n[0]&&"string"==typeof n[1]}function l(n){return"string"==typeof n||Array.isArray(n)&&n.every(a)}function c(n){return Array.isArray(n)&&n.every(n=>function(n){return"string"==typeof n&&(""===n||n.includes(" "))}(n)||Array.isArray(n)&&n.every(a))}function s(n){return i([n])}function u(n,e,t,r){return{convert:function(){!function e(o,i){if(o.nodeType!==Node.ELEMENT_NODE||!o.classList.contains("ignore-opencc")){if(o.lang===t?(i=!0,o.shouldChangeLang=!0,o.lang=r):o.lang&&o.lang.length&&(i=!1),i){if("SCRIPT"===o.tagName)return;if("STYLE"===o.tagName)return;"META"===o.tagName&&"description"===o.name||"META"===o.tagName&&"keywords"===o.name?(null==o.originalContent&&(o.originalContent=o.content),o.content=n(o.originalContent)):"IMG"===o.tagName?(null==o.originalAlt&&(o.originalAlt=o.alt),o.alt=n(o.originalAlt)):"INPUT"===o.tagName&&"button"===o.type&&(null==o.originalValue&&(o.originalValue=o.value),o.value=n(o.originalValue)),o.nodeType===Node.ELEMENT_NODE&&(o.hasAttribute("placeholder")&&(null==o.originalPlaceholder&&(o.originalPlaceholder=o.getAttribute("placeholder")),o.setAttribute("placeholder",n(o.originalPlaceholder))),o.hasAttribute("aria-label")&&(null==o.originalAriaLabel&&(o.originalAriaLabel=o.getAttribute("aria-label")),o.setAttribute("aria-label",n(o.originalAriaLabel))))}for(const t of o.childNodes)t.nodeType===Node.TEXT_NODE&&i?(null==t.originalString&&(t.originalString=t.nodeValue),t.nodeValue=n(t.originalString)):e(t,i)}}(e,!1)},restore:function(){!function n(e){if(e.nodeType!==Node.ELEMENT_NODE||!e.classList.contains("ignore-opencc")){e.shouldChangeLang&&(e.lang=t),void 0!==e.originalString&&(e.nodeValue=e.originalString),"META"===e.tagName&&"description"===e.name||"META"===e.tagName&&"keywords"===e.name?void 0!==e.originalContent&&(e.content=e.originalContent):"IMG"===e.tagName?void 0!==e.originalAlt&&(e.alt=e.originalAlt):"INPUT"===e.tagName&&"button"===e.type&&void 0!==e.originalValue&&(e.value=e.originalValue),void 0!==e.originalPlaceholder&&e.setAttribute("placeholder",e.originalPlaceholder),void 0!==e.originalAriaLabel&&e.setAttribute("aria-label",e.originalAriaLabel);for(const t of e.childNodes)n(t)}}(e)}}}var f="一口吃個 一口喫個|一口吃成 一口喫成|一家三口 一家三口|一家五口 一家五口|一家六口 一家六口|一家四口 一家四口|一針 一針|一針見血 一針見血|三針 三針|丟巧針 丟巧針|丹稜 丹稜|九針 九針|亂針繡 亂針繡|仙台 仙台|倒扣針兒 倒扣針兒|做針線 做針線|八字方針 八字方針|刀割針扎 刀割針扎|分針 分針|別針 別針|刺胳針 刺胳針|刺針 刺針|北港島綫 北港島線|十針 十針|南港島綫 南港島線|南針 南針|反時針 反時針|口吃 口吃|台山 台山|台山市 台山市|台州 台州|台州地區 台州地區|台州市 台州市|吃口 喫口|吃口令 吃口令|吃口飯 喫口飯|吃吃 喫喫|吃子 喫子|向風針 向風針|唱針 唱針|啄針兒 啄針兒|嗎啡針 嗎啡針|大政方針 大政方針|大海撈針 大海撈針|大頭針 大頭針|天台 天台|天台女 天台女|天台宗 天台宗|天台山 天台山|天台縣 天台縣|太乙神針 太乙神針|奇台 奇台|女人心海底針 女人心海底針|定南針 定南針|定風針 定風針|將軍澳綫 將軍澳線|對針 對針|小針 小針|小針美容 小針美容|屯馬綫 屯馬線|平針縫 平針縫|幾針 幾針|引線穿針 引線穿針|張口 張口|張柏芝 張柏芝|張栢芝 張栢芝|張飛穿針 張飛穿針|強心針 強心針|弼針 弼針|彈針 彈針|懸針 懸針|懸針垂露 懸針垂露|手腕式指北針 手腕式指北針|扎針 扎針|打完針 打完針|打針 打針|披針形葉 披針形葉|抵針 抵針|拈針指 拈針指|指北針 指北針|指南針 指南針|指揮台 指揮台|指針 指針|指針式 指針式|探針 探針|控制台 控制台|插針 插針|搖針 搖針|搗針 搗針|撞針 撞針|擺針 擺針|收針 收針|教育方針 教育方針|敹一針 敹一針|方針 方針|時針 時針|暈針 暈針|曲別針 曲別針|東九龍綫 東九龍線|東海撈針 東海撈針|東涌綫 東涌線|東鐵綫 東鐵線|松針 松針|枝針 枝針|桑針 桑針|棒針 棒針|棒針衫 棒針衫|棘針 棘針|棘針科 棘針科|棘針門 棘針門|機場快綫 機場快線|步線行針 步線行針|毒針 毒針|毛線針 毛線針|毫針 毫針|水底撈針 水底撈針|沙中綫 沙中線|注射針 注射針|注射針頭 注射針頭|洗面皂 洗面皂|洗髮皂 洗髮皂|浙江天台縣 浙江天台縣|海底撈針 海底撈針|港島綫 港島線|漏針 漏針|炮台山循道衛理中學 炮台山循道衛理中學|無線新聞台 無線新聞台|無針不引線 無針不引線|無針注射器 無針注射器|燔針 燔針|留針 留針|皂化 皂化|皂莢 皂莢|皂莢樹 皂莢樹|皂角 皂角|短針 短針|石針 石針|硬肥皂 硬肥皂|磁針 磁針|磨杵成針 磨杵成針|磨針溪 磨針溪|磨鐵成針 磨鐵成針|秒針 秒針|秧針 秧針|穆稜 穆稜|穿針 穿針|穿針引線 穿針引線|穿針走線 穿針走線|紋光針 紋光針|細針密縷 細針密縷|絞包針 絞包針|給個棒錘當針認 給個棒錘當針認|綏稜 綏稜|綿裏藏針 綿裏藏針|綿裏針 綿裏針|縫衣針 縫衣針|縫針 縫針|縫針補線 縫針補線|縫針跡 縫針跡|總方針 總方針|繃針 繃針|繡花針 繡花針|繡花針兒 繡花針兒|繡針 繡針|羅盤針 羅盤針|美白針 美白針|耳針 耳針|肥皂 肥皂|肥皂劇 肥皂劇|肥皂泡 肥皂泡|肥皂粉 肥皂粉|肥皂絲 肥皂絲|肥皂莢 肥皂莢|胃口 胃口|胸針 胸針|臺灣台 臺灣台|船不漏針漏針沒外人 船不漏針漏針沒外人|花兒針 花兒針|茅針 茅針|荃灣綫 荃灣線|葉針 葉針|藏針縫 藏針縫|藥皂 藥皂|藥針 藥針|蛇口蜂針 蛇口蜂針|螫針 螫針|蠻針瞎灸 蠻針瞎灸|補血針 補血針|補針 補針|見縫插針 見縫插針|觀塘綫 觀塘線|討針線 討針線|象牙針尖 象牙針尖|賀爾蒙針 賀爾蒙針|跳針 跳針|蹇吃 蹇吃|軟肥皂 軟肥皂|迪士尼綫 迪士尼線|迴紋針 迴紋針|退針 退針|逆時針 逆時針|避雷針 避雷針|郭台成 郭台成|郭台銘 郭台銘|鄧艾吃 鄧艾吃|金針 金針|金針山 金針山|金針度人 金針度人|金針花 金針花|金針菇 金針菇|金針菜 金針菜|釘書針 釘書針|針具 針具|針刺 針刺|針刺麻醉 針刺麻醉|針劑 針劑|針孔 針孔|針孔攝影機 針孔攝影機|針孔照像 針孔照像|針孔照像機 針孔照像機|針孔現象 針孔現象|針對 針對|針對性 針對性|針對於 針對於|針尖 針尖|針尖兒 針尖兒|針工 針工|針布 針布|針形葉 針形葉|針指 針指|針挑刀挖 針挑刀挖|針梳機 針梳機|針氈 針氈|針法 針法|針炙 針炙|針狀 針狀|針狀物 針狀物|針盤 針盤|針眼 針眼|針眼子 針眼子|針神 針神|針筆 針筆|針筆匠 針筆匠|針筒 針筒|針箍 針箍|針箍兒 針箍兒|針線 針線|針線包 針線包|針線娘 針線娘|針線活 針線活|針線活計 針線活計|針線盒 針線盒|針線箔籬 針線箔籬|針織 針織|針織品 針織品|針織廠 針織廠|針織料 針織料|針腳 針腳|針葉 針葉|針葉林 針葉林|針葉植物 針葉植物|針葉樹 針葉樹|針針見血 針針見血|針釦 針釦|針鋒 針鋒|針鋒相對 針鋒相對|針鋒相投 針鋒相投|針鋩 針鋩|針頭 針頭|針餌莫減 針餌莫減|針骨 針骨|針魚 針魚|針黹 針黹|針黹紡績 針黹紡績|針鼴 針鼴|針鼻 針鼻|針鼻兒 針鼻兒|釦針 釦針|鉤針 鉤針|銀針 銀針|鋼針 鋼針|錶針 錶針|鐵針 鐵針|長針 長針|開口 開口|防疫針 防疫針|電唱針 電唱針|電針 電針|電針麻醉 電針麻醉|面皂 面皂|頂針 頂針|頂針兒 頂針兒|頂針捱住 頂針捱住|頂門針 頂門針|順時針 順時針|預防針 預防針|領帶針 領帶針|風向針 風向針|飛針走線 飛針走線|香皂 香皂|骨針 骨針|髮針 髮針|鬼針草 鬼針草|鳳台 鳳台|鹽水針 鹽水針|麻醉針 麻醉針|黃成 黃成|鼻針療法 鼻針療法|齧蘗吞針 齧蘗吞針|龍應台 龍應台",g="偽 僞|兑 兌|卧 臥|叁 叄|台 臺|吃 喫|唇 脣|啟 啓|囱 囪|媪 媼|媯 嬀|悦 悅|愠 慍|户 戶|捝 挩|揾 搵|敍 敘|敚 敓|枱 檯|枴 柺|棁 梲|榅 榲|氲 氳|涚 涗|温 溫|溈 潙|潀 潨|濕 溼|灶 竈|為 爲|煴 熅|痴 癡|皂 皁|眾 衆|秘 祕|税 稅|稜 棱|粧 妝|粽 糉|糭 糉|綫 線|緼 縕|缽 鉢|脱 脫|腽 膃|葱 蔥|蒀 蒕|蒍 蔿|藴 蘊|蜕 蛻|衞 衛|衹 只|説 說|踴 踊|輼 轀|醖 醞|針 鍼|鈎 鉤|鋭 銳|閲 閱|鰛 鰮",d="丹尼·波爾 丹尼·博伊爾|伊利諾 伊利諾伊|伊利諾州 伊利諾伊州|伊力·卡山 伊利亞·卡贊|伺服器 服務器|佐治·古尼 喬治·克魯尼|作業系統 操作系統|保羅·夏傑斯 保羅·哈吉斯|保羅·湯馬士·安德遜 保羅·托馬斯·安德森|北卡羅萊納 北卡羅來納|北卡羅萊納州 北卡羅來納州|南卡羅萊納 南卡羅來納|南卡羅萊納州 南卡羅來納州|占士·金馬倫 詹姆斯·卡梅隆|古利姆·迪托路 吉列爾莫·德爾托羅|史提夫·麥昆 史蒂夫·麥奎因|史提芬·史匹堡 斯蒂芬·斯皮爾伯格|嘉芙蓮·碧格露 凱瑟琳·畢格羅|基斯杜化·路蘭 克里斯托弗·諾蘭|大衛·連 大衛·利恩|奇連·伊士活 克林特·伊斯特伍德|奇雲·高士拿 凱文·科斯特納|奧克拉荷馬 俄克拉何馬|奧克拉荷馬州 俄克拉何馬州|奧利華·史東 奧利弗·斯通|威廉·佛烈金 威廉·弗萊德金|密芝根 密歇根|密芝根州 密歇根州|寬頻 寬帶|彼德·積遜 彼得·傑克遜|德薩斯 得克薩斯|德薩斯州 得克薩斯州|愛瑪·湯馬士 艾瑪·托馬斯|愛黛兒·羅曼斯基 阿黛爾·羅曼斯基|搜尋 搜索|朗·侯活 朗·霍華德|查理士·路雲 查爾斯·羅文|梳芙厘 舒芙蕾|森·曼特斯 山姆·曼德斯|概率 概率|機會率 概率|機率 幾率|法蘭絲·麥杜雯 弗朗西絲·麥克多曼德|活地·亞倫 伍迪·艾倫|游標 光標|湯賀柏 湯姆·霍伯|滑鼠 鼠標|珍·甘比茵 簡·坎皮恩|畢·彼特 布拉德·皮特|硬碟 硬盤|私隱權 隱私權|程式語言 編程語言|米克·尼高斯 邁克·尼科爾斯|米路·吉遜 梅爾·吉布森|米高·哈薩拿維斯 米歇爾·阿扎納維西於斯|米高·德格拉斯 邁克爾·道格拉斯|約瑟·曼基威士 約瑟夫·曼凱維奇|維珍尼亞 弗吉尼亞|維珍尼亞州 弗吉尼亞州|羅德島 羅得島|羅德島州 羅得島州|羅拔·淮斯 羅伯特·懷斯|羅拔·湛米基斯 羅伯特·澤米吉斯|羅拔·烈福 羅伯特·雷德福|艾力謝路·高沙里斯·依拿力圖 亞歷杭德羅·岡薩雷斯·伊納裏圖|華倫·比提 沃倫·比蒂|西維珍尼亞 西弗吉尼亞|西維珍尼亞州 西弗吉尼亞州|記憶體模組 內存條|資料夾 文件夾|賓·艾佛力 本·阿弗萊克|賓夕凡尼亞 賓夕法尼亞|賓夕凡尼亞州 賓夕法尼亞州|路蘭 諾蘭|辛·貝克 肖恩·貝克|馬利蘭 馬里蘭|馬利蘭州 馬里蘭州|馬田·史高西斯 馬丁·斯科塞斯|高安兄弟 科恩兄弟",p="一口吃個 一口喫個|一口吃成 一口喫成|一家三口 一家三口|一家五口 一家五口|一家六口 一家六口|一家四口 一家四口|一展長才 一展長才|一流人才 一流人才|一表人才 一表人才|一針 一針|一針見血 一針見血|七步之才 七步之才|七步奇才 七步奇才|三才 三才|三才圖會 三才圖會|三針 三針|上梁 上樑|上梁不正 上樑不正|上梁不正下梁歪 上樑不正下樑歪|上梁文 上樑文|下才 下才|下梁 下樑|不成才 不成才|不才 不才|不打不成才 不打不成才|不良才 不良才|丟巧針 丟巧針|中才 中才|中核 中核|丹稜 丹稜|主梁 主樑|之核 之核|九針 九針|乾奴才 乾奴才|亂針繡 亂針繡|二流人才 二流人才|亞核 亞核|人才 人才|人才出衆 人才出衆|人才外流 人才外流|人才庫 人才庫|人才流失 人才流失|人才濟濟 人才濟濟|人才輩出 人才輩出|人才難得 人才難得|人盡其才 人盡其才|什么 什麼|仙才 仙才|伊核 伊核|作育英才 作育英才|佳人才子 佳人才子|個核 個核|倒了核桃車子 倒了核桃車子|倒扣針兒 倒扣針兒|偏才 偏才|做針線 做針線|偷梁換柱 偷樑換柱|傲世輕才 傲世輕才|僅作參考 僅作參考|僅供參考 僅供參考|儲訓人才 儲訓人才|光脊梁 光脊樑|免參 免參|內參 內參|內核 內核|全才 全才|全程參加 全程參加|全面禁止核試驗條約 全面禁止核試驗條約|八字方針 八字方針|八斗之才 八斗之才|八斗才 八斗才|公才公望 公才公望|公衆參與 公衆參與|六才子書 六才子書|其核 其核|冠世之才 冠世之才|冰核 冰核|几案之才 几案之才|凡才 凡才|出倫之才 出倫之才|刀割針扎 刀割針扎|分針 分針|初露才華 初露才華|別針 別針|利弊參半 利弊參半|刺股懸梁 刺股懸樑|刺胳針 刺胳針|刺針 刺針|刺骨懸梁 刺骨懸樑|剋核 剋核|前核 前核|力薄才疏 力薄才疏|功過參半 功過參半|動如參商 動如參商|匡濟之才 匡濟之才|十針 十針|千噸級核武器 千噸級核武器|南針 南針|博學多才 博學多才|卯酉參辰 卯酉參辰|印核 印核|卵核 卵核|原子核 原子核|原核 原核|去核 去核|參予 參予|參事 參事|參伍 參伍|參佐 參佐|參假 參假|參兩院 參兩院|參前落後 參前落後|參加 參加|參加人 參加人|參加國 參加國|參加完 參加完|參加爲 參加爲|參加獎 參加獎|參加者 參加者|參劾 參劾|參半 參半|參合 參合|參同契 參同契|參商 參商|參團 參團|參堂 參堂|參場 參場|參天 參天|參奏 參奏|參孫 參孫|參宿 參宿|參宿七 參宿七|參將 參將|參展 參展|參展商 參展商|參展團 參展團|參差 參差|參差不齊 參差不齊|參差錯落 參差錯落|參度 參度|參悟 參悟|參戰 參戰|參戰國 參戰國|參拜 參拜|參拾壹 參拾壹|參拾陸 參拾陸|參政 參政|參政權 參政權|參數 參數|參數表 參數表|參會 參會|參朝 參朝|參本 參本|參校 參校|參演 參演|參照 參照|參照卡 參照卡|參照物 參照物|參照系 參照系|參看 參看|參知政事 參知政事|參破 參破|參禪 參禪|參綜 參綜|參考 參考|參考值 參考值|參考價 參考價|參考價值 參考價值|參考參考 參考參考|參考座標 參考座標|參考性 參考性|參考手冊 參考手冊|參考文獻 參考文獻|參考書 參考書|參考書目 參考書目|參考材料 參考材料|參考法 參考法|參考消息 參考消息|參考特藏 參考特藏|參考系 參考系|參考資料 參考資料|參股 參股|參與 參與|參與人員 參與人員|參與制 參與制|參與度 參與度|參與感 參與感|參與權 參與權|參與率 參與率|參與者 參與者|參衆兩院 參衆兩院|參見 參見|參見互照 參見互照|參見注 參見注|參觀 參觀|參觀券 參觀券|參觀參觀 參觀參觀|參觀團 參觀團|參觀團體 參觀團體|參觀完 參觀完|參觀者 參觀者|參訂 參訂|參訓 參訓|參訪 參訪|參訪團 參訪團|參評 參評|參話頭 參話頭|參請 參請|參謀 參謀|參謀總部 參謀總部|參謀總長 參謀總長|參謀長 參謀長|參謁 參謁|參譚 參譚|參議 參議|參議員 參議員|參議會 參議會|參議院 參議院|參賽 參賽|參賽國 參賽國|參賽權 參賽權|參賽片 參賽片|參賽者 參賽者|參贊 參贊|參軍 參軍|參辰 參辰|參辰卯酉 參辰卯酉|參辰日月 參辰日月|參透 參透|參道 參道|參選 參選|參選人 參選人|參酌 參酌|參量 參量|參量空間 參量空間|參錯 參錯|參閱 參閱|參院 參院|參雜 參雜|參靈 參靈|參革 參革|參預 參預|參頭 參頭|參驗 參驗|反時針 反時針|反核 反核|取才 取才|口吃 口吃|口才 口才|口才好 口才好|口才辨給 口才辨給|可供參考 可供參考|可憎才 可憎才|吃口 喫口|吃口令 吃口令|吃口飯 喫口飯|吃吃 喫喫|吃子 喫子|合著 合著|合著者 合著者|同參 同參|名著 名著|向風針 向風針|命世之才 命世之才|命世才 命世才|和核 和核|唐才常 唐才常|唱針 唱針|啄針兒 啄針兒|善才 善才|善才童子 善才童子|喜憂參半 喜憂參半|喝參 喝參|喫敲才 喫敲才|喬才 喬才|單核 單核|單核細胞增多症 單核細胞增多症|嗎啡針 嗎啡針|四才子 四才子|四核 四核|圈梁 圈樑|國家棟梁 國家棟樑|土參 土參|在橋梁工地上 在橋樑工地上|地核 地核|地面核爆炸 地面核爆炸|埋沒人才 埋沒人才|增量參數 增量參數|外才 外才|外核 外核|多么 多麼|多事逞才 多事逞才|多才 多才|多才多藝 多才多藝|多核 多核|大廈棟梁 大廈棟樑|大才 大才|大才小用 大才小用|大才槃槃 大才槃槃|大政方針 大政方針|大曆十才子 大曆十才子|大核 大核|大梁 大梁|大海撈針 大海撈針|大頭針 大頭針|天妒英才 天妒英才|天才 天才|天才兒童 天才兒童|天才出自勤奮 天才出自勤奮|天才型 天才型|天才教育 天才教育|天才橫溢 天才橫溢|天才論 天才論|天縱之才 天縱之才|太乙神針 太乙神針|奇才 奇才|奇才異能 奇才異能|女人心海底針 女人心海底針|女子參政主義 女子參政主義|女子參政權 女子參政權|女秀才 女秀才|女貌郎才 女貌郎才|奴才 奴才|好么 好麼|妙才 妙才|學優才贍 學優才贍|學淺才疏 學淺才疏|學疏才淺 學疏才淺|宏內核 宏內核|定南針 定南針|定風針 定風針|實才 實才|將才 將才|將遇良才 將遇良才|專才 專才|專業人才 專業人才|專門人才 專門人才|對針 對針|小丑跳梁 小丑跳樑|小才大用 小才大用|小才子 小才子|小秀才 小秀才|小秀才學堂 小秀才學堂|小醜跳梁 小醜跳樑|小針 小針|小針美容 小針美容|少年才俊 少年才俊|尺二秀才 尺二秀才|屈才 屈才|屋梁 屋樑|展才 展才|山梁 山樑|岑參 岑參|巨著 巨著|帶團參加 帶團參加|常用參考書 常用參考書|平梁 平樑|平針縫 平針縫|幹才 幹才|幾針 幾針|庸才 庸才|廩膳秀才 廩膳秀才|引線穿針 引線穿針|張口 張口|張飛穿針 張飛穿針|強心針 強心針|弼針 弼針|彈針 彈針|彗核 彗核|形名參同 形名參同|待著 待着|得失參半 得失參半|微核 微核|徵才 徵才|德才 德才|德才兼備 德才兼備|德薄才疏 德薄才疏|志大才疏 志大才疏|志大才短 志大才短|志廣才疏 志廣才疏|怎么 怎麼|恃才傲物 恃才傲物|恃才矜己 恃才矜己|恃才自專 恃才自專|惡名昭著 惡名昭著|意廣才疏 意廣才疏|愛才 愛才|愛才好士 愛才好士|愛才如命 愛才如命|愛才若渴 愛才若渴|憂喜參半 憂喜參半|憐才 憐才|懷才不遇 懷才不遇|懷才抱德 懷才抱德|懸梁 懸樑|懸梁刺股 懸樑刺股|懸梁自盡 懸樑自盡|懸臂梁 懸臂樑|懸針 懸針|懸針垂露 懸針垂露|成兆才 成兆才|成核 成核|戰術核武器 戰術核武器|戳脊梁 戳脊樑|戳脊梁骨 戳脊樑骨|手腕式指北針 手腕式指北針|才人 才人|才俊 才俊|才儲八斗 才儲八斗|才具 才具|才兼文武 才兼文武|才分 才分|才力 才力|才勇兼優 才勇兼優|才名 才名|才器 才器|才士 才士|才大難用 才大難用|才女 才女|才如史遷 才如史遷|才媛 才媛|才子 才子|才子佳人 才子佳人|才子書 才子書|才學 才學|才學兼優 才學兼優|才守 才守|才定 才定|才幹 才幹|才廣妨身 才廣妨身|才微智淺 才微智淺|才德 才德|才德兼備 才德兼備|才思 才思|才思敏捷 才思敏捷|才悟 才悟|才情 才情|才智 才智|才望 才望|才氣 才氣|才氣無雙 才氣無雙|才氣縱橫 才氣縱橫|才氣過人 才氣過人|才爲世出 才爲世出|才用 才用|才略 才略|才略過人 才略過人|才當曹斗 才當曹斗|才疏學淺 才疏學淺|才疏德薄 才疏德薄|才疏志大 才疏志大|才疏意廣 才疏意廣|才疏計拙 才疏計拙|才短氣粗 才短氣粗|才秀人微 才秀人微|才能 才能|才能幹濟 才能幹濟|才色 才色|才華 才華|才華出衆 才華出衆|才華橫溢 才華橫溢|才華洋溢 才華洋溢|才華蓋世 才華蓋世|才蔽識淺 才蔽識淺|才藝 才藝|才藝卓絕 才藝卓絕|才藝技能 才藝技能|才藝班 才藝班|才藝秀 才藝秀|才藻 才藻|才語 才語|才識 才識|才識過人 才識過人|才貌 才貌|才貌出衆 才貌出衆|才貌雙全 才貌雙全|才貫二酉 才貫二酉|才資 才資|才輕德薄 才輕德薄|才過子建 才過子建|才過屈宋 才過屈宋|才非玉潤 才非玉潤|才高八斗 才高八斗|才高意廣 才高意廣|才高氣傲 才高氣傲|才高行厚 才高行厚|才高行潔 才高行潔|扎針 扎針|打參 打參|打完針 打完針|打針 打針|扛大梁 扛大樑|披針形葉 披針形葉|抵針 抵針|拈針指 拈針指|拔地參天 拔地參天|指北針 指北針|指南針 指南針|指針 指針|指針式 指針式|挑大梁 挑大樑|挑正梁 挑正樑|捫參歷井 捫參歷井|捷才 捷才|掃眉才子 掃眉才子|探針 探針|提梁 提樑|插針 插針|揚己露才 揚己露才|搖針 搖針|搗針 搗針|撞針 撞針|撥亂之才 撥亂之才|撫梁易柱 撫樑易柱|擬核 擬核|擺針 擺針|收針 收針|放參 放參|教育方針 教育方針|敹一針 敹一針|文才 文才|文武全才 文武全才|文選爛秀才半 文選爛秀才半|斗筲之才 斗筲之才|斗轉參橫 斗轉參橫|方針 方針|日月參辰 日月參辰|早參 早參|昭著 昭著|時針 時針|晚參 晚參|晨參暮省 晨參暮省|晨參暮禮 晨參暮禮|晶核 晶核|暈針 暈針|暮禮晨參 暮禮晨參|曠世之才 曠世之才|曠世奇才 曠世奇才|曠世逸才 曠世逸才|曲別針 曲別針|曹參 曹參|曾參 曾參|曾參殺人 曾參殺人|月核 月核|月落參橫 月落參橫|有才 有才|有才幹 有才幹|有才無命 有才無命|有核 有核|朝參暮禮 朝參暮禮|朝核 朝核|木梁 木樑|未易才 未易才|朽木之才 朽木之才|杏核 杏核|東海撈針 東海撈針|松針 松針|板梁橋 板樑橋|林木參天 林木參天|果核 果核|枝針 枝針|架梁 架樑|架海金梁 架海金樑|柱梁 柱樑|核下 核下|核二廠 核二廠|核人 核人|核仁 核仁|核以 核以|核僵持 核僵持|核兒 核兒|核冬天 核冬天|核出口控制 核出口控制|核力 核力|核化 核化|核區 核區|核可 核可|核合成 核合成|核和 核和|核四 核四|核型 核型|核子 核子|核子廠 核子廠|核孔 核孔|核島 核島|核工 核工|核彈 核彈|核心 核心|核戰 核戰|核戰鬥部 核戰鬥部|核技術 核技術|核數 核數|核是 核是|核有 核有|核果 核果|核桃 核桃|核武 核武|核火箭發動機 核火箭發動機|核炫 核炫|核燃料後處理 核燃料後處理|核爆 核爆|核爆炸煙雲 核爆炸煙雲|核狀 核狀|核球 核球|核甘 核甘|核當量 核當量|核發 核發|核發電 核發電|核發電廠 核發電廠|核的 核的|核磁 核磁|核種 核種|核突 核突|核粒 核粒|核糖 核糖|核糖核酸 核糖核酸|核素 核素|核線 核線|核能 核能|核能技術 核能技術|核能發電 核能發電|核能發電廠 核能發電廠|核能電廠 核能電廠|核膜 核膜|核苷 核苷|核菌 核菌|核融合 核融合|核融合發電 核融合發電|核解 核解|核計劃 核計劃|核試 核試|核談 核談|核質 核質|核載 核載|核辦 核辦|核配 核配|核酪 核酪|核酶 核酶|核酸 核酸|核防禦 核防禦|核電 核電|核電廠 核電廠|核電磁脈衝 核電磁脈衝|核體 核體|核點 核點|桃核 桃核|桃核雕 桃核雕|桑針 桑針|梁上 樑上|梁上君子 樑上君子|梁子 樑子|梁木 梁木|梁木其壞 樑木其壞|梁架 樑架|梁柱 樑柱|梁棟 樑棟|梁龍 梁龍|梅核 梅核|棄核 棄核|棋逢對手將遇良才 棋逢對手將遇良才|棒針 棒針|棒針衫 棒針衫|棗核 棗核|棘針 棘針|棘針科 棘針科|棘針門 棘針門|棟梁 棟樑|棟梁之任 棟樑之任|棟梁之材 棟樑之材|棟梁之臣 棟樑之臣|椽梁 椽樑|極核 極核|槃才 槃才|槃槃大才 槃槃大才|樹梁 樹樑|橋梁 橋樑|橋梁工事 橋樑工事|橋梁工程 橋樑工程|橘核 橘核|橫打鼻梁兒 橫打鼻樑兒|橫梁 橫樑|檢核 檢核|檢核表 檢核表|歌聲繞梁 歌聲繞樑|正則參數 正則參數|正梁 正樑|步線行針 步線行針|歪才 歪才|歷練之才 歷練之才|殺才 殺才|毒針 毒針|比才 比才|毛線針 毛線針|毫針 毫針|氘核 氘核|水底撈針 水底撈針|求才 求才|求才若渴 求才若渴|江南四大才子 江南四大才子|江參 江參|江淹才盡 江淹才盡|江郎才盡 江郎才盡|沒梁桶 沒樑桶|沒脊梁 沒脊樑|河梁 河樑|沿才授職 沿才授職|注射針 注射針|注射針頭 注射針頭|泰山梁木 泰山樑木|洗面皂 洗面皂|洗髮皂 洗髮皂|洛陽才子 洛陽才子|津梁 津樑|派團參加 派團參加|海參威 海參威|海參崴 海參崴|海底撈針 海底撈針|滿腹才學 滿腹才學|漁梁 漁樑|漏針 漏針|潑才 潑才|澤梁 澤樑|濟世之才 濟世之才|濠梁 濠樑|無核 無核|無梁 無樑|無梁斗 無樑斗|無梁樓蓋 無樑樓蓋|無針不引線 無針不引線|無針注射器 無針注射器|煤核 煤核|熔核 熔核|熱核 熱核|燔針 燔針|片善小才 片善小才|物色人才 物色人才|特殊才能 特殊才能|狀態參數 狀態參數|狗才 狗才|獨挑大梁 獨挑大樑|率團參加 率團參加|玉參差 玉參差|玉尺量才 玉尺量才|王佐之才 王佐之才|玳梁 玳樑|玳瑁梁 玳瑁樑|瑣才 瑣才|甄才品能 甄才品能|甄選人才 甄選人才|甚么 甚麼|男才女貌 男才女貌|畎畝下才 畎畝下才|留針 留針|略無參商 略無參商|畫梁雕棟 畫樑雕棟|畫棟雕梁 畫棟雕樑|異才 異才|當世才度 當世才度|疑信參半 疑信參半|疑核 疑核|痔核 痔核|痛失英才 痛失英才|登庸人才 登庸人才|發展核武器 發展核武器|白鶴梁 白鶴梁|白鶴秀才 白鶴秀才|百萬噸級核武器 百萬噸級核武器|百里之才 百里之才|皂化 皂化|皂莢 皂莢|皂莢樹 皂莢樹|皂角 皂角|的核 的核|直接參與 直接參與|真才實學 真才實學|真核 真核|矜才使氣 矜才使氣|矜能負才 矜能負才|短針 短針|石梁 石樑|石針 石針|硬核 硬核|硬肥皂 硬肥皂|碌碌庸才 碌碌庸才|磁核 磁核|磁針 磁針|磨杵成針 磨杵成針|磨脊梁 磨脊樑|磨針溪 磨針溪|磨鐵成針 磨鐵成針|社交才能 社交才能|禁核 禁核|秀才 秀才|秀才不出門能知天下事 秀才不出門能知天下事|秀才人情 秀才人情|秀才作醫如菜作虀 秀才作醫如菜作虀|秀才造反 秀才造反|秒針 秒針|秧針 秧針|穆稜 穆稜|積極參加 積極參加|積極參與 積極參與|空梁落燕泥 空樑落燕泥|穿針 穿針|穿針引線 穿針引線|穿針走線 穿針走線|筆參造化 筆參造化|管理人才 管理人才|箱梁 箱樑|精核 精核|約核 約核|約翰參書 約翰參書|紋光針 紋光針|細針密縷 細針密縷|結核 結核|結核桿菌 結核桿菌|結梁子 結樑子|絕對參照 絕對參照|絕才 絕才|絞包針 絞包針|給個棒錘當針認 給個棒錘當針認|綏稜 綏稜|經世之才 經世之才|經國之才 經國之才|經濟之才 經濟之才|網羅人才 網羅人才|綿裏藏針 綿裏藏針|綿裏針 綿裏針|縫衣針 縫衣針|縫針 縫針|縫針補線 縫針補線|縫針跡 縫針跡|縱梁 縱樑|總參謀部 總參謀部|總參謀長 總參謀長|總方針 總方針|繃針 繃針|繞梁 繞樑|繞梁三日 繞樑三日|繞梁之音 繞樑之音|繞梁韻永 繞樑韻永|繡花針 繡花針|繡花針兒 繡花針兒|繡針 繡針|羅盤針 羅盤針|美國參議院 美國參議院|美才 美才|美白針 美白針|老奴才 老奴才|耐多藥結核病 耐多藥結核病|耳針 耳針|聯合參謀 聯合參謀|聰明才智 聰明才智|肥皂 肥皂|肥皂劇 肥皂劇|肥皂泡 肥皂泡|肥皂粉 肥皂粉|肥皂絲 肥皂絲|肥皂莢 肥皂莢|育才 育才|胃口 胃口|背梁骨 背樑骨|胡才勇 胡才勇|胸針 胸針|脊梁 脊樑|脊梁背 脊樑背|脊梁骨 脊樑骨|自學成才 自學成才|自核 自核|船不漏針漏針沒外人 船不漏針漏針沒外人|花兒針 花兒針|花旗參 花旗參|英才 英才|英才俊偉 英才俊偉|茂才 茂才|茂才異等 茂才異等|茅針 茅針|茲核 茲核|菌核 菌核|菲才寡學 菲才寡學|落月屋梁 落月屋樑|葉針 葉針|著作 著作|著名 著名|著式 著式|著志 著志|著於 著於|著書 著書|著白 著白|著稱 著稱|著稱於世 著稱於世|著者 著者|著述 著述|著錄 著錄|蓋世之才 蓋世之才|藏針縫 藏針縫|藥皂 藥皂|藥針 藥針|蘋果核 蘋果核|蛇口蜂針 蛇口蜂針|螫針 螫針|蠹啄剖梁柱 蠹啄剖樑柱|蠻針瞎灸 蠻針瞎灸|行短才喬 行短才喬|行短才高 行短才高|補血針 補血針|補針 補針|製麵 製麪|西洋參 西洋參|要么 要麼|見縫插針 見縫插針|討針線 討針線|詠雪之才 詠雪之才|詩才 詩才|誇才賣智 誇才賣智|說參請 說參請|請參閱 請參閱|謊敲才 謊敲才|謝絕參觀 謝絕參觀|識多才廣 識多才廣|識才 識才|識才尊賢 識才尊賢|譭譽參半 譭譽參半|豎柱上梁 豎柱上樑|豎起脊梁 豎起脊樑|象牙針尖 象牙針尖|豬八戒喫人參果 豬八戒喫人參果|負才 負才|負才任氣 負才任氣|負才使氣 負才使氣|賀爾蒙針 賀爾蒙針|賢才 賢才|賤才 賤才|超世之才 超世之才|趫才 趫才|跳梁 跳樑|跳梁小丑 跳樑小丑|跳梁小醜 跳樑小醜|跳梁猖獗之小丑 跳樑猖獗之小丑|跳梁猖獗之小醜 跳樑猖獗之小醜|跳針 跳針|蹇吃 蹇吃|身才 身才|軟肥皂 軟肥皂|輇才 輇才|輕核 輕核|辯才 辯才|辯才天 辯才天|辯才無礙 辯才無礙|这么 这麼|迴紋針 迴紋針|退針 退針|逆時針 逆時針|這么 這麼|通人達才 通人達才|通才 通才|通才教育 通才教育|通才練識 通才練識|造就人才 造就人才|逸才 逸才|逸羣之才 逸羣之才|過人才略 過人才略|過梁 過樑|違紀參選 違紀參選|適才 適才|選才 選才|選民參加率 選民參加率|遺才 遺才|避雷針 避雷針|邊核 邊核|那么 那麼|郎才女姿 郎才女姿|郎才女貌 郎才女貌|鄧艾吃 鄧艾吃|野無遺才 野無遺才|量才錄用 量才錄用|金針 金針|金針山 金針山|金針度人 金針度人|金針花 金針花|金針菇 金針菇|金針菜 金針菜|釘書針 釘書針|針具 針具|針刺 針刺|針刺麻醉 針刺麻醉|針劑 針劑|針孔 針孔|針孔攝影機 針孔攝影機|針孔照像 針孔照像|針孔照像機 針孔照像機|針孔現象 針孔現象|針對 針對|針對性 針對性|針對於 針對於|針尖 針尖|針尖兒 針尖兒|針工 針工|針布 針布|針形葉 針形葉|針指 針指|針挑刀挖 針挑刀挖|針梳機 針梳機|針氈 針氈|針法 針法|針炙 針炙|針狀 針狀|針狀物 針狀物|針盤 針盤|針眼 針眼|針眼子 針眼子|針神 針神|針筆 針筆|針筆匠 針筆匠|針筒 針筒|針箍 針箍|針箍兒 針箍兒|針線 針線|針線包 針線包|針線娘 針線娘|針線活 針線活|針線活計 針線活計|針線盒 針線盒|針線箔籬 針線箔籬|針織 針織|針織品 針織品|針織廠 針織廠|針織料 針織料|針腳 針腳|針葉 針葉|針葉林 針葉林|針葉植物 針葉植物|針葉樹 針葉樹|針針見血 針針見血|針釦 針釦|針鋒 針鋒|針鋒相對 針鋒相對|針鋒相投 針鋒相投|針鋩 針鋩|針頭 針頭|針餌莫減 針餌莫減|針骨 針骨|針魚 針魚|針黹 針黹|針黹紡績 針黹紡績|針鼴 針鼴|針鼻 針鼻|針鼻兒 針鼻兒|釦針 釦針|鉅著 鉅著|鉤針 鉤針|銀核 銀核|銀針 銀針|鋼梁 鋼樑|鋼針 鋼針|錶針 錶針|鐵針 鐵針|鑑核備查 鑑核備查|鑿壁懸梁 鑿壁懸樑|長才 長才|長針 長針|開口 開口|防疫針 防疫針|陰核 陰核|隨才器使 隨才器使|雄才 雄才|雄才大略 雄才大略|雌核 雌核|雕梁 雕樑|雕梁畫柱 雕樑畫柱|雕梁畫棟 雕樑畫棟|雙核 雙核|雙鏈核酸 雙鏈核酸|電唱針 電唱針|電針 電針|電針麻醉 電針麻醉|需才孔亟 需才孔亟|露才 露才|露才揚己 露才揚己|霸才 霸才|非才 非才|非核 非核|面皂 面皂|頂核 頂核|頂梁柱 頂樑柱|頂梁骨走了真魂 頂樑骨走了真魂|頂針 頂針|頂針兒 頂針兒|頂針捱住 頂針捱住|頂門針 頂門針|順時針 順時針|預防針 預防針|領帶針 領帶針|頭懸梁錐刺股 頭懸樑錐刺股|顯著 顯著|顯著標志 顯著標志|風向針 風向針|風流才子 風流才子|飛梁 飛樑|飛針走線 飛針走線|飽學秀才 飽學秀才|餘音繞梁 餘音繞樑|餘響繞梁 餘響繞樑|香皂 香皂|馮驥才 馮驥才|驚才絕豔 驚才絕豔|骨針 骨針|高參 高參|高才 高才|高才生 高才生|高級管理人才 高級管理人才|髮針 髮針|鬼才 鬼才|鬼針草 鬼針草|魚梁 魚樑|魚頭參政 魚頭參政|鴻篇鉅著 鴻篇鉅著|鹽水針 鹽水針|麴秀才 麴秀才|麻醉針 麻醉針|黃有才 黃有才|點核 點核|鼻梁 鼻樑|鼻梁兒 鼻樑兒|鼻梁骨 鼻樑骨|鼻無梁柱 鼻無樑柱|鼻針療法 鼻針療法|齧蘗吞針 齧蘗吞針",h="么 幺|偽 僞|參 蔘|吃 喫|唇 脣|啟 啓|媯 嬀|嫻 嫺|峰 峯|床 牀|才 纔|核 覈|汙 污|洩 泄|溈 潙|潀 潨|灶 竈|為 爲|痴 癡|痺 痹|皂 皁|眾 衆|睪 睾|秘 祕|稜 棱|簷 檐|粽 糉|缽 鉢|群 羣|著 着|蒍 蔿|裡 裏|踴 踊|針 鍼|韁 繮|顎 齶|鯰 鮎|麵 麪",y="A型肝炎 甲型肝炎|A肝 甲肝|BMW集團 寶馬集團|B型肝炎 乙型肝炎|B肝 乙肝|C型肝炎 丙型肝炎|C肝 丙肝|D型肝炎 丁型肝炎|D肝 丁肝|E型肝炎 戊型肝炎|E肝 戊肝|PN接面 PN結|SQL隱碼攻擊 SQL注入|三極體 三極管|下拉式清單 下拉列表|丙胺酸 丙氨酸|丟擲 拋出|中介軟體 中間件|丹尼·鮑伊 丹尼·博伊爾|主機板 主板|主開機記錄 主引導記錄|乙太網 以太網|乙太網路 以太網|乙太網路由器 以太網路由器|乙太網路路由器 以太網路由器|乙醯胺酚 對乙酰氨基酚|乳酪 奶酪|二極體 二極管|互動 交互|互動式 交互式|亞塞拜然 阿塞拜疆|亮胺酸 亮氨酸|人工智慧 人工智能|介面 界面|介面卡 適配器|代碼 代碼|代謝症候群 代謝綜合徵|伊利諾 伊利諾伊|伊利諾州 伊利諾伊州|伊力·卡山 伊利亞·卡贊|伺服器 服務器|佇列 隊列|位元 比特|位元率 比特率|位元組 字節|位元速率 碼率|位址 地址|位址列 地址欄|低級 低級|低階 低級|佛漢·威廉斯 沃恩·威廉斯|佛瑞 福雷|作業系統 操作系統|使用者 用戶|使用者名稱 用戶名|來電轉接 呼叫轉移|例項 實例|保羅·海吉斯 保羅·哈吉斯|信號 信號|停用 禁用|偵錯 調試|偵錯程式 調試器|傅立葉 傅里葉|傳送 發送|傷心小棧 紅心大戰|價效比 性價比|優先順序 優先級|儲存 保存|元件 組件|光碟 光盤|光碟機 光驅|克林·伊斯威特 克林特·伊斯特伍德|克羅埃西亞 克羅地亞|克萊門第 克萊門蒂|克里斯多福·諾蘭 克里斯托弗·諾蘭|入口網站 門戶網站|內建 內置|內碼表 代碼頁|全域性 全局|全形 全角|全球資訊網 萬維網|公元紀年 公元紀年|冰棒 冰棍|冷盤 涼菜|凱吉 凱奇|凱文·科斯納 凱文·科斯特納|凱薩琳·畢格羅 凱瑟琳·畢格羅|函式 函數|函數語言程式設計 函數式編程|刀鋒伺服器 刀片服務器|分割槽 分區|分散式 分佈式|分時多工 時分複用|分時多重進接 時分多址|分碼多重進接 碼分多址|分空間多重進接 空分多址|分頻多工 頻分複用|分頻多重進接 頻分多址|列印 打印|列支敦斯登 列支敦士登|列舉 枚舉|利蓋悌 利蓋蒂|前處理器 預處理器|剪下 剪切|剪貼簿 剪貼板|副檔名 擴展名|加彭 加蓬|勞勃·懷斯 羅伯特·懷斯|勞勃·班頓 羅伯特·本頓|勞勃·瑞福 羅伯特·雷德福|包羅定 鮑羅丁|北卡羅萊納 北卡羅來納|北卡羅萊納州 北卡羅來納州|北馬利安納 北馬里亞納|北馬利安納群島 北馬里亞納羣島|匯入 導入|匯出 導出|匯流排 總線|區域性 局部|區域網 局域網|千里達及托巴哥 特立尼達和多巴哥|半形 半角|南卡羅萊納 南卡羅來納|南卡羅萊納州 南卡羅來納州|卡達 卡塔爾|印表機 打印機|即時 實時|厄利垂亞 厄立特里亞|厄瓜多 厄瓜多爾|原始檔 源文件|原始碼 源代碼|原生代碼 本地代碼|參數列 參數表|取樣 採樣|取樣率 採樣率|叢集 集羣|叮叮噹 丁丁當|叮叮噹噹 丁丁當當|叮噹 丁當|台積公司 臺積公司|台積電 臺積電|史他汀類 他汀類|史克里亞賓 斯克里亞賓|史卡拉第 斯卡拉蒂|史托克豪森 施托克豪森|史提夫·麥昆 史蒂夫·麥奎因|史特勞斯 施特勞斯|史特拉汶斯基 斯特拉文斯基|史瓦濟蘭 斯威士蘭|史蒂芬·史匹柏 斯蒂芬·斯皮爾伯格|史麥塔納 斯美塔那|司法程序 司法程序|吉勒摩·戴托羅 吉列爾莫·德爾托羅|吉布地 吉布堤|吉里巴斯 基里巴斯|名字空間 命名空間|名稱空間 命名空間|吐瓦魯 圖瓦盧|向量 矢量|呼叫 調用|命令列 命令行|咖哩 咖喱|哈薩克 哈薩克斯坦|哥斯大黎加 哥斯達黎加|唐氏症 唐氏綜合徵|啟用 激活|喬治·克隆尼 喬治·克魯尼|喬治亞 喬治亞|喬治亞共和國 格魯吉亞共和國|喬治亞州 佐治亞州|單核心 宏內核|回撥 回調|圖示 圖標|土庫曼 土庫曼斯坦|地址 地址|坦尚尼亞 坦桑尼亞|型別 類型|埠 端口|執行 運行|執行檔 可執行文件|執行緒 線程|執行長 首席執行官|堆疊 堆棧|場效電晶體 場效應管|塑膠 塑料|塔吉克 塔吉克斯坦|塞席爾 塞舌爾|塞普勒斯 塞浦路斯|壁紙 壁紙|夏農 香農|外掛 插件|外接 外置|外部索引鍵 外鍵|多囊性卵巢症候群 多囊卵巢綜合徵|多型 多態|多執行緒 多線程|多尼采第 多尼采蒂|多工 多任務|多明尼加 多米尼加|大數據 大數據|大腸激躁症 腸易激綜合徵|天冬胺酸 天冬氨酸|天冬醯胺 天冬酰胺|天門冬胺酸 天門冬氨酸|天門冬醯胺 天門冬酰胺|太空梭 航天飛機|失智症 癡呆症|奈及利亞 尼日利亞|奈米 納米|奧克拉荷馬 俄克拉何馬|奧克拉荷馬城 俄克拉何馬城|奧克拉荷馬州 俄克拉何馬州|奧克拉荷馬市 俄克拉何馬市|奧利佛·史東 奧利弗·斯通|奧勒岡 俄勒岡|奧勒岡州 俄勒岡州|奧福 奧爾夫|好市多 開市客|好市多公司 開市客公司|妥瑞氏症 抽動穢語綜合徵|妥瑞症 抽動穢語綜合徵|威廉·佛雷金 威廉·弗萊德金|威斯康辛 威斯康星|威斯康辛州 威斯康星州|嬌生公司 強生公司|子音 輔音|字串 字符串|字元 字符|字元集 字符集|字型 字體|字型檔 字庫|字尾 後綴|字節跳動 字節跳動|字首 前綴|存取 訪問|存檔 存盤|孟德爾頌 門德爾松|安地卡及巴布達 安提瓜和巴布達|安比西林 氨苄西林|安莫西林 阿莫西林|宏都拉斯 洪都拉斯|宕機 死機|定址 尋址|宣告 聲明|密西根 密歇根|密西根州 密歇根州|實例 實例|實體地址 物理地址|實體記憶體 物理內存|寬頻 寬帶|寮人民民主共和國 老撾人民民主共和國|寮國 老撾|寶僑 寶潔|寶僑公司 寶潔公司|專案 項目|對乙醯胺基酚 對乙酰氨基酚|對映 映射|對話方塊 對話框|對象 對象|尚比亞 贊比亞|尤拉 歐拉|尼日 尼日爾|巢狀 嵌套|工作列 任務欄|工作管理員 任務管理器|巨集 宏|巨集函式 宏函數|巨集呼叫 宏調用|巨集命令 宏命令|巨集定義 宏定義|巨集展開 宏展開|巨集指令 宏指令|巨集替換 宏替換|巨集程式設計 宏編程|巨集處理 宏處理|巨集語言 宏語言|巴布亞紐幾內亞 巴布亞新幾內亞|巴貝多 巴巴多斯|巴金森氏症 帕金森病|市場行銷 市場營銷|布列敦 布雷頓|布列敦森林 布雷頓森林|布列敦森林制度 布雷頓森林體系|布吉納法索 布基納法索|布拉姆斯 勃拉姆斯|布林 布爾|布瑞頓 布里頓|布萊德·彼特 布拉德·皮特|布萊茲 布列茲|帕金森氏症 帕金森病|帛琉 帕勞|平行計算 並行計算|幾內亞比索 幾內亞比紹|序列 串行|序列埠 串口|序號產生器 註冊機|庫欣氏症候群 庫欣綜合徵|康乃狄克 康涅狄格|康乃狄克州 康涅狄格州|建構函式 構造函數|建構子 構造器|建立 創建|引數 參數|彙編 彙編|彩色超音波 彩超|影像 圖像|影印 複印|影片 視頻|彼得·傑克森 彼得·傑克遜|後天免疫缺乏症候群 獲得性免疫缺陷綜合徵|後設資料 元數據|循環 循環|微控制器 單片機|德布西 德彪西|德弗札克 德沃夏克|德拉瓦 特拉華|德拉瓦州 特拉華州|心室顫動 心室顫動|心房撲動 心房撲動|心房顫動 心房顫動|心肌梗塞 心肌梗死|快取 緩存|快取記憶體 高速緩存|快捷半導體 仙童半導體|快閃記憶體 閃存|急性呼吸窘迫症候群 急性呼吸窘迫綜合徵|愛滋病 艾滋病|愛滋病患 艾滋病人|愛滋病毒 艾滋病毒|愛荷華 艾奧瓦|愛荷華州 艾奧瓦州|愛黛兒·羅曼斯基 阿黛爾·羅曼斯基|感測 傳感|慢性疲勞症候群 慢性疲勞綜合徵|憂鬱症 抑鬱症|戒斷症候群 戒斷綜合徵|截圖 截屏|戴奧辛 二噁英|戴流士 戴留斯|打開 打開|批次 批量|技術長 首席技術官|拉摩 拉莫|拉羅 拉洛|拉赫曼尼諾夫 拉赫瑪尼諾夫|指令式程式設計 命令式編程|指令碼 腳本|指標 指針|捲軸 滾動條|掃描器 掃描儀|排程 調度|控制代碼 句柄|控制元件 控件|提佩特 蒂佩特|搜尋 搜索|摩爾線程 摩爾線程|摺積 捲積|撥出 呼出|擴充套件 擴展|擴音 免提|擷取 截取|攜帶型 便攜式|攝護腺 前列腺|支持者 支持者|支援 支持|效能 性能|整合 集成|數位 數字|數位人文 數字人文|數位印刷 數字印刷|數位電子 數字電子|數位電路 數字電路|數字 數字|數據 數據|數據機 調製解調器|文件 文檔|文書處理 文字處理|斯洛維尼亞 斯洛文尼亞|新增 添加|新罕布夏 新罕布什爾|新罕布夏州 新罕布什爾州|方程式 方程式|映象 鏡像|映象管 顯像管|時脈頻率 時鐘頻率|普羅高菲夫 普羅科菲耶夫|普賽爾 珀塞爾|晶片 芯片|智慧 智能|智慧財產權 知識產權|暫存器 寄存器|最佳化 優化|有失真壓縮 有損壓縮|朗·霍華 朗·霍華德|林姆斯基-高沙可夫 里姆斯基-科薩科夫|查德 乍得|查詢 查找|柯恩兄弟 科恩兄弟|柯普蘭 科普蘭|柯雷利 科雷利|核取按鈕 複選按鈕|核取方塊 複選框|核心 內核|格瑞那達 格林納達|桌上型 桌面型|桌上型電腦 臺式機|桌布 壁紙|梅湘 梅西安|梅爾·吉勃遜 梅爾·吉布森|楊納傑克 雅納切克|榴槤 榴蓮|標頭檔案 頭文件|模擬 模擬|模組 模塊|模里西斯 毛里求斯|機率 概率|檔名 文件名|檔案 文件|檢視 查看|欄位 字段|歐巴馬 奧巴馬|正子 正電子|正子斷層造影 正電子發射計算機斷層|正當程序 正當程序|正規化 範式|正規表示式 正則表達式|母音 元音|比特幣 比特幣|氣泡排序 冒泡排序|永珍 萬象|永續性 持久性|汶萊 文萊|沙烏地阿拉伯 沙特阿拉伯|沙烏地阿美 沙特阿美|沙烏地阿美公司 沙特阿美公司|法蘭西絲·麥朵曼 弗朗西絲·麥克多曼德|泡麵 方便麪|波克夏海瑟威 伯克希爾哈撒韋|波克夏海瑟威公司 伯克希爾哈撒韋公司|波凱里尼 博凱里尼|波士尼亞赫塞哥維納 波斯尼亞黑塞哥維那|波札那 博茨瓦納|波長分波多工 波分複用|海內存知己 海內存知己|海飛茲 海菲茨|消息 消息|游標 光標|溢位 溢出|滑鼠 鼠標|演算法 算法|漢他病毒 漢坦病毒|潘德列茲基 潘德列茨基|烏茲別克 烏茲別克斯坦|無失真壓縮 無損壓縮|燒錄 刻錄|營運長 首席運營官|片語 詞組|物件 對象|物件導向 面向對象|狀態列 狀態欄|獅子山 塞拉利昂|珍·康萍 簡·坎皮恩|班·艾佛列克 本·阿弗萊克|瓜地馬拉 危地馬拉|甘比亞 岡比亞|甘胺酸 甘氨酸|甲硫胺酸 甲硫氨酸|畫素 像素|異亮胺酸 異亮氨酸|異白胺酸 異亮氨酸|登入 登錄|登出 註銷|登錄檔 註冊表|白胺酸 亮氨酸|白血球 白細胞|白遼士 柏遼茲|盧安達 盧旺達|目的碼 目標代碼|直譯器 解釋器|相容 兼容|相簿 相冊|真實模式 實模式|睡眠呼吸中止症 睡眠呼吸暫停綜合徵|矽 硅|砈 砹|破圖 花屏|硬碟 硬盤|硬體 硬件|碟片 盤片|磁碟 磁盤|磁碟機代號 盤符|磁軌 磁道|社區 社區|社群 社區|福斯汽車 大衆汽車|福斯汽車集團 大衆汽車集團|福斯集團 大衆集團|程序 進程|程序不正義 程序不正義|程序導向 面向過程|程序式程式設計 過程式編程|程序正義 程序正義|程式 程序|程式碼 代碼|程式設計 編程|程式設計師 程序員|程式語言 編程語言|稽核 審覈|穀氨醯胺 穀氨酰胺|穀胺酸 穀氨酸|穆索斯基 穆索爾斯基|積體電路 集成電路|空氣清淨機 空氣淨化器|空間多工 空分複用|突尼西亞 突尼斯|筆記型電腦 筆記本電腦|範式 範式|簡報 演示文稿|簡訊 短信|簽帳金融卡 借記卡|米歇爾·哈札納維西斯 米歇爾·阿扎納維西於斯|粘貼 粘貼|精胺酸 精氨酸|約瑟夫·孟威茲 約瑟夫·曼凱維奇|紅血球 紅細胞|納米比亞 納米比亞|紐澤西 新澤西|紐澤西州 新澤西州|紐西蘭 新西蘭|索羅門群島 所羅門羣島|索馬利亞 索馬里|終端使用者 最終用戶|組合語言 彙編語言|組胺酸 組氨酸|組譯 彙編|組譯器 彙編器|結束通話 掛斷|絲胺酸 絲氨酸|綁架丁丁當 綁架丁丁當|經前症候群 經前期綜合徵|維吉尼亞 弗吉尼亞|維吉尼亞州 弗吉尼亞州|維德角 佛得角|網咖 網吧|網絡卡 網卡|網路 網絡|網路上的芳鄰 網上鄰居|網際網路 互聯網|線上 在線|縮圖 縮略圖|縮排 縮進|繫結 綁定|纈胺酸 纈氨酸|羅勃·辛密克斯 羅伯特·澤米吉斯|羅德島 羅得島|羅德島州 羅得島州|美屬維京群島 美屬維爾京羣島|義大利 意大利|老年失智症 老年癡呆症|聖克里斯多福及尼維斯 聖基茨和尼維斯|聖文森及格瑞那丁 聖文森特和格林納丁斯|聖露西亞 聖盧西亞|聖馬利諾 聖馬力諾|聯結器 連接器|聯絡 聯繫|肯亞 肯尼亞|胰臟 胰腺|胱胺酸 胱氨酸|胺基酸 氨基酸|脯胺酸 脯氨酸|腎病症候群 腎病綜合徵|腕隧道症候群 腕管綜合徵|腦梗塞 腦梗死|腳踏車 自行車|自動旋轉螢幕 自動轉屏|自閉症 孤獨症|興德密特 欣德米特|色胺酸 色氨酸|艾克森美孚 埃克森美孚|艾爾加 埃爾加|艾瑪·湯瑪斯 艾瑪·托馬斯|苯丙胺酸 苯丙氨酸|茅利塔尼亞 毛里塔尼亞|荀白克 勳伯格|莫三比克 莫桑比克|莫札特 莫扎特|菜單 菜單|華倫·比提 沃倫·比蒂|華格納 瓦格納|華爾頓 沃爾頓|萊許 賴希|萊雅 歐萊雅|萊雅集團 歐萊雅集團|萬用字元 通配符|萬那杜 瓦努阿圖|葉門 也門|葛令卡 格林卡|葛利格 格里格|葛拉斯 格拉斯|葛摩 科摩羅|蒲隆地 布隆迪|蓋亞那 圭亞那|蓋希文 格什溫|蕭士塔高維契 肖斯塔科維奇|蕭邦 肖邦|薛尼·波拉克 西德尼·波拉克|薩拉沙泰 薩拉薩蒂|薩提 薩蒂|藍色畫面 藍屏|蘇利南 蘇里南|蘇胺酸 蘇氨酸|處理程序 處理程序|虛擬函式 虛函數|虛擬機器 虛擬機|虛擬碼 僞代碼|螢幕 屏幕|血紅素 血紅蛋白|行內函數 內聯函數|行動式 便攜式|行動數據 移動數據|行動硬碟 移動硬盤|行動網路 移動網絡|行動通訊 移動通信|行動電話 移動電話|行程 進程|衣索比亞 埃塞俄比亞|表示式 表達式|裝置 設備|複製 拷貝|西元 公元|西恩·貝克 肖恩·貝克|西維吉尼亞 西弗吉尼亞|西維吉尼亞州 西弗吉尼亞州|西貝流士 西貝柳斯|視窗 窗口|視覺化 可視化|視訊 視頻|視訊會議 視頻會議|視訊記憶體 顯存|視訊通話 視頻通話|解析度 分辨率|解構函式 析構函數|解構子 析構函數|解除安裝 卸載|觸控 觸摸|觸控式螢幕 觸摸屏|計程車 出租車|訊息 消息|訊號 信號|訊雜比 信噪比|記憶體 內存|記憶體模組 內存條|訪問 訪問|設定 設置|許可權 權限|訴訟程序 訴訟程序|詹姆斯·卡麥隆 詹姆斯·卡梅隆|調色盤 調色盤|調變 調製|諾蘭 諾蘭|諾魯 瑙魯|識別符號 標識符|變數 變量|象牙海岸 科特迪瓦|貝南 貝寧|貝里尼 貝利尼|貝里斯 伯利茲|貼上 粘貼|資料 數據|資料來源 數據源|資料倉儲 數據倉庫|資料包 數據報|資料夾 文件夾|資料庫 數據庫|資料探勘 數據挖掘|資訊 信息|資訊安全 信息安全|資訊理論 信息論|資訊科技 信息技術|資訊長 首席信息官|賓士 奔馳|賴比瑞亞 利比里亞|賴索托 萊索托|超程式設計 元編程|超音波 超聲波|跳脫字元 轉義字符|軟碟機 軟驅|軟體 軟件|軟體動物 軟體動物|載入 加載|載入程式 引導程序|輝達 英偉達|辛巴威 津巴布韋|迦納 加納|迴圈 循環|通訊 通信|通話卡 通訊卡|通話記錄 聯繫歷史|通道 通道|速食麵 方便麪|連結 鏈接|連結串列 鏈表|連線 連接|進位制 進制|進程 進程|進階 高級|進階設定 高級設置|進階選項 高級選項|運算元 操作數|運算子 操作符|運算式 表達式|過動症 多動症|過載 重載|遞迴 遞歸|遠端 遠程|遮蔽 屏蔽|選單 菜單|邏輯閘 邏輯門|那杜 溫納圖萬|部落格 博客|都會網路 城域網|酪胺酸 酪氨酸|醯 酰|釋出 發佈|重新命名 重命名|重新整理 刷新|重灌 重裝|金氧半導體 金屬氧化物半導體|金鑰 密鑰|鈽 鈈|鉲 鐦|鉳 錇|鋂 鎇|錄影 錄像|錼 鎿|鍅 鈁|鎝 鍀|鎦 鑥|鑀 鎄|開啟 打開|閘流體 晶閘管|閘道器 網關|閘電路 門電路|關聯式資料庫 關係數據庫|防寫 寫保護|防毒 殺毒|阻斷劑 阻滯劑|阿利安卓·崗札雷·伊納利圖 亞歷杭德羅·岡薩雷斯·伊納裏圖|阿拉伯聯合大公國 阿拉伯聯合酋長國|阿斯匹靈 阿司匹林|阿斯特捷利康 阿斯利康|阿斯特捷利康公司 阿斯利康公司|阿茲海默氏症 阿爾茨海默氏症|阿茲海默症 阿爾茨海默症|阿莫西林 阿莫西林|陣列 數組|除錯 調試|隨身碟 U盤|雜湊 哈希|離線 脫機|離胺酸 賴氨酸|雲端儲存 雲存儲|雲端計算 雲計算|雷射 激光|雷諾氏症候群 雷諾綜合徵|電晶體 晶體管|電腦保安 計算機安全|電腦斷層 計算機斷層|電腦科學 計算機科學|霍洛維茲 霍洛維茨|非同步 異步|韋本 韋伯恩|韋瓦第 維瓦爾第|韌體 固件|韓德爾 亨德爾|音效卡 聲卡|音訊 音頻|頁尾 頁腳|頁首 頁眉|預設 預設|預設值 默認值|頻寬 帶寬|類别範本 類模板|類比 模擬|類比電子 模擬電子|類比電路 模擬電路|顧爾德 古爾德|顯示卡 顯卡|飛航模式 飛行模式|馬丁·史柯西斯 馬丁·斯科塞斯|馬凡氏症 馬方綜合徵|馬凡氏症候群 馬方綜合徵|馬利共和國 馬里共和國|馬爾地夫 馬爾代夫|駭客 黑客|高效能運算 高性能計算|高畫質 高清|高空彈跳 蹦極|高級 高級|高階 高級|麥克·尼可斯 邁克·尼科爾斯|麥克·道格拉斯 邁克爾·道格拉斯|麩胺酸 穀氨酸|麩醯胺酸 穀氨酰胺|麻薩諸塞 馬薩諸塞|麻薩諸塞州 馬薩諸塞州|黃體素 孕酮|點選 點擊|點陣圖 位圖",v="一坏 一坯|一目瞭然 一目了然|七逕 七迳|上逕 上迳|上鍊 上链|不可貲計 不可赀計|不瞭解 不了解|么麼 幺麽|么麽 幺麽|九逕山 九迳山|乾乾淨淨 干干净净|乾乾脆脆 干干脆脆|乾佑縣 乾佑县|乾元 乾元|乾卦 乾卦|乾嘉 乾嘉|乾圖 乾图|乾坤 乾坤|乾坤一擲 乾坤一掷|乾坤再造 乾坤再造|乾坤大挪移 乾坤大挪移|乾宅 乾宅|乾安縣 乾安县|乾安鎮 乾安镇|乾州 乾州|乾斷 乾断|乾斷食 干断食|乾旦 乾旦|乾曜 乾曜|乾清宮 乾清宫|乾盛世 乾盛世|乾紅 干红|乾綱 乾纲|乾縣 乾县|乾象 乾象|乾造 乾造|乾道 乾道|乾闥婆 乾闼婆|乾陵 乾陵|乾隆 乾隆|乾隆年間 乾隆年间|乾隆皇帝 乾隆皇帝|二噁英 二𫫇英|仇讎 仇雠|以免藉口 以免借口|以功覆過 以功覆过|任筆沈詩 任笔沈诗|侔德覆載 侔德覆载|傢俱 家具|傷亡枕藉 伤亡枕藉|允祕 允祕|八濛山 八濛山|其陰多蒐 其阴多蒐|凌藉 凌借|出醜狼藉 出丑狼藉|函覆 函复|剋架 剋架|剋毒 剋毒|千鍾粟 千锺粟|南氾 南氾|南逕 南迳|反反覆覆 反反复复|反覆 反复|反覆思維 反复思维|反覆思量 反复思量|反覆性 反复性|名覆金甌 名复金瓯|吳祕 吴祕|吳育昇 吴育昇|哪吒 哪吒|回覆 回复|土坏 土坯|坏土 坯土|坏子 坯子|坏布 坯布|坏戶 坯户|墨沈沈 墨沉沉|壺裏乾坤 壶里乾坤|大目乾連冥間救母變文 大目乾连冥间救母变文|宫商角徵羽 宫商角徵羽|射覆 射覆|尼乾子 尼乾子|尼乾陀 尼乾陀|年釐 年釐|幺麼 幺麽|幺麼小丑 幺麽小丑|幺麼小醜 幺麽小丑|康乾 康乾|張昇 张昇|張法乾 张法乾|彷彿 仿佛|彷徨 彷徨|徐胤昇 徐胤昇|復甦 复苏|徵弦 徵弦|徵絃 徵弦|徵羽摩柯 徵羽摩柯|徵聲 徵声|徵調 徵调|徵音 徵音|情有獨鍾 情有独钟|想像 想像|意志消沈 意志消沉|慰藉 慰藉|慰藉着 慰藉着|憑藉 凭借|憑藉着 凭借着|懷釐 怀釐|成甦 成甦|所費不貲 所费不赀|手鍊 手链|打坏 打坯|扞格 扞格|扭轉乾坤 扭转乾坤|批覆 批复|找藉口 找借口|折戟沈沙 折戟沉沙|折戟沈河 折戟沉河|拉坏 拉坯|拉鍊 拉链|拉鍊工程 拉链工程|拜覆 拜复|挨剋 挨剋|捏坏 捏坯|擊沈 击沉|據瞭解 据了解|文錦覆阱 文锦覆阱|於世成 於世成|於乎 於乎|於仲完 於仲完|於倫 於伦|於其一 於其一|於則 於则|於勇明 於勇明|於呼哀哉 於呼哀哉|於單 於单|於坦 於坦|於崇文 於崇文|於忠祥 於忠祥|於惟一 於惟一|於戲 於戏|於敖 於敖|於梨華 於梨华|於清言 於清言|於潛 於潜|於琳 於琳|於穆 於穆|於竹屋 於竹屋|於菟 於菟|於邑 於邑|於陵子 於陵子|旋乾轉坤 旋乾转坤|旋轉乾坤 旋转乾坤|旋轉乾坤之力 旋转乾坤之力|明瞭 明了|明覆 明复|昏沈 昏沉|春蒐 春蒐|春釐 春釐|暗沈沈 暗沉沉|書中自有千鍾粟 书中自有千锺粟|有序 有序|朝乾夕惕 朝乾夕惕|木吒 木吒|李乾德 李乾德|李昇 李昇|李昇勳 李昇勋|李澤鉅 李泽钜|李祕 李祕|李鍊福 李链福|李鍾郁 李锺郁|束脩 束脩|東氾 东氾|林甦 林甦|校讎 校雠|梁昇卿 梁昇卿|梁章鉅 梁章钜|楊甦棣 杨甦棣|楊聯陞 杨联陞|樊於期 樊於期|橡椀 橡椀|死氣沈沈 死气沉沉|段脩 段脩|毛坏 毛坯|水逕 水迳|氾勝之 氾胜之|氾南 氾南|氾國 氾国|氾水 氾水|沈下 沉下|沈不住氣 沉不住气|沈住氣 沉住气|沈冤 沉冤|沈厚 沉厚|沈吟 沉吟|沈寂 沉寂|沈得住氣 沉得住气|沈思 沉思|沈思往事 沉思往事|沈悶 沉闷|沈沒 沉没|沈沒成本 沉没成本|沈浮 沉浮|沈浸 沉浸|沈浸於 沉浸于|沈淪 沉沦|沈湎 沉湎|沈湎酒色 沉湎酒色|沈溺 沉溺|沈滯 沉滞|沈滯性 沉滞性|沈澱 沉淀|沈澱出來 沉淀出来|沈澱劑 沉淀剂|沈澱法 沉淀法|沈澱物 沉淀物|沈濁 沉浊|沈甸甸 沉甸甸|沈痛 沉痛|沈痼 沉痼|沈痾 沉疴|沈睡 沉睡|沈睡不醒 沉睡不醒|沈砂池 沉砂池|沈積 沉积|沈積岩 沉积岩|沈積石 沉积石|沈筒 沉筒|沈船 沉船|沈落 沉落|沈詩任筆 沈诗任笔|沈迷 沉迷|沈迷不醒 沉迷不醒|沈醉 沉醉|沈重 沉重|沈降 沉降|沈陷 沉陷|沈靜 沉静|沈靜下來 沉静下来|沈香 沉香|沈鬱 沉郁|沈魚落雁 沉鱼落雁|沈默 沉默|沈默不語 沉默不语|沈默寡言 沉默寡言|沙逕 沙迳|河逕 河迳|流徵 流徵|浪蕩乾坤 浪荡乾坤|浮沈 浮沉|海哩 海里|深沈 深沉|深沈不露 深沉不露|溫昇豪 温昇豪|滑藉 滑借|烏昇 乌昇|烏沈沈 乌沉沉|烏逕 乌迳|無序 无序|狐藉虎威 狐借虎威|王彥昇 王彦昇|珍珠項鍊 珍珠项链|甚鉅 甚钜|甦生 苏生|甦醒 苏醒|申昇勳 申昇勋|申覆 申复|畢昇 毕昇|發覆 发覆|盧象昇 卢象昇|目劄 目劄|瞭哨 瞭哨|瞭如 了如|瞭如指掌 了如指掌|瞭望 瞭望|瞭然 了然|瞭然於心 了然于心|瞭若指掌 了若指掌|瞭解 了解|瞭解到 了解到|破釜沈舟 破釜沉舟|磚坏 砖坯|示覆 示复|社逕 社迳|祕丕笈 祕丕笈|祕彭祖 祕彭祖|祕瓊 祕琼|祝釐 祝釐|神祇 神祇|稟覆 禀复|竺乾 竺乾|答覆 答复|篤麼 笃麽|簡單明瞭 简单明了|籌畫 筹划|素藉 素借|老態龍鍾 老态龙钟|耳沈 耳沉|肉脩 肉脩|肘手鍊足 肘手链足|胤祕 胤祕|脩敬 脩敬|脩炳 脩炳|脩脡 脩脡|脩脯 脩脯|脩金 脩金|脫坏 脱坯|腶脩 腶脩|英哩 英里|茅蒐 茅蒐|茵藉 茵借|萬鍾 万锺|落雁沈魚 落雁沉鱼|蒐于紅 蒐于红|蒐於紅 蒐于红|蒐狩 蒐狩|蒐獮 蒐狝|蒐獵 蒐猎|蒐田 蒐田|蒐畋 蒐畋|蒐苗 蒐苗|蒜薹 蒜薹|蔣昇 蒋昇|蕓薹 芸薹|蕩覆 荡覆|蕭乾 萧乾|藉代 借代|藉以 借以|藉助 借助|藉助於 借助于|藉卉 借卉|藉口 借口|藉喻 借喻|藉寇兵 借寇兵|藉寇兵齎盜糧 借寇兵赍盗粮|藉手 借手|藉據 借据|藉故 借故|藉故推辭 借故推辞|藉方 借方|藉條 借条|藉槁 借槁|藉機 借机|藉此 借此|藉此機會 借此机会|藉甚 借甚|藉由 借由|藉着 借着|藉端 借端|藉端生事 借端生事|藉箸代籌 借箸代筹|藉草枕塊 借草枕块|藉藉 藉藉|藉藉无名 藉藉无名|藉詞 借词|藉讀 借读|藉資 借资|衹得 只得|衹見樹木 只见树木|衹見樹木不見森林 只见树木不见森林|袁祕 袁祕|袖裏乾坤 袖里乾坤|袷袢 袷袢|製坏 制坯|覆上 覆上|覆住 覆住|覆信 复信|覆冒 覆冒|覆呈 复呈|覆命 复命|覆墓 复墓|覆宗 覆宗|覆帳 复帐|覆幬 覆帱|覆成 覆成|覆按 复按|覆文 复文|覆杯 覆杯|覆校 复校|覆瓿 覆瓿|覆盂 覆盂|覆盆 覆盆|覆盆子 覆盆子|覆盤 覆盘|覆育 覆育|覆蕉尋鹿 覆蕉寻鹿|覆逆 覆逆|覆醢 覆醢|覆醬瓿 覆酱瓿|覆電 复电|覆露 覆露|覆鹿尋蕉 覆鹿寻蕉|覆鹿遺蕉 覆鹿遗蕉|覆鼎 覆鼎|見覆 见复|角徵 角徵|角徵羽 角徵羽|計畫 计划|許甦魂 许甦魂|變徵 变徵|變徵之聲 变徵之声|變徵之音 变徵之音|讎定 雠定|谿工 谿工|貂覆額 貂覆额|買臣覆水 买臣覆水|赤石逕 赤石迳|踅門瞭戶 踅门了户|躪藉 躏借|載沈載浮 载沉载浮|載浮載沈 载浮载沉|辛祕 辛祕|逆釐 逆釐|逕口 迳口|逕聯 迳联|逕頭 迳头|郭子乾 郭子乾|酒逢知己千鍾少 酒逢知己千锺少|醞藉 酝借|重覆 重复|金吒 金吒|金昇玟 金昇玟|金鍊 金链|鈞覆 钧复|鉅子 钜子|鉅萬 钜万|鉅防 钜防|鉸鍊 铰链|銀鍊 银链|鋼坏 钢坯|錢鍾書 钱锺书|鍊墜 链坠|鍊子 链子|鍊形 链形|鍊條 链条|鍊錘 链锤|鍊鎖 链锁|鍛鍾 锻锺|鍾繇 锺繇|鍾萬梅 锺万梅|鍾重發 锺重发|鍾鍛 锺锻|鍾馗 锺馗|鎖鍊 锁链|鐵鍊 铁链|鑽石項鍊 钻石项链|鑿坏 凿坯|閻鶴昇 阎鹤昇|陰沈 阴沉|陰沈沈 阴沉沉|陰陰沈沈 阴阴沉沉|陳志昇 陈志昇|陳昇 陈昇|陳甦 陈甦|陶坏 陶坯|雁杳魚沈 雁杳鱼沉|雖覆能復 虽覆能复|電覆 电复|露覆 露覆|韓昇延 韩昇延|韓甦 韩甦|項鍊 项链|頗覆 颇覆|頸鍊 颈链|顛乾倒坤 颠乾倒坤|顛倒乾坤 颠倒乾坤|顧藉 顾借|馮甦 冯甦|魏徵 魏徵|魚沈雁杳 鱼沉雁杳|麪坏兒 面坯儿|麼些族 麽些族|黃甦 黄甦|黃鍾公 黄锺公|黑沈沈 黑沉沉|龍鍾 龙钟|龔昇 龚昇",m="㑯 㑔|㑳 㑇|㑶 㐹|㓨 刾|㗲 𠵾|㘚 㘎|㜄 㚯|㜏 㛣|㜢 𡞱|㠏 㟆|㠣 𫵷|㥮 㤘|㩜 㨫|㩳 㧐|㩵 擜|㺏 𤠋|䁪 𥇢|䁻 䀥|䃮 鿎|䊷 䌶|䋙 䌺|䋚 䌻|䋹 䌿|䋻 䌾|䍦 䍠|䎱 䎬|䓣 𬜯|䙡 䙌|䜀 䜧|䝼 䞍|䡵 𫟦|䥇 䦂|䥑 鿏|䥕 𬭯|䥱 䥾|䦛 䦶|䦟 䦷|䧢 𨸟|䮄 𫠊|䯀 䯅|䰾 鲃|䱷 䲣|䱽 䲝|䲁 鳚|䲘 鳤|䴉 鹮|丟 丢|並 并|乾 干|亂 乱|亙 亘|亞 亚|佇 伫|佈 布|佔 占|併 并|來 来|侖 仑|侶 侣|侷 局|俁 俣|係 系|俔 伣|俠 侠|俥 伡|俬 私|倀 伥|倆 俩|倈 俫|倉 仓|個 个|們 们|倖 幸|倫 伦|倲 㑈|偉 伟|偑 㐽|側 侧|偵 侦|偽 伪|傌 㐷|傑 杰|傖 伧|傘 伞|備 备|傢 家|傭 佣|傯 偬|傳 传|傴 伛|債 债|傷 伤|傾 倾|僂 偻|僅 仅|僉 佥|僑 侨|僕 仆|僞 伪|僤 𫢸|僥 侥|僨 偾|僱 雇|價 价|儀 仪|儁 俊|儂 侬|億 亿|儈 侩|儉 俭|儎 傤|儐 傧|儔 俦|儕 侪|儘 尽|償 偿|優 优|儲 储|儷 俪|儸 㑩|儺 傩|儻 傥|儼 俨|兇 凶|兌 兑|兒 儿|兗 兖|內 内|兩 两|冊 册|冑 胄|冪 幂|凈 净|凍 冻|凜 凛|凱 凯|別 别|刪 删|剄 刭|則 则|剋 克|剎 刹|剗 刬|剛 刚|剝 剥|剮 剐|剴 剀|創 创|剷 铲|劃 划|劄 札|劇 剧|劉 刘|劊 刽|劌 刿|劍 剑|劏 㓥|劑 剂|劚 㔉|勁 劲|動 动|務 务|勛 勋|勝 胜|勞 劳|勢 势|勣 𪟝|勩 勚|勱 劢|勳 勋|勵 励|勸 劝|勻 匀|匭 匦|匯 汇|匱 匮|區 区|協 协|卹 恤|卻 却|卽 即|厙 厍|厠 厕|厤 历|厭 厌|厲 厉|厴 厣|參 参|叄 叁|叢 丛|吒 咤|吳 吴|吶 呐|呂 吕|咼 呙|員 员|唄 呗|唸 念|問 问|啓 启|啞 哑|啟 启|啢 唡|喎 㖞|喚 唤|喪 丧|喫 吃|喬 乔|單 单|喲 哟|嗆 呛|嗇 啬|嗊 唝|嗎 吗|嗚 呜|嗩 唢|嗰 𠮶|嗶 哔|嘆 叹|嘍 喽|嘓 啯|嘔 呕|嘖 啧|嘗 尝|嘜 唛|嘩 哗|嘮 唠|嘯 啸|嘰 叽|嘵 哓|嘸 呒|嘽 啴|噁 恶|噓 嘘|噚 㖊|噝 咝|噠 哒|噥 哝|噦 哕|噯 嗳|噲 哙|噴 喷|噸 吨|噹 当|嚀 咛|嚇 吓|嚌 哜|嚐 尝|嚕 噜|嚙 啮|嚥 咽|嚦 呖|嚧 𠰷|嚨 咙|嚮 向|嚲 亸|嚳 喾|嚴 严|嚶 嘤|囀 啭|囁 嗫|囂 嚣|囅 冁|囈 呓|囉 啰|囌 苏|囑 嘱|囪 囱|圇 囵|國 国|圍 围|園 园|圓 圆|圖 图|團 团|垻 坝|埡 垭|埨 𫭢|埰 采|執 执|堅 坚|堊 垩|堖 垴|堝 埚|堯 尧|報 报|場 场|塊 块|塋 茔|塏 垲|塒 埘|塗 涂|塚 冢|塢 坞|塤 埙|塵 尘|塸 𫭟|塹 堑|塿 𪣻|墊 垫|墜 坠|墠 𫮃|墮 堕|墰 坛|墳 坟|墶 垯|墻 墙|墾 垦|壇 坛|壋 垱|壎 埙|壓 压|壗 𡋤|壘 垒|壙 圹|壚 垆|壜 坛|壞 坏|壟 垄|壠 垅|壢 坜|壩 坝|壪 塆|壯 壮|壺 壶|壼 壸|壽 寿|夠 够|夢 梦|夥 伙|夾 夹|奐 奂|奧 奥|奩 奁|奪 夺|奬 奖|奮 奋|奼 姹|妝 妆|姍 姗|姦 奸|娙 𫰛|娛 娱|婁 娄|婦 妇|婭 娅|媧 娲|媯 妫|媰 㛀|媼 媪|媽 妈|嫋 袅|嫗 妪|嫵 妩|嫺 娴|嫻 娴|嫿 婳|嬀 妫|嬃 媭|嬈 娆|嬋 婵|嬌 娇|嬙 嫱|嬡 嫒|嬤 嬷|嬪 嫔|嬰 婴|嬸 婶|孃 娘|孋 㛤|孌 娈|孫 孙|學 学|孻 𡥧|孿 孪|宮 宫|寀 采|寢 寝|實 实|寧 宁|審 审|寫 写|寬 宽|寵 宠|寶 宝|將 将|專 专|尋 寻|對 对|導 导|尷 尴|屆 届|屍 尸|屓 屃|屜 屉|屢 屡|層 层|屨 屦|屬 属|岡 冈|峯 峰|峴 岘|島 岛|峽 峡|崍 崃|崑 昆|崗 岗|崙 仑|崢 峥|崬 岽|嵐 岚|嵗 岁|嵽 𫶇|嵾 㟥|嶁 嵝|嶄 崭|嶇 岖|嶔 嵚|嶗 崂|嶠 峤|嶢 峣|嶧 峄|嶨 峃|嶮 崄|嶸 嵘|嶺 岭|嶼 屿|嶽 岳|巋 岿|巒 峦|巔 巅|巖 岩|巘 𪩘|巰 巯|巹 卺|帥 帅|師 师|帳 帐|帶 带|幀 帧|幃 帏|幓 㡎|幗 帼|幘 帻|幟 帜|幣 币|幫 帮|幬 帱|幷 并|幹 干|幾 几|庫 库|廁 厕|廂 厢|廄 厩|廈 厦|廎 庼|廕 荫|廚 厨|廝 厮|廞 𫷷|廟 庙|廠 厂|廡 庑|廢 废|廣 广|廩 廪|廬 庐|廳 厅|弒 弑|弔 吊|弳 弪|張 张|強 强|彄 𫸩|彆 别|彈 弹|彌 弥|彎 弯|彔 录|彙 汇|彠 彟|彥 彦|彫 雕|彲 彨|彿 佛|後 后|徑 径|從 从|徠 徕|復 复|徵 征|徹 彻|恆 恒|恥 耻|悅 悦|悞 悮|悵 怅|悶 闷|悽 凄|惡 恶|惱 恼|惲 恽|惻 恻|愛 爱|愜 惬|愨 悫|愴 怆|愷 恺|愾 忾|慄 栗|態 态|慍 愠|慘 惨|慚 惭|慟 恸|慣 惯|慤 悫|慪 怄|慫 怂|慮 虑|慳 悭|慶 庆|慺 㥪|慼 戚|慾 欲|憂 忧|憊 惫|憐 怜|憑 凭|憒 愦|憖 慭|憚 惮|憤 愤|憫 悯|憮 怃|憲 宪|憶 忆|懇 恳|應 应|懌 怿|懍 懔|懞 蒙|懟 怼|懣 懑|懤 㤽|懨 恹|懲 惩|懶 懒|懷 怀|懸 悬|懺 忏|懼 惧|懾 慑|戀 恋|戇 戆|戔 戋|戧 戗|戩 戬|戰 战|戱 戯|戲 戏|戶 户|扞 捍|拋 抛|拚 拼|挩 捝|挱 挲|挾 挟|捨 舍|捫 扪|捱 挨|捲 卷|掃 扫|掄 抡|掆 㧏|掗 挜|掙 挣|掛 挂|採 采|揀 拣|揚 扬|換 换|揮 挥|揯 搄|損 损|搖 摇|搗 捣|搧 扇|搵 揾|搶 抢|摑 掴|摜 掼|摟 搂|摯 挚|摳 抠|摶 抟|摺 折|摻 掺|撈 捞|撏 挦|撐 撑|撓 挠|撝 㧑|撟 挢|撣 掸|撥 拨|撫 抚|撲 扑|撳 揿|撻 挞|撾 挝|撿 捡|擁 拥|擄 掳|擇 择|擊 击|擋 挡|擓 㧟|擔 担|據 据|擠 挤|擡 抬|擣 捣|擬 拟|擯 摈|擰 拧|擱 搁|擲 掷|擴 扩|擷 撷|擺 摆|擻 擞|擼 撸|擽 㧰|擾 扰|攄 摅|攆 撵|攏 拢|攔 拦|攖 撄|攙 搀|攛 撺|攜 携|攝 摄|攢 攒|攣 挛|攤 摊|攪 搅|攬 揽|敎 教|敓 敚|敗 败|敘 叙|敵 敌|數 数|斂 敛|斃 毙|斆 敩|斕 斓|斬 斩|斷 断|於 于|旂 旗|旣 既|昇 升|時 时|晉 晋|晛 𬀪|晝 昼|暈 晕|暉 晖|暐 𬀩|暘 旸|暢 畅|暫 暂|曄 晔|曆 历|曇 昙|曉 晓|曏 向|曖 暧|曠 旷|曥 𣆐|曨 昽|曬 晒|書 书|會 会|朥 𦛨|朧 胧|朮 术|東 东|枴 拐|柵 栅|柺 拐|査 查|桱 𣐕|桿 杆|梔 栀|梘 枧|梜 𬂩|條 条|梟 枭|梲 棁|棄 弃|棊 棋|棖 枨|棗 枣|棟 栋|棡 㭎|棧 栈|棲 栖|棶 梾|椏 桠|椲 㭏|楊 杨|楓 枫|楨 桢|業 业|極 极|榘 矩|榦 干|榪 杩|榮 荣|榲 榅|榿 桤|構 构|槍 枪|槓 杠|槤 梿|槧 椠|槨 椁|槮 椮|槳 桨|槶 椢|槼 椝|樁 桩|樂 乐|樅 枞|樑 梁|樓 楼|標 标|樞 枢|樢 㭤|樣 样|樧 榝|樫 㭴|樳 桪|樸 朴|樹 树|樺 桦|樿 椫|橈 桡|橋 桥|機 机|橢 椭|橫 横|橯 𣓿|檁 檩|檉 柽|檔 档|檜 桧|檟 槚|檢 检|檣 樯|檮 梼|檯 台|檳 槟|檸 柠|檻 槛|櫃 柜|櫍 𬃊|櫓 橹|櫚 榈|櫛 栉|櫝 椟|櫞 橼|櫟 栎|櫥 橱|櫧 槠|櫨 栌|櫪 枥|櫫 橥|櫬 榇|櫱 蘖|櫳 栊|櫸 榉|櫻 樱|欄 栏|欅 榉|權 权|欏 椤|欒 栾|欓 𣗋|欖 榄|欞 棂|欽 钦|歎 叹|歐 欧|歟 欤|歡 欢|歲 岁|歷 历|歸 归|歿 殁|殘 残|殞 殒|殤 殇|殨 㱮|殫 殚|殭 僵|殮 殓|殯 殡|殰 㱩|殲 歼|殺 杀|殻 壳|殼 壳|毀 毁|毆 殴|毿 毵|氂 牦|氈 毡|氌 氇|氣 气|氫 氢|氬 氩|氳 氲|氾 泛|汎 泛|汙 污|決 决|沒 没|沖 冲|況 况|泝 溯|洩 泄|洶 汹|浹 浃|浿 𬇙|涇 泾|涗 涚|涼 凉|淒 凄|淚 泪|淥 渌|淨 净|淩 凌|淪 沦|淵 渊|淶 涞|淺 浅|渙 涣|減 减|渢 沨|渦 涡|測 测|渾 浑|湊 凑|湋 𣲗|湞 浈|湧 涌|湯 汤|溈 沩|準 准|溝 沟|溫 温|溮 浉|溳 涢|溼 湿|滄 沧|滅 灭|滌 涤|滎 荥|滙 汇|滬 沪|滯 滞|滲 渗|滷 卤|滸 浒|滻 浐|滾 滚|滿 满|漁 渔|漊 溇|漍 𬇹|漚 沤|漢 汉|漣 涟|漬 渍|漲 涨|漵 溆|漸 渐|漿 浆|潁 颍|潑 泼|潔 洁|潕 𣲘|潙 沩|潚 㴋|潛 潜|潤 润|潯 浔|潰 溃|潷 滗|潿 涠|澀 涩|澆 浇|澇 涝|澐 沄|澗 涧|澠 渑|澤 泽|澦 滪|澩 泶|澫 𬇕|澮 浍|澱 淀|澾 㳠|濁 浊|濃 浓|濄 㳡|濆 𣸣|濕 湿|濘 泞|濚 溁|濛 蒙|濜 浕|濟 济|濤 涛|濧 㳔|濫 滥|濰 潍|濱 滨|濺 溅|濼 泺|濾 滤|瀂 澛|瀅 滢|瀆 渎|瀇 㲿|瀉 泻|瀋 沈|瀏 浏|瀕 濒|瀘 泸|瀝 沥|瀟 潇|瀠 潆|瀦 潴|瀧 泷|瀨 濑|瀰 弥|瀲 潋|瀾 澜|灃 沣|灄 滠|灑 洒|灒 𪷽|灕 漓|灘 滩|灙 𣺼|灝 灏|灡 㳕|灣 湾|灤 滦|灧 滟|灩 滟|災 灾|為 为|烏 乌|烴 烃|無 无|煉 炼|煒 炜|煙 烟|煢 茕|煥 焕|煩 烦|煬 炀|煱 㶽|熅 煴|熒 荧|熗 炝|熰 𬉼|熱 热|熲 颎|熾 炽|燀 𬊤|燁 烨|燈 灯|燉 炖|燒 烧|燖 𬊈|燙 烫|燜 焖|營 营|燦 灿|燬 毁|燭 烛|燴 烩|燶 㶶|燻 熏|燼 烬|燾 焘|爍 烁|爐 炉|爛 烂|爭 争|爲 为|爺 爷|爾 尔|牀 床|牆 墙|牘 牍|牴 抵|牽 牵|犖 荦|犛 牦|犢 犊|犧 牺|狀 状|狹 狭|狽 狈|猙 狰|猶 犹|猻 狲|獁 犸|獃 呆|獄 狱|獅 狮|獎 奖|獨 独|獪 狯|獫 猃|獮 狝|獰 狞|獱 㺍|獲 获|獵 猎|獷 犷|獸 兽|獺 獭|獻 献|獼 猕|玀 猡|現 现|琱 雕|琺 珐|琿 珲|瑋 玮|瑒 玚|瑣 琐|瑤 瑶|瑩 莹|瑪 玛|瑲 玱|璉 琏|璊 𫞩|璕 𬍤|璗 𬍡|璡 琎|璣 玑|璦 瑷|璫 珰|璯 㻅|環 环|璵 玙|璸 瑸|璽 玺|璿 璇|瓅 𬍛|瓊 琼|瓏 珑|瓔 璎|瓚 瓒|瓛 𤩽|甌 瓯|甕 瓮|產 产|産 产|畝 亩|畢 毕|畫 画|異 异|畵 画|當 当|疇 畴|疊 叠|痙 痉|痠 酸|痾 疴|瘂 痖|瘋 疯|瘍 疡|瘓 痪|瘞 瘗|瘡 疮|瘧 疟|瘮 瘆|瘲 疭|瘺 瘘|瘻 瘘|療 疗|癆 痨|癇 痫|癉 瘅|癒 愈|癘 疠|癟 瘪|癡 痴|癢 痒|癤 疖|癥 症|癧 疬|癩 癞|癬 癣|癭 瘿|癮 瘾|癰 痈|癱 瘫|癲 癫|發 发|皁 皂|皚 皑|皰 疱|皸 皲|皺 皱|盃 杯|盜 盗|盞 盏|盡 尽|監 监|盤 盘|盧 卢|盪 荡|眞 真|眥 眦|眾 众|睍 𪾢|睏 困|睜 睁|睞 睐|瞘 眍|瞜 䁖|瞞 瞒|瞶 瞆|瞼 睑|矇 蒙|矓 眬|矚 瞩|矯 矫|硃 朱|硜 硁|硤 硖|硨 砗|硯 砚|碕 埼|碩 硕|碭 砀|碸 砜|確 确|碼 码|碽 䂵|磑 硙|磚 砖|磠 硵|磣 碜|磧 碛|磯 矶|磽 硗|磾 䃅|礄 硚|礎 础|礐 𬒈|礙 碍|礦 矿|礪 砺|礫 砾|礬 矾|礱 砻|祕 秘|祿 禄|禍 祸|禎 祯|禕 祎|禡 祃|禦 御|禪 禅|禮 礼|禰 祢|禱 祷|禿 秃|秈 籼|稅 税|稈 秆|稏 䅉|稜 棱|稟 禀|種 种|稱 称|穀 谷|穇 䅟|穌 稣|積 积|穎 颖|穠 秾|穡 穑|穢 秽|穩 稳|穫 获|穭 穞|窩 窝|窪 洼|窮 穷|窯 窑|窵 窎|窶 窭|窺 窥|竄 窜|竅 窍|竇 窦|竈 灶|竊 窃|竪 竖|競 竞|筆 笔|筍 笋|筧 笕|筴 䇲|箇 个|箋 笺|箏 筝|箚 札|節 节|範 范|築 筑|篋 箧|篔 筼|篠 筿|篢 𬕂|篤 笃|篩 筛|篳 筚|篸 𥮾|簀 箦|簍 篓|簑 蓑|簞 箪|簡 简|簣 篑|簫 箫|簹 筜|簽 签|簾 帘|籃 篮|籅 𥫣|籌 筹|籔 䉤|籙 箓|籛 篯|籜 箨|籟 籁|籠 笼|籤 签|籩 笾|籪 簖|籬 篱|籮 箩|籲 吁|粵 粤|糉 粽|糝 糁|糞 粪|糧 粮|糰 团|糲 粝|糴 籴|糶 粜|糹 纟|糾 纠|紀 纪|紂 纣|紃 𬘓|約 约|紅 红|紆 纡|紇 纥|紈 纨|紉 纫|紋 纹|納 纳|紐 纽|紓 纾|純 纯|紕 纰|紖 纼|紗 纱|紘 纮|紙 纸|級 级|紛 纷|紜 纭|紝 纴|紞 𬘘|紡 纺|紬 䌷|紮 扎|細 细|紱 绂|紲 绁|紳 绅|紵 纻|紹 绍|紺 绀|紼 绋|紿 绐|絀 绌|終 终|絃 弦|組 组|絅 䌹|絆 绊|絎 绗|結 结|絕 绝|絛 绦|絝 绔|絞 绞|絡 络|絢 绚|給 给|絨 绒|絪 𬘡|絰 绖|統 统|絲 丝|絳 绛|絶 绝|絹 绢|絺 𫄨|綁 绑|綃 绡|綄 𬘫|綆 绠|綈 绨|綉 绣|綌 绤|綎 𬘩|綏 绥|綐 䌼|綑 捆|經 经|綖 𫄧|綜 综|綝 𬘭|綞 缍|綠 绿|綡 𫟅|綢 绸|綣 绻|綧 𬘯|綪 𬘬|綫 线|綬 绶|維 维|綯 绹|綰 绾|綱 纲|網 网|綳 绷|綴 缀|綵 彩|綸 纶|綹 绺|綺 绮|綻 绽|綽 绰|綾 绫|綿 绵|緄 绲|緇 缁|緊 紧|緋 绯|緑 绿|緒 绪|緓 绬|緔 绱|緗 缃|緘 缄|緙 缂|線 线|緝 缉|緞 缎|締 缔|緡 缗|緣 缘|緦 缌|編 编|緩 缓|緬 缅|緯 纬|緱 缑|緲 缈|練 练|緶 缏|緹 缇|緻 致|緼 缊|縈 萦|縉 缙|縊 缢|縋 缒|縐 绉|縑 缣|縕 缊|縗 缞|縛 缚|縝 缜|縞 缟|縟 缛|縣 县|縧 绦|縫 缝|縭 缡|縮 缩|縯 𬙂|縱 纵|縲 缧|縳 䌸|縴 纤|縵 缦|縶 絷|縷 缕|縹 缥|總 总|績 绩|繃 绷|繅 缫|繆 缪|繒 缯|織 织|繕 缮|繚 缭|繞 绕|繡 绣|繢 缋|繩 绳|繪 绘|繫 系|繭 茧|繮 缰|繯 缳|繰 缲|繳 缴|繶 𫄷|繸 䍁|繹 绎|繻 𦈡|繼 继|繽 缤|繾 缱|繿 䍀|纁 𫄸|纆 𬙊|纇 颣|纈 缬|纊 纩|續 续|纍 累|纏 缠|纓 缨|纔 才|纕 𬙋|纖 纤|纘 缵|纜 缆|缽 钵|罃 䓨|罈 坛|罌 罂|罎 坛|罰 罚|罵 骂|罷 罢|羅 罗|羆 罴|羈 羁|羋 芈|羣 群|羥 羟|羨 羡|義 义|羶 膻|習 习|翫 玩|翬 翚|翹 翘|翽 翙|耬 耧|耮 耢|聖 圣|聞 闻|聯 联|聰 聪|聲 声|聳 耸|聵 聩|聶 聂|職 职|聹 聍|聽 听|聾 聋|肅 肃|脅 胁|脈 脉|脛 胫|脣 唇|脩 修|脫 脱|脹 胀|腎 肾|腖 胨|腡 脶|腦 脑|腫 肿|腳 脚|腸 肠|膃 腽|膕 腘|膚 肤|膞 䏝|膠 胶|膢 𦝼|膩 腻|膽 胆|膾 脍|膿 脓|臉 脸|臍 脐|臏 膑|臘 腊|臚 胪|臟 脏|臠 脔|臢 臜|臥 卧|臨 临|臺 台|與 与|興 兴|舉 举|舊 旧|舖 铺|舘 馆|艙 舱|艤 舣|艦 舰|艫 舻|艱 艰|艷 艳|芻 刍|苧 苎|茲 兹|荊 荆|莊 庄|莖 茎|莢 荚|莧 苋|華 华|菴 庵|菸 烟|萇 苌|萊 莱|萬 万|萴 荝|萵 莴|葉 叶|葒 荭|葤 荮|葦 苇|葯 药|葷 荤|蒍 𫇭|蒐 搜|蒓 莼|蒔 莳|蒕 蒀|蒞 莅|蒼 苍|蓀 荪|蓆 席|蓋 盖|蓮 莲|蓯 苁|蓴 莼|蓽 荜|蔄 𬜬|蔔 卜|蔘 参|蔞 蒌|蔣 蒋|蔥 葱|蔦 茑|蔭 荫|蔯 𫈟|蔿 𫇭|蕁 荨|蕆 蒇|蕎 荞|蕒 荬|蕓 芸|蕕 莸|蕘 荛|蕢 蒉|蕩 荡|蕪 芜|蕭 萧|蕷 蓣|薀 蕰|薈 荟|薊 蓟|薌 芗|薑 姜|薔 蔷|薘 荙|薟 莶|薦 荐|薩 萨|薳 䓕|薴 苧|薵 䓓|薹 苔|薺 荠|藍 蓝|藎 荩|藝 艺|藥 药|藪 薮|藭 䓖|藴 蕴|藶 苈|藹 蔼|藺 蔺|蘀 萚|蘄 蕲|蘆 芦|蘇 苏|蘊 蕴|蘋 苹|蘚 藓|蘞 蔹|蘟 𦻕|蘢 茏|蘭 兰|蘺 蓠|蘿 萝|虆 蔂|虉 𬟁|處 处|虛 虚|虜 虏|號 号|虧 亏|虯 虬|蛺 蛱|蛻 蜕|蜆 蚬|蝀 𬟽|蝕 蚀|蝟 猬|蝦 虾|蝨 虱|蝸 蜗|螄 蛳|螞 蚂|螢 萤|螮 䗖|螻 蝼|螿 螀|蟄 蛰|蟈 蝈|蟎 螨|蟣 虮|蟬 蝉|蟯 蛲|蟲 虫|蟳 𫊻|蟶 蛏|蟻 蚁|蠁 蚃|蠅 蝇|蠆 虿|蠍 蝎|蠐 蛴|蠑 蝾|蠔 蚝|蠟 蜡|蠣 蛎|蠨 蟏|蠱 蛊|蠶 蚕|蠻 蛮|衆 众|衊 蔑|術 术|衕 同|衚 胡|衛 卫|衝 冲|袞 衮|袷 夹|裊 袅|裏 里|補 补|裝 装|裡 里|製 制|複 复|褌 裈|褘 袆|褲 裤|褳 裢|褸 褛|褻 亵|襀 𫌀|襇 裥|襉 裥|襏 袯|襖 袄|襝 裣|襠 裆|襤 褴|襪 袜|襬 摆|襯 衬|襲 袭|襴 襕|覈 核|見 见|覎 觃|規 规|覓 觅|視 视|覘 觇|覡 觋|覥 觍|覦 觎|親 亲|覬 觊|覯 觏|覲 觐|覷 觑|覺 觉|覽 览|覿 觌|觀 观|觴 觞|觶 觯|觸 触|訁 讠|訂 订|訃 讣|計 计|訊 讯|訌 讧|討 讨|訏 𬣙|訐 讦|訒 讱|訓 训|訕 讪|訖 讫|託 托|記 记|訛 讹|訝 讶|訟 讼|訢 䜣|訣 诀|訥 讷|訩 讻|訪 访|設 设|許 许|訴 诉|訶 诃|診 诊|註 注|証 证|詀 𧮪|詁 诂|詆 诋|詎 讵|詐 诈|詒 诒|詔 诏|評 评|詖 诐|詗 诇|詘 诎|詛 诅|詝 𬣞|詞 词|詠 咏|詡 诩|詢 询|詣 诣|試 试|詩 诗|詪 𬣳|詫 诧|詬 诟|詭 诡|詮 诠|詰 诘|話 话|該 该|詳 详|詵 诜|詷 𫍣|詼 诙|詿 诖|誄 诔|誅 诛|誆 诓|誇 夸|誌 志|認 认|誑 诳|誒 诶|誕 诞|誘 诱|誚 诮|語 语|誠 诚|誡 诫|誣 诬|誤 误|誥 诰|誦 诵|誨 诲|說 说|説 说|誰 谁|課 课|誶 谇|誹 诽|誼 谊|誾 訚|調 调|諂 谄|諄 谆|談 谈|諉 诿|請 请|諍 诤|諏 诹|諑 诼|諒 谅|諓 𬣡|論 论|諗 谂|諛 谀|諜 谍|諝 谞|諞 谝|諟 𬤊|諡 谥|諢 诨|諤 谔|諦 谛|諧 谐|諫 谏|諭 谕|諮 咨|諱 讳|諲 𬤇|諳 谙|諴 𫍯|諶 谌|諷 讽|諸 诸|諺 谚|諼 谖|諾 诺|謀 谋|謁 谒|謂 谓|謄 誊|謅 诌|謊 谎|謎 谜|謏 𫍲|謐 谧|謔 谑|謖 谡|謗 谤|謙 谦|謚 谥|講 讲|謝 谢|謠 谣|謡 谣|謨 谟|謫 谪|謬 谬|謭 谫|謳 讴|謹 谨|謾 谩|譁 哗|證 证|譎 谲|譏 讥|譓 𬤝|譖 谮|識 识|譙 谯|譚 谭|譜 谱|譞 𫍽|譟 噪|譫 谵|譭 毁|譯 译|議 议|譴 谴|護 护|譸 诪|譽 誉|譾 谫|讀 读|讅 谉|變 变|讋 詟|讌 䜩|讎 雠|讒 谗|讓 让|讕 谰|讖 谶|讚 赞|讜 谠|讞 谳|谿 溪|豈 岂|豎 竖|豐 丰|豔 艳|豬 猪|豶 豮|貍 狸|貓 猫|貙 䝙|貝 贝|貞 贞|貟 贠|負 负|財 财|貢 贡|貧 贫|貨 货|販 贩|貪 贪|貫 贯|責 责|貯 贮|貰 贳|貲 赀|貳 贰|貴 贵|貶 贬|買 买|貸 贷|貺 贶|費 费|貼 贴|貽 贻|貿 贸|賀 贺|賁 贲|賂 赂|賃 赁|賄 贿|賅 赅|資 资|賈 贾|賊 贼|賑 赈|賒 赊|賓 宾|賕 赇|賙 赒|賚 赉|賜 赐|賞 赏|賠 赔|賡 赓|賢 贤|賣 卖|賤 贱|賦 赋|賧 赕|質 质|賫 赍|賬 账|賭 赌|賰 䞐|賴 赖|賵 赗|賺 赚|賻 赙|購 购|賽 赛|賾 赜|贄 贽|贅 赘|贇 赟|贈 赠|贊 赞|贋 赝|贍 赡|贏 赢|贐 赆|贓 赃|贔 赑|贖 赎|贗 赝|贛 赣|贜 赃|赬 赪|趕 赶|趙 赵|趨 趋|趲 趱|跡 迹|踐 践|踰 逾|踴 踊|蹌 跄|蹕 跸|蹟 迹|蹠 跖|蹣 蹒|蹤 踪|蹺 跷|躂 跶|躉 趸|躊 踌|躋 跻|躍 跃|躎 䟢|躑 踯|躒 跞|躓 踬|躕 蹰|躚 跹|躡 蹑|躥 蹿|躦 躜|躪 躏|軀 躯|車 车|軋 轧|軌 轨|軍 军|軏 𫐄|軑 轪|軒 轩|軔 轫|軛 轭|軝 𬨂|軟 软|軤 轷|軫 轸|軲 轱|軸 轴|軹 轵|軺 轺|軻 轲|軼 轶|軾 轼|較 较|輄 𨐈|輅 辂|輇 辁|輈 辀|載 载|輊 轾|輋 𪨶|輒 辄|輓 挽|輔 辅|輕 轻|輗 𫐐|輛 辆|輜 辎|輝 辉|輞 辋|輟 辍|輥 辊|輦 辇|輩 辈|輪 轮|輬 辌|輮 𫐓|輯 辑|輳 辏|輶 𬨎|輸 输|輻 辐|輼 辒|輾 辗|輿 舆|轀 辒|轂 毂|轄 辖|轅 辕|轆 辘|轉 转|轍 辙|轎 轿|轔 辚|轟 轰|轡 辔|轢 轹|轤 轳|辦 办|辭 辞|辮 辫|辯 辩|農 农|迴 回|逕 径|這 这|連 连|週 周|進 进|遊 游|運 运|過 过|達 达|違 违|遙 遥|遜 逊|遞 递|遠 远|遡 溯|適 适|遲 迟|遶 绕|遷 迁|選 选|遺 遗|遼 辽|邁 迈|還 还|邇 迩|邊 边|邏 逻|邐 逦|郟 郏|郵 邮|鄆 郓|鄉 乡|鄒 邹|鄔 邬|鄖 郧|鄧 邓|鄩 𬩽|鄭 郑|鄰 邻|鄲 郸|鄳 𫑡|鄴 邺|鄶 郐|鄺 邝|酇 酂|酈 郦|醃 腌|醖 酝|醜 丑|醞 酝|醟 蒏|醣 糖|醫 医|醬 酱|醱 酦|醲 𬪩|釀 酿|釁 衅|釃 酾|釅 酽|釋 释|釐 厘|釒 钅|釓 钆|釔 钇|釕 钌|釗 钊|釘 钉|釙 钋|針 针|釣 钓|釤 钐|釦 扣|釧 钏|釩 钒|釴 𬬩|釵 钗|釷 钍|釹 钕|釺 钎|釾 䥺|釿 𬬱|鈀 钯|鈁 钫|鈃 钘|鈄 钭|鈅 钥|鈇 𫓧|鈈 钚|鈉 钠|鈍 钝|鈎 钩|鈐 钤|鈑 钣|鈒 钑|鈔 钞|鈕 钮|鈞 钧|鈡 钟|鈣 钙|鈥 钬|鈦 钛|鈧 钪|鈮 铌|鈰 铈|鈳 钶|鈴 铃|鈷 钴|鈸 钹|鈹 铍|鈺 钰|鈽 钸|鈾 铀|鈿 钿|鉀 钾|鉅 巨|鉆 钻|鉈 铊|鉉 铉|鉊 𬬿|鉋 铇|鉍 铋|鉑 铂|鉕 钷|鉗 钳|鉚 铆|鉛 铅|鉝 𫟷|鉞 钺|鉢 钵|鉤 钩|鉥 𬬸|鉦 钲|鉧 𬭁|鉬 钼|鉭 钽|鉮 𬬹|鉳 锫|鉶 铏|鉷 𫟹|鉸 铰|鉺 铒|鉻 铬|鉿 铪|銀 银|銃 铳|銅 铜|銈 𫓯|銍 铚|銑 铣|銓 铨|銖 铢|銘 铭|銚 铫|銛 铦|銜 衔|銠 铑|銣 铷|銥 铱|銦 铟|銨 铵|銩 铥|銪 铕|銫 铯|銬 铐|銱 铞|銳 锐|銶 𨱇|銷 销|銹 锈|銻 锑|銼 锉|鋁 铝|鋃 锒|鋅 锌|鋇 钡|鋌 铤|鋏 铗|鋐 𬭎|鋒 锋|鋗 𫓶|鋙 铻|鋝 锊|鋟 锓|鋣 铘|鋤 锄|鋥 锃|鋦 锔|鋨 锇|鋩 铓|鋪 铺|鋭 锐|鋮 铖|鋯 锆|鋰 锂|鋱 铽|鋶 锍|鋸 锯|鋹 𬬮|鋼 钢|錀 𬬭|錁 锞|錄 录|錆 锖|錇 锫|錈 锩|錏 铔|錐 锥|錒 锕|錕 锟|錘 锤|錙 锱|錚 铮|錛 锛|錞 𬭚|錟 锬|錠 锭|錡 锜|錢 钱|錤 𫓹|錦 锦|錨 锚|錩 锠|錫 锡|錮 锢|錯 错|録 录|錳 锰|錶 表|錸 铼|錼 镎|鍀 锝|鍁 锨|鍃 锪|鍅 钫|鍆 钔|鍇 锴|鍈 锳|鍊 炼|鍋 锅|鍍 镀|鍔 锷|鍘 铡|鍚 钖|鍛 锻|鍠 锽|鍤 锸|鍥 锲|鍩 锘|鍬 锹|鍭 𬭤|鍰 锾|鍵 键|鍶 锶|鍺 锗|鍼 针|鍾 钟|鎂 镁|鎄 锿|鎇 镅|鎊 镑|鎌 镰|鎓 𬭩|鎔 镕|鎖 锁|鎘 镉|鎚 锤|鎛 镈|鎝 𨱏|鎡 镃|鎢 钨|鎣 蓥|鎦 镏|鎧 铠|鎩 铩|鎪 锼|鎬 镐|鎭 镇|鎮 镇|鎰 镒|鎲 镋|鎳 镍|鎵 镓|鎶 鿔|鎸 镌|鎿 镎|鏃 镞|鏇 旋|鏈 链|鏌 镆|鏍 镙|鏏 𬭬|鏐 镠|鏑 镝|鏗 铿|鏘 锵|鏜 镗|鏝 镘|鏞 镛|鏟 铲|鏡 镜|鏢 镖|鏤 镂|鏨 錾|鏰 镚|鏵 铧|鏷 镤|鏹 镪|鏺 䥽|鏻 𬭸|鏽 锈|鐃 铙|鐄 𨱑|鐇 𫔍|鐋 铴|鐍 𫔎|鐏 𨱔|鐐 镣|鐒 铹|鐓 镦|鐔 镡|鐘 钟|鐙 镫|鐝 镢|鐠 镨|鐥 䦅|鐦 锎|鐧 锏|鐨 镄|鐩 𬭼|鐫 镌|鐮 镰|鐯 䦃|鐲 镯|鐳 镭|鐵 铁|鐶 镮|鐸 铎|鐺 铛|鐽 𫟼|鐿 镱|鑄 铸|鑊 镬|鑌 镔|鑑 鉴|鑒 鉴|鑔 镲|鑕 锧|鑞 镴|鑠 铄|鑣 镳|鑥 镥|鑪 𬬻|鑭 镧|鑰 钥|鑱 镵|鑲 镶|鑷 镊|鑹 镩|鑼 锣|鑽 钻|鑾 銮|鑿 凿|钁 镢|钂 镋|長 长|門 门|閂 闩|閃 闪|閆 闫|閈 闬|閉 闭|開 开|閌 闶|閎 闳|閏 闰|閑 闲|閒 闲|間 间|閔 闵|閘 闸|閡 阂|閣 阁|閤 合|閥 阀|閨 闺|閩 闽|閫 阃|閬 阆|閭 闾|閱 阅|閲 阅|閶 阊|閹 阉|閻 阎|閼 阏|閽 阍|閾 阈|閿 阌|闃 阒|闆 板|闇 暗|闈 闱|闉 𬮱|闊 阔|闋 阕|闌 阑|闍 阇|闐 阗|闑 𫔶|闒 阘|闓 闿|闔 阖|闕 阙|闖 闯|關 关|闞 阚|闠 阓|闡 阐|闢 辟|闤 阛|闥 闼|陘 陉|陝 陕|陞 升|陣 阵|陰 阴|陳 陈|陸 陆|陽 阳|隉 陧|隊 队|階 阶|隑 𬮿|隕 陨|際 际|隤 𬯎|隨 随|險 险|隮 𬯀|隯 陦|隱 隐|隴 陇|隸 隶|隻 只|雋 隽|雖 虽|雙 双|雛 雏|雜 杂|雞 鸡|離 离|難 难|雲 云|電 电|霑 沾|霢 霡|霧 雾|霽 霁|靂 雳|靄 霭|靆 叇|靈 灵|靉 叆|靚 靓|靜 静|靝 靔|靦 腼|靨 靥|鞏 巩|鞝 绱|鞦 秋|鞽 鞒|韁 缰|韃 鞑|韆 千|韉 鞯|韋 韦|韌 韧|韍 韨|韓 韩|韙 韪|韜 韬|韝 鞲|韞 韫|韻 韵|響 响|頁 页|頂 顶|頃 顷|項 项|順 顺|頇 顸|須 须|頊 顼|頌 颂|頍 𫠆|頎 颀|頏 颃|預 预|頑 顽|頒 颁|頓 顿|頔 𬱖|頗 颇|領 领|頜 颌|頠 𬱟|頡 颉|頤 颐|頦 颏|頫 𫖯|頭 头|頮 颒|頰 颊|頲 颋|頴 颕|頵 𫖳|頷 颔|頸 颈|頹 颓|頻 频|頽 颓|顆 颗|題 题|額 额|顎 颚|顏 颜|顒 颙|顓 颛|顔 颜|顗 𫖮|願 愿|顙 颡|顛 颠|類 类|顢 颟|顥 颢|顧 顾|顫 颤|顬 颥|顯 显|顰 颦|顱 颅|顳 颞|顴 颧|風 风|颭 飐|颮 飑|颯 飒|颱 台|颳 刮|颶 飓|颸 飔|颺 飏|颻 飖|颼 飕|飀 飗|飄 飘|飆 飙|飈 飚|飛 飞|飠 饣|飢 饥|飣 饤|飥 饦|飩 饨|飪 饪|飫 饫|飭 饬|飯 饭|飱 飧|飲 饮|飴 饴|飼 饲|飽 饱|飾 饰|飿 饳|餃 饺|餄 饸|餅 饼|餈 糍|餉 饷|養 养|餌 饵|餎 饹|餏 饻|餑 饽|餒 馁|餓 饿|餕 馂|餖 饾|餗 𫗧|餘 余|餚 肴|餛 馄|餜 馃|餞 饯|餡 馅|館 馆|餬 糊|餱 糇|餳 饧|餵 喂|餶 馉|餷 馇|餸 𩠌|餺 馎|餼 饩|餾 馏|餿 馊|饁 馌|饃 馍|饅 馒|饈 馐|饉 馑|饊 馓|饋 馈|饌 馔|饑 饥|饒 饶|饗 飨|饘 𫗴|饜 餍|饞 馋|饢 馕|馬 马|馭 驭|馮 冯|馱 驮|馳 驰|馴 驯|馹 驲|馼 𫘜|駁 驳|駃 𫘝|駉 𬳶|駐 驻|駑 驽|駒 驹|駓 𬳵|駔 驵|駕 驾|駘 骀|駙 驸|駛 驶|駝 驼|駟 驷|駡 骂|駢 骈|駪 𬳽|駭 骇|駰 骃|駱 骆|駸 骎|駼 𬳿|駿 骏|騁 骋|騂 骍|騄 𫘧|騅 骓|騊 𫘦|騌 骔|騍 骒|騎 骑|騏 骐|騑 𬴂|騖 骛|騙 骗|騞 𬴃|騠 𫘨|騤 骙|騧 䯄|騫 骞|騭 骘|騮 骝|騰 腾|騱 𫘬|騵 𫘪|騶 驺|騷 骚|騸 骟|騾 骡|驀 蓦|驁 骜|驂 骖|驃 骠|驄 骢|驅 驱|驊 骅|驌 骕|驍 骁|驎 𬴊|驏 骣|驕 骄|驗 验|驚 惊|驛 驿|驟 骤|驢 驴|驤 骧|驥 骥|驦 骦|驪 骊|驫 骉|骯 肮|髏 髅|髒 脏|體 体|髕 髌|髖 髋|髮 发|鬆 松|鬍 胡|鬚 须|鬢 鬓|鬥 斗|鬧 闹|鬨 哄|鬩 阋|鬮 阄|鬱 郁|鬹 鬶|魎 魉|魘 魇|魚 鱼|魛 鱽|魟 𫚉|魢 鱾|魨 鲀|魯 鲁|魴 鲂|魷 鱿|魺 鲄|鮀 𬶍|鮁 鲅|鮃 鲆|鮆 𫚖|鮈 𬶋|鮊 鲌|鮋 鲉|鮍 鲏|鮎 鲇|鮐 鲐|鮑 鲍|鮒 鲋|鮓 鲊|鮚 鲒|鮜 鲘|鮝 鲞|鮞 鲕|鮟 𩽾|鮠 𬶏|鮡 𬶐|鮣 䲟|鮦 鲖|鮪 鲔|鮫 鲛|鮭 鲑|鮮 鲜|鮳 鲓|鮶 鲪|鮸 𩾃|鮺 鲝|鯀 鲧|鯁 鲠|鯇 鲩|鯉 鲤|鯊 鲨|鯒 鲬|鯔 鲻|鯕 鲯|鯖 鲭|鯗 鲞|鯛 鲷|鯝 鲴|鯡 鲱|鯢 鲵|鯤 鲲|鯧 鲳|鯨 鲸|鯪 鲮|鯫 鲰|鯰 鲶|鯴 鲺|鯷 鳀|鯻 𬶟|鯽 鲫|鯿 鳊|鰁 鳈|鰂 鲗|鰃 鳂|鰆 䲠|鰈 鲽|鰉 鳇|鰊 𬶠|鰌 䲡|鰍 鳅|鰏 鲾|鰐 鳄|鰒 鳆|鰓 鳃|鰛 鳁|鰜 鳒|鰟 鳑|鰠 鳋|鰣 鲥|鰤 𫚕|鰥 鳏|鰧 䲢|鰨 鳎|鰩 鳐|鰭 鳍|鰮 鳁|鰱 鲢|鰲 鳌|鰳 鳓|鰵 鳘|鰶 𬶭|鰷 鲦|鰹 鲣|鰺 鲹|鰻 鳗|鰼 鳛|鰾 鳔|鱀 𬶨|鱂 鳉|鱅 鳙|鱇 𩾌|鱈 鳕|鱉 鳖|鱒 鳟|鱔 鳝|鱖 鳜|鱗 鳞|鱘 鲟|鱚 𬶮|鱝 鲼|鱟 鲎|鱠 鲙|鱣 鳣|鱤 鳡|鱧 鳢|鱨 鲿|鱭 鲚|鱯 鳠|鱲 𫚭|鱷 鳄|鱸 鲈|鱺 鲡|鳥 鸟|鳧 凫|鳩 鸠|鳬 凫|鳲 鸤|鳳 凤|鳴 鸣|鳶 鸢|鳾 䴓|鴆 鸩|鴇 鸨|鴉 鸦|鴒 鸰|鴕 鸵|鴛 鸳|鴝 鸲|鴞 鸮|鴟 鸱|鴣 鸪|鴦 鸯|鴨 鸭|鴯 鸸|鴰 鸹|鴴 鸻|鴷 䴕|鴻 鸿|鴿 鸽|鵁 䴔|鵂 鸺|鵃 鸼|鵏 𬷕|鵐 鹀|鵑 鹃|鵒 鹆|鵓 鹁|鵜 鹈|鵝 鹅|鵟 𫛭|鵠 鹄|鵡 鹉|鵪 鹌|鵬 鹏|鵮 鹐|鵯 鹎|鵰 雕|鵲 鹊|鵷 鹓|鵾 鹍|鶄 䴖|鶇 鸫|鶉 鹑|鶊 鹒|鶓 鹋|鶖 鹙|鶘 鹕|鶚 鹗|鶠 𬸘|鶡 鹖|鶥 鹛|鶩 鹜|鶪 䴗|鶬 鸧|鶯 莺|鶱 𬸣|鶲 鹟|鶴 鹤|鶹 鹠|鶺 鹡|鶻 鹘|鶼 鹣|鶿 鹚|鷀 鹚|鷁 鹢|鷂 鹞|鷄 鸡|鷉 䴘|鷊 鹝|鷓 鹧|鷖 鹥|鷗 鸥|鷙 鸷|鷚 鹨|鷟 𬸦|鷥 鸶|鷦 鹪|鷫 鹔|鷭 𬸪|鷯 鹩|鷲 鹫|鷳 鹇|鷴 鹇|鷸 鹬|鷹 鹰|鷺 鹭|鷽 鸴|鸂 㶉|鸇 鹯|鸊 䴙|鸌 鹱|鸏 鹲|鸑 𬸚|鸕 鸬|鸘 鹴|鸚 鹦|鸛 鹳|鸝 鹂|鸞 鸾|鹵 卤|鹹 咸|鹺 鹾|鹼 碱|鹽 盐|麗 丽|麥 麦|麩 麸|麪 面|麫 面|麬 𤿲|麯 曲|麳 𪎌|麴 曲|麵 面|麼 么|麽 么|黃 黄|黌 黉|點 点|黨 党|黲 黪|黴 霉|黶 黡|黷 黩|黽 黾|黿 鼋|鼂 鼌|鼉 鼍|鼕 冬|鼴 鼹|齊 齐|齋 斋|齎 赍|齏 齑|齒 齿|齔 龀|齕 龁|齗 龂|齘 𬹼|齙 龅|齜 龇|齟 龃|齠 龆|齡 龄|齣 出|齦 龈|齧 啮|齪 龊|齬 龉|齮 𬺈|齯 𫠜|齲 龋|齶 腭|齷 龌|齼 𬺓|龍 龙|龎 厐|龐 庞|龑 䶮|龔 龚|龕 龛|龜 龟|鿁 䜤|鿓 鿒|𠁞 𠀾|𠌥 𠌥|𠏢 𠏢|𠐊 𠐊|𠗣 㓆|𠞆 𠞆|𠠎 𠠎|𠬙 𠬙|𠼤 𠼤|𠽃 𠽃|𠿕 𠿕|𡂡 𡂡|𡃄 𡃄|𡃕 𠴛|𡃤 𡃤|𡄔 𡄔|𡄣 𡄣|𡅏 𠲥|𡅯 𡅯|𡑍 𫭼|𡑭 𡋗|𡓁 𡓁|𡓾 𡋀|𡔖 𡍣|𡞵 㛟|𡟫 𡟫|𡠹 㛿|𡢃 㛠|𡮉 𡭜|𡮣 𡭬|𡳳 𡳃|𡸗 𡸗|𡹬 𡹬|𡻕 岁|𡽗 𡽗|𡾱 㟜|𡿖 𡿖|𢍰 𢍰|𢠼 𢠼|𢣐 𢣐|𢣚 𢘝|𢣭 𢣭|𢤩 𢤩|𢤱 𢤱|𢤿 𢤿|𢯷 𢯷|𢶒 𢶒|𢶫 𢫞|𢷮 𢷮|𢹿 𢬦|𢺳 𢺳|𣈶 暅|𣋋 𣋋|𣍐 𣍐|𣙎 㭣|𣜬 𣜬|𣝕 𣝕|𣞻 𣘓|𣠩 𣞎|𣠲 𣑶|𣯩 𣯩|𣯴 𣯴|𣯶 毶|𣽏 𣽏|𣾷 㳢|𣿉 𣿉|𤁣 𣺽|𤄷 𤄷|𤅶 𣷷|𤑳 𤑳|𤑹 𤑹|𤒎 𤒎|𤒻 𤒻|𤓌 𤓌|𤓎 𤓎|𤓩 𤊰|𤘀 𤘀|𤛮 𤛮|𤛱 𤛱|𤜆 𤜆|𤠮 𤠮|𤢟 𤢟|𤢻 𤢻|𤩂 𤩂|𤪺 㻘|𤫩 㻏|𤬅 𤬅|𤳷 𤳷|𤳸 𤳄|𤷃 𤷃|𤸫 𤸫|𤺔 𤺔|𥊝 𥅿|𥌃 𥅘|𥏝 𥏝|𥕥 𥐰|𥖅 𥐯|𥖲 𥖲|𥗇 𥗇|𥗽 𬒗|𥜐 𥜐|𥜰 𥜰|𥞵 𥞵|𥢢 䅪|𥢶 𥢶|𥢷 𥢷|𥨐 𥨐|𥪂 𥪂|𥯤 𥯤|𥴨 𥴨|𥴼 𥴼|𥵃 𥵃|𥵊 𥵊|𥶽 𥶽|𥸠 𥮋|𥻦 𥻦|𥼽 𥹥|𥽖 𥽖|𥾯 𥾯|𥿊 𥿊|𦀖 𦀖|𦂅 𦂅|𦃄 𦃄|𦃩 𦃩|𦅇 𦅇|𦅈 𦅈|𦆲 𦆲|𦒀 𦒀|𦔖 𦔖|𦘧 𡳒|𦟼 𦟼|𦠅 𦠅|𦡝 𦡝|𦢈 𦢈|𦣎 𦟗|𦧺 𦧺|𦪙 䑽|𦪽 𦪽|𦱌 𦱌|𦾟 𦾟|𧎈 𧎈|𧒯 𧒯|𧔥 𧔥|𧕟 𧕟|𧜗 䘞|𧜵 䙊|𧝞 䘛|𧞫 𧞫|𧟀 𧝧|𧡴 𧡴|𧢄 𧢄|𧦝 𧦝|𧦧 𧦧|𧩕 𧩕|𧩙 䜥|𧩼 𧩼|𧫝 𧫝|𧬤 𧬤|𧭈 𧭈|𧭹 𧭹|𧳟 𧳟|𧵳 䞌|𧶔 𧶔|𧶧 䞎|𧷎 𧷎|𧸘 𧸘|𧹈 𧹈|𧽯 𧽯|𨂐 𨂐|𨄣 𨄣|𨅍 𨅍|𨆪 𨆪|𨇁 𨇁|𨇞 𨇞|𨇤 𨇤|𨇰 𨇰|𨇽 𨇽|𨈊 𨈊|𨈌 𨈌|𨊰 䢀|𨊸 䢁|𨊻 𨊻|𨋢 䢂|𨌈 𨌈|𨍰 𨍰|𨎌 𨎌|𨎮 𨎮|𨏠 𨏠|𨏥 𨏥|𨞺 𨞺|𨟊 𨟊|𨢿 𨢿|𨣈 𨣈|𨣞 𨣞|𨣧 𨣧|𨤻 𨤰|𨥛 𨥛|𨥟 𨥟|𨦫 䦀|𨧀 𬭊|𨧜 䦁|𨧰 𨧰|𨧱 𨧱|𨨏 𬭛|𨨛 𨨛|𨨢 𨨢|𨩰 𨩰|𨪕 𨪕|𨫒 𨫒|𨬖 𨬖|𨭆 𬭶|𨭎 𬭳|𨭖 𨭖|𨭸 𨭸|𨮂 𨮂|𨮳 𨮳|𨯅 䥿|𨯟 𨯟|𨰃 𨰃|𨰋 𨰋|𨰥 𨰥|𨰲 𨰲|𨲳 𨲳|𨳑 𨳑|𨳕 𨳕|𨴗 𨴗|𨴹 𨴹|𨵩 𨵩|𨵸 𨵸|𨶀 𨶀|𨶏 𨶏|𨶮 𨶮|𨶲 𨶲|𨷲 𨷲|𨼳 𨼳|𨽏 𨽏|𩀨 𩀨|𩅙 𩅙|𩎖 𩎖|𩎢 𩎢|𩏂 𩏂|𩏠 𩏠|𩏪 𩏪|𩏷 𩏷|𩑔 𩑔|𩒎 𩒎|𩓣 𩓣|𩓥 𩓥|𩔑 𩔑|𩔳 𩔳|𩖰 𩖰|𩗀 𩗀|𩗓 𩗓|𩗴 𩗴|𩘀 𩘀|𩘝 𩘝|𩘹 𩘹|𩘺 𩘺|𩙈 𩙈|𩚛 𩚛|𩚥 𩚥|𩚩 𩚩|𩚵 𩚵|𩛆 𩛆|𩛌 𩛌|𩛡 𩛡|𩛩 𩛩|𩜇 𩜇|𩜦 𩜦|𩜵 𩜵|𩝔 𩝔|𩝽 𩝽|𩞄 𩞄|𩞦 𩞦|𩞯 䭪|𩟐 𩟐|𩟗 𩟗|𩠴 𩠠|𩡣 𩡣|𩡺 𩡺|𩢡 𩢡|𩢴 𩢴|𩢸 𩢸|𩢾 𩢾|𩣏 𩣏|𩣑 䯃|𩣫 𩣫|𩣵 𩣵|𩣺 𩣺|𩤊 𩤊|𩤙 𩤙|𩤲 𩤲|𩤸 𩤸|𩥄 𩥄|𩥇 𩥇|𩥉 𩥉|𩥑 𩥑|𩦠 𩦠|𩧆 𩧆|𩭙 𩭙|𩯁 𩯁|𩯳 𩯳|𩰀 𩰀|𩰹 𩰹|𩳤 𩳤|𩴵 𩴵|𩵦 𩵦|𩵩 𩵩|𩵹 𩵹|𩶁 𩶁|𩶘 䲞|𩶰 𩶰|𩶱 𩶱|𩷰 𩷰|𩸃 𩸃|𩸄 𩸄|𩸡 𩸡|𩸦 𩸦|𩻗 𩻗|𩻬 𩻬|𩻮 𩻮|𩼶 𩼶|𩽇 𩽇|𩿅 𩿅|𩿤 𩿤|𩿪 𩿪|𪀖 𪀖|𪀦 𪀦|𪀾 𪀾|𪁈 𪁈|𪁖 𪁖|𪂆 𪂆|𪃍 𪃍|𪃏 𪃏|𪃒 𪃒|𪃧 𪃧|𪄆 𪄆|𪄕 𪄕|𪅂 𪅂|𪆷 𪆷|𪇳 𪇳|𪈼 𪈼|𪉸 𪉸|𪋿 𪋿|𪌭 𪌭|𪍠 𪍠|𪓰 𪓰|𪔵 𪔵|𪘀 𪘀|𪘯 𪘯|𪙏 𪙏|𪟖 𪟖|𪷓 𪷓|𫒡 𫒡|𫜦 𫜦|𰻞 𰻝",A="豈 豈|更 更|車 車|賈 賈|滑 滑|串 串|句 句|龜 龜|龜 龜|契 契|金 金|喇 喇|奈 奈|懶 懶|癩 癩|羅 羅|蘿 蘿|螺 螺|裸 裸|邏 邏|樂 樂|洛 洛|烙 烙|珞 珞|落 落|酪 酪|駱 駱|亂 亂|卵 卵|欄 欄|爛 爛|蘭 蘭|鸞 鸞|嵐 嵐|濫 濫|藍 藍|襤 襤|拉 拉|臘 臘|蠟 蠟|廊 廊|朗 朗|浪 浪|狼 狼|郎 郎|來 來|冷 冷|勞 勞|擄 擄|櫓 櫓|爐 爐|盧 盧|老 老|蘆 蘆|虜 虜|路 路|露 露|魯 魯|鷺 鷺|碌 碌|祿 祿|綠 綠|菉 菉|錄 錄|鹿 鹿|論 論|壟 壟|弄 弄|籠 籠|聾 聾|牢 牢|磊 磊|賂 賂|雷 雷|壘 壘|屢 屢|樓 樓|淚 淚|漏 漏|累 累|縷 縷|陋 陋|勒 勒|肋 肋|凜 凜|凌 凌|稜 稜|綾 綾|菱 菱|陵 陵|讀 讀|拏 拏|樂 樂|諾 諾|丹 丹|寧 寧|怒 怒|率 率|異 異|北 北|磻 磻|便 便|復 復|不 不|泌 泌|數 數|索 索|參 參|塞 塞|省 省|葉 葉|說 說|殺 殺|辰 辰|沈 沈|拾 拾|若 若|掠 掠|略 略|亮 亮|兩 兩|凉 凉|梁 梁|糧 糧|良 良|諒 諒|量 量|勵 勵|呂 呂|女 女|廬 廬|旅 旅|濾 濾|礪 礪|閭 閭|驪 驪|麗 麗|黎 黎|力 力|曆 曆|歷 歷|轢 轢|年 年|憐 憐|戀 戀|撚 撚|漣 漣|煉 煉|璉 璉|秊 秊|練 練|聯 聯|輦 輦|蓮 蓮|連 連|鍊 鍊|列 列|劣 劣|咽 咽|烈 烈|裂 裂|說 說|廉 廉|念 念|捻 捻|殮 殮|簾 簾|獵 獵|令 令|囹 囹|寧 寧|嶺 嶺|怜 怜|玲 玲|瑩 瑩|羚 羚|聆 聆|鈴 鈴|零 零|靈 靈|領 領|例 例|禮 禮|醴 醴|隸 隸|惡 惡|了 了|僚 僚|寮 寮|尿 尿|料 料|樂 樂|燎 燎|療 療|蓼 蓼|遼 遼|龍 龍|暈 暈|阮 阮|劉 劉|杻 杻|柳 柳|流 流|溜 溜|琉 琉|留 留|硫 硫|紐 紐|類 類|六 六|戮 戮|陸 陸|倫 倫|崙 崙|淪 淪|輪 輪|律 律|慄 慄|栗 栗|率 率|隆 隆|利 利|吏 吏|履 履|易 易|李 李|梨 梨|泥 泥|理 理|痢 痢|罹 罹|裏 裏|裡 裡|里 里|離 離|匿 匿|溺 溺|吝 吝|燐 燐|璘 璘|藺 藺|隣 隣|鱗 鱗|麟 麟|林 林|淋 淋|臨 臨|立 立|笠 笠|粒 粒|狀 狀|炙 炙|識 識|什 什|茶 茶|刺 刺|切 切|度 度|拓 拓|糖 糖|宅 宅|洞 洞|暴 暴|輻 輻|行 行|降 降|見 見|廓 廓|兀 兀|嗀 嗀|塚 塚|晴 晴|凞 凞|猪 猪|益 益|礼 礼|神 神|祥 祥|福 福|靖 靖|精 精|羽 羽|蘒 蘒|諸 諸|逸 逸|都 都|飯 飯|飼 飼|館 館|鶴 鶴|郞 郞|隷 隷|侮 侮|僧 僧|免 免|勉 勉|勤 勤|卑 卑|喝 喝|嘆 嘆|器 器|塀 塀|墨 墨|層 層|屮 屮|悔 悔|慨 慨|憎 憎|懲 懲|敏 敏|既 既|暑 暑|梅 梅|海 海|渚 渚|漢 漢|煮 煮|爫 爫|琢 琢|碑 碑|社 社|祉 祉|祈 祈|祐 祐|祖 祖|祝 祝|禍 禍|禎 禎|穀 穀|突 突|節 節|練 練|縉 縉|繁 繁|署 署|者 者|臭 臭|艹 艹|艹 艹|著 著|褐 褐|視 視|謁 謁|謹 謹|賓 賓|贈 贈|辶 辶|逸 逸|難 難|響 響|頻 頻|恵 恵|𤋮 𤋮|舘 舘|並 並|况 况|全 全|侀 侀|充 充|冀 冀|勇 勇|勺 勺|喝 喝|啕 啕|喙 喙|嗢 嗢|塚 塚|墳 墳|奄 奄|奔 奔|婢 婢|嬨 嬨|廒 廒|廙 廙|彩 彩|徭 徭|惘 惘|慎 慎|愈 愈|憎 憎|慠 慠|懲 懲|戴 戴|揄 揄|搜 搜|摒 摒|敖 敖|晴 晴|朗 朗|望 望|杖 杖|歹 歹|殺 殺|流 流|滛 滛|滋 滋|漢 漢|瀞 瀞|煮 煮|瞧 瞧|爵 爵|犯 犯|猪 猪|瑱 瑱|甆 甆|画 画|瘝 瘝|瘟 瘟|益 益|盛 盛|直 直|睊 睊|着 着|磌 磌|窱 窱|節 節|类 类|絛 絛|練 練|缾 缾|者 者|荒 荒|華 華|蝹 蝹|襁 襁|覆 覆|視 視|調 調|諸 諸|請 請|謁 謁|諾 諾|諭 諭|謹 謹|變 變|贈 贈|輸 輸|遲 遲|醙 醙|鉶 鉶|陼 陼|難 難|靖 靖|韛 韛|響 響|頋 頋|頻 頻|鬒 鬒|龜 龜|𢡊 𢡊|𢡄 𢡄|𣏕 𣏕|㮝 㮝|䀘 䀘|䀹 䀹|𥉉 𥉉|𥳐 𥳐|𧻓 𧻓|齃 齃|龎 龎|丽 丽|丸 丸|乁 乁|𠄢 𠄢|你 你|侮 侮|侻 侻|倂 倂|偺 偺|備 備|僧 僧|像 像|㒞 㒞|𠘺 𠘺|免 免|兔 兔|兤 兤|具 具|𠔜 𠔜|㒹 㒹|內 內|再 再|𠕋 𠕋|冗 冗|冤 冤|仌 仌|冬 冬|况 况|𩇟 𩇟|凵 凵|刃 刃|㓟 㓟|刻 刻|剆 剆|割 割|剷 剷|㔕 㔕|勇 勇|勉 勉|勤 勤|勺 勺|包 包|匆 匆|北 北|卉 卉|卑 卑|博 博|即 即|卽 卽|卿 卿|卿 卿|卿 卿|𠨬 𠨬|灰 灰|及 及|叟 叟|𠭣 𠭣|叫 叫|叱 叱|吆 吆|咞 咞|吸 吸|呈 呈|周 周|咢 咢|哶 哶|唐 唐|啓 啓|啣 啣|善 善|善 善|喙 喙|喫 喫|喳 喳|嗂 嗂|圖 圖|嘆 嘆|圗 圗|噑 噑|噴 噴|切 切|壮 壮|城 城|埴 埴|堍 堍|型 型|堲 堲|報 報|墬 墬|𡓤 𡓤|売 売|壷 壷|夆 夆|多 多|夢 夢|奢 奢|𡚨 𡚨|𡛪 𡛪|姬 姬|娛 娛|娧 娧|姘 姘|婦 婦|㛮 㛮|㛼 㛼|嬈 嬈|嬾 嬾|嬾 嬾|𡧈 𡧈|寃 寃|寘 寘|寧 寧|寳 寳|𡬘 𡬘|寿 寿|将 将|当 当|尢 尢|㞁 㞁|屠 屠|屮 屮|峀 峀|岍 岍|𡷤 𡷤|嵃 嵃|𡷦 𡷦|嵮 嵮|嵫 嵫|嵼 嵼|巡 巡|巢 巢|㠯 㠯|巽 巽|帨 帨|帽 帽|幩 幩|㡢 㡢|𢆃 𢆃|㡼 㡼|庰 庰|庳 庳|庶 庶|廊 廊|𪎒 𪎒|廾 廾|𢌱 𢌱|𢌱 𢌱|舁 舁|弢 弢|弢 弢|㣇 㣇|𣊸 𣊸|𦇚 𦇚|形 形|彫 彫|㣣 㣣|徚 徚|忍 忍|志 志|忹 忹|悁 悁|㤺 㤺|㤜 㤜|悔 悔|𢛔 𢛔|惇 惇|慈 慈|慌 慌|慎 慎|慌 慌|慺 慺|憎 憎|憲 憲|憤 憤|憯 憯|懞 懞|懲 懲|懶 懶|成 成|戛 戛|扝 扝|抱 抱|拔 拔|捐 捐|𢬌 𢬌|挽 挽|拼 拼|捨 捨|掃 掃|揤 揤|𢯱 𢯱|搢 搢|揅 揅|掩 掩|㨮 㨮|摩 摩|摾 摾|撝 撝|摷 摷|㩬 㩬|敏 敏|敬 敬|𣀊 𣀊|旣 旣|書 書|晉 晉|㬙 㬙|暑 暑|㬈 㬈|㫤 㫤|冒 冒|冕 冕|最 最|暜 暜|肭 肭|䏙 䏙|朗 朗|望 望|朡 朡|杞 杞|杓 杓|𣏃 𣏃|㭉 㭉|柺 柺|枅 枅|桒 桒|梅 梅|𣑭 𣑭|梎 梎|栟 栟|椔 椔|㮝 㮝|楂 楂|榣 榣|槪 槪|檨 檨|𣚣 𣚣|櫛 櫛|㰘 㰘|次 次|𣢧 𣢧|歔 歔|㱎 㱎|歲 歲|殟 殟|殺 殺|殻 殻|𣪍 𣪍|𡴋 𡴋|𣫺 𣫺|汎 汎|𣲼 𣲼|沿 沿|泍 泍|汧 汧|洖 洖|派 派|海 海|流 流|浩 浩|浸 浸|涅 涅|𣴞 𣴞|洴 洴|港 港|湮 湮|㴳 㴳|滋 滋|滇 滇|𣻑 𣻑|淹 淹|潮 潮|𣽞 𣽞|𣾎 𣾎|濆 濆|瀹 瀹|瀞 瀞|瀛 瀛|㶖 㶖|灊 灊|災 災|灷 灷|炭 炭|𠔥 𠔥|煅 煅|𤉣 𤉣|熜 熜|𤎫 𤎫|爨 爨|爵 爵|牐 牐|𤘈 𤘈|犀 犀|犕 犕|𤜵 𤜵|𤠔 𤠔|獺 獺|王 王|㺬 㺬|玥 玥|㺸 㺸|㺸 㺸|瑇 瑇|瑜 瑜|瑱 瑱|璅 璅|瓊 瓊|㼛 㼛|甤 甤|𤰶 𤰶|甾 甾|𤲒 𤲒|異 異|𢆟 𢆟|瘐 瘐|𤾡 𤾡|𤾸 𤾸|𥁄 𥁄|㿼 㿼|䀈 䀈|直 直|𥃳 𥃳|𥃲 𥃲|𥄙 𥄙|𥄳 𥄳|眞 眞|真 真|真 真|睊 睊|䀹 䀹|瞋 瞋|䁆 䁆|䂖 䂖|𥐝 𥐝|硎 硎|碌 碌|磌 磌|䃣 䃣|𥘦 𥘦|祖 祖|𥚚 𥚚|𥛅 𥛅|福 福|秫 秫|䄯 䄯|穀 穀|穊 穊|穏 穏|𥥼 𥥼|𥪧 𥪧|𥪧 𥪧|竮 竮|䈂 䈂|𥮫 𥮫|篆 篆|築 築|䈧 䈧|𥲀 𥲀|糒 糒|䊠 䊠|糨 糨|糣 糣|紀 紀|𥾆 𥾆|絣 絣|䌁 䌁|緇 緇|縂 縂|繅 繅|䌴 䌴|𦈨 𦈨|𦉇 𦉇|䍙 䍙|𦋙 𦋙|罺 罺|𦌾 𦌾|羕 羕|翺 翺|者 者|𦓚 𦓚|𦔣 𦔣|聠 聠|𦖨 𦖨|聰 聰|𣍟 𣍟|䏕 䏕|育 育|脃 脃|䐋 䐋|脾 脾|媵 媵|𦞧 𦞧|𦞵 𦞵|𣎓 𣎓|𣎜 𣎜|舁 舁|舄 舄|辞 辞|䑫 䑫|芑 芑|芋 芋|芝 芝|劳 劳|花 花|芳 芳|芽 芽|苦 苦|𦬼 𦬼|若 若|茝 茝|荣 荣|莭 莭|茣 茣|莽 莽|菧 菧|著 著|荓 荓|菊 菊|菌 菌|菜 菜|𦰶 𦰶|𦵫 𦵫|𦳕 𦳕|䔫 䔫|蓱 蓱|蓳 蓳|蔖 蔖|𧏊 𧏊|蕤 蕤|𦼬 𦼬|䕝 䕝|䕡 䕡|𦾱 𦾱|𧃒 𧃒|䕫 䕫|虐 虐|虜 虜|虧 虧|虩 虩|蚩 蚩|蚈 蚈|蜎 蜎|蛢 蛢|蝹 蝹|蜨 蜨|蝫 蝫|螆 螆|䗗 䗗|蟡 蟡|蠁 蠁|䗹 䗹|衠 衠|衣 衣|𧙧 𧙧|裗 裗|裞 裞|䘵 䘵|裺 裺|㒻 㒻|𧢮 𧢮|𧥦 𧥦|䚾 䚾|䛇 䛇|誠 誠|諭 諭|變 變|豕 豕|𧲨 𧲨|貫 貫|賁 賁|贛 贛|起 起|𧼯 𧼯|𠠄 𠠄|跋 跋|趼 趼|跰 跰|𠣞 𠣞|軔 軔|輸 輸|𨗒 𨗒|𨗭 𨗭|邔 邔|郱 郱|鄑 鄑|𨜮 𨜮|鄛 鄛|鈸 鈸|鋗 鋗|鋘 鋘|鉼 鉼|鏹 鏹|鐕 鐕|𨯺 𨯺|開 開|䦕 䦕|閷 閷|𨵷 𨵷|䧦 䧦|雃 雃|嶲 嶲|霣 霣|𩅅 𩅅|𩈚 𩈚|䩮 䩮|䩶 䩶|韠 韠|𩐊 𩐊|䪲 䪲|𩒖 𩒖|頋 頋|頋 頋|頩 頩|𩖶 𩖶|飢 飢|䬳 䬳|餩 餩|馧 馧|駂 駂|駾 駾|䯎 䯎|𩬰 𩬰|鬒 鬒|鱀 鱀|鳽 鳽|䳎 䳎|䳭 䳭|鵧 鵧|𪃎 𪃎|䳸 䳸|𪄅 𪄅|𪈎 𪈎|𪊑 𪊑|麻 麻|䵖 䵖|黹 黹|黾 黾|鼅 鼅|鼏 鼏|鼖 鼖|鼻 鼻|𪘀 𪘀";const C={hk:[[f,g]],hkp:[[d,f,g]],tw:[[p,h]],twp:[[y,p,h]],jp:[["一獲千金 一攫千金|丁寧 叮嚀|丁重 鄭重|三差路 三叉路|世論 輿論|予備 預備|予告 預告|予定 預定|予感 預感|予測 預測|予算 預算|予約 預約|予習 預習|予言 預言|予防 預防|亜鈴 啞鈴|交差 交叉|代弁 代辯|供宴 饗宴|俊馬 駿馬|保塁 堡壘|個条書 箇条書|偏平 扁平|停泊 碇泊|優俊 優駿|先兵 尖兵|先端 尖端|先鋭 尖銳|共役 共軛|冗舌 饒舌|凶器 兇器|削岩 鑿岩|包丁 庖丁|包帯 繃帶|区画 區劃|厳然 儼然|友宜 友誼|反乱 叛亂|収集 蒐集|叙情 抒情|台頭 擡頭|合弁 合辦|喜遊曲 嬉遊曲|嘆願 歎願|回転 廻転|回遊 回游|国際連盟 國際聯盟|奉持 捧持|委縮 萎縮|安全弁 安全瓣|展転 輾轉|希少 稀少|幻惑 眩惑|広範 廣泛|広野 曠野|廃虚 廢墟|建坪率 建蔽率|弁別 辨別|弁当 辨當|弁才 辯才|弁明 辯明|弁膜 瓣膜|弁解 辯解|弁証 辯證|弁論 辯論|弁論家 辯論家|弁護 辯護|弁護士 辯護士|弁財天 辯財天|弁駁 辯駁|弁髪 辮髮|弦歌 絃歌|恩義 恩誼|意向 意嚮|慰謝料 慰藉料|憶断 臆斷|憶病 臆病|戦没 戰歿|扇情 煽情|手帳 手帖|技量 伎倆|抜粋 抜萃|披歴 披瀝|抵触 牴觸|抽選 抽籤|拘引 勾引|拠出 醵出|拠金 醵金|掘削 掘鑿|控除 扣除|援護 掩護|放棄 抛棄|散水 撒水|敬謙 敬虔|敷延 敷衍|断固 斷乎|族生 簇生|昇叙 陞敘|暖房 煖房|暗唱 暗誦|暗夜 闇夜|暴露 曝露|枯渇 涸渴|格好 恰好|格幅 恰幅|棄損 毀損|模索 摸索|橋頭保 橋頭堡|欠缺 欠缺|欧州 歐洲|欧州連合 歐洲聯盟|死体 屍體|殿部 臀部|母指 拇指|気迫 氣魄|決別 訣別|決壊 決潰|沈殿 沈澱|油送船 油槽船|波乱 波瀾|注釈 註釋|洗浄 洗滌|活発 活潑|浸透 滲透|浸食 浸蝕|消却 銷卻|混然 渾然|湾曲 彎曲|溶接 熔接|漁労 漁撈|漂然 飄然|激高 激昂|火炎 火焰|焦燥 焦躁|猶予 猶豫|班点 斑點|留飲 溜飲|略奪 掠奪|疎通 疏通|発酵 醱酵|白亜 白堊|相克 相剋|知恵 智慧|破棄 破毀|確固 確乎|禁固 禁錮|符丁 符牒|粉装 扮裝|紫班 紫斑|終息 終熄|総合 綜合|編集 編輯|義援 義捐|耕運機 耕耘機|肝心 肝腎|肩甲骨 肩胛骨|背徳 悖德|脈拍 脈搏|膨張 膨脹|花弁 花瓣|芳純 芳醇|英知 叡智|蒸留 蒸溜|薫蒸 燻蒸|薫製 燻製|衣装 衣裳|衰退 衰退|裕然 悠然|補佐 輔佐|訓戒 訓誡|試練 試煉|詭弁 詭辯|講和 媾和|象眼 象嵌|貫録 貫祿|買弁 買辦|賛辞 讚辭|踏襲 蹈襲|車両 車輛|転倒 顛倒|輪郭 輪廓|退色 褪色|途絶 杜絕|連係 連繫|連合 聯合|連合会 聯合會|連合国 聯合國|連合艦隊 聯合艦隊|連合軍 聯合軍|連名 聯名|連想 聯想|連携 聯攜|連盟 聯盟|連立 聯立|連結 聯結|連結器 聯結器|連結性 聯結性|連絡 聯絡|連絡員 聯絡員|連絡網 聯絡網|連絡線 聯絡線|連絡船 聯絡船|連邦 聯邦|連邦共和国 聯邦共和國|連邦制 聯邦制|連邦国 聯邦國|連邦国家 聯邦國家|連邦政府 聯邦政府|連邦議会 聯邦議會|連邦軍 聯邦軍|連隊 聯隊|選考 銓衡|酢酸 醋酸|野卑 野鄙|鉱石 礦石|間欠 間歇|関数 函數|関連 關聯|関連図 關聯圖|関連性 關聯性|関連語 關聯語|防御 防禦|険阻 嶮岨|障壁 牆壁|障害 障礙|隠滅 湮滅|雄弁 雄辯|集落 聚落|雇用 僱傭|風諭 諷喩|飛語 蜚語|香典 香奠|骨格 骨骼|高進 亢進|鳥観 鳥瞰","万 萬|与 與|両 兩|並 竝|乗 乘|乱 亂|亀 龜|予 豫|争 爭|亘 亙|亜 亞|仏 佛|仮 假|会 會|伝 傳|体 體|余 餘|併 倂|価 價|倹 儉|偽 僞|児 兒|党 黨|円 圓|写 寫|凜 凛|処 處|剣 劍|剤 劑|剰 剩|励 勵|労 勞|効 效|勅 敕|勧 勸|勲 勳|区 區|医 醫|単 單|即 卽|厳 嚴|参 參|双 雙|収 收|叙 敍|台 臺|号 號|唖 啞|営 營|嘱 囑|噛 嚙|団 團|囲 圍|図 圖|国 國|圏 圈|圧 壓|堕 墮|塁 壘|塩 鹽|増 增|壊 壞|壌 壤|壮 壯|声 聲|壱 壹|売 賣|変 變|奥 奧|奨 奬|嬢 孃|学 學|宝 寶|実 實|寛 寬|寝 寢|対 對|寿 壽|専 專|将 將|尭 堯|尽 盡|届 屆|属 屬|岳 嶽|峡 峽|巌 巖|巣 巢|巻 卷|帯 帶|帰 歸|庁 廳|広 廣|廃 廢|弁 辨|弐 貳|弥 彌|弯 彎|弾 彈|当 當|径 徑|従 從|徳 德|徴 徵|応 應|恋 戀|恒 恆|恵 惠|悩 惱|悪 惡|惨 慘|慎 愼|懐 懷|戦 戰|戯 戲|戻 戾|払 拂|抜 拔|択 擇|担 擔|拝 拜|拠 據|拡 擴|挙 擧|挟 挾|挿 插|捜 搜|掲 揭|掻 搔|揺 搖|摂 攝|撃 擊|撹 攪|数 數|斉 齊|斎 齋|断 斷|旧 舊|昼 晝|晃 晄|晩 晚|暁 曉|暦 曆|曽 曾|条 條|来 來|枢 樞|栄 榮|桜 櫻|桝 枡|桟 棧|桧 檜|検 檢|楼 樓|楽 樂|概 槪|様 樣|槙 槇|権 權|横 橫|欠 缺|欧 歐|歓 歡|歩 步|歯 齒|歳 歲|歴 歷|残 殘|殴 毆|殻 殼|毎 每|気 氣|沢 澤|沪 濾|浄 淨|浅 淺|浜 濱|涙 淚|渇 渴|済 濟|渉 涉|渋 澁|渓 溪|温 溫|湾 灣|湿 濕|満 滿|滝 瀧|滞 滯|潜 潛|瀬 瀨|灯 燈|炉 爐|点 點|為 爲|焼 燒|犠 犧|状 狀|独 獨|狭 狹|猟 獵|献 獻|獣 獸|瓶 甁|画 畫|畳 疊|痩 瘦|痴 癡|発 發|盗 盜|県 縣|真 眞|研 硏|砕 碎|礼 禮|祢 禰|祷 禱|禄 祿|禅 禪|秘 祕|称 稱|稲 稻|穂 穗|穏 穩|穣 穰|窃 竊|竜 龍|粋 粹|粛 肅|糸 絲|経 經|絵 繪|継 繼|続 續|総 總|緑 綠|緒 緖|縁 緣|縄 繩|縦 縱|繊 纖|繍 繡|缶 罐|翻 飜|聴 聽|胆 膽|脚 腳|脱 脫|脳 腦|臓 臟|艶 艷|芦 蘆|芸 藝|茎 莖|荘 莊|萌 萠|蒋 蔣|蔵 藏|薫 薰|薬 藥|虚 虛|虫 蟲|蚕 蠶|蛍 螢|蛮 蠻|蝋 蠟|衛 衞|装 裝|褒 襃|覇 霸|覚 覺|覧 覽|観 觀|触 觸|訳 譯|証 證|誉 譽|説 說|読 讀|謡 謠|譲 讓|豊 豐|賛 贊|践 踐|転 轉|軽 輕|辞 辭|辺 邊|逓 遞|遅 遲|遥 遙|郎 郞|郷 鄕|酔 醉|醤 醬|醸 釀|釈 釋|鉄 鐵|鉱 鑛|銭 錢|鋳 鑄|錬 鍊|録 錄|鎮 鎭|関 關|閲 閱|闘 鬭|陥 陷|険 險|随 隨|隠 隱|雑 雜|霊 靈|静 靜|頴 穎|頼 賴|顔 顏|顕 顯|餅 餠|駅 驛|駆 驅|騒 騷|験 驗|髄 髓|髪 髮|鴎 鷗|鶏 鷄|鹸 鹼|麦 麥|麹 麴|麺 麵|黄 黃|黒 黑|黙 默|齢 齡"]]},E={cn:[[v,m]]},N={hk2s:{normalizationChain:[[A]],segmentation:[v],conversionChain:[[f,g],[v,m]]},hk2sp:{normalizationChain:[[A]],segmentation:[v],conversionChain:[[d,f,g],[v,m]]},t2s:{normalizationChain:[[A]],conversionChain:[[v,m]]},tw2s:{normalizationChain:[[A]],segmentation:[v],conversionChain:[[p,h],[v,m]]},tw2sp:{normalizationChain:[[A]],segmentation:[v],conversionChain:[[y,p,h],[v,m]]}};var T=Object.freeze({__proto__:null,configs:N,from:C,to:E});const b=(w=T,function(n){if(["from","to"].forEach(e=>{if(!n||"string"!=typeof n[e])throw new Error("Please provide the `"+e+"` option");if("t"!==n[e]&&!w[e][n[e]])throw new Error("Unknown `"+e+"` locale: "+n[e])}),w.configs){const o=w.configs[t=n.from,r=n.to,"cn"===t?`s2${r}`:"cn"===r?"hkp"===t?"hk2sp":"twp"===t?"tw2sp":`${t}2s`:`${t}2${r}`];if(o){const n=function(n,...t){let r=null;n&&(r=new e,Array.isArray(n)&&n.every(n=>"string"==typeof n)?r.loadDictGroup(n):r.loadDict(n));const o=t.map(n=>{const t=new e;return t.loadDictGroup(n),t});return function(n){const e=r?r.segment(n):[n];return o.reduce((n,e)=>n.map(n=>e.convert(n)),e).join("")}}(o.segmentation,...o.conversionChain);if(!o.normalizationChain)return n;const t=i(...o.normalizationChain);return function(e){return n(t(e))}}}var t,r;let o=[];return["from","to"].forEach(e=>{var t;"t"!==n[e]&&o.push(...(t=w[e][n[e]],Array.isArray(t)&&Array.isArray(t[0])?t:[t]))}),i.apply(null,o)});var w;const L={Trie:e,ConverterFactory:i,Converter:b,CustomConverter:s,HTMLConverter:u,Locale:T};n.Converter=b,n.ConverterFactory=i,n.CustomConverter=s,n.HTMLConverter=u,n.Locale=T,n.Trie=e,n.default=L,Object.defineProperty(n,"__esModule",{value:!0})});

return module.exports.Converter({from:"t",to:"cn"}); }; uiLocale.convert = (text) => (openccConvert ||= buildOpencc())(text); }
// ---- 03-locale-ui.js
// 簡體模式下，建立元素時直接轉換文字，不再替每個元素多包一層元件。
// 語言切換由各掛載點的根元件訂閱一次（useUiLanguage），整棵樹跟著重繪。
const uiConvertCache = new Map();
function uiConvert(value) {
  if (value.length > 200) return uiLocale.convert(value).replaceAll('暱称', '昵称');
  let out = uiConvertCache.get(value);
  if (out === undefined) {
    out = uiLocale.convert(value).replaceAll('暱称', '昵称');
    if (uiConvertCache.size >= 4000) uiConvertCache.clear();
    uiConvertCache.set(value, out);
  }
  return out;
}
const uiTranslate = (value) =>
  typeof value === 'string' ? uiConvert(value) : Array.isArray(value) ? value.map(uiTranslate) : value;
const UI_VERBATIM_TAGS = new Set(['style', 'script', 'textarea', 'pre', 'code']);
const UI_TEXT_PROPS = ['title', 'placeholder', 'aria-label', 'alt'];
const uiCreateElement = (tag, props, ...content) => {
  if (
    typeof tag !== 'string' ||
    uiLocale.get() !== 'zh-Hans' ||
    props?.['data-ui-verbatim'] ||
    UI_VERBATIM_TAGS.has(tag) ||
    /(?:dpl-log|dpl-hist-text)/.test(props?.className || '')
  )
    return UiReact.createElement(tag, props, ...content);
  let next = props;
  for (const key of UI_TEXT_PROPS)
    if (typeof props?.[key] === 'string') {
      if (next === props) next = { ...props };
      next[key] = uiConvert(props[key]);
    }
  return UiReact.createElement(tag, next, ...content.map(uiTranslate));
};
const useUiLanguage = () => UiReact.useSyncExternalStore(uiLocale.subscribe, uiLocale.get, uiLocale.get);
const React = { ...UiReact, createElement: uiCreateElement };
function UiLanguagePicker() {
  const language = UiReact.useSyncExternalStore(uiLocale.subscribe, uiLocale.get, uiLocale.get);
  return UiReact.createElement(
    'label',
    { className: 'dpl-lang' },
    '文 / A',
    UiReact.createElement(
      'select',
      {
        'aria-label': '介面語言 / 界面语言',
        value: language,
        onChange: (event) => uiLocale.set(event.target.value),
      },
      UiReact.createElement('option', { value: 'zh-Hant' }, '繁體中文'),
      UiReact.createElement('option', { value: 'zh-Hans' }, '简体中文'),
    ),
  );
}
// ---- 04-core.js
const h = React.createElement;
const { useState, useEffect, useMemo, useRef } = React;

const API = '/api/discord-cyberfriend';

// 視窗不在前景時略過定時輪詢，避免背景中持續打後端。
const pageHidden = () => typeof document !== 'undefined' && document.hidden === true;

// ------------------------------------------------------------------ utils ---
async function api(path, options) {
  const response = await fetch(`${API}${path}`, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    method: options?.method || 'GET',
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || (payload?.ok === false && !options?.allowFailure)) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

const fmtNum = (value) => (Number.isFinite(Number(value)) ? Number(value).toLocaleString('zh-TW') : '-');
const fmtTime = (iso) => {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('zh-TW', { hour12: false });
};
const fmtAgo = (ms) => {
  const value = Number(ms) || 0;
  if (value <= 0) return '-';
  const seconds = Math.floor(value / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時 ${minutes % 60} 分`;
  return `${Math.floor(hours / 24)} 天`;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// ------------------------------------------------------------------- icons ---
const svg = (props, children) =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: props?.size || 16,
      height: props?.size || 16,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    children,
  );

const Icon = {
  hub: (p) =>
    svg(p, [
      h('circle', { cx: 12, cy: 12, r: 3 }),
      h('path', {
        d: 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1',
      }),
    ]),
  user: (p) =>
    svg(p, [h('circle', { cx: 12, cy: 8, r: 3.6 }), h('path', { d: 'M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5' })]),
  bot: (p) =>
    svg(p, [
      h('rect', { x: 4, y: 7, width: 16, height: 12, rx: 3 }),
      h('path', { d: 'M12 3v4M9 13h.01M15 13h.01M9.5 17h5' }),
    ]),
  reply: (p) =>
    svg(p, [h('path', { d: 'M9 7H7a4 4 0 0 0 0 8h2M15 7h2a4 4 0 0 1 0 8h-2M4 17l3 3M20 20l-3-3' })]),
  chat: (p) =>
    svg(p, [
      h('path', { d: 'M20 15a3 3 0 0 1-3 3H9l-4 3v-4a3 3 0 0 1-1-2V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z' }),
    ]),
  reaction: (p) =>
    svg(p, [
      h('circle', { cx: 12, cy: 12, r: 9 }),
      h('path', { d: 'M9 10h.01M15 10h.01M8.5 14.5a4.5 4.5 0 0 0 7 0' }),
    ]),
  gif: (p) =>
    svg(p, [
      h('rect', { x: 3, y: 5, width: 18, height: 14, rx: 3 }),
      h('path', { d: 'M8 10v4M8 12h2M12 10v4M15 14v-4h2' }),
    ]),
  history: (p) =>
    svg(p, [h('path', { d: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5' }), h('path', { d: 'M12 8v4l3 2' })]),
  log: (p) => svg(p, [h('path', { d: 'M5 4h9l5 5v11H5z' }), h('path', { d: 'M14 4v5h5M8 13h8M8 17h5' })]),
  model: (p) =>
    svg(p, [
      h('path', { d: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z' }),
      h('path', { d: 'M12 12l8-4.5M12 12v9M12 12L4 7.5' }),
    ]),
  prompt: (p) => svg(p, [h('path', { d: 'M4 6h16M4 12h10M4 18h13' })]),
  advanced: (p) =>
    svg(p, [
      h('path', { d: 'M4 7h10M18 7h2M4 17h2M10 17h10' }),
      h('circle', { cx: 16, cy: 7, r: 2 }),
      h('circle', { cx: 8, cy: 17, r: 2 }),
    ]),
  settings: (p) =>
    svg(p, [
      h('circle', { cx: 12, cy: 12, r: 3 }),
      h('path', {
        d: 'M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
      }),
    ]),
  check: (p) => svg(p, [h('path', { d: 'M20 6L9 17l-5-5' })]),
  refresh: (p) => svg(p, [h('path', { d: 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5' })]),
  save: (p) =>
    svg(p, [
      h('path', { d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' }),
      h('path', { d: 'M7 3v6h8V3M7 21v-6h10v6' }),
    ]),
  power: (p) => svg(p, [h('path', { d: 'M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0' })]),
  play: (p) => svg(p, [h('path', { d: 'M7 4l13 8-13 8z' })]),
  trash: (p) => svg(p, [h('path', { d: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13' })]),
  bolt: (p) => svg(p, [h('path', { d: 'M13 2L4 14h6l-1 8 9-12h-6z' })]),
  warn: (p) => svg(p, [h('path', { d: 'M12 3l9 17H3zM12 9v5M12 17h.01' })]),
  image: (p) =>
    svg(p, [
      h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
      h('circle', { cx: 9, cy: 10, r: 1.6 }),
      h('path', { d: 'M4 18l5-5 4 4 3-3 4 4' }),
    ]),
  send: (p) => svg(p, [h('path', { d: 'M22 2L11 13M22 2l-7 20-4-9-9-4z' })]),
};
const iconFor = (key) => Icon[key] || Icon.settings;

// --------------------------------------------------------------------- css ---

Icon.voice = (p) =>
  svg(p, [
    h('rect', { x: 9, y: 3, width: 6, height: 11, rx: 3 }),
    h('path', { d: 'M5 11a7 7 0 0 0 14 0M12 18v3' }),
  ]);
Icon.eye = (p) =>
  svg(p, [
    h('path', { d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z' }),
    h('circle', { cx: 12, cy: 12, r: 3 }),
  ]);
Icon.eyeOff = (p) =>
  svg(p, [
    h('path', {
      d: 'M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.6A16.6 16.6 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 4.2-.9',
    }),
  ]);
Icon.search = (p) => svg(p, [h('circle', { cx: 11, cy: 11, r: 7 }), h('path', { d: 'M20 20l-3.5-3.5' })]);
Icon.arrow = (p) => svg(p, [h('path', { d: 'M5 12h14M13 6l6 6-6 6' })]);
// ---- 05-styles.js
// 樣式內容在 styles.css，建置時嵌入為 CSS 常數。
let styleInjected = false;
function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (styleInjected && document.querySelector('style[data-plugin-css="dsh-discord-cyberfriend"]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-plugin-css', 'dsh-discord-cyberfriend');
  style.textContent = CSS;
  document.head.appendChild(style);
  styleInjected = true;
}
// ---- 06-controls.js
function Pill({ tone, children, dot }) {
  return h(
    'span',
    { className: 'dpl-pill', 'data-tone': tone || 'muted' },
    dot ? h('span', { className: 'dpl-dot' }) : null,
    children,
  );
}

function Card({ title, desc, icon, actions, children }) {
  const head = title
    ? h(
        'header',
        { className: 'dpl-card-head' },
        h(
          'div',
          null,
          h('div', { className: 'dpl-card-title' }, icon ? iconFor(icon)({ size: 15 }) : null, title),
          desc ? h('p', { className: 'dpl-card-desc' }, desc) : null,
        ),
        actions ? h('div', { className: 'dpl-actions' }, actions) : null,
      )
    : null;
  return h('section', { className: 'dpl-card' }, head, h('div', { className: 'dpl-card-body' }, children));
}

function Switch({ checked, onChange, disabled, label }) {
  return h('button', {
    'aria-label': label || undefined,
    type: 'button',
    className: 'dpl-switch',
    'data-on': checked ? 'true' : 'false',
    'aria-checked': checked ? 'true' : 'false',
    role: 'switch',
    disabled: Boolean(disabled),
    onClick: () => !disabled && onChange(!checked),
  });
}

function Segmented({ options, value, onChange, disabled }) {
  return h(
    'div',
    { className: 'dpl-seg' },
    (options || []).map((option) =>
      h(
        'button',
        {
          key: String(option.value),
          type: 'button',
          'data-on': String(option.value) === String(value) ? 'true' : 'false',
          disabled: Boolean(disabled),
          onClick: () => onChange(option.value),
        },
        option.label ?? String(option.value),
      ),
    ),
  );
}

function TagsInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const list = Array.isArray(value) ? value : [];
  const add = (raw) => {
    const items = String(raw || '')
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!items.length) return;
    const next = [...list];
    for (const item of items) if (!next.includes(item)) next.push(item);
    onChange(next);
    setDraft('');
  };
  // 知道名稱的 ID 直接顯示名稱（滑鼠移上去可看到完整 ID）；同名的才在後面補 ID 末四碼區分。
  const labels = list.map((item) => (uiRuntime.names.has(String(item)) ? uiRuntime.names.get(String(item)) : null));
  const labelOf = (item, index) =>
    labels[index] === null
      ? item
      : labels.filter((label) => label === labels[index]).length > 1
        ? labels[index] + ' · ' + String(item).slice(-4)
        : labels[index];
  return h(
    'div',
    { className: 'dpl-tags' },
    list.map((item, index) =>
      h(
        'span',
        { key: item, className: 'dpl-tag', title: labels[index] === null ? item : 'ID：' + item, 'data-named': labels[index] === null ? 'false' : 'true' },
        CUSTOM_EMOJI.test(String(item)) ? emojiView(item, 18) : labelOf(item, index),
        h(
          'button',
          { type: 'button', title: '移除', onClick: () => onChange(list.filter((entry) => entry !== item)) },
          'x',
        ),
      ),
    ),
    h('input', {
      value: draft,
      placeholder: list.length ? '' : placeholder || '輸入後按 Enter',
      onChange: (event) => setDraft(event.target.value),
      onKeyDown: (event) => {
        if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
          event.preventDefault();
          add(draft);
        } else if (event.key === 'Backspace' && !draft && list.length) {
          onChange(list.slice(0, -1));
        }
      },
      onBlur: () => add(draft),
    }),
  );
}

function RangeInput({ value, min, max, step, onChange, suffix }) {
  const current = Number(value) || 0;
  return h(
    'div',
    { className: 'dpl-range' },
    h('input', {
      type: 'range',
      min: min ?? 0,
      max: max ?? 100,
      step: step ?? 1,
      value: current,
      onChange: (event) => onChange(Number(event.target.value)),
    }),
    h('span', { className: 'dpl-range-value' }, `${current}${suffix || ''}`),
  );
}

function TextArea({ value, onChange, rows, placeholder }) {
  const text = String(value ?? '');
  return h(
    'div',
    { style: { width: '100%' } },
    h('textarea', {
      className: 'dpl-textarea',
      rows: rows || 4,
      value: text,
      placeholder: placeholder || '',
      onChange: (event) => onChange(event.target.value),
    }),
    h('div', { className: 'dpl-foot' }, h('span', null, `${text.length} 字`)),
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);
  return h(
    'div',
    { className: 'dpl-input-wrap' },
    h('input', {
      className: 'dpl-input',
      type: visible ? 'text' : 'password',
      value: value ?? '',
      placeholder: placeholder || '',
      'data-mono': 'true',
      autoComplete: 'off',
      spellCheck: false,
      onChange: (event) => onChange(event.target.value),
    }),
    h(
      'button',
      {
        type: 'button',
        className: 'dpl-eye',
        title: visible ? '隱藏' : '顯示',
        onClick: () => setVisible(!visible),
      },
      visible ? Icon.eyeOff({ size: 14 }) : Icon.eye({ size: 14 }),
    ),
  );
}

// 數字欄：清空時不送出空字串（後端會靜默還原成預設值），改為標示並在離開欄位時復原。
function NumberInput({ value, min, max, step, onChange }) {
  const [text, setText] = useState(null);
  const shown = text !== null ? text : Number.isFinite(Number(value)) ? String(Number(value)) : '';
  const invalid = text !== null && (text.trim() === '' || !Number.isFinite(Number(text)));
  return h('input', {
    className: 'dpl-input',
    type: 'number',
    style: { width: 108 },
    value: shown,
    min,
    max,
    step: step || 1,
    'data-invalid': invalid ? 'true' : 'false',
    title: invalid ? '請輸入數字；留空不會變更設定' : undefined,
    onChange: (event) => {
      const raw = event.target.value;
      setText(raw);
      if (raw.trim() !== '' && Number.isFinite(Number(raw))) onChange(Number(raw));
    },
    onBlur: () => setText(null),
  });
}

// 統一的狀態區塊：載入中／沒有資料／查詢失敗／功能或權限未開啟。
// kind: 'loading' | 'empty' | 'error' | 'off'
// 讀取一份後端資料：回傳 { kind: 'loading' | 'ready' | 'error', data, error, reload }。
// 重新讀取時保留上一次的資料，畫面不會閃回空白；元件卸載後不再更新狀態。
function useLoad(loader, deps = []) {
  const [state, setState] = useState({ kind: 'loading', data: null, error: '' });
  const alive = useRef(true);
  const reload = async () => {
    setState((previous) => ({ ...previous, kind: 'loading', error: '' }));
    try {
      const data = await loader();
      if (alive.current) setState({ kind: 'ready', data, error: '' });
    } catch (error) {
      if (alive.current) setState((previous) => ({ kind: 'error', data: previous.data, error: error.message }));
    }
  };
  useEffect(() => {
    alive.current = true;
    reload();
    return () => {
      alive.current = false;
    };
  }, deps);
  return { ...state, reload };
}

function StateView({ kind, title, children, action }) {
  return h(
    'div',
    { className: 'dpl-state', 'data-kind': kind, role: kind === 'error' ? 'alert' : 'status' },
    kind === 'loading' ? h('span', { className: 'dpl-spinner', 'aria-hidden': 'true' }) : null,
    h('div', { className: 'dpl-state-title' }, title || (kind === 'loading' ? '載入中…' : '')),
    children ? h('div', { className: 'dpl-state-body' }, children) : null,
    action || null,
  );
}

// ---------------------------------------------------------------- field rows ---
function FieldRow({ field, value, onChange, dirty, config, inactive }) {
  const change = onChange;
  onChange = (v) => {
    if (!inactive) change(v);
  };
  const transportBadge =
    field.transport === field.section
      ? null
      : field.transport === 'user'
        ? h('span', { className: 'dpl-badge dpl-badge-user' }, '使用者')
        : field.transport === 'bot'
          ? h('span', { className: 'dpl-badge dpl-badge-bot' }, '機器人')
          : null;
  const label = h(
    'div',
    { className: 'dpl-row-label' },
    field.label || field.key,
    transportBadge,
    dirty ? h('span', { className: 'dpl-badge dpl-badge-dirty' }, '未儲存') : null,
  );
  const main = h(
    'div',
    { className: 'dpl-row-main' },
    label,
    field.help ? h('div', { className: 'dpl-row-help' }, field.help) : null,
    inactive ? h('div', { className: 'dpl-row-help', role: 'note' }, '暫不生效：' + inactive) : null,
  );

  if (field.type === 'boolean') {
    return h(
      'div',
      { className: 'dpl-row', 'data-type': 'boolean' },
      main,
      h(
        'fieldset',
        { className: 'dpl-row-control dpl-fieldset', disabled: !!inactive },
        h(Switch, { checked: Boolean(value), onChange }),
      ),
    );
  }

  let control;
  if (field.type === 'password') {
    const isSet = Boolean(config?.[`${field.key}__set`]);
    control = h(PasswordInput, {
      value: value ?? '',
      onChange,
      placeholder: isSet ? '******** 已儲存（留空代表不變更）' : '尚未設定',
    });
  } else if (field.type === 'select') {
    const options = field.options || [];
    control =
      options.length <= 3
        ? h(Segmented, { options, value, onChange })
        : h(
            'div',
            { style: { minWidth: 190 } },
            h(
              'select',
              {
                className: 'dpl-select',
                value: String(value ?? ''),
                onChange: (event) => onChange(event.target.value),
              },
              options.map((option) =>
                h(
                  'option',
                  { key: String(option.value), value: option.value },
                  option.label ?? String(option.value),
                ),
              ),
            ),
          );
  } else if (field.type === 'tags') {
    const pickerKind = pickerKindFor(field.key);
    control = isEmojiListField(field.key)
      ? h(
          'div',
          { className: 'dpl-picker-wrap' },
          h(TagsInput, { value, onChange, placeholder: '輸入表情後按 Enter，或從下方看圖選擇' }),
          h(EmojiPicker, { value, onChange }),
        )
      : pickerKind
      ? h(
          'div',
          { className: 'dpl-picker-wrap' },
          h(TagsInput, { value, onChange, placeholder: '輸入 ID 後按 Enter，或從下方清單選擇' }),
          h(IdPicker, { kind: pickerKind, value, onChange }),
        )
      : h(TagsInput, { value, onChange, placeholder: field.placeholder });
  } else if (field.type === 'textarea') {
    control = h(TextArea, { value, onChange, rows: field.rows || 4, placeholder: field.placeholder });
  } else if (field.type === 'range') {
    control = h(RangeInput, {
      value,
      min: field.min,
      max: field.max,
      step: field.step,
      onChange,
      suffix: field.unit || '',
    });
  } else if (field.type === 'number') {
    control = h(NumberInput, { value, min: field.min, max: field.max, step: field.step, onChange });
  } else {
    // 有建議值的欄位：可以從清單挑，也可以自行輸入。模型服務另外併入宿主實際可用的清單。
    const suggestions = [
      ...(field.key === 'subscriptionProvider' ? uiRuntime.providers.map((item) => item.id) : []),
      ...(field.suggestions || []),
    ].filter((item, index, all) => item && all.indexOf(item) === index);
    const listId = suggestions.length ? 'dpl-suggest-' + field.key : undefined;
    control = h(
      'div',
      { style: { minWidth: 200, display: 'flex' } },
      h('input', {
        className: 'dpl-input',
        type: 'text',
        value: value ?? '',
        list: listId,
        placeholder: field.placeholder || (suggestions.length ? '可從清單選擇或自行輸入' : ''),
        'data-mono': field.mono ? 'true' : 'false',
        spellCheck: false,
        onChange: (event) => onChange(event.target.value),
      }),
      listId
        ? h(
            'datalist',
            { id: listId },
            suggestions.map((item) => h('option', { key: item, value: item })),
          )
        : null,
    );
  }

  return h(
    'div',
    { className: 'dpl-row', 'data-type': field.type },
    main,
    h('fieldset', { className: 'dpl-row-control dpl-fieldset', disabled: !!inactive }, control),
  );
}

// 各分區的欄位分組：[標題, 比對設定鍵的規則, 預設是否收合]。依序比對，第一個符合者勝出。
const AUDIENCE_FIELD_GROUPS = [
  [
    '回覆與接話',
    /^(replyDeliveryMode|dmReplyEnabled|mentionReplyEnabled|followup.*|coChat.*|interestKeywords|monitoredChannelIds)$/,
  ],
  ['人格與文字風格', /^(.*Persona.*|plugin.*|antiAiFlavor.*|stripMarkdown|replyChineseScript)$/, true],
  [
    '圖片、GIF 與反應',
    /^(gif.*|imageVision.*|emojiVision.*|autoReaction.*|sticker.*|memeImagesEnabled)$/,
    true,
  ],
  ['可用工具', /^(musicControlEnabled|knowledgeLookupEnabled|webLookupEnabled|memeLookupEnabled)$/, true],
  ['節奏與上下文', /.*/, true],
];
const FIELD_GROUPS = {
  user: [
    [
      '接收與回覆',
      /^(userReceiveOnly|userAutoReply|userWatchDms|userChannelIds|userInboxEnabled|userAutoTakeover.*|userSimulateTyping)$/,
    ],
    ['討論串', /^(userAutoCreateThreads|userThread.*)$/, true],
    ['連線', /.*/, true],
  ],
  bot: [
    ['互動功能', /^(botNativeInteractions|botSlashCommands|botEmbedReplies)$/],
    ['討論串', /^(botAutoCreateThreads|botThread.*)$/, true],
    ['連線與權限', /.*/],
  ],
  reply: [
    [
      '誰可以觸發回覆',
      /^(replyIgnoreSelf|replyToBots|whitelistUserIds|blacklistUserIds|monitoredGuildIds|blacklistChannelIds|replyCooldownExemptUserIds|replyOwnership)$/,
    ],
    ['回覆上限', /^(max.*|roundResetMinutes)$/],
    ['訊息合併', /^messageCoalesce.*/],
  ],
  reaction: [
    ['表情反應', /^(reactionControlUserIds|autoReaction.*|reactionCommand.*|reactionIntelEnabled)$/],
    ['表情圖片與貼圖', /.*/],
  ],
  llm: [
    ['模型來源', /^(llmMode|subscription.*|customLlm.*)$/],
    ['回覆生成', /^(maxReplyTokens|temperature)$/],
    ['圖片理解', /.*/],
  ],
  memoryOutput: [
    ['人格日記', /^memoryDiary.*/],
    ['記憶輸出', /.*/],
  ],
  culture: [
    ['辨識快取', /^mediaPerception.*/],
    ['學習與重用', /^(cultureLearningEnabled|cultureReuseEnabled)$/],
    ['群聊接龍', /.*/],
  ],
  companion: [
    ['主動關心', /^proactive.*/],
    ['話題與延後回覆', /^(conversationControlEnabled|pendingTopics.*)$/],
    ['安靜時段', /.*/],
  ],
  history: [
    ['查詢與成員名稱', /^(channelLookupEnabled|memberNameUpdatesEnabled)$/],
    ['聊天快取', /.*/],
  ],
  gif: [
    ['搜尋來源', /^(gifProvider|gifCustomEndpoint|gifMaxResults|language|gifSendAsReply)$/],
    ['誰可以用', /^gifAccess.*/],
    ['GIF 與影片理解', /.*/],
  ],
  advanced: [
    ['執行', /^(maxConcurrentReplies|dryRun|statusRefreshSeconds)$/],
    ['Token 預算', /.*/],
  ],
  voice: [
    [
      '基本與權限',
      /^(voiceEnabled|voiceAllowedChannelIds|voiceIdleMinutes|voiceMaxSessionMinutes|voiceAutoSpeak|voiceVolume)$/,
    ],
    [
      '朗讀與音色',
      /^(voiceTts(Voice|Adapter|Service|BaseUrl|Options)|voiceMaxSpeechSeconds|voiceMaxTextChars|voiceDailyCharacterLimit|voiceStreaming|voiceIncrementalReplies|voiceSpokenLanguage|voiceJapanese.*|voiceEmotion.*|voiceFixedEmotion|voiceSpeechInstruction|voiceReplayEnabled|voiceSubtitles)$/,
      true,
    ],
    [
      '收聽與語音輸入',
      /^(voiceReceive.*|voiceReplyTextEnabled|voiceInterrupt.*|voiceInput.*|voiceStt(DailySeconds|Provider|Language)|voiceTranscript.*)$/,
      true,
    ],
    ['語音訊息', /^voiceMessage.*/, true],
    ['音樂', /^(voiceMusic.*|voiceMaxMusicMinutes)$/, true],
    ['用量與成本估算', /.*/, true],
  ],
};

function FieldList({ fields, config, draft, setValue, dirtyKeys, flat }) {
  const row = (field) =>
    h(FieldRow, {
      key: field.key,
      field,
      config,
      inactive: (field.enabledWhen || [])
        .filter((c) => !c.values.includes(draft[c.key]))
        .map((c) => c.reason)
        .join('；'),
      dirty: dirtyKeys.includes(field.key),
      value: draft[field.key],
      onChange: (value) => setValue(field.key, value),
    });
  // 搜尋結果等混合來源一律平鋪，不套用分區分組。
  const sectionId =
    fields.length && fields.every((f) => f.section === fields[0].section) ? fields[0].section : '';
  const audience = /^(adminDm|adminGroup|othersDm|othersGroup)$/.test(sectionId);
  const groups = flat ? null : audience ? AUDIENCE_FIELD_GROUPS : FIELD_GROUPS[sectionId];
  if (!groups) return fields.map(row);
  const baseKey = (f) => (audience ? f.key.slice(sectionId.length + 1) : f.key);
  const remaining = new Set(fields);
  return groups.map(([title, pattern, collapsed]) => {
    const rows = fields.filter((f) => remaining.has(f) && pattern.test(baseKey(f)));
    rows.forEach((f) => remaining.delete(f));
    if (!rows.length) return null;
    const changed = rows.some((f) => dirtyKeys.includes(f.key));
    return h(
      'details',
      {
        key: sectionId + ':' + title,
        className: 'dpl-field-group',
        open: !collapsed || changed || undefined,
      },
      h(
        'summary',
        { className: 'dpl-subhead' },
        title,
        h('span', { className: 'dpl-badge' }, rows.length + ' 項'),
      ),
      rows.map(row),
    );
  });
}

// ------------------------------------------------------------ transport card ---
// ---- 07-pickers.js
// 從已連線帳號的伺服器與頻道清單挑選 ID，取代手動複製貼上。
//
// uiRuntime 由主面板每次繪製時更新：目前已連線的帳號、已知的 ID→名稱對照、
// 宿主可用的模型服務。它只是顯示用的快取，不會被儲存。
const uiRuntime = { kinds: [], names: new Map(), providers: [] };

// 設定裡存的是 ID；畫面上盡量顯示名稱。查不到名稱時顯示 ID 本身。
const nameOfId = (id) => uiRuntime.names.get(String(id)) || String(id);
const looksLikeId = (value) => typeof value === 'string' && /^\d{17,20}$/.test(value);
// 畫面要顯示某些 ID 時呼叫：還不認得的 ID 向後端查一次名稱（只查本機快取），查到後重繪。
const askedIdNames = new Set();
function useIdNames(ids) {
  const [, bump] = useState(0);
  const key = [...new Set((ids || []).map(String).filter(looksLikeId))].sort().join(',');
  useEffect(() => {
    const unknown = key.split(',').filter((id) => id && !uiRuntime.names.has(id) && !askedIdNames.has(id));
    if (!unknown.length) return undefined;
    for (const id of unknown) askedIdNames.add(id);
    let alive = true;
    api('/names', { method: 'POST', body: { ids: unknown.slice(0, 500) } })
      .then((payload) => {
        let added = 0;
        for (const [id, name] of Object.entries(payload.names || {}))
          if (name) {
            uiRuntime.names.set(id, name);
            added += 1;
          }
        if (added && alive) bump((n) => n + 1);
      })
      .catch(() => {
        // 查不到名稱時維持顯示 ID，不影響其他功能。
      });
    return () => {
      alive = false;
    };
  }, [key]);
}
// 從設定值裡找出所有像 Discord ID 的字串（清單欄位與單一欄位）。
function collectIds(...sources) {
  const found = new Set();
  for (const source of sources)
    for (const value of Object.values(source || {})) {
      if (looksLikeId(value)) found.add(value);
      else if (Array.isArray(value)) for (const item of value) if (looksLikeId(item)) found.add(item);
    }
  return [...found];
}

const isVoiceChannel = (channel) => ['2', '13', 'voice', 'stage'].includes(String(channel.type));
const isCategory = (channel) => ['4', 'category'].includes(String(channel.type));
const channelPrefix = (channel) =>
  isVoiceChannel(channel)
    ? '🔊 '
    : ['15', '16', 'forum', 'media'].includes(String(channel.type))
      ? '💬 '
      : '# ';

// 哪些設定欄位可以用清單挑選：頻道 ID、伺服器 ID，以及使用者 ID（來源是「最近說過話的人」）。
function pickerKindFor(fieldKey) {
  const base = String(fieldKey).replace(/^(adminDm|adminGroup|othersDm|othersGroup)_/, '');
  if (/UserIds$/.test(base)) return 'user';
  if (/GuildIds$/.test(base)) return 'guild';
  if (/ChannelIds$/.test(base) || base === 'channelForwardDestinationIds')
    return /^voiceAllowed/.test(base) ? 'voice' : 'channel';
  return '';
}

// 使用者 ID：從聊天快取裡最近說過話的人挑選。不需要帳號連線，但要有收過訊息。
function UserIdPicker({ value, onChange, single }) {
  const list = Array.isArray(value) ? value : value ? [String(value)] : [];
  const [open, setOpen] = useState(false);
  const [authors, setAuthors] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const load = async () => {
    setError('');
    setAuthors(null);
    try {
      const rows = (await api('/recent-authors')).authors || [];
      for (const row of rows) uiRuntime.names.set(String(row.id), row.name);
      setAuthors(rows);
    } catch (err) {
      setAuthors([]);
      setError(err.message);
    }
  };
  if (!open)
    return h(
      'button',
      {
        type: 'button',
        className: 'dpl-btn dpl-btn-sm',
        'data-picker': 'user',
        onClick: () => {
          setOpen(true);
          load();
        },
      },
      '從最近說過話的人選擇',
    );
  const needle = query.trim().toLowerCase();
  const shown = (authors || []).filter(
    (row) => !needle || row.name.toLowerCase().includes(needle) || row.id.includes(needle),
  );
  const toggle = (id) => {
    if (single) return onChange(list.includes(id) ? '' : id);
    onChange(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };
  return h(
    'div',
    { className: 'dpl-picker', 'data-picker-open': 'user' },
    h(
      'div',
      { className: 'dpl-actions' },
      h('input', {
        className: 'dpl-input',
        type: 'search',
        'aria-label': '搜尋名稱或 ID',
        placeholder: '搜尋名稱或 ID',
        value: query,
        onChange: (event) => setQuery(event.target.value),
      }),
      h('button', { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: load }, '重新整理'),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-ghost', onClick: () => setOpen(false) },
        '收合',
      ),
    ),
    error
      ? h('div', { className: 'dpl-note', 'data-tone': 'err', role: 'alert' }, '讀取清單失敗：' + error)
      : null,
    authors === null
      ? h('div', { className: 'dpl-row-help', role: 'status' }, '讀取中…')
      : shown.length
        ? h(
            'div',
            { className: 'dpl-actions' },
            shown.map((row) =>
              h(
                'button',
                {
                  key: row.id,
                  type: 'button',
                  className: 'dpl-btn dpl-btn-sm',
                  'data-on': list.includes(row.id),
                  'aria-pressed': list.includes(row.id),
                  title: row.id,
                  onClick: () => toggle(row.id),
                },
                row.name,
              ),
            ),
          )
        : h(
            'div',
            { className: 'dpl-row-help' },
            authors.length
              ? '沒有符合搜尋的人。'
              : '聊天快取裡還沒有其他人的訊息。帳號連線並收到訊息後，這裡會列出最近說過話的人；也可以直接手動填 ID。',
          ),
    h(
      'div',
      { className: 'dpl-row-help' },
      '清單來自本機的聊天快取，只包含這個插件收過訊息的人。點一下加入，再點一次移除。',
    ),
  );
}

function IdPicker({ kind, value, onChange }) {
  if (kind === 'user') return h(UserIdPicker, { value, onChange });
  return h(GuildChannelPicker, { kind, value, onChange });
}

function GuildChannelPicker({ kind, value, onChange }) {
  const list = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(false);
  const [transport, setTransport] = useState('');
  const [guilds, setGuilds] = useState([]);
  const [guildId, setGuildId] = useState('');
  const [channels, setChannels] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const kinds = uiRuntime.kinds;
  const active = kinds.includes(transport) ? transport : kinds[0] || '';

  const loadGuilds = async (which) => {
    setLoading(true);
    setError('');
    try {
      const payload = await api('/guilds?transport=' + encodeURIComponent(which));
      const rows = payload.guilds || [];
      for (const guild of rows) uiRuntime.names.set(String(guild.id), guild.name);
      setGuilds(rows);
    } catch (err) {
      setGuilds([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const loadChannels = async (which, guild) => {
    setChannels(null);
    if (!guild) return;
    setLoading(true);
    setError('');
    try {
      const payload = await api('/channels?' + new URLSearchParams({ transport: which, guildId: guild, ...(kind === 'voice' ? { includeVoice: '1' } : {}) }));
      const rows = (payload.channels || []).filter((channel) => !isCategory(channel));
      for (const channel of rows) uiRuntime.names.set(String(channel.id), channel.name);
      setChannels(rows);
    } catch (err) {
      setChannels([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const toggle = (id) => {
    const key = String(id);
    onChange(list.includes(key) ? list.filter((item) => item !== key) : [...list, key]);
  };

  if (!kinds.length)
    return h(
      'span',
      { className: 'dpl-row-help' },
      '帳號連線後，可以直接從伺服器清單挑選，不必手動複製 ID。',
    );
  if (!open)
    return h(
      'button',
      {
        type: 'button',
        className: 'dpl-btn dpl-btn-sm',
        'data-picker': kind,
        onClick: () => {
          setOpen(true);
          loadGuilds(active);
        },
      },
      kind === 'guild' ? '從伺服器清單選擇' : '從頻道清單選擇',
    );

  const shown = (channels || []).filter((channel) => (kind === 'voice' ? isVoiceChannel(channel) : true));
  const chip = (id, label) =>
    h(
      'button',
      {
        key: id,
        type: 'button',
        className: 'dpl-btn dpl-btn-sm',
        'data-on': list.includes(String(id)),
        'aria-pressed': list.includes(String(id)),
        title: String(id),
        onClick: () => toggle(id),
      },
      label,
    );
  return h(
    'div',
    { className: 'dpl-picker', 'data-picker-open': kind },
    h(
      'div',
      { className: 'dpl-actions' },
      kinds.length > 1
        ? h(
            'div',
            { className: 'dpl-seg', role: 'group', 'aria-label': '使用哪個帳號的清單' },
            kinds.map((which) =>
              h(
                'button',
                {
                  key: which,
                  type: 'button',
                  'data-on': active === which,
                  'aria-pressed': active === which,
                  onClick: () => {
                    setTransport(which);
                    setGuildId('');
                    setChannels(null);
                    loadGuilds(which);
                  },
                },
                which === 'bot' ? '機器人' : '使用者帳號',
              ),
            ),
          )
        : null,
      kind === 'guild'
        ? null
        : h(
            'select',
            {
              className: 'dpl-select',
              'aria-label': '伺服器',
              value: guildId,
              onChange: (event) => {
                setGuildId(event.target.value);
                loadChannels(active, event.target.value);
              },
            },
            [
              h('option', { key: '', value: '' }, guilds.length ? '選擇伺服器' : '沒有可用的伺服器'),
              ...guilds.map((guild) => h('option', { key: guild.id, value: guild.id }, guild.name)),
            ],
          ),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-ghost', onClick: () => setOpen(false) },
        '收合',
      ),
    ),
    loading ? h('div', { className: 'dpl-row-help', role: 'status' }, '讀取中…') : null,
    error
      ? h('div', { className: 'dpl-note', 'data-tone': 'err', role: 'alert' }, '讀取清單失敗：' + error)
      : null,
    kind === 'guild'
      ? h(
          'div',
          { className: 'dpl-actions' },
          guilds.map((guild) => chip(guild.id, guild.name)),
        )
      : channels === null
        ? guildId
          ? null
          : h('div', { className: 'dpl-row-help' }, '先選擇伺服器，再點選要加入的頻道；再點一次可移除。')
        : shown.length
          ? h(
              'div',
              { className: 'dpl-actions' },
              shown.map((channel) => chip(channel.id, channelPrefix(channel) + channel.name)),
            )
          : h(
              'div',
              { className: 'dpl-row-help' },
              kind === 'voice' ? '這個伺服器沒有可見的語音頻道。' : '這個伺服器沒有可見的頻道。',
            ),
  );
}
// ---- 08-emoji-picker.js
// 表情選擇器：看圖點選，不必手動輸入表情或複製自訂表情代碼。
//
// 設定裡存的仍是文字：一般表情存字元本身，伺服器自訂表情存 Discord 的代碼 <:名稱:ID>（動態為 <a:名稱:ID>）。

// 「常用」分類：挑出最常拿來按反應的表情。完整清單（約 1,700 個，依類別分組）在 08a-emoji-data.js，
// 由 scripts/gen-emoji-data.mjs 產生。
const COMMON_EMOJI_GROUPS = [
  ['常用反應', '👍 👎 ❤️ 🔥 😂 🤣 😭 😮 😡 🙏 👏 🎉 💯 ✅ ❌ 👀 🤔 🫡 🤝 💀'],
  ['開心與喜歡', '😀 😄 😁 😆 😊 🥰 😍 😘 🤩 🥳 😎 🤗 😋 😜 🤪 😇 🙂 😉 😌 🥹'],
  ['難過與驚訝', '😢 😥 😞 😔 😩 😫 🥺 😱 😨 😳 🤯 😵 😬 🙄 😤 😠 🤬 😐 😑 😶'],
  ['手勢', '👌 ✌️ 🤞 🤟 🤘 👋 🙌 🫶 💪 🤙 👉 👈 👆 👇 ✋ 🤚 🫰 🤏 ✍️ 🫵'],
  ['符號', '💖 💕 💔 ⭐ 🌟 ✨ ⚡ 💤 💢 💬 ❓ ❗ ⁉️ ➕ ➖ 🔁 ⏹️ 🔍 🆗 🆒'],
  ['動物與食物', '🐱 🐶 🐟 🐧 🐸 🐼 🐰 🦊 🐻 🐷 🍰 🍣 🍜 🍺 ☕ 🍵 🍕 🍔 🍙 🧋'],
  ['活動與物品', '🎮 🎵 🎶 🎤 🎧 📷 💻 📱 📚 ✏️ 🎁 🏆 🥇 ⚽ 🎯 🚀 🌈 ☀️ 🌙 ☔'],
].map(([name, list]) => [name, list.split(' ')]);

const CUSTOM_EMOJI = /^<(a?):(\w+):(\d+)>$/;
// 把設定裡的表情文字畫出來：自訂表情顯示圖片，其餘直接顯示字元。
function emojiView(code, size = 20) {
  const custom = CUSTOM_EMOJI.exec(String(code));
  if (!custom) return String(code);
  return h('img', {
    src: 'https://cdn.discordapp.com/emojis/' + custom[3] + '.' + (custom[1] ? 'gif' : 'webp') + '?size=48',
    alt: ':' + custom[2] + ':',
    title: ':' + custom[2] + ':',
    width: size,
    height: size,
    loading: 'lazy',
    style: { verticalAlign: 'middle' },
  });
}

// 哪些欄位是「表情清單」：自動加表情的表情池、觸發指令的表情（含各對象的同名欄位）。
function isEmojiListField(fieldKey) {
  return /Emojis$/.test(String(fieldKey).replace(/^(adminDm|adminGroup|othersDm|othersGroup)_/, ''));
}

function EmojiPicker({ value, onChange }) {
  const list = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('common');
  // 一般表情一次只顯示一個分類，避免一口氣畫出上千個按鈕。
  const [group, setGroup] = useState('常用');
  const emojiGroups = [['常用', COMMON_EMOJI_GROUPS.flatMap(([, items]) => items)], ...ALL_EMOJI_GROUPS];
  const [transport, setTransport] = useState('');
  const [guilds, setGuilds] = useState([]);
  const [guildId, setGuildId] = useState('');
  const [emojis, setEmojis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const kinds = uiRuntime.kinds;
  const active = kinds.includes(transport) ? transport : kinds[0] || '';
  const toggle = (code) => onChange(list.includes(code) ? list.filter((item) => item !== code) : [...list, code]);

  const loadGuilds = async (which) => {
    setLoading(true);
    setError('');
    try {
      const rows = (await api('/guilds?transport=' + encodeURIComponent(which))).guilds || [];
      for (const guild of rows) uiRuntime.names.set(String(guild.id), guild.name);
      setGuilds(rows);
    } catch (err) {
      setGuilds([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const loadEmojis = async (which, guild) => {
    setEmojis(null);
    if (!guild) return;
    setLoading(true);
    setError('');
    try {
      setEmojis((await api('/emojis?' + new URLSearchParams({ transport: which, guildId: guild }))).emojis || []);
    } catch (err) {
      setEmojis([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const cell = (code, label, disabled) =>
    h(
      'button',
      {
        key: code,
        type: 'button',
        className: 'dpl-emoji-cell',
        'data-on': list.includes(code),
        'aria-pressed': list.includes(code),
        'aria-label': label,
        title: label,
        disabled,
        onClick: () => toggle(code),
      },
      emojiView(code, 24),
    );

  if (!open)
    return h(
      'button',
      { type: 'button', className: 'dpl-btn dpl-btn-sm', 'data-picker': 'emoji', onClick: () => setOpen(true) },
      '看圖選擇表情',
    );
  return h(
    'div',
    { className: 'dpl-picker', 'data-picker-open': 'emoji' },
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'div',
        { className: 'dpl-seg', role: 'group', 'aria-label': '表情來源' },
        h(
          'button',
          { type: 'button', 'data-on': tab === 'common', 'aria-pressed': tab === 'common', onClick: () => setTab('common') },
          '一般表情',
        ),
        h(
          'button',
          {
            type: 'button',
            'data-on': tab === 'guild',
            'aria-pressed': tab === 'guild',
            'data-emoji-tab': 'guild',
            onClick: () => {
              setTab('guild');
              if (active && !guilds.length) loadGuilds(active);
            },
          },
          '伺服器自訂表情',
        ),
      ),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-ghost', onClick: () => setOpen(false) },
        '收合',
      ),
    ),
    tab === 'common'
      ? [
          h(
            'div',
            { className: 'dpl-actions', key: 'groups', role: 'group', 'aria-label': '表情分類' },
            emojiGroups.map(([name, items]) =>
              h(
                'button',
                {
                  key: name,
                  type: 'button',
                  className: 'dpl-btn dpl-btn-sm',
                  'data-emoji-group': name,
                  'data-on': group === name,
                  'aria-pressed': group === name,
                  onClick: () => setGroup(name),
                },
                name + ' ' + items.length,
              ),
            ),
          ),
          h(
            'div',
            { className: 'dpl-emoji-grid', key: 'grid', 'data-emoji-grid': group },
            (emojiGroups.find(([name]) => name === group) || emojiGroups[0])[1].map((item) => cell(item, item)),
          ),
          h(
            'div',
            { className: 'dpl-row-help', key: 'more' },
            '這裡列出 Discord 內建的一般表情。膚色變化與多人組合沒有列出，需要的話可以直接貼到上面的輸入框。',
          ),
        ]
      : !kinds.length
        ? h('div', { className: 'dpl-row-help' }, '帳號連線後，才能讀取伺服器的自訂表情。')
        : [
            h(
              'div',
              { className: 'dpl-actions', key: 'pick' },
              kinds.length > 1
                ? h(
                    'div',
                    { className: 'dpl-seg', role: 'group', 'aria-label': '使用哪個帳號的清單' },
                    kinds.map((which) =>
                      h(
                        'button',
                        {
                          key: which,
                          type: 'button',
                          'data-on': active === which,
                          'aria-pressed': active === which,
                          onClick: () => {
                            setTransport(which);
                            setGuildId('');
                            setEmojis(null);
                            loadGuilds(which);
                          },
                        },
                        which === 'bot' ? '機器人' : '使用者帳號',
                      ),
                    ),
                  )
                : null,
              h(
                'select',
                {
                  className: 'dpl-select',
                  'aria-label': '表情所在的伺服器',
                  value: guildId,
                  onChange: (event) => {
                    setGuildId(event.target.value);
                    loadEmojis(active, event.target.value);
                  },
                },
                [
                  h('option', { key: '', value: '' }, guilds.length ? '選擇伺服器' : '沒有可用的伺服器'),
                  ...guilds.map((guild) => h('option', { key: guild.id, value: guild.id }, guild.name)),
                ],
              ),
            ),
            loading ? h('div', { className: 'dpl-row-help', role: 'status', key: 'loading' }, '讀取中…') : null,
            error
              ? h('div', { className: 'dpl-note', 'data-tone': 'err', role: 'alert', key: 'error' }, '讀取表情失敗：' + error)
              : null,
            emojis === null
              ? guildId
                ? null
                : h('div', { className: 'dpl-row-help', key: 'hint' }, '先選擇伺服器，再點選要加入的表情；再點一次可移除。')
              : emojis.length
                ? h(
                    'div',
                    { className: 'dpl-emoji-grid', key: 'grid' },
                    emojis.map((emoji) =>
                      cell(emoji.code, ':' + emoji.name + ':' + (emoji.available ? '' : '（目前無法使用）'), !emoji.available),
                    ),
                  )
                : h('div', { className: 'dpl-row-help', key: 'empty' }, '這個伺服器沒有自訂表情。'),
            h(
              'div',
              { className: 'dpl-note', 'data-tone': 'warn', role: 'note', key: 'nitro', 'data-emoji-nitro-note': '1' },
              h('div', { className: 'dpl-note-title' }, '自訂表情只能在原本的伺服器使用'),
              h(
                'div',
                { className: 'dpl-note-body' },
                '使用者帳號沒有訂閱 Nitro 時，不能把某個伺服器的自訂表情用到別的伺服器；機器人則只能使用它自己加入的伺服器的表情。在其他伺服器輪到這類表情時會加不上去，建議表情池裡至少保留幾個一般表情。',
              ),
            ),
          ],
    h(
      'div',
      { className: 'dpl-row-help' },
      list.length ? '已選 ' + list.length + ' 個。點一下加入，再點一次移除。' : '目前沒有選任何表情。點一下加入，再點一次移除。',
    ),
  );
}
// ---- 08a-emoji-data.js
// 由 scripts/gen-emoji-data.mjs 產生，請勿手動修改。
// 完整的一般表情（Unicode 建議通用表情，Discord 內建表情使用同一套）：共 1666 個，不含膚色變化與多人組合。
const ALL_EMOJI_GROUPS = [
  ["表情與情緒", "☠️ ☹️ ☺️ ❣️ ❤️ 👁️ 👹 👺 👻 👼 👽 👾 👿 💀 💋 💌 💓 💔 💕 💖 💗 💘 💙 💚 💛 💜 💝 💞 💟 💢 💣 💤 💥 💦 💨 💩 💫 💬 💭 💯 🕳️ 🖤 🗨️ 🗯️ 😀 😁 😂 😃 😄 😅 😆 😇 😈 😉 😊 😋 😌 😍 😎 😏 😐 😑 😒 😓 😔 😕 😖 😗 😘 😙 😚 😛 😜 😝 😞 😟 😠 😡 😢 😣 😤 😥 😦 😧 😨 😩 😪 😫 😬 😭 😮 😯 😰 😱 😲 😳 😴 😵 😶 😷 😸 😹 😺 😻 😼 😽 😾 😿 🙀 🙁 🙂 🙃 🙄 🙅 🙆 🙇 🙈 🙉 🙊 🙋 🙌 🙍 🙎 🙏 🤍 🤎 🤐 🤑 🤒 🤓 🤔 🤕 🤖 🤗 🤠 🤡 🤢 🤣 🤤 🤥 🤧 🤨 🤩 🤪 🤫 🤬 🤭 🤮 🤯 🥰 🥱 🥲 🥳 🥴 🥵 🥶 🥷 🥸 🥹 🥺 🧐 🧡 🩵 🩶 🩷 🫠 🫡 🫢 🫣 🫤 🫥 🫦 🫧 🫨"],
  ["人物與手勢", "☝️ ⛷️ ⛹️ ✊ ✋ ✌️ ✍️ 🎅 🏂 🏃 🏄 🏇 🏊 🏋️ 🏌️ 👀 👂 👃 👄 👅 👆 👇 👈 👉 👊 👋 👌 👍 👎 👏 👐 👣 👤 👥 👦 👧 👨 👩 👪 👫 👬 👭 👮 👯 👰 👱 👲 👳 👴 👵 👶 👷 👸 💁 💂 💃 💅 💆 💇 💏 💑 💪 🕴️ 🕵️ 🕺 🖐️ 🖕 🖖 🚣 🚴 🚵 🚶 🛀 🛌 🤘 🤙 🤚 🤛 🤜 🤝 🤞 🤟 🤦 🤰 🤱 🤲 🤳 🤴 🤵 🤶 🤷 🤸 🤹 🤺 🤼 🤽 🤾 🦵 🦶 🦷 🦸 🦹 🦻 🧍 🧎 🧏 🧑 🧒 🧓 🧔 🧕 🧖 🧗 🧘 🧙 🧚 🧛 🧜 🧝 🧞 🧟 🧠 🫀 🫁 🫂 🫃 🫄 🫅 🫆 🫰 🫱 🫲 🫳 🫴 🫵 🫶 🫷 🫸"],
  ["動物與自然", "☀️ ☁️ ☂️ ☃️ ☄️ ☔ ☘️ ⚡ ⛄ ⛅ ⛈️ ✨ ❄️ ⭐ 🌀 🌁 🌂 🌃 🌄 🌅 🌆 🌇 🌈 🌉 🌊 🌋 🌌 🌍 🌎 🌏 🌐 🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘 🌙 🌚 🌛 🌜 🌝 🌞 🌟 🌠 🌡️ 🌤️ 🌥️ 🌦️ 🌧️ 🌨️ 🌩️ 🌪️ 🌫️ 🌬️ 🌰 🌱 🌲 🌳 🌴 🌵 🌶️ 🌷 🌸 🌹 🌺 🌻 🌼 🌽 🌾 🌿 🍀 🍁 🍂 🍃 🍄 🎋 🎍 🐀 🐁 🐂 🐃 🐄 🐅 🐆 🐇 🐈 🐉 🐊 🐋 🐌 🐍 🐎 🐏 🐐 🐑 🐒 🐓 🐔 🐕 🐖 🐗 🐘 🐙 🐚 🐛 🐜 🐝 🐞 🐟 🐠 🐡 🐢 🐣 🐤 🐥 🐦 🐧 🐨 🐩 🐪 🐫 🐬 🐭 🐮 🐯 🐰 🐱 🐲 🐳 🐴 🐵 🐶 🐷 🐸 🐹 🐺 🐻 🐼 🐽 🐾 🐿️ 💐 💧 🔥 🕊️ 🕷️ 🕸️ 🥀 🦀 🦁 🦂 🦃 🦄 🦅 🦆 🦇 🦈 🦉 🦊 🦋 🦌 🦍 🦎 🦏 🦐 🦑 🦒 🦓 🦔 🦕 🦖 🦗 🦘 🦙 🦚 🦛 🦜 🦝 🦞 🦟 🦠 🦡 🦢 🦣 🦤 🦥 🦦 🦧 🦨 🦩 🦪 🦫 🦬 🦭 🦮 🪰 🪱 🪲 🪳 🪴 🪵 🪶 🪷 🪸 🪹 🪺 🪻 🪼 🪽 🪾 🪿 🫎 🫏"],
  ["食物與飲料", "☕ 🌭 🌮 🌯 🍅 🍆 🍇 🍈 🍉 🍊 🍋 🍌 🍍 🍎 🍏 🍐 🍑 🍒 🍓 🍔 🍕 🍖 🍗 🍘 🍙 🍚 🍛 🍜 🍝 🍞 🍟 🍠 🍡 🍢 🍣 🍤 🍥 🍦 🍧 🍨 🍩 🍪 🍫 🍬 🍭 🍮 🍯 🍰 🍱 🍲 🍳 🍴 🍵 🍶 🍷 🍸 🍹 🍺 🍻 🍼 🍽️ 🍾 🍿 🥂 🥃 🥄 🥐 🥑 🥒 🥓 🥔 🥕 🥖 🥗 🥘 🥙 🥚 🥛 🥜 🥝 🥞 🥟 🥠 🥡 🥢 🥣 🥤 🥥 🥦 🥧 🥨 🥩 🥪 🥫 🥬 🥭 🥮 🥯 🧀 🧁 🧂 🧃 🧄 🧅 🧆 🧇 🧈 🧉 🧊 🧋 🫐 🫑 🫒 🫓 🫔 🫕 🫖 🫗 🫘 🫙 🫚 🫛"],
  ["活動與娛樂", "♟️ ♠️ ♣️ ♥️ ♦️ ⚽ ⚾ ⛳ ⛸️ 🀄 🃏 🎀 🎁 🎂 🎃 🎄 🎆 🎇 🎈 🎉 🎊 🎎 🎏 🎐 🎑 🎒 🎓 🎖️ 🎗️ 🎙️ 🎚️ 🎛️ 🎞️ 🎟️ 🎠 🎡 🎢 🎣 🎤 🎥 🎦 🎧 🎨 🎩 🎪 🎫 🎬 🎭 🎮 🎯 🎰 🎱 🎲 🎳 🎴 🎵 🎶 🎷 🎸 🎹 🎺 🎻 🎼 🎽 🎾 🎿 🏀 🏅 🏆 🏈 🏉 🏏 🏐 🏑 🏒 🏓 🏸 🏹 🕹️ 🤿 🥁 🥅 🥇 🥈 🥉 🥊 🥋 🥌 🥍 🥎 🥏 🧩 🧵 🧶 🧸 🪀 🪁 🪂 🪃 🪄 🪅 🪆 🪇 🪈 🪉 🪩"],
  ["旅遊與地點", "⌚ ⌛ ⏰ ⏱️ ⏲️ ⏳ ⚓ ⛩️ ⛪ ⛰️ ⛱️ ⛲ ⛴️ ⛵ ⛺ ⛽ ✈️ 🏔️ 🏕️ 🏖️ 🏗️ 🏘️ 🏙️ 🏚️ 🏛️ 🏜️ 🏝️ 🏞️ 🏟️ 🏠 🏡 🏢 🏣 🏤 🏥 🏦 🏧 🏨 🏩 🏪 🏫 🏬 🏭 🏮 🏯 🏰 🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚 🕛 🕜 🕝 🕞 🕟 🕠 🕡 🕢 🕣 🕤 🕥 🕦 🕧 🗺️ 🗻 🗼 🗽 🗾 🗿 🚀 🚁 🚂 🚃 🚄 🚅 🚆 🚇 🚈 🚉 🚊 🚋 🚌 🚍 🚎 🚏 🚐 🚑 🚒 🚓 🚔 🚕 🚖 🚗 🚘 🚙 🚚 🚛 🚜 🚝 🚞 🚟 🚠 🚡 🚢 🚤 🚥 🚦 🚧 🚨 🚪 🚫 🚬 🚭 🚮 🚯 🚰 🚱 🚲 🚳 🚷 🚸 🚹 🚺 🚻 🚼 🚽 🚾 🚿 🛁 🛂 🛃 🛄 🛅 🛋️ 🛍️ 🛎️ 🛏️ 🛐 🛑 🛒 🛕 🛖 🛗 🛘 🛜 🛝 🛞 🛟 🛠️ 🛡️ 🛢️ 🛣️ 🛤️ 🛥️ 🛩️ 🛫 🛬 🛰️ 🛳️ 🛴 🛵 🛶 🛷 🛸 🛹 🛺 🛻 🛼 🧭 🧳 🪨"],
  ["物品", "⌨️ ☎️ ⚒️ ⚔️ ⚕️ ⚖️ ⚗️ ⚙️ ⚛️ ⚰️ ⚱️ ⛏️ ⛑️ ⛓️ ✂️ ✉️ ✏️ ✒️ 👑 👒 👓 👔 👕 👖 👗 👘 👙 👚 👛 👜 👝 👞 👟 👠 👡 👢 💄 💈 💉 💊 💍 💎 💠 💡 💰 💱 💲 💳 💴 💵 💶 💷 💸 💹 💺 💻 💼 💽 💾 💿 📀 📁 📂 📃 📄 📅 📆 📇 📈 📉 📊 📋 📌 📍 📎 📏 📐 📑 📒 📓 📔 📕 📖 📗 📘 📙 📚 📛 📜 📝 📞 📟 📠 📡 📢 📣 📤 📥 📦 📧 📨 📩 📪 📫 📬 📭 📮 📯 📰 📱 📲 📳 📴 📵 📶 📷 📸 📹 📺 📻 📼 📽️ 📿 🔇 🔈 🔉 🔊 🔋 🔌 🔍 🔎 🔏 🔐 🔑 🔒 🔓 🔖 🔗 🔦 🔧 🔨 🔩 🔪 🔫 🔬 🔭 🔮 🕯️ 🕰️ 🕶️ 🖇️ 🖊️ 🖋️ 🖌️ 🖍️ 🖥️ 🖨️ 🖱️ 🖲️ 🖼️ 🗂️ 🗃️ 🗄️ 🗑️ 🗒️ 🗓️ 🗜️ 🗝️ 🗞️ 🗡️ 🗣️ 🗳️ 🦯 🦺 🦼 🦽 🦾 🦿 🧢 🧣 🧤 🧥 🧦 🧧 🧨 🧪 🧫 🧬 🧮 🧯 🧰 🧱 🧲 🧴 🧷 🧹 🧺 🧻 🧼 🧽 🧾 🧿 🩰 🩱 🩲 🩳 🩴 🩸 🩹 🩺 🩻 🩼 🪐 🪑 🪒 🪓 🪔 🪕 🪖 🪗 🪘 🪙 🪚 🪛 🪜 🪝 🪞 🪟 🪠 🪡 🪢 🪣 🪤 🪥 🪦 🪧 🪪 🪫 🪬 🪭 🪮 🪯"],
  ["符號", "©️ ®️ ‼️ ⁉️ ™️ ℹ️ ↔️ ↕️ ↖️ ↗️ ↘️ ↙️ ↩️ ↪️ ⏏️ ⏩ ⏪ ⏫ ⏬ ⏭️ ⏮️ ⏯️ ⏸️ ⏹️ ⏺️ Ⓜ️ ▪️ ▫️ ▶️ ◀️ ◻️ ◼️ ◽ ◾ ☑️ ☢️ ☣️ ☦️ ☪️ ☮️ ☯️ ☸️ ♀️ ♂️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ♨️ ♻️ ♾️ ♿ ⚜️ ⚠️ ⚧️ ⚪ ⚫ ⛎ ⛔ ✅ ✔️ ✖️ ✝️ ✡️ ✳️ ✴️ ❇️ ❌ ❎ ❓ ❔ ❕ ❗ ➕ ➖ ➗ ➡️ ➰ ➿ ⤴️ ⤵️ ⬅️ ⬆️ ⬇️ ⬛ ⬜ ⭕ 〰️ 〽️ ㊗️ ㊙️ 🅰️ 🅱️ 🅾️ 🅿️ 🆎 🆑 🆒 🆓 🆔 🆕 🆖 🆗 🆘 🆙 🆚 🈁 🈂️ 🈚 🈯 🈲 🈳 🈴 🈵 🈶 🈷️ 🈸 🈹 🈺 🉐 🉑 🏍️ 🏎️ 🏵️ 🏷️ 🏺 💒 💮 🔀 🔁 🔂 🔃 🔄 🔅 🔆 🔔 🔕 🔘 🔙 🔚 🔛 🔜 🔝 🔞 🔟 🔠 🔡 🔢 🔣 🔤 🔯 🔰 🔱 🔲 🔳 🔴 🔵 🔶 🔷 🔸 🔹 🔺 🔻 🔼 🔽 🕉️ 🕋 🕌 🕍 🕎 🟠 🟡 🟢 🟣 🟤 🟥 🟦 🟧 🟨 🟩 🟪 🟫 🟰 🤌 🤏 🥻 🥼 🥽 🥾 🥿 🦰 🦱 🦲 🦳 🦴 🧌 🪊 🪎 🪏 🫈 🫍 🫜 🫟 🫩 🫪 🫯 #️⃣ *️⃣ 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣"],
  ["旗幟", "🎌 🏁 🏳️ 🏴 🚩 🇦🇨 🇦🇩 🇦🇪 🇦🇫 🇦🇬 🇦🇮 🇦🇱 🇦🇲 🇦🇴 🇦🇶 🇦🇷 🇦🇸 🇦🇹 🇦🇺 🇦🇼 🇦🇽 🇦🇿 🇧🇦 🇧🇧 🇧🇩 🇧🇪 🇧🇫 🇧🇬 🇧🇭 🇧🇮 🇧🇯 🇧🇱 🇧🇲 🇧🇳 🇧🇴 🇧🇶 🇧🇷 🇧🇸 🇧🇹 🇧🇻 🇧🇼 🇧🇾 🇧🇿 🇨🇦 🇨🇨 🇨🇩 🇨🇫 🇨🇬 🇨🇭 🇨🇮 🇨🇰 🇨🇱 🇨🇲 🇨🇳 🇨🇴 🇨🇵 🇨🇶 🇨🇷 🇨🇺 🇨🇻 🇨🇼 🇨🇽 🇨🇾 🇨🇿 🇩🇪 🇩🇬 🇩🇯 🇩🇰 🇩🇲 🇩🇴 🇩🇿 🇪🇦 🇪🇨 🇪🇪 🇪🇬 🇪🇭 🇪🇷 🇪🇸 🇪🇹 🇪🇺 🇫🇮 🇫🇯 🇫🇰 🇫🇲 🇫🇴 🇫🇷 🇬🇦 🇬🇧 🇬🇩 🇬🇪 🇬🇫 🇬🇬 🇬🇭 🇬🇮 🇬🇱 🇬🇲 🇬🇳 🇬🇵 🇬🇶 🇬🇷 🇬🇸 🇬🇹 🇬🇺 🇬🇼 🇬🇾 🇭🇰 🇭🇲 🇭🇳 🇭🇷 🇭🇹 🇭🇺 🇮🇨 🇮🇩 🇮🇪 🇮🇱 🇮🇲 🇮🇳 🇮🇴 🇮🇶 🇮🇷 🇮🇸 🇮🇹 🇯🇪 🇯🇲 🇯🇴 🇯🇵 🇰🇪 🇰🇬 🇰🇭 🇰🇮 🇰🇲 🇰🇳 🇰🇵 🇰🇷 🇰🇼 🇰🇾 🇰🇿 🇱🇦 🇱🇧 🇱🇨 🇱🇮 🇱🇰 🇱🇷 🇱🇸 🇱🇹 🇱🇺 🇱🇻 🇱🇾 🇲🇦 🇲🇨 🇲🇩 🇲🇪 🇲🇫 🇲🇬 🇲🇭 🇲🇰 🇲🇱 🇲🇲 🇲🇳 🇲🇴 🇲🇵 🇲🇶 🇲🇷 🇲🇸 🇲🇹 🇲🇺 🇲🇻 🇲🇼 🇲🇽 🇲🇾 🇲🇿 🇳🇦 🇳🇨 🇳🇪 🇳🇫 🇳🇬 🇳🇮 🇳🇱 🇳🇴 🇳🇵 🇳🇷 🇳🇺 🇳🇿 🇴🇲 🇵🇦 🇵🇪 🇵🇫 🇵🇬 🇵🇭 🇵🇰 🇵🇱 🇵🇲 🇵🇳 🇵🇷 🇵🇸 🇵🇹 🇵🇼 🇵🇾 🇶🇦 🇷🇪 🇷🇴 🇷🇸 🇷🇺 🇷🇼 🇸🇦 🇸🇧 🇸🇨 🇸🇩 🇸🇪 🇸🇬 🇸🇭 🇸🇮 🇸🇯 🇸🇰 🇸🇱 🇸🇲 🇸🇳 🇸🇴 🇸🇷 🇸🇸 🇸🇹 🇸🇻 🇸🇽 🇸🇾 🇸🇿 🇹🇦 🇹🇨 🇹🇩 🇹🇫 🇹🇬 🇹🇭 🇹🇯 🇹🇰 🇹🇱 🇹🇲 🇹🇳 🇹🇴 🇹🇷 🇹🇹 🇹🇻 🇹🇼 🇹🇿 🇺🇦 🇺🇬 🇺🇲 🇺🇳 🇺🇸 🇺🇾 🇺🇿 🇻🇦 🇻🇨 🇻🇪 🇻🇬 🇻🇮 🇻🇳 🇻🇺 🇼🇫 🇼🇸 🇽🇰 🇾🇪 🇾🇹 🇿🇦 🇿🇲 🇿🇼"],
].map(([name, list]) => [name, list.split(' ')]);
// ---- 09-python-setup.js
// 使用者帳號卡片裡的「Python 執行環境」：顯示有沒有裝好，沒有就一鍵安裝。
// 安裝在背景進行（可能要幾分鐘），這裡每兩秒讀一次進度。
function PythonSetupRow() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const alive = useRef(true);
  const load = React.useCallback(async () => {
    try {
      const result = await api('/user/python');
      if (alive.current) {
        setInfo(result.python || null);
        setError('');
      }
    } catch (failure) {
      if (alive.current) setError(failure.message || '讀取失敗');
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);
  const running = info?.state === 'running';
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [running, load]);

  async function install() {
    setStarting(true);
    setError('');
    try {
      const result = await api('/user/python/install', { method: 'POST', body: {} });
      if (alive.current) setInfo(result.python || null);
    } catch (failure) {
      if (alive.current) setError(failure.message || '無法開始安裝');
    } finally {
      if (alive.current) setStarting(false);
    }
  }

  const ready = Boolean(info?.ready);
  const tone = running ? 'warn' : ready ? 'ok' : 'err';
  const badge = !info ? '讀取中' : running ? '安裝中' : info.customPath ? '使用自訂路徑' : ready ? '已安裝' : '尚未安裝';
  let help;
  if (!info) help = '正在檢查…';
  else if (running)
    help = `正在${info.stepLabel || '安裝'}…第一次安裝要下載套件，通常需要幾分鐘，可以先去做別的事，這個頁面不用一直開著。`;
  else if (info.customPath)
    help = '你在下面的「Python 執行檔路徑」填了自己的 Python，插件會用那一份，不會自動安裝。';
  else if (info.state === 'failed') help = '上次安裝沒有成功：' + (info.error || '未知錯誤');
  else if (ready)
    help =
      info.state === 'done'
        ? '安裝完成。填好 Token 後按下面的「儲存並登入」就可以連線。'
        : '使用者帳號需要的 Python 環境已經裝好。連線出現套件相關的錯誤時，可以按右邊重新安裝一次。';
  else if (info.base && !info.base.found)
    help = '使用者帳號需要 Python 3.11 以上，但找不到可用的 Python。請先安裝 Python 再按右邊的按鈕，或在下面的欄位填入 Python 的完整路徑。';
  else
    help =
      '使用者帳號需要另外一套 Python 套件，按右邊的按鈕就會自動裝好' +
      (info.base?.source === 'dsh' ? '（使用 DSH 內附的 Python，不會動到你電腦上其他的 Python）' : '') +
      '。只用機器人帳號的話不需要安裝。';

  return h(
    'div',
    { className: 'dpl-row', 'data-type': 'actions', 'data-python-setup': !info ? 'loading' : running ? 'running' : ready ? 'ready' : 'missing' },
    h(
      'div',
      { className: 'dpl-row-main' },
      h('div', { className: 'dpl-row-label' }, 'Python 執行環境', h(Pill, { tone, dot: true }, badge)),
      h('div', { className: 'dpl-row-help', role: info?.state === 'failed' ? 'alert' : 'status' }, help),
      error ? h('div', { className: 'dpl-row-help', role: 'alert', style: { color: 'var(--dpl-err)' } }, error) : null,
    ),
    h(
      'div',
      { className: 'dpl-row-control' },
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-sm' + (ready ? '' : ' dpl-btn-primary'),
          'data-action': 'python-install',
          disabled: !info || running || starting || info.customPath,
          onClick: install,
        },
        Icon.bolt({ size: 13 }),
        running || starting ? '安裝中…' : ready ? '重新安裝' : info?.state === 'failed' ? '再試一次' : '一鍵安裝',
      ),
    ),
  );
}
// ---- 10-transport-card.js
function TransportCard({
  kind,
  info,
  status,
  config,
  draft,
  setValue,
  fields,
  onLogin,
  onLogout,
  onNavigate,
  busy,
}) {
  const isUser = kind === 'user';
  const [probe, setProbe] = useState(null);
  const [probing, setProbing] = useState(false);
  const tone = status?.ok ? 'ok' : status?.state === 'error' ? 'err' : 'muted';
  const stateLabel = status?.ok
    ? '已連線'
    : status?.state === 'connecting'
      ? '連線中'
      : status?.state === 'reconnecting'
        ? '重連中'
        : status?.state === 'error'
          ? '錯誤'
          : '未登入';
  const enabledKey = isUser ? 'userEnabled' : 'botEnabled';
  const autoKey = isUser ? 'userAutoStart' : 'botAutoStart';
  const tokenKey = isUser ? 'userToken' : 'botToken';
  const tokenSet = Boolean(config?.[`${tokenKey}__set`]);
  // Token 直接住在 draft 裡，才不會出現「打了字、按了儲存，卻只有卡片自己的
  // 區域 state 記得」這種存不進去的情況（dirty 差異是拿 draft 跟 config 比）。
  const token = String(draft?.[tokenKey] || '');
  const setToken = (value) => setValue?.(tokenKey, value);
  async function handleProbe() {
    setProbing(true);
    try {
      const result = await api('/probe-token', {
        method: 'POST',
        allowFailure: true,
        body: { transport: kind, ...(token ? { token } : {}) },
      });
      setProbe(result);
    } catch (error) {
      setProbe({ ok: false, valid: null, outcome: 'unknown', error: error.message });
    } finally {
      setProbing(false);
    }
  }

  return h(
    Card,
    {
      title: info?.label || kind,
      icon: isUser ? 'user' : 'bot',
      desc: info?.note,
      actions: [
        h(Pill, { key: 'state', tone, dot: true }, stateLabel),
        h(
          'label',
          { key: 'enabled', className: 'dpl-switch-label' },
          '啟用此帳號',
          h(Switch, {
            label: '啟用此帳號',
            checked: Boolean(draft[enabledKey]),
            onChange: (next) => setValue(enabledKey, next),
          }),
        ),
      ],
    },
    isUser
      ? h(
          'div',
          { className: 'dpl-note dpl-risk', role: 'note' },
          h('strong', null, '個人帳號自動化風險'),
          h(
            'p',
            null,
            'Discord 禁止使用 self-bot 自動化一般使用者帳號。即使套件包含防偵測相關處理，仍可能被偵測、停權或永久封號。請使用小號，不保證不被封號。',
          ),
        )
      : null,
    isUser ? h(PythonSetupRow, { key: 'python' }) : null,
    h(
      'div',
      { className: 'dpl-row', 'data-type': 'password' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h(
          'div',
          { className: 'dpl-row-label' },
          info?.tokenLabel || 'Token',
          tokenSet
            ? h('span', { className: 'dpl-badge' }, '已儲存')
            : h('span', { className: 'dpl-badge dpl-badge-dirty' }, '未設定'),
          token ? h('span', { className: 'dpl-badge dpl-badge-dirty' }, '尚未儲存') : null,
          config?.[`${tokenKey}__fp`]
            ? h(
                'span',
                {
                  className: 'dpl-badge',
                  title: '設定檔裡那把 Token 的指紋（用來確認存的是不是你剛貼的那一把）',
                },
                `指紋 ${config[`${tokenKey}__fp`]}`,
              )
            : null,
        ),
        h(
          'div',
          { className: 'dpl-row-help' },
          isUser
            ? '只存在本機設定檔。取得方式：瀏覽器 DevTools 的 Network 面板，複製任一請求的 authorization 標頭。'
            : 'Developer Portal 的 Bot 頁面 Reset Token。記得開啟 MESSAGE CONTENT INTENT，否則讀不到訊息內容。',
        ),
      ),
      h(
        'div',
        { className: 'dpl-row-control', style: { flex: '1 1 320px', maxWidth: 420 } },
        h(PasswordInput, {
          value: token,
          onChange: setToken,
          placeholder: tokenSet ? '******** 已儲存（留空代表沿用）' : '貼上 Token',
        }),
      ),
    ),

    h(
      'div',
      { className: 'dpl-row', 'data-type': 'boolean' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h('div', { className: 'dpl-row-label' }, '啟動時自動連線'),
        h('div', { className: 'dpl-row-help' }, 'DSH 啟動後自動用已儲存的 Token 連線。'),
      ),
      h(
        'div',
        { className: 'dpl-row-control' },
        h(Switch, {
          checked: Boolean(draft[autoKey]),
          onChange: (next) => setValue(autoKey, next),
        }),
      ),
    ),

    isUser
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': draft.dryRun ? 'warn' : 'info' },
          draft.dryRun
            ? '試跑模式已開啟：AI 只產生回覆，不發送文字或表情。要實際回覆，可在「總覽」的快速設定改為正式回覆，或到「系統 → 進階」關閉試跑模式。'
            : '試跑模式已關閉。關閉「僅觀察連線」並開啟「AI 自動回覆」後，新訊息可依回覆規則實際送出。',
          onNavigate
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dpl-link',
                  style: { alignSelf: 'flex-start' },
                  onClick: () => onNavigate('overview'),
                },
                '前往快速設定',
              )
            : null,
        )
      : h(
          'div',
          { className: 'dpl-row', 'data-type': 'string' },
          h(
            'div',
            { className: 'dpl-row-main' },
            h('div', { className: 'dpl-row-label' }, '機器人活動狀態'),
            h(
              'div',
              { className: 'dpl-row-help' },
              '顯示在成員列表下方，例如「正在遊玩 陪你聊天」。文字留空則不顯示。',
            ),
          ),
          h(
            'div',
            { className: 'dpl-row-control', style: { flex: '1 1 260px', maxWidth: 420 } },
            (() => {
              const typeField = (fields || []).find((field) => field.key === 'botActivityType');
              return typeField
                ? h(
                    'select',
                    {
                      className: 'dpl-select',
                      style: { width: 'auto', flex: '0 0 auto' },
                      'aria-label': typeField.label || '活動類型',
                      value: String(draft.botActivityType ?? ''),
                      onChange: (event) => setValue('botActivityType', event.target.value),
                    },
                    (typeField.options || []).map((option) =>
                      h(
                        'option',
                        { key: String(option.value), value: option.value },
                        option.label ?? String(option.value),
                      ),
                    ),
                  )
                : null;
            })(),
            h('input', {
              className: 'dpl-input',
              value: draft.botActivityText || '',
              placeholder: '例如：陪你聊天',
              onChange: (event) => setValue('botActivityText', event.target.value),
            }),
          ),
        ),

    h(
      'div',
      { className: 'dpl-row', 'data-type': 'string' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h('div', { className: 'dpl-row-label' }, '連線資訊'),
        h(
          'div',
          { className: 'dpl-row-help' },
          status?.ok
            ? `${status.user?.tag || status.user?.username || '-'} · ${status.guildCount ?? 0} 個伺服器 · 延遲 ${status.ping == null ? '未提供' : status.ping + 'ms'} · 已連線 ${fmtAgo(status.uptimeMs)}`
            : (status?.message || '尚未登入') +
                (isUser ? ` · 已觀察 ${status?.receivedCount || 0} 則訊息` : ''),
        ),
      ),
    ),

    h(
      'div',
      { className: 'dpl-row', 'data-type': 'actions' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h(
          'div',
          { className: 'dpl-row-help' },
          busy
            ? '正在處理…'
            : !(token || tokenSet)
              ? '需要先填入 Token。'
              : !draft[enabledKey]
                ? '請先開啟右上角的「啟用此帳號」。'
                : '準備好就可以連線。',
        ),
        probe
          ? h(
              'div',
              {
                className: 'dpl-row-help',
                style: { color: probe.valid ? 'var(--dpl-ok)' : 'var(--dpl-err)', marginTop: 4 },
              },
              probe.valid
                ? `Token 有效：${probe.user?.tag || probe.user?.username}（ID ${probe.user?.id}${probe.fingerprint ? ` · fp ${probe.fingerprint}` : ''}）`
                : `${probe.valid === false ? '憑證被拒絕' : '驗證結果不確定'}：${probe.error || '未知錯誤'}${probe.fingerprint ? ` · fp ${probe.fingerprint}` : ''}`,
              probe.valid
                ? ''
                : h(
                    'span',
                    { className: 'dpl-muted', style: { display: 'block', marginTop: 2 } },
                    probe.hint || '',
                  ),
            )
          : null,
      ),
      h(
        'div',
        { className: 'dpl-row-control' },
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-sm',
            disabled: probing || !(token || tokenSet),
            onClick: handleProbe,
          },
          Icon.check({ size: 13 }),
          probing ? '驗證中...' : '驗證 Token',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-primary dpl-btn-sm',
            disabled: busy || !(token || tokenSet) || !draft[enabledKey],
            onClick: () => onLogin(kind, token),
          },
          Icon.play({ size: 13 }),
          busy ? '連線中...' : status?.ok ? '儲存並重新連線' : '儲存並登入',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-danger dpl-btn-sm',
            disabled: busy || !(status?.ok || status?.workerRunning),
            onClick: () => onLogout(kind),
          },
          Icon.power({ size: 13 }),
          '登出',
        ),
      ),
    ),

    // 連線錯誤本身不能證明憑證被撤銷；原因須依 Gateway 與 REST 證據分開判斷。
    isUser && status?.state === 'error'
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'err' },
          h('div', { className: 'dpl-note-title' }, '使用者帳號連線發生錯誤'),
          h(
            'div',
            { className: 'dpl-note-body' },
            status?.message || '請查看執行記錄以確認實際錯誤。',
            h(
              'div',
              { className: 'dpl-muted' },
              '可用「驗證 Token」獨立確認目前憑證狀態；連線錯誤本身不代表 Token 失效。',
            ),
          ),
        )
      : null,
  );
}

// ---------------------------------------------------------------- log panel ---
// ---- 11-log.js
const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };

function LogList({ logs, level }) {
  const filtered = (logs || []).filter(
    (entry) => (LEVEL_ORDER[entry.level] ?? 1) >= (LEVEL_ORDER[level] ?? 1),
  );
  if (!filtered.length) return h('div', { className: 'dpl-empty' }, '目前沒有符合條件的 log。');
  return h(
    'div',
    { className: 'dpl-log' },
    filtered.map((entry) =>
      h(
        'div',
        { key: entry.id, className: 'dpl-log-row' },
        h('span', { className: 'dpl-log-time' }, fmtTime(entry.t)),
        h('span', { className: 'dpl-log-level', 'data-level': entry.level }, entry.level),
        h('span', { className: 'dpl-log-event' }, entry.event),
        h('span', { className: 'dpl-log-summary', title: entry.summary }, entry.summary),
      ),
    ),
  );
}

function LogPanel({ logs, level, setLevel, onRefresh, onClear }) {
  return h(
    Card,
    {
      title: '即時 log（除錯）',
      icon: 'log',
      desc: '登入、回覆、按表情、發送失敗都會留下紀錄；Token 與敏感字串會自動遮蔽。',
      actions: [
        h(Segmented, {
          key: 'level',
          options: [
            { value: 'debug', label: '全部' },
            { value: 'info', label: '一般' },
            { value: 'warn', label: '警告' },
            { value: 'error', label: '錯誤' },
          ],
          value: level,
          onChange: setLevel,
        }),
        h(
          'button',
          { key: 'r', type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-ghost', onClick: onRefresh },
          Icon.refresh({ size: 13 }),
          '重新整理',
        ),
        h(
          'button',
          { key: 'c', type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-danger', onClick: onClear },
          Icon.trash({ size: 13 }),
          '清空',
        ),
      ],
    },
    h(LogList, { logs, level }),
  );
}
// ---- 20-topics.js
function phaseLabel(value) {
  return (
    {
      waiting: '等候中',
      queued: '已排程',
      creating: '建立中',
      generating: '產生回覆',
      running: '執行中',
      resuming: '重新核對中',
      sending: '交付中',
      delivered: '已交付',
      draft: '待審閱',
      cancelled: '已取消',
      cancelling: '取消中',
      uncertain: '結果不明',
      failed: '失敗',
      skipped: '已略過',
      blocked: '未通過條件',
      'handled-elsewhere': '由另一介面接手',
      partial: '部分完成',
      removed: '已移除',
      corrected: '已更正',
      invalidated: '衍生檔已失效',
      unsupported: '需另外處理',
      archived: '已歸檔（資料保留）',
      suppressed: '已停止召回（資料保留）',
      deleted: '原插件回報已刪除此筆',
      acknowledged: '已人工核對（非驗證成功）',
      prepared: '準備執行',
      pending_review: '等待原插件審核',
      rejected: '原插件已拒絕',
    }[value] || value
  );
}
function ConversationTopics() {
  const [data, D] = useState(null),
    [error, E] = useState(''),
    [notice, N] = useState(''),
    [busy, W] = useState(false),
    [all, A] = useState(false),
    [query, Q] = useState(''),
    [when, T] = useState('30分鐘後'),
    [plan, P] = useState(null),
    [closing, C] = useState(null);
  const load = async () => D(await api('/conversation/topics' + (all ? '?includeAnswered=1' : '')));
  useEffect(() => {
    load().catch((e) => E(e.message));
  }, [all]);
  const run = async (fn, text) => {
    W(true);
    E('');
    N('');
    try {
      const result = await fn();
      if (text) N(text);
      else if (result.message) N(result.message);
      await load();
      return result;
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  const labels = {
    pending: '等待回覆',
    generating: '正在生成',
    sending: '交付中',
    draft: '草稿待審閱',
    planning: '安排中',
    deferred: '已延後',
    answered: '已回答',
    closed: '已結束',
    failed: '未完成',
    blocked: '尚未回覆',
    cancelled: '已取消生成',
    uncertain: '結果待核對',
  };
  useIdNames((data?.topics || []).flatMap((row) => [row.channelId, row.userId]));
  const rows = (data?.topics || []).filter((row) => {
    const text = [row.preview, row.authorName, row.userId, row.channelId, row.code].join(' '),
      q = query.toLocaleLowerCase();
    return !q || [text, uiLocale.convert(text)].some((x) => x.toLocaleLowerCase().includes(q));
  });
  return h(
    Card,
    {
      title: '未答話題與延後回覆',
      desc: '保留來源與狀態，不建立另一套長期記憶。預覽沿用聊天快取；重新回答可能使用模型／語音額度。',
    },
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'button',
        { className: 'dpl-btn', disabled: busy, onClick: () => run(load, '已更新話題狀態') },
        '更新未答話題',
      ),
      h(
        'label',
        null,
        h('input', {
          type: 'checkbox',
          checked: all,
          onChange: (e) => {
            A(e.target.checked);
            P(null);
            C(null);
          },
        }),
        ' 顯示已回答與已結束話題',
      ),
    ),
    h('input', {
      className: 'dpl-input',
      'aria-label': '搜尋未答話題',
      placeholder: '搜尋預覽、使用者、頻道或話題代碼',
      value: query,
      onChange: (e) => Q(e.target.value),
    }),
    h(
      'label',
      null,
      '延後到什麼時間',
      h('input', {
        className: 'dpl-input',
        'aria-label': '延後時間',
        value: when,
        onChange: (e) => {
          T(e.target.value);
          P(null);
        },
      }),
    ),
    h(
      'p',
      { className: 'dpl-note' },
      '可輸入「半小時後」「明天下午三點半」。時間採 Asia/Taipei，最多七天；「晚點」會先追問。建立工作前須核對預覽並確認，不自動猜時間。',
    ),
    h(
      'details',
      null,
      h('summary', null, '在 Discord 中操作'),
      h(
        'p',
        null,
        '私訊或明確 @ AI 後說「半小時後再回覆我」，引用原問題可避免多話題混淆；再輸入回執提供的「確認安排 XXXXXXXX」。也可說「取消剛才的安排」「查看未答話題」「繼續話題 XXXXXXXX」。只操作自己的原帳號／頻道，不能指定其他人或任意收件人。',
      ),
    ),
    rows.map((row) =>
      h(
        'article',
        { key: row.id, className: 'dpl-asset', style: { minWidth: 0, overflowWrap: 'anywhere' } },
        h('strong', null, '#' + row.code + ' · ' + (labels[row.state] || row.state)),
        h(
          'p',
          null,
          (row.authorName || nameOfId(row.userId)) +
            ' · ' +
            nameOfId(row.channelId) +
            ' · ' +
            (row.kind === 'bot' ? 'Bot' : '使用者帳號'),
        ),
        h('p', null, row.preview || '聊天快取無預覽，來源訊息：' + row.sourceIds.join('、')),
        h('p', { className: 'dpl-note' }, row.reason),
        h(
          'div',
          { className: 'dpl-actions' },
          h(
            'button',
            {
              className: 'dpl-btn',
              disabled:
                busy ||
                !row.sourceAvailable ||
                ['answered', 'closed', 'uncertain', 'sending', 'planning'].includes(row.state),
              onClick: () =>
                run(async () => {
                  C(null);
                  const result = await api('/conversation/plan', {
                    method: 'POST',
                    body: { topicId: row.id, expectedRevision: row.revision, action: 'defer', when },
                  });
                  P(result.plan || null);
                  return result;
                }),
            },
            '預覽延後回覆',
          ),
          h(
            'button',
            {
              className: 'dpl-btn',
              disabled:
                busy ||
                !row.sourceAvailable ||
                ['answered', 'closed', 'uncertain', 'sending', 'planning'].includes(row.state),
              onClick: () =>
                run(async () => {
                  C(null);
                  const result = await api('/conversation/plan', {
                    method: 'POST',
                    body: { topicId: row.id, expectedRevision: row.revision, action: 'resume' },
                  });
                  P(result.plan || null);
                  return result;
                }),
            },
            '預覽重新回答',
          ),
          h(
            'button',
            {
              className: 'dpl-btn',
              disabled: busy || row.state === 'closed',
              onClick: () => {
                P(null);
                C({ id: row.id, revision: row.revision, code: row.code });
              },
            },
            '結束此話題',
          ),
        ),
      ),
    ),
    closing
      ? h(
          'div',
          { className: 'dpl-note' },
          h(
            'p',
            null,
            '結束 #' +
              closing.code +
              ' 會取消此來源的待回覆／延後工作，不刪除 Discord 訊息、記憶或已送出的內容。交付中可能已送達。',
          ),
          h(
            'button',
            {
              className: 'dpl-btn dpl-btn-danger',
              disabled: busy,
              onClick: () =>
                run(async () => {
                  const result = await api('/conversation/close', {
                    method: 'POST',
                    body: { topicId: closing.id, expectedRevision: closing.revision, confirmed: true },
                  });
                  C(null);
                  return result;
                }),
            },
            '確認結束此話題',
          ),
          h('button', { className: 'dpl-btn', disabled: busy, onClick: () => C(null) }, '返回，不結束'),
        )
      : null,
    plan
      ? h(
          'div',
          { className: 'dpl-note' },
          h(
            'p',
            null,
            plan.action === 'defer'
              ? '預定時間：' +
                  new Intl.DateTimeFormat('zh-Hant', {
                    timeZone: 'Asia/Taipei',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(plan.dueAt) +
                  '（Asia/Taipei）'
              : '將重新讀取原問題並重新回答，不保證繞過冷卻／預算。',
          ),
          h('p', null, '確認碼：' + plan.code + '；五分鐘內有效，來源或會話改變即失效。'),
          h(
            'button',
            {
              className: 'dpl-btn',
              disabled: busy,
              onClick: () =>
                run(async () => {
                  const current = plan;
                  P(null);
                  return api('/conversation/confirm', {
                    method: 'POST',
                    body: { planId: current.id, code: current.code },
                  });
                }),
            },
            '確認執行此安排',
          ),
          h('button', { className: 'dpl-btn', disabled: busy, onClick: () => P(null) }, '返回，不執行'),
        )
      : null,
    data && !rows.length ? h('p', { role: 'status' }, '目前沒有符合條件的話題。') : null,
    notice ? h('p', { role: 'status' }, notice) : null,
    error ? h('p', { role: 'alert' }, error) : null,
    data?.lastError ? h('p', { role: 'alert' }, data.lastError) : null,
  );
}
// ---- 21-capabilities.js
function CapabilitiesPanel({ onNavigate }) {
  const [data, D] = useState(null),
    [error, E] = useState(''),
    [busy, W] = useState(false),
    [category, C] = useState('all'),
    [query, Q] = useState(''),
    [attention, A] = useState(false);
  const load = async (force = false) => {
    W(true);
    E('');
    try {
      D(await api('/capabilities' + (force ? '?refresh=1' : '')));
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const categories = [
    ['all', '全部'],
    ['tts', '語音合成'],
    ['stt', '語音辨識'],
    ['memory', '記憶'],
    ['knowledge', '查詢'],
    ['music', '音樂'],
    ['singing', '唱歌'],
    ['delivery', '通訊交付'],
    ['mood', '心情'],
    ['schedule', '排程'],
  ];
  const readiness = {
    ready: '服務回報就緒',
    blocked: '尚未就緒',
    unknown: '尚未確認設定',
    preparing: '準備中',
    delegated: '外部插件自行處理',
    unsupported: '目前接口不支援',
  };
  const proof = (value) =>
    ({
      passed: '最近一次呼叫成功',
      failed: '最近一次呼叫失敗',
      unconfirmed: '有回傳，結果未確認',
      stale: '舊證據，需重新核對',
      'not-run': '尚無本次啟動的呼叫紀錄',
    })[value] || '尚未確認';
  const operations = {
    'synthesize-audio': '取得完整合成音訊',
    'stream-audio': '完整消費音訊串流',
    transcribe: '取得辨識文字',
    'transcribe-recording': '取得錄音辨識文字',
    'memory-write': '外部記憶寫入回執',
    'knowledge-tool': '查詢工具回傳資料',
    'load-audio': '取得音樂音訊',
    'search-music': '音樂搜尋回傳結果（尚非播放）',
    'read-library': '曲庫回傳結果（尚非取得音訊）',
    'environment-check': '檢查翻唱環境（尚非合成）',
    'voice-transmission': '單次 Discord 本機語音傳輸',
    'create-schedule': '建立排程，尚非到期喚醒',
  };
  const rows = (data?.rows || []).filter((row) => {
    const text = [
        row.name,
        row.id,
        row.selection,
        row.detail,
        row.issue?.summary,
        row.issue?.code,
        row.issue?.permission,
        ...(row.features || []).map((f) => f.label),
      ].join(' '),
      q = query.trim().toLocaleLowerCase();
    return (
      (category === 'all' || row.category === category) &&
      (!attention || row.issue || ['blocked', 'unsupported', 'preparing'].includes(row.readiness)) &&
      (!q || [text, uiLocale.convert(text)].some((t) => t.toLocaleLowerCase().includes(q)))
    );
  });
  return h(
    Card,
    {
      title: '外部能力狀態與失敗診斷',
      desc: '安裝、載入、設定就緒、模擬及實際呼叫是不同證據；此頁不試用服務、不建立工作。',
    },
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'button',
        { className: 'dpl-btn', disabled: busy, onClick: () => load(true) },
        busy ? '讀取狀態中…' : '更新能力狀態（不試用服務）',
      ),
      h(
        'span',
        { className: 'dpl-note' },
        data?.checkedAt ? '狀態時間：' + new Date(data.checkedAt).toLocaleString() : '尚未讀取',
      ),
    ),
    h('input', {
      className: 'dpl-input',
      'aria-label': '搜尋外部能力',
      placeholder: '搜尋插件、能力或接口名稱',
      value: query,
      onChange: (e) => Q(e.target.value),
    }),
    h(
      'div',
      { className: 'dpl-actions', role: 'group', 'aria-label': '外部能力分類' },
      categories.map(([id, label]) =>
        h(
          'button',
          { key: id, className: 'dpl-btn', 'aria-pressed': category === id, onClick: () => C(id) },
          label,
        ),
      ),
    ),
    h(
      'label',
      null,
      h('input', { type: 'checkbox', checked: attention, onChange: (e) => A(e.target.checked) }),
      ' 只看需要處理的項目',
    ),
    data && !data.inventoryKnown
      ? h(
          'p',
          { role: 'status', className: 'dpl-note' },
          '宿主安裝清單暫時無法讀取；顯示未知，不會把工具存在當成已安裝證明。',
        )
      : null,
    data?.receivePolicy
      ? h(
          'details',
          null,
          h('summary', null, '目前語音收聽對象與費用'),
          h(
            'p',
            null,
            data.receivePolicy.enabled
              ? '收聽開關已啟用；還需同意與加入房間。'
              : '收聽關閉，待在房內不會因此自動辨識。',
          ),
          h(
            'p',
            null,
            data.receivePolicy.onlyAdmin
              ? '目前允許名單只有管理者。'
              : '目前明確允許 ' + data.receivePolicy.allowedCount + ' 位使用者；空名單不收聽。',
          ),
          h(
            'p',
            null,
            'AI 自動回覆：' +
              (data.receivePolicy.autoReply
                ? '已啟用，每次有效發言可能呼叫模型'
                : '關閉，不因單純辨識呼叫回覆模型') +
              '；每日 STT 提交上限：' +
              (data.receivePolicy.dailySeconds ? data.receivePolicy.dailySeconds + ' 秒' : '不限'),
          ),
          h('p', null, data.receivePolicy.note),
        )
      : null,
    h(
      'p',
      { className: 'dpl-note' },
      '介面契約模擬通過只涵蓋本插件介面卡，不等於外部引擎、帳號或全部功能實測。最近呼叫成功也不代表所有會話／工作區可用、Discord 成員實際聽到，或記憶已完成全部提煉。',
    ),
    rows.map((row) =>
      h(
        'article',
        { key: row.id, className: 'dpl-asset', style: { minWidth: 0, overflowWrap: 'anywhere' } },
        h('strong', null, row.name),
        h('p', null, row.selection || row.id),
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))',
              gap: 8,
            },
          },
          h(
            'p',
            null,
            '安裝：' +
              { yes: '已安裝／隨宿主提供', no: '尚未安裝', unknown: '宿主清單未列出' }[
                row.presence?.installed || 'unknown'
              ],
          ),
          h(
            'p',
            null,
            '載入：' +
              { yes: '已載入', no: '未載入', loading: '載入中', unknown: '未確認' }[
                row.presence?.loaded || 'unknown'
              ],
          ),
          h('p', null, '設定：' + (readiness[row.readiness] || '未確認')),
          h(
            'p',
            null,
            '介面契約模擬：' +
              (row.verification?.contract?.state === 'passed'
                ? '通過'
                : row.verification?.contract?.state === 'stale'
                  ? '來源已變更，待重測'
                  : '尚未核對'),
          ),
          h('p', null, '實際呼叫：' + proof(row.verification?.runtime?.state)),
        ),
        h(
          'p',
          null,
          '接口：' +
            (row.registered ? '已註冊／可見' : '尚未確認註冊') +
            (row.enabled === null
              ? ''
              : row.enabled
                ? '；Discord 相關功能已啟用'
                : '；Discord 相關功能未啟用'),
        ),
        h('p', null, row.detail),
        row.allowedFor
          ? h(
              'p',
              null,
              '目前允許 AI 使用的對象：' +
                (row.allowedFor.length
                  ? row.allowedFor
                      .map(
                        (id) =>
                          ({
                            adminDm: '管理者私訊',
                            adminGroup: '管理者群聊',
                            othersDm: '其他使用者私訊',
                            othersGroup: '其他使用者群聊',
                          })[id],
                      )
                      .join('、')
                  : '尚未授權，或目前不是 DSH 正式會話模式'),
            )
          : null,
        h(
          'div',
          { className: 'dpl-actions' },
          (row.features || []).map((f) =>
            h(
              'span',
              {
                key: f.id,
                className: 'dpl-badge',
                style: { whiteSpace: 'normal', maxWidth: '100%', overflowWrap: 'anywhere' },
              },
              f.label + '：' + (f.supported === true ? '是' : f.supported === false ? '否' : '待確認'),
            ),
          ),
        ),
        row.verification?.runtime?.at
          ? h(
              'p',
              { className: 'dpl-note' },
              (operations[row.verification.runtime.operation] || row.verification.runtime.operation) +
                ' · ' +
                new Date(row.verification.runtime.at).toLocaleString(),
            )
          : null,
        row.verification?.simulation?.state !== 'not-run'
          ? h(
              'p',
              { className: 'dpl-note' },
              '隔離模擬紀錄：' + proof(row.verification?.simulation?.state) + '；不計入實際呼叫。',
            )
          : null,
        row.verification?.runtime?.state === 'stale' && row.verification.runtime.issue
          ? h(
              'p',
              { className: 'dpl-note' },
              '舊範圍的呼叫失敗原因：' +
                row.verification.runtime.issue.summary +
                '；請勿據此推定目前設定仍失敗。',
            )
          : null,
        row.issue
          ? h(
              'div',
              { className: 'dpl-note', role: 'status' },
              h('strong', null, row.issue.summary),
              h('p', null, row.issue.fix),
              row.issue.permission ? h('p', null, '需檢查權限：' + row.issue.permission) : null,
              row.issue.httpStatus ? h('p', null, '服務狀態：HTTP ' + row.issue.httpStatus) : null,
            )
          : null,
        h('button', { className: 'dpl-btn', onClick: () => onNavigate(row.section) }, '前往相關設定'),
      ),
    ),
    data && !rows.length ? h('p', { role: 'status' }, '沒有符合條件的能力，請調整分類或搜尋。') : null,
    data?.note ? h('p', { className: 'dpl-note' }, data.note) : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}
// ---- 22-singing.js
function SingingGuide({ onNavigate }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [diagnostic, setDiagnostic] = useState(null),
    [checking, setChecking] = useState(false);
  const load = async () => {
    try {
      setData((await api('/singing')).singing);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const names = {
    video_info: '讀取歌曲來源',
    video_download: '下載公開音源',
    cover_doctor: '檢查翻唱引擎',
    cover_separate: '分離人聲／伴奏',
    cover_shift: '調整音高',
    cover_convert: '轉換演唱音色',
    cover_mix: '混音',
    cover_verify: '驗證成品',
  };
  const example =
    '請幫我翻唱〈歌名〉：先在 YouTube 找到這首歌讓我確認，再用已配置的音色做 25 秒試唱，回傳到目前 Discord 頻道；等我確認後再做整曲。';
  return h(
    Card,
    { title: '唱歌與翻唱導覽', desc: '找歌和下載音源已經內建；把歌聲換成指定音色的「翻唱引擎」需要另外安裝。' },
    h('p', null, 'TTS 負責說話；唱歌需要原唱／人聲與翻唱引擎，不能只把歌詞送進一般 TTS。'),
    h(
      'ol',
      null,
      h('li', null, '安裝並載入翻唱插件 dsh-cover-pipeline，在它的設定裡準備好推理引擎與音色。找歌與下載音源不用另外安裝。'),
      h(
        'li',
        null,
        '在上方打開「管理者可以在私訊請 AI 唱歌」並儲存。想在群聊用，另外打開「管理者可以在群聊請 AI 唱歌」；想開放給特定群友，把他們加進「哪些群友可以請 AI 唱歌」。沒被加進去的人不會因此能用。',
      ),
      h('li', null, '告訴 AI 歌名，或直接貼上歌曲網址。只給歌名時，AI 會先在 YouTube 找出幾首候選讓你確認是哪一首，再試唱 25 秒。'),
      h('li', null, '聽過試唱並明確確認同一音源、音色及移調後，才能製作整曲。'),
      h('li', null, '回傳目前文字頻道，或播放到已加入且綁定該文字頻道的語音房；不會自行加入任意房間。'),
    ),
    h(
      'details',
      null,
      h('summary', null, '使用自己訓練的聲音'),
      h(
        'p',
        null,
        '若想要用自己訓練的聲音，請參考 ',
        h(
          'a',
          {
            href: 'https://github.com/InariNGT-Ofiicial/dsh-train-pipeline',
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          'dsh-train-pipeline 音色訓練插件',
        ),
        '。',
      ),
      h(
        'p',
        null,
        '訓練與短句試聽完成後，使用 train_register 註冊模型及配套設定，再讓 cover-pipeline 重新載入音色。訓練、翻唱與 Discord 交付各自獨立；註冊成功不等於音質已通過驗收。',
      ),
    ),
    h(
      'div',
      { className: 'dpl-actions' },
      h('button', { className: 'dpl-btn', onClick: load }, '更新唱歌能力'),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: checking,
          onClick: async () => {
            setChecking(true);
            setError('');
            try {
              setDiagnostic((await api('/singing/doctor', { method: 'POST', body: {} })).diagnostic);
            } catch (e) {
              setError(e.message);
            } finally {
              setChecking(false);
            }
          },
        },
        checking ? '檢查中…' : '檢查翻唱環境',
      ),
      h('button', { className: 'dpl-btn', onClick: () => onNavigate('voice') }, '前往語音房設定'),
      h('button', { className: 'dpl-btn', onClick: () => onNavigate('sessions') }, '前往 DSH 會話設定'),
    ),
    h(
      'p',
      { className: 'dpl-note' },
      '目前狀態：' +
        (data?.enabled ? '唱歌功能已開啟' : '唱歌功能還沒開啟') +
        '。下面顯示「工具已載入」只代表翻唱插件有裝好，不代表引擎、模型和音色都準備好了；這一頁不會下載歌曲或啟動模型。',
    ),
    diagnostic
      ? h(
          'div',
          { role: 'status' },
          h(
            'p',
            null,
            diagnostic.ready ? '環境檢查通過，仍需先試唱確認音質。' : '環境尚未就緒，請依下方缺項修復。',
          ),
          diagnostic.checks.map((check, i) =>
            h(
              'p',
              { key: i },
              check.name +
                ' · ' +
                (check.ok ? '通過' : '未通過') +
                ' · ' +
                check.detail +
                (check.fix ? ' · ' + check.fix : ''),
            ),
          ),
        )
      : null,
    (data?.tools || []).map((row) =>
      h(
        'div',
        { className: 'dpl-list-row', key: row.name },
        h('span', null, names[row.name] || row.name),
        h('span', { className: 'dpl-badge' }, row.builtin ? '已內建' : row.registered ? '工具已載入' : '尚未載入'),
      ),
    ),
    h(
      'details',
      null,
      h('summary', null, '用自然語言安排試唱'),
      h('p', null, example),
      h(
        'button',
        {
          className: 'dpl-btn',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(example);
              setNotice('已複製試唱範例');
            } catch {
              setNotice('無法存取剪貼簿，請手動複製上方文字');
            }
          },
        },
        '複製試唱範例',
      ),
    ),
    h(
      'details',
      null,
      h('summary', null, '目前歌曲工作與停止方式'),
      (data?.jobs || []).length
        ? data.jobs.map((job) =>
            h(
              'div',
              { key: job.id, className: 'dpl-asset' },
              h('p', null, job.id + ' · ' + phaseLabel(job.state) + ' · ' + (names[job.stage] || job.stage)),
              h(
                'button',
                {
                  className: 'dpl-btn',
                  disabled: !['queued', 'running', 'cancelling'].includes(job.state),
                  onClick: async () => {
                    try {
                      await api('/singing/cancel', { method: 'POST', body: { id: job.id } });
                      setNotice('已要求停止歌曲工作；等待外部程序結束前不會交付');
                      await load();
                    } catch (e) {
                      setError(e.message);
                    }
                  },
                },
                '停止此歌曲工作',
              ),
            ),
          )
        : h(
            'p',
            null,
            '目前沒有歌曲工作。可在同一會話要求 song_cover_status／song_cover_cancel 查詢或取消；送達結果不明時不會自動重送。',
          ),
    ),
    notice ? h('p', { role: 'status' }, notice) : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}
// ---- 23-interaction.js
function InteractionConsole({ onNavigate }) {
  const [data, D] = useState(null),
    [state, S] = useState(null),
    [sessions, B] = useState([]),
    [error, E] = useState(''),
    [notice, N] = useState(''),
    [busy, W] = useState(false);
  const [kind, K] = useState('bot'),
    [channel, C] = useState(''),
    [user, U] = useState(''),
    [message, M] = useState(''),
    [mode, O] = useState('normal'),
    [minutes, T] = useState('30'),
    [binding, Q] = useState('');
  const load = async () => {
    const [a, b, c] = await Promise.all([api('/interaction'), api('/companion'), api('/sessions')]);
    D(a);
    S(b);
    B(c.sessions || []);
  };
  useEffect(() => {
    load().catch((e) => E(e.message));
  }, []);
  const run = async (fn, text) => {
    W(true);
    E('');
    N('');
    try {
      await fn();
      N(text);
      await load();
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  const input = (label, value, set) =>
    h(
      'label',
      null,
      label,
      h('input', {
        className: 'dpl-input',
        'aria-label': label,
        value,
        onChange: (e) => set(e.target.value),
      }),
    );
  return h(
    Card,
    { title: '陪伴模式、心情與訊息診斷', desc: '這些控制只管理訊息與交付，不建立另一套人格或心情引擎。' },
    h(
      'button',
      { className: 'dpl-btn', disabled: busy, onClick: () => run(load, '已更新狀態') },
      '更新互動狀態',
    ),
    h(
      'details',
      null,
      h('summary', null, '設定對話模式／安排延後回覆'),
      h(
        'label',
        null,
        '操作帳號',
        h(
          'select',
          {
            className: 'dpl-select',
            'aria-label': '操作帳號',
            value: kind,
            onChange: (e) => K(e.target.value),
          },
          h('option', { value: 'bot' }, '機器人'),
          h('option', { value: 'user' }, '使用者帳號'),
        ),
      ),
      input('對話文字頻道 ID', channel, C),
      input('對話使用者 ID', user, U),
      h(
        'label',
        null,
        '對話模式',
        h(
          'select',
          {
            className: 'dpl-select',
            'aria-label': '對話模式',
            value: mode,
            onChange: (e) => O(e.target.value),
          },
          [
            ['normal', '正常回覆'],
            ['listen', '只聽，不自動回覆'],
            ['text', '文字優先，不播放語音'],
            ['quiet', '安靜陪伴，只回文字'],
          ].map(([v, l]) => h('option', { key: v, value: v }, l)),
        ),
      ),
      input('時間（分鐘）', minutes, T),
      h(
        'p',
        { className: 'dpl-row-help' },
        '模式期限 0 代表直到手動恢復；排程需 1–10080 分鐘。排程由 DSH 宿主負責，插件不另建長期計時器；到期喚醒與回覆可能分別使用模型額度。',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !channel || !user,
          onClick: () =>
            run(
              () =>
                api('/companion/mode', {
                  method: 'POST',
                  body: { kind, channelId: channel, userId: user, mode, minutes: Number(minutes) },
                }),
              '對話模式已套用',
            ),
        },
        '套用對話模式',
      ),
      input('要延後回覆的原訊息 ID', message, M),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !channel || !message || !state?.schedulerAvailable,
          onClick: () =>
            run(
              () =>
                api('/companion/schedule', {
                  method: 'POST',
                  body: {
                    kind,
                    channelId: channel,
                    messageId: message,
                    type: 'defer',
                    afterMinutes: Number(minutes),
                  },
                }),
              '已交給 DSH 排程；到時會重新核對原訊息',
            ),
        },
        '安排延後回覆',
      ),
      h(
        'p',
        null,
        '主動關心必須先儲存上方開關，對方在該頻道輸入 !陪伴 同意；輸入 !陪伴 停止即可撤回。管理者本人也可使用下方按鈕確認。未回覆不追問。',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !channel || !user,
          onClick: () =>
            run(
              () =>
                api('/companion/consent', {
                  method: 'POST',
                  body: { kind, channelId: channel, userId: user },
                }),
              '已記錄管理者本人同意',
            ),
        },
        '管理者本人同意一次關心',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !channel || !message || !state?.schedulerAvailable,
          onClick: () =>
            run(
              () =>
                api('/companion/schedule', {
                  method: 'POST',
                  body: {
                    kind,
                    channelId: channel,
                    messageId: message,
                    type: 'checkin',
                    afterMinutes: Number(minutes),
                  },
                }),
              '已安排一次關心；不會自動追問',
            ),
        },
        '安排一次主動關心',
      ),
      !state?.schedulerAvailable
        ? h('p', { role: 'status' }, 'DSH 排程服務尚未就緒，不能建立定時工作。')
        : null,
    ),
    h(
      'details',
      null,
      h('summary', null, '未完成工作與取消'),
      (state?.jobs || []).length
        ? state.jobs.map((job) =>
            h(
              'div',
              { className: 'dpl-asset', key: job.id },
              h(
                'p',
                null,
                (job.type === 'defer' ? '延後回覆' : '一次關心') +
                  ' · ' +
                  nameOfId(job.channelId) +
                  ' · ' +
                  phaseLabel(job.state),
              ),
              job.error ? h('p', null, job.error) : null,
              h(
                'button',
                {
                  className: 'dpl-btn',
                  disabled: busy || ['cancelled', 'delivered', 'skipped', 'failed'].includes(job.state),
                  onClick: () =>
                    run(
                      () => api('/companion/cancel', { method: 'POST', body: { id: job.id } }),
                      '已停止此工作交付',
                    ),
                },
                '取消此工作',
              ),
              h(
                'button',
                {
                  className: 'dpl-btn',
                  disabled:
                    busy || !['delivered', 'skipped', 'failed', 'cancelled', 'draft'].includes(job.state),
                  onClick: () =>
                    run(
                      () => api('/companion/forget', { method: 'POST', body: { id: job.id } }),
                      '已清理此結束工作；每日額度與未回覆限制仍保留',
                    ),
                },
                '清理已結束工作',
              ),
            ),
          )
        : h('p', null, '目前沒有延後／關心工作。'),
    ),
    h(
      'details',
      null,
      h('summary', null, 'dsh-feiyu-mood 心情綁定'),
      h(
        'p',
        null,
        '原生 Agent 沿用已載入心情插件的注入規則；自訂模型只讀已有快照，不自行判斷心情。不借用其他對話的最近心情，也不複製私人事件理由。',
      ),
      h(
        'select',
        {
          className: 'dpl-select',
          'aria-label': '檢查心情的 DSH 會話',
          value: binding,
          onChange: (e) => Q(e.target.value),
        },
        h('option', { value: '' }, '選擇已綁定的 Discord 會話'),
        sessions.map((row) => h('option', { key: row.key, value: row.key }, row.title || row.sessionId)),
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !binding,
          onClick: () =>
            run(() => api('/mood/check', { method: 'POST', body: { key: binding } }), '已唯讀核對心情綁定'),
        },
        '檢查此會話的心情',
      ),
      h(
        'p',
        { role: 'status' },
        data?.mood?.available
          ? '綁定快照可讀：' + data.mood.label + ' · ' + data.mood.mood + '/100'
          : data?.mood?.reason || '尚未檢查心情綁定',
      ),
    ),
    h(
      'details',
      null,
      h('summary', null, '可用的外部唯讀知識工具'),
      h(
        'p',
        null,
        '在各對象設定啟用通用唯讀知識查詢；私人知識只限管理者私訊，群聊只使用宣告公開資料的來源。',
      ),
      (data?.knowledge || []).length
        ? data.knowledge.map((row) =>
            h(
              'p',
              { key: row.name },
              row.name +
                ' · ' +
                (row.eligible ? (row.publicData ? '可查公開資料' : '管理者私訊限定') : row.reason),
            ),
          )
        : h('p', null, '尚未發現符合契約的知識工具；請先載入來源插件。'),
      h('button', { className: 'dpl-btn', onClick: () => onNavigate('adminDm') }, '前往管理者私訊授權'),
    ),
    h(
      'details',
      null,
      h('summary', null, '最近訊息的處理原因'),
      h('p', null, '只列訊息 ID、階段與原因，不複製私人正文。'),
      (data?.interaction?.trace || [])
        .slice(0, 50)
        .map((row) =>
          h(
            'p',
            { key: row.id },
            row.messageId +
              ' · ' +
              row.transport +
              ' · ' +
              phaseLabel(row.phase) +
              ' · ' +
              (row.reason || '—'),
          ),
        ),
    ),
    notice ? h('p', { role: 'status' }, notice) : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}
// ---- 24-external-memory.js
function ExternalMemoryPanel() {
  const [data, D] = useState(null),
    [target, T] = useState(''),
    [action, A] = useState('forget'),
    [body, B] = useState(''),
    [plan, P] = useState(null),
    [error, E] = useState(''),
    [busy, W] = useState(false),
    [notice, N] = useState(''),
    [check, C] = useState(null);
  const seq = useRef(0);
  const load = async () => {
    const id = ++seq.current;
    const value = await api('/memory-maintenance');
    if (id === seq.current) D(value);
  };
  useEffect(() => {
    load().catch((e) => E(e.message));
    return () => {
      seq.current++;
    };
  }, []);
  const run = async (fn) => {
    W(true);
    E('');
    N('');
    try {
      await fn();
      await load();
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  const row = data?.targets?.find((r) => r.key === target),
    cap = data?.contracts?.find((r) => r.id === row?.writer),
    supported = !!cap?.actions?.[action]?.supported;
  const change = (set, value) => {
    set(value);
    P(null);
    C(null);
  };
  return h(
    Card,
    {
      title: '外部記憶維護能力與回執',
      desc: '先確認原插件支援的效果，再選擇本插件曾收到寫入回執的記憶。只安裝或支援召回，不代表可以修改／刪除。',
    },
    h(
      'button',
      {
        className: 'dpl-btn',
        disabled: busy,
        onClick: () =>
          run(async () => {
            P(null);
            C(null);
            N('已更新記憶維護能力');
          }),
      },
      '更新記憶維護能力',
    ),
    h(
      'details',
      null,
      h('summary', null, '各記憶插件支援哪些操作'),
      (data?.contracts || []).map((c) =>
        h(
          'article',
          { key: c.id, className: 'dpl-asset' },
          h('strong', null, c.name),
          h(
            'p',
            null,
            ['correct', 'forget', 'delete']
              .map(
                (a) =>
                  ({ correct: '更正', forget: '忘記', delete: '永久刪除' })[a] +
                  '：' +
                  (c.actions[a].supported ? phaseLabel(c.actions[a].effect) : '未提供可用契約'),
              )
              .join(' · '),
          ),
          h('p', { className: 'dpl-note' }, c.note),
        ),
      ),
    ),
    h(
      'label',
      null,
      '選擇外部記憶回執',
      h(
        'select',
        {
          className: 'dpl-select',
          'aria-label': '選擇外部記憶回執',
          value: target,
          onChange: (e) => change(T, e.target.value),
        },
        h('option', { value: '' }, '請選擇要處理的一筆記憶'),
        (data?.targets || []).map((r) =>
          h('option', { key: r.key, value: r.key }, r.writer + ' · ' + r.memoryId + ' · ' + r.channelId),
        ),
      ),
    ),
    row
      ? h(
          'p',
          { className: 'dpl-note' },
          row.note +
            '；原會話：' +
            (row.sessionId || '缺少') +
            '；作用域：' +
            (row.scopeKey || '舊回執未提供'),
        )
      : null,
    h(
      'label',
      null,
      '外部記憶操作',
      h(
        'select',
        {
          className: 'dpl-select',
          'aria-label': '外部記憶操作',
          value: action,
          onChange: (e) => change(A, e.target.value),
        },
        h('option', { value: 'forget' }, '忘記（依契約歸檔／停止召回）'),
        h('option', { value: 'correct' }, '更正整筆記憶正文'),
        h('option', { value: 'delete' }, '永久刪除指定記憶'),
      ),
    ),
    action === 'correct'
      ? h('textarea', {
          className: 'dpl-textarea',
          'aria-label': '外部記憶更正正文',
          placeholder: '請填完整的新記憶正文；不會自動把單則來源文字覆蓋到整筆記憶',
          value: body,
          onChange: (e) => change(B, e.target.value),
        })
      : null,
    row && !supported
      ? h('p', { role: 'status' }, '此插件未提供所選操作；請到原插件處理，不會以歸檔代替永久刪除。')
      : null,
    row?.blocked ? h('p', { role: 'status' }, '此筆記憶有結果未確認的操作，請先到原插件核對。') : null,
    h(
      'button',
      {
        className: 'dpl-btn',
        disabled:
          busy ||
          !row ||
          !supported ||
          !row.scopeVerified ||
          row.blocked ||
          (action === 'correct' && !body.trim()),
        onClick: () =>
          run(async () => {
            P(
              await api('/memory-maintenance/external/preview', {
                method: 'POST',
                body: { targetKey: target, action, replacement: body },
              }),
            );
            C(null);
          }),
      },
      '預覽外部記憶操作',
    ),
    plan
      ? h(
          'div',
          { className: 'dpl-note' },
          h('p', null, plan.target.writer + ' · ' + plan.target.memoryId + ' · ' + plan.target.scopeKey),
          h('p', null, '預期效果：' + phaseLabel(plan.effect) + '；來源數：' + plan.target.evidenceCount),
          h('p', null, plan.warning),
          plan.replacement
            ? h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, plan.replacement)
            : null,
          h(
            'button',
            {
              className: 'dpl-btn dpl-btn-danger',
              disabled: busy,
              onClick: () =>
                run(async () => {
                  const p = plan;
                  P(null);
                  const r = await api('/memory-maintenance/external/apply', {
                    method: 'POST',
                    body: { id: p.id, confirmed: true },
                  });
                  N('本次外部結果：' + phaseLabel(r.receipt.status));
                }),
            },
            '確認執行外部記憶操作',
          ),
          h(
            'button',
            { className: 'dpl-btn', disabled: busy, onClick: () => P(null) },
            '返回，不修改外部記憶',
          ),
        )
      : null,
    !(data?.targets || []).length
      ? h('p', { role: 'status' }, '目前沒有可定位的外部寫入回執；正式會話自動捕獲的記憶需到原插件核對。')
      : null,
    h(
      'details',
      null,
      h('summary', null, '最近的維護回執'),
      (data?.receipts || []).map((r) =>
        h(
          'article',
          { key: r.id, className: 'dpl-asset' },
          h(
            'strong',
            null,
            (r.kind === 'external' ? '外部 ' + r.writer + ' · ' + r.memoryId : '本插件來源') +
              ' · ' +
              phaseLabel(r.status),
          ),
          h('p', null, r.detail || '本插件來源處理回執'),
          (r.layers || []).map((layer, i) =>
            h(
              'p',
              { key: i },
              layer.layer + ' · ' + phaseLabel(layer.status) + (layer.detail ? ' · ' + layer.detail : ''),
            ),
          ),
          r.proposalId ? h('p', null, '靈樞提案：' + r.proposalId) : null,
          r.status === 'pending_review'
            ? h(
                'button',
                {
                  className: 'dpl-btn',
                  disabled: busy,
                  onClick: () =>
                    run(async () => {
                      const out = await api('/memory-maintenance/external/reconcile', {
                        method: 'POST',
                        body: { id: r.id },
                      });
                      N('核對結果：' + phaseLabel(out.receipt.status));
                    }),
                },
                '核對待審結果（不自動核准）',
              )
            : null,
          r.diagnostic ? h('p', null, r.diagnostic.summary + '；' + r.diagnostic.fix) : null,
          r.kind === 'external' && ['prepared', 'running', 'uncertain'].includes(r.status)
            ? h(
                'button',
                { className: 'dpl-btn', disabled: busy, onClick: () => C(r.id) },
                '我已到原插件核對',
              )
            : null,
        ),
      ),
    ),
    check
      ? h(
          'div',
          { className: 'dpl-note' },
          h(
            'p',
            null,
            '請先到原插件核對這筆操作是否已生效。此標記只解除重試鎖定，不代表插件驗證成功；不會自動重送。',
          ),
          h(
            'button',
            {
              className: 'dpl-btn',
              disabled: busy,
              onClick: () =>
                run(async () => {
                  await api('/memory-maintenance/external/acknowledge', {
                    method: 'POST',
                    body: { id: check, confirmed: true },
                  });
                  C(null);
                  N('已記錄人工核對，不自動重送');
                }),
            },
            '確認已核對原插件',
          ),
          h('button', { className: 'dpl-btn', disabled: busy, onClick: () => C(null) }, '返回，保留鎖定'),
        )
      : null,
    notice ? h('p', { role: 'status' }, notice) : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}
// ---- 25-meme-images.js
function MemeImagesPanel({ onNavigate }) {
  const [data, D] = useState(null),
    [error, E] = useState(''),
    [busy, W] = useState(false);
  const load = async () => {
    W(true);
    E('');
    try {
      D(await api('/meme-images'));
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  return h(
    Card,
    {
      title: 'dsh-meme 表情圖片',
      desc: '由外部圖庫選圖，Discord上傳圖片附件；對方不需要安裝dsh-meme，不會只收到[表情:…]代碼。',
    },
    h(
      'p',
      null,
      data?.available
        ? '圖庫服務已連接；是否發圖仍依各對象開關、機率與冷卻。'
        : '尚未取得dshMeme v1服務，請先載入dsh-meme。',
    ),
    h('button', { className: 'dpl-btn', disabled: busy, onClick: load }, '更新表情圖庫清單'),
    h(
      'p',
      { className: 'dpl-note' },
      '圖庫與分類可在dsh-meme管理；此處填ID可進一步限制。每次最多一張、8MiB；不改Discord原生貼圖與GIF開關。',
    ),
    (data?.packs || []).map((p) =>
      h(
        'p',
        { key: p.id, style: { overflowWrap: 'anywhere' } },
        p.name + ' · ID：' + p.id + ' · ' + p.count + ' 張',
      ),
    ),
    h(
      'div',
      { className: 'dpl-actions' },
      [
        ['adminDm', '管理者私訊發圖開關'],
        ['adminGroup', '管理者群聊發圖開關'],
        ['othersDm', '其他人私訊發圖開關'],
        ['othersGroup', '其他人群聊發圖開關'],
      ].map(([id, text]) =>
        h('button', { key: id, className: 'dpl-btn', onClick: () => onNavigate(id) }, text),
      ),
    ),
    error ? h('p', { role: 'alert' }, error) : null,
  );
}
// ---- 26-memory-maintenance.js
function MemoryMaintenancePanel() {
  const [channel, C] = useState(''),
    [message, M] = useState(''),
    [action, A] = useState('forget'),
    [replacement, R] = useState(''),
    [plan, P] = useState(null),
    [result, S] = useState(null),
    [error, E] = useState(''),
    [busy, W] = useState(false);
  const change = (set, value) => {
    set(value);
    P(null);
  };
  const run = async (fn) => {
    W(true);
    E('');
    try {
      await fn();
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  return h(
    Card,
    {
      title: '更正／忘記來源與處理回執',
      desc: '先預覽各層範圍，再確認；不會假稱刪除 Discord 原訊息或所有外部記憶。',
    },
    h(
      'label',
      null,
      '來源頻道 ID',
      h('input', {
        className: 'dpl-input',
        'aria-label': '維護來源頻道 ID',
        value: channel,
        onChange: (e) => change(C, e.target.value),
      }),
    ),
    h(
      'label',
      null,
      '來源訊息 ID',
      h('input', {
        className: 'dpl-input',
        'aria-label': '維護來源訊息 ID',
        value: message,
        onChange: (e) => change(M, e.target.value),
      }),
    ),
    h(
      'select',
      {
        className: 'dpl-select',
        'aria-label': '記憶維護操作',
        value: action,
        onChange: (e) => change(A, e.target.value),
      },
      h('option', { value: 'forget' }, '忘記本插件來源'),
      h('option', { value: 'correct' }, '更正本插件來源'),
    ),
    action === 'correct'
      ? h('textarea', {
          className: 'dpl-textarea',
          'aria-label': '更正後的來源文字',
          value: replacement,
          onChange: (e) => change(R, e.target.value),
        })
      : null,
    h(
      'button',
      {
        className: 'dpl-btn',
        disabled: busy || !channel || !message || (action === 'correct' && !replacement.trim()),
        onClick: () =>
          run(async () => {
            P(
              await api('/memory-maintenance/preview', {
                method: 'POST',
                body: { channelId: channel, messageId: message, action, replacement },
              }),
            );
            S(null);
          }),
      },
      '預覽處理範圍',
    ),
    plan
      ? h(
          'div',
          { className: 'dpl-note' },
          plan.layers.map((row, i) =>
            h(
              'p',
              { key: i },
              row.layer +
                '：' +
                (row.supported ? '可處理 ' + row.affected + ' 項' : '不會自動處理') +
                (row.note ? ' · ' + row.note : ''),
            ),
          ),
          h(
            'button',
            {
              className: 'dpl-btn dpl-btn-danger',
              disabled: busy,
              onClick: () =>
                run(async () => {
                  S(
                    await api('/memory-maintenance/apply', {
                      method: 'POST',
                      body: { id: plan.id, confirmed: true },
                    }),
                  );
                  P(null);
                }),
            },
            '確認依此範圍處理',
          ),
        )
      : null,
    result
      ? h(
          'div',
          { role: 'status' },
          h(
            'p',
            null,
            '本次結果：' +
              phaseLabel(result.receipt.status) +
              '；請核對每層回執。外部記憶需在下方另外預覽並確認。',
          ),
          result.receipt.layers.map((row, i) =>
            h(
              'p',
              { key: i },
              row.layer + ' · ' + phaseLabel(row.status) + (row.detail ? ' · ' + row.detail : ''),
            ),
          ),
        )
      : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}

// ------------------------------------------------------------ history panel ---
// ---- 27-channel-actions.js
function ChannelActionsPanel({ config, onNavigate }) {
  const [kind, setKind] = useState('bot'),
    [channelId, setChannel] = useState(''),
    [action, setAction] = useState('search'),
    [data, setData] = useState(null),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [form, setForm] = useState({
    query: '',
    after: '',
    before: '',
    messageId: '',
    postId: '',
    destinationId: '',
    content: '',
    name: '',
    tags: '',
    tagsClear: false,
    archived: 'unchanged',
  });
  const reads = ['search', 'pins', 'info', 'archives', 'posts', 'post_read', 'members'],
    writes = ['pin', 'unpin', 'edit', 'delete', 'forward', 'join', 'leave', 'thread_edit', 'forum_create'];
  const labels = {
    search: '搜尋歷史',
    pins: '讀取置頂',
    info: '頻道與論壇標籤',
    archives: '公開封存討論串',
    posts: '論壇／媒體貼文索引',
    post_read: '讀取指定貼文',
    members: '討論串成員',
    pin: '置頂訊息',
    unpin: '取消置頂',
    edit: '修改自己的文字訊息',
    delete: '撤回自己的訊息',
    forward: '原生轉傳',
    join: '加入討論串',
    leave: '離開討論串',
    thread_edit: '修改討論串',
    forum_create: '建立論壇貼文',
  };
  const refresh = () =>
    api('/channel-actions')
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, []);
  const input = (key, label, type = 'text') =>
    h(
      'label',
      {
        className: 'dpl-row',
        key,
        style: {
          display: 'grid',
          gridTemplateColumns: 'minmax(110px,1fr) minmax(0,2fr)',
          gap: 12,
          alignItems: 'center',
        },
      },
      h('span', { className: 'dpl-row-label' }, label),
      h(type === 'textarea' ? 'textarea' : 'input', {
        className: 'dpl-input',
        type: type === 'textarea' ? undefined : type,
        value: form[key],
        onChange: (e) => setForm({ ...form, [key]: e.target.value }),
        style: { minWidth: 0, width: '100%', boxSizing: 'border-box' },
      }),
    );
  const run = async (path, body) => {
    setBusy(true);
    setError('');
    try {
      const r = await api('/channel-actions/' + path, { method: 'POST', body });
      setResult(path === 'query' ? { ...r, queried: body.action } : r);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    const b = { kind, channelId, action, limit: 20 };
    for (const key of ['query', 'messageId', 'destinationId', 'content', 'name'])
      if (form[key]) b[key] = form[key];
    if (['post_read', 'join', 'leave', 'thread_edit'].includes(action) && form.postId) b.postId = form.postId;
    for (const key of ['after', 'before'])
      if (form[key]) {
        const date = new Date(form[key]);
        if (!Number.isFinite(date.getTime())) {
          setError('日期格式無效');
          return;
        }
        b[key] = date.toISOString();
      }
    if (['thread_edit', 'forum_create'].includes(action) && form.tagsClear) b.tags = [];
    else if (['thread_edit', 'forum_create'].includes(action) && form.tags.trim())
      b.tags = form.tags.split(/[,，\s]+/).filter(Boolean);
    if (action === 'thread_edit' && form.archived !== 'unchanged') b.archived = form.archived === 'true';
    return run(reads.includes(action) ? 'query' : 'preview', b);
  };
  const argsView = (p) =>
    h(
      'div',
      null,
      h('p', null, '來源訊息：' + (p.args?.messageId || '無')),
      p.args?.postId ? h('p', null, '目標貼文／討論串：' + p.args.postId) : null,
      p.args?.destinationId ? h('p', null, '目的頻道：' + p.args.destinationId) : null,
      p.args?.name ? h('p', null, '名稱：' + p.args.name) : null,
      typeof p.args?.archived === 'boolean' ? h('p', null, '封存：' + (p.args.archived ? '是' : '否')) : null,
      p.args?.tags ? h('p', null, '標籤 ID：' + (p.args.tags.join('、') || '清除全部')) : null,
      p.args?.content
        ? h(
            'p',
            { 'data-ui-verbatim': true, style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
            p.args.content,
          )
        : null,
      p.sourcePreview
        ? h(
            'div',
            null,
            h('p', null, '原作者 ID：' + p.sourcePreview.authorId),
            h(
              'p',
              { 'data-ui-verbatim': true, style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
              p.sourcePreview.text || '無文字',
            ),
            p.sourcePreview.attachments?.length
              ? h('p', null, '附件：' + p.sourcePreview.attachments.join('、'))
              : null,
          )
        : null,
    );
  const isRead = reads.includes(action);
  const lookupOff = config && config.channelLookupEnabled === false;
  const writesOff = config && config.channelActionsEnabled === false;
  const choice = (list) =>
    h(
      'div',
      { className: 'dpl-actions' },
      list.map((a) =>
        h(
          'button',
          {
            className: 'dpl-btn dpl-btn-sm',
            type: 'button',
            key: a,
            'data-on': action === a,
            'aria-pressed': action === a,
            onClick: () => {
              setAction(a);
              setResult(null);
              setError('');
            },
          },
          labels[a],
        ),
      ),
    );
  const stateLabel = {
    succeeded: ['已完成', 'ok'],
    rejected: ['服務拒絕（未確認成功）', 'err'],
    running: ['執行中', 'warn'],
    uncertain: ['結果不明，請核對', 'warn'],
    acknowledged: ['已人工核對（不等於成功）', 'muted'],
  };
  const rows = result?.messages || [];
  const threads = result?.threads || [];
  // 查詢完成但沒有任何可列出的內容時，明確顯示「沒有結果」，與查詢失敗、功能未開啟區分。
  const emptyResult =
    result &&
    result.queried &&
    ['search', 'pins', 'archives', 'posts', 'post_read'].includes(result.queried) &&
    !rows.length &&
    !threads.length;

  return h(
    Card,
    {
      title: '訊息、論壇與討論串工作台',
      icon: 'chat',
      desc: '查詢只讀取指定頻道；會改動 Discord 的操作一律先產生預覽，由你確認後才執行。結果不明時請先到 Discord 核對，不會自動重試。',
    },
    h(
      'div',
      { className: 'dpl-row', 'data-type': 'select' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h('div', { className: 'dpl-row-label' }, '使用哪個帳號'),
        h('div', { className: 'dpl-row-help' }, '查詢與操作會以這個帳號的權限進行。'),
      ),
      h(
        'div',
        { className: 'dpl-row-control' },
        h(
          'div',
          { className: 'dpl-seg', role: 'group', 'aria-label': '使用哪個帳號' },
          ['bot', 'user'].map((k) =>
            h(
              'button',
              {
                type: 'button',
                'data-on': kind === k,
                'aria-pressed': kind === k,
                onClick: () => setKind(k),
                key: k,
              },
              k === 'bot' ? '機器人' : '使用者帳號',
            ),
          ),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dpl-row', 'data-type': 'string' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h('div', { className: 'dpl-row-label' }, '來源頻道 ID'),
        h('div', { className: 'dpl-row-help' }, '要查詢或操作的文字頻道、討論串或論壇。'),
      ),
      h(
        'div',
        { className: 'dpl-row-control', style: { flex: '1 1 260px', maxWidth: 420 } },
        h('input', {
          className: 'dpl-input',
          'data-mono': 'true',
          'aria-label': '來源頻道 ID',
          value: channelId,
          onChange: (e) => setChannel(e.target.value.trim()),
          placeholder: '目前操作的文字頻道、討論串或論壇 ID',
        }),
      ),
    ),

    h('div', { className: 'dpl-subhead' }, '查詢（不會改動 Discord）'),
    choice(reads),
    h('div', { className: 'dpl-subhead' }, '操作（先預覽，確認後才執行）'),
    choice(writes),

    isRead && lookupOff
      ? h(
          StateView,
          {
            kind: 'off',
            title: '查詢功能尚未開啟',
            action: onNavigate
              ? h(
                  'button',
                  { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: () => onNavigate('history') },
                  '前往聊天快取設定',
                )
              : null,
          },
          '需要先開啟「系統 → 聊天快取 → 允許 AI 查詢目前頻道置頂」並儲存。',
        )
      : null,
    !isRead && writesOff
      ? h(
          StateView,
          { kind: 'off', title: '訊息操作尚未開啟' },
          '請先開啟上方的「允許管理者確認訊息與討論串操作」並儲存；另外試跑模式與僅觀察模式下禁止寫入。',
        )
      : null,

    ['post_read', 'join', 'leave', 'thread_edit'].includes(action)
      ? input('postId', '父頻道內的貼文／討論串 ID（可選）')
      : null,
    action === 'search'
      ? [
          input('query', '搜尋文字'),
          input('after', '起始時間', 'datetime-local'),
          input('before', '結束時間', 'datetime-local'),
          h(
            'p',
            { key: 'search-hint', className: 'dpl-row-help' },
            '預設查詢近 30 天，最多 366 天、20 則。機器人搜尋歷史需要伺服器頻道與 Message Content Intent。',
          ),
        ]
      : null,
    ['pin', 'unpin', 'edit', 'delete', 'forward'].includes(action) ? input('messageId', '來源訊息 ID') : null,
    action === 'forward' ? input('destinationId', '目的頻道 ID') : null,
    ['edit', 'forum_create'].includes(action) ? input('content', '文字內容', 'textarea') : null,
    ['thread_edit', 'forum_create'].includes(action)
      ? [
          input('name', '討論串／貼文名稱'),
          input('tags', '論壇標籤 ID（逗號分隔）'),
          h(
            'button',
            {
              key: 'tags-clear',
              className: 'dpl-btn dpl-btn-sm',
              type: 'button',
              'data-on': form.tagsClear,
              'aria-pressed': form.tagsClear,
              onClick: () => setForm({ ...form, tagsClear: !form.tagsClear }),
            },
            form.tagsClear ? '已選取：清除全部標籤' : '清除全部論壇標籤',
          ),
          action === 'thread_edit'
            ? h(
                'div',
                { key: 'archived', className: 'dpl-seg', role: 'group', 'aria-label': '封存狀態' },
                [
                  ['unchanged', '封存狀態不變'],
                  ['true', '封存'],
                  ['false', '解除封存'],
                ].map(([v, l]) =>
                  h(
                    'button',
                    {
                      key: v,
                      type: 'button',
                      'data-on': form.archived === v,
                      'aria-pressed': form.archived === v,
                      onClick: () => setForm({ ...form, archived: v }),
                    },
                    l,
                  ),
                ),
              )
            : null,
        ]
      : null,
    h(
      'div',
      { className: 'dpl-actions', style: { marginTop: 10 } },
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-primary',
          disabled: busy || !channelId,
          onClick: submit,
        },
        busy ? '處理中…' : isRead ? '執行唯讀查詢' : '建立操作預覽',
      ),
      h(
        'button',
        { type: 'button', className: 'dpl-btn', disabled: busy, onClick: refresh },
        '重新整理操作紀錄',
      ),
      !channelId ? h('span', { className: 'dpl-sub' }, '請先填入來源頻道 ID。') : null,
    ),

    error ? h(StateView, { kind: 'error', title: isRead ? '查詢失敗' : '操作未完成' }, error) : null,
    data?.storageError
      ? h('p', { className: 'dpl-note', 'data-tone': 'err', role: 'alert' }, data.storageError)
      : null,
    result?.cacheOnly === true
      ? h(
          'p',
          { className: 'dpl-note', role: 'note' },
          '這是 SDK 快取中的貼文索引，可能尚未包含所有貼文；不代表完整即時清單。',
        )
      : null,
    emptyResult
      ? h(
          StateView,
          { kind: 'empty', title: '沒有結果' },
          result.cacheOnly
            ? '快取中目前沒有符合的貼文；稍後重試或改用機器人查詢。'
            : '查詢成功，但這個範圍內沒有符合的內容。',
        )
      : null,
    threads.length
      ? h(
          'div',
          { className: 'dpl-library-grid' },
          ...threads.map((post) =>
            h(
              'article',
              { className: 'dpl-asset', key: post.id },
              h('strong', { 'data-ui-verbatim': true }, post.name || post.id),
              h(
                'p',
                { className: 'dpl-mono' },
                'ID：' + post.id + ' · ' + (post.archived ? '已封存' : '使用中'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dpl-btn dpl-btn-sm',
                  disabled: busy,
                  onClick: () => {
                    setAction('post_read');
                    setForm({ ...form, postId: post.id });
                    run('query', { kind, channelId, action: 'post_read', postId: post.id, limit: 20 });
                  },
                },
                '讀取此貼文',
              ),
            ),
          ),
        )
      : null,
    rows.length
      ? h(
          'div',
          { className: 'dpl-hist-list', style: { maxHeight: 320 } },
          rows.map((m, index) =>
            h(
              'div',
              { className: 'dpl-list-row', key: m.id || index },
              h(
                'span',
                { className: 'dpl-hist-author', 'data-ui-verbatim': true },
                m.author?.name || m.author?.id || '未知',
              ),
              h(
                'span',
                {
                  'data-ui-verbatim': true,
                  style: { flex: '1 1 200px', minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
                },
                m.content || '（無文字）',
              ),
              m.id ? h('span', { className: 'dpl-mono' }, m.id) : null,
            ),
          ),
        )
      : null,
    result
      ? h(
          'details',
          { className: 'dpl-more' },
          h('summary', null, '原始回應'),
          h(
            'pre',
            {
              'data-ui-verbatim': true,
              style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 380, overflow: 'auto' },
            },
            JSON.stringify(result, null, 2),
          ),
        )
      : null,

    h('div', { className: 'dpl-subhead' }, '待確認操作（5 分鐘內有效）'),
    data === null && !error
      ? h(StateView, { kind: 'loading', title: '讀取操作紀錄…' })
      : (data?.plans || []).length
        ? null
        : h(
            StateView,
            { kind: 'empty', title: '沒有待確認的操作' },
            '選擇上方的操作並按「建立操作預覽」後，會出現在這裡等你確認。',
          ),
    ...(data?.plans || []).map((p) =>
      h(
        'article',
        { className: 'dpl-asset', key: p.id },
        h('strong', null, labels[p.action] || p.action),
        h(
          'p',
          { className: 'dpl-mono' },
          (p.kind === 'bot' ? '機器人' : '使用者帳號') + ' · 頻道 ' + p.channelId,
        ),
        argsView(p),
        p.warning ? h('p', { className: 'dpl-note' }, p.warning) : null,
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-primary',
            disabled: busy,
            onClick: () => run('confirm', { id: p.id, confirmed: true }),
          },
          '確認執行此操作',
        ),
      ),
    ),

    h('div', { className: 'dpl-subhead' }, '執行回報'),
    data !== null && !(data?.receipts || []).length
      ? h(
          StateView,
          { kind: 'empty', title: '尚無執行回報' },
          '確認執行過的操作會留下回報，顯示成功、被拒或結果不明。',
        )
      : null,
    ...(data?.receipts || [])
      .slice()
      .reverse()
      .map((r) => {
        const [text, tone] = stateLabel[r.state] || [r.state, 'muted'];
        return h(
          'article',
          { className: 'dpl-asset', key: r.id },
          h(
            'div',
            { className: 'dpl-actions' },
            h('strong', null, labels[r.action] || r.action),
            h(Pill, { tone }, text),
          ),
          h(
            'p',
            { className: 'dpl-mono' },
            (r.kind === 'bot' ? '機器人' : '使用者帳號') +
              ' · ' +
              nameOfId(r.channelId) +
              ' · ' +
              new Date(r.at).toLocaleString(),
          ),
          r.state === 'uncertain'
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dpl-btn',
                  disabled: busy,
                  onClick: () => run('acknowledge', { id: r.id, confirmed: true }),
                },
                '已核對 Discord，解除此操作鎖定',
              )
            : null,
        );
      }),
  );
}
// ---- 28-history.js
function HistoryPanel({ channels, historyStats, onOpen, onClear, messages, activeChannel, onClearChannel }) {
  // 全部清除無法復原：第一次按下只切換成確認狀態，五秒內再按一次才真的清除。
  const [confirmAll, setConfirmAll] = useState(false);
  useEffect(() => {
    if (!confirmAll) return undefined;
    const timer = setTimeout(() => setConfirmAll(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmAll]);
  const actions = activeChannel
    ? [
        h(
          'button',
          {
            key: 'back',
            type: 'button',
            className: 'dpl-btn dpl-btn-sm dpl-btn-ghost',
            onClick: () => onOpen(null),
          },
          '返回清單',
        ),
        h(
          'button',
          {
            key: 'clear',
            type: 'button',
            className: 'dpl-btn dpl-btn-sm dpl-btn-danger',
            onClick: () => onClearChannel(activeChannel),
          },
          Icon.trash({ size: 13 }),
          '清除此頻道',
        ),
      ]
    : [
        h(
          'button',
          {
            key: 'clear',
            type: 'button',
            className: 'dpl-btn dpl-btn-sm dpl-btn-danger',
            'aria-live': 'polite',
            onClick: () => {
              if (!confirmAll) return setConfirmAll(true);
              setConfirmAll(false);
              onClear();
            },
          },
          Icon.trash({ size: 13 }),
          confirmAll ? '再按一次確認清除全部' : '全部清除',
        ),
      ];

  const kpis = h(
    'div',
    { className: 'dpl-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))' } },
    h(
      'div',
      { className: 'dpl-kpi' },
      h('div', { className: 'dpl-kpi-label' }, '頻道數'),
      h('div', { className: 'dpl-kpi-value' }, fmtNum(historyStats?.channels ?? channels.length)),
    ),
    h(
      'div',
      { className: 'dpl-kpi' },
      h('div', { className: 'dpl-kpi-label' }, '訊息數'),
      h('div', { className: 'dpl-kpi-value' }, fmtNum(historyStats?.messages ?? 0)),
    ),
    h(
      'div',
      { className: 'dpl-kpi' },
      h('div', { className: 'dpl-kpi-label' }, '保留天數'),
      h('div', { className: 'dpl-kpi-value' }, fmtNum(historyStats?.retentionDays ?? 14)),
    ),
  );

  const messageRow = (entry) =>
    h(
      'div',
      { key: entry.id, className: 'dpl-hist-msg' },
      h('span', { className: 'dpl-mono' }, fmtTime(entry.ts)),
      h('span', { className: 'dpl-hist-author' }, entry.author?.name || '-'),
      h('span', { className: 'dpl-hist-text' }, entry.content || '[附件]'),
    );

  const channelRow = (channel) => {
    const id = String(channel.channelId || channel.id || '');
    const label = channel.channelName || id || '缺少頻道 ID';
    return h(
      'div',
      { key: id || label, className: 'dpl-list-row' },
      h(
        'div',
        {
          className: 'dpl-grow',
          'data-ui-verbatim': true,
          title: [channel.guildName, label, id].filter(Boolean).join(' · '),
        },
        h('span', { 'data-ui-verbatim': true }, label),
        id
          ? h(
              'small',
              { className: 'dpl-mono', 'data-ui-verbatim': true, style: { display: 'block', opacity: 0.7 } },
              id,
            )
          : null,
      ),
      h('span', { className: 'dpl-badge' }, `${channel.count} 則`),
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-sm dpl-btn-ghost',
          disabled: !id,
          title: id ? '查看此頻道的聊天快取' : '缺少頻道 ID，請重新整理',
          onClick: () => onOpen(id),
        },
        '查看',
      ),
    );
  };

  const body = activeChannel
    ? h(
        'div',
        { className: 'dpl-hist-list' },
        (messages || []).length
          ? (messages || []).map(messageRow)
          : h('div', { className: 'dpl-empty' }, '這個頻道還沒有記錄。'),
      )
    : h(
        'div',
        { className: 'dpl-hist-list' },
        (channels || []).length
          ? (channels || []).map(channelRow)
          : h('div', { className: 'dpl-empty' }, '還沒有聊天快取。'),
      );

  return h(
    Card,
    {
      title: '聊天快取',
      icon: 'history',
      desc: '頻道最近訊息會被濃縮成模型可讀的上下文，用來理解「他們在聊什麼」。',
      actions,
    },
    kpis,
    body,
  );
}

// ---------------------------------------------------------------- gif panel ---
// ---- 29-gif.js
function GifPanel({ config }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError('');
    try {
      const payload = await api(`/gif?q=${encodeURIComponent(query)}&limit=${config?.gifMaxResults || 8}`);
      setResults(payload.results || []);
      if (!(payload.results || []).length) setError('找不到結果');
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setBusy(false);
    }
  };
  return h(
    Card,
    {
      title: 'GIF 試搜',
      icon: 'gif',
      desc: '使用已儲存的 GIF 設定搜尋；KLIPY 模式透過已連線的 Discord 介面，模型回覆共用此來源。',
    },
    h(
      'div',
      { style: { display: 'flex', gap: 8, alignItems: 'center' } },
      h('input', {
        className: 'dpl-input',
        placeholder: 'Search KLIPY · happy dance',
        value: query,
        onChange: (event) => setQuery(event.target.value),
        onKeyDown: (event) => event.key === 'Enter' && search(),
      }),
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-primary dpl-btn-sm',
          disabled: busy || !query.trim(),
          title: query.trim() ? '搜尋 GIF' : '請先輸入搜尋關鍵字',
          onClick: search,
        },
        Icon.bolt({ size: 13 }),
        busy ? '搜尋中...' : '搜尋',
      ),
    ),
    error ? h('div', { className: 'dpl-note' }, Icon.warn({ size: 14 }), error) : null,
    (results || []).length
      ? h(
          'div',
          { className: 'dpl-gif-grid' },
          results.map((item) =>
            h(
              'a',
              {
                key: item.url,
                href: item.url,
                target: '_blank',
                rel: 'noreferrer',
                title: item.title || '',
              },
              h('img', { src: item.preview || item.url, alt: item.title || 'GIF', loading: 'lazy' }),
            ),
          ),
        )
      : null,
  );
}

// -------------------------------------------------------------- model panel ---
// ---- 30-model-test.js
function ModelTest({ providers, draft, onTest, busy, lastTest }) {
  const route =
    draft.llmMode === 'custom'
      ? `${draft.customLlmApiBase} · ${draft.customLlmModel}`
      : draft.llmMode === 'subscriptions'
        ? `${draft.subscriptionProvider} · ${draft.subscriptionModel}`
        : 'DSH 預設模型';
  return h(
    Card,
    {
      title: '模型連線測試',
      icon: 'model',
      desc: '送出一句測試訊息，確認金鑰、配額與 provider 都正常。',
      actions: [
        h(
          'button',
          {
            key: 'test',
            type: 'button',
            className: 'dpl-btn dpl-btn-primary dpl-btn-sm',
            disabled: busy,
            onClick: onTest,
          },
          Icon.bolt({ size: 13 }),
          busy ? '測試中...' : '測試',
        ),
      ],
    },
    h(
      'div',
      { className: 'dpl-list-row' },
      h('span', { className: 'dpl-badge' }, '目前路線'),
      h('span', { className: 'dpl-grow dpl-mono' }, route),
    ),
    h(
      'div',
      { className: 'dpl-list-row' },
      h('span', { className: 'dpl-badge' }, '可用 Provider'),
      h(
        'span',
        { className: 'dpl-grow dpl-mono' },
        (providers || []).length
          ? providers.map((item) => item.displayName || item.id).join(' · ')
          : '（讀取不到 provider 清單）',
      ),
    ),
    lastTest
      ? h(
          'div',
          { className: lastTest.ok ? 'dpl-list-row' : 'dpl-note' },
          h('span', { className: 'dpl-badge' }, lastTest.ok ? '成功' : '失敗'),
          h(
            'span',
            { className: 'dpl-grow' },
            lastTest.ok ? `${lastTest.text}（${lastTest.ms}ms）` : lastTest.error,
          ),
        )
      : null,
  );
}

// ------------------------------------------------------------- quick actions ---
// ---- 31-quick-test.js
function QuickTest({ onSend, busy }) {
  const [channelId, setChannelId] = useState('');
  const [text, setText] = useState('這是從 DSH 送出的測試訊息');
  return h(
    Card,
    {
      title: '快速測試',
      icon: 'send',
      desc: '用目前選用的介面送一則訊息到指定頻道，驗證權限與 Token（不經過模型）。',
    },
    h(
      'div',
      { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      h('input', {
        className: 'dpl-input',
        style: { flex: '0 1 190px' },
        placeholder: '頻道 ID',
        value: channelId,
        onChange: (event) => setChannelId(event.target.value),
      }),
      h('input', {
        className: 'dpl-input',
        style: { flex: '1 1 210px' },
        placeholder: '訊息內容',
        value: text,
        onChange: (event) => setText(event.target.value),
      }),
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-primary dpl-btn-sm',
          disabled: busy || !channelId.trim() || !text.trim(),
          onClick: () => onSend(channelId.trim(), text.trim()),
        },
        Icon.send({ size: 13 }),
        busy ? '傳送中...' : '送出',
      ),
    ),
  );
}

// ---------------------------------------------------------------- main panel ---
// ---- 32-memory-output.js
function MemoryOutputPanel({ info, onRefresh, onError }) {
  const localDate = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: info?.timeZone || 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  useIdNames((info?.artifacts || []).map((a) => a.channelId));
  const [date, setDate] = useState(localDate),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(null);
  const run = async () => {
    setBusy(true);
    try {
      await api('/memory-output/export', { method: 'POST', body: { date, force: true } });
      await onRefresh();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const read = async (a, format = 'markdown') => {
    try {
      const p = await api('/memory-output/read?id=' + encodeURIComponent(a.id) + '&format=' + format);
      setPreview(p);
    } catch (e) {
      onError(e.message);
    }
  };
  const stateName = (s) =>
    ({
      generated: '已生成',
      source_only: '僅來源',
      failed: '失敗',
      stored: '已入庫',
      partial: '部分完成',
      writing: '交付中',
      skipped: '略過',
      disabled: '未啟用',
      exported: '已輸出候選檔（未入庫）',
      delegated: '已交付正式會話（待插件整理）',
      submitted: '已提交（未確認入庫）',
      pending_review: '待審核',
      unverified: '尚無可核對回執',
    })[s] ||
    s ||
    '尚未執行';
  return h(
    Card,
    {
      title: 'AI 日記與記憶入庫',
      icon: 'history',
      desc: '工作區人格閱讀當日素材，撰寫第一人稱 AI 日記，再交給 memU 等外部插件入庫。來源與入庫結果可分開查看。',
    },
    h(
      'div',
      { className: 'dpl-note' },
      '預設：memU；目前交付方式：' +
        (info?.selectedWriter || 'memu') +
        '。直接寫入只呼叫選定的寫入器；其他記憶系統的正式會話、檔案交付與自訂寫入器接口持續保留。',
    ),
    info && info.writeEnabled !== false && info.writerAvailable === false
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'warn', role: 'status', 'data-memory-writer-missing': '1' },
          h('div', { className: 'dpl-note-title' }, '選定的記憶插件還沒有載入'),
          h(
            'div',
            { className: 'dpl-note-body' },
            '目前的交付方式是「' +
              (info.selectedWriter || 'memu') +
              '」，但對應的記憶插件沒有載入，所以日記只會存成檔案，不會寫入長期記憶。安裝並啟用該記憶插件後會自動開始寫入；也可以在下方把交付方式改成「通用檔案交付」或「DSH 正式會話」。',
          ),
        )
      : null,
    h(
      'div',
      { className: 'dpl-note' },
      '管理者對話保存在 DSH session。日記套用對應工作區人格；只有回傳可核對的記憶 ID 才標為入庫。Prime／Mnemon 等可沿用正式會話；通用候選檔可供其他插件匯入。入庫失敗時日記仍保留。',
    ),
    ...(info?.connectors || []).map((c) =>
      h(
        'div',
        { className: 'dpl-note', key: 'connector-' + c.id },
        h('strong', null, c.name + ' · ' + c.id + ' · ' + (c.available ? '可交付' : '工具未載入')),
        h('div', null, c.note),
      ),
    ),
    h(
      'details',
      null,
      h('summary', null, '已測試記憶系統的相容接法'),
      h(
        'p',
        { className: 'dpl-note' },
        '這是接法清單，不代表插件或後端已啟用。正式會話會由已啟用的插件依自身設定捕獲；通用檔案需經其匯入／文件工具處理。',
      ),
      ...(info?.compatibility || []).map((c) =>
        h(
          'div',
          { className: 'dpl-note', key: 'memory-system-' + c.id },
          h('strong', null, c.name),
          h('div', null, c.routes),
          h('div', null, c.note),
        ),
      ),
    ),
    h('div', { className: 'dpl-note' }, 'Markdown／JSON／JSONL 輸出索引：' + (info?.root || '載入中')),
    h(
      'div',
      { className: 'dpl-note' },
      '排程：每天 ' +
        (info?.schedule || '03:00') +
        '（' +
        (info?.timeZone || 'Asia/Taipei') +
        '）輸出前一天；離線後會補輸出已收集資料。',
    ),
    info?.lastError ? h('div', { className: 'dpl-note' }, '輸出錯誤：' + info.lastError) : null,
    h('input', {
      className: 'dpl-input',
      type: 'date',
      value: date,
      onChange: (e) => setDate(e.target.value),
    }),
    h(
      'button',
      { className: 'dpl-btn', disabled: busy, onClick: run },
      busy ? '輸出中…' : '立即輸出／重新產生日記',
    ),
    h('button', { className: 'dpl-btn dpl-btn-ghost', onClick: onRefresh }, '重新整理'),
    ...(info?.artifacts || []).map((a) =>
      h(
        'div',
        { className: 'dpl-note', key: a.id },
        h('strong', { title: 'ID：' + a.channelId }, a.date + ' · ' + nameOfId(a.channelId) + (a.partial ? '（當日部分資料）' : '')),
        h(
          'div',
          null,
          `${a.messageCount} 則訊息；管理者 ${a.adminMessageCount} 則；表情事件 ${a.reactionEventCount} 筆`,
        ),
        h('div', null, '日記：' + stateName(a.diary?.status) + '；記憶入庫：' + stateName(a.memory?.status)),
        a.memory?.error ? h('div', null, a.memory.error) : null,
        a.memory?.reason ? h('div', null, a.memory.reason) : null,
        a.memory
          ? h(
              'details',
              null,
              h('summary', null, '查看入庫結果'),
              h('pre', { style: { whiteSpace: 'pre-wrap' } }, JSON.stringify(a.memory, null, 2)),
            )
          : null,
        h('div', null, a.markdownPath),
        h('div', null, a.jsonPath),
        h('button', { className: 'dpl-btn dpl-btn-sm', onClick: () => read(a) }, '預覽日記'),
        h('button', { className: 'dpl-btn dpl-btn-sm', onClick: () => read(a, 'source') }, '查看來源紀錄'),
      ),
    ),
    !(info?.artifacts || []).length
      ? h('div', { className: 'dpl-empty' }, '尚無日記；收集訊息後可立即輸出，或等待每日排程。')
      : null,
    preview
      ? h(
          'div',
          null,
          h('div', { className: 'dpl-note' }, preview.path),
          h(
            'article',
            {
              style: {
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                maxHeight: 600,
                overflow: 'auto',
                lineHeight: 1.8,
              },
            },
            preview.content,
          ),
        )
      : null,
  );
}
// ---- 33-sessions.js
function SessionRow({ session: s, onUpdated, onError }) {
  const [cwd, setCwd] = useState(s.cwd),
    [target, setTarget] = useState(''),
    [working, setWorking] = useState(false);
  const change = async (path, body) => {
    setWorking(true);
    try {
      await api(path, { method: 'POST', body: { key: s.key, ...body } });
      await onUpdated();
    } catch (error) {
      onError(error.message);
    } finally {
      setWorking(false);
    }
  };
  return h(
    'div',
    { className: 'dpl-note' },
    h('strong', null, s.title),
    h('div', null, s.sessionId),
    h('div', null, s.cwd),
    h('input', {
      className: 'dpl-input',
      value: cwd,
      placeholder: '工作區完整路徑',
      onChange: (e) => setCwd(e.target.value),
    }),
    h(
      'button',
      {
        className: 'dpl-btn dpl-btn-sm',
        disabled: s.running || working || cwd === s.cwd,
        onClick: () => change('/sessions/bind', { cwd }),
      },
      '保留歷史並移到此工作區',
    ),
    s.accountWorkspaceEnabled && h('button', { className: 'dpl-btn dpl-btn-sm', disabled: s.running || working, onClick: () => change('/sessions/bind', { useAccountWorkspace: true }) }, '保留歷史並使用帳號共用工作區'),
    h('small', null, '新目錄會自動建立。完成歷史核對後才切換綁定，舊會話保留；執行中不可移動。外部記憶庫不會自動搬移或合併。'),
    h('input', {
      className: 'dpl-input',
      value: target,
      placeholder: '重新綁定既有 DSH session ID',
      onChange: (e) => setTarget(e.target.value),
    }),
    h(
      'button',
      {
        className: 'dpl-btn dpl-btn-sm',
        disabled: s.running || working || !target,
        onClick: () => change('/sessions/bind', { sessionId: target }),
      },
      '綁定既有會話',
    ),
    h(
      'button',
      {
        className: 'dpl-btn dpl-btn-sm',
        disabled: s.running || working,
        onClick: () => change('/sessions/reset', {}),
      },
      '開始新會話',
    ),
  );
}
// ---- 34-voice.js
function VoiceOverviewPanel() {
  const [data, D] = useState(null),
    [error, E] = useState(''),
    [busy, B] = useState(false);
  const load = async (memory) => {
    B(true);
    E('');
    try {
      D(await api('/voice/overview' + (memory ? '?memory=1' : '')));
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  };
  useEffect(() => {
    load(false);
  }, []);
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '未估算'),
    memoryLabel = {
      ready: '記憶庫已選擇',
      unbound: '沒有記憶綁定',
      'missing-library': '尚未選記憶庫',
      disabled: '此會話未使用工作區記憶庫',
      unavailable: '未連接或無權讀取',
    };
  return h(
    'details',
    { className: 'dpl-note' },
    h('summary', null, '人格音色、記憶庫與成本概覽'),
    h(
      'div',
      { className: 'dpl-actions' },
      h('button', { className: 'dpl-btn', disabled: busy, onClick: () => load(false) }, '更新音色與統計'),
      h('button', { className: 'dpl-btn', disabled: busy, onClick: () => load(true) }, '唯讀檢查記憶庫綁定'),
    ),
    h(
      'p',
      { className: 'dpl-row-help' },
      '對照 DSH 會話實際使用的聲音；不會因此合成語音、建立記憶庫或傳送訊息。',
    ),
    ...(data?.bindings || []).map((b) =>
      h(
        'div',
        { className: 'dpl-asset', key: b.sessionId },
        h('strong', null, b.title || b.sessionId),
        h(
          'p',
          null,
          b.voice?.error ||
            [
              b.voice?.manualOverride ? 'Discord 明確指定' : b.voice?.profileName || '繼承全域音色',
              b.voice?.provider,
              b.voice?.voice,
              b.voice?.spokenLanguage === 'ja' ? '日文' : '原文',
            ]
              .filter(Boolean)
              .join(' · '),
        ),
        h(
          'p',
          null,
          '今日：' +
            fmt(b.usage?.llm?.totalTokens) +
            ' Token · ' +
            fmt(b.usage?.speech?.characters) +
            ' TTS字元 · ' +
            fmt(b.usage?.speech?.sttSeconds) +
            ' STT秒',
        ),
        h('small', null, '會話 ' + b.sessionId + (b.workspaceId ? ' · 工作區 ' + b.workspaceId : '')),
        h(
          'p',
          null,
          b.memory
            ? (memoryLabel[b.memory.status] || b.memory.status) +
                (b.memory.libraryName ? '：' + b.memory.libraryName : '')
            : '記憶庫尚未檢查',
        ),
      ),
    ),
    data?.usage
      ? h(
          'div',
          null,
          h(
            'p',
            null,
            '今日 LLM：' +
              fmt(data.usage.llm?.today?.totalTokens) +
              ' Token；TTS：' +
              fmt(data.usage.speech?.characters) +
              ' 字元；播放 ' +
              fmt(Math.round((data.usage.speech?.playedMs || 0) / 1000)) +
              ' 秒',
          ),
          h(
            'p',
            null,
            '最近日文補翻：' + fmt(data.usage.translation?.recentTokens) + ' Token（最近最多60筆）',
          ),
          h(
            'p',
            null,
            '今日估算 ' +
              (data.usage.estimatedCost?.currency || 'USD') +
              ' · LLM ' +
              fmt(data.usage.estimatedCost?.todayLlm) +
              ' · TTS ' +
              fmt(data.usage.estimatedCost?.todayTts) +
              ' · STT ' +
              fmt(data.usage.estimatedCost?.todayStt),
          ),
          h('small', null, data.usage.estimatedCost?.note),
        )
      : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}

function VoicePanel({ dirtyKeys }) {
  const [data, setData] = useState(null),
    [kind, setKind] = useState('bot'),
    [guildId, setGuild] = useState(''),
    [channelId, setChannel] = useState(''),
    [textChannelId, setTextChannel] = useState(''),
    [text, setText] = useState(''),
    [speechInstruction, setSpeechInstruction] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [guilds, setGuilds] = useState([]),
    [rooms, setRooms] = useState([]),
    [roomRefresh, setRoomRefresh] = useState(0),
    [roomsLoading, setRoomsLoading] = useState(false),
    [tracks, setTracks] = useState([]),
    [q, setQ] = useState(''),
    [provider, setProvider] = useState('netease'),
    [trackId, setTrackId] = useState('');
  const [ytdlp, setYtdlp] = useState(null);
  const [musicSources, setMusicSources] = useState([]),
    [replays, setReplays] = useState([]);
  const refreshSources = async (announce = true) => {
    try {
      const [m, r] = await Promise.all([api('/voice/music-providers'), api('/voice/replays')]);
      setMusicSources(m.providers || []);
      setYtdlp(m.ytdlp || null);
      setReplays(r.items || []);
      if (announce === true) setNotice('已更新音樂來源與可重播成品');
    } catch (e) {
      setNotice(e.message);
    }
  };
  useEffect(() => {
    refreshSources(false);
  }, []);
  // 第一次讀取失敗時要顯示錯誤與重試，而不是一直停在「讀取中」。
  const [loadError, setLoadError] = useState('');
  const load = async () => {
    setData(await api('/voice'));
    setLoadError('');
  };
  const firstLoad = () => load().catch((e) => setLoadError(e.message));
  useEffect(() => {
    firstLoad();
    const t = setInterval(() => pageHidden() || load().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);
  const run = async (path, body, label) => {
    setBusy(true);
    try {
      await api(path, { method: 'POST', body });
      setNotice(label);
      await load();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const select = (label, value, onChange, items) =>
    h(
      'label',
      null,
      label,
      h(
        'select',
        { className: 'dpl-select', 'aria-label': label, value, onChange: (e) => onChange(e.target.value) },
        items.map(([v, t]) => h('option', { key: v, value: v }, t)),
      ),
    );
  const input = (label, value, setter, placeholder) =>
    h(
      'label',
      null,
      label,
      h('input', {
        className: 'dpl-input',
        'aria-label': label,
        value,
        placeholder,
        onChange: (e) => setter(e.target.value),
      }),
    );
  const current = data?.sessions?.find((s) => s.kind === kind),
    locked = busy || dirtyKeys.length > 0;
  const refreshRooms = () => setRoomRefresh(n => n + 1);
  useEffect(() => {
    let active = true;
    api('/guilds?transport=' + kind).then(payload => {
      if (!active) return;
      const rows = payload.guilds || [];
      rows.forEach(g => uiRuntime.names.set(String(g.id), g.name));
      setGuilds(rows);
      setGuild(id => rows.some(g => g.id === id) ? id : rows[0]?.id || '');
    }).catch(e => { if (active) { setGuilds([]); setNotice(e.message); } });
    return () => { active = false; };
  }, [kind, roomRefresh]);
  useEffect(() => {
    let active = true;
    setRooms([]);
    setChannel('');
    setTextChannel('');
    setRoomsLoading(!!guildId);
    if (guildId) api('/channels?' + new URLSearchParams({ transport: kind, guildId, includeVoice: '1' }))
      .then(payload => {
        if (!active) return;
        const rows = payload.channels || [];
        rows.forEach(r => uiRuntime.names.set(String(r.id), r.name));
        setRooms(rows);
      }).catch(e => { if (active) setNotice(e.message); })
      .finally(() => { if (active) setRoomsLoading(false); });
    return () => { active = false; };
  }, [kind, guildId, roomRefresh]);
  return h(
    Card,
    {
      title: 'Discord 語音控制台',
      icon: 'voice',
      desc: '使用外部 TTS 的目前設定；音樂取自音樂插件。收聽需另外啟用、取得同意及指定白名單；預設不收聽，不保存錄音。',
    },
    h(VoiceOverviewPanel),
    data === null
      ? loadError
        ? h(
            StateView,
            {
              kind: 'error',
              title: '讀不到語音狀態',
              action: h(
                'button',
                { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: firstLoad },
                '重試',
              ),
            },
            loadError,
          )
        : h(StateView, { kind: 'loading', title: '讀取語音狀態…' })
      : !data.enabled
        ? h(
            StateView,
            { kind: 'off', title: 'Discord 語音輸出尚未啟用' },
            '請在下方「語音設定 → 基本與權限」開啟「啟用 Discord 語音輸出」並儲存。允許房間留空代表不限，仍需此帳號有加入權限。',
          )
        : null,
    notice ? h('p', { className: 'dpl-note', role: 'status' }, notice) : null,
    dirtyKeys.length
      ? h('p', { className: 'dpl-note' }, '請先儲存設定，再加入或排入播放。停止與離開隨時可用。')
      : null,
    h('div', { className: 'dpl-subhead' }, '① 確認語音合成可用'),
    h(
      'div',
      { className: 'dpl-actions' },
      h('span', { className: 'dpl-row-label' }, '語音合成（TTS）'),
      h(
        Pill,
        { tone: data?.tts ? (data.tts.ready ? 'ok' : 'warn') : 'muted', dot: true },
        'TTS：' +
          (data?.tts
            ? (data.tts.ready ? '可用 · ' : '尚未就緒 · ') + (data.tts.name || data.tts.provider)
            : '未連接外部語音服務'),
      ),
    ),
    data?.tts?.serviceId
      ? h(
          'p',
          { className: 'dpl-row-help' },
          '目前使用：' + (data.tts.serviceId === 'dshTts' ? 'DSH 聲音工坊' : '宿主語音服務（小米 TTS 等）'),
        )
      : null,
    data?.tts && !data.tts.ready
      ? h(
          'p',
          { className: 'dpl-note' },
          ({
            'api-key-not-configured': 'TTS 插件尚未設定 API Key。',
            'api-key-rejected': 'TTS 插件的 API Key 未通過格式檢查。',
            'voice-required': 'TTS 插件尚未選擇聲音。',
          }[data.tts.unavailableReason] || '目前 TTS 設定尚未就緒。') +
            ' 請至外部語音插件設定；此處不複製或保存金鑰。',
        )
      : null,
    h(
      'button',
      {
        className: 'dpl-btn',
        disabled: busy,
        onClick: async () => {
          setBusy(true);
          try {
            const r = await api('/voice/check');
            setNotice(
              'Bot 語音：' +
                (r.bot?.available ? '可用' : '依賴未就緒') +
                '；個人帳號：' +
                (r.user?.available ? '可用' : r.user?.error || '依賴未就緒') +
                '；檢查未加入房間或合成音訊。',
            );
          } catch (e) {
            setNotice(e.message);
          } finally {
            setBusy(false);
          }
        },
      },
      '檢查語音環境',
    ),
    h('div', { className: 'dpl-subhead' }, '② 加入語音房'),
    h(
      'div',
      { className: 'dpl-form-grid' },
      select(
        '語音帳號',
        kind,
        (v) => {
          setKind(v);
          setGuilds([]);
          setRooms([]);
          setGuild('');
          setChannel('');
          setTextChannel('');
        },
        [
          ['bot', '機器人'],
          ['user', '個人帳號'],
        ],
      ),
      h('button', { className: 'dpl-btn', disabled: busy || roomsLoading, onClick: refreshRooms }, '重新偵測伺服器／語音房'),
      guilds.length
        ? select(
            '伺服器',
            guildId,
            (v) => {
              setGuild(v);
              setRooms([]);
              setChannel('');
              setTextChannel('');
            },
            [['', '選擇伺服器'], ...guilds.map((g) => [g.id, g.name])],
          )
        : null,
      guildId
        ? select('語音房間', channelId, setChannel, [
            ['', roomsLoading ? '正在偵測語音房…' : rooms.some(r => ['2', 'voice'].includes(String(r.type))) ? '選擇一般語音房' : '此伺服器沒有可見的一般語音房'],
            ...rooms.filter((r) => ['2', 'voice'].includes(String(r.type))).map((r) => [r.id, r.name]),
          ])
        : null,
      rooms.length
        ? select('朗讀來源頻道', textChannelId, setTextChannel, [
            ['', '不綁定，只手動播放'],
            ...rooms
              .filter((r) => ['0', '2', '5', '15', 'text', 'news', 'forum', 'voice'].includes(String(r.type)))
              .map((r) => [r.id, r.name]),
          ])
        : null,
      h('details', null, h('summary', null, '手動輸入 ID（清單查不到時）'),
        input('伺服器 ID', guildId, setGuild, '從 Discord 複製 ID'),
        input('語音頻道 ID', channelId, setChannel, '允許清單留空不限；仍須有加入權限'),
        input('綁定文字頻道 ID（選填）', textChannelId, setTextChannel, '只朗讀此頻道的已送出 AI 回覆')),
    ),
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'button',
        {
          className: 'dpl-btn dpl-btn-primary',
          disabled: locked || roomsLoading || !data?.enabled || !!current || !channelId || !guildId,
          onClick: () => run('/voice/join', { kind, guildId, channelId, textChannelId }, '已加入語音房間'),
        },
        '加入語音',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: !current,
          onClick: () => run('/voice/stop', { kind }, '已要求停止並清空佇列'),
        },
        '停止／清空佇列',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: !current && !data?.joining?.includes(kind),
          onClick: () => run('/voice/leave', { kind }, '已離開或取消連線'),
        },
        '離開語音',
      ),
    ),
    ...(data?.sessions || []).map((s) =>
      h(
        'div',
        { key: s.kind, className: 'dpl-asset' },
        h('strong', null, (s.kind === 'bot' ? 'Bot' : '個人帳號') + ' · ' + nameOfId(s.channelId)),
        h(
          'p',
          null,
          (s.connection?.recovering ? '正在重新連線' : s.connected ? '已連線' : '已斷線') +
            ' · ' +
            ({
              idle: '閒置',
              queued: '排隊',
              preparing: '準備音訊',
              buffering: '等待首段串流',
              music: '背景音樂播放中',
              playing: '正在播放',
              'leaving-error': '離開尚未確認，清理中',
            }[s.phase] || s.phase),
        ),
        h(
          'p',
          null,
          s.receiving
            ? s.receivePausedForMusic
              ? '收聽：音樂／翻唱播放中，暫停語音指令'
              : s.receiveActive
                ? '收聽：由此帳號處理'
                : '收聽：由同房另一介面接手'
            : '收聽：未啟用',
        ),
        s.idleExitAt ? h('p', null, '預計自動退出：' + new Date(s.idleExitAt).toLocaleTimeString()) : null,
        s.current ? h('p', null, '目前：' + s.current.label) : null,
        s.music ? h('p', null, '背景音樂：' + s.music.label) : null,
        h(
          'p',
          null,
          '等待 ' +
            s.queue.length +
            ' 筆' +
            (s.queue.length ? '：' + s.queue.map((j) => j.label).join('、') : ''),
        ),
        s.lastResult
          ? h(
              'small',
              { role: 'status' },
              s.lastResult.ok
                ? '上一筆傳輸完成' +
                    (s.lastResult.streaming
                      ? ' · ' +
                        (s.lastResult.streamMode === 'incremental'
                          ? '模型增量語音'
                          : s.lastResult.streamMode === 'native'
                            ? '原生串流'
                            : '分段串流') +
                        ' · 首音 ' +
                        (s.lastResult.firstAudioMs ?? '—') +
                        ' ms' +
                        (s.lastResult.inputReadyToFirstAudioMs !== undefined
                          ? ' · 收句後至首音 ' + s.lastResult.inputReadyToFirstAudioMs + ' ms'
                          : '') +
                        (s.lastResult.modelToFirstSentenceMs !== undefined
                          ? ' · 模型首句 ' + s.lastResult.modelToFirstSentenceMs + ' ms'
                          : '')
                      : '')
                : s.lastResult.error,
            )
          : null,
      ),
    ),
    ...(data?.captions || [])
      .slice(-4)
      .map((r) =>
        h(
          'div',
          { className: 'dpl-note', key: r.id },
          h(
            'strong',
            null,
            '本機字幕 · ' +
              ({ buffering: '準備中', playing: '正在說', complete: '已說完', failed: '已中止' }[r.phase] ||
                r.phase),
          ),
          h('p', null, r.sourceText),
          r.spokenText !== r.sourceText
            ? h('p', { lang: r.spokenLanguage === 'ja' ? 'ja' : undefined }, r.spokenText)
            : null,
        ),
      ),
    data?.incremental
      ? h('p', { className: 'dpl-note', role: 'status' }, '模型增量語音 · ' + data.incremental.reason)
      : null,
    data?.input
      ? h(
          'details',
          null,
          h('summary', null, '語音輸入與本機逐字稿'),
          h(
            'p',
            null,
            data.input.enabled
              ? '收聽已啟用；只限新加入的使用者帳號／Bot 房間及已允許參與者。'
              : '收聽關閉。',
          ),
          h(
            'p',
            null,
            'STT：' + (data.input.available ? '宿主服務已連接' : '請在 DSH 啟用語音輸入並準備模型'),
          ),
          h(
            'p',
            null,
            (data.input.providers || [])
              .map((p) => p.name + ' · ' + (p.location === 'cloud' ? '雲端' : '本機') + ' · ' + p.phase)
              .join('；'),
          ),
          ...(data.input.decisions || [])
            .slice(-4)
            .map((r, i) => h('p', { key: 'decision-' + i, className: 'dpl-note' }, '插話判斷 · ' + r.reason)),
          ...(data.input.recent || []).map((r) =>
            h(
              'p',
              { key: r.id },
              (r.authorName ? r.authorName + '（' + r.userId + '）' : r.userId) + '：' + r.text,
            ),
          ),
          h(
            'button',
            {
              className: 'dpl-btn',
              onClick: () =>
                run('/voice/input/stop', {}, '已取消進行中的語音辨識；關閉收聽請取消設定並離開房間'),
            },
            '取消進行中的辨識',
          ),
        )
      : null,
    h('div', { className: 'dpl-subhead' }, '③ 讓 AI 在語音房說話'),
    h('textarea', {
      className: 'dpl-textarea',
      rows: 3,
      'aria-label': '語音文字',
      value: text,
      placeholder: '要讓 AI 說出的文字（會產生 TTS 用量）',
      onChange: (e) => setText(e.target.value),
    }),
    input(
      '本次語氣／心情（選填）',
      speechInstruction,
      setSpeechInstruction,
      '例如：驚喜、帶笑意、節奏輕快；不支援的 TTS 會沿用原聲音',
    ),
    data && !current
      ? h('p', { className: 'dpl-row-help' }, '尚未加入語音房；完成步驟 ② 後才能排入語音或音樂。')
      : null,
    data?.tts?.speechInstruction === false
      ? h(
          'p',
          { className: 'dpl-row-help' },
          '目前選用的 TTS 接口不支援自然語言語氣提示；可改用支援的模型，或沿用原本聲音。',
        )
      : null,
    h(
      'button',
      {
        className: 'dpl-btn dpl-btn-primary',
        disabled: locked || !current || !text.trim() || !data?.tts?.ready,
        onClick: () =>
          run(
            '/voice/speak',
            { kind, text, speechInstruction: speechInstruction || undefined },
            '已排入語音；請查看播放結果',
          ),
      },
      '排入語音',
    ),
    h('div', { className: 'dpl-subhead' }, '④ 音樂與重播'),
    h(
      'details',
      null,
      h('summary', null, '探索音樂來源／重播已完成語音'),
      h(
        'p',
        null,
        'Discord 依音訊能力選擇來源，不把只在電腦播放的指令當成回傳音訊。新插件可註冊 Provider，或宣告唯讀音樂音訊契約；系統錄音不會自動開啟。',
      ),
      h(
        'button',
        { className: 'dpl-btn', disabled: busy, onClick: () => refreshSources(true) },
        '探索音樂來源與重播成品',
      ),
      musicSources.map((p) =>
        h(
          'p',
          { key: p.id },
          p.name +
            ' · ' +
            ({
              legacy: '既有面板接口',
              registered: '已註冊音訊來源',
              discovered: '自動探索到的音訊工具',
              unverified: '尚無音訊交付契約',
            }[p.type] || p.type) +
            (p.note ? ' · ' + p.note : ''),
        ),
      ),
      h(
        'p',
        null,
        '重播須先啟用短暫保留，且原語音已成功完成。只保留三分鐘，重播不重新合成；過期不會自動付費重做。',
      ),
      replays
        .filter((r) => r.delivery === 'room' && r.kind === kind && r.channelId === current?.textChannelId)
        .map((r) =>
          h(
            'div',
            { className: 'dpl-actions', key: r.id },
            h('span', null, '原語音 ' + r.id),
            h(
              'button',
              {
                className: 'dpl-btn',
                disabled: locked || !current,
                onClick: () => run('/voice/replay', { kind, id: r.id }, '原音訊已排入重播；沒有重新呼叫 TTS'),
              },
              '重播此原音訊',
            ),
          ),
        ),
    ),
    h(
      'details',
      null,
      h('summary', null, '音樂插件曲庫與線上曲目'),
      input('搜尋音樂庫', q, setQ, '曲名或歌手'),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy,
          onClick: async () => {
            try {
              setTracks((await api('/voice/music?' + new URLSearchParams({ q, provider }))).tracks || []);
            } catch (e) {
              setNotice(e.message);
            }
          },
        },
        '讀取音樂庫',
      ),
      ...tracks.map((t) =>
        h(
          'div',
          { key: t.path || t.provider + ':' + t.id, className: 'dpl-note' },
          h('span', null, t.title + (t.artist ? ' · ' + t.artist : '')),
          h(
            'button',
            {
              className: 'dpl-btn dpl-btn-sm',
              disabled: locked || !current,
              onClick: () =>
                run(
                  '/voice/music',
                  t.provider
                    ? { kind, provider: t.provider, trackId: t.id, label: t.title }
                    : { kind, path: t.path, label: t.title },
                  '音樂已排入佇列',
                ),
            },
            '排入播放',
          ),
        ),
      ),
      select('線上音樂來源', provider, setProvider, [
        ['netease', '網易雲'],
        ['qq', 'QQ 音樂'],
        ['kugou', '酷狗'],
        ...musicSources
          .filter((p) => /^(plugin|tool):/.test(p.id))
          .map((p) => [p.id, p.name + (p.available === false ? '（尚未就緒）' : '')]),
      ]),
      // YouTube 點歌靠 yt-dlp 這個小工具下載音訊；這裡顯示它的狀態，並可一鍵下載或更新。
      ytdlp
        ? h(
            'p',
            { className: 'dpl-note', 'data-youtube-hint': ytdlp.found ? 'ready' : 'missing' },
            ytdlp.found
              ? 'YouTube 點歌已就緒（yt-dlp ' + ytdlp.version + '）。YouTube 改版後若點不了歌，按右邊更新。'
              : ytdlp.autoInstall
                ? 'YouTube 點歌需要 yt-dlp 這個小工具。第一次點歌時會自動下載（十幾 MB，請稍等），也可以現在先下載。'
                : 'YouTube 點歌還不能用：找不到 yt-dlp。請確認「語音設定」裡的「yt-dlp 執行檔路徑」填對了，或清空它改用自動下載。',
            ytdlp.install && ytdlp.install.state === 'failed' ? '　上次下載失敗：' + ytdlp.install.error : '',
            ytdlp.install && ytdlp.install.supported
              ? h(
                  'button',
                  {
                    className: 'dpl-btn',
                    style: { display: 'inline-block', width: 'auto', marginLeft: '8px' },
                    disabled: busy,
                    'data-action': 'ytdlp-install',
                    onClick: async () => {
                      await run('/voice/ytdlp/install', {}, ytdlp.found ? 'yt-dlp 已更新到最新版' : 'yt-dlp 下載完成');
                      await refreshSources(false);
                    },
                  },
                  busy ? '處理中…' : ytdlp.found ? '更新 yt-dlp' : '下載 yt-dlp',
                )
              : null,
          )
        : null,
      input('線上曲目 ID', trackId, setTrackId, '沿用音樂插件的登入與來源設定'),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: locked || !current || !trackId,
          onClick: () => run('/voice/music', { kind, provider, trackId }, '線上曲目已排入'),
        },
        '排入線上曲目',
      ),
    ),
    h(
      'p',
      { className: 'dpl-row-help' },
      '預設發話時暫停音樂後接續；可選 Bot 雙音軌壓低與漸變。背景音樂仍在播放時不計閒置；還有最長連線時間保護，不會重啟後自行回房。',
    ),
    data?.usage
      ? h(
          'p',
          null,
          '今日 TTS 提交 ' +
            fmtNum(data.usage.characters || 0) +
            ' 字／' +
            (data.usage.characterLimit ? fmtNum(data.usage.characterLimit) : '不限') +
            '；已傳輸約 ' +
            Math.round((data.usage.playedMs || 0) / 1000) +
            ' 秒（與 LLM Token 分開）',
        )
      : null,
    h(
      'p',
      { className: 'dpl-row-help' },
      data?.audioProcessing
        ? '直接音訊輸出：未套用 Krisp／降噪、回音消除或自動增益。BGM 不經 Discord 桌面麥克風；Opus 壓縮、設定音量與音樂降音量仍會影響聽感。'
        : '',
    ),
    h('p', { className: 'dpl-row-help' }, data?.receiveNote || ''),
    h('p', { className: 'dpl-row-help' }, data?.note || ''),
  );
}
// ---- 35-token-budget.js
function TokenBudgetPanel() {
  const [data, setData] = useState(null),
    [error, setError] = useState('');
  const load = async () => {
    try {
      setData(await api('/token-budget'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
    const t = setInterval(() => pageHidden() || load(), 30000);
    return () => clearInterval(t);
  }, []);
  return h(
    Card,
    {
      title: '本插件模型 Token 用量',
      icon: 'model',
      desc: '這裡的數字全部是 Discord 插件的模型用量，包含輸入與輸出的 Token。合計分成「服務有回報的用量」與「服務沒回報、由插件估算的用量」，不是呼叫次數，也不是整個帳號的總用量。',
    },
    h('button', { className: 'dpl-btn', onClick: load }, '更新 Token 統計'),
    error ? h('p', { role: 'status' }, error) : null,
    data
      ? h(
          'div',
          null,
          h(
            'div',
            { className: 'dpl-library-grid' },
            [
              ['今日', data.today, data.dailyLimit],
              ['本月', data.thisMonth, data.monthlyLimit],
            ].map(([label, row, limit]) =>
              h(
                'div',
                { key: label, className: 'dpl-asset' },
                h('strong', null, label + '合計（含估算）：' + fmtNum(row?.totalTokens || 0) + ' Token'),
                h('p', null, '預算上限：' + (limit ? fmtNum(limit) + ' Token' : '不限')),
                h('p', null, '服務已回報的用量：' + fmtNum(row?.reportedTokens || 0) + ' Token'),
                h('p', null, '未回報，由插件估算：' + fmtNum(row?.estimatedTokens || 0) + ' Token'),
                h('small', null, (row?.calls || 0) + ' 筆請求紀錄（與 Token 數分開計算）'),
              ),
            ),
          ),
          data.enabled && (data.calls || []).some((r) => r.overBudget)
            ? h(
                'p',
                { className: 'dpl-note', role: 'status' },
                '近期有請求的預估用量超過預算；請查看額度與請求紀錄。',
              )
            : null,
          h(
            'p',
            null,
            '進行中預留：' +
              fmtNum(data.reserved || 0) +
              ' Token；' +
              (data.enabled
                ? data.mode === 'block'
                  ? '預算不足會阻擋新請求'
                  : '超額提醒，繼續執行'
                : '預算阻擋未啟用') +
              '；時區 ' +
              (data.timeZone || 'Asia/Taipei'),
          ),
          data.startedAt
            ? h(
                'small',
                null,
                '監控起始：' + new Date(data.startedAt).toLocaleString() + '（不回補安裝前用量）',
              )
            : null,
          h('p', { className: 'dpl-row-help' }, data.note || '精確用量與估算分開列示，並非供應商帳單。'),
          h(
            'p',
            { className: 'dpl-row-help' },
            '合計＝上面兩項相加。「估算」也是本插件的用量：服務沒有提供 Token 數字時，由插件暫估；失敗或中斷的請求也可能列入。服務回報與估算都不是費用，請以服務商帳單為準。「不限」只表示未設本插件的用量預算。',
          ),
          h(
            'p',
            { className: 'dpl-row-help' },
            '原生 Agent 的工具迴圈及外部插件內部推論可能超出預留估算；本地預算不等同供應商硬性費用上限。',
          ),
          h(
            'details',
            null,
            h('summary', null, '最近請求（不保存提示詞或對話文字）'),
            ...(data.calls || [])
              .slice(0, 30)
              .map((row) =>
                h(
                  'div',
                  { key: row.id, className: 'dpl-note' },
                  new Date(row.at).toLocaleString() +
                    ' · ' +
                    row.category +
                    ' · ' +
                    fmtNum(row.totalTokens) +
                    ' Token · ' +
                    (row.source === 'reported'
                      ? '模型回報'
                      : row.source === 'not-started'
                        ? '未呼叫模型'
                        : '估算') +
                    ' · ' +
                    row.status,
                ),
              ),
          ),
        )
      : h('p', null, '讀取統計中…'),
  );
}
// ---- 36-behavior.js
function BehaviorPanel({ dirtyKeys, onConfigSaved }) {
  const [info, setInfo] = useState({ presets: [], rules: [] }),
    [presetId, setPresetId] = useState('builtin-companion'),
    [profile, setProfile] = useState('adminDm'),
    [name, setName] = useState(''),
    [includePersona, setIncludePersona] = useState(false),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const blank = () => ({
    kind: 'user',
    targetId: '',
    transport: 'both',
    scope: 'dm',
    label: '',
    nickname: '',
    tone: '',
    length: '',
    gifEnabled: 'inherit',
    stickerAutoSendEnabled: 'inherit',
    coChatEnabled: 'inherit',
    replyDeliveryMode: '',
  });
  const [rule, setRule] = useState(blank);
  const load = async () => setInfo(await api('/user-behavior'));
  useEffect(() => {
    load().catch((e) => setNotice(e.message));
  }, []);
  const act = async (body, message) => {
    setBusy(true);
    try {
      setInfo(await api('/user-behavior', { method: 'POST', body }));
      if (body.action === 'apply') await onConfigSaved();
      setNotice(message);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const change = (key, value) => setRule((r) => ({ ...r, [key]: value }));
  const select = (label, value, onChange, options, disabled = false) =>
    h(
      'label',
      null,
      label,
      h(
        'select',
        {
          className: 'dpl-select',
          value,
          disabled,
          'aria-label': label,
          onChange: (e) => onChange(e.target.value),
        },
        options.map(([v, t]) => h('option', { key: v, value: v }, t)),
      ),
    );
  const profiles = [
    ['adminDm', '管理者・私訊'],
    ['adminGroup', '管理者・群聊'],
    ['othersDm', '其他使用者・私訊'],
    ['othersGroup', '其他使用者・群聊'],
  ];
  const preset = (info.presets || []).find((p) => p.id === presetId);
  return h(
    Card,
    {
      title: '人格與行為組合／個別對話偏好',
      icon: 'settings',
      desc: '預設組合可套用至四種對象。對話偏好可用於個人帳號與 Bot；外部人格與記憶仍依 DSH 工作區／會話運作。',
    },
    notice ? h('p', { className: 'dpl-note', role: 'status' }, notice) : null,
    h(
      'div',
      { className: 'dpl-asset' },
      h('h3', null, '人格與行為預設組合'),
      select(
        '預設組合',
        presetId,
        setPresetId,
        (info.presets || []).map((p) => [p.id, p.name]),
      ),
      select('套用對象', profile, setProfile, [...profiles, ['all', '全部四種對象']]),
      preset
        ? h(
            'details',
            null,
            h('summary', null, '預覽將套用的 ' + Object.keys(preset.values).length + ' 項設定'),
            h(
              'pre',
              { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
              JSON.stringify(preset.values, null, 2),
            ),
          )
        : null,
      h(
        'p',
        { className: 'dpl-row-help' },
        '「交由外部人格管理」關閉插件本身的身分與風格注入。內建陪聊／安靜／工作組合不替換外部人格。',
      ),
      dirtyKeys.length
        ? h('p', { className: 'dpl-row-help' }, '請先儲存或放棄頁面上的設定草稿，再套用／擷取預設。')
        : null,
      h(
        'button',
        {
          className: 'dpl-btn dpl-btn-primary',
          disabled: busy || !!dirtyKeys.length || !preset,
          onClick: () => act({ action: 'apply', id: presetId, profile }, '預設已套用至指定對象。'),
        },
        '套用預設',
      ),
      preset && !preset.builtin
        ? h(
            'button',
            {
              className: 'dpl-btn',
              disabled: busy,
              onClick: () => act({ action: 'removePreset', id: preset.id }, '自訂預設已刪除。'),
            },
            '刪除自訂預設',
          )
        : null,
      h(
        'label',
        null,
        '自訂組合名稱',
        h('input', {
          className: 'dpl-input',
          value: name,
          maxLength: 80,
          'aria-label': '自訂組合名稱',
          onChange: (e) => setName(e.target.value),
        }),
      ),
      h(
        'label',
        null,
        h('input', {
          type: 'checkbox',
          checked: includePersona,
          onChange: (e) => setIncludePersona(e.target.checked),
        }),
        ' 同時擷取插件人格欄位',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !!dirtyKeys.length || !name.trim() || profile === 'all',
          onClick: () =>
            act({ action: 'capture', name, profile, includePersona }, '已擷取此對象的已儲存設定。'),
        },
        '將目前對象設定存為組合',
      ),
    ),
    h(
      'div',
      { className: 'dpl-asset' },
      h('h3', null, rule.id ? '編輯對話偏好' : '新增對話偏好'),
      h(
        'p',
        { className: 'dpl-row-help' },
        '指定頻道的偏好優先於指定使用者；具體帳號／場景優先於共用規則。繼承代表沿用四種對象設定。人格與記憶的工作區綁定請使用下方 DSH 會話列表。',
      ),
      select(
        '偏好對象',
        rule.kind,
        (v) => {
          change('kind', v);
          change('scope', v === 'channel' ? 'both' : 'dm');
        },
        [
          ['user', '指定使用者'],
          ['channel', '指定頻道／私訊對話'],
        ],
      ),
      h(
        'label',
        null,
        '對象 ID',
        h('input', {
          className: 'dpl-input',
          value: rule.targetId,
          'aria-label': '偏好對象 ID',
          onChange: (e) => change('targetId', e.target.value.trim()),
        }),
      ),
      h(
        'label',
        null,
        '備註名稱',
        h('input', {
          className: 'dpl-input',
          value: rule.label,
          maxLength: 100,
          onChange: (e) => change('label', e.target.value),
        }),
      ),
      select('適用介面', rule.transport, (v) => change('transport', v), [
        ['both', '個人帳號與 Bot'],
        ['user', '只有個人帳號'],
        ['bot', '只有 Bot'],
      ]),
      select('適用場景', rule.scope, (v) => change('scope', v), [
        ['dm', '只限一對一私訊'],
        ['group', '只限群聊'],
        ['both', '私訊與群聊'],
      ]),
      rule.scope !== 'dm'
        ? h('p', { className: 'dpl-row-help' }, '此偏好會用於群聊，請使用適合公開的稱呼與描述。')
        : null,
      h(
        'label',
        null,
        '偏好稱呼',
        h('input', {
          className: 'dpl-input',
          value: rule.nickname,
          maxLength: 80,
          'aria-label': '偏好稱呼',
          onChange: (e) => change('nickname', e.target.value),
        }),
      ),
      select('回覆長度', rule.length, (v) => change('length', v), [
        ['', '繼承'],
        ['brief', '簡短，約一至三句'],
        ['normal', '自然長度'],
        ['detailed', '需要時補充細節'],
      ]),
      h(
        'label',
        null,
        '語氣、話題偏好與界線',
        h('textarea', {
          className: 'dpl-textarea',
          rows: 3,
          maxLength: 800,
          value: rule.tone,
          'aria-label': '對話風格偏好',
          placeholder: '例如：少用敬語；不要主動談論工作；可直接稱呼阿明。',
          onChange: (e) => change('tone', e.target.value),
        }),
      ),
      ...[
        ['gifEnabled', 'GIF 回覆'],
        ['stickerAutoSendEnabled', '貼圖回覆'],
        ['coChatEnabled', '群聊主動插話'],
      ].map(([key, label]) =>
        select(label, rule[key], (v) => change(key, v), [
          ['inherit', '繼承'],
          ['on', '允許'],
          ['off', '停用'],
        ]),
      ),
      select('個人帳號送出方式', rule.replyDeliveryMode, (v) => change('replyDeliveryMode', v), [
        ['', '繼承'],
        ['auto', '自動送出'],
        ['review', '先審稿'],
      ]),
      h(
        'button',
        {
          className: 'dpl-btn dpl-btn-primary',
          disabled: busy || !/^\d{15,22}$/.test(rule.targetId),
          onClick: () => {
            const body = { ...rule, action: 'putRule' };
            for (const key of ['gifEnabled', 'stickerAutoSendEnabled', 'coChatEnabled']) {
              if (rule[key] === 'inherit') delete body[key];
              else body[key] = rule[key] === 'on';
            }
            act(body, '對話偏好已儲存，後續訊息生效。');
          },
        },
        '儲存對話偏好',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || JSON.stringify(rule) === JSON.stringify(blank()),
          onClick: () => setRule(blank()),
        },
        '清空表單',
      ),
    ),
    ...(info.rules || []).map((row) =>
      h(
        'div',
        { className: 'dpl-note', key: row.id },
        h('strong', null, row.label || row.targetId),
        h('p', null, row.kind + ' · ' + row.targetId + ' · ' + row.transport + ' · ' + row.scope),
        h(
          'button',
          {
            className: 'dpl-btn',
            disabled: busy,
            onClick: () => {
              const next = { ...blank(), ...row, ...row.values };
              for (const k of ['gifEnabled', 'stickerAutoSendEnabled', 'coChatEnabled'])
                next[k] = typeof row.values[k] === 'boolean' ? (row.values[k] ? 'on' : 'off') : 'inherit';
              setRule(next);
            },
          },
          '編輯偏好',
        ),
        h(
          'button',
          {
            className: 'dpl-btn',
            disabled: busy,
            onClick: () => act({ action: 'removeRule', id: row.id }, '偏好已刪除，恢復繼承設定。'),
          },
          '刪除偏好',
        ),
      ),
    ),
  );
}
// ---- 37-user-desk.js
function UserConversationDesk({ status, adminUserId }) {
  const [view, setView] = useState('inbox'),
    [channel, setChannel] = useState(''),
    [channels, setChannels] = useState([]),
    [duration, setDuration] = useState('1800');
  const [inbox, setInbox] = useState({ items: [] }),
    [reviewData, setReviewData] = useState({ drafts: [] }),
    [reviewEdit, setReviewEdit] = useState(null),
    [reviewText, setReviewText] = useState(''),
    [keepReviewMedia, setKeepReviewMedia] = useState(true),
    [takeover, setTakeover] = useState({ entries: [] }),
    [query, setQuery] = useState(''),
    [stickers, setStickers] = useState([]),
    [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(''),
    [notice, setNotice] = useState(''),
    [replyItem, setReplyItem] = useState(null),
    [replyText, setReplyText] = useState(''),
    [editing, setEditing] = useState(null),
    [editText, setEditText] = useState(''),
    [deleteEntry, setDeleteEntry] = useState(null);
  // 草稿批次處理：勾選的草稿 ID，以及「核准所選」的二次確認狀態。
  const [picked, setPicked] = useState([]),
    [confirmBatch, setConfirmBatch] = useState(false);
  const refresh = async () => {
    const rows = await Promise.all([api('/user-inbox'), api('/user-takeover'), api('/user-review')]);
    setInbox(rows[0]);
    setTakeover(rows[1]);
    setReviewData(rows[2]);
    return rows;
  };
  useEffect(() => {
    refresh().catch((e) => setNotice(e.message));
    const timer = setInterval(() => pageHidden() || refresh().catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, []);
  const run = async (key, work) => {
    if (busy) return;
    setBusy(key);
    setNotice('');
    try {
      await work();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy('');
    }
  };
  const loadMessages = async () => {
    const r = await api('/messages?transport=user&limit=30&channelId=' + encodeURIComponent(channel));
    setMessages(
      (r.messages || [])
        .filter((m) => String(m.author?.id) === String(status?.user?.id))
        .map((m) => ({ ...m, channelId: channel })),
    );
  };
  const changeChannel = (value) => {
    setChannel(value);
    setMessages([]);
    setStickers([]);
    setDeleteEntry(null);
  };
  useIdNames([
    ...(inbox.items || []).flatMap((item) => [item.channelId, item.authorId]),
    ...(reviewData.drafts || []).flatMap((row) => [row.source?.channelId, row.source?.author?.id]),
    ...(takeover.entries || []).map((row) => row.channelId),
  ]);
  const canWrite = !!status?.ok && status?.receiveOnly !== true;
  const drafts = reviewData.drafts || [];
  const approvable = (row) => ['pending', 'failed'].includes(row.state);
  const discardable = (row) => !['sending', 'uncertain'].includes(row.state);
  const pickedRows = drafts.filter((row) => picked.includes(row.id));
  const togglePick = (id) => {
    setConfirmBatch(false);
    setPicked((previous) => (previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id]));
  };
  // 逐則走原本的核准／捨棄接口：每一則都由後端重新核對來源、帳號與版本，任何一則失敗不影響其他則。
  const batch = (action) =>
    run('batch-' + action, async () => {
      const rows = pickedRows.filter(action === 'approve' ? approvable : discardable);
      let done = 0;
      const failed = [];
      for (const row of rows) {
        try {
          const r = await api('/user-review/' + action, {
            method: 'POST',
            allowFailure: true,
            body:
              action === 'approve'
                ? { id: row.id, version: row.version, content: row.content || '', keepMedia: true }
                : { id: row.id, version: row.version },
          });
          if (r?.ok === false) failed.push(r.error || '未完成');
          else done += 1;
        } catch (e) {
          failed.push(e.message);
        }
      }
      setPicked([]);
      setConfirmBatch(false);
      if (reviewEdit && rows.some((row) => row.id === reviewEdit.id)) setReviewEdit(null);
      await refresh();
      setNotice(
        (action === 'approve' ? '已核准送出 ' : '已捨棄 ') +
          done +
          ' 則' +
          (failed.length ? '；' + failed.length + ' 則未完成：' + [...new Set(failed)].slice(0, 3).join('、') : '。'),
      );
    });
  const channelLabel = channels.find((c) => c.id === channel)?.name || channel;
  const incoming = [...(inbox.items || [])].sort(
    (a, b) =>
      Number(b.authorId === adminUserId) - Number(a.authorId === adminUserId) || b.receivedAt - a.receivedAt,
  );
  return h(
    Card,
    {
      title: '個人帳號對話工作台',
      icon: 'chat',
      desc: '新私訊與直接 @ 進入待回覆清單。AI 成功回覆後移出；手動回覆會先接管 30 分鐘。在桌面回覆後可標為已處理。',
    },
    h(Segmented, {
      value: view,
      onChange: setView,
      options: [
        { value: 'inbox', label: '待回覆 ' + (inbox.total || 0) },
        { value: 'review', label: '草稿 ' + (reviewData.drafts?.length || 0) },
        { value: 'takeover', label: '人工接管' },
        { value: 'tools', label: '貼圖與訊息' },
      ],
    }),
    !canWrite
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'warn', role: 'note' },
          status?.ok
            ? '帳號目前是「僅觀察連線」，回覆、送出與撤回按鈕已停用。可在下方「接收與回覆」關閉僅觀察並儲存。'
            : '使用者帳號尚未連線，回覆、送出與撤回按鈕已停用。請先在上方的帳號卡連線。',
        )
      : null,
    notice ? h('div', { className: 'dpl-note', role: 'status' }, notice) : null,
    view === 'inbox'
      ? h(
          'div',
          null,
          h(
            'button',
            { className: 'dpl-btn dpl-btn-sm', disabled: !!busy, onClick: () => run('refresh', refresh) },
            '重新整理收件匣',
          ),
          inbox.truncated
            ? h(
                'p',
                { className: 'dpl-row-help' },
                '收件匣已達 1000 筆保存上限，部分較舊項目已移出。完整來源請查看聊天快取或記憶輸出。',
              )
            : null,
          !incoming.length
            ? h('div', { className: 'dpl-empty' }, '目前沒有待回覆訊息。')
            : incoming.map((item) =>
                h(
                  'article',
                  { className: 'dpl-asset', key: item.id },
                  h('strong', null, item.author),
                  item.authorId === adminUserId ? h('span', { className: 'dpl-badge' }, '管理者') : null,
                  h(
                    'small',
                    { style: { display: 'block' } },
                    (item.guildId ? '伺服器 @' : '私訊') +
                      ' · ' +
                      new Date(item.receivedAt).toLocaleString() +
                      ' · ' +
                      nameOfId(item.channelId),
                  ),
                  h('p', null, item.content),
                  item.reason ? h('p', { className: 'dpl-row-help' }, '目前狀態：' + item.reason) : null,
                  h(
                    'div',
                    { className: 'dpl-actions' },
                    h(
                      'button',
                      {
                        className: 'dpl-btn dpl-btn-sm',
                        disabled: !!busy || !canWrite || !!replyItem,
                        onClick: () =>
                          run('manual-reply', async () => {
                            await api('/user-takeover', {
                              method: 'POST',
                              body: {
                                action: 'pause',
                                channelId: item.channelId,
                                label: item.author,
                                seconds: 1800,
                              },
                            });
                            setReplyItem(item);
                            setReplyText('');
                            await refresh();
                          }),
                      },
                      '手動回覆',
                    ),
                    h(
                      'button',
                      {
                        className: 'dpl-btn dpl-btn-sm',
                        disabled: !!busy || !item.canRetry,
                        onClick: () =>
                          run('retry', async () => {
                            await api('/user-inbox/retry', { method: 'POST', body: { messageId: item.id } });
                            await refresh();
                            setNotice('已重新判斷；請查看最新原因或待審草稿。');
                          }),
                      },
                      '重新產生／重試',
                    ),
                    h(
                      'button',
                      {
                        className: 'dpl-btn dpl-btn-sm',
                        disabled: !!busy,
                        onClick: () =>
                          run('resolve', async () => {
                            await api('/user-inbox/resolve', {
                              method: 'POST',
                              body: { messageId: item.id },
                            });
                            if (replyItem?.id === item.id) setReplyItem(null);
                            await refresh();
                          }),
                      },
                      '標為已處理',
                    ),
                    h(
                      'button',
                      {
                        className: 'dpl-btn dpl-btn-sm',
                        disabled: !!busy,
                        onClick: () => {
                          changeChannel(item.channelId);
                          setView('takeover');
                        },
                      },
                      '接管此對話',
                    ),
                  ),
                ),
              ),
          replyItem
            ? h(
                'div',
                { className: 'dpl-asset selected' },
                h('strong', { title: 'ID：' + replyItem.channelId }, '回覆 ' + replyItem.author + ' · ' + nameOfId(replyItem.channelId)),
                h('textarea', {
                  className: 'dpl-textarea',
                  rows: 3,
                  maxLength: 2000,
                  value: replyText,
                  onChange: (e) => setReplyText(e.target.value),
                  'aria-label': '手動回覆內容',
                }),
                h(
                  'button',
                  {
                    className: 'dpl-btn dpl-btn-primary',
                    disabled: !!busy || !canWrite || !replyText.trim(),
                    onClick: () =>
                      run('reply', async () => {
                        await api('/send', {
                          method: 'POST',
                          body: {
                            transport: 'user',
                            channelId: replyItem.channelId,
                            replyToMessageId: replyItem.id,
                            content: replyText,
                          },
                        });
                        setReplyItem(null);
                        setReplyText('');
                        await refresh();
                        setNotice('手動回覆已送出。');
                      }),
                  },
                  '以個人帳號送出',
                ),
                h(
                  'button',
                  { className: 'dpl-btn', disabled: !!busy, onClick: () => setReplyItem(null) },
                  '取消回覆',
                ),
              )
            : null,
        )
      : null,
    view === 'review'
      ? h(
          'div',
          null,
          h(
            'p',
            { className: 'dpl-row-help' },
            '草稿尚未送往 Discord。送出前會重新核對來源內容、帳號及發送設定。結果不確定的項目禁止重送。',
          ),
          drafts.length > 1
            ? h(
                'div',
                { className: 'dpl-actions', 'data-draft-batch': '1' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dpl-btn dpl-btn-sm',
                    disabled: !!busy,
                    onClick: () => {
                      setConfirmBatch(false);
                      setPicked(picked.length === drafts.length ? [] : drafts.map((row) => row.id));
                    },
                  },
                  picked.length === drafts.length ? '取消全選' : '全選',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dpl-btn dpl-btn-sm dpl-btn-primary',
                    disabled: !!busy || !canWrite || !pickedRows.some(approvable),
                    onClick: () => (confirmBatch ? batch('approve') : setConfirmBatch(true)),
                  },
                  confirmBatch
                    ? '再按一次，照原稿送出 ' + pickedRows.filter(approvable).length + ' 則'
                    : '核准所選（' + pickedRows.filter(approvable).length + '）',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dpl-btn dpl-btn-sm dpl-btn-danger',
                    disabled: !!busy || !pickedRows.some(discardable),
                    onClick: () => batch('discard'),
                  },
                  '捨棄所選（' + pickedRows.filter(discardable).length + '）',
                ),
                confirmBatch
                  ? h('span', { className: 'dpl-row-help', role: 'status' }, '所選草稿會不經修改直接送到 Discord。')
                  : null,
              )
            : null,
          ...(reviewData.drafts || []).map((row) =>
            h(
              'article',
              { className: 'dpl-asset', key: row.id },
              drafts.length > 1
                ? h(
                    'label',
                    { style: { display: 'inline-flex', gap: 6, alignItems: 'center', marginRight: 8 } },
                    h('input', {
                      type: 'checkbox',
                      'aria-label': '選取這則草稿',
                      checked: picked.includes(row.id),
                      disabled: !!busy,
                      onChange: () => togglePick(row.id),
                    }),
                  )
                : null,
              h(
                'strong',
                null,
                (row.source.author?.name || nameOfId(row.source.author?.id)) + ' · ' + nameOfId(row.source.channelId),
              ),
              h(
                'small',
                { style: { display: 'block' } },
                '狀態：' + row.state + ' · 媒體 ' + row.mediaCount + ' 個',
              ),
              h('p', null, row.source.content || '[媒體訊息]'),
              h('p', null, row.content || '[僅媒體草稿]'),
              row.mediaCount
                ? h('p', { className: 'dpl-row-help' }, '媒體內容：' + JSON.stringify(row.media || {}))
                : null,
              row.error ? h('p', { className: 'dpl-row-help' }, row.error) : null,
              h(
                'div',
                { className: 'dpl-actions' },
                h(
                  'button',
                  {
                    className: 'dpl-btn',
                    disabled: !!busy || !['pending', 'failed'].includes(row.state),
                    onClick: () => {
                      setReviewEdit(row);
                      setReviewText(row.content || '');
                      setKeepReviewMedia(true);
                    },
                  },
                  '編輯與核准',
                ),
                h(
                  'button',
                  {
                    className: 'dpl-btn dpl-btn-danger',
                    disabled: !!busy || ['sending', 'uncertain'].includes(row.state),
                    onClick: () =>
                      run('discard-draft', async () => {
                        await api('/user-review/discard', {
                          method: 'POST',
                          body: { id: row.id, version: row.version },
                        });
                        if (reviewEdit?.id === row.id) setReviewEdit(null);
                        await refresh();
                      }),
                  },
                  '捨棄草稿',
                ),
                row.state === 'uncertain'
                  ? h(
                      'button',
                      {
                        className: 'dpl-btn',
                        disabled: !!busy,
                        onClick: () =>
                          run('archive-uncertain', async () => {
                            await api('/user-review/discard', {
                              method: 'POST',
                              body: { id: row.id, version: row.version, acknowledgeUncertain: true },
                            });
                            if (reviewEdit?.id === row.id) setReviewEdit(null);
                            await refresh();
                            setNotice('已封存不確定紀錄；不會重送，也不再提供此來源的重試。');
                          }),
                      },
                      '我已核對，封存並禁止重送',
                    )
                  : null,
              ),
            ),
          ),
          !(reviewData.drafts || []).length
            ? h('div', { className: 'dpl-empty' }, '沒有待審草稿。可在四種對象設定中選擇「先審稿」。')
            : null,
          reviewEdit
            ? h(
                'div',
                { className: 'dpl-asset selected' },
                h('strong', { title: 'ID：' + reviewEdit.source.channelId }, '核准送往 ' + nameOfId(reviewEdit.source.channelId)),
                h('textarea', {
                  className: 'dpl-textarea',
                  rows: 5,
                  maxLength: 2000,
                  value: reviewText,
                  'aria-label': '核准草稿內容',
                  onChange: (e) => setReviewText(e.target.value),
                }),
                h(
                  'label',
                  null,
                  h('input', {
                    type: 'checkbox',
                    checked: keepReviewMedia,
                    onChange: (e) => setKeepReviewMedia(e.target.checked),
                  }),
                  ' 保留原草稿貼圖／附件（' + reviewEdit.mediaCount + ' 個）',
                ),
                h(
                  'button',
                  {
                    className: 'dpl-btn dpl-btn-primary',
                    disabled: !!busy || !canWrite || !['pending', 'failed'].includes(reviewEdit.state),
                    onClick: () =>
                      run('approve-draft', async () => {
                        const r = await api('/user-review/approve', {
                          method: 'POST',
                          allowFailure: true,
                          body: {
                            id: reviewEdit.id,
                            version: reviewEdit.version,
                            content: reviewText,
                            keepMedia: keepReviewMedia,
                          },
                        });
                        const fresh = await refresh();
                        if (!r.ok) {
                          setReviewEdit(
                            (fresh[2].drafts || []).find((row) => row.id === reviewEdit.id) || null,
                          );
                          setNotice(r.error);
                          return;
                        }
                        setReviewEdit(null);
                        setNotice('核准回覆已送出。');
                      }),
                  },
                  '核准並送出',
                ),
                h(
                  'button',
                  { className: 'dpl-btn', disabled: !!busy, onClick: () => setReviewEdit(null) },
                  '保留草稿，關閉編輯',
                ),
              )
            : null,
        )
      : null,
    view === 'takeover' || view === 'tools'
      ? h(
          'div',
          null,
          h(
            'div',
            { className: 'dpl-actions', style: { margin: '12px 0' } },
            h(
              'button',
              {
                className: 'dpl-btn',
                disabled: !!busy || !status?.ok || !!editing,
                onClick: () =>
                  run('channels', async () => {
                    const r = await api('/channels?transport=user');
                    setChannels(
                      (r.channels || []).filter(
                        (c) => !['voice', 'category', 'stage_voice'].includes(c.type),
                      ),
                    );
                    setNotice('已載入對話，亦可直接貼上頻道 ID。');
                  }),
              },
              '載入對話列表',
            ),
            channels.length
              ? h(
                  'select',
                  {
                    className: 'dpl-select',
                    value: channel,
                    disabled: !!editing || !!busy,
                    'aria-label': '選擇對話',
                    onChange: (e) => changeChannel(e.target.value),
                  },
                  h('option', { value: '' }, '選擇私訊或伺服器頻道'),
                  !channels.some((c) => c.id === channel) && channel
                    ? h('option', { value: channel }, channel)
                    : null,
                  channels.map((c) =>
                    h('option', { key: c.id, value: c.id }, (c.guildId ? '# ' : '私訊 · ') + c.name),
                  ),
                )
              : null,
            h('input', {
              className: 'dpl-input',
              value: channel,
              disabled: !!editing || !!busy,
              'aria-label': '對話頻道 ID',
              placeholder: '或貼上對話頻道 ID',
              onChange: (e) => changeChannel(e.target.value.trim()),
            }),
          ),
          view === 'takeover'
            ? h(
                'div',
                null,
                h(
                  'p',
                  { className: 'dpl-row-help' },
                  '接管會立即取消此對話中尚未送出的 AI 回覆，暫停文字、typing 與自動表情。聊天及管理者記憶仍照常記錄；Bot 身分的回覆不受影響。恢復後只處理新訊息。',
                ),
                h(
                  'div',
                  { className: 'dpl-actions' },
                  h(
                    'select',
                    {
                      className: 'dpl-select',
                      value: duration,
                      'aria-label': '接管時間',
                      onChange: (e) => setDuration(e.target.value),
                    },
                    [
                      { value: '900', label: '15 分鐘' },
                      { value: '1800', label: '30 分鐘' },
                      { value: '3600', label: '1 小時' },
                      { value: '0', label: '直到手動恢復' },
                    ].map((o) => h('option', { key: o.value, value: o.value }, o.label)),
                  ),
                  h(
                    'button',
                    {
                      className: 'dpl-btn dpl-btn-primary',
                      disabled: !!busy || !/^\d{15,22}$/.test(channel),
                      onClick: () =>
                        run('pause', async () => {
                          await api('/user-takeover', {
                            method: 'POST',
                            body: {
                              action: 'pause',
                              channelId: channel,
                              label: channelLabel,
                              seconds: Number(duration),
                            },
                          });
                          await refresh();
                          setNotice('此對話已由人工接管。');
                        }),
                    },
                    '接管此對話',
                  ),
                ),
                !(takeover.entries || []).length
                  ? h('p', null, '目前沒有接管中的對話。')
                  : (takeover.entries || []).map((row) =>
                      h(
                        'div',
                        { key: row.channelId, className: 'dpl-note' },
                        h('strong', { title: 'ID：' + row.channelId }, row.label || nameOfId(row.channelId)),
                        h(
                          'p',
                          null,
                          row.until ? '自動恢復：' + new Date(row.until).toLocaleString() : '直到手動恢復',
                        ),
                        h(
                          'button',
                          {
                            className: 'dpl-btn dpl-btn-primary',
                            disabled: !!busy,
                            onClick: () =>
                              run('resume', async () => {
                                await api('/user-takeover', {
                                  method: 'POST',
                                  body: { action: 'resume', channelId: row.channelId },
                                });
                                await refresh();
                              }),
                          },
                          '恢復 AI',
                        ),
                      ),
                    ),
              )
            : h(
                'div',
                null,
                h(
                  'p',
                  { className: 'dpl-row-help' },
                  '操作對象：' +
                    (channelLabel || '尚未選擇對話') +
                    '。貼圖發送、訊息編輯與撤回都會以個人帳號執行。',
                ),
                h(
                  'div',
                  { className: 'dpl-actions' },
                  h('input', {
                    className: 'dpl-input',
                    value: query,
                    'aria-label': '貼圖搜尋關鍵字',
                    placeholder: '貼圖名稱、描述或關鍵字',
                    onChange: (e) => setQuery(e.target.value),
                  }),
                  h(
                    'button',
                    {
                      className: 'dpl-btn',
                      disabled: !!busy || !status?.ok || !channel,
                      onClick: () =>
                        run('stickers', async () => {
                          const r = await api(
                            '/stickers?transport=user&channelId=' +
                              encodeURIComponent(channel) +
                              '&q=' +
                              encodeURIComponent(query),
                          );
                          setStickers(r.stickers || []);
                          setNotice(
                            r.warning || r.note || (r.stickers?.length ? '已找到貼圖。' : '沒有符合的貼圖。'),
                          );
                        }),
                    },
                    '搜尋貼圖',
                  ),
                ),
                h(
                  'div',
                  { className: 'dpl-library-grid' },
                  stickers.map((s) =>
                    h(
                      'article',
                      { className: 'dpl-asset', key: s.id },
                      h('strong', null, s.name),
                      !String(s.format).includes('lottie') && s.url
                        ? h('img', {
                            src: s.url,
                            alt: s.name,
                            loading: 'lazy',
                            style: { display: 'block', width: 96, height: 96, objectFit: 'contain' },
                          })
                        : null,
                      h('p', null, s.description || ''),
                      h(
                        'small',
                        null,
                        s.kind === 'standard' ? '官方貼圖 · 發送資格由 Discord 判定' : '目前伺服器貼圖',
                      ),
                      h(
                        'div',
                        null,
                        h(
                          'button',
                          {
                            className: 'dpl-btn',
                            disabled: !!busy || !canWrite,
                            onClick: () =>
                              run('send-sticker', async () => {
                                await api('/send', {
                                  method: 'POST',
                                  body: {
                                    transport: 'user',
                                    channelId: channel,
                                    type: 'sticker',
                                    stickerId: s.id,
                                  },
                                });
                                setNotice('貼圖已送出。');
                              }),
                          },
                          '傳送此貼圖',
                        ),
                      ),
                    ),
                  ),
                ),
                h('hr', { style: { border: 0, borderTop: '1px solid var(--dpl-line)', margin: '18px 0' } }),
                h(
                  'button',
                  {
                    className: 'dpl-btn',
                    disabled: !!busy || !status?.ok || !channel || !!editing,
                    onClick: () => run('messages', loadMessages),
                  },
                  '載入自己的最近訊息',
                ),
                h(
                  'p',
                  { className: 'dpl-row-help' },
                  '只列此對話最近 30 則中的自己訊息。編輯只修改文字，保留原附件；撤回無法復原。',
                ),
                messages.map((m) =>
                  h(
                    'article',
                    { key: m.id, className: 'dpl-asset' },
                    h('small', null, m.id),
                    h('p', null, m.content || '[附件或貼圖]'),
                    h(
                      'div',
                      { className: 'dpl-actions' },
                      h(
                        'button',
                        {
                          className: 'dpl-btn',
                          disabled: !!busy || !canWrite || !!editing,
                          onClick: () => {
                            setEditing(m);
                            setEditText(m.content || '');
                            setDeleteEntry(null);
                          },
                        },
                        '編輯文字',
                      ),
                      h(
                        'button',
                        {
                          className: 'dpl-btn dpl-btn-danger',
                          disabled: !!busy || !canWrite || !!editing,
                          onClick: () => setDeleteEntry(m),
                        },
                        '撤回訊息',
                      ),
                    ),
                  ),
                ),
                editing
                  ? h(
                      'div',
                      { className: 'dpl-asset selected' },
                      h('strong', null, '編輯訊息 ' + editing.id),
                      h('textarea', {
                        className: 'dpl-textarea',
                        rows: 3,
                        maxLength: 2000,
                        value: editText,
                        'aria-label': '修正訊息內容',
                        onChange: (e) => setEditText(e.target.value),
                      }),
                      h(
                        'button',
                        {
                          className: 'dpl-btn dpl-btn-primary',
                          disabled: !!busy || !canWrite || !editText.trim() || editText === editing.content,
                          onClick: () =>
                            run('edit', async () => {
                              await api('/user-message/edit', {
                                method: 'POST',
                                body: {
                                  channelId: editing.channelId,
                                  messageId: editing.id,
                                  content: editText,
                                },
                              });
                              setEditing(null);
                              await loadMessages();
                              setNotice('訊息文字已更新。');
                            }),
                        },
                        '儲存訊息修正',
                      ),
                      h(
                        'button',
                        { className: 'dpl-btn', disabled: !!busy, onClick: () => setEditing(null) },
                        '取消編輯',
                      ),
                    )
                  : null,
                deleteEntry
                  ? h(
                      'div',
                      { className: 'dpl-note' },
                      h('strong', null, '確定撤回這則訊息？'),
                      h('p', null, deleteEntry.content || '[附件或貼圖]'),
                      h(
                        'button',
                        {
                          className: 'dpl-btn dpl-btn-danger',
                          disabled: !!busy || !canWrite,
                          onClick: () =>
                            run('delete', async () => {
                              await api('/user-message/delete', {
                                method: 'POST',
                                body: {
                                  channelId: deleteEntry.channelId,
                                  messageId: deleteEntry.id,
                                  confirmed: true,
                                },
                              });
                              setDeleteEntry(null);
                              await loadMessages();
                              setNotice('訊息已撤回。');
                            }),
                        },
                        '確認撤回',
                      ),
                      h(
                        'button',
                        { className: 'dpl-btn', disabled: !!busy, onClick: () => setDeleteEntry(null) },
                        '保留訊息',
                      ),
                    )
                  : null,
              ),
        )
      : null,
  );
}
// ---- 38-presence.js
function UserPresenceCard({ fields, config, draft, setValue, dirtyKeys, status, onRefresh }) {
  const [applying, setApplying] = useState(false),
    [result, setResult] = useState(null),
    [observed, setObserved] = useState(null);
  useEffect(() => setResult(null), [status?.presence?.updatedAt]);
  const last = result || status?.presence;
  const labels = { offline: '離線／隱藏', online: '上線', idle: '閒置', dnd: '請勿打擾', invisible: '隱藏' };
  const verbs = { playing: '正在遊玩', listening: '正在聆聽', watching: '正在觀看', competing: '正在競賽' };
  const apply = async () => {
    setApplying(true);
    try {
      const payload = await api('/presence', {
        method: 'POST',
        body: { transport: 'user' },
        allowFailure: true,
      });
      setResult(payload.results?.user || { ok: false, error: payload.error });
      await onRefresh();
    } catch (e) {
      setResult({ ok: false, error: e.message });
    } finally {
      setApplying(false);
    }
  };
  return h(
    Card,
    {
      title: '帳號狀態與活動',
      icon: 'user',
      desc: '儲存會即時套用；登入與重新連線時恢復。關閉管理會保留當前 Discord 外觀。',
    },
    h(
      'div',
      { className: 'dpl-note' },
      h('strong', null, '設定預覽：'),
      labels[draft.userStatus] || '上線',
      draft.userActivityType !== 'none' && verbs[draft.userActivityType]
        ? ' · ' + verbs[draft.userActivityType] + ' ' + (draft.userActivityText || '（請輸入文字）')
        : '',
      draft.userCustomStatusText || draft.userCustomStatusEmoji
        ? ' · ' + [draft.userCustomStatusEmoji, draft.userCustomStatusText].filter(Boolean).join(' ')
        : '',
    ),
    h(FieldList, { fields, config, draft, setValue, dirtyKeys }),
    config.userReceiveOnly
      ? h('p', { className: 'dpl-row-help' }, '僅觀察模式禁止修改 Discord 外觀，請先關閉並儲存。')
      : null,
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled:
            applying ||
            !status?.ok ||
            !config.userPresenceEnabled ||
            config.userReceiveOnly ||
            fields.some((f) => dirtyKeys.includes(f.key)),
          onClick: apply,
        },
        applying ? '套用中…' : '重新套用已儲存外觀',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: applying || !status?.ok,
          onClick: async () => {
            setApplying(true);
            try {
              const payload = await api('/presence?refresh=1');
              setObserved(payload.current);
            } catch (e) {
              setObserved({ ok: false, error: e.message });
            } finally {
              setApplying(false);
            }
          },
        },
        '讀取 Discord 狀態',
      ),
      h(
        'span',
        { className: 'dpl-row-help', role: 'status' },
        !config.userPresenceEnabled
          ? '未由插件管理'
          : last
            ? last.ok
              ? 'Discord 已接受更新請求' +
                (last.updatedAt ? ' · ' + new Date(last.updatedAt).toLocaleTimeString() : '')
              : '套用失敗：' + last.error
            : status?.ok
              ? '儲存後套用'
              : '尚未連線，登入後套用',
      ),
    ),
    observed
      ? h(
          'p',
          { className: 'dpl-row-help', role: 'status' },
          observed.ok
            ? 'Gateway 回報：此連線 ' +
                (labels[observed.clientStatus] || observed.clientStatus) +
                '；帳號整體 ' +
                (labels[observed.accountStatus] || observed.accountStatus) +
                '；活動 ' +
                ((observed.activities || []).map((a) => a.state || a.name).join('、') || '無') +
                '。其他裝置也會影響整體狀態。'
            : '讀取失敗：' + observed.error,
        )
      : null,
  );
}
// ---- 39-assets.js
function AssetLibrary({ onError }) {
  const [query, setQuery] = useState(''),
    [type, setType] = useState(''),
    [page, setPage] = useState(0),
    [reviewFilter, setReviewFilter] = useState('');
  const [listing, setListing] = useState({ assets: [], total: 0 }),
    [selected, setSelected] = useState(null),
    [edit, setEdit] = useState(null),
    [scope, setScope] = useState(''),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState('');
  const request = useRef(0);
  // 讀取失敗要和「真的沒有素材」分開顯示。
  const [loadError, setLoadError] = useState('');
  const load = async () => {
    const sequence = ++request.current;
    try {
      const result = await api(
        '/culture/assets?' +
          new URLSearchParams({
            query,
            type,
            reviewState: reviewFilter,
            offset: String(page * 24),
            limit: '24',
          }),
      );
      if (sequence === request.current) {
        setListing(result);
        setLoadError('');
      }
    } catch (e) {
      if (sequence === request.current) {
        setLoadError(e.message);
        onError(e.message);
      }
    }
  };
  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => {
      clearTimeout(timer);
      request.current++;
    };
  }, [query, type, page, reviewFilter]);
  const open = (a) => {
    setSelected(a);
    setEdit({
      manualName: a.manualName || '',
      manualDescription: a.manualDescription || '',
      manualMeanings: JSON.parse(JSON.stringify(a.manualMeanings || {})),
      favorite: !!a.favorite,
      disabledForReuse: !!a.disabledForReuse,
      reviewState: a.reviewState || 'unreviewed',
    });
    setScope(a.scopes[0] || '');
    setNotice('');
  };
  const changed =
    !!selected &&
    JSON.stringify(edit) !==
      JSON.stringify({
        manualName: selected.manualName || '',
        manualDescription: selected.manualDescription || '',
        manualMeanings: selected.manualMeanings || {},
        favorite: !!selected.favorite,
        disabledForReuse: !!selected.disabledForReuse,
        reviewState: selected.reviewState || 'unreviewed',
      });
  const update = (key, value) => setEdit((old) => ({ ...old, [key]: value }));
  const meaning = edit?.manualMeanings?.[scope] || { meaning: '', avoid: '' };
  const changeMeaning = (key, value) =>
    setEdit((old) => ({
      ...old,
      manualMeanings: {
        ...old.manualMeanings,
        [scope]: { ...(old.manualMeanings[scope] || { meaning: '', avoid: '' }), [key]: value },
      },
    }));
  const saveAsset = async () => {
    setPending(true);
    try {
      const asset = (
        await api('/culture/assets/update', {
          method: 'POST',
          body: { id: selected.id, expectedVersion: selected.editVersion, ...edit },
        })
      ).asset;
      open(asset);
      setNotice('已儲存；後續辨識及回覆會使用修正。既有日記與外部記憶不會被改寫。');
      await load();
    } catch (e) {
      onError(e.message);
    } finally {
      setPending(false);
    }
  };
  return h(
    Card,
    {
      title: '表情與 GIF 素材庫',
      icon: 'reaction',
      desc: '修正畫面辨識與群內用法。素材含義只提供給 AI 當參考，不會授予指令權限。',
    },
    h(
      'div',
      { className: 'dpl-actions' },
      h('input', {
        className: 'dpl-input',
        type: 'search',
        value: query,
        placeholder: '搜尋名稱、描述、群組 ID…',
        'aria-label': '搜尋素材',
        onChange: (e) => {
          setQuery(e.target.value);
          setPage(0);
        },
      }),
      h(
        'select',
        {
          className: 'dpl-select',
          value: type,
          'aria-label': '素材類型',
          onChange: (e) => {
            setType(e.target.value);
            setPage(0);
          },
        },
        ['', 'emoji', 'gif', 'sticker', 'image'].map((t, i) =>
          h('option', { key: t, value: t }, ['全部素材', '自訂表情', 'GIF', '貼圖', '圖片'][i]),
        ),
      ),
      h(
        'select',
        {
          className: 'dpl-select',
          value: reviewFilter,
          'aria-label': '素材審閱篩選',
          onChange: (e) => {
            setReviewFilter(e.target.value);
            setPage(0);
          },
        },
        [
          ['', '全部審閱狀態'],
          ['unreviewed', '待審閱'],
          ['confirmed', '已確認'],
          ['ignored', '已略過'],
        ].map(([value, label]) => h('option', { key: value, value }, label)),
      ),
      h('span', null, listing.total + ' 個素材'),
    ),
    selected
      ? h(
          'div',
          { className: 'dpl-asset selected' },
          h('h3', null, '編輯 ' + (selected.name || selected.id)),
          h(
            'p',
            { className: 'dpl-row-help' },
            '名稱與畫面修正適用相同素材；使用情境只套用至下方選擇的群組／私聊。留空即可取消手動修正。',
          ),
          h(
            'label',
            null,
            '審閱狀態',
            h(
              'select',
              {
                className: 'dpl-select',
                'aria-label': '素材審閱狀態',
                value: edit.reviewState,
                onChange: (e) => update('reviewState', e.target.value),
              },
              [
                ['unreviewed', '待審閱'],
                ['confirmed', '已確認'],
                ['ignored', '已略過'],
              ].map(([v, t]) => h('option', { key: v, value: v }, t)),
            ),
          ),
          h(
            'label',
            null,
            h('input', {
              type: 'checkbox',
              checked: edit.favorite,
              onChange: (e) => update('favorite', e.target.checked),
            }),
            ' 偏好選用此素材',
          ),
          h(
            'label',
            null,
            h('input', {
              type: 'checkbox',
              checked: edit.disabledForReuse,
              onChange: (e) => update('disabledForReuse', e.target.checked),
            }),
            ' 禁止 AI 重用（仍可理解收到的素材）',
          ),
          h(
            'details',
            null,
            h('summary', null, '查看本範圍使用證據'),
            h('p', null, '累計 ' + (selected.evidence?.[scope]?.count || 0) + ' 次'),
            ...(selected.evidence?.[scope]?.examples || []).map((e) =>
              h('p', { key: e.messageId }, e.userId + '：' + (e.text || '[素材]')),
            ),
          ),
          h(
            'label',
            null,
            '顯示名稱',
            h('input', {
              className: 'dpl-input',
              value: edit.manualName,
              maxLength: 100,
              placeholder: selected.originalName,
              onChange: (e) => update('manualName', e.target.value),
            }),
          ),
          h(
            'details',
            null,
            h('summary', null, '查看原始 AI 辨識'),
            h('p', null, selected.modelDescription || '尚未辨識'),
          ),
          h(
            'label',
            null,
            '畫面描述修正',
            h('textarea', {
              className: 'dpl-textarea',
              value: edit.manualDescription,
              rows: 3,
              maxLength: 2500,
              placeholder: '例如：角色一邊哭一邊比讚；字幕是「沒事」',
              onChange: (e) => update('manualDescription', e.target.value),
            }),
          ),
          h(
            'label',
            null,
            '用法適用範圍',
            h(
              'select',
              { className: 'dpl-select', value: scope, onChange: (e) => setScope(e.target.value) },
              selected.scopes.map((x) =>
                h(
                  'option',
                  { key: x, value: x },
                  x.startsWith('guild:') ? '伺服器 ' + x.slice(6) : '私聊 ' + x.slice(3),
                ),
              ),
            ),
          ),
          scope
            ? h(
                'div',
                null,
                h(
                  'label',
                  null,
                  '含義與適合情境',
                  h('textarea', {
                    className: 'dpl-textarea',
                    rows: 3,
                    maxLength: 2000,
                    value: meaning.meaning,
                    onChange: (e) => changeMeaning('meaning', e.target.value),
                    placeholder: '例如：本群用來自嘲「又搞砸了」，不是在生氣。',
                  }),
                ),
                h(
                  'label',
                  null,
                  '避免使用的情境',
                  h('textarea', {
                    className: 'dpl-textarea',
                    rows: 2,
                    maxLength: 2000,
                    value: meaning.avoid,
                    onChange: (e) => changeMeaning('avoid', e.target.value),
                  }),
                ),
              )
            : null,
          h(
            'div',
            { className: 'dpl-actions' },
            h(
              'button',
              { className: 'dpl-btn dpl-btn-primary', disabled: pending || !changed, onClick: saveAsset },
              pending ? '儲存中…' : '儲存素材修正',
            ),
            h(
              'button',
              {
                className: 'dpl-btn',
                disabled: pending,
                onClick: () => {
                  setSelected(null);
                  setEdit(null);
                },
              },
              changed ? '放棄並關閉' : '關閉編輯',
            ),
            h(
              'button',
              {
                className: 'dpl-btn',
                disabled: pending || changed,
                onClick: async () => {
                  setPending(true);
                  try {
                    const cleared = await api('/culture/invalidate', {
                      method: 'POST',
                      body: { id: selected.id },
                    });
                    open(cleared.asset);
                    setNotice(
                      '已清除原始 AI 辨識，下次遇到素材時重新辨識。手動修正仍優先；要重新辨識請先將畫面修正留空並儲存。',
                    );
                    await load();
                  } catch (e) {
                    onError(e.message);
                  } finally {
                    setPending(false);
                  }
                },
              },
              '清除 AI 辨識',
            ),
          ),
          h('p', { role: 'status' }, notice || (changed ? '素材修正尚未儲存（與上方設定分開儲存）。' : '')),
        )
      : null,
    loadError
      ? h(
          StateView,
          {
            kind: 'error',
            title: '讀不到素材清單',
            action: h('button', { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: load }, '重試'),
          },
          loadError,
        )
      : !listing.assets.length
        ? h(
            StateView,
            { kind: 'empty', title: query || type || reviewFilter ? '找不到符合的素材' : '還沒有素材' },
            query || type || reviewFilter
              ? '找不到符合的素材。'
              : '收到圖片、GIF 或表情後，已辨識素材會出現在這裡。',
          )
        : h(
            'div',
            { className: 'dpl-library-grid' },
            listing.assets.map((a) =>
              h(
                'article',
                { key: a.id, className: 'dpl-asset' },
                h('strong', null, a.name || a.id),
                h('span', { className: 'dpl-badge' }, a.type),
                h('p', null, (a.description || '尚未辨識').slice(0, 220)),
                h(
                  'small',
                  null,
                  a.scopes.length + ' 個使用範圍' + (a.manualDescription ? ' · 已手動修正' : ''),
                ),
                h(
                  'div',
                  null,
                  h(
                    'button',
                    { className: 'dpl-btn dpl-btn-sm', disabled: pending || changed, onClick: () => open(a) },
                    '編輯描述與用法',
                  ),
                ),
              ),
            ),
          ),
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'button',
        { className: 'dpl-btn', disabled: page === 0, onClick: () => setPage((x) => x - 1) },
        '上一頁',
      ),
      h('span', null, '第 ' + (page + 1) + ' 頁'),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: (page + 1) * 24 >= listing.total,
          onClick: () => setPage((x) => x + 1),
        },
        '下一頁',
      ),
    ),
  );
}
// ---- 40-config-tools.js
// 設定的變更預覽、復原與匯出／匯入。
//
// 預覽與復原只顯示「欄位名稱：原值 → 新值」；Token 與金鑰只顯示「將更新」，不顯示內容。

// 把設定值寫成人看得懂的文字。
function describeValue(field, value) {
  if (field?.secret) return value ? '將更新' : '不變';
  if (typeof value === 'boolean') return value ? '開啟' : '關閉';
  if (Array.isArray(value)) {
    if (!value.length) return '（空）';
    const shown = value.slice(0, 4).map((item) => nameOfId(item));
    return shown.join('、') + (value.length > 4 ? ' 等 ' + value.length + ' 項' : '');
  }
  if (value === '' || value === null || value === undefined) return '（空白）';
  const option = (field?.options || []).find((item) => String(item.value) === String(value));
  if (option) return option.label ?? String(option.value);
  const text = looksLikeId(String(value)) ? nameOfId(value) : String(value);
  return text.length > 60 ? text.slice(0, 60) + '…' : text;
}

// 「這次會改哪些」清單。rows：[{ key, from, to }]。
function ChangeList({ fields, rows }) {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return h(
    'ul',
    { className: 'dpl-change-list', 'data-change-list': rows.length },
    rows.map((row) => {
      const field = byKey.get(row.key);
      return h(
        'li',
        { key: row.key },
        h('span', null, field?.label || row.key),
        h(
          'strong',
          null,
          field?.secret ? describeValue(field, row.to) : describeValue(field, row.from) + ' → ' + describeValue(field, row.to),
        ),
      );
    }),
  );
}

function ConfigTools({ fields, onApplied, onError }) {
  const [entries, setEntries] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(null); // 匯入預覽：{ payload, changes, ignored }
  const fileRef = useRef(null);
  const load = async () => {
    try {
      setEntries((await api('/config/history')).entries || []);
    } catch (err) {
      setEntries([]);
      setError(err.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useIdNames(
    (entries || []).flatMap((entry) =>
      entry.changes.flatMap((change) => [change.from, change.to].flat().filter((value) => typeof value === 'string')),
    ),
  );
  const run = async (key, work) => {
    if (busy) return;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (err) {
      setError(err.message);
      onError?.(err.message);
    } finally {
      setBusy('');
    }
  };
  const undo = (entry) =>
    run('undo:' + entry.id, async () => {
      const result = await api('/config/undo', { method: 'POST', body: { id: entry.id } });
      setNotice('已復原 ' + (result.changed || []).length + ' 項設定。');
      await load();
      await onApplied?.();
    });
  const download = (share) =>
    run('export', async () => {
      const payload = (await api('/config/export' + (share ? '?share=1' : ''))).export;
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'discord-cyberfriend-settings' + (share ? '-share' : '') + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setNotice(share ? '已匯出分享用設定（不含 Token、金鑰、個人 ID 與名單）。' : '已匯出設定（不含 Token 與金鑰）。');
    });
  const readImport = (file) =>
    run('import-preview', async () => {
      if (!file) return;
      if (file.size > 1024 * 1024) throw new Error('檔案太大，設定匯出檔應小於 1 MB');
      let payload;
      try {
        payload = JSON.parse(await file.text());
      } catch {
        throw new Error('檔案不是有效的 JSON');
      }
      const preview = await api('/config/import', { method: 'POST', body: { payload } });
      setPending({ payload, changes: preview.changes || [], ignored: preview.ignored || [] });
    });
  const applyImport = () =>
    run('import-apply', async () => {
      const result = await api('/config/import', { method: 'POST', body: { payload: pending.payload, confirmed: true } });
      setPending(null);
      if (fileRef.current) fileRef.current.value = '';
      setNotice('已匯入 ' + (result.applied || 0) + ' 項設定。');
      await load();
      await onApplied?.();
    });
  const sourceLabel = { ui: '設定介面', undo: '復原', import: '匯入', tool: 'AI 工具' };
  return h(
    Card,
    {
      title: '設定備份與復原',
      icon: 'history',
      desc: '改錯了可以回到上一次儲存前的值；換電腦或分享給朋友時可匯出設定。Token 與金鑰不會被匯出，也不會記在復原紀錄裡。',
    },
    h(
      'div',
      { className: 'dpl-actions', 'data-config-tools': '1' },
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm', disabled: !!busy, 'data-action': 'config-export', onClick: () => download(false) },
        '匯出設定',
      ),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm', disabled: !!busy, 'data-action': 'config-export-share', onClick: () => download(true) },
        '匯出分享用（不含個人 ID 與名單）',
      ),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm', disabled: !!busy, onClick: () => fileRef.current?.click() },
        '匯入設定…',
      ),
      h('input', {
        ref: fileRef,
        type: 'file',
        accept: '.json,application/json',
        'aria-label': '設定匯入檔',
        style: { display: 'none' },
        onChange: (event) => readImport(event.target.files?.[0]),
      }),
    ),
    pending
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'info', role: 'note', 'data-import-preview': pending.changes.length },
          h(
            'div',
            { className: 'dpl-note-title' },
            pending.changes.length ? '匯入會變更 ' + pending.changes.length + ' 項設定' : '匯入檔與目前設定相同，沒有需要變更的項目',
          ),
          pending.changes.length ? h(ChangeList, { fields, rows: pending.changes }) : null,
          pending.ignored.length
            ? h('div', { className: 'dpl-note-body' }, '已略過 ' + pending.ignored.length + ' 個不認得或屬於機密的欄位。')
            : null,
          h(
            'div',
            { className: 'dpl-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn dpl-btn-primary dpl-btn-sm',
                disabled: !!busy || !pending.changes.length,
                'data-action': 'config-import-apply',
                onClick: applyImport,
              },
              busy === 'import-apply' ? '套用中…' : '確認匯入',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn dpl-btn-sm',
                disabled: !!busy,
                onClick: () => {
                  setPending(null);
                  if (fileRef.current) fileRef.current.value = '';
                },
              },
              '取消',
            ),
          ),
        )
      : null,
    h('div', { className: 'dpl-row-label', style: { marginTop: 12 } }, '最近的儲存紀錄'),
    entries === null
      ? h(StateView, { kind: 'loading' })
      : entries.length
        ? entries.map((entry) =>
            h(
              'div',
              { className: 'dpl-note', key: entry.id, 'data-config-entry': entry.id },
              h(
                'div',
                { className: 'dpl-note-title' },
                new Date(entry.at).toLocaleString('zh-TW', { hour12: false }) +
                  ' · ' +
                  (sourceLabel[entry.source] || entry.source) +
                  ' · ' +
                  (entry.changes.length + entry.secretKeys.length) +
                  ' 項',
              ),
              entry.changes.length ? h(ChangeList, { fields, rows: entry.changes }) : null,
              entry.secretKeys.length
                ? h('div', { className: 'dpl-note-body' }, '另有 ' + entry.secretKeys.length + ' 個機密欄位被更新（內容不保存，無法復原）。')
                : null,
              entry.changes.length
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpl-btn dpl-btn-sm',
                      style: { alignSelf: 'flex-start' },
                      disabled: !!busy,
                      'data-action': 'config-undo',
                      onClick: () => undo(entry),
                    },
                    busy === 'undo:' + entry.id ? '復原中…' : '回到這次儲存之前',
                  )
                : null,
            ),
          )
        : h(StateView, { kind: 'empty', title: '還沒有儲存紀錄' }, '之後每次儲存設定，這裡會列出改了什麼，最多保留十筆。'),
    notice ? h('div', { className: 'dpl-note', role: 'status' }, notice) : null,
    error ? h('div', { className: 'dpl-note', 'data-tone': 'err', role: 'alert' }, error) : null,
  );
}
// ---- 80-overview.js
// 總覽頁：連線狀態、快速設定、今日用量。
//
// 快速設定只是把分散在各頁的幾個關鍵設定集中在一起；所有變更都先寫進草稿，
// 列出「將變更的設定」，由使用者按下「儲存並連線」才送出，走的是與其他頁相同的
// 儲存與登入流程。後端預設值（試跑模式開啟、僅觀察、不自動回覆）不因此改變。

const SNOWFLAKE = /^\d{17,20}$/;

function CheckItem({ index, done, title, body, children }) {
  return h(
    'div',
    { className: 'dpl-check', 'data-done': done ? 'true' : 'false' },
    h(
      'div',
      { className: 'dpl-check-mark', 'aria-hidden': 'true' },
      done ? Icon.check({ size: 12 }) : String(index),
    ),
    h(
      'div',
      { className: 'dpl-check-main' },
      h(
        'div',
        { className: 'dpl-check-title' },
        title,
        done ? h('span', { className: 'dpl-sr' }, '（已完成）') : null,
      ),
      body ? h('div', { className: 'dpl-check-body' }, body) : null,
      children ? h('div', { className: 'dpl-check-control' }, children) : null,
    ),
  );
}

function Choice({ on, title, body, onClick, name }) {
  return h(
    'button',
    {
      type: 'button',
      className: 'dpl-choice',
      'data-on': on ? 'true' : 'false',
      'aria-pressed': on,
      'data-choice': name,
      onClick,
    },
    h('span', { className: 'dpl-choice-title' }, title),
    h('span', { className: 'dpl-choice-body' }, body),
  );
}

function QuickSetup({
  status,
  config,
  draft,
  setValue,
  fields,
  dirtyKeys,
  onLogin,
  busy,
  onNavigate,
  onTestModel,
  modelBusy,
  modelTest,
}) {
  const [probe, setProbe] = useState(null);
  const [probing, setProbing] = useState(false);
  const kind = draft.primaryTransport === 'bot' ? 'bot' : 'user';
  const isUser = kind === 'user';
  const tokenKey = isUser ? 'userToken' : 'botToken';
  const enabledKey = isUser ? 'userEnabled' : 'botEnabled';
  const token = String(draft[tokenKey] || '');
  const tokenSet = Boolean(config[`${tokenKey}__set`]);
  const connected = Boolean(status?.[kind]?.ok);
  const adminOk = SNOWFLAKE.test(String(draft.adminUserId || ''));
  const live =
    draft.dryRun === false && (!isUser || (draft.userReceiveOnly === false && draft.userAutoReply === true));

  const chooseKind = (next) => {
    setProbe(null);
    setValue('primaryTransport', next);
    setValue(next === 'user' ? 'userEnabled' : 'botEnabled', true);
  };
  const chooseMode = (goLive) => {
    setValue('dryRun', !goLive);
    if (isUser) {
      setValue('userReceiveOnly', !goLive);
      setValue('userAutoReply', goLive);
    }
  };
  const runProbe = async () => {
    setProbing(true);
    try {
      setProbe(
        await api('/probe-token', {
          method: 'POST',
          allowFailure: true,
          body: { transport: kind, ...(token ? { token } : {}) },
        }),
      );
    } catch (error) {
      setProbe({ valid: null, error: error.message });
    } finally {
      setProbing(false);
    }
  };

  // 只列出快速設定會動到的鍵；Token 只顯示「將更新」，不顯示內容。
  const wizardKeys = [
    'primaryTransport',
    enabledKey,
    tokenKey,
    'adminUserId',
    'dryRun',
    'userReceiveOnly',
    'userAutoReply',
  ];
  const autoKey = isUser ? 'userAutoStart' : 'botAutoStart';
  const dirtyChanges = dirtyKeys.filter((key) => wizardKeys.includes(key) || key === autoKey);
  // 第一次連線或有其他變更時，順便開啟「啟動時自動連線」，之後不必每次手動登入。
  const extra =
    (!connected || dirtyChanges.length) && config[autoKey] !== true && draft[autoKey] !== true
      ? { [autoKey]: true }
      : {};
  const changes = [...dirtyChanges, ...Object.keys(extra).filter((key) => !dirtyChanges.includes(key))];
  const show = (key, value) => {
    if (key === tokenKey) return value ? '將更新' : '不變';
    if (typeof value === 'boolean') return value ? '開啟' : '關閉';
    if (key === 'primaryTransport') return value === 'bot' ? '機器人' : '使用者帳號';
    return String(value || '（空白）');
  };
  const labelOf = (key) => fields.find((field) => field.key === key)?.label || key;
  const ready = (token || tokenSet) && Boolean(draft[enabledKey]);

  return h(
    Card,
    {
      title: connected && !changes.length ? '快速設定（已連線）' : '快速設定',
      icon: 'bolt',
      desc: '五個步驟完成第一次連線。前四步的選項都會先列出變更內容，按下「儲存並連線」才生效；第五步確認 AI 模型真的能回話。',
    },
    h(
      'div',
      { className: 'dpl-checklist' },
      h(
        CheckItem,
        { index: 1, done: Boolean(draft[enabledKey]), title: '選擇要連線的帳號' },
        h(
          'div',
          { className: 'dpl-choice-grid', style: { width: '100%' } },
          h(Choice, {
            name: 'kind-bot',
            on: !isUser,
            title: '機器人（建議）',
            body: '使用 Discord 官方的 Bot 帳號，符合平台規範。需要在 Developer Portal 建立應用程式。',
            onClick: () => chooseKind('bot'),
          }),
          h(Choice, {
            name: 'kind-user',
            on: isUser,
            title: '使用者帳號',
            body: '以一般帳號收發訊息。Discord 禁止自動化一般帳號，可能被停權，請使用小號。',
            onClick: () => chooseKind('user'),
          }),
        ),
      ),
      h(
        CheckItem,
        {
          index: 2,
          done: Boolean(token || tokenSet),
          title: isUser ? '貼上使用者 Token' : '貼上 Bot Token',
          body: isUser
            ? 'Token 只存在本機設定檔。取得方式：瀏覽器開發者工具的 Network 面板，複製任一請求的 authorization 標頭。'
            : '在 Developer Portal 的 Bot 頁面按 Reset Token 取得，並開啟 MESSAGE CONTENT INTENT，否則讀不到訊息內容。',
        },
        h(PasswordInput, {
          value: token,
          onChange: (value) => setValue(tokenKey, value),
          placeholder: tokenSet ? '已儲存（留空代表沿用）' : '貼上 Token',
        }),
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-sm',
            disabled: probing || !(token || tokenSet),
            onClick: runProbe,
          },
          probing ? '驗證中…' : '驗證 Token',
        ),
        probe
          ? h(
              'span',
              {
                className: 'dpl-pill',
                'data-tone': probe.valid ? 'ok' : probe.valid === false ? 'err' : 'warn',
                role: 'status',
              },
              probe.valid
                ? `有效：${probe.user?.tag || probe.user?.username || '已驗證'}`
                : `${probe.valid === false ? '憑證被拒絕' : '無法確認'}：${probe.error || '未知錯誤'}`,
            )
          : null,
      ),
      h(
        CheckItem,
        {
          index: 3,
          done: adminOk,
          title: '填入你自己的 Discord 使用者 ID',
          body: '這個帳號會被當成管理者，套用「管理者」的回覆設定並可使用停止、重答等操作；其他人套用「其他使用者」設定。在 Discord 開啟開發者模式後，右鍵自己的頭像選「複製使用者 ID」。',
        },
        h('input', {
          className: 'dpl-input',
          'data-mono': 'true',
          inputMode: 'numeric',
          'aria-label': '管理者使用者 ID',
          value: draft.adminUserId || '',
          placeholder: '例如 123456789012345678',
          'data-invalid': draft.adminUserId && !adminOk ? 'true' : 'false',
          onChange: (event) => setValue('adminUserId', event.target.value.trim()),
        }),
        draft.adminUserId && !adminOk
          ? h('span', { className: 'dpl-pill', 'data-tone': 'warn' }, '使用者 ID 應為 17～20 位數字')
          : null,
        adminOk && uiRuntime.names.has(String(draft.adminUserId))
          ? h('span', { className: 'dpl-pill', 'data-tone': 'ok', 'data-admin-name': '1' }, nameOfId(draft.adminUserId))
          : null,
        h(UserIdPicker, {
          single: true,
          value: draft.adminUserId || '',
          onChange: (id) => setValue('adminUserId', id),
        }),
        h(
          'button',
          { type: 'button', className: 'dpl-link', 'data-action': 'goto-people', onClick: () => onNavigate('people') },
          '設定白名單、黑名單與回覆範圍',
        ),
      ),
      h(
        CheckItem,
        { index: 4, done: true, title: '選擇回覆方式' },
        h(
          'div',
          { className: 'dpl-choice-grid', style: { width: '100%' } },
          h(Choice, {
            name: 'mode-observe',
            on: !live,
            title: '先觀察（試跑）',
            body: 'AI 會產生回覆並記錄在執行記錄，但不會對外送出任何訊息或表情。適合先確認設定。',
            onClick: () => chooseMode(false),
          }),
          h(Choice, {
            name: 'mode-live',
            on: live,
            title: '正式回覆',
            body: isUser
              ? '關閉試跑與僅觀察，開啟自動回覆。帳號會依回覆規則實際發言。'
              : '關閉試跑模式。機器人會依回覆規則實際發言。',
            onClick: () => chooseMode(true),
          }),
        ),
      ),
      h(
        CheckItem,
        {
          index: 5,
          done: Boolean(modelTest?.ok),
          title: '測試 AI 模型',
          body: '送一句測試訊息給目前設定的模型，確認登入、金鑰與額度都正常。沒有可用的模型時，AI 收到訊息也不會回話。這會實際呼叫一次模型，用量很小。',
        },
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-sm',
            'data-action': 'quick-test-model',
            disabled: Boolean(modelBusy) || !onTestModel,
            onClick: onTestModel,
          },
          modelBusy ? '測試中…' : modelTest ? '再測一次' : '測試模型',
        ),
        modelTest
          ? h(
              'span',
              { className: 'dpl-pill', 'data-tone': modelTest.ok ? 'ok' : 'err', role: 'status' },
              modelTest.ok ? '模型正常（' + modelTest.ms + ' 毫秒）' : '測試失敗：' + (modelTest.error || '未知錯誤'),
            )
          : null,
        modelTest && !modelTest.ok
          ? h(
              'button',
              { type: 'button', className: 'dpl-link', onClick: () => onNavigate('llm') },
              '前往模型設定',
            )
          : null,
      ),
    ),
    changes.length
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'info', role: 'note' },
          h('div', { className: 'dpl-note-title' }, `將變更 ${changes.length} 項設定`),
          h(
            'ul',
            { className: 'dpl-change-list' },
            changes.map((key) =>
              h(
                'li',
                { key },
                h('span', null, labelOf(key)),
                h('strong', null, show(key, key in extra ? extra[key] : draft[key])),
              ),
            ),
          ),
        )
      : null,
    h(
      'div',
      { className: 'dpl-actions', style: { marginTop: 10 } },
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-primary dpl-btn-lg',
          'data-action': 'quick-connect',
          disabled: busy || !ready,
          onClick: () => onLogin(kind, token, extra),
        },
        Icon.play({ size: 14 }),
        busy ? '連線中…' : connected ? '儲存並重新連線' : '儲存並連線',
      ),
      !ready ? h('span', { className: 'dpl-sub' }, '需要先完成步驟 1、2。') : null,
      h(
        'button',
        { type: 'button', className: 'dpl-link', onClick: () => onNavigate('llm') },
        '檢查模型設定',
      ),
    ),
  );
}

// 用量到上限的 80% 算「接近」，到 100% 算「已滿」。
const usageLevel = (kpi) =>
  !kpi.cap ? 'none' : kpi.value >= kpi.cap ? 'full' : kpi.value >= kpi.cap * 0.8 ? 'near' : 'ok';
function usageNotice(kpis) {
  const full = kpis.filter((kpi) => usageLevel(kpi) === 'full');
  const near = kpis.filter((kpi) => usageLevel(kpi) === 'near');
  if (!full.length && !near.length) return null;
  const names = (rows) => rows.map((kpi) => kpi.label).join('、');
  return h(
    'div',
    { className: 'dpl-note', 'data-tone': full.length ? 'err' : 'warn', role: 'status', 'data-usage-notice': full.length ? 'full' : 'near' },
    full.length
      ? h('span', null, names(full) + '今天已達上限，明天才會再回覆。這不是故障；想提高上限請到「回覆對象 → 回覆配額」。')
      : null,
    near.length ? h('span', null, names(near) + '已超過上限的八成，快用完了。') : null,
  );
}

// 「AI 怎麼不理我」：列出最近幾則被略過的訊息與原因。只顯示時間、帳號與原因，不顯示訊息內容。
function RecentSkips({ onNavigate }) {
  const loaded = useLoad(async () =>
    ((await api('/interaction'))?.interaction?.trace || []).filter((row) => row.phase === 'blocked').slice(0, 5),
  );
  const state = { kind: loaded.kind, rows: loaded.data || [], error: loaded.error };
  const load = loaded.reload;
  return h(
    Card,
    {
      title: '最近為什麼沒回',
      icon: 'chat',
      desc: '最近 5 則沒有回覆的訊息與原因。只列時間與原因，不顯示訊息內容。',
      actions: h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm', disabled: state.kind === 'loading', onClick: load },
        '重新整理',
      ),
    },
    h(
      'div',
      { 'data-recent-skips': state.kind },
      state.kind === 'error'
        ? h(StateView, { kind: 'error', title: '讀取失敗' }, state.error)
        : state.kind === 'loading' && !state.rows.length
          ? h(StateView, { kind: 'loading' })
          : state.rows.length
            ? state.rows.map((row) =>
                h(
                  'div',
                  { className: 'dpl-list-row', key: row.id },
                  h(Pill, { tone: 'muted' }, row.transport === 'user' ? '使用者帳號' : '機器人'),
                  h('span', { className: 'dpl-grow' }, row.reason || '沒有記錄原因'),
                  h('span', { className: 'dpl-kpi-cap' }, fmtTime(new Date(row.at).toISOString())),
                ),
              )
            : h(StateView, { kind: 'empty', title: '目前沒有被略過的訊息' }, '重新啟動後會清空；有訊息被略過時會出現在這裡。'),
    ),
    h(
      'button',
      {
        type: 'button',
        className: 'dpl-link',
        style: { alignSelf: 'flex-start', marginTop: 8 },
        onClick: () => onNavigate('companion'),
      },
      '查看完整的處理記錄',
    ),
  );
}

function OverviewPanel(props) {
  const { status, kpis, onNavigate } = props;
  const line = (kind, label) => {
    const s = status?.[kind];
    const tone = s?.ok ? 'ok' : s?.state === 'error' ? 'err' : 'muted';
    const text = s?.ok
      ? `${s.user?.tag || s.user?.username || '已連線'} · ${s.guildCount ?? 0} 個伺服器`
      : s?.state === 'error'
        ? s.message || '連線發生錯誤'
        : s?.state === 'connecting' || s?.state === 'reconnecting'
          ? '連線中…'
          : '尚未連線';
    return h(
      'div',
      { className: 'dpl-list-row', key: kind },
      h(Pill, { tone, dot: true }, label),
      h('span', { className: 'dpl-grow' }, text),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: () => onNavigate(kind) },
        '管理',
      ),
    );
  };
  return [
    h(QuickSetup, { key: 'quick-setup', ...props }),
    props.afterSetup || null,
    h(
      Card,
      { key: 'connections', title: '連線狀態', icon: 'power' },
      line('user', '使用者帳號'),
      line('bot', '機器人'),
    ),
    h(
      Card,
      {
        key: 'usage',
        title: '今日用量',
        icon: 'reply',
        desc: '達到上限後當日不再回覆；上限可在「回覆對象 → 回覆配額」調整。',
      },
      h(
        'div',
        { className: 'dpl-grid' },
        kpis.map((kpi) =>
          h(
            'div',
            { key: kpi.key, className: 'dpl-kpi' },
            h(
              'div',
              { className: 'dpl-kpi-head' },
              h('span', { className: 'dpl-kpi-label' }, kpi.label),
              h('span', { className: 'dpl-kpi-cap' }, kpi.cap ? `/ ${kpi.cap}` : '今日'),
            ),
            h('div', { className: 'dpl-kpi-value' }, fmtNum(kpi.value)),
            kpi.cap
              ? h(
                  'div',
                  { className: 'dpl-bar' },
                  h('div', {
                    className: 'dpl-bar-fill',
                    style: {
                      width: `${clamp((kpi.value / kpi.cap) * 100, 0, 100)}%`,
                      background:
                        usageLevel(kpi) === 'full'
                          ? 'var(--dpl-err)'
                          : usageLevel(kpi) === 'near'
                            ? 'var(--dpl-warn)'
                            : 'var(--dpl-accent)',
                    },
                  }),
                )
              : null,
          ),
        ),
      ),
      usageNotice(kpis),
    ),
    h(RecentSkips, { key: 'skips', onNavigate }),
  ];
}

// 管理者／其他使用者 × 私訊／群聊：四組設定共用一頁，以切換鈕選擇。
const AUDIENCE_LABELS = {
  adminDm: '管理者・私訊',
  adminGroup: '管理者・群聊',
  othersDm: '其他使用者・私訊',
  othersGroup: '其他使用者・群聊',
};
// 把目前這組的值填進另一組的草稿：只複製兩組都有的設定，回傳要寫入草稿的值。
function audienceCopyValues(fields, draft, from, to) {
  const known = new Set(fields.map((field) => field.key));
  const values = {};
  for (const field of fields) {
    if (!field.key.startsWith(from + '_')) continue;
    const target = to + field.key.slice(from.length);
    if (known.has(target) && !same(draft[field.key], draft[target])) values[target] = draft[field.key];
  }
  return values;
}

function AudienceSwitcher({ section, onChange, adminSet, onNavigate, fields = [], draft = {}, onCopy }) {
  const who = section.startsWith('admin') ? 'admin' : 'others';
  const scope = section.endsWith('Dm') ? 'Dm' : 'Group';
  // 私訊與群聊的選項不同，所以只在同一種場合之間複製（管理者 ↔ 其他使用者）。
  const copyTarget = (who === 'admin' ? 'others' : 'admin') + scope;
  const copyValues = audienceCopyValues(fields, draft, section, copyTarget);
  const copyCount = Object.keys(copyValues).length;
  const button = (target, label, on) =>
    h(
      'button',
      {
        key: target,
        type: 'button',
        'data-audience': target,
        'data-on': on ? 'true' : 'false',
        'aria-pressed': on,
        onClick: () => onChange(target),
      },
      label,
    );
  return h(
    Card,
    {
      title: '對象設定',
      icon: 'chat',
      desc: '同一套選項，依「對方是誰」與「在哪裡聊」分成四組。先選要調整的組合，下方就是該組合的設定。',
    },
    h(
      'div',
      { className: 'dpl-row', 'data-type': 'select' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h('div', { className: 'dpl-row-label' }, '對方是誰'),
        h(
          'div',
          { className: 'dpl-row-help' },
          '管理者是「基本設定」裡綁定的那個帳號；其餘所有人都是其他使用者。',
        ),
      ),
      h(
        'div',
        { className: 'dpl-row-control' },
        h(
          'div',
          { className: 'dpl-seg', role: 'group', 'aria-label': '對方是誰' },
          button('admin' + scope, '管理者', who === 'admin'),
          button('others' + scope, '其他使用者', who === 'others'),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dpl-row', 'data-type': 'select' },
      h('div', { className: 'dpl-row-main' }, h('div', { className: 'dpl-row-label' }, '在哪裡聊')),
      h(
        'div',
        { className: 'dpl-row-control' },
        h(
          'div',
          { className: 'dpl-seg', role: 'group', 'aria-label': '在哪裡聊' },
          button(who + 'Dm', '私訊', scope === 'Dm'),
          button(who + 'Group', '群聊', scope === 'Group'),
        ),
      ),
    ),
    onCopy
      ? h(
          'div',
          { className: 'dpl-row', 'data-type': 'action' },
          h(
            'div',
            { className: 'dpl-row-main' },
            h('div', { className: 'dpl-row-label' }, '複製到另一組'),
            h(
              'div',
              { className: 'dpl-row-help' },
              copyCount
                ? '把「' + AUDIENCE_LABELS[section] + '」目前的 ' + copyCount + ' 項不同設定填進「' + AUDIENCE_LABELS[copyTarget] + '」的草稿；按「儲存變更」才生效。'
                : '「' + AUDIENCE_LABELS[copyTarget] + '」目前與這一組完全相同。',
            ),
          ),
          h(
            'div',
            { className: 'dpl-row-control' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn dpl-btn-sm',
                'data-audience-copy': copyTarget,
                disabled: !copyCount,
                onClick: () => onCopy(copyValues, AUDIENCE_LABELS[section], AUDIENCE_LABELS[copyTarget]),
              },
              '複製到「' + AUDIENCE_LABELS[copyTarget] + '」',
            ),
          ),
        )
      : null,
    !adminSet
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'warn', role: 'note' },
          '尚未綁定管理者 ID，目前所有人都套用「其他使用者」設定。',
          h(
            'button',
            {
              type: 'button',
              className: 'dpl-link',
              style: { alignSelf: 'flex-start' },
              onClick: () => onNavigate('overview'),
            },
            '前往快速設定',
          ),
        )
      : null,
  );
}

// 懶人設定：依使用情境一次調好「回覆誰、要不要主動插話」。
// 只是把一組設定值套到草稿上，仍要按「儲存變更」才生效；不會動到 Token、試跑模式等安全設定。
const SCENARIO_PRESETS = [
  {
    id: 'private',
    name: '只陪我聊',
    desc: '只回應管理者（你自己）：私訊會回，在群組被你 @ 也會回；其他人一律不回應。',
    needsAdmin: true,
    values: {
      adminDm_dmReplyEnabled: true,
      adminGroup_mentionReplyEnabled: true,
      adminGroup_followupEnabled: true,
      adminGroup_coChatEnabled: false,
      othersDm_dmReplyEnabled: false,
      othersGroup_mentionReplyEnabled: false,
      othersGroup_followupEnabled: false,
      othersGroup_coChatEnabled: false,
      othersGroup_autoReactionEnabled: false,
    },
  },
  {
    id: 'helper',
    name: '群組小幫手',
    desc: '群組裡任何人 @ 才回應，回完會接續聊一小段；不主動插話，也不回陌生人的私訊。',
    values: {
      adminDm_dmReplyEnabled: true,
      othersDm_dmReplyEnabled: false,
      adminGroup_mentionReplyEnabled: true,
      othersGroup_mentionReplyEnabled: true,
      adminGroup_followupEnabled: true,
      othersGroup_followupEnabled: true,
      adminGroup_coChatEnabled: false,
      othersGroup_coChatEnabled: false,
    },
  },
  {
    id: 'lively',
    name: '活躍群友',
    desc: '除了被 @ 會回，還會在你指定的頻道主動插話、按表情、傳 GIF。套用後請到「回覆對象 → 對象設定」選擇參與閒聊的頻道。',
    values: {
      adminDm_dmReplyEnabled: true,
      othersDm_dmReplyEnabled: false,
      adminGroup_mentionReplyEnabled: true,
      othersGroup_mentionReplyEnabled: true,
      adminGroup_followupEnabled: true,
      othersGroup_followupEnabled: true,
      adminGroup_coChatEnabled: true,
      othersGroup_coChatEnabled: true,
      adminGroup_coChatProbability: 25,
      othersGroup_coChatProbability: 25,
      adminGroup_autoReactionEnabled: true,
      othersGroup_autoReactionEnabled: true,
      adminGroup_gifEnabled: true,
      othersGroup_gifEnabled: true,
    },
  },
  {
    id: 'open',
    name: '公開聊天夥伴',
    desc: '所有人都可以私訊或在群組 @ 它聊天。適合想把 AI 朋友開放給大家的情境；請留意每日回覆上限。',
    values: {
      adminDm_dmReplyEnabled: true,
      othersDm_dmReplyEnabled: true,
      adminGroup_mentionReplyEnabled: true,
      othersGroup_mentionReplyEnabled: true,
      adminGroup_followupEnabled: true,
      othersGroup_followupEnabled: true,
    },
  },
];

// 語音夥伴：語音需要聲音工坊先就緒，所以做成帶檢查的引導，而不是單純套值。
// 只開「語音輸出」與「朗讀回覆」；收聽別人說話牽涉參與者同意，仍須到語音頁自行開啟。
const VOICE_PARTNER_VALUES = { voiceEnabled: true, voiceAutoSpeak: true };
function VoicePartnerGuide({ fields, draft, onApply, onNavigate }) {
  const [state, setState] = useState({ kind: 'idle' });
  const known = new Set(fields.map((field) => field.key));
  const values = Object.fromEntries(Object.entries(VOICE_PARTNER_VALUES).filter(([key]) => known.has(key)));
  const active = Object.keys(values).length > 0 && Object.entries(values).every(([key, value]) => same(draft[key], value));
  const check = async () => {
    setState({ kind: 'loading' });
    try {
      const payload = await api('/voice');
      setState({ kind: 'ready', tts: payload.tts || null });
    } catch (error) {
      setState({ kind: 'error', error: error.message });
    }
  };
  const ttsReady = state.kind === 'ready' && Boolean(state.tts?.ready);
  return h(
    Card,
    {
      title: '語音夥伴',
      icon: 'voice',
      desc: '讓 AI 在語音房把回覆唸出來。需要先在「DSH 聲音工坊」設定好聲音。',
    },
    h(
      'div',
      { className: 'dpl-checklist', 'data-voice-guide': state.kind },
      h(
        CheckItem,
        { index: 1, done: ttsReady, title: '確認聲音工坊可以合成語音' },
        h(
          'button',
          { type: 'button', className: 'dpl-btn dpl-btn-sm', disabled: state.kind === 'loading', onClick: check },
          state.kind === 'loading' ? '檢查中…' : state.kind === 'idle' ? '檢查' : '重新檢查',
        ),
        state.kind === 'ready'
          ? h(
              'span',
              { className: 'dpl-pill', 'data-tone': ttsReady ? 'ok' : 'warn', role: 'status' },
              ttsReady
                ? '可用：' + (state.tts.name || state.tts.provider || '語音服務')
                : '語音服務尚未就緒，請先到「DSH 聲音工坊」完成試聽',
            )
          : null,
        state.kind === 'error'
          ? h('span', { className: 'dpl-pill', 'data-tone': 'err', role: 'alert' }, '檢查失敗：' + state.error)
          : null,
      ),
      h(
        CheckItem,
        { index: 2, done: active, title: '開啟語音輸出與朗讀回覆', body: '套用後只是先填進草稿，按下方「儲存變更」才生效。' },
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-sm',
            'data-action': 'voice-partner-apply',
            disabled: !ttsReady || active,
            onClick: () => onApply(values, '語音夥伴'),
          },
          active ? '已套用' : '套用',
        ),
        !ttsReady && !active ? h('span', { className: 'dpl-sub' }, '先完成步驟 1。') : null,
      ),
      h(
        CheckItem,
        {
          index: 3,
          done: false,
          title: '選擇語音房並加入',
          body: '到「語音 → 語音與音樂」選擇帳號與伺服器，從自動偵測的房間名稱清單加入。允許房間留空代表不限，仍須有 Discord 權限。想讓 AI 聽懂大家說話，需要另外開啟收聽並確認已取得參與者同意。',
        },
        h(
          'button',
          { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: () => onNavigate('voice') },
          '前往語音設定',
        ),
      ),
    ),
  );
}

function PresetCard({ fields, draft, adminSet, onApply }) {
  const known = new Set(fields.map((field) => field.key));
  // 只套用這個版本確實存在的設定鍵。
  const valuesOf = (preset) =>
    Object.fromEntries(Object.entries(preset.values).filter(([key]) => known.has(key)));
  return h(
    Card,
    {
      title: '懶人設定',
      icon: 'bolt',
      desc: '依使用情境一次調好「回覆誰、要不要主動插話」。套用後只是先填進草稿，按下方「儲存變更」才生效；之後仍可到各頁細調。',
    },
    h(
      'div',
      { className: 'dpl-choice-grid' },
      SCENARIO_PRESETS.map((preset) => {
        const values = valuesOf(preset);
        const active =
          Object.keys(values).length > 0 &&
          Object.entries(values).every(([key, value]) => same(draft[key], value));
        return h(
          'button',
          {
            key: preset.id,
            type: 'button',
            className: 'dpl-choice',
            'data-preset': preset.id,
            'data-on': active ? 'true' : 'false',
            'aria-pressed': active,
            onClick: () => onApply(values, preset.name),
          },
          h(
            'span',
            { className: 'dpl-choice-title' },
            preset.name,
            active ? h('span', { className: 'dpl-badge', style: { marginLeft: 8 } }, '目前符合') : null,
          ),
          h('span', { className: 'dpl-choice-body' }, preset.desc),
          preset.needsAdmin && !adminSet
            ? h(
                'span',
                { className: 'dpl-choice-body', style: { color: 'var(--dpl-warn)' } },
                '需要先在上方快速設定填入管理者 ID，否則沒有人會被回應。',
              )
            : null,
        );
      }),
    ),
  );
}
// ---- 90-hub.js
function DiscordHubPanel() {
  useUiLanguage();
  ensureStyles();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [schema, setSchema] = useState(null);
  const [config, setConfig] = useState({});
  const [draft, setDraft] = useState({});
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState({});
  const [section, setSection] = useState('overview');
  const [logs, setLogs] = useState([]);
  const [logLevel, setLogLevel] = useState('info');
  const [channels, setChannels] = useState([]);
  const [historyStats, setHistoryStats] = useState(null);
  const [historyMessages, setHistoryMessages] = useState([]);
  const historyRequest = useRef(0);
  const [activeChannel, setActiveChannel] = useState(null);
  const [providers, setProviders] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [memoryOutput, setMemoryOutput] = useState(null);
  const [culture, setCulture] = useState(null);
  const [lastTest, setLastTest] = useState(null);
  const [testBusy, setTestBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);
  const baselineRef = useRef({});
  const statusRequestRef = useRef(0);
  const [settingsQuery, setSettingsQuery] = useState('');
  // 儲存列的「查看變更」：列出每一項從什麼改成什麼。
  const [showChanges, setShowChanges] = useState(false);

  const showToast = (message, tone = 'ok') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3200);
  };

  const loadAll = async (silent) => {
    if (!silent) setLoading(true);
    const requestId = ++statusRequestRef.current;
    try {
      const payload = await api('/status');
      if (requestId !== statusRequestRef.current) return;
      // 內容沒變就沿用原物件：背景輪詢拿到相同資料時不觸發整個面板重繪。
      const keep = (next) => (previous) => (same(previous, next) ? previous : next);
      setStatus(keep({ ...payload.status, dailyStats: payload.dailyStats || payload.status?.dailyStats }));
      setConfig(keep(payload.config));
      const previousBaseline = baselineRef.current;
      setDraft((previous) => {
        const next = { ...payload.config };
        for (const key of Object.keys(previous))
          if (!same(previous[key], previousBaseline[key])) next[key] = previous[key];
        return same(previous, next) ? previous : next;
      });
      baselineRef.current = payload.config;
      setLogs(keep(payload.logs || []));
      setChannels(keep(payload.channels || []));
      setHistoryStats(keep(payload.history || null));
      setProviders(keep(payload.providers || []));
      setSessions(keep(payload.sessions || []));
      setMemoryOutput(keep(payload.memoryOutput || null));
      setCulture(keep(payload.culture || null));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const payload = await api('/schema');
        setSchema(payload.schema);
      } catch (err) {
        setError(err.message);
      }
      await loadAll(false);
    })();
  }, []);

  useEffect(() => {
    const seconds = clamp(Number(config.statusRefreshSeconds) || 30, 5, 600);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => pageHidden() || loadAll(true), seconds * 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [config.statusRefreshSeconds]);

  // 把設定裡的 ID 對應成名稱：出現還不認得的 ID 時向後端查一次（只查本機快取）。
  useIdNames(collectIds(config, draft));

  const dirtyKeys = useMemo(
    () => Object.keys(draft).filter((key) => !same(draft[key], config[key])),
    [draft, config],
  );

  const setValue = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));

  // extra：呼叫端要一併寫入的設定（例如快速設定的自動連線），與草稿變更一起送出。
  const saveWith = async (extra = {}) => {
    const patch = {};
    for (const key of dirtyKeys) patch[key] = draft[key];
    for (const [key, value] of Object.entries(extra)) if (!same(value, config[key])) patch[key] = value;
    const savedCount = Object.keys(patch).length;
    if (!savedCount) return true;
    setBusy((previous) => ({ ...previous, save: true }));
    try {
      const payload = await api('/config', { method: 'POST', body: patch });
      setConfig(payload.config);
      baselineRef.current = payload.config;
      setDraft({ ...payload.config });
      const appearance = payload.liveResults?.userPresence;
      showToast(
        `已儲存 ${savedCount} 項設定${(payload.restarted || []).length ? `（已重新連線 ${payload.restarted.join(' / ')}）` : ''}` +
          (appearance && !appearance.ok
            ? '；' + (appearance.pending ? appearance.error : '外觀套用失敗：' + appearance.error)
            : ''),
        appearance && !appearance.ok && !appearance.pending ? 'err' : 'ok',
      );
      await loadAll(true);
      return true;
    } catch (err) {
      showToast(err.message, 'err');
      return false;
    } finally {
      setBusy((previous) => ({ ...previous, save: false }));
    }
  };

  const save = () => saveWith();

  const login = async (kind, token, extra) => {
    if (!(await saveWith(extra))) return;
    setBusy((previous) => ({ ...previous, [kind]: true }));
    try {
      const payload = await api('/login', {
        method: 'POST',
        body: { transport: kind, ...(token ? { token } : {}) },
      });
      setStatus(payload.status);
      showToast(
        payload.pending
          ? 'Python 正在連線，請觀察連線狀態'
          : `${kind === 'user' ? '使用者帳號' : '機器人'} 已連線`,
      );
      await loadAll(true);
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      setBusy((previous) => ({ ...previous, [kind]: false }));
    }
  };

  const logout = async (kind) => {
    setBusy((previous) => ({ ...previous, [kind]: true }));
    try {
      const payload = await api('/logout', { method: 'POST', body: { transport: kind } });
      setStatus(payload.status);
      showToast('已斷開連線');
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      setBusy((previous) => ({ ...previous, [kind]: false }));
    }
  };

  const refreshLogs = async () => {
    try {
      const payload = await api('/logs?limit=120');
      setLogs(payload.logs || []);
    } catch (err) {
      showToast(err.message, 'err');
    }
  };

  const clearLogs = async () => {
    try {
      await api('/logs/clear', { method: 'POST', body: {} });
      setLogs([]);
      showToast('執行記錄已清空');
    } catch (err) {
      showToast(err.message, 'err');
    }
  };

  const openChannel = async (channelId) => {
    const request = ++historyRequest.current;
    setHistoryMessages([]);
    setActiveChannel(channelId);
    if (!channelId) return;
    try {
      const payload = await api(`/history?channelId=${encodeURIComponent(channelId)}&limit=60`);
      if (request === historyRequest.current) setHistoryMessages(payload.messages || []);
    } catch (err) {
      showToast(err.message, 'err');
    }
  };

  const clearHistory = async (channelId) => {
    try {
      historyRequest.current++;
      const payload = await api('/history/clear', { method: 'POST', body: channelId ? { channelId } : { confirmed: true } });
      setHistoryStats(payload.stats || null);
      setHistoryMessages([]);
      setActiveChannel(null);
      await loadAll(true);
      showToast(channelId ? '已清除該頻道快取' : '已清除全部快取');
    } catch (err) {
      showToast(err.message, 'err');
    }
  };

  const testModel = async () => {
    setTestBusy(true);
    setLastTest(null);
    try {
      const payload = await api('/test-llm', { method: 'POST', body: {} });
      setLastTest(payload.result);
      showToast(
        payload.result.ok ? `模型正常（${payload.result.ms}ms）` : '模型測試失敗',
        payload.result.ok ? 'ok' : 'err',
      );
    } catch (err) {
      setLastTest({ ok: false, error: err.message });
      showToast(err.message, 'err');
    } finally {
      setTestBusy(false);
    }
  };

  const sendTest = async (channelId, content) => {
    setSending(true);
    try {
      await api('/send', { method: 'POST', body: { channelId, content, type: 'text' } });
      showToast('測試訊息已送出');
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      setSending(false);
    }
  };

  // 提供給欄位元件的顯示用資訊：已連線的帳號（供清單挑選）與宿主可用的模型服務。
  uiRuntime.kinds = ['user', 'bot'].filter((kind) => status?.[kind]?.ok);
  uiRuntime.providers = providers || [];
  for (const channel of channels || [])
    if (channel?.id && channel?.name) uiRuntime.names.set(String(channel.id), channel.name);

  const sections = schema?.sections || [];
  const groups = schema?.groups || [];
  const fields = schema?.fields || [];
  const transportInfo = schema?.transportInfo || {};
  const fieldsOf = (sectionId) => fields.filter((field) => field.section === sectionId);
  const AUDIENCE_SECTIONS = ['adminDm', 'adminGroup', 'othersDm', 'othersGroup'];
  const isAudience = AUDIENCE_SECTIONS.includes(section);
  const currentSection = sections.find((item) => item.id === section);
  const activeGroup = currentSection?.group || groups[0]?.id;
  const go = (id) => {
    setSettingsQuery('');
    setSection(id);
  };
  const appearanceKeys = new Set([
    'userPresenceEnabled',
    'userStatus',
    'userActivityType',
    'userActivityText',
    'userCustomStatusText',
    'userCustomStatusEmoji',
  ]);
  // 這些欄位已在帳號連線卡內呈現，欄位清單不重複顯示。
  const duplicatedConnectionFields = new Set([
    'userEnabled',
    'userToken',
    'userAutoStart',
    'botEnabled',
    'botToken',
    'botAutoStart',
    'botActivityText',
    'botActivityType',
  ]);
  const stats = status?.dailyStats || {};
  const caps = {
    mention: Number(draft.maxDailyMentionReplies) || 60,
    dm: Number(draft.maxDailyDmReplies) || 60,
    cochat: Number(draft.maxDailyCoChats) || 80,
  };
  const kpis = [
    { key: 'mention', label: '@ 回覆', value: stats.mentionReplies || 0, cap: caps.mention },
    { key: 'dm', label: '私訊回覆', value: stats.dmReplies || 0, cap: caps.dm },
    { key: 'cochat', label: '閒聊插話', value: stats.coChats || 0, cap: caps.cochat },
    { key: 'reaction', label: '表情反應', value: stats.reactions || 0, cap: 0 },
  ];

  const fieldCard = (sectionId, title, icon, desc) => {
    const list = fieldsOf(sectionId).filter(
      (f) => !duplicatedConnectionFields.has(f.key) && !appearanceKeys.has(f.key),
    );
    return h(
      Card,
      { key: sectionId + '-fields', title, icon, desc },
      h(FieldList, { fields: list, config, draft, setValue, dirtyKeys }),
    );
  };

  // 私訊對象頁以「回覆這類對象的私訊」為總開關：關閉時只留開關，不顯示其餘細部設定。
  const audienceCards = () => {
    const masterKey = section.endsWith('Dm') ? section + '_dmReplyEnabled' : '';
    const master = masterKey ? fields.find((field) => field.key === masterKey) : null;
    const title = currentSection?.label || section;
    if (!master) return [fieldCard(section, title, currentSection?.icon || 'chat')];
    const rest = fieldsOf(section).filter((field) => field.key !== masterKey);
    const on = draft[masterKey] !== false;
    return [
      h(
        Card,
        { key: section + '-master', title, icon: currentSection?.icon || 'chat' },
        h(FieldList, { fields: [master], config, draft, setValue, dirtyKeys, flat: true }),
        on
          ? null
          : h(
              StateView,
              {
                kind: 'off',
                title: section.startsWith('others') ? '目前不回覆其他使用者的私訊' : '目前不回覆管理者的私訊',
              },
              '細部設定已收起。開啟上方開關後，可以調整人格、圖片與回覆節奏。',
            ),
      ),
      on
        ? h(
            Card,
            { key: section + '-fields', title: '細部設定', icon: 'settings' },
            h(FieldList, { fields: rest, config, draft, setValue, dirtyKeys }),
          )
        : null,
    ];
  };

  const renderSection = () => {
    if (section === 'overview')
      return [
        ...OverviewPanel({
          status,
          kpis,
          config,
          draft,
          setValue,
          fields,
          dirtyKeys,
          onLogin: login,
          busy: Boolean(busy.user || busy.bot || busy.save),
          onNavigate: go,
          onTestModel: testModel,
          modelBusy: testBusy,
          modelTest: lastTest,
          afterSetup: h(PresetCard, {
            key: 'presets',
            fields,
            draft,
            adminSet: Boolean(draft.adminUserId),
            onApply: (values, name) => {
              setDraft((previous) => ({ ...previous, ...values }));
              showToast('已套用「' + name + '」到草稿，按下方「儲存變更」才會生效', 'ok');
            },
          }),
        }),
        h(VoicePartnerGuide, {
          key: 'voice-partner',
          fields,
          draft,
          onNavigate: go,
          onApply: (values, name) => {
            setDraft((previous) => ({ ...previous, ...values }));
            showToast('已套用「' + name + '」到草稿，按下方「儲存變更」才會生效', 'ok');
          },
        }),
        h(QuickTest, { key: 'quick', onSend: sendTest, busy: sending }),
      ];
    if (isAudience)
      return [
        h(AudienceSwitcher, {
          key: 'audience-switch',
          section,
          onChange: setSection,
          adminSet: Boolean(config.adminUserId),
          onNavigate: go,
          fields,
          draft,
          onCopy: (values, from, to) => {
            setDraft((previous) => ({ ...previous, ...values }));
            showToast('已把「' + from + '」的設定填進「' + to + '」的草稿，按「儲存變更」才會生效', 'ok');
          },
        }),
        ...audienceCards(),
      ];
    if (section === 'voice')
      return [h(VoicePanel, { key: 'voice', dirtyKeys }), fieldCard('voice', '語音設定', 'voice')];
    if (section === 'advanced')
      return [
        h(ConfigTools, {
          key: 'config-tools',
          fields,
          onApplied: () => loadAll(true),
          onError: (message) => showToast(message, 'err'),
        }),
        h(TokenBudgetPanel, { key: 'budget' }),
        fieldCard('advanced', '進階設定', 'advanced'),
      ];
    if (section === 'culture') return [fieldCard('culture', '辨識、學習與使用規則', 'reaction')];
    if (section === 'memoryOutput')
      return [
        fieldCard('memoryOutput', '記憶輸出設定', 'history'),
        h(MemoryMaintenancePanel, { key: 'maintenance' }),
        h(ExternalMemoryPanel, { key: 'external-memory' }),
        h(MemoryOutputPanel, {
          key: 'memory-output',
          info: memoryOutput,
          onRefresh: () => loadAll(true),
          onError: (e) => showToast(e, 'err'),
        }),
      ];
    if (section === 'sessions')
      return [
        h(BehaviorPanel, { key: 'behavior', dirtyKeys, onConfigSaved: () => loadAll(true) }),
        fieldCard('sessions', 'DSH 會話與外部人格', 'history'),
        h(
          Card,
          {
            key: 'session-list',
            title: 'Discord 對應會話',
            icon: 'history',
            desc: '每個接收帳號／頻道各自對應持久 DSH 會話；可在 DSH 側邊欄依標題找到。工作區與會話人格請使用外部插件設定。',
          },
          sessions.length
            ? sessions.map((item) =>
                h(SessionRow, {
                  key: item.key + ':' + item.sessionId,
                  session: item,
                  onUpdated: () => loadAll(true),
                  onError: (e) => showToast(e, 'err'),
                }),
              )
            : h(
                StateView,
                { kind: 'empty', title: '尚無對應會話' },
                '正式回覆模式下，收到需要回覆的訊息後會自動建立。',
              ),
        ),
      ];
    if (section === 'user' || section === 'bot') {
      return [
        h(TransportCard, {
          key: 'transport',
          kind: section,
          info: transportInfo[section],
          status: status?.[section],
          config,
          draft,
          setValue,
          fields,
          onLogin: login,
          onLogout: logout,
          onNavigate: go,
          busy: Boolean(busy[section]),
        }),
        section === 'bot' && draft.botNativeInteractions && !draft.botSlashCommands
          ? h(
              'div',
              { key: 'native-hint', className: 'dpl-note', 'data-tone': 'warn', role: 'note' },
              h('div', { className: 'dpl-note-title' }, '原生互動還需要註冊斜線指令'),
              h(
                'div',
                { className: 'dpl-note-body' },
                '「原生互動與訊息右鍵選單」已開啟，但「註冊斜線指令」是關閉的，Discord 上不會出現指令入口。請在下方「互動功能」一併開啟並儲存，再重新登入機器人；全域指令同步可能需要一段時間。',
              ),
            )
          : null,
        section === 'user'
          ? h(UserConversationDesk, {
              key: 'user-desk',
              status: status?.user,
              adminUserId: config.adminUserId,
            })
          : null,
        section === 'user'
          ? h(UserPresenceCard, {
              key: 'user-presence',
              fields: fieldsOf('user').filter((f) => appearanceKeys.has(f.key)),
              config,
              draft,
              setValue,
              dirtyKeys,
              status: status?.user,
              onRefresh: () => loadAll(true),
            })
          : null,
        fieldCard(section, section === 'user' ? '使用者帳號設定' : '機器人設定', section),
      ];
    }
    if (section === 'log') {
      return [
        fieldCard('log', '記錄設定', 'log'),
        h(LogPanel, {
          key: 'logs',
          logs,
          level: logLevel,
          setLevel: setLogLevel,
          onRefresh: refreshLogs,
          onClear: clearLogs,
        }),
      ];
    }
    if (section === 'channelActions')
      return [
        fieldCard('channelActions', '訊息操作設定', 'chat'),
        h(ChannelActionsPanel, { key: 'channel-actions', config, onNavigate: go }),
      ];
    if (section === 'history') {
      return [
        fieldCard('history', '聊天快取設定', 'history'),
        h(HistoryPanel, {
          key: 'hist',
          channels,
          historyStats,
          messages: historyMessages,
          activeChannel,
          onOpen: openChannel,
          onClear: () => clearHistory(null),
          onClearChannel: (channelId) => clearHistory(channelId),
        }),
      ];
    }
    if (section === 'gif') {
      return [fieldCard('gif', 'GIF 設定', 'gif'), h(GifPanel, { key: 'gif', config })];
    }
    if (section === 'llm') {
      return [
        fieldCard('llm', '模型設定', 'model'),
        h(ModelTest, { key: 'test', providers, draft: config, onTest: testModel, busy: testBusy, lastTest }),
      ];
    }
    if (section === 'topics') return [h(ConversationTopics, { key: 'conversation-topics' })];
    if (section === 'reaction')
      return [
        fieldCard('reaction', '反應與表情圖片', 'reaction'),
        h(MemeImagesPanel, { key: 'meme-images', onNavigate: go }),
      ];
    if (section === 'capabilities') return [h(CapabilitiesPanel, { key: 'capabilities', onNavigate: go })];
    if (section === 'singing')
      return [
        fieldCard('singing', '唱歌工作設定', 'voice'),
        h(SingingGuide, { key: 'singing-guide', onNavigate: go }),
      ];
    if (section === 'companion')
      return [
        fieldCard('companion', '陪伴與安靜時段', 'chat'),
        h(InteractionConsole, { key: 'interaction-console', onNavigate: go }),
      ];
    if (section === 'people') {
      const pick = (keys) => keys.map((key) => fields.find((field) => field.key === key)).filter(Boolean);
      const count = (key) => (Array.isArray(draft[key]) ? draft[key].length : 0);
      // 其他功能各自的名單：留在原本的分區，這裡列出目前人數／頻道數並提供前往。
      const elsewhere = [
        ['othersGroup', 'othersGroup_monitoredChannelIds', '參與閒聊的頻道（其他使用者・群聊）', 'othersGroup'],
        ['adminGroup', 'adminGroup_monitoredChannelIds', '參與閒聊的頻道（管理者・群聊）', 'adminGroup'],
        ['reaction', 'reactionControlUserIds', '可以用表情操作別人訊息的使用者', 'reaction'],
        ['voice', 'voiceReceiveUserIds', '語音房收聽哪些成員', 'voice'],
        ['voice', 'voiceMessageUserIds', '哪些成員可以用語音訊息', 'voice'],
        ['voice', 'voiceAllowedChannelIds', '允許加入的語音頻道', 'voice'],
        ['singing', 'singingAllowedUserIds', '哪些群友可以請 AI 唱歌', 'singing'],
        ['culture', 'cultureChorusChannelIds', '可以接龍的頻道', 'culture'],
        ['memoryOutput', 'memoryGroupChannelIds', '收集哪些群聊頻道做日記', 'memoryOutput'],
      ].filter(([, key]) => fields.some((field) => field.key === key));
      return [
        h(
          Card,
          {
            key: 'people-who',
            title: '誰可以跟 AI 互動',
            icon: 'user',
            desc: '設定裡存的是 Discord ID，畫面上會顯示名稱。可以直接從「最近說過話的人」挑選，不必手動複製 ID。判斷順序：黑名單 → 管理者 → 白名單。',
          },
          h(FieldList, {
            fields: pick(['adminUserId', 'whitelistUserIds', 'blacklistUserIds', 'replyCooldownExemptUserIds']),
            config,
            draft,
            setValue,
            dirtyKeys,
            flat: true,
          }),
          h(
            'div',
            { className: 'dpl-row-help', style: { marginTop: 8 } },
            '管理者也可以從清單選：',
            h(UserIdPicker, {
              single: true,
              value: draft.adminUserId || '',
              onChange: (id) => setValue('adminUserId', id),
            }),
          ),
        ),
        h(
          Card,
          {
            key: 'people-where',
            title: '在哪裡回覆',
            icon: 'chat',
            desc: '限制 AI 只在特定伺服器回覆，或排除某些頻道。主動插話的頻道另外在「對象設定」指定。',
          },
          h(FieldList, {
            fields: pick(['monitoredGuildIds', 'blacklistChannelIds']),
            config,
            draft,
            setValue,
            dirtyKeys,
            flat: true,
          }),
        ),
        h(
          Card,
          {
            key: 'people-elsewhere',
            title: '其他功能自己的名單',
            icon: 'settings',
            desc: '這些名單只影響單一功能，設定留在各自的頁面。',
          },
          elsewhere.map(([, key, label, target]) =>
            h(
              'div',
              { className: 'dpl-list-row', key, 'data-people-link': key },
              h('span', { className: 'dpl-grow' }, label),
              h(Pill, { tone: count(key) ? 'ok' : 'muted' }, count(key) ? count(key) + ' 項' : '未設定'),
              h('button', { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: () => go(target) }, '前往'),
            ),
          ),
        ),
      ];
    }
    if (section === 'general')
      return [
        fieldCard(
          'general',
          '基本設定',
          'settings',
          '總開關、管理者，以及同時連線使用者帳號與機器人時由哪個帳號負責回覆。',
        ),
      ];
    return [fieldCard(section, currentSection?.label || section, currentSection?.icon || 'settings')];
  };

  if (loading)
    return h('div', { className: 'dpl' }, h(StateView, { kind: 'loading', title: '載入 Discord 賽博群友…' }));

  if (error && !status) {
    return h(
      'div',
      { className: 'dpl' },
      h(
        StateView,
        {
          kind: 'error',
          title: '無法載入 Discord 賽博群友的設定',
          action: h(
            'button',
            { type: 'button', className: 'dpl-btn dpl-btn-primary', onClick: () => loadAll(false) },
            '重試',
          ),
        },
        error,
      ),
    );
  }

  const query = settingsQuery.trim();
  const matchesSettings = (field) => {
    const texts = [field.label, field.help, sections.find((x) => x.id === field.section)?.label || ''];
    const q = query.toLocaleLowerCase();
    return [texts.join(' '), texts.map((text) => uiLocale.convert(text || '')).join(' ')].some((text) =>
      text.toLocaleLowerCase().includes(q),
    );
  };
  const found = query ? fields.filter(matchesSettings) : [];
  const statusPill = (kind, label) => {
    const s = status?.[kind];
    return h(
      'button',
      {
        type: 'button',
        className: 'dpl-pill',
        'data-tone': s?.ok ? 'ok' : s?.state === 'error' ? 'err' : 'muted',
        title: '前往' + label + '設定',
        onClick: () => go(kind),
      },
      h('span', { className: 'dpl-dot' }),
      label + ' ' + (s?.ok ? s.user?.tag || '已連線' : s?.state === 'error' ? '錯誤' : '未連線'),
    );
  };
  // 四個對象分區在導覽上合併為一個「對象設定」。
  const groupSections = sections.filter((item) => item.group === activeGroup);
  const navItems = [];
  for (const item of groupSections) {
    if (AUDIENCE_SECTIONS.includes(item.id)) {
      if (!navItems.some((entry) => entry.id === 'audience'))
        navItems.push({
          id: 'audience',
          label: '對象設定',
          icon: 'chat',
          target: isAudience ? section : 'adminDm',
        });
    } else navItems.push({ ...item, target: item.id });
  }
  const masterKey = { user: 'userEnabled', bot: 'botEnabled', general: 'enabled', voice: 'voiceEnabled' };
  const dirtyLabels = dirtyKeys
    .slice(0, 4)
    .map((key) => fields.find((field) => field.key === key)?.label || key)
    .join('、');

  return h(
    'div',
    { className: 'dpl' },
    h(
      'header',
      { className: 'dpl-top' },
      h(
        'div',
        { className: 'dpl-top-title' },
        h('div', { className: 'dpl-logo' }, Icon.hub({ size: 20 })),
        h(
          'div',
          null,
          h('h1', null, 'Discord 賽博群友'),
          h(
            'p',
            { className: 'dpl-sub' },
            '讓 DSH 化身群友：透過使用者帳號或機器人在 Discord 聊天、互動與語音',
          ),
        ),
      ),
      h(
        'div',
        { className: 'dpl-actions' },
        statusPill('user', '使用者'),
        statusPill('bot', '機器人'),
        h(UiLanguagePicker),
        h(
          'button',
          { type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-ghost', onClick: () => loadAll(false) },
          Icon.refresh({ size: 13 }),
          '重新整理',
        ),
      ),
    ),

    error
      ? h('div', { className: 'dpl-note', 'data-tone': 'err', role: 'alert' }, '更新狀態失敗：' + error)
      : null,
    draft.enabled === false
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'warn', role: 'note' },
          '總開關目前關閉，兩種帳號都不會收發訊息。可在「開始 → 基本設定」開啟。',
        )
      : null,

    h(
      'div',
      { className: 'dpl-navwrap' },
      h(
        'div',
        { className: 'dpl-navbar' },
        h(
          'div',
          { className: 'dpl-groups', role: 'tablist', 'aria-label': '設定群組' },
          groups.map((group) =>
            h(
              'button',
              {
                key: group.id,
                type: 'button',
                role: 'tab',
                className: 'dpl-group',
                'data-group': group.id,
                'data-active': !query && activeGroup === group.id ? 'true' : 'false',
                'aria-selected': !query && activeGroup === group.id,
                title: group.desc,
                onClick: () => {
                  if (activeGroup !== group.id || query)
                    go(sections.find((item) => item.group === group.id)?.id || section);
                },
              },
              iconFor(group.icon)({ size: 15 }),
              group.label,
            ),
          ),
        ),
        h('input', {
          className: 'dpl-input dpl-search',
          type: 'search',
          value: settingsQuery,
          placeholder: '搜尋設定，例如：人格、GIF、管理者',
          'aria-label': '搜尋設定',
          onChange: (e) => setSettingsQuery(e.target.value),
        }),
      ),
      query
        ? null
        : h(
            'nav',
            { className: 'dpl-section-modules', 'aria-label': '設定分區' },
            navItems.map((item) => {
              const active = item.id === 'audience' ? isAudience : section === item.id;
              const master = masterKey[item.id];
              return h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  className: 'dpl-nav-item',
                  'data-section': item.id,
                  'data-active': active ? 'true' : 'false',
                  'aria-pressed': active,
                  onClick: () => go(item.target),
                },
                iconFor(item.icon)({ size: 14 }),
                item.label,
                master
                  ? h('span', {
                      className: 'dpl-nav-dot',
                      'data-off': draft[master] ? 'false' : 'true',
                      title: draft[master] ? '已啟用' : '未啟用',
                    })
                  : null,
              );
            }),
          ),
    ),

    h(
      'div',
      { className: 'dpl-layout' },
      h(
        'main',
        { className: 'dpl-content' },
        // 素材庫保持掛載，切換分區時不會遺失尚未儲存的編輯內容。
        h(
          'div',
          { hidden: section !== 'culture' || !!query },
          h(AssetLibrary, { onError: (e) => showToast(e, 'err') }),
        ),
        query
          ? h(
              Card,
              {
                title: '搜尋結果',
                desc: found.length ? '共 ' + found.length + ' 項，涵蓋所有分區。' : undefined,
              },
              found.length
                ? h(FieldList, { fields: found, config, draft, setValue, dirtyKeys, flat: true })
                : h(
                    StateView,
                    { kind: 'empty', title: '找不到符合的設定' },
                    '請換個關鍵字，或清空搜尋回到分區。',
                  ),
            )
          : renderSection(),
      ),
    ),

    dirtyKeys.length
      ? h(
          'div',
          { className: 'dpl-savebar', role: 'region', 'aria-label': '未儲存的變更' },
          h(
            'div',
            { className: 'dpl-savebar-text' },
            h('strong', null, '有 ' + dirtyKeys.length + ' 項設定尚未儲存'),
            h('span', { className: 'dpl-savebar-keys' }, dirtyLabels + (dirtyKeys.length > 4 ? '…' : '')),
            showChanges
              ? h(ChangeList, {
                  fields,
                  rows: dirtyKeys.map((key) => ({ key, from: config[key], to: draft[key] })),
                })
              : null,
          ),
          h(
            'div',
            { className: 'dpl-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn',
                'data-action': 'toggle-changes',
                'aria-expanded': showChanges,
                onClick: () => setShowChanges((value) => !value),
              },
              showChanges ? '收合變更' : '查看變更',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn',
                disabled: Boolean(busy.save),
                onClick: () => setDraft({ ...config }),
              },
              '放棄變更',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn dpl-btn-primary',
                disabled: Boolean(busy.save),
                onClick: save,
              },
              Icon.save({ size: 13 }),
              busy.save ? '儲存中…' : '儲存變更 (' + dirtyKeys.length + ')',
            ),
          ),
        )
      : null,

    h(
      'div',
      { className: 'dpl-foot' },
      h('span', null, '今日 ' + (stats.date || '-') + ' · 錯誤 ' + (stats.errors || 0) + ' 次'),
      h('span', null, dirtyKeys.length ? '' : '所有設定皆已儲存'),
    ),

    toast
      ? h('div', { className: 'dpl-toast', 'data-tone': toast.tone, role: 'status' }, toast.message)
      : null,
  );
}
// ---- 99-register.js
// -------------------------------------------------------------- registration ---
function CompactPluginCard() {
  useUiLanguage();
  return h(
    'div',
    { className: 'dpl-plugin-summary', style: { padding: '8px 0', fontSize: 13, lineHeight: 1.6 } },
    h('strong', null, 'Discord 賽博群友'),
    h('p', { style: { margin: '4px 0', opacity: 0.7 } }, '讓 DSH 化身群友，在 Discord 聊天、互動與語音。'),
  );
}

// 插件頁「設定」掛載點：只給前往完整設定頁的指引，不重複簡介。
function CompactConfigHint() {
  useUiLanguage();
  return h(
    'div',
    {
      className: 'dpl-plugin-summary',
      style: { padding: '8px 0', fontSize: 13, lineHeight: 1.6, opacity: 0.8 },
    },
    '所有設定都在「設定 → Discord 賽博群友」：左下角帳號選單 → 設定，再從左側清單開啟。',
  );
}

function apply(ctx) {
  ensureStyles();
  const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots;
  if (!slots) return;

  const register = (slotName, options, Component = CompactPluginCard) => {
    try {
      if (typeof slots.inject === 'function') {
        slots.inject(slotName, () => slots.register({ name: slotName, ...options }, Component));
      } else if (typeof slots.register === 'function') {
        slots.register({ name: slotName, ...options }, Component);
      }
    } catch (error) {
      console.error('[dsh-discord-cyberfriend] 註冊 slot 失敗', slotName, error);
    }
  };

  const label = () => 'Discord 賽博群友';
  register('settings.section', { id: 'discord-cyberfriend', order: 34, label }, DiscordHubPanel);
  register('settings.plugins.tab', { id: 'discord-cyberfriend', order: 34, label });
  register('plugins.item', { id: 'discord-cyberfriend', order: 34, label });
  register(
    'plugins.row.config',
    {
      id: 'discord-cyberfriend',
      key: 'dsh-discord-cyberfriend#discord-cyberfriend',
      order: 34,
      label: () => 'Discord 賽博群友設定',
    },
    CompactConfigHint,
  );
  register(
    'plugins.bundle.config',
    {
      id: 'discord-cyberfriend',
      key: 'dsh-discord-cyberfriend',
      order: 34,
      label: () => 'Discord 賽博群友設定',
    },
    CompactConfigHint,
  );
}

    return { name: 'dsh-discord-cyberfriend', inject: ['slots'], apply, DiscordHubPanel };
  },
});
