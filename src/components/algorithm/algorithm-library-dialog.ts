import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { AiService } from '../../services/ai-service';

interface ILibraryFunction {
  id: string;
  name: string;
  description: string;
  category: string;
  template?: string;
  docstring?: string;
  signature?: string;
  module?: string;
  imports?: string[];
  args?: Array<{
    name: string;
    default?: any;
    annotation?: string;
    label?: string;
    description?: string;
    type?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  }>;
}

interface ILibraryMetadata {
  [category: string]: ILibraryFunction[];
}

class LibraryBodyWidget extends Widget implements Dialog.IBodyWidget<string> {
  private libraryData: ILibraryMetadata;
  private dfName: string;
  private selectedCode = '';
  private container: HTMLElement;
  private leftPanel: HTMLElement;
  private rightPanel: HTMLElement;
  private expandedCategories: Set<string> = new Set();
  private selectedFunctionId: string | null = null;
  private currentParams: { [key: string]: any } = {};
  private codePreElement: HTMLPreElement | null = null;
  private serverRoot: string;

  constructor(
    libraryData: ILibraryMetadata,
    dfName: string,
    serverRoot: string
  ) {
    super();
    this.libraryData = libraryData;
    this.dfName = dfName;
    this.serverRoot = serverRoot;
    this.addClass('jp-LibraryBody');
    this.node.style.resize = 'none';
    this.node.style.overflow = 'hidden';

    this.container = document.createElement('div');
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'row';
    this.container.style.height = '75vh';
    this.container.style.width = '900px';
    this.container.style.minHeight = '500px';
    this.container.style.minWidth = '600px';
    this.node.appendChild(this.container);

    this.leftPanel = document.createElement('div');
    this.leftPanel.className = 'jp-Library-leftPanel';
    this.leftPanel.style.flex = '0 0 300px';
    this.leftPanel.style.borderRight = '1px solid var(--jp-border-color2)';
    this.leftPanel.style.display = 'flex';
    this.leftPanel.style.flexDirection = 'column';
    this.leftPanel.style.minHeight = '0';
    this.leftPanel.style.background = 'var(--jp-layout-color2)';

    const treeContainer = document.createElement('div');
    treeContainer.id = 'library-tree-container';
    treeContainer.style.flex = '1';
    treeContainer.style.overflowY = 'auto';
    treeContainer.style.padding = '0';
    this.leftPanel.appendChild(treeContainer);

    this.rightPanel = document.createElement('div');
    this.rightPanel.className = 'jp-Library-rightPanel';
    this.rightPanel.style.flex = '1';
    this.rightPanel.style.display = 'flex';
    this.rightPanel.style.flexDirection = 'column';
    this.rightPanel.style.padding = '0 0 0 16px';
    this.rightPanel.style.overflow = 'auto';
    this.rightPanel.style.minHeight = '0';
    this.rightPanel.style.background = 'var(--jp-layout-color1)';

    this.renderRightPanelEmpty();
    this.container.appendChild(this.leftPanel);
    this.container.appendChild(this.rightPanel);
    this.renderTree();
  }

  private renderTree() {
    const container = this.leftPanel.querySelector(
      '#library-tree-container'
    ) as HTMLElement;
    container.innerHTML = '';
    const categories = Object.keys(this.libraryData);
    categories.forEach(cat => {
      const functions = this.libraryData[cat];
      const catItem = document.createElement('div');
      catItem.className = 'jp-Library-Category';
      const catHeader = document.createElement('div');
      catHeader.style.padding = '8px 12px';
      catHeader.style.cursor = 'pointer';
      catHeader.style.fontWeight = 'bold';
      catHeader.style.display = 'flex';
      catHeader.style.alignItems = 'center';
      catHeader.style.userSelect = 'none';
      catHeader.style.color = 'var(--jp-ui-font-color1)';
      const icon = document.createElement('span');
      icon.className = 'jp-Icon jp-Icon-16';
      const isExpanded = this.expandedCategories.has(cat);
      icon.textContent = isExpanded ? '▼' : '▶';
      icon.style.marginRight = '6px';
      icon.style.fontSize = '10px';
      catHeader.appendChild(icon);
      catHeader.appendChild(document.createTextNode(cat));
      const algoList = document.createElement('div');
      algoList.style.display = isExpanded ? 'block' : 'none';
      algoList.style.paddingLeft = '0';
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
      functions.forEach(func => {
        const algoItem = document.createElement('div');
        algoItem.textContent = func.name;
        algoItem.style.padding = '6px 12px 6px 34px';
        algoItem.style.cursor = 'pointer';
        algoItem.style.fontSize = '13px';
        algoItem.style.borderLeft = '3px solid transparent';
        if (this.selectedFunctionId === func.id) {
          algoItem.style.background = 'var(--jp-brand-color2)';
          algoItem.style.borderLeft = '3px solid var(--jp-brand-color1)';
        }
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
        algoItem.onclick = () => {
          this.selectFunction(func);
          this.renderTree();
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

    // 1. Algorithm Description
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

    // 2. Parameters Form (New Section)
    this.currentParams = {};
    if (func.args && func.args.length > 0) {
      const paramLabel = document.createElement('div');
      paramLabel.textContent = '参数配置';
      paramLabel.style.fontWeight = 'bold';
      paramLabel.style.fontSize = '11px';
      paramLabel.style.color = 'var(--jp-ui-font-color2)';
      paramLabel.style.marginBottom = '12px';
      this.rightPanel.appendChild(paramLabel);

      const paramContainer = document.createElement('div');
      paramContainer.style.marginBottom = '24px';
      paramContainer.style.padding = '12px';
      paramContainer.style.background = 'var(--jp-layout-color2)';
      paramContainer.style.borderRadius = '4px';
      paramContainer.style.border = '1px solid var(--jp-border-color2)';

      func.args.forEach(arg => {
        let initial = arg.default !== undefined ? arg.default : '';
        if (arg.name === 'filepath' && typeof initial === 'string') {
          const parts = initial.split(/[\\/]/);
          initial = parts[parts.length - 1];
        }
        this.currentParams[arg.name] = initial;

        const row = document.createElement('div');
        row.style.marginBottom = '12px';
        row.style.display = 'flex';
        row.style.flexDirection = 'column';

        const labelRow = document.createElement('div');
        labelRow.style.display = 'flex';
        labelRow.style.justifyContent = 'space-between';
        labelRow.style.marginBottom = '4px';

        const label = document.createElement('label');
        label.textContent = arg.label || arg.name;
        label.style.fontWeight = '500';
        label.style.fontSize = '12px';
        labelRow.appendChild(label);

        if (arg.description) {
          const desc = document.createElement('span');
          desc.textContent = arg.description;
          desc.style.fontSize = '10px';
          desc.style.color = 'var(--jp-ui-font-color2)';
          labelRow.appendChild(desc);
        }
        row.appendChild(labelRow);

        let input: HTMLElement;
        if (arg.options && arg.options.length > 0) {
          const select = document.createElement('select');
          select.className = 'jp-mod-styled';
          select.style.width = '100%';
          const defaultBase =
            typeof arg.default === 'string'
              ? arg.default.split(/[\\/]/).pop() || ''
              : '';
          arg.options.forEach(opt => {
            const option = document.createElement('option');
            const base = opt.split(/[\\/]/).pop() || opt;
            option.value = base;
            option.textContent = base;
            if (base === defaultBase) {
              option.selected = true;
            }
            select.appendChild(option);
          });
          select.onchange = () => {
            this.currentParams[arg.name] = select.value;
            this.updateCode(func);
          };
          input = select;
        } else {
          const inp = document.createElement('input');
          inp.className = 'jp-mod-styled';
          inp.style.width = '100%';

          if (arg.type === 'int' || arg.type === 'float') {
            inp.type = 'number';
            if (arg.step) {
              inp.step = arg.step.toString();
            }
            // Removing min/max to prevent browser validation from disabling the dialog button
            // if (arg.min !== undefined) inp.min = arg.min.toString();
            // if (arg.max !== undefined) inp.max = arg.max.toString();
            inp.value = arg.default.toString();
            inp.onchange = () => {
              const val = parseFloat(inp.value);
              this.currentParams[arg.name] = isNaN(val) ? arg.default : val;
              this.updateCode(func);
            };
          } else {
            inp.type = 'text';
            let dv = arg.default ? arg.default.toString() : '';
            if (arg.name === 'filepath' && typeof dv === 'string') {
              const parts = dv.split(/[\\/]/);
              dv = parts[parts.length - 1];
            }
            inp.value = dv;
            inp.oninput = () => {
              this.currentParams[arg.name] = inp.value;
              this.updateCode(func);
            };
          }
          input = inp;
        }
        row.appendChild(input);
        paramContainer.appendChild(row);
      });
      this.rightPanel.appendChild(paramContainer);
    }

    // 3. Code Template Preview
    const codeLabel = document.createElement('div');
    codeLabel.textContent = '代码预览';
    codeLabel.style.fontWeight = 'bold';
    codeLabel.style.fontSize = '11px';
    codeLabel.style.color = 'var(--jp-ui-font-color2)';
    codeLabel.style.marginBottom = '0';
    this.rightPanel.appendChild(codeLabel);

    this.codePreElement = document.createElement('pre');
    this.codePreElement.style.background = 'var(--jp-layout-color0)';
    this.codePreElement.style.padding = '12px';
    this.codePreElement.style.borderRadius = '4px';
    this.codePreElement.style.border = '1px solid var(--jp-border-color2)';
    this.codePreElement.style.fontFamily = 'var(--jp-code-font-family)';
    this.codePreElement.style.fontSize = '13px';
    this.codePreElement.style.flex = '1';
    this.codePreElement.style.minHeight = '200px';
    this.codePreElement.style.maxHeight = 'none';
    this.codePreElement.style.margin = '0';
    this.codePreElement.style.height = 'auto';
    this.codePreElement.style.overflow = 'auto';
    this.codePreElement.style.whiteSpace = 'pre';
    this.rightPanel.appendChild(this.codePreElement);

    this.updateCode(func);
  }

  private updateCode(func: ILibraryFunction) {
    let finalCode = '';

    // 1. Add Imports
    if (func.imports && func.imports.length > 0) {
      finalCode += func.imports.join('\n') + '\n\n';
    }

    if (!func.template) {
      finalCode += `# ${func.name}\n# 暂无可用模板。`;
    } else {
      let code = func.template;
      const varName = this.dfName || 'df';
      code = code.replace(/{VAR_NAME}/g, varName);
      
      // Generate output variable name
      const outputVarName = varName + '_out';
      code = code.replace(/{OUTPUT_VAR}/g, outputVarName);

      // Replace parameters
      if (func.args) {
        func.args.forEach(arg => {
          let val = this.currentParams[arg.name];
          if (val === undefined || val === null) {
            val = '';
          }

          // Handle absolute path for filepath parameter
          if (
            arg.name === 'filepath' &&
            typeof val === 'string' &&
            this.serverRoot
          ) {
            // Normalize separators
            const isWin = this.serverRoot.includes('\\');
            const sep = isWin ? '\\' : '/';
            let valNorm = val.replace(/\//g, sep).replace(/\\/g, sep);

            // If value is just a filename (no separators), assume it's in dataset folder
            if (!valNorm.includes(sep)) {
              valNorm = `dataset${sep}${valNorm}`;
            }

            // Check if it's already absolute
            // Simple check: Win (X:\ or \\) or Unix (/)
            const isAbs = isWin
              ? /^[a-zA-Z]:\\/.test(valNorm) || valNorm.startsWith('\\\\')
              : valNorm.startsWith('/');

            if (!isAbs) {
              // Remove leading slash/backslash from val if present to avoid double separators
              let cleanVal = valNorm;
              if (cleanVal.startsWith(sep)) {
                cleanVal = cleanVal.substring(1);
              }

              // If serverRoot ends with separator, don't add another
              let root = this.serverRoot;
              if (root.endsWith(sep)) {
                root = root.substring(0, root.length - 1);
              }

              val = `${root}${sep}${cleanVal}`;

              // Escape backslashes for Python string if on Windows
              // Python string literal: "C:\\Path" or r"C:\Path"
              // The template usually uses simple quotes.
              // If we use raw string in template r'{filepath}', single backslashes are fine.
              // But if template is '{filepath}', we need double backslashes.
              // Let's look at the template.
              // load_csv template: filepath = '{filepath}'
              // It is NOT a raw string in the template definition in Python file: filepath = '{filepath}'
              // So we MUST escape backslashes.
              if (isWin) {
                val = val.replace(/\\/g, '\\\\');
              }
            }
          }

          const placeholder = `{${arg.name}}`;
          code = code.replace(new RegExp(placeholder, 'g'), val.toString());
        });
      }
      finalCode += code;
    }

    this.selectedCode = finalCode;

    if (this.codePreElement) {
      this.codePreElement.textContent = this.selectedCode;
    }
  }

  private selectFunction(func: ILibraryFunction) {
    this.selectedFunctionId = func.id;
    this.renderRightPanelDetails(func);
  }

  getValue(): string {
    return this.selectedCode;
  }
}

export class AlgorithmLibraryDialogManager {
  private aiService: AiService;

  constructor(app: JupyterFrontEnd) {
    this.aiService = new AiService();
  }

  async openLibraryDialog(
    panel: NotebookPanel,
    currentDfName: string | null
  ): Promise<void> {
    const [libraryData, serverRoot] = await Promise.all([
      this.aiService.getFunctionLibrary(),
      this.aiService.getServerRoot()
    ]);
    const body = new LibraryBodyWidget(
      libraryData,
      currentDfName || 'df',
      serverRoot
    );
    const dialog = new Dialog({
      title: '算法函数库',
      body: body,
      buttons: [
        Dialog.cancelButton({ label: '取消' }),
        Dialog.okButton({ label: '插入代码' })
      ]
    });
    const content = dialog.node.querySelector(
      '.jp-Dialog-content'
    ) as HTMLElement | null;
    const bodyEl = dialog.node.querySelector(
      '.jp-Dialog-body'
    ) as HTMLElement | null;
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

  private insertCode(panel: NotebookPanel, code: string): void {
    const cell = panel.content.activeCell;
    if (cell && cell.model.type === 'code') {
      const src = cell.model.sharedModel.getSource().trim();
      if (src.length === 0) {
        cell.model.sharedModel.setSource(code);
      } else {
        const newSource = src + '\n\n' + code;
        cell.model.sharedModel.setSource(newSource);
      }
    }
  }
}
