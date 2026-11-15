# 選用本機記憶後端

Discord 插件不包含 Ollama、OpenViking、Hindsight 的服務、模型或安裝管理器。請先依各後端官方文件安裝獨立環境，再安裝對應 DSH 記憶插件，確認其健康狀態及工作區／使用者隔離，最後在 Discord 設定選用。

- [OpenViking 設定](https://docs.openviking.ai/en/guides/01-configuration)
- [Hindsight 安裝](https://hindsight.vectorize.io/developer/installation)
- [Ollama Embedding](https://docs.ollama.com/api/embed)

服務應使用明確的 loopback 位址與獨立資料目錄；憑證只填入對應插件的安全欄位。不要把整個後端目錄、資料庫、記憶、模型、日誌或設定檔加入公開來源。LLM 抽取成功與寫入接受不等於已驗證召回，應另測內容讀回、隔離、重啟持久化與軟忘記。

2026-11 的開發驗收曾在獨立本機模型／服務使用虛構資料驗證 OpenViking、Hindsight 與靈樞。測試環境及測試庫已於收尾清除，不隨本套件提供；歷史使用的私人 manage.ps1 也不是公開安裝入口。相關測試不表示新安裝後已連線、已啟用或已匯入資料。

更正及忘記只對有精確定位回執、支援維護契約的記憶生效；見 [維護契約](MEMORY-MAINTENANCE-CONTRACT.md)。
