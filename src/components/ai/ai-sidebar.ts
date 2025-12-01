import { Widget } from '@lumino/widgets';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { LabIcon } from '@jupyterlab/ui-components';
import { AiService } from '../../services/ai-service';

// AI助手图标
export const aiAssistantIcon = new LabIcon({
  name: 'datafilemanager:ai',
  svgstr:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="7" width="16" height="10" rx="3" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><path d="M12 4v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
});

/**
 * AI Sidebar Widget
 */
export class AiSidebar extends Widget {
  private app: JupyterFrontEnd;
  private tracker: INotebookTracker;
  private aiService: AiService;
  private chatHistory: HTMLDivElement;
  private intentInput: HTMLTextAreaElement;
  private modeSelect: HTMLSelectElement;
  private executeBtn: HTMLButtonElement;
  private clearInputBtn: HTMLButtonElement;
  private variableBtn: HTMLButtonElement;
  private variablePopup: HTMLDivElement;
  private selectionBar: HTMLDivElement;
  private selectedVariable?: {
    name: string;
    type: string;
    description?: string;
  };
  private selectedAlgorithm?: {
    id: string;
    name: string;
    params?: any;
    expectedOutput?: string;
    prompt?: string;
  };

  constructor(app: JupyterFrontEnd, tracker: INotebookTracker) {
    super();
    this.app = app;
    this.id = 'ai-sidebar';
    this.title.icon = aiAssistantIcon;
    this.title.caption = 'AI Assistant';
    this.addClass('jp-AiSidebar');

    this.tracker = tracker;
    this.aiService = new AiService();

    // Sidebar Header
    const header = document.createElement('div');
    header.className = 'ai-sidebar-header';

    const title = document.createElement('div');
    title.className = 'ai-sidebar-title';
    title.innerHTML = `${this.ICONS.ai} <span>AI Assistant</span>`;

    const clearBtn = document.createElement('button');
    clearBtn.className = 'ai-sidebar-clear-btn';
    clearBtn.innerHTML = this.ICONS.trash;
    clearBtn.title = '清空对话';
    clearBtn.onclick = () => this.clearHistory();

    header.appendChild(title);
    header.appendChild(clearBtn);
    this.node.appendChild(header);

    // Chat History Area
    this.chatHistory = document.createElement('div');
    this.chatHistory.className = 'ai-sidebar-history';
    this.node.appendChild(this.chatHistory);

    // Input Container
    const inputContainer = document.createElement('div');
    inputContainer.className = 'ai-sidebar-input-container';

    // Intent Input
    this.intentInput = document.createElement('textarea');
    this.intentInput.className = 'jp-mod-styled ai-sidebar-intent-input';
    this.intentInput.rows = 4;
    inputContainer.appendChild(this.intentInput);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'ai-sidebar-toolbar';

    // Mode Select
    // Variable Button (@)
    this.variableBtn = document.createElement('button');
    this.variableBtn.className = 'ai-sidebar-toolbar-btn';
    this.variableBtn.innerHTML = this.ICONS.at;
    this.variableBtn.title = '引用变量 (@)';
    this.variableBtn.onclick = e => {
      e.stopPropagation();
      this.toggleVariablePopup();
    };
    toolbar.appendChild(this.variableBtn);

    // Prompt Library Button
    this.promptBtn = document.createElement('button');
    this.promptBtn.className = 'ai-sidebar-toolbar-btn';
    this.promptBtn.innerHTML = this.ICONS.library; // Need to add library icon
    this.promptBtn.title = '提示词库';
    this.promptBtn.onclick = e => {
      e.stopPropagation();
      this.togglePromptPopup();
    };
    toolbar.appendChild(this.promptBtn);

    // Mode Select Wrapper
    const selectWrapper = document.createElement('div');
    selectWrapper.className = 'ai-sidebar-select-wrapper';

    this.modeSelect = document.createElement('select');
    this.modeSelect.className = 'ai-sidebar-mode-select';

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
      this.modeSelect.appendChild(opt);
    });

    selectWrapper.appendChild(this.modeSelect);
    toolbar.appendChild(selectWrapper);

    // Selection Bar (placed below the prompt input panel)
    this.selectionBar = document.createElement('div');
    this.selectionBar.className = 'ai-selection-bar';
    const varChip = document.createElement('div');
    varChip.className = 'ai-selection-chip';
    const varIcon = document.createElement('span');
    varIcon.className = 'ai-chip-icon';
    varIcon.innerHTML = this.ICONS.table;
    const varLabel = document.createElement('span');
    varLabel.className = 'ai-chip-label';
    const varClear = document.createElement('button');
    varClear.className = 'ai-chip-clear';
    varClear.textContent = '×';
    varClear.title = '清除已选变量';
    varClear.onclick = () => this.clearSelectedVariable();
    varChip.appendChild(varIcon);
    varChip.appendChild(varLabel);
    varChip.appendChild(varClear);

    const algoChip = document.createElement('div');
    algoChip.className = 'ai-selection-chip';
    const algoIcon = document.createElement('span');
    algoIcon.className = 'ai-chip-icon';
    algoIcon.innerHTML = this.ICONS.library;
    const algoLabel = document.createElement('span');
    algoLabel.className = 'ai-chip-label';
    const algoClear = document.createElement('button');
    algoClear.className = 'ai-chip-clear';
    algoClear.textContent = '×';
    algoClear.title = '清除已选算法';
    algoClear.onclick = () => this.clearSelectedAlgorithm();
    algoChip.appendChild(algoIcon);
    algoChip.appendChild(algoLabel);
    algoChip.appendChild(algoClear);

    this.selectionBar.appendChild(varChip);
    this.selectionBar.appendChild(algoChip);

    // Variable Popup
    this.variablePopup = document.createElement('div');
    this.variablePopup.className = 'ai-variable-popup';
    selectWrapper.appendChild(this.variablePopup);

    // Prompt Popup (Attached to toolbar for now, or maybe selectWrapper? Let's put it in toolbar for positioning relative to button)
    this.promptPopup = document.createElement('div');
    this.promptPopup.className = 'ai-variable-popup ai-prompt-popup'; // Reuse class for style, add specific one
    toolbar.appendChild(this.promptPopup);

    // Close popup when clicking outside
    document.addEventListener('click', e => {
      if (
        !this.variablePopup.contains(e.target as Node) &&
        e.target !== this.variableBtn
      ) {
        this.variablePopup.classList.remove('visible');
      }
      if (
        !this.promptPopup.contains(e.target as Node) &&
        e.target !== this.promptBtn
      ) {
        this.promptPopup.classList.remove('visible');
      }
    });

    toolbar.appendChild(selectWrapper);

    // Execute Button
    // Clear Input & Selections Button
    this.clearInputBtn = document.createElement('button');
    this.clearInputBtn.className = 'ai-sidebar-toolbar-btn';
    this.clearInputBtn.title = '清空输入并清除选择';
    this.clearInputBtn.innerHTML = this.ICONS.clear;
    this.clearInputBtn.onclick = e => {
      e.stopPropagation();
      this.clearIntentAndSelections();
    };
    toolbar.appendChild(this.clearInputBtn);

    // Execute Button
    this.executeBtn = document.createElement('button');
    this.executeBtn.className = 'ai-sidebar-execute-btn';
    this.executeBtn.title = '生成';
    this.executeBtn.innerHTML = this.ICONS.run;
    this.executeBtn.onclick = () => this.handleGenerate();
    toolbar.appendChild(this.executeBtn);

    inputContainer.appendChild(toolbar);

    this.node.appendChild(inputContainer);
    this.node.appendChild(this.selectionBar);
    this.updateSelectionBar();
  }

  private async toggleVariablePopup() {
    const isVisible = this.variablePopup.classList.contains('visible');
    if (isVisible) {
      this.variablePopup.classList.remove('visible');
    } else {
      this.variablePopup.classList.add('visible');
      await this.loadVariables();
    }
  }

  private async loadVariables() {
    this.variablePopup.innerHTML =
      '<div class="ai-variable-loading">加载变量中...</div>';

    const panel = this.tracker.currentWidget;
    if (!panel) {
      this.variablePopup.innerHTML =
        '<div class="ai-variable-empty">未检测到 Notebook</div>';
      return;
    }

    try {
      const variables = await this.aiService.getDataFrameInfo(panel);
      this.renderVariables(variables);
    } catch (e) {
      this.variablePopup.innerHTML = `<div class="ai-variable-empty">加载失败: ${e}</div>`;
    }
  }

  private renderVariables(variables: any[]) {
    this.variablePopup.innerHTML = '';

    if (variables.length === 0) {
      this.variablePopup.innerHTML =
        '<div class="ai-variable-empty">无可用 DataFrame</div>';
      return;
    }

    variables.forEach(v => {
      const item = document.createElement('div');
      item.className = 'ai-variable-item';

      const icon = document.createElement('span');
      icon.className = 'variable-icon';
      icon.innerHTML = this.ICONS.table;

      const name = document.createElement('span');
      name.className = 'variable-name';
      name.textContent = v.name;

      const info = document.createElement('span');
      info.className = 'variable-info';
      info.textContent = `${v.shape[0]}x${v.shape[1]}`;

      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(info);

      item.onclick = () => {
        this.selectedVariable = {
          name: v.name,
          type: v.type,
          description: this.aiService.describeVariable(v)
        };
        this.insertVariable(v.name);
        this.updateSelectionBar();
        this.updateStructuredIntent();
        this.variablePopup.classList.remove('visible');
      };

      this.variablePopup.appendChild(item);
    });
  }

  private insertVariable(name: string) {
    const cursorPos = this.intentInput.selectionStart;
    const textBefore = this.intentInput.value.substring(0, cursorPos);
    const textAfter = this.intentInput.value.substring(cursorPos);

    // Check if there is already an @ before the cursor
    // If user typed @ and then clicked the button, we might want to replace it?
    // But the requirement is "click button -> popup -> select -> insert".
    // So we just insert "name " (maybe with a space?)

    this.intentInput.value = textBefore + name + ' ' + textAfter;
    this.intentInput.focus();
    this.intentInput.setSelectionRange(
      cursorPos + name.length + 1,
      cursorPos + name.length + 1
    );
  }

  private clearHistory() {
    this.chatHistory.innerHTML = '';
  }

  private async handleGenerate() {
    const panel = this.tracker.currentWidget;
    if (!panel) {
      this.appendHistory('System', '未检测到活动的 Notebook。', 'error');
      return;
    }

    if (!this.intentInput.value.trim()) {
      this.updateStructuredIntent();
    }
    const intent = this.intentInput.value.trim();

    const cell = panel.content.activeCell;
    if (!cell || cell.model.type !== 'code') {
      this.appendHistory('System', '请选中一个代码单元。', 'warning');
      return;
    }

    const source = cell.model.sharedModel.getSource();
    const mode = this.modeSelect.value;

    this.executeBtn.disabled = true;
    this.executeBtn.style.opacity = '0.5';
    this.appendHistory('User', intent);

    try {
      let variables: any[] = [];
      try {
        variables = await this.aiService.getDataFrameInfo(panel);
        console.log('Fetched variables:', variables);
      } catch (e) {
        console.warn('Failed to fetch variables:', e);
      }

      const payload = this.aiService.buildAiRequestPayload(
        panel,
        source,
        intent,
        mode,
        false,
        variables,
        { variable: this.selectedVariable, algorithm: this.selectedAlgorithm }
      );
      const resp = await this.aiService.requestGenerate(payload);

      if (resp.error) {
        this.appendHistory(
          'AI',
          `错误: ${resp.error}\n\n建议:\n${resp.suggestion}`,
          'error'
        );
      } else {
        this.appendHistory('AI', resp.suggestion, 'success', true);
      }
    } catch (e) {
      this.appendHistory(
        'System',
        `请求失败: ${e instanceof Error ? e.message : String(e)}`,
        'error'
      );
    } finally {
      this.executeBtn.disabled = false;
      this.executeBtn.style.opacity = '1';
    }
  }

  /**
   * 预览单元格与AI建议的差异，并在用户接受后应用
   */
  /**
   * 预览单元格与AI建议的差异，支持块级接受/拒绝，并在用户确认后应用
   */
  private async previewAndApply(suggestion: string) {
    const panel = this.tracker.currentWidget;
    if (!panel) {
      return;
    }

    const mode = this.modeSelect.value as
      | 'create'
      | 'insert'
      | 'append'
      | 'explain'
      | 'fix'
      | 'refactor';

    const content = panel.content;
    const cell = content.activeCell;
    if (!cell || cell.model.type !== 'code') {
      return;
    }
    // 若当前单元格为空，直接应用，不弹出Diff预览
    const isEmpty =
      (cell.model.sharedModel.getSource() || '').trim().length === 0;
    if (isEmpty && mode !== 'explain') {
      const applyMode = mode === 'append' ? 'create' : mode;
      await this.applySuggestion(panel, suggestion, applyMode);
      this.appendHistory('System', '空单元格已直接应用代码。', 'success');
      return;
    }
    const oldText =
      mode === 'insert' || mode === 'explain'
        ? ''
        : cell.model.sharedModel.getSource();
    let newText = suggestion;
    if (mode === 'append') {
      newText = `${oldText}\n${suggestion}`;
    } else if (mode === 'insert' || mode === 'explain') {
      // 对于插入/说明模式，旧文本为空，仅展示新文本的预览
      // 接受时将插入新的单元格或Markdown单元格
      // 这里的Diff依然可以帮助用户确认内容
      // newText 已为建议内容
    }

    this.showDiffOverlay(
      panel,
      oldText,
      newText,
      async (finalText: string) => {
        try {
          await this.applySuggestion(panel, finalText, mode);
          this.appendHistory('System', '已应用AI建议到当前单元格。', 'success');
        } catch (e) {
          this.appendHistory(
            'System',
            `应用失败: ${e instanceof Error ? e.message : String(e)}`,
            'error'
          );
        }
      },
      () => {
        this.appendHistory('System', '已取消应用AI建议。', 'info');
      }
    );
  }

  /**
   * 将建议应用到Notebook
   * 当模式为 insert 时，若当前代码单元为空则直接覆盖该单元，否则在下方插入新单元
   */
  private async applySuggestion(
    panel: NotebookPanel,
    suggestion: string,
    mode: 'create' | 'insert' | 'append' | 'explain' | 'fix' | 'refactor'
  ): Promise<void> {
    const content = panel.content;
    const cell = content.activeCell;
    if (!cell || cell.model.type !== 'code') {
      return;
    }

    if (mode === 'create' || mode === 'fix' || mode === 'refactor') {
      cell.model.sharedModel.setSource(suggestion);
    } else if (mode === 'insert') {
      const src = (cell.model.sharedModel.getSource() || '').trim();
      if (src.length === 0) {
        cell.model.sharedModel.setSource(suggestion);
      } else {
        await this.app.commands.execute('notebook:insert-cell-below');
        content.activeCell.model.sharedModel.setSource(suggestion);
      }
    } else if (mode === 'append') {
      const src = cell.model.sharedModel.getSource();
      cell.model.sharedModel.setSource(src + '\n' + suggestion);
    } else if (mode === 'explain') {
      await this.app.commands.execute('notebook:insert-cell-below');
      await this.app.commands.execute('notebook:change-cell-to-markdown');
      content.activeCell.model.sharedModel.setSource(suggestion);
    }
  }

  private promptBtn: HTMLButtonElement;
  private promptPopup: HTMLDivElement;

  private async togglePromptPopup() {
    const isVisible = this.promptPopup.classList.contains('visible');
    if (isVisible) {
      this.promptPopup.classList.remove('visible');
    } else {
      this.promptPopup.classList.add('visible');
      await this.loadPrompts();
    }
  }

  private async loadPrompts() {
    this.promptPopup.innerHTML =
      '<div class="ai-variable-loading">加载提示词库...</div>';
    try {
      const prompts = await this.aiService.getAlgorithmPrompts();
      this.renderPrompts(prompts);
    } catch (e) {
      this.promptPopup.innerHTML = `<div class="ai-variable-empty">加载失败: ${e}</div>`;
    }
  }

  private renderPrompts(prompts: any) {
    this.promptPopup.innerHTML = '';
    if (!prompts || Object.keys(prompts).length === 0) {
      this.promptPopup.innerHTML =
        '<div class="ai-variable-empty">暂无提示词</div>';
      return;
    }

    Object.keys(prompts).forEach(key => {
      const category = prompts[key];

      const catHeader = document.createElement('div');
      catHeader.className = 'ai-prompt-category';
      catHeader.textContent = category.label;
      this.promptPopup.appendChild(catHeader);

      category.algorithms.forEach((algo: any) => {
        const item = document.createElement('div');
        item.className = 'ai-variable-item';

        const name = document.createElement('span');
        name.className = 'variable-name';
        name.textContent = algo.name;

        item.appendChild(name);
        item.onclick = () => {
          this.setSelectedAlgorithm(algo);
          this.promptPopup.classList.remove('visible');
        };
        this.promptPopup.appendChild(item);
      });
    });
  }

  // 定义SVG图标常量
  private readonly ICONS = {
    expand:
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    collapse:
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>',
    apply:
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    user: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    ai: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12 2.1 12a10.1 10.1 0 0 0 9.9 9.9v-9.9z"></path><path d="M12 12V2.1A10.1 10.1 0 0 0 2.1 12h9.9z"></path></svg>',
    trash:
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    run: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M5 3l14 9-14 9V3z"/></svg>',
    at: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg>',
    library:
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    table:
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>',
    clear:
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
  };

  private appendHistory(
    sender: string,
    text: string,
    type: 'normal' | 'error' | 'warning' | 'success' | 'info' = 'normal',
    showApplyBtn = false
  ) {
    const msg = document.createElement('div');
    msg.className = 'ai-sidebar-message';

    if (sender === 'User') {
      msg.classList.add('ai-sidebar-message-user');
      // User Header
      const header = document.createElement('div');
      header.className = 'ai-message-header';

      const label = document.createElement('div');
      label.className = 'ai-message-label';
      const modeLabel = this.getModeLabel(this.modeSelect.value);
      label.innerHTML = `${this.ICONS.user} <span>${modeLabel}</span>`;
      header.appendChild(label);

      msg.appendChild(header);

      // User Content
      const content = document.createElement('div');
      content.className = 'ai-message-content';
      content.textContent = text;
      msg.appendChild(content);
    } else if (sender === 'AI') {
      msg.classList.add('ai-sidebar-message-ai');

      // AI Header with Toolbar
      const header = document.createElement('div');
      header.className = 'ai-message-header';

      const label = document.createElement('div');
      label.className = 'ai-message-label';
      label.innerHTML = `${this.ICONS.ai} <span>AI Suggestion</span>`;
      header.appendChild(label);

      const toolbar = document.createElement('div');
      toolbar.className = 'ai-message-toolbar';
      header.appendChild(toolbar);

      msg.appendChild(header);

      // Content Area
      const content = document.createElement('div');
      content.className = 'ai-message-content ai-code-block';

      // Check if content needs collapsing
      const lines = text.split('\n');
      const shouldCollapse = lines.length > 8; // 稍微增加默认显示的行数

      if (shouldCollapse) {
        const collapsedText = lines.slice(0, 8).join('\n') + '\n...';
        content.textContent = collapsedText;
        content.classList.add('collapsed');

        // Toggle Button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'ai-toolbar-btn';
        toggleBtn.innerHTML = this.ICONS.expand;
        toggleBtn.title = '展开完整代码';

        let isExpanded = false;
        toggleBtn.onclick = () => {
          isExpanded = !isExpanded;
          if (isExpanded) {
            content.textContent = text;
            content.classList.remove('collapsed');
            toggleBtn.innerHTML = this.ICONS.collapse;
            toggleBtn.title = '收起代码';
          } else {
            content.textContent = collapsedText;
            content.classList.add('collapsed');
            toggleBtn.innerHTML = this.ICONS.expand;
            toggleBtn.title = '展开完整代码';
          }
        };
        toolbar.appendChild(toggleBtn);
      } else {
        content.textContent = text;
      }

      // Apply Button
      if (showApplyBtn) {
        const applyBtn = document.createElement('button');
        applyBtn.className = 'ai-toolbar-btn ai-btn-primary';
        applyBtn.innerHTML = this.ICONS.apply;
        applyBtn.title = '应用此代码';
        applyBtn.onclick = () =>
          this.previewAndApply(text.replace(/^AI:\n/, ''));
        toolbar.appendChild(applyBtn);
      }

      msg.appendChild(content);
    } else {
      // System Message
      msg.classList.add('ai-sidebar-message-system');
      msg.innerHTML = `<strong>[${sender}]</strong> ${text}`;
      if (type === 'error') {
        msg.classList.add('error');
      }
      if (type === 'success') {
        msg.classList.add('success');
      }
      if (type === 'info') {
        msg.classList.add('info');
      }
    }

    this.chatHistory.appendChild(msg);
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
  }

  /**
   * 根据当前模式值返回中文标题标签
   */
  private getModeLabel(mode: string): string {
    switch (mode) {
      case 'create':
        return '编写代码';
      case 'fix':
        return '错误修复';
      case 'refactor':
        return '代码完善';
      case 'explain':
        return '编写说明';
      case 'insert':
        return '插入代码';
      case 'append':
        return '追加代码';
      case 'replace':
        return '替换代码';
      default:
        return '用户请求';
    }
  }

  /**
   * 清空提示词输入并清除已选变量与算法，不触发结构化提示生成
   */
  private clearIntentAndSelections() {
    this.intentInput.value = '';
    this.selectedVariable = undefined;
    this.selectedAlgorithm = undefined;
    this.updateSelectionBar();
  }

  /**
   * 在当前代码单元上方叠加Diff预览，提供接受/拒绝按钮
   */
  /**
   * 在屏幕中间显示可交互的Diff预览，支持块级接受/拒绝，并返回最终合并结果
   */
  private showDiffOverlay(
    panel: NotebookPanel,
    oldText: string,
    newText: string,
    onAccept: (finalText: string) => void,
    onReject: () => void
  ): void {
    const cell = panel.content.activeCell;
    if (!cell) {
      return;
    }
    const overlay = document.createElement('div');
    overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: calc(100vw - 64px);
            max-width: 1920px;
            max-height: 80vh;
            box-sizing: border-box;
            z-index: 10000;
            background: var(--jp-layout-color1);
            border: 1px solid var(--jp-border-color2);
            border-radius: 8px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.25);
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

    const header = document.createElement('div');
    header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            border-bottom: 1px solid var(--jp-border-color2);
            background: var(--jp-layout-color2);
            border-radius: 8px 8px 0 0;
            font-size: 13px;
            color: var(--jp-ui-font-color1);
        `;
    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = 'display: flex; align-items: center; gap: 12px;';
    const titleLabel = document.createElement('span');
    titleLabel.textContent = 'Diff预览（AI建议 vs 当前单元）';
    const hunkCountLabel = document.createElement('span');
    hunkCountLabel.textContent = '变更块：计算中…';
    hunkCountLabel.style.cssText =
      'font-size: 12px; color: var(--jp-ui-font-color2);';
    headerLeft.appendChild(titleLabel);
    headerLeft.appendChild(hunkCountLabel);
    const headerActions = document.createElement('div');
    headerActions.style.cssText = 'display: flex; gap: 8px;';
    const acceptAllBtn = document.createElement('button');
    acceptAllBtn.textContent = '接受全部';
    acceptAllBtn.className = 'jp-Button jp-mod-accept';
    const rejectAllBtn = document.createElement('button');
    rejectAllBtn.textContent = '拒绝全部';
    rejectAllBtn.className = 'jp-Button jp-mod-warn';
    headerActions.appendChild(rejectAllBtn);
    headerActions.appendChild(acceptAllBtn);
    header.appendChild(headerLeft);
    header.appendChild(headerActions);

    const body = document.createElement('div');
    body.style.cssText = `
            flex: 1;
            min-height: 0;
            overflow: auto;
            font-family: var(--jp-code-font-family);
            font-size: 13px;
            line-height: 1.5;
            padding: 12px;
        `;

    const footer = document.createElement('div');
    footer.style.cssText = `
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            padding: 10px 12px;
            border-top: 1px solid var(--jp-border-color2);
            background: var(--jp-layout-color2);
            border-radius: 0 0 8px 8px;
        `;

    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = '应用所选更改';
    acceptBtn.className = 'jp-Button jp-mod-accept';

    const rejectBtn = document.createElement('button');
    rejectBtn.textContent = '取消';
    rejectBtn.className = 'jp-Button jp-mod-warn';

    const rowsGrid = document.createElement('div');
    rowsGrid.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            align-items: start;
            grid-auto-rows: max-content;
        `;

    const { ops, decisionsProvider, setAllDecisions } =
      this.renderInteractiveDiff(oldText, newText, rowsGrid);

    // 计算并显示变更块数量
    let hunkCount = 0;
    {
      let idx = 0;
      while (idx < ops.length) {
        if (ops[idx].type === 'ctx') {
          idx++;
          continue;
        }
        hunkCount++;
        while (idx < ops.length && ops[idx].type !== 'ctx') {
          idx++;
        }
      }
    }
    hunkCountLabel.textContent = `变更块：${hunkCount}`;

    body.appendChild(rowsGrid);
    footer.appendChild(rejectBtn);
    footer.appendChild(acceptBtn);
    overlay.appendChild(header);
    overlay.appendChild(body);
    overlay.appendChild(footer);
    document.body.appendChild(overlay);

    const cleanup = () => {
      overlay.remove();
    };
    acceptBtn.onclick = () => {
      const finalText = this.buildTextFromOpsAndDecisions(
        ops,
        decisionsProvider()
      );
      cleanup();
      onAccept(finalText);
    };
    rejectBtn.onclick = () => {
      cleanup();
      onReject();
    };

    acceptAllBtn.onclick = () => {
      if (setAllDecisions) {
        setAllDecisions('accept');
      }
    };
    rejectAllBtn.onclick = () => {
      if (setAllDecisions) {
        setAllDecisions('reject');
      }
    };

    // Esc 关闭
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        cleanup();
        onReject();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  }

  /**
   * 生成统一格式的行级Diff渲染
   */
  /**
   * 渲染可交互的统一Diff，每个变更块可单独接受或拒绝
   * 返回当前ops以及一个函数用于获取最新的块决策
   */
  /**
   * 渲染两列对齐的可交互Diff：左列（上下文/变更块+控制），右列（对应块的合并预览）
   */
  private renderInteractiveDiff(
    oldText: string,
    newText: string,
    gridContainer: HTMLDivElement
  ): {
    ops: Array<{ type: 'add' | 'del' | 'ctx'; text: string }>;
    decisionsProvider: () => ('accept' | 'reject')[];
    setAllDecisions: (v: 'accept' | 'reject') => void;
  } {
    const oldLines = oldText.split(/\r?\n/);
    const newLines = newText.split(/\r?\n/);
    const ops = this.computeLineOps(oldLines, newLines);

    const hunks: Array<{ start: number; end: number }> = [];
    let i = 0;
    while (i < ops.length) {
      if (ops[i].type === 'ctx') {
        i++;
        continue;
      }
      const start = i;
      while (i < ops.length && ops[i].type !== 'ctx') {
        i++;
      }
      const end = i - 1;
      hunks.push({ start, end });
    }

    const decisions: ('accept' | 'reject')[] = hunks.map(() => 'accept');

    const makeLine = (type: 'add' | 'del' | 'ctx', text: string) => {
      const line = document.createElement('div');
      line.style.cssText =
        'display: block; padding: 2px 8px; border-radius: 4px; box-sizing: border-box; font-family: var(--jp-code-font-family); font-size: 13px; line-height: 1.5; tab-size: 4; font-variant-ligatures: none; color: var(--jp-ui-font-color1); white-space: pre;';
      if (type === 'add') {
        line.style.background = 'rgba(0,160,0,0.12)';
        line.textContent = `+ ${text}`;
      } else if (type === 'del') {
        line.style.background = 'rgba(200,0,0,0.12)';
        line.textContent = `- ${text}`;
      } else {
        line.textContent = `  ${text}`;
      }
      return line;
    };

    const makePreviewLine = (text: string) => {
      const line = document.createElement('div');
      line.style.cssText =
        'display: block; padding: 2px 8px; border-radius: 4px; box-sizing: border-box; font-family: var(--jp-code-font-family); font-size: 13px; line-height: 1.5; tab-size: 4; font-variant-ligatures: none; color: var(--jp-ui-font-color1); white-space: pre;';
      const content = text && text.length > 0 ? text : '\u00A0';
      line.textContent = `  ${content}`;
      return line;
    };

    const rightHunkViews: HTMLDivElement[] = [];

    let cursor = 0;
    const renderCtxUntil = (endIndex: number) => {
      const leftCtx = document.createElement('div');
      leftCtx.style.cssText =
        'white-space: pre; border: 1px dashed var(--jp-border-color2); border-radius: 6px; padding: 6px; background: var(--jp-layout-color1); min-width: 0; box-sizing: border-box;';
      const rightCtx = document.createElement('div');
      rightCtx.style.cssText =
        'white-space: pre; border: 1px dashed var(--jp-border-color2); border-radius: 6px; padding: 6px; background: var(--jp-layout-color1); min-width: 0; box-sizing: border-box;';
      let hasCtx = false;
      const ctxTexts: string[] = [];
      while (cursor < endIndex) {
        if (ops[cursor].type === 'ctx') {
          leftCtx.appendChild(makeLine('ctx', ops[cursor].text));
          ctxTexts.push(ops[cursor].text);
          hasCtx = true;
        }
        cursor++;
      }
      if (hasCtx) {
        ctxTexts.forEach(t => rightCtx.appendChild(makePreviewLine(t)));
        gridContainer.appendChild(leftCtx);
        gridContainer.appendChild(rightCtx);
      }
    };

    hunks.forEach((h, idx) => {
      renderCtxUntil(h.start);

      const hunkWrapper = document.createElement('div');
      hunkWrapper.style.cssText = `
                border: 1px dashed var(--jp-border-color2);
                border-radius: 6px;
                padding: 6px;
                background: var(--jp-layout-color1);
                min-width: 0;
                box-sizing: border-box;
            `;
      const hunkHeader = document.createElement('div');
      hunkHeader.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';
      const label = document.createElement('span');
      label.textContent = `变更块 ${idx + 1}`;
      label.style.cssText = 'color: var(--jp-ui-font-color1); font-size: 12px;';
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display: flex; gap: 6px;';
      const acceptToggle = document.createElement('button');
      acceptToggle.textContent = '接受';
      acceptToggle.className = 'jp-Button';
      const rejectToggle = document.createElement('button');
      rejectToggle.textContent = '拒绝';
      rejectToggle.className = 'jp-Button jp-mod-warn';
      btnRow.appendChild(rejectToggle);
      btnRow.appendChild(acceptToggle);
      hunkHeader.appendChild(label);
      hunkHeader.appendChild(btnRow);

      for (let k = h.start; k <= h.end; k++) {
        const op = ops[k];
        if (op.type === 'add') {
          hunkWrapper.appendChild(makeLine('add', op.text));
        }
        if (op.type === 'del') {
          hunkWrapper.appendChild(makeLine('del', op.text));
        }
      }
      hunkWrapper.prepend(hunkHeader);

      const rightPreview = document.createElement('div');
      rightPreview.style.cssText =
        'white-space: pre; border: 1px dashed var(--jp-border-color2); border-radius: 6px; padding: 6px; background: var(--jp-layout-color1); min-width: 0; box-sizing: border-box;';
      const rightHeader = document.createElement('div');
      rightHeader.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';
      const rightLabel = document.createElement('span');
      rightLabel.textContent = `变更块 ${idx + 1}（预览）`;
      rightLabel.style.cssText =
        'color: var(--jp-ui-font-color1); font-size: 12px;';
      rightHeader.appendChild(rightLabel);
      rightPreview.appendChild(rightHeader);
      const buildHunkPreview = (
        start: number,
        end: number,
        decision: 'accept' | 'reject'
      ) => {
        const seg: string[] = [];
        if (decision === 'accept') {
          for (let k = start; k <= end; k++) {
            if (ops[k].type === 'add') {
              seg.push(ops[k].text);
            }
          }
        } else {
          for (let k = start; k <= end; k++) {
            if (ops[k].type === 'del') {
              seg.push(ops[k].text);
            }
          }
        }
        return seg;
      };
      const updateVisuals = () => {
        if (decisions[idx] === 'accept') {
          acceptToggle.classList.add('jp-mod-accept');
          rejectToggle.classList.remove('jp-mod-accept');
          hunkWrapper.style.borderColor = 'rgba(0,160,0,0.6)';
          hunkWrapper.style.background = 'rgba(0,160,0,0.06)';
        } else {
          rejectToggle.classList.add('jp-mod-accept');
          acceptToggle.classList.remove('jp-mod-accept');
          hunkWrapper.style.borderColor = 'rgba(200,0,0,0.6)';
          hunkWrapper.style.background = 'rgba(200,0,0,0.06)';
        }
        // 填充右侧预览行，保持与左侧一致的行内间距
        while (rightPreview.childElementCount > 1) {
          rightPreview.removeChild(rightPreview.lastChild as Node);
        }
        const seg = buildHunkPreview(h.start, h.end, decisions[idx]);
        seg.forEach(t => rightPreview.appendChild(makePreviewLine(t)));
      };
      acceptToggle.onclick = () => {
        decisions[idx] = 'accept';
        updateVisuals();
      };
      rejectToggle.onclick = () => {
        decisions[idx] = 'reject';
        updateVisuals();
      };
      updateVisuals();

      gridContainer.appendChild(hunkWrapper);
      gridContainer.appendChild(rightPreview);
      rightHunkViews.push(rightPreview);

      cursor = h.end + 1;
    });

    renderCtxUntil(ops.length);

    const setAllDecisions = (v: 'accept' | 'reject') => {
      for (let idx = 0; idx < decisions.length; idx++) {
        decisions[idx] = v;
      }
      // 批量刷新：重新渲染所有块的右侧预览文本
      hunks.forEach((h, idx) => {
        const right = rightHunkViews[idx];
        if (right) {
          while (right.childElementCount > 1) {
            right.removeChild(right.lastChild as Node);
          }
          const seg: string[] = [];
          if (decisions[idx] === 'accept') {
            for (let k = h.start; k <= h.end; k++) {
              if (ops[k].type === 'add') {
                seg.push(ops[k].text);
              }
            }
          } else {
            for (let k = h.start; k <= h.end; k++) {
              if (ops[k].type === 'del') {
                seg.push(ops[k].text);
              }
            }
          }
          seg.forEach(t => right.appendChild(makePreviewLine(t)));
        }
      });
    };

    return { ops, decisionsProvider: () => decisions.slice(), setAllDecisions };
  }

  /**
   * 根据行级ops和块决策重建最终文本
   */
  private buildTextFromOpsAndDecisions(
    ops: Array<{ type: 'add' | 'del' | 'ctx'; text: string }>,
    decisions: ('accept' | 'reject')[]
  ): string {
    const result: string[] = [];
    let i = 0;
    let hunkIndex = 0;
    while (i < ops.length) {
      if (ops[i].type === 'ctx') {
        result.push(ops[i].text);
        i++;
        continue;
      }
      const start = i;
      while (i < ops.length && ops[i].type !== 'ctx') {
        i++;
      }
      const end = i - 1;
      const decision = decisions[hunkIndex] ?? 'accept';
      if (decision === 'accept') {
        for (let k = start; k <= end; k++) {
          if (ops[k].type === 'add') {
            result.push(ops[k].text);
          }
        }
      } else {
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

  /**
   * 基于LCS的行级Diff操作序列
   */
  private computeLineOps(
    a: string[],
    b: string[]
  ): Array<{ type: 'add' | 'del' | 'ctx'; text: string }> {
    const n = a.length,
      m = b.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () =>
      Array(m + 1).fill(0)
    );
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }
    const ops: Array<{ type: 'add' | 'del' | 'ctx'; text: string }> = [];
    let i = 0,
      j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        ops.push({ type: 'ctx', text: b[j] });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: 'del', text: a[i] });
        i++;
      } else {
        ops.push({ type: 'add', text: b[j] });
        j++;
      }
    }
    while (i < n) {
      ops.push({ type: 'del', text: a[i++] });
    }
    while (j < m) {
      ops.push({ type: 'add', text: b[j++] });
    }
    return ops;
  }

  /**
   * 更新右上角摘要显示
   */
  private updateSelectionBar() {
    const chips = this.selectionBar.querySelectorAll('.ai-selection-chip');
    const [varChip, algoChip] = [chips[0], chips[1]];
    const varLabel = varChip?.querySelector(
      '.ai-chip-label'
    ) as HTMLSpanElement;
    const algoLabel = algoChip?.querySelector(
      '.ai-chip-label'
    ) as HTMLSpanElement;
    if (varLabel) {
      varLabel.textContent = this.selectedVariable?.name ?? '未选择变量';
    }
    if (algoLabel) {
      algoLabel.textContent = this.selectedAlgorithm?.name ?? '未选择算法';
    }
  }

  /**
   * 基于选择生成并填充结构化提示词
   */
  private updateStructuredIntent() {
    const text = this.aiService.generateStructuredPrompt(
      this.selectedVariable,
      this.selectedAlgorithm
    );
    this.intentInput.value = text;
  }

  /**
   * 设置算法选择并更新视图
   */
  private setSelectedAlgorithm(algo: {
    id: string;
    name: string;
    prompt: string;
  }) {
    const meta = this.aiService.getDefaultAlgorithmMeta(algo.id);
    this.selectedAlgorithm = {
      id: algo.id,
      name: algo.name,
      params: meta.params,
      expectedOutput: meta.expectedOutput,
      prompt: algo.prompt
    };
    this.updateSelectionBar();
    this.updateStructuredIntent();
  }

  /**
   * 清除已选变量
   */
  private clearSelectedVariable() {
    this.selectedVariable = undefined;
    this.updateSelectionBar();
    this.updateStructuredIntent();
  }

  /**
   * 清除已选算法
   */
  private clearSelectedAlgorithm() {
    this.selectedAlgorithm = undefined;
    this.updateSelectionBar();
    this.updateStructuredIntent();
  }
}
