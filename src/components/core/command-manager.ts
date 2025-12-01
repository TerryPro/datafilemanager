import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { showErrorMessage } from '@jupyterlab/apputils';
import { AlgorithmLibraryDialogManager } from '../algorithm/algorithm-library-dialog';
import { WorkflowButtonManager } from '../workflow/workflow-button-manager';

/**
 * 命令管理器
 * 负责注册和管理扩展的命令和组件
 */
export class CommandManager {
  private app: JupyterFrontEnd;
  private notebookTracker?: INotebookTracker;
  private algorithmLibraryDialogManager: AlgorithmLibraryDialogManager;
  private workflowButtonManager: WorkflowButtonManager;

  constructor(
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker | undefined,
    toolbarRegistry?: IToolbarWidgetRegistry
  ) {
    this.app = app;
    this.notebookTracker = notebookTracker;
    // 创建算法库对话框管理器
    this.algorithmLibraryDialogManager = new AlgorithmLibraryDialogManager(app);
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

    // 注册打开算法库对话框的命令
    const algoLibraryOpenCommand = 'datafilemanager:open-algorithm-library';
    this.app.commands.addCommand(algoLibraryOpenCommand, {
      label: 'Open Algorithm Library',
      execute: async args => {
        const panel =
          this.notebookTracker?.currentWidget ??
          (this.app.shell.currentWidget as NotebookPanel | null);
        if (panel) {
          // 可以在 args 中传入初始选中的算法ID
          // 目前 AlgorithmLibraryDialogManager 还不支持传入ID直接打开特定算法，
          // 这里先保留接口，后续可以增强 AlgorithmLibraryDialogManager
          await this.algorithmLibraryDialogManager.openLibraryDialog(
            panel,
            null
          );
        } else {
          await showErrorMessage('Algorithm Library', '未检测到活动的Notebook');
        }
      }
    });
  }
}
