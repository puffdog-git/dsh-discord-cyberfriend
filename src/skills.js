import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const DISCORD_SKILLS = Object.freeze([
  'discord-cover-flow',
  'discord-memory-diagnose',
  'discord-voice-diagnose',
  'discord-persona-voice',
  'discord-speech-delivery',
]);
export const DISCORD_SKILL_PROVIDER = 'dsh-discord';
const root = new URL('../skills/', import.meta.url);

// Packaged entrypoints deliberately use plain, single-line YAML metadata.
// Reject unsupported metadata instead of silently changing invocation policy.
function parse(raw, name) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw);
  if (!m) throw Error(`Discord skill ${name}: missing frontmatter`);
  const rows = m[1].split(/\r?\n/).filter(Boolean);
  if (rows.length !== 2 || !rows.includes(`name: ${name}`))
    throw Error(`Discord skill ${name}: invalid metadata`);
  const description = rows
    .find((r) => r.startsWith('description: '))
    ?.slice(13)
    .trim();
  const content = raw.slice(m[0].length).trim();
  if (!description || !content) throw Error(`Discord skill ${name}: empty entrypoint`);
  return { description, content };
}

export function createDiscordSkillProvider(control, { read = readFile, warn = () => {} } = {}) {
  const reported = new Set();
  async function load(name, signal) {
    if (!DISCORD_SKILLS.includes(name)) return;
    signal = AbortSignal.any([signal, control.signal].filter(Boolean));
    signal.throwIfAborted();
    const file = new URL(`${name}/SKILL.md`, root);
    try {
      const value = parse(await read(file, { encoding: 'utf8', signal }), name);
      signal.throwIfAborted();
      reported.delete(name);
      return { value };
    } catch (error) {
      signal?.throwIfAborted();
      control.signal?.throwIfAborted();
      if (!reported.has(name)) {
        reported.add(name);
        warn(`Discord skill ${name} 無法讀取；請檢查插件安裝內容`);
      }
      return {
        error,
        persistent:
          error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.message?.startsWith('Discord skill '),
      };
    }
  }
  return {
    name: DISCORD_SKILL_PROVIDER,
    async list(options = {}) {
      control.signal?.throwIfAborted();
      const reads = await Promise.all(
        DISCORD_SKILLS.map(async (name) => ({ name, result: await load(name, options.signal) })),
      );
      return {
        candidates: reads
          .filter((r) => r.result.value)
          .map(({ name, result }) => ({
            name,
            description: result.value.description,
            invocation: { modelInvocable: true, userInvocable: true },
            provider: DISCORD_SKILL_PROVIDER,
            source: 'bundled',
            rank: 600,
            resourceBase: {
              kind: 'directory',
              path: fileURLToPath(new URL(`${name}/`, root)).replaceAll('\\', '/'),
            },
            locator: name,
          })),
        complete: reads.every((r) => r.result.value || r.result.persistent),
      };
    },
    async get(candidate, options = {}) {
      control.signal?.throwIfAborted();
      if (candidate.provider !== DISCORD_SKILL_PROVIDER || !DISCORD_SKILLS.includes(candidate.name)) return;
      const result = await load(candidate.name, options.signal);
      if (!result.value) {
        control.invalidate();
        if (!result.persistent) throw result.error;
        return;
      }
      return {
        name: candidate.name,
        description: result.value.description,
        invocation: { modelInvocable: true, userInvocable: true },
        provider: DISCORD_SKILL_PROVIDER,
        source: 'bundled',
        resourceBase: {
          kind: 'directory',
          path: fileURLToPath(new URL(`${candidate.name}/`, root)).replaceAll('\\', '/'),
        },
        content: result.value.content,
      };
    },
  };
}

export function registerDiscordSkills(ctx) {
  // Optional service: older hosts keep Discord working; current hosts own
  // registration disposal and catalog invalidation through the injected fiber.
  ctx.inject?.(['skills'], (scope) => {
    scope.skills.registerProvider((control) =>
      createDiscordSkillProvider(control, {
        warn: (message) => scope.logger?.warn(message),
      }),
    );
  });
}
