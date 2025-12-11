/**
 * InputPanel Component
 *
 * Manages the text input area, toolbar buttons, and selection bar.
 * This component integrates VariableSelector, PromptSelector, and SelectionBar
 * to provide a complete input interface for the AI assistant.
 *
 * @example
 * ```typescript
 * const inputPanel = new InputPanel({
 *   onGenerate: (intent) => console.log('Generate:', intent),
 *   onVariableSelect: (variable) => console.log('Variable:', variable.name),
 *   onAlgorithmSelect: (algorithm) => console.log('Algorithm:', algorithm.name),
 *   isGenerating: false
 * });
 * ```
 */

import { Widget } from '@lumino/widgets';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IVariableInfo, IAlgorithmInfo } from '../state/types';
import { AiService } from '../../../services/ai-service';
import { LibraryService } from '../../../services/library-service';
import { createElement, createButton } from '../utils/dom-utils';
import { ICONS } from '../utils/icons';
import { SelectionBar } from './selection-bar';
import { VariableSelector } from './variable-selector';
import { PromptSelector } from './prompt-selector';
import { ModelSelector } from './model-selector';

/**
 * Props for InputPanel component
 *
 * @property onGenerate - Callback invoked when the execute button is clicked
 * @property onVariableSelect - Callback invoked when a variable is selected
 * @property onAlgorithmSelect - Callback invoked when an algorithm is selected
 * @property selectedVariable - Currently selected variable (optional)
 * @property selectedAlgorithm - Currently selected algorithm (optional)
 * @property isGenerating - Whether code generation is in progress
 * @property tracker - Notebook tracker for accessing current notebook
 * @property aiService - AI service instance for API calls
 */
export interface IInputPanelProps {
  /** Callback when generate button is clicked */
  onGenerate: (intent: string) => void;

  /** Callback when a variable is selected */
  onVariableSelect: (variable: IVariableInfo) => void;

  /** Callback when an algorithm is selected */
  onAlgorithmSelect: (algorithm: IAlgorithmInfo) => void;

  /** Currently selected variable */
  selectedVariable?: IVariableInfo;

  /** Currently selected algorithm */
  selectedAlgorithm?: IAlgorithmInfo;

  /** Whether code generation is in progress */
  isGenerating: boolean;

  /** Notebook tracker */
  tracker: INotebookTracker;

  /** AI service instance */
  aiService: AiService;

  /** Library service instance */
  libraryService: LibraryService;
}

/**
 * InputPanel component for user input and controls
 *
 * This component provides:
 * - A text area for entering prompts
 * - A toolbar with buttons for:
 *   - Variable selection (@)
 *   - Algorithm/prompt selection (library)
 *   - Mode selection (create, fix, refactor, explain)
 *   - Clear input and selections
 *   - Execute/generate code
 * - A selection bar showing current variable and algorithm selections
 * - Integration with VariableSelector and PromptSelector popups
 *
 * The component manages the state of the input text, mode selection,
 * and coordinates between the various sub-components.
 */
export class InputPanel extends Widget {
  private props: IInputPanelProps;
  private textarea: HTMLTextAreaElement;
  private modeSelect!: HTMLSelectElement;
  private workflowSelect!: HTMLSelectElement;
  private contextCheckbox!: HTMLInputElement;
  private executeBtn!: HTMLButtonElement;
  private clearInputBtn!: HTMLButtonElement;
  private variableBtn!: HTMLButtonElement;
  private promptBtn!: HTMLButtonElement;
  private selectionBarWidget: SelectionBar;
  private variableSelectorWidget!: VariableSelector;
  private promptSelectorWidget!: PromptSelector;
  private modelSelectorWidget!: ModelSelector;

  /**
   * Creates a new InputPanel instance
   *
   * @param props - Component properties
   */
  constructor(props: IInputPanelProps) {
    super();
    this.props = props;
    this.addClass('ai-sidebar-input-container');

    // Create the main input container
    const inputContainer = createElement('div', 'ai-sidebar-input-container');

    // Create text area
    this.textarea = this.createTextArea();
    inputContainer.appendChild(this.textarea);

    // Create toolbar
    const toolbar = this.createToolbar();
    inputContainer.appendChild(toolbar);

    // Add input container to widget
    this.node.appendChild(inputContainer);

    // Create and add selection bar
    this.selectionBarWidget = new SelectionBar({
      selectedVariable: this.props.selectedVariable,
      selectedAlgorithm: this.props.selectedAlgorithm,
      onClearVariable: () => this.handleClearVariable(),
      onClearAlgorithm: () => this.handleClearAlgorithm()
    });
    this.node.appendChild(this.selectionBarWidget.node);

    // Setup global click handler to close popups
    this.setupGlobalClickHandler();
  }

  /**
   * Creates the text area for prompt input
   *
   * @returns The textarea element
   * @private
   */
  private createTextArea(): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.className = 'jp-mod-styled ai-sidebar-intent-input';
    textarea.rows = 4;
    textarea.placeholder = '输入您的需求...';
    return textarea;
  }

  /**
   * Creates the toolbar with all control buttons
   *
   * @returns The toolbar element
   * @private
   */
  private createToolbar(): HTMLDivElement {
    const toolbar = createElement('div', 'ai-sidebar-toolbar');

    // Model Selector
    this.modelSelectorWidget = new ModelSelector({
      aiService: this.props.aiService
    });
    toolbar.appendChild(this.modelSelectorWidget.node);

    // Variable button (@)
    this.variableBtn = createButton(
      'ai-sidebar-toolbar-btn',
      ICONS.at,
      '引用变量 (@)',
      () => this.variableSelectorWidget.toggle()
    );
    this.variableBtn.addEventListener('click', e => e.stopPropagation());
    toolbar.appendChild(this.variableBtn);

    // Prompt library button
    this.promptBtn = createButton(
      'ai-sidebar-toolbar-btn',
      ICONS.library,
      '提示词库',
      () => this.promptSelectorWidget.toggle()
    );
    this.promptBtn.addEventListener('click', e => e.stopPropagation());
    toolbar.appendChild(this.promptBtn);

    // Mode select wrapper
    const selectWrapper = createElement('div', 'ai-sidebar-select-wrapper');

    // Workflow select dropdown
    this.workflowSelect = this.createWorkflowSelect();
    selectWrapper.appendChild(this.workflowSelect);

    // Mode select dropdown
    this.modeSelect = this.createModeSelect();
    selectWrapper.appendChild(this.modeSelect);

    // Create VariableSelector component
    this.variableSelectorWidget = new VariableSelector({
      tracker: this.props.tracker,
      aiService: this.props.aiService,
      onSelect: variable => this.handleVariableSelect(variable)
    });
    selectWrapper.appendChild(this.variableSelectorWidget.node);

    // Create PromptSelector component
    this.promptSelectorWidget = new PromptSelector({
      aiService: this.props.aiService,
      libraryService: this.props.libraryService,
      onSelect: algorithm => this.handleAlgorithmSelect(algorithm)
    });
    selectWrapper.appendChild(this.promptSelectorWidget.node);

    toolbar.appendChild(selectWrapper);

    // Clear input & selections button
    this.clearInputBtn = createButton(
      'ai-sidebar-toolbar-btn',
      ICONS.clear,
      '清空输入并清除选择',
      () => this.clear()
    );
    this.clearInputBtn.addEventListener('click', e => e.stopPropagation());
    toolbar.appendChild(this.clearInputBtn);

    // Context Checkbox Wrapper
    const contextWrapper = createElement('div', 'ai-sidebar-context-wrapper');
    contextWrapper.style.display = 'flex';
    contextWrapper.style.alignItems = 'center';
    contextWrapper.style.marginRight = '4px';
    contextWrapper.title = '是否包含上下文信息';

    this.contextCheckbox = document.createElement('input');
    this.contextCheckbox.type = 'checkbox';
    this.contextCheckbox.id = 'ai-sidebar-context-check';
    this.contextCheckbox.checked = false; // Default to false as per requirement implication (user chooses) or based on previous behavior
    const contextLabel = document.createElement('label');
    contextLabel.htmlFor = 'ai-sidebar-context-check';
    contextLabel.textContent = '上下文';
    contextLabel.style.fontSize = '10px';
    contextLabel.style.marginLeft = '2px';
    contextLabel.style.cursor = 'pointer';

    contextWrapper.appendChild(this.contextCheckbox);
    contextWrapper.appendChild(contextLabel);
    toolbar.appendChild(contextWrapper);

    // Execute button
    this.executeBtn = createButton(
      'ai-sidebar-execute-btn',
      ICONS.run,
      '生成',
      () => this.handleExecute()
    );
    toolbar.appendChild(this.executeBtn);

    return toolbar;
  }

  /**
   * Creates the workflow selection dropdown
   *
   * @returns The select element
   * @private
   */
  private createWorkflowSelect(): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'ai-sidebar-mode-select'; // Reuse same class for styling
    select.style.marginRight = '4px';
    select.style.width = 'auto'; // Auto width for shorter content

    const workflows = [
      { value: 'chat', label: 'Chat' },
      { value: 'build', label: 'Build' }
    ];

    workflows.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.value;
      opt.textContent = w.label;
      select.appendChild(opt);
    });

    return select;
  }

  /**
   * Creates the mode selection dropdown
   *
   * @returns The select element
   * @private
   */
  private createModeSelect(): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'ai-sidebar-mode-select';

    const modes = [
      { value: 'create', label: '编写代码' },
      { value: 'fix', label: '错误修复' },
      { value: 'refactor', label: '代码完善' },
      { value: 'explain', label: '编写说明' }
    ];

    modes.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
      select.appendChild(opt);
    });

    return select;
  }

  /**
   * Sets up global click handler to close popups when clicking outside
   *
   * @private
   */
  private setupGlobalClickHandler(): void {
    document.addEventListener('click', e => {
      // Close variable selector if clicking outside
      if (
        !this.variableSelectorWidget.node.contains(e.target as Node) &&
        e.target !== this.variableBtn
      ) {
        this.variableSelectorWidget.hide();
      }

      // Close prompt selector if clicking outside
      if (
        !this.promptSelectorWidget.node.contains(e.target as Node) &&
        e.target !== this.promptBtn
      ) {
        this.promptSelectorWidget.hide();
      }
    });
  }

  /**
   * Handles variable selection
   *
   * @param variable - The selected variable
   * @private
   */
  private handleVariableSelect(variable: IVariableInfo): void {
    // Insert variable name into textarea
    this.insertVariable(variable.name);

    // Notify parent component (parent will call updateProps to update selection bar)
    this.props.onVariableSelect(variable);
  }

  /**
   * Handles algorithm selection
   *
   * @param algorithm - The selected algorithm
   * @private
   */
  private handleAlgorithmSelect(algorithm: IAlgorithmInfo): void {
    // Notify parent component (parent will call updateProps to update selection bar)
    this.props.onAlgorithmSelect(algorithm);
  }

  /**
   * Handles clearing the selected variable
   *
   * @private
   */
  private handleClearVariable(): void {
    // Notify parent component (parent will call updateProps to update selection bar)
    this.props.onVariableSelect(undefined as any);
  }

  /**
   * Handles clearing the selected algorithm
   *
   * @private
   */
  private handleClearAlgorithm(): void {
    // Notify parent component (parent will call updateProps to update selection bar)
    this.props.onAlgorithmSelect(undefined as any);
  }

  /**
   * Handles execute button click
   *
   * @private
   */
  private handleExecute(): void {
    const intent = this.textarea.value.trim();
    this.props.onGenerate(intent);
  }

  /**
   * Inserts a variable name into the textarea at cursor position
   *
   * @param name - The variable name to insert
   * @private
   */
  private insertVariable(name: string): void {
    const cursorPos = this.textarea.selectionStart;
    const textBefore = this.textarea.value.substring(0, cursorPos);
    const textAfter = this.textarea.value.substring(cursorPos);

    // Insert variable name with a space after it
    this.textarea.value = textBefore + name + ' ' + textAfter;

    // Set cursor position after the inserted text
    this.textarea.focus();
    this.textarea.setSelectionRange(
      cursorPos + name.length + 1,
      cursorPos + name.length + 1
    );
  }

  /**
   * Updates the selection bar with current selections
   *
   * @private
   */
  private updateSelectionBar(): void {
    this.selectionBarWidget.updateProps({
      selectedVariable: this.props.selectedVariable,
      selectedAlgorithm: this.props.selectedAlgorithm
    });
  }

  /**
   * Gets the current value of the text area
   *
   * @returns The current text value
   */
  getValue(): string {
    return this.textarea.value;
  }

  /**
   * Sets the value of the text area
   *
   * @param value - The text value to set
   */
  setValue(value: string): void {
    this.textarea.value = value;
  }

  /**
   * Gets the currently selected workflow mode
   *
   * @returns The selected workflow mode
   */
  getWorkflowMode(): 'chat' | 'build' {
    return this.workflowSelect.value as 'chat' | 'build';
  }

  /**
   * Gets whether context should be included
   *
   * @returns Boolean indicating if context is enabled
   */
  getIncludeContext(): boolean {
    return this.contextCheckbox.checked;
  }

  /**
   * Gets the currently selected mode
   *
   * @returns The selected mode value
   */
  getMode(): string {
    return this.modeSelect.value;
  }

  /**
   * Sets the selected mode
   *
   * @param mode - The mode value to set
   */
  setMode(mode: string): void {
    this.modeSelect.value = mode;
  }

  /**
   * Clears the text area and all selections
   *
   * This method:
   * - Clears the textarea value
   * - Clears the selected variable
   * - Clears the selected algorithm
   * - Updates the selection bar
   */
  clear(): void {
    this.textarea.value = '';
    this.handleClearVariable();
    this.handleClearAlgorithm();
  }

  /**
   * Updates the component with new props
   *
   * This method allows updating the component's state from the parent.
   * It updates the execute button's disabled state based on isGenerating.
   *
   * @param props - Partial props to update
   */
  updateProps(props: Partial<IInputPanelProps>): void {
    this.props = { ...this.props, ...props };

    // Update execute button state
    if (props.isGenerating !== undefined) {
      this.executeBtn.disabled = props.isGenerating;
      this.executeBtn.style.opacity = props.isGenerating ? '0.5' : '1';
    }

    // Update selection bar if selections changed
    // Use 'in' operator to check if property exists, not if value is undefined
    if ('selectedVariable' in props || 'selectedAlgorithm' in props) {
      this.updateSelectionBar();
    }
  }
}
