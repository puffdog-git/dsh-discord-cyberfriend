# Discord-cyberfriend

[中文](README.md) · **English**

> 👋 **Hello, I'm puffdog.**
> I wanted an AI plugin that actually feels at home on Discord, so these two came into being.
> My programming background stops at Python "Hello World"; everything here was vibe-coded. If you hit a bug, please take it straight to an AI and not to me XD
>
> **Special thanks**
> - **DeepSeek 大肥魚**: laid the first code
> - **GPT Sol**: development
> - **GPT Astra**: advanced development and live testing
> - **Claude Fable**: debugging, taming the spaghetti, UI

---

> Drop your AI persona into Discord and it becomes that one friend who answers instantly, gets the memes, and will actually sing if you ask.
> The only difference: it never leaves you on read. Unless you tell it to hush.

A plugin for [DeepSeek Harness (DSH)](https://dshmarket.com/). Once installed, the AI you set up in DSH can chat on Discord as a **bot** (or, optionally, a **personal account**): it reads images, reacts, and can join voice channels to talk with you.

**Version 1.0.0** · by [puffdog-git](https://github.com/puffdog-git) · MIT

The settings screen is in Chinese (Traditional or Simplified).

## 🌟 What it does

- 💬 **Chats like a person.** It speaks when mentioned, replied to or messaged, and does not flood the channel. Send five messages in a row and it waits, then answers once.
- 🧠 **Each channel has its own memory.** Conversations do not leak between channels, and each can have a different persona.
- 🖼️ **Understands images.** Pictures, GIFs and stickers, and it reacts and sends stickers and GIFs itself.
- 🎙️ **Talks in voice channels.** It listens, answers out loud, and stops to listen when you cut in. Voice messages work both ways too.
- 🎵 **Plays music** in the voice channel. YouTube requests are built in; the download tool they need installs itself on first use.
- 🎤 **AI covers.** Tell it a song title; it finds the song on YouTube, checks with you, then sings it in the voice you choose (needs a separately installed cover engine).
- 🛠️ **Helps run the channel.** Search, pins, threads, forum posts. Anything that changes something asks you first.
- ⏰ **Understands "later".** Say "remind me tomorrow morning" and it shows you the schedule before committing.
- ⚙️ **No memorising IDs.** Pick channels and members from lists.

## 💞 Made for DSH-sound-atelier

**Discord-cyberfriend** and **DSH-sound-atelier (`dsh-sound-atelier`)** are sister projects by the same author, built to fit each other perfectly:

- Cyberfriend does the chatting, the atelier does the talking. Install both and your AI speaks in voice channels.
- A voice you assign to a character in the atelier carries straight over to Discord. No setting it up twice.
- Speaking while still thinking, stopping the moment you cut in, replying with voice messages: these were designed and tested on both sides together.

Cyberfriend alone can chat in text. To hear it talk, add the atelier.

## 🚀 Install

Search for `dsh-discord-cyberfriend` in the DSH **plugin market** and press install.

Or, by command:

```powershell
dsh plugin --profile web add dsh-discord-cyberfriend
```

Restart DSH. When "Discord 賽博群友" shows up in Settings, it worked.

First-time setup (bot token, test channel) 👉 [Installation guide](INSTALL.en.md)

## 🤖 For AI agents: follow this exactly when installing for a user

If you are an AI asked to install this plugin, **do exactly the following**. Do not skip or "improve" steps from general experience.

**Steps**

1. **Ask the user first**: desktop app or dsh web, and what is the profile called? Do not guess.
2. **Desktop app**: have the user search for `dsh-discord-cyberfriend` under Settings → Plugins in the app and install it there (or use the host's plugin-market tool). Do **not** run the command against the `web` profile; that installs somewhere the desktop app cannot see.
3. **dsh web**: run `dsh plugin --profile <profile> add dsh-discord-cyberfriend`. The package name must match exactly.
4. Have the user **restart DSH normally** and confirm "Discord 賽博群友" appears in Settings.
5. On first start the plugin downloads FFmpeg by itself (network required). You do not need to do anything for it.
6. Tell the user what **they** do next (see the [installation guide](INSTALL.en.md)): paste the bot token, set themselves as admin, and allow only one test channel to begin with.

**Never**

- ❌ Install a similarly named package. Only `dsh-discord-cyberfriend` is this plugin.
- ❌ Change the command: no version suffix or extra flags, no `npm install` instead, no copying files into the profile by hand.
- ❌ Disable TLS or certificate checks when a download fails.
- ❌ Ask the user to paste the bot token into the chat, or enter it for them. Only the user enters it, in the settings screen.
- ❌ Read, print, copy or delete the data folder (`~/.dsh/data/dsh-discord-cyberfriend`).
- ❌ Force-kill or force-restart DSH, or install the plugin twice (the market version and a folder version must not coexist).
- ❌ Turn off trial-run mode, widen the allowlist, grant tools or enable the personal account for the user. Set up the personal account only when the user explicitly asks and you have explained the account risk.
- ❌ Carry on after a failure. **Stop**, show the user the full error, and do not improvise another route.

**When done**: tell the user what you ran, the result of each step, and the profile used. Do not report anything as done that you did not verify.

Does the user have a source folder instead of a market install? Follow "Installing from a folder" in the [installation guide](INSTALL.en.md); all three commands there are required.

## ⚠️ Before you start

- **It will not actually speak right after install.** "Trial-run mode" is on by default: the AI decides what it would say but does not send it, so you can check first. Turn it off when you are happy. Trial runs still use model credit.
- **Personal accounts are risky.** Discord does not allow automating personal accounts, and the account can be actioned. Use a bot if you can; otherwise read [Discord's statement](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots) first.
- **Some features need extra plugins.** Voice needs a speech plugin, listening needs speech recognition, and AI covers, memes and long-term memory each need their own plugin. Chat works without any of them.
- **Still being polished.** YouTube requests play, but playing a whole track to the end has not been tested. Tested on Windows only so far.

## 📖 More

- [Installation guide](INSTALL.en.md)
- In Chinese: [sessions and personas](docs/DSH-SESSIONS-AND-PERSONA.md) · [voice](docs/VOICE-RELIABILITY.md) · [voice messages](docs/VOICE-MESSAGES.md) · [channel actions](docs/CHANNEL-ACTIONS.md) · [images and stickers](docs/MEME-IMAGES.md) · [memory](docs/MEMORY-COMPATIBILITY.md)
- [Security and data](SECURITY.md) · [Changelog](CHANGELOG.md)

## 🙏 Code sources and credits

| Source | Licence | Where it is used |
| --- | --- | --- |
| [Raxytw/dsh-discord-plugin](https://github.com/Raxytw/dsh-discord-plugin) (瑞米) | MIT | The starting point this plugin grew from. Its licence is kept in [docs/licenses](docs/licenses/Discord-upstream-MIT.txt). |
| [nk2028/opencc-js](https://github.com/nk2028/opencc-js) 1.4.2 | MIT; dictionary data Apache-2.0 | Traditional/Simplified conversion in the settings screen, embedded directly in `client-src/02-opencc.vendor.js`. Licence texts in [docs/UI-LOCALE-NOTICE.md](docs/UI-LOCALE-NOTICE.md). |
| [tkwkeven/dsh-ytdlp](https://github.com/tkwkeven/dsh-ytdlp) | MIT | The code that finds and downloads audio for YouTube requests and covers (`src/ytdlp/`) is adapted from this plugin, with a guard added that only allows public network destinations. Its licence is kept in [docs/licenses](docs/licenses/dsh-ytdlp-MIT.txt). |
| [discord.py-self](https://github.com/dolfies/discord.py-self) 2.1.0 | MIT | Personal-account connection. Downloaded at install time, not included in this package. |

Other dependencies (Pillow, @discordjs/voice, FFmpeg and so on) are also downloaded at install time under their own licences. [yt-dlp](https://github.com/yt-dlp/yt-dlp), used for YouTube requests, is not included; it is downloaded from its official release page and checksum-verified the first time you request a song. Full notices: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

This is not the upstream's official release. Please do not report problems there.

## 📜 Licence

[MIT](LICENSE)
