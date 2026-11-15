/**
 * data/api-smoke.mjs — 用真正的 HTTP 伺服器驗證 /api/discord-cyberfriend/* 的每個端點，
 * 確認前端（client.js）呼叫的欄位都存在、型別正確。
 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
// 測試資料留在這份副本的 data/，不碰使用者的正式資料目錄。
process.env.DSH_DISCORD_CYBERFRIEND_DATA ||= resolve(root, 'data');
let routeHandler = null;

const ctx = {
  get(key) {
    if (key === 'connection') return { requestRejection: () => undefined };
    if (key === 'tools') return { register: () => () => {} };
    if (key === 'llm') {
      return {
        listProviders: () => [
          { provider: 'deepseek-account', displayName: 'DeepSeek' },
          { provider: 'antigravity', displayName: 'Antigravity' },
        ],
        prepareCall: () => { throw new Error('smoke: 不做真實呼叫'); },
      };
    }
    if (key === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }) };
    return undefined;
  },
  webServer: {
    register(route) {
      routeHandler = route.handler;
      return () => {};
    },
  },
  effect: () => {},
};

const mod = await import(pathToFileURL(resolve(root, 'src/index.js')).href);
await mod.apply(ctx, { memoryOutputDirectory:resolve(root,'data/memory-output'), enabled: true, userEnabled: false, botEnabled: false, logLevel: 'debug' });

const server = createServer((req, res) => routeHandler(req, res));
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/api/discord-cyberfriend`;

async function call(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  return { status: response.status, payload };
}

const checks = [];
function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const schema = await call('GET', '/schema');
check('GET /schema', schema.status === 200 && schema.payload?.schema?.fields?.length > 50,
  `${schema.payload?.schema?.fields?.length} 欄位 / ${schema.payload?.schema?.sections?.length} 分區`);
const sections = schema.payload?.schema?.sections || [];
check('分區齊全', ['general', 'user', 'bot', 'reply', 'cochat', 'reaction', 'gif', 'history', 'log', 'llm', 'advanced'].every((id) => sections.some((s) => s.id === id)),
  sections.map((s) => s.id).join(','));
check('transportInfo', Boolean(schema.payload?.schema?.transportInfo?.user?.tokenLabel && schema.payload?.schema?.transportInfo?.bot?.tokenLabel));

const status = await call('GET', '/status');
const s = status.payload;
check('GET /status', status.status === 200 && s?.status?.user?.state === 'disconnected' && s?.status?.bot,
  `primary=${s?.status?.primaryTransport}`);
check('status.config 有秘密欄位標記', 'userToken__set' in (s?.config || {}));
check('status.channels 是陣列', Array.isArray(s?.channels));
check('status.logs 是陣列', Array.isArray(s?.logs) && s.logs.length >= 1);
check('status.providers', Array.isArray(s?.providers) && s.providers.length === 2);
check('status.history 統計', typeof s?.history?.channels === 'number');

const configGet = await call('GET', '/config');
check('GET /config', configGet.status === 200 && configGet.payload?.config?.llmMode === 'auto' && configGet.payload?.config?.userToken === '');

const patch = await call('POST', '/config', { coChatProbability: 42, generic: 'x', userToken: '' });
check('POST /config 只留已知欄位', patch.status === 200 && patch.payload?.config?.coChatProbability === 42 && !('generic' in (patch.payload?.config || {})),
  `changed=${JSON.stringify(patch.payload?.changed)}`);

const patchBad = await call('POST', '/config', { userToken: '' });
check('POST /config 空機密欄位被拒', patchBad.status === 400 && /機密/.test(patchBad.payload?.error || ''), patchBad.payload?.error);

const logs = await call('GET', '/logs?limit=5');
check('GET /logs', logs.status === 200 && Array.isArray(logs.payload?.logs) && logs.payload.logs.length <= 5);

const appearance=await call('POST','/config',{userPresenceEnabled:true,userStatus:'idle',userActivityType:'playing',userActivityText:'fixture game',userCustomStatusText:'fixture status',userCustomStatusEmoji:'🐟'});
check('外觀設定可儲存且離線明確標為待套用',appearance.payload?.config?.userActivityText==='fixture game'&&appearance.payload?.liveResults?.userPresence?.pending===true);
const badAppearance=await call('POST','/config',{userActivityText:''});
check('不完整的活動設定拒絕儲存',badAppearance.status===400);
await call('POST','/config',{userPresenceEnabled:false});

const userInbox=await call('GET','/user-inbox');check('個人收件匣端點回傳實際清單',Array.isArray(userInbox.payload?.items));
const pause=await call('POST','/user-takeover',{action:'pause',channelId:'1560000000000000011',seconds:900,label:'isolated fixture'});check('接管端點保存範圍與期限',pause.payload?.entry?.channelId==='1560000000000000011'&&pause.payload?.entries?.length===1);
const resume=await call('POST','/user-takeover',{action:'resume',channelId:'1560000000000000011'});check('解除接管移除保存項目',resume.payload?.entries?.length===0);
const editOffline=await call('POST','/user-message/edit',{channelId:'1560000000000000011',messageId:'1560000000000000012',content:'fixture'});check('未連線時訊息修正明確失敗',editOffline.payload?.ok===false);
const noDelete=await call('POST','/user-message/delete',{channelId:'1560000000000000011',messageId:'1560000000000000012'});check('撤回需要明確確認',noDelete.status===400);

const voiceStatus=await call('GET','/voice');check('語音端點預設不加入也不收聽',voiceStatus.payload?.enabled===false&&voiceStatus.payload?.sessions?.length===0);
const voiceConfig=await call('POST','/config',{voiceIdleMinutes:3});check('語音閒置設定真實保存',voiceConfig.payload?.config?.voiceIdleMinutes===3);
const voiceIdle=await call('GET','/voice');check('語音閒置狀態使用後端已存值',voiceIdle.payload?.idleMinutes===3);
const blockedVoice=await call('POST','/voice/join',{kind:'bot',guildId:'400000000000000004',channelId:'400000000000000005'});check('未啟用語音禁止連線',blockedVoice.payload?.ok===false&&!!blockedVoice.payload?.error);
const reviews=await call('GET','/user-review');check('草稿端點回傳真實清單',Array.isArray(reviews.payload?.drafts));
const behavior=await call('GET','/user-behavior');check('行為組合提供內建預設與規則',behavior.payload?.presets?.length>=4&&Array.isArray(behavior.payload?.rules));
const rule=await call('POST','/user-behavior',{action:'putRule',kind:'user',targetId:'1560000000000000015',transport:'both',scope:'dm',nickname:'isolated fixture'});check('對話偏好可保存且有範圍',rule.payload?.rules?.some(r=>r.targetId==='1560000000000000015'&&r.scope==='dm'));
const capture=await call('POST','/user-behavior',{action:'capture',name:'isolated fixture',profile:'adminDm',includePersona:false});check('可擷取自訂行為組合',capture.payload?.presets?.some(p=>p.name==='isolated fixture'));
const tokenStats=await call('GET','/token-budget');check('本插件 Token 用量有獨立統計',typeof tokenStats.payload?.today?.totalTokens==='number'&&tokenStats.payload?.timeZone==='Asia/Taipei');
await call('POST','/config',{tokenBudgetEnabled:true,tokenBudgetMode:'block',tokenDailyLimit:1});
const budgetBlocked=await call('POST','/test-llm');check('Token 預算不足確實阻止模型呼叫',budgetBlocked.payload?.result?.code==='TOKEN_BUDGET');
await call('POST','/config',{tokenBudgetEnabled:false,tokenDailyLimit:0});
const absentDraft=await call('POST','/user-review/approve',{id:'missing',version:1,content:'fixture'});check('不存在草稿不能核准或送出',absentDraft.status===404);

const history = await call('GET', '/history');
check('GET /history', history.status === 200 && Array.isArray(history.payload?.channels) && history.payload?.stats);

const clearUnconfirmed = await call('POST', '/history/clear', {});
check('POST /history/clear 未確認被拒', clearUnconfirmed.status === 400);
const clearHistory = await call('POST', '/history/clear', { confirmed: true });
check('POST /history/clear', clearHistory.status === 200 && typeof clearHistory.payload?.stats?.messages === 'number');

const gif = await call('GET', '/gif?q=cat');
check('GET /gif 未連線時有明確錯誤', gif.status === 400 && /已連線/.test(gif.payload?.error || ''), gif.payload?.error);

const testLlm = await call('POST', '/test-llm');
check('POST /test-llm 失敗也有結構', testLlm.status === 200 && typeof testLlm.payload?.result?.ok === 'boolean',
  String(testLlm.payload?.result?.error || '').slice(0, 60));

const login = await call('POST', '/login', { transport: 'user', token: '' });
check('POST /login 拒絕已停用的介面', login.status === 400 && /停用/.test(login.payload?.error || ''), login.payload?.error);

const presence = await call('POST', '/presence', { status: 'online' });
check('POST /presence 未登入明確回報失敗', presence.status === 200 && presence.payload?.ok === false && presence.payload?.results?.user?.ok === false);

const guilds = await call('GET', '/guilds');
check('GET /guilds 未登入回 400 且訊息清楚', guilds.status === 400 && /沒有任何介面/.test(guilds.payload?.error || ''), guilds.payload?.error);

const statsReset = await call('POST', '/stats/reset');
check('POST /stats/reset', statsReset.status === 200 && Boolean(statsReset.payload?.dailyStats?.date));

const missing = await call('GET', '/nope');
check('GET 未知路徑 404', missing.status === 404 && /找不到端點/.test(missing.payload?.error || ''));

const wrongMethod = await call('DELETE', '/schema');
check('錯方法 405', wrongMethod.status === 405);

server.close();
const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} 通過`);
if (failed.length) {
  console.log('失敗項目:', failed.map((entry) => entry.name).join(', '));
  process.exit(1);
}
process.exit(0);
