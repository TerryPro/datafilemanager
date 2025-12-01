import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ITranslator } from '@jupyterlab/translation';
import { IFileBrowserFactory, FileBrowser } from '@jupyterlab/filebrowser';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { ServiceManager } from '@jupyterlab/services';
import { DataFramePanel } from './components/dataframe/dataframe-panel';
import { CsvFileManager } from './components/file/csv-file-manager';
import { CommandManager } from './components/command-manager';
import { AiSidebar } from './components/ai-sidebar';
import { AlgorithmLibraryPanel } from './components/algorithm/algorithm-library-panel';
import { WorkflowWidget } from './components/workflow/WorkflowWidget';

// 创建一个全局变量来跟踪文件浏览器实例
const tracker: {
  currentWidget: FileBrowser | null;
} = {
  currentWidget: null
};

/**
 * Initialization data for the datafilemanager extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'datafilemanager:plugin',
  description: 'manager csv data file',
  autoStart: true,
  requires: [
    IFileBrowserFactory,
    IDocumentManager,
    ICommandPalette,
    ITranslator
  ],
  optional: [INotebookTracker, IToolbarWidgetRegistry],
  activate: (
    app: JupyterFrontEnd,
    browserFactory: IFileBrowserFactory,
    docManager: IDocumentManager,
    palette: ICommandPalette,
    translator: ITranslator,
    notebookTracker?: INotebookTracker,
    toolbarRegistry?: IToolbarWidgetRegistry
  ) => {
    console.log('JupyterLab extension datafilemanager is activated!');
    // 创建CSV文件管理器组件
    const csvFileManager = new CsvFileManager(
      app,
      browserFactory,
      docManager,
      palette,
      translator,
      notebookTracker
    );

    // 设置tracker
    tracker.currentWidget = csvFileManager.getFileBrowser();

    /**
     * 创建并注册左侧 DataFrame 检视面板，显示当前笔记本中的所有 DataFrame 变量
     */
    const dfPanelComponent = new DataFramePanel(
      app,
      app.commands,
      translator,
      notebookTracker
    );
    app.shell.add(dfPanelComponent.panel, 'left', { rank: 102 });

    // 创建命令管理器，它会自动初始化所有组件
    const aiCommandManager = new CommandManager(
      app,
      notebookTracker,
      toolbarRegistry
    );
    // 初始化AI组件和命令
    aiCommandManager.initialize();

    // 注册 AI 侧边栏
    if (notebookTracker) {
      const aiSidebar = new AiSidebar(app, notebookTracker);
      app.shell.add(aiSidebar, 'right', { rank: 1000 });

      // 注册左侧算法库面板
      const algoPanel = new AlgorithmLibraryPanel(app, notebookTracker);
      app.shell.add(algoPanel, 'left', { rank: 103 });

      // Restrict default file browser to 'notebook' directory
      const defaultBrowser = browserFactory.tracker?.currentWidget || null;
      if (defaultBrowser) {
        // Initial navigation
        void defaultBrowser.model.cd('notebook');

        // Observer to hide ".." when at 'notebook' root
        const observer = new MutationObserver(() => {
          if (defaultBrowser.model.path === 'notebook') {
            const upDirItem = defaultBrowser.node.querySelector(
              '.jp-DirListing-item[data-isdir="true"]:first-child'
            );
            if (upDirItem && upDirItem.textContent?.includes('..')) {
              (upDirItem as HTMLElement).style.display = 'none';
            }
          }
        });

        observer.observe(defaultBrowser.node, {
          childList: true,
          subtree: true
        });
      }

      // Register Workflow Editor Command
      const workflowCommandId = 'datafilemanager:open-workflow-editor';
      app.commands.addCommand(workflowCommandId, {
        label: 'Open Workflow Editor',
        execute: () => {
          // Cast to ServiceManager because the type definition in JupyterFrontEnd might be slightly different
          // or IManager interface is a subset.
          const serviceManager =
            app.serviceManager as unknown as ServiceManager;
          const content = new WorkflowWidget(notebookTracker, serviceManager);

          // Open in split-right mode by default to show side-by-side with notebook
          app.shell.add(content, 'main', { mode: 'split-right' });

          // Activate the widget
          app.shell.activateById(content.id);
        }
      });

      palette.addItem({ command: workflowCommandId, category: 'Workflow' });
    }
  }
};

export default plugin;
