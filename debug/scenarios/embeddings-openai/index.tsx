/**
 * @file Entry point for OpenAI embeddings scenario
 */

import { render } from "ink";
import React from "react";
import { App } from "./common";

export function runBruteforce() {
  render(<App strategy="bruteforce" />);
}

export function runHNSW() {
  render(<App strategy="hnsw" />);
}

export function runIVF() {
  render(<App strategy="ivf" />);
}
