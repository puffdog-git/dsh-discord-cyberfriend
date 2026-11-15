# Discord 記憶輸出與多插件適配

2026-11-13。Discord 原始事件、工作區人格日記、DSH 會話與外部長期記憶是不同資料。輸出檔案或完成日記，不代表已經寫入外部記憶庫。

**最新進度**：在使用者選擇本機部署後，已另完成靈樞真實 Python 圖庫、OpenViking／Hindsight 真實服務＋本機 LLM／Embedding 的寫入、讀回、召回及重啟持久性驗收；詳見 [本機後端與操作指令](LOCAL-MEMORY-BACKENDS.md)。下方「四套補測」保留第一階段替身測試的界線，後續真實驗收以上述新指南為準。

## 最簡單的共同接法

### 預設 memU，保留全部相容輸出

依使用者指定，出廠預設與本機目前的日記寫入器都維持 **memu**。這不移除其他系統的適配：正式 DSH 會話、Markdown／JSON／JSONL、具來源的候選檔，以及自訂寫入器註冊接口都保留。UI 的「已測試記憶系統的相容接法」列出各家實際路徑與限制，清單不代表已啟用或每種雲端 Provider 都完成真實服務驗收。

直接交付只呼叫目前選定的寫入器；memU 不可用或拒絕寫入時如實報錯，**不自動改投另一個記憶系統**。已啟用的第三方插件仍可能各自觀察正式 DSH 會話，這由它們自己的設定控制；保留相容性不代表替使用者啟用全部插件。

狀態 API 額外回傳 defaultWriter、selectedWriter、directWritePolicy、sourceFormats 及 compatibility 目錄；來源事件、日記與候選檔的既有 schema／版本不變。自訂寫入器 ID 仍可使用，不受相容性清單限制。

平常回覆使用「DSH 正式會話」，保留真正的 Agent、session ID、工作區 cwd 與 user/message → assistant/message → turn/end 流程。已載入的記憶插件可在自己的設定與權限下召回或自動捕獲。自訂 API 的獨立回覆模式不經這條流程，不能假稱有相同的記憶召回能力。

每日資料保留於對應工作區 `memory/discord/<頻道>/<日期>.md`、來源 Markdown、JSON，原始事件另在輸出索引目錄的 `events/*.jsonl`。這是最容易跨插件使用的邊界：選擇一個記憶系統，透過它的正式檔案匯入／文件工具讀入，不直接改 SQLite、向量資料庫或插件私有檔案。

「記憶交付方式 ID」可選：

| ID | 行為 | 成功狀態 |
| --- | --- | --- |
| `memu`（原預設） | 呼叫已載入 memU 的 `memu_private_remember`，使用真實日記 Agent 與工作區 | 有可核對 ID 且工具確認才為已入庫；審核不算入庫 |
| `meow` | 呼叫已載入喵記憶的 `memory_remember`；限定 fact、專案 discord-diary、低重要度，帶關鍵詞與真實工作區 | 工具 ok 且有 ID 才為已入庫；合併回執記為去重；沒有 ID 為未確認 |
| `files` | 產生日記旁的 `.md.candidates.jsonl`，保留內容、標題、標籤、factKey、工作區、session、證據訊息 ID、來源路徑 | 已輸出候選檔，**不算外部入庫** |
| `session` | 日記本來就在正式 DSH Agent 會話；交給已啟用記憶插件自己的捕獲／整理策略，不另外重送一遍 | 已交付正式會話，**不保證已提煉或存入長期記憶** |

一次只選一個交付方式，不自動依序嘗試所有插件；未載入工具會顯示不可用，不自行載入或切換。更改方式前已產生的結果保留。檔案候選以 factKey／內容去重，內容更新可新增版本；匯入端應核對同 factKey 的最新版本，不將相同來源反覆入庫。

日記候選最多三項，證據須來自真實且未刪除的來源，敏感資料會拒絕；模擬來源不透過這些直接寫入器入庫。記憶插件對正式 DSH 會話本身的自動捕獲則由該插件負責，仍可能觀察到標記為測試的日記會話。Discord 的寫入開關只控制本插件直接交付，不是其他插件的全域停用開關。

## 已下載插件的差異

| 插件 | 此機檢視版本 | 建議接法與注意事項 |
| --- | --- | --- |
| memU | 1.3.1 | 原生工具寫入已有適配；綁定與記憶庫由它依工作區處理 |
| 喵記憶 | 0.32.7 | 新增 `meow` 寫入器；不修改 soul／user／rules 等全域人格層。召回仍需喵記憶啟用並遵守自己的專案與信任設定 |
| 魚的記憶 | 1.6.0 | 正式會話使用它的工具／注入流程；日記可用 files 後在插件匯入。預設按 session 分庫，若要日記與另一個 Discord session 共用，需在它的 UI 選工作區模式或明確匯入目標庫。不能把日記臨時 session 的記憶當作已與聊天共用 |
| Prime Memory | 0.26.37 | 適合 `session`；由其 session/event 捕獲完整輪次再背景提煉。沒有「接受來源就立即完成長期記憶」保證；需看其蒸餾／模式狀態 |
| dsh-mnemon | 0.5.45 | 正式會話＋已選 Strategy／Source／View；文件交付可用 files／Markdown 再經 Project Documents 正式建立工具或管理介面匯入。不直接繞過 View 操作 provider |
| Mnemon Memory Spaces／Documents | 已檢視本機套件與公開契約 | Source 需要 Mnemon 核心及策略；不是裝下來就自動接收任意輸出目錄。Documents 工具的 sourcePaths 必須位於當前工作區內 |
| Mem0、Supermemory 等 Mnemon Provider | 本機已下載子模組 | 是 Mnemon 記憶空間的子 Provider，須在 Mnemon 設定 endpoint／憑證／空間與權限，不是各自可直接啟用的完整記憶插件。雲端接受請求也可能仍待抽取 |

**Mnemon 的實體資料目錄同樣重要**：獨立 Source 若固定同一個 dataDir，不同工作區請求可能共用同一份文件集合；不能只看 session／workspace ID 就認定實體隔離。若要分開，請使用其工作區儲存方案或分開的 Source／dataDir。Discord 不代改這些配置、不把私訊或不同使用者匯入全域共用空間。

不建議把所有已下載記憶插件同時開啟：正式會話會讓每個啟用的捕獲器看到同一輪，可能重複提煉、注入及產生模型用量。先選一套主要系統，對齊工作區與記憶庫，再驗證召回。

## 補測：靈樞、OpenViking、Hindsight、Soul-md

2026-11-13 補查使用者指出的四套，以下版本是此機下載的版本，沒有替換成 GitHub 最新分支，也沒有在使用者 DSH 啟用它們。

| 插件 | 版本 | Discord 接法 | 此輪實測 |
| --- | --- | --- | --- |
| [@furongjun1999/dsh-memory（靈樞）](https://github.com/FuRongJun-1999/dsh-memory) | 0.10.3 | 正式 DSH 會話的 session/event 可被自動捕獲；可用 session 交付，不必另塞一份同樣的日記 | 實際 installMemoryHooks 接受真人 user／assistant、帶 session，排除 plugin 注入及 subagent；認知圖服務為替身，未宣稱 Python 圖引擎入庫或讀回 |
| [@openviking/dsh-memory-plugin](https://github.com/volcengine/OpenViking/tree/main/examples/dsh-memory-plugin) | 0.5.34 | 正式會話由它捕獲、commit 與召回；需真正 OpenViking server、帳號／使用者及 peer 設定 | 實際 client＋runtime 經本機 HTTP 替身跑 session 建立、兩則訊息提交、插件注入過濾、commit 與 actor-peer 傳遞；不等於後端已提煉出可召回記憶 |
| [@vectorize-io/hindsight-coding-agents](https://github.com/vectorize-io/hindsight/tree/main/hindsight-integrations/coding-agents) | 0.8.7 | 使用套件的 ./dsh 接入，正式 Agent 的 pre-step／turn-stopping 流程；需設定 Hindsight server 與 bank | 實際 createDshHooks 的召回注入、閒置回寫觸發、dispose；runtime core 為替身，沒有執行真正 retain／reflect |
| [dsh-soul-md](https://github.com/Scorp1o117/dsh-soul-md) | 0.12.3 | 人格與記憶注入可沿用正式會話；日記持久化需它的公開 memory_append／memory_rewrite 或人工匯入，不是僅選 session 就一定自動學習 | 實際 memory_append／memory_read 寫讀 Markdown、不同人格卡隔離、同卡跨工作區共用、停用人格拒絕寫入 |

靈樞的 `memory.sessionPrivate` 在此版預設 **false**；帶 session 標記不等於預設私有。要隔離不同 Discord 私訊／使用者，需在靈樞設定中啟用並驗證該選項，或使用分開的圖／租戶。測試只是驗證 sessionPrivate=true 時 hook 會傳 sensitivity=private，沒有更動使用者設定。

Soul-md 的記憶範圍是「目前人格卡，否則全域」，不是 cwd。本輪實測同一張卡在另一個工作區仍能讀到同一份記憶；不同卡才隔開。不要用沒有明確人格卡的日記 Agent，把私訊默默寫進全域記憶。其 memory_append 回傳 bytes／scope／topic，沒有記憶 ID；目前不硬接為 stored 寫入器，避免假造 ID 或入庫回執。`files` 模式可交付來源，再由選定人格下的正式工具處理。

Hindsight 此版仍註冊舊 `agent/session-start`。本機 DSH 新版以 `agent/created` 作啟動事件；實際測試確認即使沒收到舊啟動事件，其 pre-step 仍能初始化工作區，因此沒有為它偽造或廣播舊事件。不過這只證明流程降級可行，首次啟動／seed 時機、後端連線與 server bank 的實際效果仍須服務驗收。Bank 若被設定為多個工作區共用，Discord 的工作區分開也不會自動把後端記憶分開。

OpenViking 的提交與提煉是兩個階段；此輪確認 HTTP actor-peer 有傳遞，不能據此宣稱 server 的所有記憶命名空間已隔離。請核對 server 端 account／user、peer 與資料空間設定。`files` 是通用來源交付，不代表任意 OpenViking／Hindsight 插件會自動監看輸出檔案。

Discord 的模型工具權限仍保留：群聊及其他使用者不會因為啟用記憶插件就自動取得寫入工具。需要模型明確操作記憶時，沿用管理者私訊與 sessionAllowedTools 的授權；不要為求相容而把所有工具對所有頻道開放。

四套目前可沿用正式會話／檔案交付，未發現需要 Discord 另設專用通訊接口的情況。**沒有新增四個「填名稱就直接入庫」的假寫入器**。證據在開發工作區 `.audit/memory-four-real.mjs`／`.json`；外部後端及模型均有明確替身界線。

## 註冊自訂寫入器

既有本機共享服務仍保留：

```js
const off = globalThis.__DSH_DISCORD_PYSELF_LAB__.memoryOutput
  .registerMemoryWriter('my-memory', async input => {
    // input.args: 已遮蔽、具來源的候選
    // input.exec: 真正日記 Agent／ctx／signal，勿偽造其他 session
    // input.cwd / sessionId / sourcePath / evidenceIds
    // 僅透過自己插件公開接口及其授權範圍交付。
    return {status:'submitted',ids:[],detail:'已接受，等待抽取'}
  })
```

不要把模型回答中的「已記住」當回執。只有真實已存入且帶非空記憶 ID 的 stored／deduplicated 才確認；submitted、unverified、pending_review、exported 都不會顯示已入庫。註冊後將 ID 填入交付設定；卸載時呼叫 off。這是目前 DSH 程序內的接口，不是網路入口。

## 實際驗證界線

使用隔離暫存工作區、DSH_HOME 與宿主替身，沒有讀寫使用者記憶庫：

- 喵記憶：實際公開工具與 SQLite 寫入、ID、讀回；宿主 LLM 輔助函式設為呼叫即失敗，沒有執行模型。
- 魚的記憶：實際載入插件程式並註冊 remember；測試啟用會話可寫入，停用會話拒絕；讀回在測試中使用其測試匯出，正式適配不讀私有資料庫。確認工具成功回應沒有記憶 ID，因此沒有將它硬接成可確認入庫的寫入器。
- Prime：實際 capture hook 收到標準 user／assistant／turn-end 後提交兩則訊息到整理佇列；整理器用替身，未執行模型蒸餾。
- Mnemon：官方 MemoryCompositionRunner、實際 Cordis 核心、General Strategy 與 Documents Source 的 create／search；取得 succeeded／committed 回執並讀回，驗證固定共享 dataDir 與分開 dataDir 的差異。沒有呼叫 Mem0／Supermemory 雲端。

這些證明輸出契約及接法可用，不代表每個未啟用插件已在使用者 DSH 完成召回或雲端入庫。

### memU 預設路徑實測（2026-11-13）

使用已安裝的 memU 1.3.1、宿主真正的 defineTool／訊息工廠、Discord 日記寫入器與工作區選擇函式，在隔離暫存目錄完成工具寫入、重複內容回執、關鍵字召回、新程序重啟讀回，以及 memU 實際 `agent/pre-step` hook 的記憶注入。Agent 的會話標頭與 decision-next 是測試容器，未建立使用者正式 Discord 綁定，也沒有呼叫模型或寫入個人記憶。

同工作區的新會話可召回；不同工作區無法召回原內容，指定另一庫 ID 亦遭拒。Discord 預設同伺服器頻道共用工作區，所以這不是頻道級隔離。若要分開，需使用既有工作區綁定功能。正式主記憶仍為 memU，其餘已測插件的相容接口保留。

目前 memU 使用 `agent` 本地 Markdown／索引與詞法召回路徑，不需要另設雲端 LLM／Embedding。尚未綁定記憶庫的純讀取不會偷偷建立庫；明確工具寫入會依真實會話 cwd 建立／選用該工作區的庫。沒有實際 Discord 綁定時，總覽顯示空白是正常情況，不以假會話填滿。

重複內容測試未附 fact_key；memU 對相同 fact_key 的再次寫入具有版本／衝突關係語義，不能假設它等同冪等鍵。證據為開發工作區 `.audit/memu-real-acceptance.mjs`／`.json`。OpenViking／Hindsight／靈樞的後端實測另外見 `LOCAL-MEMORY-BACKENDS.md`。
