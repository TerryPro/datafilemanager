/**
 * VariableSelector Component
 * 
 * Displays available DataFrame variables list,
 * handles variable selection,
 * and manages popup show/hide.
 */

import { Widget } from '@lumino/widgets';
import { INotebookTracker } from '@jupyterlab/notebook';
import { VariableInfo } from '../state/types';
import { AiService } from '../../../services/ai-service';
import { ICONS } from '../utils/icons';

/**
 * Props for VariableSelector component
 */
export interface VariableSelectorProps {
  /** Notebook tracker to access current notebook */
  tracker: INotebookTracker;
  
  /** AI service instance for fetching variable information */
  aiService: AiService;
  
  /** Callback when a variable is selected */
  onSelect: (variable: VariableInfo) => void;
}

/**
 * VariableSelector component for selecting variables
 * 
 * This component displays a popup with available DataFrame variables
 * from the current notebook. Users can select a variable to insert
 * it into their prompt.
 * 
 * @example
 * ```typescript
 * const selector = new VariableSelector({
 *   tracker: notebookTracker,
 *   aiService: aiServiceInstance,
 *   onSelect: (variable) => {
 *     console.log('Selected:', variable.name);
 *   }
 * });
 * selector.toggle(); // Show the popup
 * ```
 */
export class VariableSelector extends Widget {
  private popup: HTMLElement;
  private _isVisible: boolean = false;
  private props: VariableSelectorProps;

  /**
   * Creates a new VariableSelector instance
   * 
   * @param props - Component properties
   */
  constructor(props: VariableSelectorProps) {
    super();
    this.props = props;
    this.addClass('ai-variable-selector');
    
    // Create popup element
    this.popup = document.createElement('div');
    this.popup.className = 'ai-variable-popup';
    this.node.appendChild(this.popup);
  }

  /**
   * Toggle the visibility of the selector popup
   * 
   * If the popup is currently hidden, it will be shown and variables
   * will be loaded. If it's visible, it will be hidden.
   */
  toggle(): void {
    this._isVisible = !this._isVisible;
    
    if (this._isVisible) {
      this.popup.classList.add('visible');
      this.loadVariables().catch(error => {
        console.error('[VariableSelector] Failed to load variables:', error);
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
   * Load variables from the current notebook
   * 
   * This method fetches DataFrame variables from the notebook kernel
   * and renders them in the popup. It handles loading states and errors.
   * 
   * @private
   */
  private async loadVariables(): Promise<void> {
    // Show loading state
    this.popup.innerHTML = '<div class="ai-variable-loading">加载变量中...</div>';

    // Get current notebook panel
    const panel = this.props.tracker.currentWidget;
    if (!panel) {
      this.popup.innerHTML = '<div class="ai-variable-empty">未检测到 Notebook</div>';
      return;
    }

    try {
      // Fetch variables from the kernel
      const variables = await this.props.aiService.getDataFrameInfo(panel);
      
      // Render the variables
      this.renderVariables(variables);
    } catch (error) {
      // Show error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.popup.innerHTML = `<div class="ai-variable-empty">加载失败: ${errorMessage}</div>`;
      console.error('[VariableSelector] Error loading variables:', error);
    }
  }

  /**
   * Render the list of variables in the popup
   * 
   * Creates a list of clickable variable items. Each item shows the
   * variable name, icon, and shape information.
   * 
   * @param variables - Array of variable information objects
   * @private
   */
  private renderVariables(variables: any[]): void {
    // Clear popup content
    this.popup.innerHTML = '';

    // Handle empty state
    if (variables.length === 0) {
      this.popup.innerHTML = '<div class="ai-variable-empty">无可用 DataFrame</div>';
      return;
    }

    // Create variable items
    variables.forEach(v => {
      const item = document.createElement('div');
      item.className = 'ai-variable-item';

      // Create icon
      const icon = document.createElement('span');
      icon.className = 'variable-icon';
      icon.innerHTML = ICONS.table;

      // Create name label
      const name = document.createElement('span');
      name.className = 'variable-name';
      name.textContent = v.name;

      // Create info label (shape)
      const info = document.createElement('span');
      info.className = 'variable-info';
      info.textContent = `${v.shape[0]}x${v.shape[1]}`;

      // Assemble item
      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(info);

      // Handle click
      item.onclick = () => {
        try {
          // Create VariableInfo object with description
          const variableInfo: VariableInfo = {
            name: v.name,
            type: v.type,
            shape: v.shape,
            description: this.props.aiService.describeVariable(v)
          };

          // Call the onSelect callback
          this.props.onSelect(variableInfo);

          // Hide the popup
          this.hide();
        } catch (error) {
          console.error('[VariableSelector] Error selecting variable:', error);
        }
      };

      this.popup.appendChild(item);
    });
  }
}
