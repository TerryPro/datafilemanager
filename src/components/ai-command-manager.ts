import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { showErrorMessage } from '@jupyterlab/apputils';
import { AiDialogManager } from './ai-dialog-manager';
import { AiButtonManager } from './ai-button-manager';

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
  }
}
