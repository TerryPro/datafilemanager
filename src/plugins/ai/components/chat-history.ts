/**
 * ChatHistory Component
 *
 * Renders the chat message list, manages scrolling behavior,
 * and handles message addition animations.
 *
 * This component is responsible for displaying the conversation history
 * between the user and the AI assistant. It manages the list of messages,
 * handles automatic scrolling to show new messages, and provides methods
 * to add or clear messages.
 *
 * @example
 * ```typescript
 * const chatHistory = new ChatHistory({
 *   messages: [],
 *   onApplyCode: (code) => {
 *     // Insert code into notebook cell
 *     insertCodeIntoCell(code);
 *   }
 * });
 *
 * // Add a new message
 * chatHistory.addMessage({
 *   id: '1',
 *   sender: 'user',
 *   content: 'Generate a plot',
 *   timestamp: new Date()
 * });
 * ```
 */

import { Widget } from '@lumino/widgets';
import { IChatMessage } from '../state/types';
import { MessageItem } from './message-item';

/**
 * Props for ChatHistory component
 *
 * @property messages - Initial array of messages to display
 * @property onApplyCode - Optional callback invoked when user applies code from an AI message
 */
export interface IChatHistoryProps {
  /** Initial messages to display in the chat history */
  messages: IChatMessage[];

  /** Optional callback invoked when user clicks "Apply" on an AI message */
  onApplyCode?: (code: string) => void;
}

/**
 * ChatHistory component for displaying chat messages
 *
 * This component extends Lumino's Widget class to provide a scrollable
 * container for chat messages. It automatically scrolls to show new messages
 * and provides error handling to prevent crashes from malformed messages.
 *
 * The component uses MessageItem to render individual messages and maintains
 * a reference to the onApplyCode callback for passing to child components.
 */
export class ChatHistory extends Widget {
  /** Callback for applying code from AI messages */
  private onApplyCode?: (code: string) => void;

  /**
   * Creates a new ChatHistory widget
   *
   * Initializes the widget with a scrollable container and renders
   * any initial messages provided in the props.
   *
   * @param props - Configuration including initial messages and callbacks
   */
  constructor(props: IChatHistoryProps) {
    super();

    // Store the callback for later use
    this.onApplyCode = props.onApplyCode;

    // Add CSS class for styling
    this.addClass('ai-chat-history');

    // Make the container scrollable
    this.node.style.overflowY = 'auto';
    this.node.style.flex = '1';
    this.node.style.padding = '0';

    // Render initial messages if provided
    if (props.messages && props.messages.length > 0) {
      try {
        props.messages.forEach(message => {
          this.addMessage(message);
        });
      } catch (error) {
        console.error(
          '[ChatHistory] Failed to render initial messages:',
          error
        );
        this.showError('无法加载聊天历史');
      }
    }
  }

  /**
   * Adds a message to the chat history
   *
   * This method renders a new message and appends it to the chat history.
   * It automatically scrolls to the bottom to show the new message and
   * includes error handling to prevent crashes from malformed messages.
   *
   * @param message - The chat message to add
   *
   * @example
   * ```typescript
   * chatHistory.addMessage({
   *   id: '2',
   *   sender: 'ai',
   *   content: 'Here is your code...',
   *   timestamp: new Date(),
   *   showApplyButton: true
   * });
   * ```
   */
  addMessage(message: IChatMessage): void {
    try {
      // Create message element using MessageItem component
      const messageElement = MessageItem.render({
        message,
        onApplyCode: this.onApplyCode
      });

      // Append to the chat history
      this.node.appendChild(messageElement);

      // Scroll to show the new message
      this.scrollToBottom();
    } catch (error) {
      console.error('[ChatHistory] Failed to add message:', error);
      // Show error message instead of crashing
      this.showError('无法显示消息');
    }
  }

  /**
   * Clears all messages from the chat history
   *
   * This method removes all child elements from the chat history container,
   * effectively clearing the conversation. It includes error handling to
   * ensure the operation completes even if some elements fail to remove.
   *
   * @example
   * ```typescript
   * // Clear all messages
   * chatHistory.clear();
   * ```
   */
  clear(): void {
    try {
      // Remove all child elements
      while (this.node.firstChild) {
        this.node.removeChild(this.node.firstChild);
      }
    } catch (error) {
      console.error('[ChatHistory] Failed to clear messages:', error);
      // Try alternative approach
      try {
        this.node.innerHTML = '';
      } catch (innerError) {
        console.error(
          '[ChatHistory] Failed to clear using innerHTML:',
          innerError
        );
      }
    }
  }

  /**
   * Scrolls the chat history to the bottom
   *
   * This private method is called after adding a new message to ensure
   * the latest message is visible. It uses a small delay to ensure the
   * DOM has been updated before scrolling.
   *
   * The method is private because it's an internal implementation detail
   * and should not be called directly by external code.
   */
  private scrollToBottom(): void {
    try {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        this.node.scrollTop = this.node.scrollHeight;
      });
    } catch (error) {
      console.error('[ChatHistory] Failed to scroll to bottom:', error);
      // Non-critical error, don't show to user
    }
  }

  /**
   * Displays an error message in the chat history
   *
   * This private helper method is used internally to show error messages
   * when operations fail. It creates a simple error message element
   * without using the full MessageItem component to avoid potential
   * recursive errors.
   *
   * @param errorText - The error message to display
   */
  private showError(errorText: string): void {
    try {
      const errorElement = document.createElement('div');
      errorElement.className =
        'ai-sidebar-message ai-sidebar-message-system error';
      errorElement.innerHTML = `<strong>[错误]</strong> ${errorText}`;
      this.node.appendChild(errorElement);
      this.scrollToBottom();
    } catch (error) {
      // If we can't even show an error, just log it
      console.error('[ChatHistory] Failed to show error message:', error);
    }
  }
}
