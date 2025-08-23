/**
 * @file Unit tests for encrypted file I/O middleware
 */
import { createEncryptedFileIO } from "./encrypted";
import { createMemoryFileIO } from "../memory";

// Skip tests if Web Crypto is not available
const describeCryptoTests = typeof crypto !== 'undefined' && crypto.subtle ? describe : describe.skip;

describeCryptoTests("Encrypted FileIO", () => {
  test("write/read with Uint8Array key", async () => {
    const baseIO = createMemoryFileIO();
    const key = new Uint8Array(32).fill(0x42);
    const io = await createEncryptedFileIO(baseIO, key);
    
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    await io.write("secret.dat", testData);
    
    // Verify data is encrypted in storage
    const storedData = await baseIO.read("secret.dat");
    // First 12 bytes should be IV, data should be encrypted
    expect(storedData.length).toBeGreaterThanOrEqual(12 + testData.length);
    // Encrypted data should be different from original
    const encryptedPortion = storedData.slice(12);
    expect(Array.from(encryptedPortion)).not.toEqual(Array.from(testData));
    
    // Verify decrypted read
    const readData = await io.read("secret.dat");
    expect(Array.from(readData)).toEqual(Array.from(testData));
  });

  test("write/read with string key (key derivation)", async () => {
    const baseIO = createMemoryFileIO();
    const io = await createEncryptedFileIO(baseIO, "my-secret-password");
    
    const testData = new Uint8Array([10, 20, 30]);
    await io.write("data.enc", testData);
    
    const readData = await io.read("data.enc");
    expect(Array.from(readData)).toEqual(Array.from(testData));
  });

  test("append operation", async () => {
    const baseIO = createMemoryFileIO();
    const key = new Uint8Array(32).fill(0x42);
    const io = await createEncryptedFileIO(baseIO, key);
    
    await io.append("log.enc", new Uint8Array([1, 2]));
    await io.append("log.enc", new Uint8Array([3, 4]));
    
    const data = await io.read("log.enc");
    expect(Array.from(data)).toEqual([1, 2, 3, 4]);
  });

  test("atomicWrite", async () => {
    const baseIO = createMemoryFileIO();
    const key = new Uint8Array(32).fill(0x42);
    const io = await createEncryptedFileIO(baseIO, key);
    
    await io.atomicWrite("atomic.enc", new Uint8Array([7, 8, 9]));
    const data = await io.read("atomic.enc");
    expect(Array.from(data)).toEqual([7, 8, 9]);
  });

  test("delete operation", async () => {
    const baseIO = createMemoryFileIO();
    const key = new Uint8Array(32).fill(0x42);
    const io = await createEncryptedFileIO(baseIO, key);
    
    await io.write("temp.enc", new Uint8Array([1]));
    await io.del!("temp.enc");
    
    await expect(io.read("temp.enc")).rejects.toThrow();
  });

  test("different keys produce different ciphertext", async () => {
    const baseIO = createMemoryFileIO();
    const key1 = new Uint8Array(32).fill(0x42);
    const key2 = new Uint8Array(32).fill(0x43);
    
    const io1 = await createEncryptedFileIO(baseIO, key1);
    const io2 = await createEncryptedFileIO(createMemoryFileIO(), key2);
    
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    await io1.write("test1.enc", testData);
    await io2.write("test2.enc", testData);
    
    const encrypted1 = await baseIO.read("test1.enc");
    const encrypted2 = await io2.read("test2.enc");
    
    // Same plaintext with different keys should produce different ciphertext
    expect(Array.from(encrypted1)).not.toEqual(Array.from(encrypted2));
  });

  test("handles large data", async () => {
    const baseIO = createMemoryFileIO();
    const key = new Uint8Array(32).fill(0x42);
    const io = await createEncryptedFileIO(baseIO, key);
    
    const largeData = new Uint8Array(1024 * 100); // 100KB
    for (let i = 0; i < largeData.length; i++) {
      largeData[i] = i % 256;
    }
    
    await io.write("large.enc", largeData);
    const readData = await io.read("large.enc");
    expect(readData).toEqual(largeData);
  });

  test("handles empty data", async () => {
    const baseIO = createMemoryFileIO();
    const key = new Uint8Array(32).fill(0x42);
    const io = await createEncryptedFileIO(baseIO, key);
    
    await io.write("empty.enc", new Uint8Array(0));
    const data = await io.read("empty.enc");
    expect(data.length).toBe(0);
  });

  test("append to non-existent file", async () => {
    const baseIO = createMemoryFileIO();
    const key = new Uint8Array(32).fill(0x42);
    const io = await createEncryptedFileIO(baseIO, key);
    
    await io.append("new.enc", new Uint8Array([1, 2, 3]));
    const data = await io.read("new.enc");
    expect(Array.from(data)).toEqual([1, 2, 3]);
  });
});

test("throws with invalid key size", async () => {
  const baseIO = createMemoryFileIO();
  const invalidKey = new Uint8Array(16); // Should be 32 bytes
  
  await expect(
    createEncryptedFileIO(baseIO, invalidKey)
  ).rejects.toThrow("Encryption key must be 32 bytes");
});

test("throws when Web Crypto not available", async () => {
  const baseIO = createMemoryFileIO();
  const key = new Uint8Array(32);
  
  // Create a mock crypto object without subtle property
  const mockCryptoWithoutSubtle = {
    getRandomValues: (array: ArrayBufferView) => array,
    randomUUID: () => '00000000-0000-0000-0000-000000000000'
  };
  
  await expect(
    createEncryptedFileIO(baseIO, key, { crypto: mockCryptoWithoutSubtle as unknown as Crypto })
  ).rejects.toThrow("Web Crypto API is not available");
});

test("handles decryption errors", async () => {
  const baseIO = createMemoryFileIO();
  const key = new Uint8Array(32).fill(0x42);
  const io = await createEncryptedFileIO(baseIO, key);
  
  // Write invalid encrypted data directly to base storage
  await baseIO.write("corrupt.enc", new Uint8Array([1, 2, 3])); // Too short, no IV
  
  await expect(io.read("corrupt.enc")).rejects.toThrow("Invalid encrypted data");
});