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

// 创建一个全局变量来跟踪文件浏览器实例
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

    // 创建一个自定义文件浏览器模型，专门用于管理dataset目录
    const model = new FilterFileBrowserModel({
      manager: docManager,
      driveName: '',
      refreshInterval: 300000 // 5分钟刷新一次
    });

    // 创建文件浏览器实例
    this.fileBrowser = new FileBrowser({
      id: 'datafilemanager',
      model,
      restore: false
    });

    this.widget = new MainAreaWidget<FileBrowser>({
      content: this.fileBrowser
    });

    this.widget.id = 'datafilemanager-file-browser';
    // 使用图标代替中文标题
    this.widget.title.iconClass = 'jp-MaterialIcon jp-FolderIcon'; // 使用文件夹图标
    this.widget.title.label = ''; // 清空标签文本
    this.widget.title.caption = 'CSV Data File Manager'; // 保持悬停提示

    // 设置文件浏览器的根目录为dataset
    model.cd('dataset').catch(reason => {
      console.error('Failed to change directory to dataset:', reason);
    });

    // 添加到左侧边栏
    app.shell.add(this.widget, 'left', { rank: 100 });

    // 设置tracker
    tracker.currentWidget = this.fileBrowser;

    // 初始化命令
    this.initializeCommands();

    // 注册右键菜单和删除面包屑
    this.registerContextMenuHook();
    this.removeBreadcrumbs();
  }

  private initializeCommands(): void {
    const trans = this.translator.load('jupyterlab');

    // 添加命令到命令面板
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

    // 添加上传命令
    const uploadCommand = 'datafilemanager:upload';
    this.commands.addCommand(uploadCommand, {
      label: trans.__('Upload'),
      caption: trans.__('Upload files to the dataset directory'),
      iconClass: 'jp-MaterialIcon jp-UploadIcon',
      execute: () => {
        // 触发文件浏览器的上传功能
        this.fileBrowser.node.click();
        const uploadInput = document.createElement('input');
        uploadInput.type = 'file';
        uploadInput.multiple = true;
        uploadInput.onchange = (event: Event) => {
          const target = event.target as HTMLInputElement;
          if (target.files && target.files.length > 0) {
            // 使用fileBrowser.model.upload方法上传文件
            const files = Array.from(target.files);
            files.forEach(file => {
              this.fileBrowser.model.upload(file, this.fileBrowser.model.path);
            });
          }
        };
        uploadInput.click();
      }
    });

    // 添加删除命令
    const deleteCommand = 'datafilemanager:delete';
    this.commands.addCommand(deleteCommand, {
      label: trans.__('Delete'),
      caption: trans.__('Delete selected file'),
      iconClass: 'jp-MaterialIcon jp-CloseIcon',
      execute: () => {
        const widget = tracker.currentWidget;
        if (widget) {
          // 获取选中的项目
          const selectedItems = widget.selectedItems();
          // 删除选中的项目
          return Promise.all(
            Array.from(selectedItems).map(item =>
              this.docManager.deleteFile(item.path)
            )
          );
        }
      }
    });

    // 添加重命名命令
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

    // 添加打开条目命令（文件或文件夹）
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

    // 加载数据到当前Notebook命令
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

        // 获取服务器根目录并构造文件的绝对路径
        const serverRoot = PageConfig.getOption('serverRoot') || '.';
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

        // 将代码应用到Notebook：若当前单元格为空则直接写入并执行，否则在下一单元插入后写入并执行
        await this.applyCodeToNotebook(panel, code, true);
      }
    });

    // 添加复制副本命令（文件或文件夹），弹框输入新名称
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
              { content: true }
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

    // 添加复制路径命令
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

    // 添加下载命令（仅文件）
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
   * 将生成的代码应用到当前Notebook。
   * 若当前活动单元格存在且为空，则直接写入并执行；
   * 若当前活动单元格不为空或不存在，则在其下方新建代码单元并写入、执行。
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
   * 右键菜单事件处理：阻止默认上下文菜单，并显示精简菜单
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
      // 针对文件或文件夹条目
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
   * 注册右键监听到文件列表容器，生效于扩展的文件浏览器
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
   * 删除文件浏览器头部的路径面包屑显示，并监听后续DOM变更保持删除
   */
  private removeBreadcrumbs(): void {
    const bc = this.fileBrowser.node.querySelector(
      '.jp-BreadCrumbs'
    ) as HTMLElement | null;
    if (bc) {
      bc.remove();
    }

    // 添加全局CSS样式来隐藏所有可能的目录选择UI元素
    const style = document.createElement('style');
    style.textContent = `
      /* 隐藏面包屑导航 */
      .jp-BreadCrumbs {
        display: none !important;
      }
      /* 隐藏可能的目录选择下拉菜单 */
      .jp-DirListing-header select,
      .jp-DirListing-header .jp-DropdownButton {
        display: none !important;
      }
      /* 确保文件列表占满空间 */
      .jp-DirListing {
        top: 0 !important;
      }
      /* 隐藏可能的向上导航按钮 */
      .jp-DirListing-item[data-isdir="true"]:first-child {
        display: none !important;
      }
      /* 防止通过URL导航离开notebook目录 */
      .jp-DirListing-item[data-path^="/"]:not([data-path^="/notebook"]) {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    const observer = new MutationObserver(() => {
      const node = this.fileBrowser.node.querySelector(
        '.jp-BreadCrumbs'
      ) as HTMLElement | null;
      if (node) {
        node.remove();
      }

      // 隐藏任何新出现的目录选择元素
      const directorySelects = this.fileBrowser.node.querySelectorAll(
        '.jp-DirListing-header select, .jp-DirListing-header .jp-DropdownButton'
      );
      directorySelects.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      // 隐藏向上导航的".."目录项
      const upDirItem = this.fileBrowser.node.querySelector(
        '.jp-DirListing-item[data-isdir="true"]:first-child'
      );
      if (upDirItem) {
        (upDirItem as HTMLElement).style.display = 'none';
      }
    });

    observer.observe(this.fileBrowser.node, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-isdir', 'data-path']
    });
  }

  /**
   * 获取文件浏览器实例
   */
  getFileBrowser(): FileBrowser {
    return this.fileBrowser;
  }
}
