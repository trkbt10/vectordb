/**
 * @file Tests for type guard utilities
 */
import { createState } from "../attr/state/create";
import { isHnswState, isBruteforceState, isHnswVL, isBfVL, isIvfVL } from "./guards";

test("state guards narrow strategy/state correctly", () => {
  const bf = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
  const hs = createState({ dim: 2, metric: "cosine", strategy: "hnsw", hnsw: { M: 4 } });
  const iv = createState({ dim: 2, metric: "cosine", strategy: "ivf", ivf: { nlist: 2, nprobe: 1 } });
  expect(isBfVL(bf)).toBe(true);
  expect(isHnswVL(hs)).toBe(true);
  expect(isIvfVL(iv)).toBe(true);
  // state discriminants
  if (isHnswVL(hs)) {
    expect(isHnswState(hs.ann)).toBe(true);
  }
  if (isBfVL(bf)) {
    expect(isBruteforceState(bf.ann)).toBe(true);
  }
});
