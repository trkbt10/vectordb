/**
 * @file Unit tests for Cache API-backed file I/O operations
 */
import { createCacheStorageFileIO } from "./cache";

// Skip tests if Cache API is not available
const describeCacheTests = typeof caches !== 'undefined' ? describe : describe.skip;

describeCacheTests("Cache FileIO", () => {
  const testOptions = {
    cacheName: 'test-cache-' + Date.now(),
    urlPrefix: 'https://workbox.test'
  };

  afterEach(async () => {
    // Clean up test cache
    if (typeof caches !== 'undefined') {
      await caches.delete(testOptions.cacheName);
    }
  });

  test("write/read basic operations", async () => {
    const io = createCacheStorageFileIO(testOptions);
    
    const testData = new Uint8Array([1, 2, 3]);
    await io.write("test.txt", testData);
    
    const data = await io.read("test.txt");
    expect(Array.from(data)).toEqual([1, 2, 3]);
  });

  test("append operation", async () => {
    const io = createCacheStorageFileIO(testOptions);
    
    await io.append("log.txt", new Uint8Array([1, 2]));
    await io.append("log.txt", new Uint8Array([3, 4]));
    
    const data = await io.read("log.txt");
    expect(Array.from(data)).toEqual([1, 2, 3, 4]);
  });

  test("delete operation", async () => {
    const io = createCacheStorageFileIO(testOptions);
    
    await io.write("temp.txt", new Uint8Array([1]));
    await io.del!("temp.txt");
    
    await expect(io.read("temp.txt")).rejects.toThrow("File not found");
  });

  test("atomicWrite", async () => {
    const io = createCacheStorageFileIO(testOptions);
    
    await io.atomicWrite("atomic.txt", new Uint8Array([5, 6, 7]));
    const data = await io.read("atomic.txt");
    expect(Array.from(data)).toEqual([5, 6, 7]);
  });

  test("validates paths", async () => {
    const io = createCacheStorageFileIO(testOptions);
    
    await expect(io.read("../etc/passwd")).rejects.toThrow("Invalid path");
    await expect(io.write("foo//bar", new Uint8Array())).rejects.toThrow("Invalid path");
  });

  test("handles non-existent files", async () => {
    const io = createCacheStorageFileIO(testOptions);
    
    await expect(io.read("does-not-exist.txt")).rejects.toThrow("File not found");
  });

  test("handles ArrayBuffer data", async () => {
    const io = createCacheStorageFileIO(testOptions);
    
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, 0x12345678, true);
    
    await io.write("buffer.dat", buffer);
    const data = await io.read("buffer.dat");
    expect(new DataView(data.buffer).getUint32(0, true)).toBe(0x12345678);
  });
});

test("throws when cacheName is missing", () => {
  expect(() => createCacheStorageFileIO({ cacheName: '', urlPrefix: 'https://test' }))
    .toThrow("cacheName is required");
});

test("throws when urlPrefix is missing", () => {
  expect(() => createCacheStorageFileIO({ cacheName: 'test', urlPrefix: '' }))
    .toThrow("urlPrefix is required");
});