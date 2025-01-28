// USD per 1M tokens, per platform.claude.com/docs/en/docs/about-claude/pricing
// (2026-07). Cache write = 1.25x input (5m), cache read = 0.1x input.
// Unknown models fall back to Sonnet-tier pricing. First match wins.
const TIERS = [
  { match: /fable|mythos/i, input: 10, output: 50 },
  { match: /3-opus|opus-4-[0-4]/i, input: 15, output: 75 }, // Opus 4, 4.1
  { match: /opus/i, input: 5, output: 25 }, // Opus 4.5+
  { match: /sonnet-5/i, input: 2, output: 10 }, // intro pricing until 2026-09
  { match: /sonnet/i, input: 3, output: 15 },
  { match: /3-5-haiku/i, input: 0.8, output: 4 },
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
