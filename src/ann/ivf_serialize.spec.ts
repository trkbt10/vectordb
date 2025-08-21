/**
 * @file Tests for IVF serialize/deserialize and resize behavior
 */
import { createState } from "../attr/state/create";
import { add } from "../attr/ops/core";
import { ivf_serialize, ivf_deserialize } from "./ivf";
import type { IVFState } from "./ivf";
import { isIvfVL } from "../util/guards";

describe("ann/ivf serialize/deserialize", () => {
  it("roundtrips and resizes centroids for different dim", () => {
    // source: dim=3
    const src = createState({ dim: 3, metric: "cosine", strategy: "ivf", ivf: { nlist: 4, nprobe: 2 } });
    add(src, 1, new Float32Array([1, 0, 0]));
    add(src, 2, new Float32Array([0, 1, 0]));
    add(src, 3, new Float32Array([0, 0, 1]));
    // populate minimal centroids/lists implicitly via ivf_add
    if (!isIvfVL(src)) throw new Error("expected ivf VL src");
    const buf = ivf_serialize(src.ann as IVFState, src.store);

    // destination: dim=2 => should resize centroid array length to nlist*2
    const dst = createState({ dim: 2, metric: "cosine", strategy: "ivf", ivf: { nlist: 4, nprobe: 2 } });
    // Corrupt the header dim to trigger resize path inside ivf_deserialize
    const u8 = new Uint8Array(buf.slice(0));
    const dv = new DataView(u8.buffer);
    dv.setUint32(12, 2, true); // set serialized header dim to mismatch centroid array dim
    if (!isIvfVL(dst)) throw new Error("expected ivf VL dst");
    ivf_deserialize(dst.ann as IVFState, dst.store, u8.buffer);
    const cent = (dst.ann as IVFState).centroids as Float32Array;
    expect(cent.length).toBe((dst.ann as IVFState).nlist * dst.dim);
  });
});
