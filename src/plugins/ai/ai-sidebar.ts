import { Widget } from '@lumino/widgets';
import {
  INotebookTracker,
  NotebookPanel,
  NotebookActions
} from '@jupyterlab/notebook';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { LabIcon } from '@jupyterlab/ui-components';
import { AiService } from '../../services/ai-service';
import { LibraryService } from '../../services/library-service';
import { ICONS } from './utils/icons';
import { IVariableInfo, IAlgorithmInfo, IChatMessage } from './state/types';
import { StateManager, IAiSidebarState } from './state/ai-sidebar-state';
import { ChatHistory } from './components/chat-history';
import { InputPanel } from './components/input-panel';
import { DiffViewer } from './components/diff-viewer';
import { CellNavigator } from './components/cell-navigator';

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
  private libraryService: LibraryService;
  private stateManager: StateManager;
  private chatHistoryWidget: ChatHistory;
  private inputPanelWidget: InputPanel;
  private cellNavigator: CellNavigator;

  constructor(app: JupyterFrontEnd, tracker: INotebookTracker) {
    super();
    this.app = app;
    this.id = 'ai-sidebar';
    this.title.icon = aiAssistantIcon;
    this.title.caption = 'AI Assistant';
    this.addClass('jp-AiSidebar');

    this.tracker = tracker;
    this.aiService = new AiService();
    this.libraryService = new LibraryService();
    this.stateManager = new StateManager();

    // Sidebar Header
    const header = document.createElement('div');
    header.className = 'ai-sidebar-header';

    const title = document.createElement('div');
    title.className = 'ai-sidebar-title';
    title.innerHTML = `${ICONS.ai} <span>AI Assistant</span>`;

    // Right side actions wrapper
    const actions = document.createElement('div');
    actions.className = 'ai-sidebar-actions';
    actions.style.display = 'flex';
    actions.style.gap = '4px';
    actions.style.alignItems = 'center';

    // Cell Navigator
    this.cellNavigator = new CellNavigator({ tracker: this.tracker });
    actions.appendChild(this.cellNavigator.node);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'ai-sidebar-clear-btn';
    clearBtn.innerHTML = ICONS.trash;
    clearBtn.title = '清空对话';
    clearBtn.onclick = () => this.clearHistory();
    actions.appendChild(clearBtn);

    header.appendChild(title);
    header.appendChild(actions);
    this.node.appendChild(header);

    // Chat History Area - using ChatHistory component
    this.chatHistoryWidget = new ChatHistory({
      messages: this.stateManager.getState().chatHistory,
      onApplyCode: code => this.previewAndApply(code)
    });
    this.node.appendChild(this.chatHistoryWidget.node);

    // Input Panel - using InputPanel component
    const state = this.stateManager.getState();
    this.inputPanelWidget = new InputPanel({
      onGenerate: intent => this.handleGenerate(intent),
      onVariableSelect: variable => this.handleVariableSelect(variable),
      onAlgorithmSelect: algorithm => this.handleAlgorithmSelect(algorithm),
      selectedVariable: state.selectedVariable,
      selectedAlgorithm: state.selectedAlgorithm,
      isGenerating: state.isGenerating,
      tracker: this.tracker,
      aiService: this.aiService,
      libraryService: this.libraryService
    });
    this.node.appendChild(this.inputPanelWidget.node);

    // Subscribe to state changes
    this.stateManager.subscribe(newState => this.onStateUpdate(newState));

    // Subscribe to active cell changes
    this.tracker.activeCellChanged.connect(this.onActiveCellChanged, this);
  }

  /**
   * Handle state updates
   */
  private onStateUpdate(state: IAiSidebarState): void {
    this.inputPanelWidget.updateProps({
      selectedVariable: state.selectedVariable,
      selectedAlgorithm: state.selectedAlgorithm,
      isGenerating: state.isGenerating
    });

    // Note: Chat history updates are handled incrementally in appendHistory
    // to avoid re-rendering the entire list
  }

  /**
   * Handles variable selection from InputPanel
   */
  private handleVariableSelect(variable: IVariableInfo | undefined): void {
    this.stateManager.setState({ selectedVariable: variable });
    this.updateStructuredIntent();
  }

  /**
   * Handles algorithm selection from InputPanel
   */
  private handleAlgorithmSelect(algorithm: IAlgorithmInfo | undefined): void {
    if (!algorithm) {
      this.stateManager.setState({ selectedAlgorithm: undefined });
    } else {
      let selectedAlgorithm = algorithm;
      // If params and expectedOutput are not provided, get them from the service
      if (!algorithm.params || !algorithm.expectedOutput) {
        const meta = this.libraryService.getDefaultAlgorithmMeta(algorithm.id);
        selectedAlgorithm = {
          id: algorithm.id,
          name: algorithm.name,
          category: algorithm.category || 'General',
          params: algorithm.params || meta.params,
          expectedOutput: algorithm.expectedOutput || meta.expectedOutput,
          prompt: algorithm.prompt
        };
      }
      this.stateManager.setState({ selectedAlgorithm });
    }
    this.updateStructuredIntent();
  }

  /**
   * Handle active cell changes
   */
  private async onActiveCellChanged() {
    const notebookPanel = this.tracker.currentWidget;
    const cell = this.tracker.activeCell;

    if (!notebookPanel || !cell) {
      return;
    }

    const notebookId = notebookPanel.context.path;
    const cellId = cell.model.id;

    // Load history for the new cell
    await this.loadHistory(notebookId, cellId);
  }

  /**
   * Load session history from backend
   */
  private async loadHistory(notebookId: string, cellId: string) {
    const sessionData = await this.aiService.getSessionHistory(
      notebookId,
      cellId
    );

    let messages: IChatMessage[] = [];

    if (sessionData && sessionData.interactions) {
      messages = this.convertInteractionsToMessages(sessionData.interactions);
    }

    // Update UI
    this.chatHistoryWidget.clear();
    messages.forEach(msg => this.chatHistoryWidget.addMessage(msg));

    this.stateManager.setState({
      chatHistory: messages
    });
  }

  /**
   * Convert backend interactions to chat messages
   */
  private convertInteractionsToMessages(interactions: any[]): IChatMessage[] {
    const messages: IChatMessage[] = [];

    interactions.forEach((interaction: any) => {
      // User message
      messages.push({
        id: `user-${interaction.turn_id}`,
        sender: 'user',
        content: interaction.user_request.intent,
        timestamp: new Date(interaction.timestamp)
      });

      // AI message
      if (interaction.ai_response) {
        // Format content with explanation as comments
        const explanation = interaction.ai_response.explanation || '';
        const suggestion = interaction.ai_response.suggestion || '';
        const summary = interaction.ai_response.summary || '';
        const detailedSummary = interaction.ai_response.detailed_summary || '';
        const content = explanation
          ? `# ${explanation.replace(/\n/g, '\n# ')}\n\n${suggestion}`
          : suggestion;

        messages.push({
          id: `ai-${interaction.turn_id}`,
          sender: 'ai',
          content: content,
          timestamp: new Date(interaction.timestamp),
          showApplyButton: true,
          summary: summary,
          detailedSummary: detailedSummary
        });
      }
    });

    return messages;
  }

  /**
   * Clears the chat history
   */
  private async clearHistory() {
    // Get current cell info
    const notebookPanel = this.tracker.currentWidget;
    const cell = this.tracker.activeCell;

    if (notebookPanel && cell) {
      const notebookId = notebookPanel.context.path;
      const cellId = cell.model.id;

      // Reset backend session
      await this.aiService.resetSession(notebookId, cellId);
    }

    this.chatHistoryWidget.clear();
    this.stateManager.setState({ chatHistory: [] });
  }

  /**
   * 运行单元格并检查是否有错误
   */
  private async runCellAndCheckError(
    panel: NotebookPanel
  ): Promise<{ hasError: boolean; errorOutput?: string }> {
    const sessionContext = panel.context.sessionContext;
    await NotebookActions.run(panel.content, sessionContext);

    const cell = panel.content.activeCell;
    if (!cell || cell.model.type !== 'code') {
      return { hasError: false };
    }

    const outputs = (cell.model.toJSON() as any).outputs;
    if (!outputs || !Array.isArray(outputs)) {
      return { hasError: false };
    }

    const errorOutput = outputs.find((o: any) => o.output_type === 'error');
    if (errorOutput) {
      // Format error message
      const traceback = (errorOutput.traceback as string[]).join('\n');
      return { hasError: true, errorOutput: traceback };
    }

    return { hasError: false };
  }

  /**
   * 处理 Build 模式：自动生成 -> 运行 -> 修复
   */
  private async handleBuildMode(
    panel: NotebookPanel,
    intent: string,
    mode: string,
    variables: any[]
  ) {
    let currentIntent = intent;
    // Build模式下如果是初次生成，可以使用用户选择的模式，后续修复强制切换到fix模式
    let currentMode = mode;
    const maxRetries = 5;
    let retryCount = 0;
    const state = this.stateManager.getState();

    this.appendHistory('System', '开始 Build 模式...', 'info');

    while (retryCount <= maxRetries) {
      // 1. Generate Code
      const cell = panel.content.activeCell;
      if (!cell || cell.model.type !== 'code') {
        break;
      }
      const source = cell.model.sharedModel.getSource();
      const includeContext = this.inputPanelWidget.getIncludeContext();
      const useSystemLibrary = this.inputPanelWidget.getUseSystemLibrary();

      const payload = this.aiService.buildAiRequestPayload(
        panel,
        source,
        currentIntent,
        currentMode,
        includeContext,
        variables,
        { variable: state.selectedVariable, algorithm: state.selectedAlgorithm },
        useSystemLibrary
      );

      const resp = await this.aiService.requestGenerate(payload);

      if (resp.error) {
        this.appendHistory('AI', `生成错误: ${resp.error}`, 'error');
        break;
      }

      // 2. Apply Code automatically
      const suggestion = resp.suggestion;
      this.appendHistory(
        'AI',
        `${suggestion}`,
        'normal',
        true,
        resp.summary,
        resp.detailed_summary,
        retryCount + 1
      );

      // 强制应用代码，不弹Diff
      await this.applySuggestion(panel, suggestion, 'create'); // force overwrite

      // 3. Run and Check
      const result = await this.runCellAndCheckError(panel);

      if (!result.hasError) {
        this.appendHistory('System', 'Build 成功！代码运行无误。', 'success');
        return;
      }

      // 4. Prepare for retry
      retryCount++;
      if (retryCount > maxRetries) {
        this.appendHistory(
          'System',
          `Build 失败：已达到最大重试次数 (${maxRetries})。\n最后一次错误：\n${result.errorOutput}`,
          'error'
        );
        break;
      }

      this.appendHistory(
        'System',
        `运行出错，正在尝试修复 (${retryCount}/${maxRetries})...`,
        'warning'
      );

      // Update intent for fix
      currentIntent = `修复以下错误:\n${result.errorOutput}`;
      // Switch to fix mode for subsequent retries
      currentMode = 'fix';
    }
  }

  private async handleGenerate(intentOverride?: string) {
    const panel = this.tracker.currentWidget;
    if (!panel) {
      this.appendHistory('System', '未检测到活动的 Notebook。', 'error');
      return;
    }

    // Get intent from override or InputPanel
    let intent = intentOverride?.trim();

    // If no intent provided, try to get from input widget or auto-generate
    if (!intent) {
      const intentValue = this.inputPanelWidget.getValue().trim();
      if (!intentValue) {
        this.updateStructuredIntent();
        // After updateStructuredIntent, the input widget has the new value
        intent = this.inputPanelWidget.getValue().trim();
      } else {
        intent = intentValue;
      }
    }

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

      const workflowMode = this.inputPanelWidget.getWorkflowMode();

      if (workflowMode === 'build') {
        await this.handleBuildMode(panel, intent, mode, variables);
        return;
      }

      const state = this.stateManager.getState();
      const includeContext = this.inputPanelWidget.getIncludeContext();
      const useSystemLibrary = this.inputPanelWidget.getUseSystemLibrary();
      const payload = this.aiService.buildAiRequestPayload(
        panel,
        source,
        intent,
        mode,
        includeContext,
        variables,
        { variable: state.selectedVariable, algorithm: state.selectedAlgorithm },
        useSystemLibrary
      );
      const resp = await this.aiService.requestGenerate(payload);

      if (resp.error) {
        this.appendHistory(
          'AI',
          `错误: ${resp.error}\n\n建议:\n${resp.suggestion}`,
          'error'
        );
      } else {
        this.appendHistory(
          'AI',
          resp.suggestion,
          'success',
          true,
          resp.summary,
          resp.detailed_summary
        );
      }
    } catch (e) {
      this.appendHistory(
        'System',
        `请求失败: ${e instanceof Error ? e.message : String(e)}`,
        'error'
      );
    } finally {
      // Update InputPanel to show not generating state
      this.stateManager.setState({ isGenerating: false });
    }
  }

  /**
   * 预览单元格与AI建议的差异，并在用户接受后应用
   */
  private async previewAndApply(suggestion: string) {
    const panel = this.tracker.currentWidget;
    if (!panel) {
      return;
    }

    const mode = this.inputPanelWidget.getMode() as
      | 'create'
      | 'explain'
      | 'fix'
      | 'refactor'
      | 'normalize';

    const content = panel.content;
    const cell = content.activeCell;
    if (!cell || cell.model.type !== 'code') {
      return;
    }
    // 若当前单元格为空，直接应用，不弹出Diff预览
    const isEmpty =
      (cell.model.sharedModel.getSource() || '').trim().length === 0;
    if (isEmpty && mode !== 'explain') {
      await this.applySuggestion(panel, suggestion, mode);
      this.appendHistory('System', '空单元格已直接应用代码。', 'success');
      return;
    }
    const oldText =
      mode === 'explain' ? '' : cell.model.sharedModel.getSource();
    const newText = suggestion;

    if (mode === 'explain') {
      // 对于说明模式，旧文本为空，仅展示新文本的预览
      // 接受时将插入新的Markdown单元格
      // 这里的Diff依然可以帮助用户确认内容
      // newText 已为建议内容
    }

    DiffViewer.show({
      oldText,
      newText,
      onAccept: async (finalText: string) => {
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
      onReject: () => {
        this.appendHistory('System', '已取消应用AI建议。', 'info');
      }
    });
  }

  /**
   * 将建议应用到Notebook
   */
  private async applySuggestion(
    panel: NotebookPanel,
    suggestion: string,
    mode: 'create' | 'explain' | 'fix' | 'refactor' | 'normalize'
  ): Promise<void> {
    const content = panel.content;
    const cell = content.activeCell;
    if (!cell || cell.model.type !== 'code') {
      return;
    }

    if (
      mode === 'create' ||
      mode === 'fix' ||
      mode === 'refactor' ||
      mode === 'normalize'
    ) {
      cell.model.sharedModel.setSource(suggestion);
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
    showApplyBtn = false,
    summary?: string,
    detailedSummary?: string,
    iteration?: number
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
    const message: IChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      sender: messageSender,
      content: text,
      type: type,
      timestamp: new Date(),
      showApplyButton: showApplyBtn,
      summary: summary,
      detailedSummary: detailedSummary,
      iteration: iteration
    };

    // Use ChatHistory component to add the message
    this.chatHistoryWidget.addMessage(message);
  }

  /**
   * 基于选择生成并填充结构化提示词
   */
  private updateStructuredIntent() {
    const state = this.stateManager.getState();
    const text = this.libraryService.generateStructuredPrompt(
      state.selectedVariable,
      state.selectedAlgorithm
    );
    this.inputPanelWidget.setValue(text);
  }
}
