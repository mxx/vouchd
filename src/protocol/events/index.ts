/**
 * The event shapes this app knows how to build.
 *
 * Deliberately a small subset of `buzz-sdk/src/builders.rs`, not a port of
 * it: NIP-07 signs any well-formed event regardless of shape, so there was
 * never a reason to mirror all ~50 Rust builders. Add one here when a
 * feature actually needs it, and confirm its kind number and tag layout
 * against the Rust source before you do — a guessed kind is a silent bug.
 */

export * from "./auth";
export * from "./authTag";
export * from "./channel";
export * from "./membership";
export * from "./presence";
export * from "./profile";
export * from "./types";
export * from "./validate";
