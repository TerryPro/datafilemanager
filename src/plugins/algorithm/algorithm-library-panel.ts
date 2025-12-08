import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { Widget } from '@lumino/widgets';
import { LibraryService } from '../../services/library-service';
import {
  paletteIcon,
  caretDownIcon,
  caretRightIcon,
  refreshIcon
} from '@jupyterlab/ui-components';
import { AlgorithmInfoDialogManager } from './algorithm-info-dialog';

interface IAlgorithm {
  id: string;
  name: string;
  description: string;
  category: string;
  template?: string;
  args?: any[];
}

export class AlgorithmLibraryPanel extends Widget {
  private libraryService: LibraryService;
  private treeContainer: HTMLDivElement;
  private searchInput: HTMLInputElement;
  private expandedCategories: Set<string> = new Set();
  private algorithms: { [category: string]: IAlgorithm[] } = {};

  constructor(app: JupyterFrontEnd, tracker: INotebookTracker) {
    super();
    this.libraryService = new LibraryService();
    this.id = 'algorithm-library-panel';
    this.title.label = ''; // Hide label in sidebar to show only icon
    this.title.icon = paletteIcon;
    this.title.caption = 'Algorithm Library';
    this.addClass('jp-AlgorithmLibraryPanel');

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
    this.searchInput.style.boxSizing = 'border-box';
    this.searchInput.addEventListener('input', () => this.filterAlgorithms());

    // Refresh Button
    const refreshBtn = document.createElement('div');
    refreshBtn.className = 'jp-ToolbarButtonComponent';
    refreshBtn.style.cursor = 'pointer';
    refreshBtn.style.display = 'flex';
    refreshBtn.style.alignItems = 'center';
    refreshBtn.style.justifyContent = 'center';
    refreshBtn.style.width = '24px';
    refreshBtn.style.height = '24px';
    refreshBtn.title = '刷新算法库';
    refreshBtn.style.borderRadius = '3px';
    refreshBtn.onmouseover = () => {
      refreshBtn.style.backgroundColor = 'var(--jp-layout-color2)';
    };
    refreshBtn.onmouseout = () => {
      refreshBtn.style.backgroundColor = 'transparent';
    };

    // Create icon element using JupyterLab's icon system
    const iconNode = document.createElement('div');
    refreshIcon.element({
      container: iconNode,
      height: '16px',
      width: '16px',
      elementPosition: 'center'
    });
    refreshBtn.appendChild(iconNode);

    refreshBtn.onclick = async () => {
      refreshBtn.style.opacity = '0.5'; // Visual feedback
      try {
        console.log('Refreshing library...');
        this.algorithms = await this.libraryService.reloadFunctionLibrary();
        // Re-expand all categories
        Object.keys(this.algorithms).forEach(cat =>
          this.expandedCategories.add(cat)
        );
        this.renderTree(this.searchInput.value);
        console.log('Library refreshed');
      } catch (e) {
        console.error('Failed to refresh library:', e);
      } finally {
        refreshBtn.style.opacity = '1';
      }
    };

    toolbar.appendChild(this.searchInput);
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

  private async loadAlgorithms() {
    try {
      this.algorithms = await this.libraryService.getFunctionLibrary();
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
        algoItem.style.padding = '8px 12px 8px 36px'; // Indent to align with text
        algoItem.style.cursor = 'pointer';
        algoItem.style.fontSize = '13px';
        algoItem.style.color = 'var(--jp-ui-font-color1)';
        algoItem.style.borderBottom = '1px solid var(--jp-border-color3)'; // Optional: subtle separator
        algoItem.style.display = 'flex';
        algoItem.style.flexDirection = 'column';

        // Name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = algo.name;
        nameSpan.style.fontWeight = '500';
        algoItem.appendChild(nameSpan);

        // Description (optional, small)
        if (algo.description) {
          const descSpan = document.createElement('span');
          descSpan.textContent = algo.description;
          descSpan.style.fontSize = '11px';
          descSpan.style.color = 'var(--jp-ui-font-color2)';
          descSpan.style.marginTop = '2px';
          descSpan.style.whiteSpace = 'nowrap';
          descSpan.style.overflow = 'hidden';
          descSpan.style.textOverflow = 'ellipsis';
          algoItem.appendChild(descSpan);
        }

        // Hover effect
        algoItem.onmouseenter = () => {
          algoItem.style.backgroundColor = 'var(--jp-layout-color2)';
        };
        algoItem.onmouseleave = () => {
          algoItem.style.backgroundColor = 'transparent';
        };

        // Click to show info
        algoItem.onclick = () => this.openAlgorithmDialog(algo);

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

  private openAlgorithmDialog(algo: IAlgorithm) {
    const dialogManager = new AlgorithmInfoDialogManager();
    dialogManager.showAlgorithmInfo(algo);
  }
}
