export const USER_PRESENCE_KEYS = [
  'userPresenceEnabled',
  'userStatus',
  'userActivityType',
  'userActivityText',
  'userCustomStatusText',
  'userCustomStatusEmoji',
];
export function userPresence(config) {
  return {
    status: config.userStatus || 'online',
    activityType: config.userActivityType || 'none',
    activityText: config.userActivityText || '',
    customStatusText: config.userCustomStatusText || '',
    customStatusEmoji: config.userCustomStatusEmoji || '',
  };
}
export function validatePresence(input) {
  const result = {};
  if (input.activityText !== undefined && input.activityType === undefined)
    throw Error('活動文字需同時指定活動類型');
  if (input.status !== undefined) {
    if (!['online', 'idle', 'dnd', 'invisible'].includes(input.status)) throw Error('不支援的線上狀態');
    result.status = input.status;
  }
  if (input.activityType !== undefined) {
    if (!['none', 'playing', 'listening', 'watching', 'competing'].includes(input.activityType))
      throw Error('不支援的活動類型');
    result.activityType = input.activityType;
  }
  for (const key of ['activityText', 'customStatusText', 'customStatusEmoji'])
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'string' || input[key].length > (key === 'customStatusEmoji' ? 100 : 128))
        throw Error('狀態文字長度不符（文字最多 128 字元）');
      result[key] = input[key].trim();
    }
  if (result.activityType && result.activityType !== 'none' && !result.activityText)
    throw Error('請輸入活動文字，或將活動類型設為不顯示');
  const emoji = result.customStatusEmoji;
  if (
    emoji &&
    !/^<a?:\w+:\d{15,22}>$/.test(emoji) &&
    ([...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(emoji)].length !== 1 ||
      !/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(emoji))
  )
    throw Error('請貼上單個 Unicode 表情或有效 Discord 自訂表情代碼');
  return result;
}
