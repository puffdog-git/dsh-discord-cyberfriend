// 用文字叫 AI「退出語音房」「停止音樂」：由程式直接辨識並執行，不等模型決定要不要呼叫工具。
//
// 起因（2026-11 實機）：模型拿到了離開語音房的工具，卻連續三次回答「我自己走不掉」——
// 同一個對話裡它先前說過做不到，就一直沿用那個說法。這種明確、可逆、只影響自己帳號的動作，
// 交給程式做比較可靠；做完再把結果告訴模型，讓它用自己的口氣回一句。
//
// 只在這些條件都成立時才動作：不是模擬訊息、這個對象開了「允許 AI 點歌」、帳號目前就在同一個伺服器的語音房裡，
// 而且訊息是對 AI 說的——有 @ 它，或是發在這個語音房綁定的文字頻道（點歌的那個頻道）。
// 實機：使用者點完歌之後接著說「停止音樂」「退出語音房」都沒有再 @，所以綁定頻道裡不用 @ 也算。
// 在綁定頻道裡沒有 @ 的情況下，「我先退出了」這種講自己的句子不算。

const LEAVE = /(退出|離開|退開|退房|出去|出來吧|下線|走了|走吧|可以走|滾出|掰掰|拜拜|\bbye\b|\bleave\b|\bdisconnect\b)/i;
const STOP = /(停止|停掉|停下|停一下|停播|別播|不要播|不用播|不播了|關掉音樂|關音樂|音樂關掉|切掉|\bstop\b)/i;
// 否定或在問做法：不是要它現在做。
const NOT_LEAVE = /(不要|不用|別|先別|還不|不可以|不能|不准|勿)[^，,。.!！?？]{0,4}(退出|離開|退開|出去|走|下線)/;
const NOT_STOP = /(不要|不用|別|先別|還不|不可以|不能|不准|勿)[^，,。.!！?？]{0,2}(停|關|切)/;
const ASKING = /(怎麼|怎樣|如何|為什麼|為何|是不是|有沒有|會不會)/;
// 在講自己（「我先退出了」「我要走了」）：沒有 @ AI 時不當成對它下的指令。
const ABOUT_SELF = /我[^，,。.!！?？你妳]{0,4}(退出|離開|退開|出去|下線|走|停)/;
const MAX_LENGTH = 30;

/** 拿掉 @ 提及、頻道與表情標記、網址之後剩下的字。 */
export function commandText(content) {
  return String(content || '')
    .replace(/<@[!&]?\d+>|<#\d+>|<a?:\w+:\d+>|https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 這句話是不是在叫 AI 離開語音房或停止音樂。回傳 'leave'、'stop' 或 null。
 * 只認短句（避免把一長段聊天裡剛好出現的「離開」當成指令）。兩種都有時以離開為準。
 */
export function voiceCommand(content) {
  const text = commandText(content);
  if (!text || text.length > MAX_LENGTH || ASKING.test(text)) return null;
  if (LEAVE.test(text) && !NOT_LEAVE.test(text)) return 'leave';
  if (STOP.test(text) && !NOT_STOP.test(text)) return 'stop';
  return null;
}

/**
 * 在訊息交給模型之前先執行。回傳 null（不是指令或條件不符，照一般流程）
 * 或 { command, ok, note }：note 會附在這一輪給模型的內容後面。
 */
export async function runVoiceCommand({ message, transport, config, voice, log }) {
  if (!message || message.simulated || !message.guildId || !config?.musicControlEnabled) return null;
  const command = voiceCommand(message.content);
  if (!command) return null;
  const room = voice?.sessions?.get(transport.kind);
  if (!room || room.closed || room.guildId !== message.guildId) return null;
  if (!message.isMention) {
    if (!room.textChannelId || room.textChannelId !== message.channelId) return null;
    if (ABOUT_SELF.test(commandText(message.content))) return null;
  }
  const playing = Boolean(room.current || room.music || room.queue?.length);
  if (command === 'stop' && !playing) return null;
  try {
    if (command === 'leave') {
      const result = await voice.leave(transport.kind, '文字要求離開');
      if (!result?.ok) throw Error(result?.error || '離開語音房尚未確認');
      log?.info('voice.command', '已依文字要求離開語音房', { channelId: room.channelId, by: message.author?.id });
      return {
        command,
        ok: true,
        note: '【系統已執行】程式已經依這則訊息讓你離開語音房' + (playing ? '，播放中的音樂也停了' : '') + '。請用一句話自然地確認已經離開；不要說你做不到，也不要再呼叫離開語音房的工具。',
      };
    }
    await voice.stop(transport.kind);
    log?.info('voice.command', '已依文字要求停止音樂', { channelId: room.channelId, by: message.author?.id });
    return {
      command,
      ok: true,
      note: '【系統已執行】程式已經依這則訊息停止語音房裡的音樂並清空排隊，你還留在語音房。請用一句話自然地確認；不要說你做不到。',
    };
  } catch (error) {
    log?.warn('voice.command', '文字要求的語音房操作沒有成功', { command, reason: String(error?.message || error).slice(0, 200) });
    return {
      command,
      ok: false,
      note: '【系統】程式嘗試依這則訊息' + (command === 'leave' ? '離開語音房' : '停止音樂') + '，但沒有成功（' + String(error?.message || error).slice(0, 80) + '）。請照實告訴對方，並請他再說一次或手動處理。',
    };
  }
}
