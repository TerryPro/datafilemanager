/**
 * SelectionBar Component
 * 
 * Displays selected variables and algorithms as chips with clear buttons.
 * This component provides a visual representation of the current selections
 * and allows users to clear them individually.
 * 
 * @example
 * ```typescript
 * const selectionBar = new SelectionBar({
 *   selectedVariable: { name: 'df', type: 'DataFrame', shape: [100, 5] },
 *   selectedAlgorithm: { id: 'linear-regression', name: 'Linear Regression', category: 'Regression' },
 *   onClearVariable: () => console.log('Variable cleared'),
 *   onClearAlgorithm: () => console.log('Algorithm cleared')
 * });
 * ```
 */

import { Widget } from '@lumino/widgets';
import { VariableInfo, AlgorithmInfo } from '../state/types';
import { createElement, createButton } from '../utils/dom-utils';
import { ICONS } from '../utils/icons';

/**
 * Props for SelectionBar component
 * 
 * @property selectedVariable - Currently selected DataFrame variable (optional)
 * @property selectedAlgorithm - Currently selected algorithm template (optional)
 * @property onClearVariable - Callback invoked when variable clear button is clicked
 * @property onClearAlgorithm - Callback invoked when algorithm clear button is clicked
 */
export interface SelectionBarProps {
  /** Currently selected variable information */
  selectedVariable?: VariableInfo;
  
  /** Currently selected algorithm information */
  selectedAlgorithm?: AlgorithmInfo;
  
  /** Callback to clear the selected variable */
  onClearVariable: () => void;
  
  /** Callback to clear the selected algorithm */
  onClearAlgorithm: () => void;
}

/**
 * SelectionBar component for displaying selected variables and algorithms
 * 
 * This component renders two chips:
 * 1. Variable chip - displays the selected DataFrame variable with a table icon
 * 2. Algorithm chip - displays the selected algorithm with a library icon
 * 
 * Each chip includes:
 * - An icon representing the type (table for variables, library for algorithms)
 * - A label showing the name of the selection
 * - A clear button (×) to remove the selection
 * 
 * The component automatically updates when props change via the updateProps method.
 */
export class SelectionBar extends Widget {
  private props: SelectionBarProps;
  private variableChip: HTMLDivElement;
  private algorithmChip: HTMLDivElement;
  private variableLabel!: HTMLSpanElement;
  private algorithmLabel!: HTMLSpanElement;

  /**
   * Creates a new SelectionBar instance
   * 
   * @param props - Initial properties for the selection bar
   */
  constructor(props: SelectionBarProps) {
    super();
    this.props = props;
    this.addClass('ai-selection-bar');
    
    // Create variable chip (this initializes variableLabel)
    this.variableChip = this.createVariableChip();
    
    // Create algorithm chip (this initializes algorithmLabel)
    this.algorithmChip = this.createAlgorithmChip();
    
    // Add chips to the widget
    this.node.appendChild(this.variableChip);
    this.node.appendChild(this.algorithmChip);
    
    // Initial update to reflect current props
    this.updateDisplay();
  }

  /**
   * Creates the variable selection chip
   * 
   * @returns The variable chip element with icon, label, and clear button
   * @private
   */
  private createVariableChip(): HTMLDivElement {
    const chip = createElement('div', 'ai-selection-chip');
    
    // Icon
    const icon = createElement('span', 'ai-chip-icon', ICONS.table);
    chip.appendChild(icon);
    
    // Label
    this.variableLabel = createElement('span', 'ai-chip-label');
    chip.appendChild(this.variableLabel);
    
    // Clear button
    const clearBtn = createButton(
      'ai-chip-clear',
      '×',
      '清除已选变量',
      () => this.props.onClearVariable()
    );
    chip.appendChild(clearBtn);
    
    return chip;
  }

  /**
   * Creates the algorithm selection chip
   * 
   * @returns The algorithm chip element with icon, label, and clear button
   * @private
   */
  private createAlgorithmChip(): HTMLDivElement {
    const chip = createElement('div', 'ai-selection-chip');
    
    // Icon
    const icon = createElement('span', 'ai-chip-icon', ICONS.library);
    chip.appendChild(icon);
    
    // Label
    this.algorithmLabel = createElement('span', 'ai-chip-label');
    chip.appendChild(this.algorithmLabel);
    
    // Clear button
    const clearBtn = createButton(
      'ai-chip-clear',
      '×',
      '清除已选算法',
      () => this.props.onClearAlgorithm()
    );
    chip.appendChild(clearBtn);
    
    return chip;
  }

  /**
   * Updates the display to reflect current props
   * 
   * Sets the label text for variable and algorithm chips based on
   * whether selections exist. Shows "未选择变量" or "未选择算法"
   * when no selection is present.
   * 
   * @private
   */
  private updateDisplay(): void {
    // Update variable label
    if (this.variableLabel) {
      this.variableLabel.textContent = 
        this.props.selectedVariable?.name ?? '未选择变量';
    }
    
    // Update algorithm label
    if (this.algorithmLabel) {
      this.algorithmLabel.textContent = 
        this.props.selectedAlgorithm?.name ?? '未选择算法';
    }
  }

  /**
   * Updates the selection bar with new props
   * 
   * This method allows partial updates to the component's props.
   * Only the provided properties will be updated, while others
   * remain unchanged. After updating props, the display is
   * automatically refreshed.
   * 
   * @param props - Partial props to update
   * 
   * @example
   * ```typescript
   * // Update only the selected variable
   * selectionBar.updateProps({
   *   selectedVariable: { name: 'new_df', type: 'DataFrame', shape: [200, 10] }
   * });
   * 
   * // Clear the algorithm selection
   * selectionBar.updateProps({
   *   selectedAlgorithm: undefined
   * });
   * ```
   */
  updateProps(props: Partial<SelectionBarProps>): void {
    // Merge new props with existing props
    this.props = { ...this.props, ...props };
    
    // Update the display to reflect new props
    this.updateDisplay();
  }
}
