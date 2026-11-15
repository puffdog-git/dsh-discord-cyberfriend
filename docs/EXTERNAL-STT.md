# 選用外部 dsh-voice

可使用獨立的 `@goodandready/dsh-voice`，不必把它的模型、辨識實作或供應商設定併入 Discord。

1. 安裝並啟用原 dsh-voice、DSH 聲音工坊（`dsh-sound-atelier` 1.0.2 以上，橋接已內建，「語音交付」頁的「提供 dsh-voice 作為語音辨識來源」要開著）及 DSH 語音辨識服務。
2. 在原 dsh-voice 設定「聽寫」辨識鏈、語言及金鑰／本機服務。
3. 在 Discord 的「DSH 語音辨識服務 ID」填入 `external:dsh-voice`。

語音房及錄音訊息使用同一個 STT 選擇，原有使用者／頻道同意範圍與預算限制繼續生效。安裝不會切換目前的 `sensevoice-local`。

外部辨識可能使用雲端及其原有降級鏈，請先檢查 dsh-voice 設定。橋接取原始逐字稿，不呼叫 LLM 潤飾、不執行語音指令，再套用 Discord 自己的繁中／專名校正。原接口不能逐次覆寫語言，請在原插件設定。取消後不會提交回覆，但原插件已開始的 HTTP 辨識可能持續至其自身逾時。

外部插件未啟用、無可用辨識鏈或服務拒絕時會明確失敗，不會默默切回其他 STT。
