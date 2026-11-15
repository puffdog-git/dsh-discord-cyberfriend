# 安裝說明

**中文** · [English](INSTALL.en.md)

目標：讓它在你的測試頻道回你第一句話。大約十分鐘。

## 你需要準備

- 已安裝的 **DeepSeek Harness（DSH）**，裡面有一個能用的模型
- 一個 **Discord Bot Token**（到 [Discord Developer Portal](https://discord.com/developers/applications) 建立 Bot，並打開 **Message Content Intent**）
- Windows（目前只在 Windows 上測試過）

## 第 1 步：安裝

**方法一：插件市集（最簡單）**
在 DSH 的插件市集搜尋 `dsh-discord-cyberfriend`，按安裝。桌面版請從應用程式的「設定 → 插件」進去。

**方法二：指令**

```powershell
dsh plugin --profile web add dsh-discord-cyberfriend
```

`web` 是一般 dsh web 的 profile 名稱；你的不一樣就換掉。

裝完**重新啟動 DSH**。在設定裡看到「Discord 賽博群友」就成功了。

第一次啟動時，插件會自己下載 FFmpeg（處理聲音和影片的工具），需要網路，不用你動手。

## 第 2 步：第一次設定

打開「設定 → Discord 賽博群友」：

1. 貼上 **Bot Token**，儲存並連線。
2. 填你自己的 Discord 使用者 ID 當**管理者**。
3. 到「回覆對象 → 名單與範圍」，先只允許一個**測試頻道**。
4. 到「DSH 會話與人格」選好模型。

## 第 3 步：試試看

1. 在測試頻道 @ 你的 Bot，跟它說句話。
2. 它**不會**馬上回——剛裝好時開著「試跑模式」，AI 只會把回覆寫進「執行記錄」，不會送出。
3. 到「執行記錄」看它打算回什麼。滿意的話，關掉試跑模式。
4. 再 @ 一次，這次它就真的回你了。🎉

沒反應？「執行記錄」會寫它為什麼沒回（不在名單、冷卻中、超過上限……）。

## 想要更多功能

| 想要 | 怎麼做 |
| --- | --- |
| 在語音房講話 | 再安裝姊妹作 DSH 聲音工坊（`dsh-sound-atelier`），然後在「語音」設定裡開啟。 |
| 聽人說話 | 另外準備語音辨識服務，見[說明](docs/EXTERNAL-STT.md)。 |
| 用個人帳號 | 需要 Python 3.11 以上，執行下面的指令。**有帳號風險**，請先看 [README](README.md) 的提醒。 |
| YouTube 點歌 | 不用另外裝東西。第一次點歌時插件會自動下載 yt-dlp（十幾 MB，需要網路），也可以先到「語音」頁按「下載 yt-dlp」。YouTube 改版後點不了歌，就到同一個地方按「更新 yt-dlp」。 |
| AI 翻唱 | 找歌和下載音源已經內建。另外安裝翻唱引擎插件 `dsh-cover-pipeline` 並準備好音色，再到「唱歌與翻唱」開啟。之後跟 AI 說歌名就可以。 |
| 梗圖、長期記憶 | 各自需要其他插件。設定裡的「外部能力與診斷」會告訴你哪些已經可以用。 |

個人帳號的安裝指令（把 `web` 換成你的 profile、路徑換成你的 Python）：

```powershell
powershell -NoProfile -File "$HOME\.dsh\profiles\web\node_modules\dsh-discord-cyberfriend\scripts\setup.ps1" -PythonExecutable 'C:/path/to/python.exe'
```

## 常見問題

**設定裡沒有出現插件** → 確認裝到的是 DSH 實際在用的 profile，而且有重新啟動。桌面版請從應用程式裡安裝，不要對 `web` 下指令。

**Bot 在線上但不回話** → 依序檢查：試跑模式關了沒、頻道在不在名單裡、Message Content Intent 有沒有開。

**Token 無效** → 確認貼的是 Bot Token，不是 Client Secret。

**語音沒聲音，執行記錄寫「找不到 FFmpeg」** → 第一次啟動時自動下載失敗了，多半是網路問題。網路正常後重新啟動 DSH，它會再試一次。

## 更新與移除

- **更新**：在插件市集按更新，或執行 `dsh plugin --profile web update dsh-discord-cyberfriend`。
- **移除**：在插件市集移除，或執行 `dsh plugin --profile web remove dsh-discord-cyberfriend`。

## 你的資料放在哪

設定、聊天記錄和（加密過的）Token 都放在你的使用者資料夾：

```
~/.dsh/data/dsh-discord-cyberfriend
```

Windows 上就是 `C:\Users\<你的名字>\.dsh\data\dsh-discord-cyberfriend`。

- **更新插件不會動到這裡。**
- **不要把這個資料夾分享給別人**，裡面有你的 Token 和聊天內容。
- **移除插件不會刪掉它**，也不會讓 Token 失效。不用了的話，記得到 Developer Portal 重設 Token。

## 從資料夾安裝（給開發者）

手上是原始碼資料夾的話，在資料夾裡依序執行這三行，**一行都不能少**：

```powershell
npm ci --legacy-peer-deps --ignore-scripts
```

```powershell
node node_modules/ffmpeg-static/install.js
```

```powershell
npm install --ignore-scripts --no-audit --no-fund
```

再加進 DSH 並重新啟動：

```powershell
dsh plugin --profile <你的profile> add 'link:<資料夾的完整路徑>'
```

市集版和資料夾版不要同時安裝。找不到 `dsh` 指令時，桌面版的在 DSH 安裝資料夾的 `resources/runtime/cli/bin/dsh.cmd`。
