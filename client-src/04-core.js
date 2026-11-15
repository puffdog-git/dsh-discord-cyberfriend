const h = React.createElement;
const { useState, useEffect, useMemo, useRef } = React;

const API = '/api/discord-cyberfriend';

// 視窗不在前景時略過定時輪詢，避免背景中持續打後端。
const pageHidden = () => typeof document !== 'undefined' && document.hidden === true;

// ------------------------------------------------------------------ utils ---
async function api(path, options) {
  const response = await fetch(`${API}${path}`, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    method: options?.method || 'GET',
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || (payload?.ok === false && !options?.allowFailure)) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

const fmtNum = (value) => (Number.isFinite(Number(value)) ? Number(value).toLocaleString('zh-TW') : '-');
const fmtTime = (iso) => {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('zh-TW', { hour12: false });
};
const fmtAgo = (ms) => {
  const value = Number(ms) || 0;
  if (value <= 0) return '-';
  const seconds = Math.floor(value / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時 ${minutes % 60} 分`;
  return `${Math.floor(hours / 24)} 天`;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// ------------------------------------------------------------------- icons ---
const svg = (props, children) =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: props?.size || 16,
      height: props?.size || 16,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    children,
  );

const Icon = {
  hub: (p) =>
    svg(p, [
      h('circle', { cx: 12, cy: 12, r: 3 }),
      h('path', {
        d: 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1',
      }),
    ]),
  user: (p) =>
    svg(p, [h('circle', { cx: 12, cy: 8, r: 3.6 }), h('path', { d: 'M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5' })]),
  bot: (p) =>
    svg(p, [
      h('rect', { x: 4, y: 7, width: 16, height: 12, rx: 3 }),
      h('path', { d: 'M12 3v4M9 13h.01M15 13h.01M9.5 17h5' }),
    ]),
  reply: (p) =>
    svg(p, [h('path', { d: 'M9 7H7a4 4 0 0 0 0 8h2M15 7h2a4 4 0 0 1 0 8h-2M4 17l3 3M20 20l-3-3' })]),
  chat: (p) =>
    svg(p, [
      h('path', { d: 'M20 15a3 3 0 0 1-3 3H9l-4 3v-4a3 3 0 0 1-1-2V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z' }),
    ]),
  reaction: (p) =>
    svg(p, [
      h('circle', { cx: 12, cy: 12, r: 9 }),
      h('path', { d: 'M9 10h.01M15 10h.01M8.5 14.5a4.5 4.5 0 0 0 7 0' }),
    ]),
  gif: (p) =>
    svg(p, [
      h('rect', { x: 3, y: 5, width: 18, height: 14, rx: 3 }),
      h('path', { d: 'M8 10v4M8 12h2M12 10v4M15 14v-4h2' }),
    ]),
  history: (p) =>
    svg(p, [h('path', { d: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5' }), h('path', { d: 'M12 8v4l3 2' })]),
  log: (p) => svg(p, [h('path', { d: 'M5 4h9l5 5v11H5z' }), h('path', { d: 'M14 4v5h5M8 13h8M8 17h5' })]),
  model: (p) =>
    svg(p, [
      h('path', { d: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z' }),
      h('path', { d: 'M12 12l8-4.5M12 12v9M12 12L4 7.5' }),
    ]),
  prompt: (p) => svg(p, [h('path', { d: 'M4 6h16M4 12h10M4 18h13' })]),
  advanced: (p) =>
    svg(p, [
      h('path', { d: 'M4 7h10M18 7h2M4 17h2M10 17h10' }),
      h('circle', { cx: 16, cy: 7, r: 2 }),
      h('circle', { cx: 8, cy: 17, r: 2 }),
    ]),
  settings: (p) =>
    svg(p, [
      h('circle', { cx: 12, cy: 12, r: 3 }),
      h('path', {
        d: 'M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
      }),
    ]),
  check: (p) => svg(p, [h('path', { d: 'M20 6L9 17l-5-5' })]),
  refresh: (p) => svg(p, [h('path', { d: 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5' })]),
  save: (p) =>
    svg(p, [
      h('path', { d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' }),
      h('path', { d: 'M7 3v6h8V3M7 21v-6h10v6' }),
    ]),
  power: (p) => svg(p, [h('path', { d: 'M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0' })]),
  play: (p) => svg(p, [h('path', { d: 'M7 4l13 8-13 8z' })]),
  trash: (p) => svg(p, [h('path', { d: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13' })]),
  bolt: (p) => svg(p, [h('path', { d: 'M13 2L4 14h6l-1 8 9-12h-6z' })]),
  warn: (p) => svg(p, [h('path', { d: 'M12 3l9 17H3zM12 9v5M12 17h.01' })]),
  image: (p) =>
    svg(p, [
      h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
      h('circle', { cx: 9, cy: 10, r: 1.6 }),
      h('path', { d: 'M4 18l5-5 4 4 3-3 4 4' }),
    ]),
  send: (p) => svg(p, [h('path', { d: 'M22 2L11 13M22 2l-7 20-4-9-9-4z' })]),
};
const iconFor = (key) => Icon[key] || Icon.settings;

// --------------------------------------------------------------------- css ---

Icon.voice = (p) =>
  svg(p, [
    h('rect', { x: 9, y: 3, width: 6, height: 11, rx: 3 }),
    h('path', { d: 'M5 11a7 7 0 0 0 14 0M12 18v3' }),
  ]);
Icon.eye = (p) =>
  svg(p, [
    h('path', { d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z' }),
    h('circle', { cx: 12, cy: 12, r: 3 }),
  ]);
Icon.eyeOff = (p) =>
  svg(p, [
    h('path', {
      d: 'M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.6A16.6 16.6 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 4.2-.9',
    }),
  ]);
Icon.search = (p) => svg(p, [h('circle', { cx: 11, cy: 11, r: 7 }), h('path', { d: 'M20 20l-3.5-3.5' })]);
Icon.arrow = (p) => svg(p, [h('path', { d: 'M5 12h14M13 6l6 6-6 6' })]);
