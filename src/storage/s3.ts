/**
 * @file S3 storage adapter (presigned URL based)
 */
import type { FileIO } from "./types";

export type PresignedS3IOOptions = {
  resolveReadUrl: (key: string) => Promise<string> | string;
  resolveWriteUrl: (key: string) => Promise<string> | string;
  resolveDeleteUrl?: (key: string) => Promise<string> | string;
};

/** Placeholder S3 FileIO. Why: align path naming; real impl can be plugged. */
export function createS3FileIO(_opts: PresignedS3IOOptions): FileIO {
  void _opts;
  return {
    async read() { throw new Error("createS3FileIO: not implemented in this build"); },
    async write() { throw new Error("createS3FileIO: not implemented in this build"); },
    async append() { throw new Error("createS3FileIO: not implemented in this build"); },
    async atomicWrite() { throw new Error("createS3FileIO: not implemented in this build"); },
    async del() { /* noop */ },
  };
}
