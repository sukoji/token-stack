// USD per 1M tokens. Cache write = 1.25x input, cache read = 0.1x input.
// NOTE: verify against https://docs.anthropic.com/en/docs/about-claude/pricing
// before releases; unknown models fall back to Sonnet-tier pricing.
const TIERS = [
  { match: /fable|mythos/i, input: 15, output: 75 },
  { match: /opus/i, input: 15, output: 75 },
  { match: /sonnet/i, input: 3, output: 15 },
  { match: /haiku/i, input: 1, output: 5 },
];

const FALLBACK = { input: 3, output: 15 };

export function priceFor(model) {
  const tier = TIERS.find((t) => t.match.test(model)) ?? FALLBACK;
  return {
    input: tier.input,
    output: tier.output,
    cacheWrite: tier.input * 1.25,
    cacheRead: tier.input * 0.1,
  };
}

export function costOf({ model, input, output, cacheRead, cacheWrite }) {
  const p = priceFor(model || "");
  return (
    (input * p.input +
      output * p.output +
      cacheRead * p.cacheRead +
      cacheWrite * p.cacheWrite) /
    1e6
  );
}
