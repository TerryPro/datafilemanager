import { Widget } from '@lumino/widgets';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { LabIcon } from '@jupyterlab/ui-components';
import { AiService } from '../../services/ai-service';
import { ICONS } from './utils/icons';
import { IVariableInfo, IAlgorithmInfo, IChatMessage } from './state/types';
import { StateManager, IAiSidebarState } from './state/ai-sidebar-state';
import { ChatHistory } from './components/chat-history';
import { InputPanel } from './components/input-panel';
import { DiffViewer } from './components/diff-viewer';

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
  private stateManager: StateManager;
  private chatHistoryWidget: ChatHistory;
  private inputPanelWidget: InputPanel;

  constructor(app: JupyterFrontEnd, tracker: INotebookTracker) {
    super();
    this.app = app;
    this.id = 'ai-sidebar';
    this.title.icon = aiAssistantIcon;
    this.title.caption = 'AI Assistant';
    this.addClass('jp-AiSidebar');

    this.tracker = tracker;
    this.aiService = new AiService();
    this.stateManager = new StateManager();

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
      messages: this.stateManager.getState().chatHistory,
      onApplyCode: code => this.previewAndApply(code)
    });
    this.node.appendChild(this.chatHistoryWidget.node);

    // Input Panel - using InputPanel component
    const state = this.stateManager.getState();
    this.inputPanelWidget = new InputPanel({
      onGenerate: intent => this.handleGenerate(),
      onVariableSelect: variable => this.handleVariableSelect(variable),
      onAlgorithmSelect: algorithm => this.handleAlgorithmSelect(algorithm),
      selectedVariable: state.selectedVariable,
      selectedAlgorithm: state.selectedAlgorithm,
      isGenerating: state.isGenerating,
      tracker: this.tracker,
      aiService: this.aiService
    });
    this.node.appendChild(this.inputPanelWidget.node);

    // Subscribe to state changes
    this.stateManager.subscribe(newState => this.onStateUpdate(newState));
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
        const meta = this.aiService.getDefaultAlgorithmMeta(algorithm.id);
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

  private clearHistory() {
    this.chatHistoryWidget.clear();
    this.stateManager.setState({ chatHistory: [] });
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

      const state = this.stateManager.getState();
      const payload = this.aiService.buildAiRequestPayload(
        panel,
        source,
        intent,
        mode,
        false,
        variables,
        { variable: state.selectedVariable, algorithm: state.selectedAlgorithm }
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
    mode: 'create' | 'explain' | 'fix' | 'refactor'
  ): Promise<void> {
    const content = panel.content;
    const cell = content.activeCell;
    if (!cell || cell.model.type !== 'code') {
      return;
    }

    if (mode === 'create' || mode === 'fix' || mode === 'refactor') {
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
    const message: IChatMessage = {
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
   * 基于选择生成并填充结构化提示词
   */
  private updateStructuredIntent() {
    const state = this.stateManager.getState();
    const text = this.aiService.generateStructuredPrompt(
      state.selectedVariable,
      state.selectedAlgorithm
    );
    this.inputPanelWidget.setValue(text);
  }
}
