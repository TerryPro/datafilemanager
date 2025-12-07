import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { WorkflowButtonManager } from '../workflow/workflow-button-manager';

/**
 * 命令管理器
 * 负责注册和管理扩展的命令和组件
 * 
 * Note: Algorithm library command registration has been moved to the algorithm plugin
 */
export class CommandManager {
  private app: JupyterFrontEnd;
  private workflowButtonManager: WorkflowButtonManager;

  constructor(
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker | undefined,
    toolbarRegistry?: IToolbarWidgetRegistry
  ) {
    this.app = app;
    // 创建Workflow按钮管理器
    this.workflowButtonManager = new WorkflowButtonManager(
      notebookTracker,
      toolbarRegistry,
      () => {
        // 打开Workflow Editor的回调函数
        const workflowCommandId = 'datafilemanager:open-workflow-editor';
        void this.app.commands.execute(workflowCommandId);
      }
    );
  }

  /**
   * 初始化组件和命令
   */
  initialize(): void {
    // 初始化Workflow Editor按钮
    this.workflowButtonManager.initialize();
  }
}
