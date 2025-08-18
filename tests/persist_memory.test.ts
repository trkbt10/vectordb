import { test, expect } from 'bun:test'
import { createMemoryFileIO } from '../src/persist/memory'

test('Memory FileIO write/read/append/atomicWrite', async () => {
  const io = createMemoryFileIO()
  await expect(io.read('nope')).rejects.toThrow()

  await io.write('snap', new Uint8Array([1, 2, 3]))
  const r1 = await io.read('snap')
  expect(Array.from(r1)).toEqual([1, 2, 3])

  await io.append('wal', new Uint8Array([10, 11]))
  await io.append('wal', new Uint8Array([12]))
  const rw = await io.read('wal')
  expect(Array.from(rw)).toEqual([10, 11, 12])

  await io.atomicWrite('snap', new Uint8Array([9]))
  const r2 = await io.read('snap')
  expect(Array.from(r2)).toEqual([9])
})
