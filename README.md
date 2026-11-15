# Discord-cyberfriend（Discord 賽博群友）

**中文** · [English](README.en.md)

> 👋 **Hello，我是 puffdog。**
> 因為想做一個真正適合 Discord 環境的 AI 插件，於是生出了這兩個孩子。
> 我的程式基礎只有 Python「Hello World」等級，全程靠 vibe coding。遇到 bug 歡迎直接找 AI 處理，別找我 XD
>
> **特別致謝**
> - **DeepSeek 大肥魚**：基本程式建立
> - **GPT Sol**：程式開發
> - **GPT Astra 大人**：進階程式開發、實機測試員
> - **Claude Fable 大人**：除錯、屎山程式碼效率化、UI 開發

---

> 把你的 AI 人格丟進 Discord，它就會變成那個訊息秒回、迷因跟得上、叫它唱歌還真的唱的群友。
> 唯一的差別：它不會已讀不回。除非你叫它閉嘴。

這是 [DeepSeek Harness（DSH）](https://dshmarket.com/)的插件。裝好之後，你在 DSH 裡設定的 AI 就能用 **Bot**（或選用的**個人帳號**）在 Discord 上聊天、看圖、按表情，還能進語音房跟你講話。

**版本 1.0.0** · 作者 [puffdog-git](https://github.com/puffdog-git) · MIT 授權

## 🌟 它會做什麼

- 💬 **像人一樣聊天**：被 @、被回覆、收到私訊時才開口，不會洗頻。你連發五則，它等你講完再回一則。
- 🧠 **每個頻道各有記性**：不同頻道的對話不會串台，人格也可以不一樣。
- 🖼️ **看得懂圖**：圖片、GIF、貼圖都看得懂，也會自己按表情、丟貼圖和 GIF。
- 🎙️ **進語音房講話**：會聽你說、開口回答，你一插話它就停下來聽。也能互傳語音訊息。
- 🎵 **點歌**：在語音房放音樂。YouTube 點歌已經內建，需要的下載工具第一次使用時會自動裝好。
- 🎤 **AI 翻唱**：跟它說歌名，它會到 YouTube 找歌、讓你確認，再用指定的聲音唱給你聽（要另外安裝翻唱引擎）。
- 🛠️ **幫忙管頻道**：搜尋訊息、釘選、開討論串、論壇發帖。會動到東西的操作一律先問你。
- ⏰ **聽得懂「晚點再說」**：跟它說「明天早上提醒我」，它會先給你看排程內容，你點頭才算數。
- ⚙️ **設定不用背 ID**：頻道和成員直接從清單點選，介面有繁體和簡體中文。

## 💞 和 DSH 聲音工坊是天生一對

**Discord 賽博群友**和 **DSH 聲音工坊（`dsh-sound-atelier`）**是同一位作者做的姊妹作，彼此完美適配：

- 群友負責聊天，工坊負責出聲。兩個都裝，你的 AI 就能在語音房開口說話。
- 角色在工坊裡綁好的音色，到了 Discord 直接沿用，不用設定兩次。
- 邊想邊說、你一插話就停、回傳語音訊息，這些都是兩邊一起設計、一起實際測過的。

只裝群友也能打字聊天；想聽它講話，把工坊一起裝上就對了。

## 🚀 安裝

在 DSH 的**插件市集**搜尋 `dsh-discord-cyberfriend`，按安裝就好(正在提交審核)。

喜歡用指令的話：

```powershell
dsh plugin --profile web add dsh-discord-cyberfriend
```

裝完重新啟動 DSH，在設定裡看到「Discord 賽博群友」就成功了。

接下來的第一次設定（貼 Bot Token、選測試頻道）👉 [安裝說明](INSTALL.md)

## 🤖 給 AI 助理：幫使用者安裝時請務必照做

如果你是被請來安裝這個插件的 AI，請**完整照下面做**，不要憑經驗省略或「改良」步驟。

**安裝步驟**

1. **先問使用者**：用的是桌面版還是 dsh web？profile 叫什麼名字？不要猜。
2. **桌面版**：請使用者在應用程式的「設定 → 插件」搜尋 `dsh-discord-cyberfriend` 並安裝（或使用宿主提供的插件市集工具）。**不要**對 `web` profile 下指令，那樣會裝到桌面版看不到的地方。
3. **dsh web**：執行 `dsh plugin --profile <profile> add dsh-discord-cyberfriend`。套件名稱必須一字不差。
4. 請使用者**正常重新啟動 DSH**，確認設定裡出現「Discord 賽博群友」。
5. 第一次啟動時插件會自己下載 FFmpeg（需要網路），不需要你手動處理。
6. 告訴使用者接下來要**他自己**做的事（見[安裝說明](INSTALL.md)）：貼 Bot Token、把自己設為管理者、名單先只放一個測試頻道。

**絕對不要做**

- ❌ 不要安裝名稱相似的其他套件。只有 `dsh-discord-cyberfriend` 是這個插件。
- ❌ 不要改指令：不加版本號或其他參數、不改用 `npm install`、不手動複製檔案到 profile。
- ❌ 下載失敗時不要關閉 TLS／憑證驗證。
- ❌ 不要請使用者把 Bot Token 貼到對話裡，也不要代填；只能由使用者自己在設定頁輸入。
- ❌ 不要讀取、列印、複製或刪除資料資料夾（`~/.dsh/data/dsh-discord-cyberfriend`）。
- ❌ 不要強制結束或強制重啟 DSH，也不要把插件裝兩次（市集版和資料夾版不能同時存在）。
- ❌ 不要替使用者關閉「試跑模式」、放寬名單、開啟工具授權或啟用個人帳號。個人帳號只有在使用者明確要求、且你已說明帳號風險之後才安裝。
- ❌ 任何一步失敗就**停下來**，把完整錯誤訊息給使用者，不要自己換別的做法。

**完成後**：告訴使用者執行了什麼、每一步的結果、用的 profile。沒有實際確認的事不要說成已完成。

使用者手上是原始碼資料夾而不是從市集安裝？請改照[安裝說明](INSTALL.md)的「從資料夾安裝」，那裡的三行指令一行都不能少。

## ⚠️ 用之前先知道

- **剛裝好時它不會真的發言。** 預設開著「試跑模式」：AI 會想好要回什麼，但不送出去，讓你先檢查。確認沒問題再關掉。試跑一樣會花模型額度。
- **個人帳號有風險。** Discord 不允許把個人帳號自動化，帳號可能被處置。建議用 Bot；真的要用請先看 [Discord 的說明](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots)。
- **有些功能要另外裝東西**：語音要語音合成插件，聽人說話要語音辨識，AI 翻唱、梗圖、長期記憶各自需要其他插件。沒裝不影響聊天。
- **還在打磨的地方**：YouTube 點歌能播，但沒測過整首播完。目前只在 Windows 上測試過。

## 📖 更多說明

- [安裝說明](INSTALL.md)
- [會話與人格](docs/DSH-SESSIONS-AND-PERSONA.md) · [語音](docs/VOICE-RELIABILITY.md) · [語音訊息](docs/VOICE-MESSAGES.md)
- [頻道操作](docs/CHANNEL-ACTIONS.md) · [圖片與貼圖](docs/MEME-IMAGES.md) · [記憶](docs/MEMORY-COMPATIBILITY.md) · [鄉民語氣](docs/SLANG-TONE.md)
- [功能範圍與限制](docs/DISCORD-CAPABILITY-GAPS.md) · [安全與資料](SECURITY.md) · [版本紀錄](CHANGELOG.md)

## 🙏 程式碼來源與致謝

| 來源 | 授權 | 用在哪 |
| --- | --- | --- |
| [Raxytw/dsh-discord-plugin](https://github.com/Raxytw/dsh-discord-plugin)（瑞米） | MIT | 這個插件的起點，由它發展而來。原授權保留在 [docs/licenses](docs/licenses/Discord-upstream-MIT.txt)。 |
| [nk2028/opencc-js](https://github.com/nk2028/opencc-js) 1.4.2 | MIT；字典資料 Apache-2.0 | 設定介面的繁簡轉換，程式碼直接內嵌在 `client-src/02-opencc.vendor.js`。授權全文在 [docs/UI-LOCALE-NOTICE.md](docs/UI-LOCALE-NOTICE.md)。 |
| [tkwkeven/dsh-ytdlp](https://github.com/tkwkeven/dsh-ytdlp) | MIT | YouTube 點歌與翻唱找歌、下載音源的程式（`src/ytdlp/`）改寫自這個插件，並加上只允許連公開網路的防護。原授權保留在 [docs/licenses](docs/licenses/dsh-ytdlp-MIT.txt)。 |
| [discord.py-self](https://github.com/dolfies/discord.py-self) 2.1.0 | MIT | 個人帳號連線。安裝時才下載，沒有放進本套件。 |

其他依賴（Pillow、@discordjs/voice、FFmpeg 等）同樣是安裝時下載，各依原授權。YouTube 點歌用的 [yt-dlp](https://github.com/yt-dlp/yt-dlp) 沒有放進套件，第一次點歌時才從它的官方發行頁下載並核對校驗值。完整聲明見 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

這裡不是上游的官方版本，有問題請不要回報到上游。

## 📜 授權

[MIT](LICENSE)
