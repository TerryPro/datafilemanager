/**
 * PromptSelector Component
 *
 * Displays algorithm prompt library,
 * handles algorithm selection,
 * and manages popup show/hide.
 */

import { Widget } from '@lumino/widgets';
import { IAlgorithmInfo } from '../state/types';
import { AiService } from '../../../services/ai-service';
import { LibraryService } from '../../../services/library-service';
import { ICONS } from '../utils/icons';

/**
 * Props for PromptSelector component
 */
export interface IPromptSelectorProps {
  /** AI service instance for fetching algorithm prompts */
  aiService: AiService;
  libraryService: LibraryService;

  /** Callback when an algorithm is selected */
  onSelect: (algorithm: IAlgorithmInfo) => void;
}

/**
 * PromptSelector component for selecting algorithm prompts
 *
 * This component displays a popup with available algorithm templates
 * organized by category. Users can select an algorithm to insert
 * it into their prompt.
 *
 * @example
 * ```typescript
 * const selector = new PromptSelector({
 *   aiService: aiServiceInstance,
 *   onSelect: (algorithm) => {
 *     console.log('Selected:', algorithm.name);
 *   }
 * });
 * selector.toggle(); // Show the popup
 * ```
 */
export class PromptSelector extends Widget {
  private popup: HTMLElement;
  private _isVisible = false;
  private props: IPromptSelectorProps;

  /**
   * Creates a new PromptSelector instance
   *
   * @param props - Component properties
   */
  constructor(props: IPromptSelectorProps) {
    super();
    this.props = props;
    this.addClass('ai-prompt-selector');

    // Create popup element
    this.popup = document.createElement('div');
    this.popup.className = 'ai-variable-popup';
    this.node.appendChild(this.popup);
  }

  /**
   * Toggle the visibility of the selector popup
   *
   * If the popup is currently hidden, it will be shown and prompts
   * will be loaded. If it's visible, it will be hidden.
   */
  toggle(): void {
    this._isVisible = !this._isVisible;

    if (this._isVisible) {
      this.popup.classList.add('visible');
      this.loadPrompts().catch(error => {
        console.error('[PromptSelector] Failed to load prompts:', error);
      });
    } else {
      this.popup.classList.remove('visible');
    }
  }

  /**
   * Hide the selector popup
   *
   * This method explicitly hides the popup without toggling.
   */
  hide(): void {
    this._isVisible = false;
    this.popup.classList.remove('visible');
  }

  /**
   * Load algorithm prompts from the AI service
   *
   * This method fetches algorithm templates from the backend
   * and renders them in the popup grouped by category.
   * It handles loading states and errors.
   *
   * @private
   */
  private async loadPrompts(): Promise<void> {
    // Show loading state
    this.popup.innerHTML =
      '<div class="ai-variable-loading">加载提示词库...</div>';

    try {
      // Fetch prompts from the library service
      const prompts = await this.props.libraryService.getAlgorithmPrompts();

      // Render the prompts
      this.renderPrompts(prompts);
    } catch (error) {
      // Show error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.popup.innerHTML = `<div class="ai-variable-empty">加载失败: ${errorMessage}</div>`;
      console.error('[PromptSelector] Error loading prompts:', error);
    }
  }

  /**
   * Render the list of algorithm prompts in the popup
   *
   * Creates a categorized list of algorithm templates. Each category
   * is displayed with a header, followed by clickable algorithm items.
   *
   * @param prompts - Object containing algorithm prompts grouped by category
   * @private
   */
  private renderPrompts(prompts: Record<string, any>): void {
    // Clear popup content
    this.popup.innerHTML = '';

    // Handle empty state
    if (!prompts || Object.keys(prompts).length === 0) {
      this.popup.innerHTML = '<div class="ai-variable-empty">暂无提示词</div>';
      return;
    }

    // Iterate through each category
    Object.keys(prompts).forEach(key => {
      const category = prompts[key];

      // Create category header
      const catHeader = document.createElement('div');
      catHeader.className = 'ai-prompt-category';
      catHeader.textContent = category.label;
      this.popup.appendChild(catHeader);

      // Check if category has algorithms
      if (!category.algorithms || category.algorithms.length === 0) {
        return;
      }

      // Create algorithm items for this category
      category.algorithms.forEach((algo: any) => {
        const item = document.createElement('div');
        item.className = 'ai-variable-item';

        // Create icon
        const icon = document.createElement('span');
        icon.className = 'variable-icon';
        icon.innerHTML = ICONS.library;

        // Create name label
        const name = document.createElement('span');
        name.className = 'variable-name';
        name.textContent = algo.name;

        // Assemble item
        item.appendChild(icon);
        item.appendChild(name);

        // Handle click
        item.onclick = () => {
          try {
            // Create AlgorithmInfo object
            const algorithmInfo: IAlgorithmInfo = {
              id: algo.id || key,
              name: algo.name,
              category: category.label || key,
              params: algo.params,
              expectedOutput: algo.expectedOutput,
              prompt: algo.prompt
            };

            // Call the onSelect callback
            this.props.onSelect(algorithmInfo);

            // Hide the popup
            this.hide();
          } catch (error) {
            console.error('[PromptSelector] Error selecting algorithm:', error);
          }
        };

        this.popup.appendChild(item);
      });
    });
  }
}
