/**
 * @file WAL specific error types for clearer diagnostics
 * Rationale: Error classes are idiomatic and improve instanceof checks and
 * stack traces. Suppress the linter rule discouraging classes in this file.
 */
/* eslint-disable no-restricted-syntax -- Error classes are idiomatic for exceptions and enable instanceof checks */
/** Thrown when WAL buffer is shorter than the header size. */
export class WalTooShortError extends Error {
  constructor() {
    super("wal too short");
    this.name = "WalTooShortError";
  }
}

/** Thrown when a concatenated WAL segment header is truncated. */
export class WalHeaderTruncatedError extends Error {
  constructor() {
    super("truncated wal header");
    this.name = "WalHeaderTruncatedError";
  }
}

/** Thrown when WAL magic does not match the expected constant. */
export class WalBadMagicError extends Error {
  constructor() {
    super("bad wal magic");
    this.name = "WalBadMagicError";
  }
}

/** Thrown when WAL version is not supported by this decoder. */
export class WalUnsupportedVersionError extends Error {
  constructor() {
    super("unsupported wal version");
    this.name = "WalUnsupportedVersionError";
  }
}

/** Thrown when a record's meta or vector block overflows available bytes. */
export class WalTruncatedRecordError extends Error {
  constructor(part: "meta" | "vector") {
    super(`truncated wal record: ${part} block`);
    this.name = "WalTruncatedRecordError";
  }
}

/** Thrown when a record type is unknown or missing vector for upsert. */
export class WalDecodeError extends Error {
  constructor() {
    super("wal decode error: unknown type or missing vector");
    this.name = "WalDecodeError";
  }
}
