/** @file Coordination: commit timestamp and commit-wait specs */
import { computeCommitTs, commitWait } from "./commit";

describe("coordination/commit", () => {
  it("computeCommitTs is monotonic over inputs", () => {
    const t1 = computeCommitTs({ prepareTs: 100, lastCommittedTs: 90, nowTs: 95, delta: 5 });
    expect(t1).toBe(100);
    const t2 = computeCommitTs({ prepareTs: 80, lastCommittedTs: 100, nowTs: 99, delta: 5 });
    expect(t2).toBe(105);
    const t3 = computeCommitTs({ prepareTs: 80, lastCommittedTs: 100, nowTs: 200, delta: 5 });
    expect(t3).toBe(200);
  });

  it("commitWait waits until commitTs + epsilon", async () => {
    const start = Date.now();
    const now = () => Date.now();
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const commitTs = start + 20;
    await commitWait(commitTs, 5, now, sleep);
    expect(Date.now()).toBeGreaterThan(commitTs + 4);
  });
});

