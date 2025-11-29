import { ToolbarButton, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { LabIcon } from '@jupyterlab/ui-components';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

// AI助手图标
export const aiAssistantIcon = new LabIcon({
  name: 'datafilemanager:ai',
  svgstr:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="7" width="16" height="10" rx="3" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><path d="M12 4v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
});

export const workflowEditorIcon = new LabIcon({
  name: 'datafilemanager:workflow',
  svgstr:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M9 6L18 12" stroke="currentColor" stroke-width="1.5"/><path d="M9 18L18 12" stroke="currentColor" stroke-width="1.5"/></svg>'
});

/**
 * AI按钮管理器类，负责在Notebook面板的工具栏中添加AI助手按钮
 */
export class AiButtonManager {
  constructor(
    private notebookTracker?: INotebookTracker,
    private toolbarRegistry?: IToolbarWidgetRegistry,
    private openAiDialog?: (panel: NotebookPanel) => Promise<void>,
    private openWorkflowEditor?: () => void
  ) {}

  /**
   * 通过 Toolbar Registry 为 Notebook 注册 AI 按钮
   */
  registerAiToolbarFactory(): void {
    if (!this.toolbarRegistry) {
      return;
    }

    if (this.openAiDialog) {
      this.toolbarRegistry.addFactory(
        'Notebook',
        'ai-assist',
        (panel: NotebookPanel) => {
          return new ToolbarButton({
            icon: aiAssistantIcon,
            tooltip: 'AI Assist',
            onClick: () => {
              void this.openAiDialog!(panel);
            }
          });
        }
      );
    }

    if (this.openWorkflowEditor) {
      this.toolbarRegistry.addFactory(
        'Notebook',
        'workflow-editor',
        (panel: NotebookPanel) => {
          return new ToolbarButton({
            icon: workflowEditorIcon,
            tooltip: 'Workflow Editor',
            onClick: () => {
              this.openWorkflowEditor!();
            }
          });
        }
      );
    }
  }

  /**
   * 为Notebook面板添加AI助手按钮和Workflow按钮
   */
  addAiButtonToPanel(panel: NotebookPanel): void {
    // 1. Add AI Button
    if (this.openAiDialog) {
      const existingAi = panel.toolbar.node.querySelector(
        '[data-id="ai-assist-button"]'
      );
      if (!existingAi) {
        const button = new ToolbarButton({
          icon: aiAssistantIcon,
          tooltip: 'AI Assist',
          onClick: () => {
            void this.openAiDialog!(panel);
          }
        });
        (button.node as HTMLElement).setAttribute(
          'data-id',
          'ai-assist-button'
        );
        panel.toolbar.insertItem(0, 'ai-assist', button);
      }
    }

    // 2. Add Workflow Button after AI Button
    if (this.openWorkflowEditor) {
      const existingWorkflow = panel.toolbar.node.querySelector(
        '[data-id="workflow-editor-button"]'
      );
      if (!existingWorkflow) {
        const button = new ToolbarButton({
          icon: workflowEditorIcon,
          tooltip: 'Workflow Editor',
          onClick: () => {
            this.openWorkflowEditor!();
          }
        });
        (button.node as HTMLElement).setAttribute(
          'data-id',
          'workflow-editor-button'
        );

        // Try to insert after 'ai-assist'
        try {
          panel.toolbar.insertAfter('ai-assist', 'workflow-editor', button);
        } catch (e) {
          // Fallback: insert at index 1 (since ai-assist is at 0)
          panel.toolbar.insertItem(1, 'workflow-editor', button);
        }
      }
    }
  }

  /**
   * 初始化AI按钮功能
   * 1. 注册工具栏工厂
   * 2. 为当前存在的Notebook面板添加AI按钮
   * 3. 为新创建的Notebook面板添加AI按钮
   */
  initialize(): void {
    // 注册工具栏工厂
    this.registerAiToolbarFactory();

    // 为当前存在的Notebook面板添加AI按钮
    if (this.notebookTracker && this.notebookTracker.currentWidget) {
      this.addAiButtonToPanel(this.notebookTracker.currentWidget);
    }

    // 为新创建的Notebook面板添加AI按钮
    if (this.notebookTracker) {
      this.notebookTracker.widgetAdded.connect((sender, panel) => {
        this.addAiButtonToPanel(panel);
      });
    }
  }

  /**
   * 设置打开AI对话框的回调函数
   */
  setDialogCallback(callback: (panel: NotebookPanel) => Promise<void>): void {
    this.openAiDialog = callback;
  }

  /**
   * 设置打开Workflow Editor的回调函数
   */
  setWorkflowCallback(callback: () => void): void {
    this.openWorkflowEditor = callback;
  }
}
