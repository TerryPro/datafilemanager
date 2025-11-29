import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { showErrorMessage } from '@jupyterlab/apputils';
import { AiDialogManager } from './ai-dialog-manager';
import { AiButtonManager } from './ai-button-manager';
import { AlgorithmLibraryDialogManager } from './algorithm-library-dialog';

/**
 * AI命令管理器
 * 负责注册和管理AI相关的命令和组件
 */
export class AiCommandManager {
  private app: JupyterFrontEnd;
  private notebookTracker?: INotebookTracker;
  private toolbarRegistry?: IToolbarWidgetRegistry;
  private aiDialogManager: AiDialogManager;
  private aiButtonManager?: AiButtonManager;
  private algorithmLibraryDialogManager: AlgorithmLibraryDialogManager;

  constructor(
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker | undefined,
    toolbarRegistry?: IToolbarWidgetRegistry
  ) {
    this.app = app;
    this.notebookTracker = notebookTracker;
    this.toolbarRegistry = toolbarRegistry;
    // 创建AI对话框管理器
    this.aiDialogManager = new AiDialogManager(app);
    this.algorithmLibraryDialogManager = new AlgorithmLibraryDialogManager(app);
  }

  /**
   * 初始化AI组件和命令
   */
  initialize(): void {
    // 创建AI按钮管理器
    this.aiButtonManager = new AiButtonManager(
      this.notebookTracker,
      this.toolbarRegistry
    );

    // 设置AI对话框回调函数
    this.aiButtonManager.setDialogCallback(panel =>
      this.aiDialogManager.openAiDialog(panel)
    );

    // 设置Workflow Editor回调函数
    this.aiButtonManager.setWorkflowCallback(() => {
      this.app.commands.execute('datafilemanager:open-workflow-editor');
    });

    // 初始化AI按钮功能
    this.aiButtonManager.initialize();

    // 提供命令形式，便于通过 settings 的默认按钮机制加入工具栏
    const aiOpenCommand = 'datafilemanager:ai-open';
    this.app.commands.addCommand(aiOpenCommand, {
      label: 'AI',
      caption: 'AI Assist',
      execute: async () => {
        const panel =
          this.notebookTracker?.currentWidget ??
          (this.app.shell.currentWidget as NotebookPanel | null);
        if (panel) {
          await this.aiDialogManager.openAiDialog(panel);
        } else {
          await showErrorMessage('AI Assist', '未检测到活动的Notebook');
        }
      }
    });

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
