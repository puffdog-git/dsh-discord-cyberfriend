# Installation guide

[中文](INSTALL.md) · **English**

The goal: get it to answer you in a test channel. About ten minutes.

The settings screen is in Chinese, so the Chinese names of the pages are given alongside.

## What you need

- **DeepSeek Harness (DSH)** installed, with a working model
- A **Discord bot token** (create a bot in the [Discord Developer Portal](https://discord.com/developers/applications) and turn on **Message Content Intent**)
- Windows (the only system tested so far)

## Step 1: install

**Option 1: plugin market (easiest)**
Search for `dsh-discord-cyberfriend` in the DSH plugin market and press install. In the desktop app, go through Settings → Plugins.

**Option 2: command**

```powershell
dsh plugin --profile web add dsh-discord-cyberfriend
```

`web` is the usual profile name for dsh web. Replace it if yours differs.

Then **restart DSH**. When "Discord 賽博群友" shows up in Settings, it worked.

On first start the plugin downloads FFmpeg (the tool that handles audio and video) by itself. It needs a network connection and nothing from you.

## Step 2: first-time setup

Open Settings → Discord 賽博群友:

1. Paste the **bot token**, save and connect.
2. Enter your own Discord user ID as the **admin**.
3. Under 回覆對象 → 名單與範圍, allow just one **test channel** for now.
4. Under DSH 會話與人格, choose a model.

## Step 3: try it

1. Mention your bot in the test channel and say something.
2. It will **not** reply yet. Right after install, trial-run mode (試跑模式) is on: the AI writes its reply to the run log (執行記錄) without sending it.
3. Look at the run log to see what it would say. If you like it, turn trial-run mode off.
4. Mention it again. This time it really answers. 🎉

Nothing happening? The run log says why it stayed quiet (not on the list, cooling down, over the limit, …).

## Want more?

| To | Do this |
| --- | --- |
| Talk in voice channels | Also install the sister project DSH-sound-atelier (`dsh-sound-atelier`), then turn it on in the voice settings. |
| Listen to people | Set up a speech-recognition service; see [this note](docs/EXTERNAL-STT.md) (Chinese). |
| Use a personal account | Needs Python 3.11 or later; run the command below. **Your account is at risk**; read the warning in the [README](README.en.md) first. |
| YouTube requests | Nothing extra to install. The first time you request a song the plugin downloads yt-dlp by itself (a couple of dozen MB, network required); you can also press 下載 yt-dlp on the voice page beforehand. If requests stop working after a YouTube change, press 更新 yt-dlp in the same place. |
| AI covers | Finding and downloading the song is built in. Install the cover-engine plugin `dsh-cover-pipeline` separately and set up a voice, then turn covers on under 唱歌與翻唱. After that, just tell the AI a song title. |
| Memes, long-term memory | Each needs another plugin. The diagnostics page (外部能力與診斷) shows which are ready. |

Personal-account setup (replace `web` with your profile and the path with your Python):

```powershell
powershell -NoProfile -File "$HOME\.dsh\profiles\web\node_modules\dsh-discord-cyberfriend\scripts\setup.ps1" -PythonExecutable 'C:/path/to/python.exe'
```

## Troubleshooting

**The plugin is not in Settings** → make sure it went into the profile DSH actually runs, and that you restarted. In the desktop app, install from inside the app rather than running the command against `web`.

**The bot is online but silent** → check, in order: is trial-run mode off, is the channel on the list, is Message Content Intent on.

**Invalid token** → make sure you pasted the bot token, not the client secret.

**No sound, and the run log says FFmpeg is missing** → the automatic download on first start failed, usually a network problem. Restart DSH once the network is fine and it tries again.

## Updating and removing

- **Update**: press update in the plugin market, or run `dsh plugin --profile web update dsh-discord-cyberfriend`.
- **Remove**: remove it in the plugin market, or run `dsh plugin --profile web remove dsh-discord-cyberfriend`.

## Where your data lives

Settings, chat history and the (encrypted) token are kept in your user folder:

```
~/.dsh/data/dsh-discord-cyberfriend
```

On Windows that is `C:\Users\<you>\.dsh\data\dsh-discord-cyberfriend`.

- **Updating the plugin does not touch it.**
- **Do not share this folder.** It holds your token and conversations.
- **Removing the plugin does not delete it**, and does not invalidate the token. If you are done, reset the token in the Developer Portal.

## Installing from a folder (for developers)

If what you have is a source folder, run these three lines in it, in order, **all three**:

```powershell
npm ci --legacy-peer-deps --ignore-scripts
```

```powershell
node node_modules/ffmpeg-static/install.js
```

```powershell
npm install --ignore-scripts --no-audit --no-fund
```

Then add it to DSH and restart:

```powershell
dsh plugin --profile <your-profile> add 'link:<full path to the folder>'
```

Do not install the market version and a folder version together. If `dsh` is not found, the desktop app's is at `resources/runtime/cli/bin/dsh.cmd` in the DSH install folder.
