import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { AiService } from '../../services/ai-service';
import { LibraryService } from '../../services/library-service';

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
  inputs?: Array<{ name: string; type?: string }>;
  outputs?: Array<{ name: string; type?: string }>;
  args?: Array<{
    name: string;
    default?: any;
    annotation?: string;
    label?: string;
    description?: string;
    type?: string;
    widget?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    role?: 'input' | 'output' | 'parameter';
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
  private source: string; // 'dataframe_panel' or 'workflow'

  constructor(
    libraryData: ILibraryMetadata,
    dfName: string,
    serverRoot: string,
    source = 'dataframe_panel'
  ) {
    super();
    this.libraryData = libraryData;
    this.dfName = dfName;
    this.serverRoot = serverRoot;
    this.source = source;
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
    const varName = this.dfName || 'df';
    descContent.textContent = func.description.replace(/{VAR_NAME}/g, varName);
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
        // Skip input and output parameters in UI
        if (arg.role === 'input' || arg.role === 'output') {
          return;
        }

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
        } else if (
          arg.type === 'bool' ||
          arg.widget === 'checkbox' ||
          typeof arg.default === 'boolean'
        ) {
          const wrapper = document.createElement('div');
          wrapper.style.display = 'flex';
          wrapper.style.alignItems = 'center';
          wrapper.style.minHeight = '24px';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.style.margin = '0 8px 0 0';

          const isChecked =
            initial === true || initial === 'True' || initial === 'true';
          checkbox.checked = isChecked;
          this.currentParams[arg.name] = isChecked;

          const cbLabel = document.createElement('span');
          cbLabel.textContent = isChecked ? 'True' : 'False';
          cbLabel.style.fontSize = '12px';

          checkbox.onchange = () => {
            this.currentParams[arg.name] = checkbox.checked;
            cbLabel.textContent = checkbox.checked ? 'True' : 'False';
            this.updateCode(func);
          };

          wrapper.appendChild(checkbox);
          wrapper.appendChild(cbLabel);
          input = wrapper;
        } else if (
          arg.type === 'list' ||
          (arg.widget === 'column-selector' && arg.type !== 'str') ||
          Array.isArray(arg.default)
        ) {
          const inp = document.createElement('input');
          inp.className = 'jp-mod-styled';
          inp.style.width = '100%';
          inp.type = 'text';
          inp.placeholder = '列名1, 列名2 (逗号分隔)';

          let displayVal = '';
          if (Array.isArray(initial)) {
            displayVal = initial.join(', ');
          } else if (typeof initial === 'string') {
            displayVal = initial.replace(/[[\]']/g, '');
          }
          inp.value = displayVal;

          const updateListParam = () => {
            const raw = inp.value;
            const parts = raw
              .split(/[,，]/)
              .map(s => s.trim())
              .filter(s => s);
            if (parts.length === 0) {
              this.currentParams[arg.name] = '[]';
            } else {
              this.currentParams[arg.name] = "['" + parts.join("', '") + "']";
            }
            this.updateCode(func);
          };

          // Initialize with formatted value if not already
          updateListParam();

          inp.oninput = updateListParam;
          input = inp;
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
            inp.value =
              arg.default !== undefined && arg.default !== null
                ? arg.default.toString()
                : '';
            inp.onchange = () => {
              const val = parseFloat(inp.value);
              this.currentParams[arg.name] = isNaN(val) ? arg.default : val;
              this.updateCode(func);
            };
          } else {
            inp.type = 'text';
            let dv =
              arg.default !== undefined && arg.default !== null
                ? arg.default.toString()
                : '';
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

    console.log('[DEBUG] updateCode called, this.source =', this.source);

    // Common: Generate Function Call Dynamically
    const funcName = func.id;
    const callArgs: string[] = [];
    const varName = this.dfName || 'df';

    // 1. Input DataFrame (mapped to 'df' or first input port)
    // Legacy check for input ports (keeping variable for reference if needed, or we can remove it)
    // const hasInputPorts = func.inputs && func.inputs.length > 0;

    // 2. Other Parameters
    if (func.args) {
      func.args.forEach(arg => {
        // Handle Inputs
        if (arg.role === 'input' || arg.name === 'df') {
          callArgs.push(`${arg.name}=${varName}`);
          return;
        }

        // Handle Outputs
        if (arg.role === 'output' || arg.name === 'output_var') {
          // Will be handled by appending output_var arg later, but we need to respect the param name
          // If the param name is NOT output_var, we should pass the output name to it.
          // BUT, standard convention in this project is `output_var` param name.
          // For now, let's assume the standard pattern where output_var is the param name.
          return;
        }

        let val = this.currentParams[arg.name];
        let isNone = false;

        if (
          arg.default === undefined &&
          (val === '' || val === null || val === undefined)
        ) {
          isNone = true;
          val = 'None';
        } else if (val === undefined || val === null) {
          val = arg.default; // Use default if available
          if (val === undefined) {
            val = ''; // Should not happen if default exists
          }
        }

        if (typeof val === 'boolean') {
          val = val ? 'True' : 'False';
        } else if (val === null) {
          val = 'None';
        }

        // Handle string quoting logic
        if (
          typeof val === 'string' &&
          !isNone &&
          val !== 'True' &&
          val !== 'False' &&
          val !== 'None'
        ) {
          const isStructure =
            (val.trim().startsWith('[') && val.trim().endsWith(']')) ||
            (val.trim().startsWith('(') && val.trim().endsWith(')')) ||
            (val.trim().startsWith('{') && val.trim().endsWith('}'));

          const noQuoteTypes = [
            'int',
            'float',
            'bool',
            'list',
            'tuple',
            'dict',
            'figsize'
          ];
          const shouldNotQuote =
            noQuoteTypes.includes(arg.type || '') || isStructure;

          if (!shouldNotQuote) {
            // Handle filepath normalization
            if (arg.name === 'filepath' && this.serverRoot) {
              const isWin = this.serverRoot.includes('\\');
              const sep = isWin ? '\\' : '/';
              const valNorm = val.replace(/\//g, sep).replace(/\\/g, sep);
              const isAbs = isWin
                ? /^[a-zA-Z]:\\/.test(valNorm) || valNorm.startsWith('\\\\')
                : valNorm.startsWith('/');
              if (!isAbs) {
                let cleanVal = valNorm;
                if (cleanVal.startsWith(sep)) {
                  cleanVal = cleanVal.substring(1);
                }
                let root = this.serverRoot;
                if (root.endsWith(sep)) {
                  root = root.substring(0, root.length - 1);
                }
                val = `${root}${sep}${cleanVal}`;
              }
              if (isWin) {
                val = val.replace(/\\/g, '\\\\');
              }
            }
            val = `'${val}'`;
          }
        } else if (Array.isArray(val)) {
          const formattedItems = val.map(v => {
            if (typeof v === 'string') {
              return `'${v}'`;
            }
            return String(v);
          });
          val = `[${formattedItems.join(', ')}]`;
        }

        callArgs.push(`${arg.name}=${val}`);
      });
    }

    // 3. Output Variable
    const outputVarName = varName + '_out';

    // Construct Call Code
    const callCode = `# ${func.name}
${outputVarName} = ${funcName}(${callArgs.join(', ')})

# Display results
if ${outputVarName} is not None:
    display(${outputVarName}.head())`;

    // Final Assembly based on Source
    console.log('[DEBUG] Before final assembly, this.source =', this.source);
    if (this.source === 'workflow') {
      console.log('[DEBUG] Using workflow mode (no imports)');
      finalCode = callCode;
    } else {
      console.log('[DEBUG] Using notebook mode (with imports)');
      // Notebook Mode: Add imports and function definition
      console.log('[DEBUG] updateCode: func.imports =', func.imports);
      if (func.imports && func.imports.length > 0) {
        console.log('[DEBUG] Adding imports:', func.imports);
        finalCode += func.imports.join('\n') + '\n\n';
      } else {
        console.log('[DEBUG] No imports to add (empty or undefined)');
      }

      if (func.template) {
        finalCode += func.template + '\n\n';
      } else {
        finalCode += `# ${func.name}\n# Source not available\n\n`;
      }

      finalCode += callCode;
    }

    console.log('[DEBUG] Final code length:', finalCode.length);
    console.log(
      '[DEBUG] Final code preview (first 200 chars):',
      finalCode.substring(0, 200)
    );

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

  getSelectedFunction(): ILibraryFunction | null {
    if (this.selectedFunctionId) {
      for (const cat in this.libraryData) {
        const func = this.libraryData[cat].find(
          f => f.id === this.selectedFunctionId
        );
        if (func) {
          return func;
        }
      }
    }
    return null;
  }
}

export class AlgorithmLibraryDialogManager {
  private aiService: AiService;
  private libraryService: LibraryService;

  constructor(_app: JupyterFrontEnd) {
    this.aiService = new AiService();
    this.libraryService = new LibraryService();
  }

  async openLibraryDialog(
    panel: NotebookPanel,
    currentDfName: string | null,
    source = 'dataframe_panel' // 'dataframe_panel' or 'workflow'
  ): Promise<void> {
    const [libraryData, serverRoot] = await Promise.all([
      this.libraryService.getFunctionLibrary(),
      this.aiService.getServerRoot()
    ]);
    const body = new LibraryBodyWidget(
      libraryData,
      currentDfName || 'df',
      serverRoot,
      source
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

  /**
   * Open dialog to select an algorithm and return its info instead of inserting code.
   */
  async selectAlgorithm(
    panel: NotebookPanel
  ): Promise<ILibraryFunction | null> {
    const [libraryData, serverRoot] = await Promise.all([
      this.libraryService.getFunctionLibrary(),
      this.aiService.getServerRoot()
    ]);

    // Pass empty string for dfName as we are just selecting algorithm type
    const body = new LibraryBodyWidget(
      libraryData,
      '',
      serverRoot,
      'dataframe_panel'
    );

    const dialog = new Dialog({
      title: 'Select Algorithm',
      body: body,
      buttons: [
        Dialog.cancelButton({ label: 'Cancel' }),
        Dialog.okButton({ label: 'Select' })
      ]
    });

    // Style adjustments (copied from openLibraryDialog)
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
      return body.getSelectedFunction();
    }
    return null;
  }
}
