/**
 * @file Unit tests for compressed file I/O middleware
 */
import { createCompressedFileIO } from "./compressed";
import { createMemoryFileIO } from "../memory";
// Note: CompressionStream polyfill for test environments
// In environments without native CompressionStream (like Bun v1.2.20), these tests will be skipped
// A full polyfill would require dynamic imports of node:zlib and node:stream
// For now, these tests run in Node.js v18+ and browsers with native support

// Skip tests if CompressionStream is not available
// Note: Bun doesn't support CompressionStream yet (as of v1.2.20)
// These tests will run in Node.js v18+ and modern browsers
// TODO: Enable when Bun adds CompressionStream support or implement zlib-based polyfill
const describeCompressionTests = typeof CompressionStream !== "undefined" ? describe : describe.skip;

describeCompressionTests("Compressed FileIO", () => {
  test("write/read operations with gzip", async () => {
    const baseIO = createMemoryFileIO();
    const io = createCompressedFileIO(baseIO, { format: "gzip" });

    const testData = new Uint8Array([1, 2, 3, 4, 5, 1, 2, 3, 4, 5]); // Repeated data compresses well
    await io.write("test.dat", testData);

    // Verify data is compressed in storage
    const storedData = await baseIO.read("test.dat");
    // Compressed data should be different from original
    expect(storedData.length).not.toBe(testData.length);

    // Verify decompressed read
    const readData = await io.read("test.dat");
    expect(Array.from(readData)).toEqual(Array.from(testData));
  });

  test("append operation", async () => {
    const baseIO = createMemoryFileIO();
    const io = createCompressedFileIO(baseIO);

    await io.append("log.dat", new Uint8Array([1, 2]));
    await io.append("log.dat", new Uint8Array([3, 4]));

    const data = await io.read("log.dat");
    expect(Array.from(data)).toEqual([1, 2, 3, 4]);
  });

  test("different compression formats", async () => {
    const formats: Array<"gzip" | "deflate" | "deflate-raw"> = ["gzip", "deflate", "deflate-raw"];

    for (const format of formats) {
      const baseIO = createMemoryFileIO();
      const io = createCompressedFileIO(baseIO, { format });

      const testData = new Uint8Array([10, 20, 30, 40, 50]);
      await io.write(`test-${format}.dat`, testData);

      const readData = await io.read(`test-${format}.dat`);
      expect(Array.from(readData)).toEqual(Array.from(testData));
    }
  });

  test("atomicWrite", async () => {
    const baseIO = createMemoryFileIO();
    const io = createCompressedFileIO(baseIO);

    await io.atomicWrite("atomic.dat", new Uint8Array([7, 8, 9]));
    const data = await io.read("atomic.dat");
    expect(Array.from(data)).toEqual([7, 8, 9]);
  });

  test("delete operation", async () => {
    const baseIO = createMemoryFileIO();
    const io = createCompressedFileIO(baseIO);

    await io.write("temp.dat", new Uint8Array([1]));
    await io.del!("temp.dat");

    await expect(io.read("temp.dat")).rejects.toThrow();
  });

  test("handles large data", async () => {
    const baseIO = createMemoryFileIO();
    const io = createCompressedFileIO(baseIO);

    // Create 10KB of repeated data (compresses well)
    const largeData = new Uint8Array(10000).fill(42);

    await io.write("large.dat", largeData);

    // Verify compression worked
    const storedData = await baseIO.read("large.dat");
    expect(storedData.length).toBeLessThan(largeData.length / 2); // Should compress significantly

    // Verify decompression
    const readData = await io.read("large.dat");
    expect(readData.length).toBe(largeData.length);
    expect(readData[0]).toBe(42);
    expect(readData[largeData.length - 1]).toBe(42);
  });

  test("handles empty data", async () => {
    const baseIO = createMemoryFileIO();
    const io = createCompressedFileIO(baseIO);

    await io.write("empty.dat", new Uint8Array(0));
    const data = await io.read("empty.dat");
    expect(data.length).toBe(0);
  });

  test("append to non-existent file", async () => {
    const baseIO = createMemoryFileIO();
    const io = createCompressedFileIO(baseIO);

    await io.append("new.dat", new Uint8Array([1, 2, 3]));
    const data = await io.read("new.dat");
    expect(Array.from(data)).toEqual([1, 2, 3]);
  });
});
