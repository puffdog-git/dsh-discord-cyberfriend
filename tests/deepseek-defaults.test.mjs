import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeConfig, describeSchema } from '../src/config.js';
import { resolveRoute } from '../src/llm.js';

const host = (ids, selection) => ({
  get: (name) =>
    name === 'llm'
      ? { listProviders: () => ids.map((id) => ({ provider: id })) }
      : name === 'agentDefaultModel' && selection
        ? { currentSelection: () => selection }
        : undefined,
});

test('new installs default to the DeepSeek account that ships with DSH', () => {
  const config = sanitizeConfig({});
  assert.equal(config.subscriptionProvider, 'deepseek-account');
  assert.equal(config.subscriptionModel, 'deepseek-v4-pro');
  assert.equal(config.llmMode, 'auto');
  const fields = Object.fromEntries(describeSchema().fields.map((field) => [field.key, field]));
  assert.equal(fields.subscriptionProvider.suggestions[0], 'deepseek-account');
  assert.equal(fields.subscriptionModel.suggestions[0], 'deepseek-v4-pro');
  assert.match(fields.subscriptionProvider.help, /deepseek-account/);
});

test('a saved value is kept, and the chosen service is used when DSH has it', () => {
  const config = sanitizeConfig({ llmMode: 'subscriptions', subscriptionProvider: 'other', subscriptionModel: 'm' });
  assert.equal(config.subscriptionProvider, 'other');
  assert.deepEqual(resolveRoute(host(['deepseek-official', 'other']), config), { provider: 'other', model: 'm' });
});

test('an unknown service falls back to deepseek-account before the first listed one', () => {
  const config = sanitizeConfig({ llmMode: 'subscriptions', subscriptionProvider: 'antigravity', subscriptionModel: 'm' });
  assert.equal(resolveRoute(host(['deepseek-official', 'deepseek-account']), config).provider, 'deepseek-account');
  assert.equal(resolveRoute(host(['only-one']), config).provider, 'only-one');
  assert.equal(resolveRoute(host([]), config).provider, 'deepseek-account');
});

test('auto mode still follows the model DSH uses for new conversations', () => {
  const config = sanitizeConfig({});
  const route = resolveRoute(host(['deepseek-official', 'deepseek-account'], { provider: 'deepseek-official', model: 'x' }), config);
  assert.deepEqual({ provider: route.provider, model: route.model }, { provider: 'deepseek-official', model: 'x' });
  assert.deepEqual(resolveRoute(host(['deepseek-official', 'deepseek-account']), config), {
    provider: 'deepseek-account',
    model: 'deepseek-v4-pro',
  });
});
