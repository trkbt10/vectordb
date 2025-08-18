export interface FileIO {
  read(path: string): Promise<Uint8Array>
  write(path: string, data: Uint8Array | ArrayBuffer): Promise<void>
  append(path: string, data: Uint8Array | ArrayBuffer): Promise<void>
  atomicWrite(path: string, data: Uint8Array | ArrayBuffer): Promise<void>
}

export function toUint8(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

