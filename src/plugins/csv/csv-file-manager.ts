import { JupyterFrontEnd } from '@jupyterlab/application';

import {
  IFileBrowserFactory,
  FileBrowser,
  FilterFileBrowserModel
} from '@jupyterlab/filebrowser';

import { IDocumentManager } from '@jupyterlab/docmanager';

import {
  ICommandPalette,
  MainAreaWidget,
  Clipboard,
  InputDialog,
  showErrorMessage
} from '@jupyterlab/apputils';
import { ITranslator } from '@jupyterlab/translation';
import { Menu } from '@lumino/widgets';
import { PageConfig, URLExt, PathExt } from '@jupyterlab/coreutils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { AiService } from '../../services/ai-service';

const tracker: {
  currentWidget: FileBrowser | null;
} = {
  currentWidget: null
};

export class CsvFileManager {
  private app: JupyterFrontEnd;
  private docManager: IDocumentManager;
  private palette: ICommandPalette;
  private translator: ITranslator;
  private notebookTracker?: INotebookTracker;
  private fileBrowser: FileBrowser;
  private widget: MainAreaWidget<FileBrowser>;
  private commands: any;
  private aiService: AiService;

  constructor(
    app: JupyterFrontEnd,
    browserFactory: IFileBrowserFactory,
    docManager: IDocumentManager,
    palette: ICommandPalette,
    translator: ITranslator,
    notebookTracker?: INotebookTracker
  ) {
    this.app = app;
    this.docManager = docManager;
    this.palette = palette;
    this.translator = translator;
    this.notebookTracker = notebookTracker;
    this.commands = app.commands;
    this.aiService = new AiService();

    const model = new FilterFileBrowserModel({
      manager: docManager,
      driveName: '',
      refreshInterval: 300000
    });

    this.fileBrowser = new FileBrowser({
      id: 'datafilemanager',
      model,
      restore: false
    });

    this.widget = new MainAreaWidget<FileBrowser>({
      content: this.fileBrowser
    });

    this.widget.id = 'datafilemanager-file-browser';
    this.widget.title.iconClass = 'jp-MaterialIcon jp-FolderIcon';
    this.widget.title.label = '';
    this.widget.title.caption = 'CSV Data File Manager';

    model.cd('dataset').catch(reason => {
      console.error('Failed to change directory to dataset:', reason);
    });

    this.app.shell.add(this.widget, 'left', { rank: 100 });

    tracker.currentWidget = this.fileBrowser;

    this.initializeCommands();
    this.registerContextMenuHook();
    this.removeBreadcrumbs();
  }

  /**
   * 初始化并注册命令
   */
  private initializeCommands(): void {
    const trans = this.translator.load('jupyterlab');

    const openCommand = 'datafilemanager:open';
    this.commands.addCommand(openCommand, {
      label: 'Open Data File Manager',
      caption: 'Open the CSV data file manager',
      execute: () => {
        this.app.shell.activateById(this.widget.id);
      }
    });
    this.palette.addItem({
      command: openCommand,
      category: 'Data File Manager'
    });

    const uploadCommand = 'datafilemanager:upload';
    this.commands.addCommand(uploadCommand, {
      label: trans.__('Upload'),
      caption: trans.__('Upload files to the dataset directory'),
      iconClass: 'jp-MaterialIcon jp-UploadIcon',
      execute: () => {
        this.fileBrowser.node.click();
        const uploadInput = document.createElement('input');
        uploadInput.type = 'file';
        uploadInput.multiple = true;
        uploadInput.onchange = (event: Event) => {
          const target = event.target as HTMLInputElement;
          if (target.files && target.files.length > 0) {
            const files = Array.from(target.files);
            files.forEach(file => {
              this.fileBrowser.model.upload(file, this.fileBrowser.model.path);
            });
          }
        };
        uploadInput.click();
      }
    });

    const deleteCommand = 'datafilemanager:delete';
    this.commands.addCommand(deleteCommand, {
      label: trans.__('Delete'),
      caption: trans.__('Delete selected file'),
      iconClass: 'jp-MaterialIcon jp-CloseIcon',
      execute: () => {
        const widget = tracker.currentWidget;
        if (widget) {
          const selectedItems = widget.selectedItems();
          return Promise.all(
            Array.from(selectedItems).map(item =>
              this.docManager.deleteFile(item.path)
            )
          );
        }
      }
    });

    const renameCommand = 'datafilemanager:rename';
    this.commands.addCommand(renameCommand, {
      label: trans.__('Rename'),
      caption: trans.__('Rename selected item'),
      iconClass: 'jp-MaterialIcon jp-EditIcon',
      execute: () => {
        const widget = tracker.currentWidget;
        if (widget) {
          return widget.rename();
        }
      }
    });

    const openEntryCommand = 'datafilemanager:open-entry';
    this.commands.addCommand(openEntryCommand, {
      label: trans.__('Open'),
      caption: trans.__('Open the selected item'),
      iconClass: 'jp-MaterialIcon jp-OpenIcon',
      execute: async () => {
        const widget = tracker.currentWidget;
        if (!widget) {
          return;
        }
        const selection = Array.from(widget.selectedItems());
        if (selection.length !== 1) {
          return;
        }
        const item = selection[0];
        if (item.type === 'directory') {
          await widget.model.cd(item.path);
        } else {
          await this.docManager.openOrReveal(item.path);
        }
      }
    });

    const loadDataCommand = 'datafilemanager:load-data';
    this.commands.addCommand(loadDataCommand, {
      label: 'LoadData',
      caption: trans.__('Insert code to load CSV into DataFrame'),
      iconClass: 'jp-MaterialIcon jp-RunIcon',
      execute: async () => {
        const selection = Array.from(this.fileBrowser.selectedItems());
        if (selection.length !== 1) {
          return;
        }
        const item = selection[0];
        const ext = PathExt.extname(item.path).toLowerCase();
        if (item.type !== 'file' || ext !== '.csv') {
          await showErrorMessage(
            trans.__('LoadData'),
            trans.__('Please select a single CSV file.')
          );
          return;
        }

        const panel =
          this.notebookTracker?.currentWidget ??
          (this.app.shell.currentWidget as NotebookPanel | null);
        if (!panel) {
          await showErrorMessage(
            trans.__('LoadData'),
            trans.__('No active notebook found.')
          );
          return;
        }

        let serverRoot = await this.aiService.getServerRoot();
        if (!serverRoot) {
          serverRoot = PageConfig.getOption('serverRoot') || '.';
        }

        const csvRelativePath = item.path.replace(/\\/g, '/');
        const csvAbsolutePath = PathExt.join(
          serverRoot,
          csvRelativePath
        ).replace(/\\/g, '/');

        const base = PathExt.basename(item.path);
        const nameNoExt = base.slice(0, base.length - ext.length);
        let varName = nameNoExt.replace(/[^0-9a-zA-Z_]/g, '_');
        if (!/^[A-Za-z_]/.test(varName)) {
          varName = 'df_' + varName;
        }
        if (!varName) {
          varName = 'df';
        }
        const code = [
          'import pandas as pd',
          `__base = r'${varName}'`,
          '__name = __base',
          '__i = 1',
          'while __name in globals():',
          '    __name = f"{__base}_{__i}"',
          '    __i += 1',
          `globals()[__name] = pd.read_csv(r'${csvAbsolutePath}')`,
          'globals()[__name].head()'
        ].join('\n');

        await this.applyCodeToNotebook(panel, code, true);
      }
    });

    const duplicateCommand = 'datafilemanager:duplicate';
    this.commands.addCommand(duplicateCommand, {
      label: trans.__('Duplicate'),
      caption: trans.__('Copy selected item to a new name'),
      iconClass: 'jp-MaterialIcon jp-CopyIcon',
      execute: async () => {
        const selection = Array.from(this.fileBrowser.selectedItems());
        if (selection.length === 0) {
          return;
        }
        for (const item of selection) {
          const dir = PathExt.dirname(item.path);
          const base = PathExt.basename(item.path);
          const ext = item.type === 'file' ? PathExt.extname(item.path) : '';
          const nameNoExt = ext
            ? base.slice(0, base.length - ext.length)
            : base;
          const defaultName =
            item.type === 'file'
              ? `${nameNoExt}-copy${ext}`
              : `${nameNoExt}-copy`;

          const res = await InputDialog.getText({
            title: trans.__('Copy to'),
            text: defaultName
          });
          if (!res.button.accept || !res.value) {
            continue;
          }
          const targetPath = PathExt.join(dir, res.value);
          try {
            const copied = await this.docManager.services.contents.copy(
              item.path,
              dir
            );
            if (copied.path !== targetPath) {
              await this.docManager.services.contents.rename(
                copied.path,
                targetPath
              );
            }
          } catch (e) {
            const model = await this.docManager.services.contents.get(
              item.path,
              {
                content: true
              }
            );
            await this.docManager.services.contents.save(targetPath, {
              type: model.type,
              format: model.format,
              content: model.content
            });
          }
        }
        await this.fileBrowser.model.refresh();
      }
    });

    const copyPathCommand = 'datafilemanager:copy-path';
    this.commands.addCommand(copyPathCommand, {
      label: trans.__('Copy Path'),
      caption: trans.__('Copy selected item path(s) to clipboard'),
      iconClass: 'jp-MaterialIcon jp-CopyIcon',
      execute: async () => {
        const items = Array.from(this.fileBrowser.selectedItems());
        if (items.length === 0) {
          return;
        }
        const text = items.map(i => i.path).join('\n');
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return;
          }
          throw new Error('Clipboard API unavailable');
        } catch {
          Clipboard.copyToSystem(text);
        }
      }
    });

    const downloadCommand = 'datafilemanager:download';
    this.commands.addCommand(downloadCommand, {
      label: trans.__('Download'),
      caption: trans.__('Download selected file(s)'),
      iconClass: 'jp-MaterialIcon jp-DownloadIcon',
      execute: async () => {
        const items = Array.from(this.fileBrowser.selectedItems());
        for (const item of items) {
          if (item.type !== 'directory') {
            try {
              const url =
                await this.docManager.services.contents.getDownloadUrl(
                  item.path
                );
              window.open(url);
            } catch (e) {
              const baseUrl = PageConfig.getBaseUrl();
              const url = URLExt.join(baseUrl, 'files', item.path);
              window.open(url);
            }
          }
        }
      }
    });
  }

  /**
   * 将生成的代码应用到当前Notebook
   */
  private async applyCodeToNotebook(
    panel: NotebookPanel,
    code: string,
    autoRun: boolean
  ): Promise<void> {
    const content = panel.content;
    const cell = content.activeCell;
    if (cell && cell.model.type === 'code') {
      const src = (cell.model.sharedModel.getSource() || '').trim();
      if (src.length === 0) {
        cell.model.sharedModel.setSource(code);
        if (autoRun) {
          await this.commands.execute('notebook:run-cell');
        }
        return;
      }
    }
    await this.commands.execute('notebook:insert-cell-below');
    const newCell = content.activeCell;
    if (newCell && newCell.model.type === 'code') {
      newCell.model.sharedModel.setSource(code);
      if (autoRun) {
        await this.commands.execute('notebook:run-cell');
      }
    }
  }

  /**
   * 右键菜单处理
   */
  private handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement;
    const itemNode = target.closest(
      '.jp-DirListing-item'
    ) as HTMLElement | null;

    const menu = new Menu({ commands: this.commands });
    const hasSelection =
      Array.from(this.fileBrowser.selectedItems()).length > 0;

    if (itemNode) {
      menu.addItem({ command: 'datafilemanager:open-entry' });
      menu.addItem({ type: 'separator' });
      if (hasSelection) {
        menu.addItem({ command: 'datafilemanager:load-data' });
        menu.addItem({ command: 'datafilemanager:duplicate' });
        menu.addItem({ command: 'datafilemanager:rename' });
        menu.addItem({ command: 'datafilemanager:delete' });
        menu.addItem({ command: 'datafilemanager:copy-path' });
        menu.addItem({ command: 'datafilemanager:download' });
        menu.addItem({ command: 'datafilemanager:upload' });
      }
    } else {
      menu.addItem({ command: 'datafilemanager:upload' });
    }

    menu.aboutToClose.connect(() => {
      menu.dispose();
    });
    menu.open(event.clientX, event.clientY);
  }

  /**
   * 注册右键监听
   */
  private registerContextMenuHook(): void {
    const listing = this.fileBrowser.node.querySelector(
      '.jp-DirListing-content'
    ) as HTMLElement | null;
    if (listing) {
      listing.addEventListener(
        'contextmenu',
        this.handleContextMenu.bind(this)
      );
    }
  }

  /**
   * 移除面包屑导航并持续隐藏相关元素
   */
  private removeBreadcrumbs(): void {
    const bc = this.fileBrowser.node.querySelector(
      '.jp-BreadCrumbs'
    ) as HTMLElement | null;
    if (bc) {
      bc.remove();
    }

    const style = document.createElement('style');
    style.textContent = `
      .jp-BreadCrumbs { display: none !important; }
      .jp-DirListing-header select,
      .jp-DirListing-header .jp-DropdownButton { display: none !important; }
      .jp-DirListing { top: 0 !important; }
      .jp-DirListing-item[data-isdir="true"]:first-child { display: none !important; }
      .jp-DirListing-item[data-path^="/"]:not([data-path^="/notebook"]) { display: none !important; }
    `;
    document.head.appendChild(style);

    const observer = new MutationObserver(() => {
      const node = this.fileBrowser.node.querySelector(
        '.jp-BreadCrumbs'
      ) as HTMLElement | null;
      if (node) {
        node.remove();
      }

      const directorySelects = this.fileBrowser.node.querySelectorAll(
        '.jp-DirListing-header select, .jp-DirListing-header .jp-DropdownButton'
      );
      directorySelects.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      if (this.fileBrowser.model.path === 'dataset') {
        const upDirItem = this.fileBrowser.node.querySelector(
          '.jp-DirListing-item[data-isdir="true"]:first-child'
        );
        if (upDirItem && upDirItem.textContent?.includes('..')) {
          (upDirItem as HTMLElement).style.display = 'none';
        }
      }
    });

    observer.observe(this.fileBrowser.node, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-isdir', 'data-path']
    });
  }

  /** 获取文件浏览器实例 */
  getFileBrowser(): FileBrowser {
    return this.fileBrowser;
  }
}
