/**
 * Type definitions for AI Sidebar components
 *
 * This file contains all shared type definitions used across the AI sidebar
 * refactoring, including variable info, algorithm info, chat messages, and diff operations.
 */

/**
 * Information about a DataFrame variable available in the notebook
 */
export interface IVariableInfo {
  /** Variable name as it appears in the notebook */
  name: string;

  /** Type of the variable (e.g., 'DataFrame', 'Series') */
  type: string;

  /** Shape of the DataFrame as [rows, columns] */
  shape: [number, number];

  /** Optional description of the variable */
  description?: string;
}

/**
 * Information about an algorithm template from the prompt library
 */
export interface IAlgorithmInfo {
  /** Unique identifier for the algorithm */
  id: string;

  /** Display name of the algorithm */
  name: string;

  /** Category the algorithm belongs to (e.g., 'Classification', 'Regression') */
  category: string;

  /** Optional parameters for the algorithm */
  params?: Record<string, any>;

  /** Expected output description */
  expectedOutput?: string;

  /** Prompt template for the algorithm */
  prompt?: string;
}

/**
 * A single chat message in the conversation history
 */
export interface IChatMessage {
  /** Unique identifier for the message */
  id: string;

  /** Who sent the message */
  sender: 'user' | 'ai' | 'system';

  /** Content of the message */
  content: string;

  /** Type of message for styling purposes */
  type?: 'normal' | 'error' | 'warning' | 'success' | 'info';

  /** When the message was created */
  timestamp: Date;

  /** Whether to show an "Apply" button for this message */
  showApplyButton?: boolean;

  /** Optional summary of the action performed */
  summary?: string;

  /** Optional detailed technical summary (Markdown) */
  detailedSummary?: string;
}

/**
 * Code generation mode
 */
export type GenerateMode = 'create' | 'fix' | 'refactor' | 'explain';

/**
 * A single diff operation representing a line change
 */
export interface IDiffOp {
  /** Type of operation: add, delete, or context */
  type: 'add' | 'del' | 'ctx';

  /** The text content of the line */
  text: string;
}

/**
 * A contiguous block of diff operations
 */
export interface IDiffHunk {
  /** Starting index in the diff operations array */
  start: number;

  /** Ending index in the diff operations array */
  end: number;
}

/**
 * User decision for a diff hunk
 */
export type Decision = 'accept' | 'reject';
