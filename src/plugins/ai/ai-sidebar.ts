import { Widget } from '@lumino/widgets';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { LabIcon } from '@jupyterlab/ui-components';
import { AiService } from '../../services/ai-service';
import { ICONS } from './utils/icons';
import { computeLineOps, groupIntoHunks, buildTextFromDecisions } from './utils/diff-utils';
import { ChatMessage, VariableInfo, AlgorithmInfo } from './state/types';
import { ChatHistory } from './components/chat-history';
import { InputPanel } from './components/input-panel';

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
  private chatHistoryWidget: ChatHistory;
  private inputPanelWidget: InputPanel;
  private selectedVariable?: VariableInfo;
  private selectedAlgorithm?: AlgorithmInfo;

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
    title.innerHTML = `${ICONS.ai} <span>AI Assistant</span>`;

    const clearBtn = document.createElement('button');
    clearBtn.className = 'ai-sidebar-clear-btn';
    clearBtn.innerHTML = ICONS.trash;
    clearBtn.title = '清空对话';
    clearBtn.onclick = () => this.clearHistory();

    header.appendChild(title);
    header.appendChild(clearBtn);
    this.node.appendChild(header);

    // Chat History Area - using ChatHistory component
    this.chatHistoryWidget = new ChatHistory({
      messages: [],
      onApplyCode: (code) => this.previewAndApply(code)
    });
    this.node.appendChild(this.chatHistoryWidget.node);

    // Input Panel - using InputPanel component
    this.inputPanelWidget = new InputPanel({
      onGenerate: (intent) => this.handleGenerate(),
      onVariableSelect: (variable) => this.handleVariableSelect(variable),
      onAlgorithmSelect: (algorithm) => this.handleAlgorithmSelect(algorithm),
      selectedVariable: this.selectedVariable,
      selectedAlgorithm: this.selectedAlgorithm,
      isGenerating: false,
      tracker: this.tracker,
      aiService: this.aiService
    });
    this.node.appendChild(this.inputPanelWidget.node);
  }



  /**
   * Handles variable selection from InputPanel
   */
  private handleVariableSelect(variable: VariableInfo | undefined): void {
    this.selectedVariable = variable;
    // Update InputPanel with new selection
    this.inputPanelWidget.updateProps({
      selectedVariable: this.selectedVariable
    });
    this.updateStructuredIntent();
  }

  /**
   * Handles algorithm selection from InputPanel
   */
  private handleAlgorithmSelect(algorithm: AlgorithmInfo | undefined): void {
    if (!algorithm) {
      this.selectedAlgorithm = undefined;
    } else {
      // If params and expectedOutput are not provided, get them from the service
      if (!algorithm.params || !algorithm.expectedOutput) {
        const meta = this.aiService.getDefaultAlgorithmMeta(algorithm.id);
        this.selectedAlgorithm = {
          id: algorithm.id,
          name: algorithm.name,
          category: algorithm.category || 'General',
          params: algorithm.params || meta.params,
          expectedOutput: algorithm.expectedOutput || meta.expectedOutput,
          prompt: algorithm.prompt
        };
      } else {
        this.selectedAlgorithm = algorithm;
      }
    }
    // Update InputPanel with new selection
    this.inputPanelWidget.updateProps({
      selectedAlgorithm: this.selectedAlgorithm
    });
    this.updateStructuredIntent();
  }

  private clearHistory() {
    this.chatHistoryWidget.clear();
  }

  private async handleGenerate() {
    const panel = this.tracker.currentWidget;
    if (!panel) {
      this.appendHistory('System', '未检测到活动的 Notebook。', 'error');
      return;
    }

    // Get intent from InputPanel
    const intentValue = this.inputPanelWidget.getValue().trim();
    if (!intentValue) {
      this.updateStructuredIntent();
    }
    const intent = this.inputPanelWidget.getValue().trim();

    const cell = panel.content.activeCell;
    if (!cell || cell.model.type !== 'code') {
      this.appendHistory('System', '请选中一个代码单元。', 'warning');
      return;
    }

    const source = cell.model.sharedModel.getSource();
    const mode = this.inputPanelWidget.getMode();

    // Update InputPanel to show generating state
    this.inputPanelWidget.updateProps({ isGenerating: true });
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
      // Update InputPanel to show not generating state
      this.inputPanelWidget.updateProps({ isGenerating: false });
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

    const mode = this.inputPanelWidget.getMode() as
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





  /**
   * Appends a message to the chat history using the ChatHistory component
   * 
   * @param sender - The sender of the message ('User', 'AI', or 'System')
   * @param text - The message content
   * @param type - The message type for styling (normal, error, warning, success, info)
   * @param showApplyBtn - Whether to show the apply button for AI messages
   */
  private appendHistory(
    sender: string,
    text: string,
    type: 'normal' | 'error' | 'warning' | 'success' | 'info' = 'normal',
    showApplyBtn = false
  ) {
    // Convert sender string to ChatMessage sender type
    let messageSender: 'user' | 'ai' | 'system';
    if (sender === 'User') {
      messageSender = 'user';
    } else if (sender === 'AI') {
      messageSender = 'ai';
    } else {
      messageSender = 'system';
    }

    // Create ChatMessage object
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      sender: messageSender,
      content: text,
      type: type,
      timestamp: new Date(),
      showApplyButton: showApplyBtn
    };

    // Use ChatHistory component to add the message
    this.chatHistoryWidget.addMessage(message);
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
      const finalText = buildTextFromDecisions(
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
    const ops = computeLineOps(oldLines, newLines);

    const hunks = groupIntoHunks(ops);

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
   * 基于选择生成并填充结构化提示词
   */
  private updateStructuredIntent() {
    const text = this.aiService.generateStructuredPrompt(
      this.selectedVariable,
      this.selectedAlgorithm
    );
    this.inputPanelWidget.setValue(text);
  }
}
