# Discord 插件技能

五個技能均收在本插件 `skills/<名稱>/SKILL.md`，隨套件發布。插件透過 DSH 原生 `skills.registerProvider` 註冊，來源標記為 **dsh-discord**、bundled；可在 DSH 技能清單選取，也可讓模型依任務選用。這個來源標記是插件歸屬，不是另造一套 DSH UI 分類。

目前宿主 `skills/list` 對客戶端只回傳名稱、描述與模型可調用旗標，不回傳 provider／source；因此清單未必顯示來源欄或分組。插件的實體目錄、套件及原生提供者均統一歸屬 Discord，無須另外安裝五個使用者技能副本。技能能載入不代表所有工具已授權，仍遵守各對象授權與 sessionAllowedTools 等限制；唱歌由明確授權的高階工作流程委派固定下游階段。

| 技能 | 用途 | 範例 |
|---|---|---|
| discord-cover-flow | 下載來源、翻唱試唱／整曲、Discord 成品交付 | 「先做這個網址的翻唱試唱」 |
| discord-memory-diagnose | 記憶來源、交付、入庫及召回診斷 | 「檢查這個會話為什麼沒記住」 |
| discord-voice-diagnose | 收音／錄音訊息、STT、AI、TTS、播放診斷 | 「有文字但沒有語音，幫我排查」 |
| discord-persona-voice | 人格／工作區／會話音色與中日配音設定 | 「這個人格用中文文字、日文聲音」 |
| discord-speech-delivery | OneBot／QQBot／IM 的語音交付及原生泡泡診斷 | 「檢查 QQ 的語音為什麼變附件」 |

技能按需載入正文，不會讓每則聊天固定執行五套流程，不自動加入房間、切換記憶庫、下載模型或擴大工具權限。語音即時處理、取消、佇列與交付回執由原程式負責；技能使用原公開工具／管理 UI，不提供萬用管理後門。

`discord-cover-flow` 的權威來源已由 dsh-song-bridge 移到本插件；歌曲工作器亦已合併至 Discord；不再需要獨立 dsh-song-bridge。下載器與翻唱引擎維持獨立。本機先前安裝的同內容使用者副本已備份並移除，避免舊 user skill 優先於套件版本。其他使用者若自行安裝過同名技能，需自行決定是否保留其覆寫。

技能服務為可選依賴。較舊 DSH 沒有 `skills` 時不影響 Discord 連線；要使用自動發現須升級支援原生技能的 DSH，或將所需技能資料夾放入其支援的使用者技能目錄。套件更新後重新載入插件使目錄快取更新；卸載插件會註銷提供者。

發行前檢查：五份 SKILL.md 的 frontmatter 驗證、提供者錯誤／取消／載入測試、套件包含 skills，以及真 DSH 技能目錄回讀。這些檢查不代表模型已在真實平台執行每條排錯或外送流程。
