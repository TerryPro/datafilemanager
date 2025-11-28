import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { AiService } from '../services/ai-service';

/**
 * Interface for library function
 */
interface ILibraryFunction {
    id: string;
    name: string;
    description: string;
    category: string;
    template?: string;
    docstring?: string;
    signature?: string;
    module?: string;
    args?: Array<{ name: string; default?: string; annotation?: string }>;
}

interface ILibraryMetadata {
    [category: string]: ILibraryFunction[];
}

/**
 * Body widget for the library dialog
 */
class LibraryBodyWidget extends Widget implements Dialog.IBodyWidget<string> {
    private libraryData: ILibraryMetadata;
    private dfName: string;
    private selectedCode: string = '';
    
    // UI Elements
    private container: HTMLElement;
    private leftPanel: HTMLElement;
    private rightPanel: HTMLElement;
    
    // State
    private expandedCategories: Set<string> = new Set();
    private selectedFunctionId: string | null = null;
    
    constructor(libraryData: ILibraryMetadata, dfName: string) {
        super();
        this.libraryData = libraryData;
        this.dfName = dfName;
        this.addClass('jp-LibraryBody');
        this.node.style.resize = 'none';
        this.node.style.overflow = 'hidden';

        // Use a wrapper container to ensure flex layout works correctly regardless of Widget node behavior
        this.container = document.createElement('div');
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'row';
        this.container.style.height = '75vh';
        this.container.style.width = '900px';
        this.container.style.minHeight = '500px';
        this.container.style.minWidth = '600px';
        this.node.appendChild(this.container);
        
        // ------------------------------------------------------
        // Left Panel: Tree View (Categories & Algorithms)
        // ------------------------------------------------------
        this.leftPanel = document.createElement('div');
        this.leftPanel.className = 'jp-Library-leftPanel';
        this.leftPanel.style.flex = '0 0 300px';
        this.leftPanel.style.borderRight = '1px solid var(--jp-border-color2)';
        this.leftPanel.style.display = 'flex';
        this.leftPanel.style.flexDirection = 'column';
        this.leftPanel.style.minHeight = '0';
        this.leftPanel.style.background = 'var(--jp-layout-color2)';

        // Tree View Container
        const treeContainer = document.createElement('div');
        treeContainer.id = 'library-tree-container';
        treeContainer.style.flex = '1';
        treeContainer.style.overflowY = 'auto';
        treeContainer.style.padding = '0';
        this.leftPanel.appendChild(treeContainer);

        // ------------------------------------------------------
        // Right Panel: Algorithm Details (Description & Code)
        // ------------------------------------------------------
        this.rightPanel = document.createElement('div');
        this.rightPanel.className = 'jp-Library-rightPanel';
        this.rightPanel.style.flex = '1';
        //this.rightPanel.style.height = '100%';
        this.rightPanel.style.display = 'flex';
        this.rightPanel.style.flexDirection = 'column';
        this.rightPanel.style.padding = '0 0 0 16px';
        this.rightPanel.style.overflow = 'auto';
        this.rightPanel.style.minHeight = '0';
        this.rightPanel.style.background = 'var(--jp-layout-color1)';

        // Initial Right Panel State
        this.renderRightPanelEmpty();

        this.container.appendChild(this.leftPanel);
        this.container.appendChild(this.rightPanel);
        
        // Initialize Data
        this.renderTree();
    }
    
    private renderTree() {
        const container = this.leftPanel.querySelector('#library-tree-container') as HTMLElement;
        container.innerHTML = '';
        
        const categories = Object.keys(this.libraryData);

        categories.forEach(cat => {
            const functions = this.libraryData[cat];

            // Category Item
            const catItem = document.createElement('div');
            catItem.className = 'jp-Library-Category';
            
            // Header
            const catHeader = document.createElement('div');
            catHeader.style.padding = '8px 12px';
            catHeader.style.cursor = 'pointer';
            catHeader.style.fontWeight = 'bold';
            catHeader.style.display = 'flex';
            catHeader.style.alignItems = 'center';
            catHeader.style.userSelect = 'none';
            catHeader.style.color = 'var(--jp-ui-font-color1)';
            
            // Icon (Chevron)
            const icon = document.createElement('span');
            icon.className = 'jp-Icon jp-Icon-16';
            // Use text for simplicity or a proper icon class if available.
            // We'll use a simple transform for open/close
            const isExpanded = this.expandedCategories.has(cat);
            icon.textContent = isExpanded ? '▼' : '▶'; 
            icon.style.marginRight = '6px';
            icon.style.fontSize = '10px';
            
            catHeader.appendChild(icon);
            catHeader.appendChild(document.createTextNode(cat));
            
            // Algorithm List Container
            const algoList = document.createElement('div');
            algoList.style.display = isExpanded ? 'block' : 'none';
            algoList.style.paddingLeft = '0';
            
            // Toggle Expand/Collapse
            catHeader.onclick = () => {
                if (this.expandedCategories.has(cat)) {
                    this.expandedCategories.delete(cat);
                    algoList.style.display = 'none';
                    icon.textContent = '▶';
                } else {
                    this.expandedCategories.add(cat);
                    algoList.style.display = 'block';
                    icon.textContent = '▼';
                }
            };

            // Render Algorithms
            functions.forEach(func => {
                const algoItem = document.createElement('div');
                algoItem.textContent = func.name;
                algoItem.style.padding = '6px 12px 6px 34px'; // Indent
                algoItem.style.cursor = 'pointer';
                algoItem.style.fontSize = '13px';
                algoItem.style.borderLeft = '3px solid transparent';
                
                // Selection Style
                if (this.selectedFunctionId === func.id) {
                    algoItem.style.background = 'var(--jp-brand-color2)'; // Lighter brand color
                    algoItem.style.borderLeft = '3px solid var(--jp-brand-color1)';
                }
                
                // Hover
                algoItem.onmouseenter = () => {
                    if (this.selectedFunctionId !== func.id) {
                        algoItem.style.background = 'var(--jp-layout-color3)';
                    }
                };
                algoItem.onmouseleave = () => {
                    if (this.selectedFunctionId !== func.id) {
                        algoItem.style.background = 'transparent';
                    }
                };

                // Click Selection
                algoItem.onclick = () => {
                    this.selectFunction(func);
                    this.renderTree(); // Re-render to update selection style
                };

                algoList.appendChild(algoItem);
            });

            catItem.appendChild(catHeader);
            catItem.appendChild(algoList);
            container.appendChild(catItem);
        });
    }
    
    private renderRightPanelEmpty() {
        this.rightPanel.innerHTML = '';
        const msg = document.createElement('div');
        msg.textContent = '请从左侧列表选择一个算法以查看详情。';
        msg.style.color = 'var(--jp-ui-font-color2)';
        msg.style.textAlign = 'center';
        msg.style.marginTop = '40%';
        this.rightPanel.appendChild(msg);
    }

    private renderRightPanelDetails(func: ILibraryFunction) {
        this.rightPanel.innerHTML = '';

        // Description Section
        const descLabel = document.createElement('div');
        descLabel.textContent = '算法说明';
        descLabel.style.fontWeight = 'bold';
        descLabel.style.fontSize = '11px';
        descLabel.style.color = 'var(--jp-ui-font-color2)';
        descLabel.style.marginBottom = '8px';
        descLabel.style.marginTop = '0';
        this.rightPanel.appendChild(descLabel);

        const descContent = document.createElement('div');
        descContent.textContent = func.description;
        descContent.style.marginBottom = '24px';
        descContent.style.lineHeight = '1.5';
        this.rightPanel.appendChild(descContent);

        // Code Template Section
        const codeLabel = document.createElement('div');
        codeLabel.textContent = '代码模板';
        codeLabel.style.fontWeight = 'bold';
        codeLabel.style.fontSize = '11px';
        codeLabel.style.color = 'var(--jp-ui-font-color2)';
        codeLabel.style.marginBottom = '0';
        this.rightPanel.appendChild(codeLabel);

        // Generate Code
        const varName = this.dfName || 'df';
        let code = '';
        if (func.template) {
            code = func.template.replace(/{VAR_NAME}/g, varName);
        } else {
            code = `# ${func.name}\n# 暂无可用模板。`;
        }
        this.selectedCode = code;

        const pre = document.createElement('pre');
        pre.textContent = code;
        pre.style.background = 'var(--jp-layout-color0)';
        pre.style.padding = '12px';
        pre.style.borderRadius = '4px';
        pre.style.border = '1px solid var(--jp-border-color2)';
        pre.style.fontFamily = 'var(--jp-code-font-family)';
        pre.style.fontSize = '13px';
        pre.style.flex = '1';
        pre.style.minHeight = '320px';
        pre.style.maxHeight = 'none';
        pre.style.margin = '0';
        pre.style.height = 'auto';
        pre.style.overflow = 'auto';
        pre.style.whiteSpace = 'pre';
        this.rightPanel.appendChild(pre);
    }
    
    private selectFunction(func: ILibraryFunction) {
        this.selectedFunctionId = func.id;
        this.renderRightPanelDetails(func);
    }
    
    getValue(): string {
        return this.selectedCode;
    }
}


/**
 * Manager for the Analysis Library Dialog/Panel
 */
export class AiDialogManagerForLibrary {
    private aiService: AiService;

    constructor(app: JupyterFrontEnd) {
        this.aiService = new AiService();
    }

    /**
     * Open the library browser dialog
     */
    async openLibraryDialog(panel: NotebookPanel, currentDfName: string | null): Promise<void> {
        const libraryData = await this.aiService.getFunctionLibrary();
        
        const body = new LibraryBodyWidget(libraryData, currentDfName || 'df');
        
        const dialog = new Dialog({
            title: '算法函数库',
            body: body,
            buttons: [
                Dialog.cancelButton({ label: '取消' }),
                Dialog.okButton({ label: '插入代码' })
            ]
        });

        // Disable dialog resizing and hide default resize handle
        const content = dialog.node.querySelector('.jp-Dialog-content') as HTMLElement | null;
        const bodyEl = dialog.node.querySelector('.jp-Dialog-body') as HTMLElement | null;
        dialog.node.style.resize = 'none';
        dialog.node.style.overflow = 'hidden';
        if (content) {
            content.style.display = 'flex';
            content.style.flexDirection = 'column';
            content.style.resize = 'none';
            content.style.maxHeight = '80vh';
            content.style.overflow = 'hidden';
        }
        if (bodyEl) {
            bodyEl.style.flex = '1';
            bodyEl.style.maxHeight = '70vh';
            bodyEl.style.overflow = 'auto';
        }

        const result = await dialog.launch();
        
        if (result.button.accept) {
            const code = body.getValue();
            if (code) {
                this.insertCode(panel, code);
            }
        }
    }

    /**
     * Insert code into the notebook
     */
    private insertCode(panel: NotebookPanel, code: string): void {
        const cell = panel.content.activeCell;
        if (cell && cell.model.type === 'code') {
            const src = cell.model.sharedModel.getSource().trim();
            if (src.length === 0) {
                cell.model.sharedModel.setSource(code);
            } else {
                // Append to current cell if not empty
                const newSource = src + '\n\n' + code;
                cell.model.sharedModel.setSource(newSource);
            }
        }
    }
}
