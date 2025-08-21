/**
 * @file Tests for MaxHeap
 */
import { MaxHeap } from "./heap";

describe("util/heap", () => {
  it("push/pop yields items in descending score order", () => {
    const h = new MaxHeap<{ s: number; id: number }>();
    h.push({ s: 0.5, id: 1 });
    h.push({ s: 2.0, id: 2 });
    h.push({ s: 1.0, id: 3 });
    expect(h.length).toBe(3);
    expect(h.pop()!.id).toBe(2);
    expect(h.pop()!.id).toBe(3);
    expect(h.pop()!.id).toBe(1);
    expect(h.pop()).toBeUndefined();
    expect(h.length).toBe(0);
  });
});
