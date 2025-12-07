/**
 * Diff Utilities
 * 
 * Functions for computing and managing code diffs.
 */

import { DiffOp, DiffHunk, Decision } from '../state/types';

/**
 * Compute line-level diff operations between two texts using LCS (Longest Common Subsequence) algorithm
 * 
 * This function uses dynamic programming to find the longest common subsequence between
 * two arrays of lines, then generates a sequence of operations (add, delete, context)
 * that describe how to transform the old text into the new text.
 * 
 * @param oldLines - Array of lines from the old text
 * @param newLines - Array of lines from the new text
 * @returns Array of diff operations indicating additions, deletions, and context lines
 * 
 * @example
 * ```typescript
 * const oldLines = ['line1', 'line2', 'line3'];
 * const newLines = ['line1', 'line2 modified', 'line3'];
 * const ops = computeLineOps(oldLines, newLines);
 * // Returns: [
 * //   { type: 'ctx', text: 'line1' },
 * //   { type: 'del', text: 'line2' },
 * //   { type: 'add', text: 'line2 modified' },
 * //   { type: 'ctx', text: 'line3' }
 * // ]
 * ```
 */
export function computeLineOps(oldLines: string[], newLines: string[]): DiffOp[] {
  const n = oldLines.length;
  const m = newLines.length;
  
  // Build LCS dynamic programming table
  // dp[i][j] represents the length of LCS starting from position i in oldLines and j in newLines
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0)
  );
  
  // Fill the DP table from bottom-right to top-left
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  
  // Trace back through the DP table to generate diff operations
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      // Lines match - this is a context line
      ops.push({ type: 'ctx', text: newLines[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      // Deleting from old gives better LCS
      ops.push({ type: 'del', text: oldLines[i] });
      i++;
    } else {
      // Adding from new gives better LCS
      ops.push({ type: 'add', text: newLines[j] });
      j++;
    }
  }
  
  // Add remaining deletions from old
  while (i < n) {
    ops.push({ type: 'del', text: oldLines[i] });
    i++;
  }
  
  // Add remaining additions from new
  while (j < m) {
    ops.push({ type: 'add', text: newLines[j] });
    j++;
  }
  
  return ops;
}

/**
 * Group consecutive diff operations into hunks
 * 
 * A hunk is a contiguous block of add/delete operations. Context lines (ctx)
 * separate hunks. This function identifies all hunks in a sequence of diff operations.
 * 
 * @param ops - Array of diff operations
 * @returns Array of diff hunks with start and end indices
 * 
 * @example
 * ```typescript
 * const ops = [
 *   { type: 'ctx', text: 'line1' },
 *   { type: 'del', text: 'line2' },
 *   { type: 'add', text: 'line2 modified' },
 *   { type: 'ctx', text: 'line3' },
 *   { type: 'add', text: 'line4' }
 * ];
 * const hunks = groupIntoHunks(ops);
 * // Returns: [
 * //   { start: 1, end: 2 },  // del + add
 * //   { start: 4, end: 4 }   // add
 * // ]
 * ```
 */
export function groupIntoHunks(ops: DiffOp[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let i = 0;
  
  while (i < ops.length) {
    // Skip context lines
    if (ops[i].type === 'ctx') {
      i++;
      continue;
    }
    
    // Found start of a hunk
    const start = i;
    
    // Continue until we hit a context line or end of ops
    while (i < ops.length && ops[i].type !== 'ctx') {
      i++;
    }
    
    // Record the hunk (end is inclusive)
    const end = i - 1;
    hunks.push({ start, end });
  }
  
  return hunks;
}

/**
 * Build final text based on diff operations and user decisions for each hunk
 * 
 * This function reconstructs the final text by:
 * 1. Always including context lines
 * 2. For each hunk, applying the user's decision:
 *    - 'accept': Include additions, exclude deletions (apply the change)
 *    - 'reject': Include deletions, exclude additions (keep the original)
 * 
 * @param ops - Array of diff operations
 * @param decisions - Array of user decisions for each hunk (not each operation)
 * @returns The final merged text as a string
 * 
 * @example
 * ```typescript
 * const ops = [
 *   { type: 'ctx', text: 'line1' },
 *   { type: 'del', text: 'line2' },
 *   { type: 'add', text: 'line2 modified' },
 *   { type: 'ctx', text: 'line3' }
 * ];
 * const decisions = ['accept']; // One decision for the one hunk
 * const result = buildTextFromDecisions(ops, decisions);
 * // Returns: "line1\nline2 modified\nline3"
 * 
 * const decisions2 = ['reject'];
 * const result2 = buildTextFromDecisions(ops, decisions2);
 * // Returns: "line1\nline2\nline3"
 * ```
 */
export function buildTextFromDecisions(ops: DiffOp[], decisions: Decision[]): string {
  const result: string[] = [];
  let i = 0;
  let hunkIndex = 0;
  
  while (i < ops.length) {
    // Always include context lines
    if (ops[i].type === 'ctx') {
      result.push(ops[i].text);
      i++;
      continue;
    }
    
    // Found a hunk - process all operations in this hunk
    const start = i;
    while (i < ops.length && ops[i].type !== 'ctx') {
      i++;
    }
    const end = i - 1;
    
    // Get the decision for this hunk (default to 'accept' if not provided)
    const decision = decisions[hunkIndex] ?? 'accept';
    
    if (decision === 'accept') {
      // Accept the change: include additions, exclude deletions
      for (let k = start; k <= end; k++) {
        if (ops[k].type === 'add') {
          result.push(ops[k].text);
        }
      }
    } else {
      // Reject the change: include deletions, exclude additions
      for (let k = start; k <= end; k++) {
        if (ops[k].type === 'del') {
          result.push(ops[k].text);
        }
      }
    }
    
    hunkIndex++;
  }
  
  return result.join('\n');
}
