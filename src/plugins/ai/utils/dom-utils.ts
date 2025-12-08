/**
 * DOM Utility Functions
 *
 * Helper functions for creating and manipulating DOM elements in the AI sidebar.
 * These utilities provide a consistent API for DOM operations and reduce code duplication.
 */

import { ICONS, IconName } from './icons';

/**
 * Creates an HTML element with optional class name and inner HTML content.
 *
 * This is a type-safe wrapper around document.createElement that ensures
 * the returned element type matches the tag name.
 *
 * @template K - The HTML element tag name type
 * @param tag - The HTML tag name (e.g., 'div', 'span', 'button')
 * @param className - Optional CSS class name(s) to apply to the element
 * @param innerHTML - Optional HTML content to set as innerHTML
 * @returns The created HTML element with the specified tag type
 *
 * @example
 * ```typescript
 * // Create a div with a class
 * const container = createElement('div', 'my-container');
 *
 * // Create a span with class and content
 * const label = createElement('span', 'label', 'Hello World');
 *
 * // Create a button without class
 * const btn = createElement('button', undefined, 'Click me');
 * ```
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  innerHTML?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (innerHTML !== undefined) {
    element.innerHTML = innerHTML;
  }

  return element;
}

/**
 * Creates a button element with specified properties and click handler.
 *
 * This utility simplifies button creation by combining element creation,
 * styling, content, accessibility attributes, and event handling in one call.
 *
 * @param className - CSS class name(s) to apply to the button
 * @param innerHTML - HTML content to display inside the button (can include icons)
 * @param title - Tooltip text shown on hover (also used for accessibility)
 * @param onClick - Click event handler function
 * @returns The created button element with all properties configured
 *
 * @example
 * ```typescript
 * // Create a simple text button
 * const saveBtn = createButton(
 *   'save-button',
 *   'Save',
 *   'Save changes',
 *   () => console.log('Saved!')
 * );
 *
 * // Create a button with an icon
 * const deleteBtn = createButton(
 *   'delete-button',
 *   ICONS.trash,
 *   'Delete item',
 *   handleDelete
 * );
 * ```
 */
export function createButton(
  className: string,
  innerHTML: string,
  title: string,
  onClick: () => void
): HTMLButtonElement {
  const button = createElement('button', className, innerHTML);
  button.title = title;
  button.onclick = onClick;
  return button;
}

/**
 * Creates a span element containing an SVG icon.
 *
 * This utility wraps icon SVG markup in a span element for consistent
 * styling and positioning. The icon is selected from the centralized
 * ICONS constant to ensure consistency across the application.
 *
 * @param iconName - The name of the icon from the ICONS constant
 * @returns A span element containing the SVG icon markup
 *
 * @example
 * ```typescript
 * // Create a user icon
 * const userIcon = createIcon('user');
 *
 * // Create a trash icon
 * const trashIcon = createIcon('trash');
 *
 * // Add icon to a container
 * const container = createElement('div', 'icon-container');
 * container.appendChild(createIcon('ai'));
 * ```
 */
export function createIcon(iconName: IconName): HTMLSpanElement {
  const icon = createElement('span', 'icon', ICONS[iconName]);
  return icon;
}
