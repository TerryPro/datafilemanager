import { Widget } from '@lumino/widgets';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { showErrorMessage, InputDialog } from '@jupyterlab/apputils';
import { ITranslator } from '@jupyterlab/translation';
import { Menu } from '@lumino/widgets';
import { AlgorithmLibraryDialogManager } from '../algorithm/algorithm-library-dialog';

/**
 * DataFrame 检视面板组件，显示当前笔记本中的所有 DataFrame 变量
 */
export class DataFramePanel {
  private app: JupyterFrontEnd;
  private notebookTracker?: INotebookTracker;
  private commands: any;
  private trans: any;
  private dfPanel: Widget;
  private list: HTMLDivElement = document.createElement('div');
  private currentDfName: string | null = null;
  private libraryDialogManager: AlgorithmLibraryDialogManager;

  constructor(
    app: JupyterFrontEnd,
    commands: any,
    translator: ITranslator,
    notebookTracker?: INotebookTracker
  ) {
    this.app = app;
    this.commands = commands;
    this.trans = translator.load('jupyterlab');
    this.notebookTracker = notebookTracker;
    this.libraryDialogManager = new AlgorithmLibraryDialogManager(app);
    this.dfPanel = this.createPanel();
    this.setupCommands();
  }

  /**
   * 创建并配置 DataFrame 检视面板
   */
  private createPanel(): Widget {
    const dfPanel = new Widget();
    dfPanel.id = 'datafilemanager-dataframe-panel';
    dfPanel.title.iconClass = 'jp-MaterialIcon jp-TableIcon';
    dfPanel.title.label = '';
    dfPanel.title.caption = 'DataFrame Inspector';

    const root = document.createElement('div');
    root.className = 'df-panel-root';

    const toolbar = document.createElement('div');
    toolbar.className = 'df-panel-toolbar';

    const refresh = document.createElement('button');
    refresh.className = 'df-refresh';
    refresh.title = '刷新';
    const refreshIconEl = document.createElement('span');
    refreshIconEl.className = 'jp-Icon jp-Icon-16 jp-RefreshIcon';
    refresh.appendChild(refreshIconEl);

    this.list.className = 'df-panel-list';

    root.appendChild(toolbar);
    toolbar.appendChild(refresh);
    root.appendChild(this.list);
    dfPanel.node.appendChild(root);

    refresh.addEventListener('click', () => {
      void this.refreshList();
    });

    this.list.addEventListener('contextmenu', (event: MouseEvent) => {
      this.handleContextMenu(event);
    });

    void this.refreshList();
    return dfPanel;
  }

  /**
   * 获取当前活动的 Notebook 面板
   */
  private getActiveNotebook(): NotebookPanel | null {
    const panel =
      this.notebookTracker?.currentWidget ??
      (this.app.shell.currentWidget as NotebookPanel | null);
    return panel ?? null;
  }

  /**
   * 渲染 DataFrame 列表
   */
  private renderList(
    items: Array<{ name: string; shape?: [number, number]; rows?: number }>
  ): void {
    this.list.innerHTML = '';
    const table = document.createElement('div');
    table.className = 'df-table';

    const headerRow = document.createElement('div');
    headerRow.className = 'df-row df-header';
    const hName = document.createElement('div');
    hName.className = 'df-cell df-col-name';
    hName.textContent = 'Name';
    const hShape = document.createElement('div');
    hShape.className = 'df-cell df-col-shape';
    hShape.textContent = 'Shape';
    const hRows = document.createElement('div');
    hRows.className = 'df-cell df-col-rows';
    hRows.textContent = 'Rows';
    headerRow.appendChild(hName);
    headerRow.appendChild(hShape);
    headerRow.appendChild(hRows);
    table.appendChild(headerRow);

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'df-empty';
      empty.textContent = 'No DataFrame variables';
      table.appendChild(empty);
      this.list.appendChild(table);
      return;
    }

    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'df-row';
      row.setAttribute('data-df', it.name);

      const name = document.createElement('div');
      name.className = 'df-cell df-col-name';
      name.textContent = it.name;

      const shape = document.createElement('div');
      shape.className = 'df-cell df-col-shape';
      shape.textContent = it.shape ? `${it.shape[0]} x ${it.shape[1]}` : '';

      const rows = document.createElement('div');
      rows.className = 'df-cell df-col-rows';
      rows.textContent =
        typeof it.rows === 'number'
          ? String(it.rows)
          : it.shape
          ? String(it.shape[0])
          : '';

      row.appendChild(name);
      row.appendChild(shape);
      row.appendChild(rows);
      table.appendChild(row);
    });

    this.list.appendChild(table);
  }

  /**
   * 从当前 Notebook 内核中获取 DataFrame 变量列表
   */
  private async fetchDataFrames(): Promise<
    Array<{ name: string; shape?: [number, number]; rows?: number }>
  > {
    const nb = this.getActiveNotebook();
    if (!nb || !nb.sessionContext.session?.kernel) {
      return [];
    }
    const code = [
      'import json',
      'try:',
      '  import pandas as pd',
      'except Exception:',
      '  print(json.dumps([]))',
      'else:',
      "  _df_names = [k for k,v in globals().items() if isinstance(v, pd.DataFrame) and not k.startswith('_')]",
      '  _meta = []',
      '  for k in _df_names:',
      '    try:',
      '      _df = globals()[k]',
      '      shp = list(_df.shape)',
      '      _rows = int(getattr(_df, "shape", [None])[0] or 0)',
      '    except Exception:',
      '      shp = None',
      '      _rows = None',
      '    _meta.append({"name": k, "shape": shp, "rows": _rows})',
      '  print(json.dumps(_meta))'
    ].join('\n');

    const future = nb.sessionContext.session.kernel.requestExecute({
      code,
      stop_on_error: true
    });
    let output = '';
    await new Promise<void>(resolve => {
      future.onIOPub = msg => {
        const t = (msg as any).header.msg_type;
        const c = (msg as any).content;
        if (t === 'stream' && c.text) {
          output += c.text as string;
        } else if (
          (t === 'execute_result' || t === 'display_data') &&
          c.data &&
          c.data['text/plain']
        ) {
          output += c.data['text/plain'] as string;
        } else if (t === 'error') {
          output = '[]';
        }
      };
      future.onReply = () => resolve();
    });
    try {
      const parsed = JSON.parse(output.trim());
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * 刷新当前列表展示
   */
  private async refreshList(): Promise<void> {
    const items = await this.fetchDataFrames();
    this.renderList(items);
  }

  /**
   * 设置右键菜单命令
   */
  private setupCommands(): void {
    const describeCommand = 'datafilemanager:df-describe';
    this.commands.addCommand(describeCommand, {
      label: 'Describe',
      caption: this.trans.__('Show DataFrame describe() in notebook'),
      iconClass: 'jp-MaterialIcon jp-RunIcon',
      execute: async () => {
        const nb = this.getActiveNotebook();
        if (!nb) {
          await showErrorMessage(
            this.trans.__('Describe'),
            this.trans.__('No active notebook found.')
          );
          return;
        }
        if (!this.currentDfName) {
          return;
        }
        const code = [
          `__name = r'${this.currentDfName}'`,
          '__df = globals().get(__name)',
          'assert __df is not None, f"DataFrame {__name} not found"',
          '__df.describe()'
        ].join('\n');
        const cell = nb.content.activeCell;
        if (cell && cell.model.type === 'code') {
          const src = (cell.model.sharedModel.getSource() || '').trim();
          if (src.length === 0) {
            cell.model.sharedModel.setSource(code);
            await this.commands.execute('notebook:run-cell');
          } else {
            await this.commands.execute('notebook:insert-cell-below');
            const newCell = nb.content.activeCell;
            if (newCell && newCell.model.type === 'code') {
              newCell.model.sharedModel.setSource(code);
              await this.commands.execute('notebook:run-cell');
            }
          }
        }
      }
    });

    const saveDfCommand = 'datafilemanager:df-savefile';
    this.commands.addCommand(saveDfCommand, {
      label: 'SaveFile',
      caption: this.trans.__('Save DataFrame to dataset CSV'),
      iconClass: 'jp-MaterialIcon jp-SaveIcon',
      execute: async () => {
        const nb = this.getActiveNotebook();
        if (!nb) {
          await showErrorMessage(
            this.trans.__('SaveFile'),
            this.trans.__('No active notebook found.')
          );
          return;
        }
        if (!this.currentDfName) {
          return;
        }
        const defaultName = `${this.currentDfName}.csv`;
        const res = await InputDialog.getText({
          title: this.trans.__('Save to dataset'),
          text: defaultName
        });
        if (!res.button.accept || !res.value) {
          return;
        }
        const userName = res.value;
        const code = [
          `__name = r'${this.currentDfName}'`,
          '__df = globals().get(__name)',
          'import pandas as pd, os',
          'assert isinstance(__df, pd.DataFrame), f"${__name} is not a DataFrame"',
          `__fname = r'${userName}'`,
          "__fname = __fname if __fname.lower().endswith('.csv') else (__fname + '.csv')",
          "__dir = 'dataset'",
          'os.makedirs(__dir, exist_ok=True)',
          '__path = os.path.join(__dir, __fname)',
          '__i = 1',
          '__target = __path',
          'root, ext = os.path.splitext(__fname)',
          'while os.path.exists(__target):',
          '    __target = os.path.join(__dir, f"{root}_{__i}{ext}")',
          '    __i += 1',
          '__df.to_csv(__target, index=False)',
          'print(__target)'
        ].join('\n');
        const session = nb.sessionContext.session;
        if (!session || !session.kernel) {
          await showErrorMessage(
            this.trans.__('SaveFile'),
            this.trans.__('Kernel not available.')
          );
          return;
        }
        const future = session.kernel.requestExecute({
          code,
          stop_on_error: true
        });
        await new Promise<void>(resolve => {
          future.onReply = () => resolve();
        });
      }
    });

    const analysisCommand = 'datafilemanager:df-analysis';
    this.commands.addCommand(analysisCommand, {
      label: 'Analysis',
      caption: this.trans.__('Select algorithm template'),
      iconClass: 'jp-MaterialIcon jp-DataExplorerIcon',
      execute: async () => {
        const nb = this.getActiveNotebook();
        if (!nb) {
          await showErrorMessage(
            this.trans.__('Analysis'),
            this.trans.__('No active notebook found.')
          );
          return;
        }
        if (!this.currentDfName) {
          return;
        }
        try {
          await this.libraryDialogManager.openLibraryDialog(
            nb,
            this.currentDfName
          );
        } catch (error) {
          await showErrorMessage(
            this.trans.__('Analysis'),
            this.trans.__(
              `Failed to open library dialog: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            )
          );
        }
      }
    });
  }

  /**
   * 处理右键菜单事件
   */
  private handleContextMenu(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const row = target.closest('.df-row') as HTMLElement | null;
    if (!row || row.classList.contains('df-header')) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.currentDfName = row.getAttribute('data-df');
    const menu = new Menu({ commands: this.commands });
    menu.addItem({ command: 'datafilemanager:df-describe' });
    menu.addItem({ command: 'datafilemanager:df-savefile' });
    menu.addItem({ command: 'datafilemanager:df-analysis' });
    menu.aboutToClose.connect(() => menu.dispose());
    menu.open(event.clientX, event.clientY);
  }

  /** 获取面板实例 */
  get panel(): Widget {
    return this.dfPanel;
  }
}
