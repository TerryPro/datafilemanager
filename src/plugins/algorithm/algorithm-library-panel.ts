import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { Widget, Menu } from '@lumino/widgets';
import { LibraryService } from '../../services/library-service';
import {
  paletteIcon,
  caretDownIcon,
  caretRightIcon,
  refreshIcon,
  addIcon,
  LabIcon
} from '@jupyterlab/ui-components';
import {
  AlgorithmEditorDialogManager,
  ICategory
} from '../../component/algorithm/algorithm-editor-dialog';
import { AlgorithmLoadDialogManager } from '../../component/algorithm/algorithm-load-dialog';
import { showErrorMessage, showDialog, Dialog } from '@jupyterlab/apputils';

interface IAlgorithm {
  id: string;
  name: string;
  description: string;
  category: string;
  template?: string;
  args?: any[];
  inputs?: { name: string; type: string }[];
  outputs?: { name: string; type: string }[];
}

export class AlgorithmLibraryPanel extends Widget {
  private libraryService: LibraryService;
  private treeContainer: HTMLDivElement;
  private searchInput: HTMLInputElement;
  private expandedCategories: Set<string> = new Set();
  private algorithms: { [category: string]: IAlgorithm[] } = {};
  private categories: ICategory[] = [];
  private tracker: INotebookTracker;
  private commands: any;

  constructor(app: JupyterFrontEnd, tracker: INotebookTracker) {
    super();
    this.tracker = tracker;
    this.commands = app.commands;
    this.libraryService = new LibraryService();
    this.id = 'algorithm-library-panel';
    this.title.label = ''; // Hide label in sidebar to show only icon
    this.title.icon = paletteIcon;
    this.title.caption = 'Algorithm Library';
    this.addClass('jp-AlgorithmLibraryPanel');

    // Setup context menu commands
    this.setupContextMenuCommands();

    // Create layout
    const layout = document.createElement('div');
    layout.className = 'jp-AlgorithmLibrary-layout';
    layout.style.display = 'flex';
    layout.style.flexDirection = 'column';
    layout.style.height = '100%';
    layout.style.backgroundColor = 'var(--jp-layout-color1)';
    this.node.appendChild(layout);

    // 1. Toolbar (Search)
    const toolbar = document.createElement('div');
    toolbar.className = 'jp-AlgorithmLibrary-toolbar';
    toolbar.style.padding = '8px';
    toolbar.style.borderBottom = '1px solid var(--jp-border-color2)';
    toolbar.style.backgroundColor = 'var(--jp-layout-color1)';
    toolbar.style.display = 'flex';
    toolbar.style.gap = '8px';
    toolbar.style.alignItems = 'center';

    this.searchInput = document.createElement('input');
    this.searchInput.className = 'jp-mod-styled';
    this.searchInput.placeholder = '搜索算法...';
    this.searchInput.style.flex = '1';
    this.searchInput.style.minWidth = '0'; // 允许缩小
    this.searchInput.style.maxWidth = '100%'; // 响应式限制
    this.searchInput.style.boxSizing = 'border-box';
    this.searchInput.addEventListener('input', () => this.filterAlgorithms());

    // Helper to create toolbar button
    const createBtn = (icon: LabIcon, title: string, onClick: () => void) => {
      const btn = document.createElement('div');
      btn.className = 'jp-ToolbarButtonComponent';
      btn.style.cursor = 'pointer';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.width = '24px';
      btn.style.height = '24px';
      btn.style.flexShrink = '0'; // 防止按钮被压缩
      btn.title = title;
      btn.style.borderRadius = '3px';
      btn.onmouseover = () => {
        btn.style.backgroundColor = 'var(--jp-layout-color2)';
      };
      btn.onmouseout = () => {
        btn.style.backgroundColor = 'transparent';
      };

      const iconNode = document.createElement('div');
      icon.element({
        container: iconNode,
        height: '16px',
        width: '16px',
        elementPosition: 'center'
      });
      btn.appendChild(iconNode);

      btn.onclick = onClick;
      return btn;
    };

    // Add Button
    const addBtn = createBtn(addIcon, 'Add New Algorithm', () =>
      this.handleAdd()
    );

    // Refresh Button
    const refreshBtn = createBtn(refreshIcon, 'Refresh Library', async () => {
      await this.refreshLibrary();
    });

    toolbar.appendChild(this.searchInput);
    toolbar.appendChild(addBtn);
    toolbar.appendChild(refreshBtn);
    layout.appendChild(toolbar);

    // 2. Algorithm Tree Container
    this.treeContainer = document.createElement('div');
    this.treeContainer.className = 'jp-AlgorithmLibrary-tree';
    this.treeContainer.style.flex = '1';
    this.treeContainer.style.overflowY = 'auto';
    layout.appendChild(this.treeContainer);

    // Load data
    this.loadAlgorithms();
  }

  private async refreshLibrary() {
    try {
      console.log('Refreshing library...');
      this.algorithms = await this.libraryService.reloadFunctionLibrary();

      try {
        const prompts = await this.libraryService.getAlgorithmPrompts();
        this.categories = Object.keys(prompts).map(id => ({
          id: id,
          label: prompts[id].label
        }));
      } catch (e) {
        console.warn('Failed to fetch category map:', e);
      }

      // Re-expand all categories
      Object.keys(this.algorithms).forEach(cat =>
        this.expandedCategories.add(cat)
      );
      this.renderTree(this.searchInput.value);
      console.log('Library refreshed');
    } catch (e) {
      console.error('Failed to refresh library:', e);
    }
  }

  private async loadAlgorithms() {
    try {
      this.algorithms = await this.libraryService.getFunctionLibrary();

      try {
        const prompts = await this.libraryService.getAlgorithmPrompts();
        this.categories = Object.keys(prompts).map(id => ({
          id: id,
          label: prompts[id].label
        }));
      } catch (e) {
        console.warn('Failed to fetch category map:', e);
      }

      // Initialize with all categories expanded by default
      Object.keys(this.algorithms).forEach(cat =>
        this.expandedCategories.add(cat)
      );
      this.renderTree();
    } catch (error) {
      console.error('Failed to load algorithms:', error);
      this.treeContainer.textContent = '无法加载算法库，请检查服务连接。';
      this.treeContainer.style.padding = '10px';
      this.treeContainer.style.color = 'var(--jp-ui-font-color2)';
    }
  }

  private renderTree(filterText = '') {
    this.treeContainer.innerHTML = '';
    const categories = Object.keys(this.algorithms);

    categories.forEach(category => {
      const algos = this.algorithms[category];
      const filteredAlgos = algos.filter(
        algo =>
          algo.name.toLowerCase().includes(filterText.toLowerCase()) ||
          algo.description.toLowerCase().includes(filterText.toLowerCase())
      );

      if (filteredAlgos.length === 0) {
        return;
      }

      // Category Section Header
      const section = document.createElement('div');
      section.className = 'jp-AlgorithmLibrary-section';

      const catHeader = document.createElement('div');
      catHeader.className = 'jp-AlgorithmLibrary-sectionHeader';
      catHeader.style.padding = '8px 12px';
      catHeader.style.cursor = 'pointer';
      catHeader.style.fontWeight = '600';
      catHeader.style.display = 'flex';
      catHeader.style.alignItems = 'center';
      catHeader.style.userSelect = 'none';
      catHeader.style.color = 'var(--jp-ui-font-color1)';
      catHeader.style.backgroundColor = 'var(--jp-layout-color2)';
      catHeader.style.borderBottom = '1px solid var(--jp-border-color2)';
      catHeader.style.fontSize = '11px'; // Matches sidebar headers usually
      catHeader.style.textTransform = 'uppercase';
      catHeader.style.letterSpacing = '1px';

      // Icon
      const iconSpan = document.createElement('span');
      iconSpan.className = 'jp-Icon jp-Icon-16';
      iconSpan.style.marginRight = '8px';
      iconSpan.style.display = 'flex';
      iconSpan.style.alignItems = 'center';

      const isExpanded = filterText
        ? true
        : this.expandedCategories.has(category);
      const icon = isExpanded ? caretDownIcon : caretRightIcon;
      icon.element({ container: iconSpan });

      catHeader.appendChild(iconSpan);
      catHeader.appendChild(document.createTextNode(category));

      // Algorithm List
      const algoList = document.createElement('ul');
      algoList.style.listStyle = 'none';
      algoList.style.padding = '0';
      algoList.style.margin = '0';
      algoList.style.display = isExpanded ? 'block' : 'none';
      algoList.style.backgroundColor = 'var(--jp-layout-color1)';

      filteredAlgos.forEach(algo => {
        const algoItem = document.createElement('li');
        algoItem.className = 'jp-AlgorithmLibrary-item';
        algoItem.style.padding = '6px 12px 6px 28px';
        algoItem.style.cursor = 'pointer';
        algoItem.style.fontSize = '12px';
        algoItem.style.borderBottom = '1px solid var(--jp-border-color3)';
        algoItem.style.color = 'var(--jp-ui-font-color1)';
        algoItem.style.transition = 'background-color 0.2s';
        algoItem.style.display = 'flex';
        algoItem.style.alignItems = 'center';

        // Content
        const content = document.createElement('div');
        content.style.flex = '1';

        const name = document.createElement('div');
        name.style.fontWeight = '500';
        name.textContent = algo.name;

        const desc = document.createElement('div');
        desc.style.color = 'var(--jp-ui-font-color2)';
        desc.style.fontSize = '11px';
        desc.style.marginTop = '2px';
        desc.textContent = algo.description;

        content.appendChild(name);
        content.appendChild(desc);
        algoItem.appendChild(content);

        // Hover effect
        algoItem.onmouseenter = () => {
          algoItem.style.backgroundColor = 'var(--jp-layout-color2)';
        };
        algoItem.onmouseleave = () => {
          algoItem.style.backgroundColor = 'transparent';
        };

        // 移除左键单击事件，只保留右键菜单
        // algoItem.onclick = () => this.openAlgorithmDialog(algo);

        // Add context menu support
        algoItem.addEventListener('contextmenu', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          this.showContextMenu(e, algo);
        });

        algoList.appendChild(algoItem);
      });

      // Toggle expand/collapse
      catHeader.onclick = () => {
        // If searching, we might want to disable collapsing or clear search?
        // Usually in search mode, structure is fixed. But let's allow toggling if user wants.
        // If filter is active, we might not want to modify expandedCategories or we might.
        // Let's just toggle visibility.

        if (this.expandedCategories.has(category)) {
          this.expandedCategories.delete(category);
          algoList.style.display = 'none';
          iconSpan.innerHTML = '';
          caretRightIcon.element({ container: iconSpan });
        } else {
          this.expandedCategories.add(category);
          algoList.style.display = 'block';
          iconSpan.innerHTML = '';
          caretDownIcon.element({ container: iconSpan });
        }
      };

      section.appendChild(catHeader);
      section.appendChild(algoList);
      this.treeContainer.appendChild(section);
    });
  }

  private filterAlgorithms() {
    const text = this.searchInput.value;
    this.renderTree(text);
  }

  private async openAlgorithmDialog(algo: IAlgorithm) {
    try {
      const code = await this.libraryService.getAlgorithmCode(algo.id);
      const metadata = await this.libraryService.parseCode(code);

      const manager = new AlgorithmEditorDialogManager();
      await manager.showBrowser(
        {
          id: algo.id,
          name: algo.name,
          category: this.getCategoryId(algo.category),
          code: code,
          description: algo.description || metadata.description,
          prompt: metadata.prompt,
          args: algo.args || metadata.args,
          inputs: algo.inputs || metadata.inputs,
          outputs: algo.outputs || metadata.outputs
        },
        this.categories
      );
    } catch (e: any) {
      await showErrorMessage('Failed to load algorithm', e.message);
    }
  }

  private getCategoryId(label: string): string {
    const cat = this.categories.find(c => c.label === label);
    return cat ? cat.id : label;
  }

  private async handleAdd() {
    const manager = new AlgorithmEditorDialogManager();
    const result = await manager.showEditor(null, this.categories);
    if (result) {
      try {
        await this.libraryService.manageAlgorithm('add', result);
        await this.refreshLibrary();
      } catch (e: any) {
        await showErrorMessage('Add Failed', e.message);
      }
    }
  }

  private async handleEdit(algo: IAlgorithm, catId: string) {
    try {
      const code = await this.libraryService.getAlgorithmCode(algo.id);

      // Parse code to get complete metadata
      const metadata = await this.libraryService.parseCode(code);

      const manager = new AlgorithmEditorDialogManager();
      const result = await manager.showEditor(
        {
          id: algo.id,
          name: algo.name,
          category: catId,
          code: code,
          description: algo.description || metadata.description,
          prompt: metadata.prompt,
          args: algo.args || metadata.args,
          inputs: algo.inputs || metadata.inputs,
          outputs: algo.outputs || metadata.outputs
        },
        this.categories
      );

      if (result) {
        await this.libraryService.manageAlgorithm('update', result);
        await this.refreshLibrary();
      }
    } catch (e: any) {
      await showErrorMessage('Edit Failed', e.message);
    }
  }

  private async handleDelete(id: string) {
    const result = await showDialog({
      title: 'Delete Algorithm',
      body: `Are you sure you want to delete algorithm "${id}"?`,
      buttons: [Dialog.cancelButton(), Dialog.warnButton({ label: 'Delete' })]
    });

    if (result.button.accept) {
      try {
        await this.libraryService.manageAlgorithm('delete', { id });
        await this.refreshLibrary();
      } catch (e: any) {
        await showErrorMessage('Delete Failed', e.message);
      }
    }
  }

  /**
   * Setup context menu commands
   */
  private setupContextMenuCommands(): void {
    // Browse Algorithm (View Details)
    this.commands.addCommand('algorithm-library:browse', {
      label: '浏览算法',
      execute: (args: any) => {
        const algo = this.findAlgorithmById(args.id as string);
        if (algo) {
          this.openAlgorithmDialog(algo);
        }
      }
    });

    // Edit Algorithm
    this.commands.addCommand('algorithm-library:edit', {
      label: '编辑算法',
      execute: async (args: any) => {
        const algo = this.findAlgorithmById(args.id as string);
        if (algo) {
          const catId = this.getCategoryId(args.category as string);
          await this.handleEdit(algo, catId);
        }
      }
    });

    // Delete Algorithm
    this.commands.addCommand('algorithm-library:delete', {
      label: '删除算法',
      execute: async (args: any) => {
        await this.handleDelete(args.id as string);
      }
    });

    // Insert as Widget (类似 Browse Algorithm Library)
    this.commands.addCommand('algorithm-library:insert-widget', {
      label: '加载算法（Widget）',
      execute: async (args: any) => {
        const algo = this.findAlgorithmById(args.id as string);
        if (algo) {
          await this.insertAsWidget(algo);
        }
      }
    });

    // Load to Cell (类似 加载算法到CELL)
    this.commands.addCommand('algorithm-library:load-to-cell', {
      label: '加载算法（代码）',
      execute: async (args: any) => {
        const algo = this.findAlgorithmById(args.id as string);
        if (algo) {
          await this.loadToCell(algo);
        }
      }
    });
  }

  /**
   * Find algorithm by ID
   */
  private findAlgorithmById(id: string): IAlgorithm | null {
    for (const category in this.algorithms) {
      const algo = this.algorithms[category].find(a => a.id === id);
      if (algo) {
        return algo;
      }
    }
    return null;
  }

  /**
   * Show context menu for an algorithm
   */
  private showContextMenu(event: MouseEvent, algo: IAlgorithm): void {
    const menu = new Menu({ commands: this.commands });

    // Pass algorithm ID instead of the whole object to avoid type issues
    menu.addItem({
      command: 'algorithm-library:browse',
      args: { id: algo.id, name: algo.name, category: algo.category }
    });

    menu.addItem({ type: 'separator' });

    menu.addItem({
      command: 'algorithm-library:insert-widget',
      args: { id: algo.id, name: algo.name, category: algo.category }
    });

    menu.addItem({
      command: 'algorithm-library:load-to-cell',
      args: { id: algo.id, name: algo.name, category: algo.category }
    });

    menu.addItem({ type: 'separator' });

    menu.addItem({
      command: 'algorithm-library:edit',
      args: { id: algo.id, name: algo.name, category: algo.category }
    });

    menu.addItem({
      command: 'algorithm-library:delete',
      args: { id: algo.id, name: algo.name }
    });

    // 修复：使用 aboutToClose 而不是 dispose，避免循环调用
    let disposed = false;
    menu.aboutToClose.connect(() => {
      if (!disposed) {
        disposed = true;
        setTimeout(() => menu.dispose(), 0);
      }
    });
    menu.open(event.clientX, event.clientY);
  }

  /**
   * Insert algorithm as widget (类似 Browse Algorithm Library 功能)
   * 将选中的算法作为 AlgorithmWidget 添加到 Notebook Cell
   */
  private async insertAsWidget(algo: IAlgorithm): Promise<void> {
    const panel = this.tracker.currentWidget;
    if (!panel) {
      await showErrorMessage(
        'No Active Notebook',
        'Please open a notebook first.'
      );
      return;
    }

    const session = panel.sessionContext;
    if (!session.isReady) {
      await showErrorMessage(
        'Session Not Ready',
        'Please wait for the notebook session to be ready.'
      );
      return;
    }

    // Generate widget code with pre-selected algorithm
    const code = `from algorithm.widgets import AlgorithmWidget\nAlgorithmWidget(init_algo='${algo.id}')`;

    if (panel.content.activeCell) {
      const activeCell = panel.content.activeCell;
      const source = activeCell.model.sharedModel.getSource().trim();

      if (source === '') {
        // Current cell is empty, use it
        activeCell.model.sharedModel.setSource(code);
        await NotebookActions.run(panel.content, session);
      } else {
        // Current cell not empty, insert below
        NotebookActions.insertBelow(panel.content);
        const newCell = panel.content.activeCell;
        if (newCell) {
          newCell.model.sharedModel.setSource(code);
          await NotebookActions.run(panel.content, session);
        }
      }
    }
  }

  /**
   * Load algorithm code to cell (类似 加载算法到CELL 功能)
   * 通过对话框选择并将算法代码直接加载到 Cell
   */
  private async loadToCell(algo: IAlgorithm): Promise<void> {
    const panel = this.tracker.currentWidget;
    if (!panel) {
      await showErrorMessage('无活动Notebook', '请先打开一个Notebook');
      return;
    }

    const activeCell = panel.content.activeCell;
    if (!activeCell) {
      await showErrorMessage('无活动单元格', '请先选择一个Notebook单元格');
      return;
    }

    if (activeCell.model.type !== 'code') {
      await showErrorMessage('无效单元格类型', '请选择一个代码单元格');
      return;
    }

    try {
      // 获取算法完整信息
      const code = await this.libraryService.getAlgorithmCode(algo.id);
      const metadata = await this.libraryService.parseCode(code);

      // 打开加载对话框
      const loadManager = new AlgorithmLoadDialogManager();
      const generatedCode = await loadManager.showLoadDialog(
        {
          id: algo.id,
          name: algo.name,
          description: algo.description,
          category: algo.category,
          code: code,
          imports: metadata.imports,
          args: algo.args || metadata.args,
          inputs: algo.inputs || metadata.inputs,
          outputs: algo.outputs || metadata.outputs
        },
        panel
      );

      if (generatedCode) {
        // 直接替换当前单元格的代码
        activeCell.model.sharedModel.setSource(generatedCode);
      }
    } catch (e: any) {
      await showErrorMessage('加载失败', e.message);
    }
  }
}
