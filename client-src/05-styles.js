// 樣式內容在 styles.css，建置時嵌入為 CSS 常數。
let styleInjected = false;
function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (styleInjected && document.querySelector('style[data-plugin-css="dsh-discord-cyberfriend"]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-plugin-css', 'dsh-discord-cyberfriend');
  style.textContent = CSS;
  document.head.appendChild(style);
  styleInjected = true;
}
