/** Official DeepSeek routes whose wire contract accepts image input. */
export const KNOWN_NATIVE_VISION_MODELS = new Set([
    'deepseek-v4-flash-vision-exp',
]);

function clean(value) {
    return typeof value === 'string' ? value.trim() : '';
}

/** Read the exact route selected for this prompt assembly. */
export function selectionFromAssembly(assembly, context = {}) {
    const variables = assembly && typeof assembly === 'object' ? assembly.variables : undefined;
    const options = context.agent && typeof context.agent === 'object' ? context.agent.options : undefined;
    return {
        provider: clean(variables?.provider) || clean(options?.provider),
        model: clean(variables?.model) || clean(options?.model),
    };
}

/** Read the route retained on a tool execution's agent scope. */
export function selectionFromAgent(agent) {
    const options = agent && typeof agent === 'object' ? agent.options : undefined;
    return {
        provider: clean(options?.provider),
        model: clean(options?.model),
    };
}

/** True when adapter metadata explicitly advertises native image input. */
export function metadataSupportsImages(modelInfo) {
    return Array.isArray(modelInfo?.inputModalities)
        && modelInfo.inputModalities.some((item) => clean(item).toLowerCase() === 'image');
}

/**
 * Name fallback for an official vision route. Older Harness adapters reported
 * every DeepSeek model as text-only even after the provider added this model.
 */
export function isKnownNativeVisionModel(model) {
    return KNOWN_NATIVE_VISION_MODELS.has(clean(model).toLowerCase());
}

/** Prefer route capability metadata and fall back to the official model id. */
export async function selectionSupportsNativeVision(ctx, selection, signal) {
    if (isKnownNativeVisionModel(selection?.model)) return true;
    if (!selection?.provider || !selection?.model) return false;
    try {
        const info = await ctx.llm.resolveModelInfo(selection.provider, selection.model, signal);
        return metadataSupportsImages(info);
    } catch {
        // A catalog lookup must never break prompt assembly. Unknown/unavailable
        // routes retain the external vision fallback.
        return false;
    }
}
