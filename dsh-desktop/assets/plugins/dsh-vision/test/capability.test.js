import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isKnownNativeVisionModel,
    metadataSupportsImages,
    selectionFromAssembly,
    selectionSupportsNativeVision,
} from '../lib/capability.js';

test('recognizes the official DeepSeek Flash Vision Exp route', () => {
    assert.equal(isKnownNativeVisionModel('deepseek-v4-flash-vision-exp'), true);
    assert.equal(isKnownNativeVisionModel(' DeepSeek-V4-Flash-Vision-Exp '), true);
    assert.equal(isKnownNativeVisionModel('deepseek-v4-flash'), false);
});

test('prefers selected assembly variables over the agent default', () => {
    assert.deepEqual(selectionFromAssembly({
        variables: { provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' },
    }, {
        agent: { options: { provider: 'old', model: 'old-model' } },
    }), {
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash-vision-exp',
    });
});

test('recognizes image capability metadata from any provider', () => {
    assert.equal(metadataSupportsImages({ inputModalities: ['text', 'image'] }), true);
    assert.equal(metadataSupportsImages({ inputModalities: ['text'] }), false);
    assert.equal(metadataSupportsImages({}), false);
});

test('uses metadata for custom routes and keeps text-only routes external', async () => {
    const ctx = {
        llm: {
            async resolveModelInfo(_provider, model) {
                return { inputModalities: model === 'custom-vlm' ? ['text', 'image'] : ['text'] };
            },
        },
    };
    assert.equal(await selectionSupportsNativeVision(ctx, { provider: 'custom', model: 'custom-vlm' }), true);
    assert.equal(await selectionSupportsNativeVision(ctx, { provider: 'deepseek-official', model: 'deepseek-v4-flash' }), false);
});

test('official model-id fallback survives stale text-only adapter metadata', async () => {
    const ctx = { llm: { resolveModelInfo: async () => ({ inputModalities: ['text'] }) } };
    assert.equal(await selectionSupportsNativeVision(ctx, {
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash-vision-exp',
    }), true);
});
