/**
 * MessageItem Component
 *
 * Renders individual chat messages with appropriate styling
 * based on message type, handles code folding/expansion,
 * and displays apply buttons.
 *
 * This component is responsible for rendering a single message in the chat history.
 * It supports three types of messages: user, AI, and system messages, each with
 * different styling and functionality.
 */

import { IChatMessage } from '../state/types';
import { createElement, createButton } from '../utils/dom-utils';
import { ICONS } from '../utils/icons';

/**
 * Props for MessageItem component
 *
 * @property message - The chat message to render
 * @property onApplyCode - Optional callback when user clicks "Apply" button on AI messages
 */
export interface IMessageItemProps {
  /** The chat message to render */
  message: IChatMessage;

  /** Optional callback invoked when user applies code from an AI message */
  onApplyCode?: (code: string) => void;
}

/**
 * MessageItem component for rendering individual messages
 *
 * This is a stateless component that renders messages based on their sender type.
 * It provides different rendering for user messages, AI messages (with code folding
 * and apply buttons), and system messages (with type-based styling).
 *
 * @example
 * ```typescript
 * const messageElement = MessageItem.render({
 *   message: {
 *     id: '1',
 *     sender: 'user',
 *     content: 'Generate a plot',
 *     timestamp: new Date()
 *   }
 * });
 * container.appendChild(messageElement);
 * ```
 */
export class MessageItem {
  /**
   * Renders a message item based on the message sender type
   *
   * This is the main entry point for rendering messages. It delegates to
   * specific render methods based on the message sender.
   *
   * @param props - The message properties including the message and optional callback
   * @returns An HTMLElement containing the rendered message
   */
  static render(props: IMessageItemProps): HTMLElement {
    const { message, onApplyCode } = props;

    switch (message.sender) {
      case 'user':
        return this.renderUserMessage(message);
      case 'ai':
        return this.renderAIMessage(message, onApplyCode);
      case 'system':
        return this.renderSystemMessage(message);
      default:
        // Fallback for unknown sender types
        return this.renderSystemMessage(message);
    }
  }

  /**
   * Renders a user message
   *
   * User messages display with a user icon and a mode label (e.g., "编写代码", "错误修复").
   * The mode is inferred from the message content or defaults to "用户请求".
   *
   * @param message - The user message to render
   * @returns An HTMLElement containing the rendered user message
   */
  private static renderUserMessage(message: IChatMessage): HTMLElement {
    const msg = createElement(
      'div',
      'ai-sidebar-message ai-sidebar-message-user'
    );

    // User Header
    const header = createElement('div', 'ai-message-header');

    const label = createElement('div', 'ai-message-label');
    // Extract mode from message if available, otherwise default to "用户请求"
    const modeLabel = this.getModeLabel(message);
    label.innerHTML = `${ICONS.user} <span>${modeLabel}</span>`;
    header.appendChild(label);

    msg.appendChild(header);

    // User Content
    const content = createElement('div', 'ai-message-content');
    content.textContent = message.content;
    msg.appendChild(content);

    return msg;
  }

  /**
   * Renders an AI message with code folding and apply button
   *
   * AI messages can contain code that may be long. This method automatically
   * collapses code longer than 8 lines and provides a toggle button to expand/collapse.
   * If showApplyButton is true, an "Apply" button is displayed to insert the code.
   *
   * @param message - The AI message to render
   * @param onApply - Optional callback when user clicks the apply button
   * @returns An HTMLElement containing the rendered AI message
   */
  private static renderAIMessage(
    message: IChatMessage,
    onApply?: (code: string) => void
  ): HTMLElement {
    const msg = createElement(
      'div',
      'ai-sidebar-message ai-sidebar-message-ai'
    );

    // AI Header with Toolbar
    const header = createElement('div', 'ai-message-header');

    const label = createElement('div', 'ai-message-label');

    // Check if summary exists, use it as label; otherwise use default
    let labelText = message.summary || 'AI Suggestion';
    if (message.iteration) {
      labelText = `(尝试 ${message.iteration}) ${labelText}`;
    }

    label.innerHTML = `${ICONS.ai} <span>${labelText}</span>`;

    if (message.summary) {
      label.title = message.summary; // Add tooltip for long summaries
    }

    header.appendChild(label);

    const toolbar = createElement('div', 'ai-message-toolbar');
    header.appendChild(toolbar);

    msg.appendChild(header);

    // Content Area
    const content = createElement('div', 'ai-message-content ai-code-block');

    const text = message.content;
    const lines = text.split('\n');
    const shouldCollapse = lines.length > 5;

    if (shouldCollapse) {
      // Create collapsed version showing first 5 lines
      const collapsedText = lines.slice(0, 5).join('\n') + '\n...';
      content.textContent = collapsedText;
      content.classList.add('collapsed');

      // Toggle Button for expand/collapse
      const toggleBtn = createButton(
        'ai-toolbar-btn',
        ICONS.expand,
        '展开完整代码',
        () => {
          const isExpanded = !content.classList.contains('collapsed');

          if (isExpanded) {
            // Collapse
            content.textContent = collapsedText;
            content.classList.add('collapsed');
            toggleBtn.innerHTML = ICONS.expand;
            toggleBtn.title = '展开完整代码';
          } else {
            // Expand
            content.textContent = text;
            content.classList.remove('collapsed');
            toggleBtn.innerHTML = ICONS.collapse;
            toggleBtn.title = '收起代码';
          }
        }
      );

      toolbar.appendChild(toggleBtn);
    } else {
      // Short content, no need to collapse
      content.textContent = text;
    }

    // Apply Button (if requested)
    if (message.showApplyButton && onApply) {
      const applyBtn = createButton(
        'ai-toolbar-btn ai-btn-primary',
        ICONS.apply,
        '应用此代码',
        () => {
          // Remove "AI:\n" prefix if present
          const cleanedCode = text.replace(/^AI:\n/, '');
          onApply(cleanedCode);
        }
      );

      toolbar.appendChild(applyBtn);
    }

    msg.appendChild(content);

    // Detailed Summary
    if (message.detailedSummary) {
      const summaryDiv = createElement('div', 'ai-message-detailed-summary');
      summaryDiv.style.marginTop = '8px';
      summaryDiv.style.padding = '8px';
      summaryDiv.style.borderTop = '1px solid var(--jp-border-color2, #e0e0e0)';
      summaryDiv.style.whiteSpace = 'pre-wrap';
      summaryDiv.style.fontSize = '12px';
      summaryDiv.style.color = 'var(--jp-ui-font-color1, #555)';
      summaryDiv.textContent = message.detailedSummary;
      msg.appendChild(summaryDiv);
    }

    return msg;
  }

  /**
   * Renders a system message
   *
   * System messages are used for notifications, errors, warnings, and info messages.
   * They are styled differently based on the message type (error, success, info, etc.).
   *
   * @param message - The system message to render
   * @returns An HTMLElement containing the rendered system message
   */
  private static renderSystemMessage(message: IChatMessage): HTMLElement {
    const msg = createElement(
      'div',
      'ai-sidebar-message ai-sidebar-message-system'
    );

    // System messages show sender and content
    msg.innerHTML = `<strong>[${message.sender}]</strong> ${message.content}`;

    // Apply type-specific styling
    if (message.type === 'error') {
      msg.classList.add('error');
    } else if (message.type === 'success') {
      msg.classList.add('success');
    } else if (message.type === 'info') {
      msg.classList.add('info');
    } else if (message.type === 'warning') {
      msg.classList.add('warning');
    }

    return msg;
  }

  /**
   * Gets the mode label for a user message
   *
   * This helper method extracts or infers the mode label from the message.
   * The mode could be stored in message metadata or inferred from content.
   *
   * @param message - The message to get the mode label for
   * @returns A localized mode label string
   */
  private static getModeLabel(message: IChatMessage): string {
    // For now, we'll use a default label
    // In the future, this could be extended to extract mode from message metadata
    // or parse it from the message content
    return '用户请求';
  }
}
