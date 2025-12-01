import { ToolbarButton, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { LabIcon } from '@jupyterlab/ui-components';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

export const workflowEditorIcon = new LabIcon({
  name: 'datafilemanager:workflow',
  svgstr:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M9 6L18 12" stroke="currentColor" stroke-width="1.5"/><path d="M9 18L18 12" stroke="currentColor" stroke-width="1.5"/></svg>'
});

/**
 * Workflow Editor按钮管理器类，负责在Notebook面板的工具栏中添加Workflow Editor按钮
 */
export class WorkflowButtonManager {
  constructor(
    private notebookTracker?: INotebookTracker,
    private toolbarRegistry?: IToolbarWidgetRegistry,
    private openWorkflowEditor?: () => void
  ) {}

  /**
   * 通过 Toolbar Registry 为 Notebook 注册 Workflow Editor按钮
   */
  registerWorkflowToolbarFactory(): void {
    if (!this.toolbarRegistry || !this.openWorkflowEditor) {
      return;
    }

    const openWorkflowEditor = this.openWorkflowEditor;
    this.toolbarRegistry.addFactory(
      'Notebook',
      'workflow-editor',
      (panel: NotebookPanel) => {
        return new ToolbarButton({
          icon: workflowEditorIcon,
          tooltip: 'Workflow Editor',
          onClick: () => {
            openWorkflowEditor();
          }
        });
      }
    );
  }

  /**
   * 为Notebook面板添加Workflow Editor按钮
   */
  addWorkflowButtonToPanel(panel: NotebookPanel): void {
    if (!this.openWorkflowEditor) {
      return;
    }

    const openWorkflowEditor = this.openWorkflowEditor;
    const existingWorkflow = panel.toolbar.node.querySelector(
      '[data-id="workflow-editor-button"]'
    );
    if (!existingWorkflow) {
      const button = new ToolbarButton({
        icon: workflowEditorIcon,
        tooltip: 'Workflow Editor',
        onClick: () => {
          openWorkflowEditor();
        }
      });
      (button.node as HTMLElement).setAttribute(
        'data-id',
        'workflow-editor-button'
      );
      panel.toolbar.insertItem(0, 'workflow-editor', button);
    }
  }

  /**
   * 初始化Workflow Editor按钮功能
   * 1. 注册工具栏工厂
   * 2. 为当前存在的Notebook面板添加Workflow Editor按钮
   * 3. 为新创建的Notebook面板添加Workflow Editor按钮
   */
  initialize(): void {
    // 注册工具栏工厂
    this.registerWorkflowToolbarFactory();

    // 为当前存在的Notebook面板添加Workflow Editor按钮
    if (this.notebookTracker && this.notebookTracker.currentWidget) {
      this.addWorkflowButtonToPanel(this.notebookTracker.currentWidget);
    }

    // 为新创建的Notebook面板添加Workflow Editor按钮
    if (this.notebookTracker) {
      this.notebookTracker.widgetAdded.connect((sender, panel) => {
        this.addWorkflowButtonToPanel(panel);
      });
    }
  }

  /**
   * 设置打开Workflow Editor的回调函数
   */
  setWorkflowCallback(callback: () => void): void {
    this.openWorkflowEditor = callback;
  }
}
