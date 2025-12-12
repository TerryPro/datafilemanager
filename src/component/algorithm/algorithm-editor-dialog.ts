import { Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';

export interface IPort {
  name: string;
  type: string;
}

export interface IAlgorithmData {
  id: string;
  category: string;
  code: string;
  description?: string;
  args?: any[];
  inputs?: IPort[];
  outputs?: IPort[];
}

export interface ICategory {
  id: string;
  label: string;
}

class AlgorithmEditorBody extends Widget implements Dialog.IBodyWidget<IAlgorithmData> {
  private idInput: HTMLInputElement;
  private categorySelect: HTMLSelectElement;
  private descriptionInput: HTMLTextAreaElement;
  private argsContainer: HTMLElement;
  private inputsContainer: HTMLElement;
  private outputsContainer: HTMLElement;
  private args: any[] = [];
  private inputs: IPort[] = [];
  private outputs: IPort[] = [];
  private codeInput: HTMLTextAreaElement;
  private isEdit: boolean;

  constructor(algo: IAlgorithmData | null, categories: ICategory[]) {
    super();
    this.isEdit = !!algo;
    this.args = algo?.args ? JSON.parse(JSON.stringify(algo.args)) : [];
    this.inputs = algo?.inputs ? JSON.parse(JSON.stringify(algo.inputs)) : [];
    this.outputs = algo?.outputs ? JSON.parse(JSON.stringify(algo.outputs)) : [];

    // If new algorithm, add defaults
    if (!this.isEdit && this.args.length === 0) {
      this.args = [
        { name: 'df', type: 'pd.DataFrame', description: 'Input DataFrame' }
      ];
    }
    if (!this.isEdit && this.inputs.length === 0) {
      this.inputs = [{ name: 'df_in', type: 'DataFrame' }];
    }
    if (!this.isEdit && this.outputs.length === 0) {
      this.outputs = [{ name: 'df_out', type: 'DataFrame' }];
    }

    this.addClass('jp-AlgorithmEditorBody');
    this.node.style.overflow = 'hidden';
    this.node.style.display = 'flex';
    this.node.style.flexDirection = 'column';

    // Container matching Info Dialog
    const container = document.createElement('div');
    container.style.minWidth = '800px';
    container.style.maxWidth = '800px';
    container.style.height = '70vh'; // Matched with Info Dialog
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.padding = '0 12px 12px 4px';
    container.style.boxSizing = 'border-box';
    container.style.overflowX = 'hidden'; // FIX: Prevent bottom extra scrollbar
    container.style.overflowY = 'auto'; // Auto scroll for content

    this.node.appendChild(container);
    this.node.style.resize = 'none';

    // --- Header Section (Sticky) ---
    const header = document.createElement('div');
    header.style.marginBottom = '12px';
    header.style.borderBottom = '1px solid var(--jp-border-color2)';
    header.style.paddingBottom = '8px';
    header.style.position = 'sticky';
    header.style.top = '0';
    header.style.backgroundColor = 'var(--jp-layout-color1)';
    header.style.zIndex = '10';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '16px';

    // Name (ID) Input - flex: 1 to take remaining space
    const idWrapper = document.createElement('div');
    idWrapper.style.flex = '1';
    idWrapper.style.display = 'flex';
    idWrapper.style.flexDirection = 'column';

    const idLabel = document.createElement('label');
    idLabel.textContent = 'Function Name (ID)';
    idLabel.style.fontSize = '11px';
    idLabel.style.color = 'var(--jp-ui-font-color2)';
    idLabel.style.marginBottom = '2px';

    this.idInput = document.createElement('input');
    this.idInput.style.width = '100%';
    this.idInput.style.boxSizing = 'border-box';
    this.idInput.style.fontSize = '14px';
    this.idInput.style.color = 'var(--jp-ui-font-color0)';
    this.idInput.style.fontWeight = 'bold';
    this.idInput.style.border = '1px solid var(--jp-border-color2)';
    this.idInput.style.borderRadius = '4px';
    this.idInput.style.padding = '4px 6px';
    this.idInput.style.backgroundColor = 'var(--jp-layout-color1)';
    this.idInput.value = algo?.id || '';
    this.idInput.placeholder = 'my_algorithm_name';
    this.idInput.addEventListener('input', () => this.syncCode());

    idWrapper.appendChild(idLabel);
    idWrapper.appendChild(this.idInput);

    // Category Select - fixed width
    const catWrapper = document.createElement('div');
    catWrapper.style.display = 'flex';
    catWrapper.style.flexDirection = 'column';

    const catLabel = document.createElement('label');
    catLabel.textContent = 'Category';
    catLabel.style.fontSize = '11px';
    catLabel.style.color = 'var(--jp-ui-font-color2)';
    catLabel.style.marginBottom = '2px';

    this.categorySelect = document.createElement('select');
    this.categorySelect.className = 'jp-mod-styled';
    this.categorySelect.style.fontSize = '12px';
    this.categorySelect.style.padding = '4px 8px';
    this.categorySelect.style.height = 'auto';
    this.categorySelect.style.margin = '0';

    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.text = cat.label;
      if (algo && algo.category === cat.id) option.selected = true;
      this.categorySelect.appendChild(option);
    });

    catWrapper.appendChild(catLabel);
    catWrapper.appendChild(this.categorySelect);

    header.appendChild(idWrapper);
    header.appendChild(catWrapper);
    container.appendChild(header);

    // --- Description Section ---
    const descHeader = document.createElement('h3');
    descHeader.textContent = 'Description';
    descHeader.style.fontSize = '14px';
    descHeader.style.marginTop = '0';
    descHeader.style.marginBottom = '4px';
    container.appendChild(descHeader);

    this.descriptionInput = document.createElement('textarea');
    this.descriptionInput.className = 'jp-mod-styled';
    this.descriptionInput.style.width = '100%';
    this.descriptionInput.style.boxSizing = 'border-box';
    this.descriptionInput.style.minHeight = '40px';
    this.descriptionInput.style.maxHeight = '60px';
    this.descriptionInput.style.marginBottom = '12px';
    this.descriptionInput.style.resize = 'none';
    this.descriptionInput.style.fontFamily = 'var(--jp-ui-font-family)';
    this.descriptionInput.style.color = 'var(--jp-ui-font-color1)';
    this.descriptionInput.style.lineHeight = '1.4';
    this.descriptionInput.style.fontSize = '12px';
    this.descriptionInput.value = algo?.description || '';
    this.descriptionInput.placeholder = 'Enter a brief description...';
    this.descriptionInput.addEventListener('input', () => this.syncCode());
    container.appendChild(this.descriptionInput);

    // --- Inputs & Outputs Row (Side by Side) ---
    const ioRow = document.createElement('div');
    ioRow.style.display = 'flex';
    ioRow.style.gap = '16px';
    ioRow.style.marginBottom = '12px';

    // --- Inputs Column ---
    const inputsColumn = document.createElement('div');
    inputsColumn.style.flex = '1';

    const inputsHeader = document.createElement('div');
    inputsHeader.style.display = 'flex';
    inputsHeader.style.justifyContent = 'space-between';
    inputsHeader.style.alignItems = 'center';
    inputsHeader.style.marginBottom = '4px';

    const inputsTitle = document.createElement('h3');
    inputsTitle.textContent = 'Inputs';
    inputsTitle.style.fontSize = '13px';
    inputsTitle.style.margin = '0';
    inputsHeader.appendChild(inputsTitle);

    const addInputBtn = document.createElement('button');
    addInputBtn.className = 'jp-mod-styled jp-mod-accept';
    addInputBtn.textContent = '+';
    addInputBtn.style.fontSize = '11px';
    addInputBtn.style.padding = '2px 6px';
    addInputBtn.title = 'Add Input';
    addInputBtn.onclick = () => this.addInput();
    inputsHeader.appendChild(addInputBtn);
    inputsColumn.appendChild(inputsHeader);

    this.inputsContainer = document.createElement('div');
    inputsColumn.appendChild(this.inputsContainer);
    this.renderInputs();

    ioRow.appendChild(inputsColumn);

    // --- Outputs Column ---
    const outputsColumn = document.createElement('div');
    outputsColumn.style.flex = '1';

    const outputsHeader = document.createElement('div');
    outputsHeader.style.display = 'flex';
    outputsHeader.style.justifyContent = 'space-between';
    outputsHeader.style.alignItems = 'center';
    outputsHeader.style.marginBottom = '4px';

    const outputsTitle = document.createElement('h3');
    outputsTitle.textContent = 'Outputs';
    outputsTitle.style.fontSize = '13px';
    outputsTitle.style.margin = '0';
    outputsHeader.appendChild(outputsTitle);

    const addOutputBtn = document.createElement('button');
    addOutputBtn.className = 'jp-mod-styled jp-mod-accept';
    addOutputBtn.textContent = '+';
    addOutputBtn.style.fontSize = '11px';
    addOutputBtn.style.padding = '2px 6px';
    addOutputBtn.title = 'Add Output';
    addOutputBtn.onclick = () => this.addOutput();
    outputsHeader.appendChild(addOutputBtn);
    outputsColumn.appendChild(outputsHeader);

    this.outputsContainer = document.createElement('div');
    outputsColumn.appendChild(this.outputsContainer);
    this.renderOutputs();

    ioRow.appendChild(outputsColumn);
    container.appendChild(ioRow);

    // --- Parameters Section ---
    const paramHeader = document.createElement('div');
    paramHeader.style.display = 'flex';
    paramHeader.style.justifyContent = 'space-between';
    paramHeader.style.alignItems = 'center';
    paramHeader.style.marginBottom = '4px';

    const paramTitle = document.createElement('h3');
    paramTitle.textContent = 'Parameters';
    paramTitle.style.fontSize = '13px';
    paramTitle.style.margin = '0';
    paramHeader.appendChild(paramTitle);

    const addParamBtn = document.createElement('button');
    addParamBtn.className = 'jp-mod-styled jp-mod-accept';
    addParamBtn.textContent = '+ Add';
    addParamBtn.style.fontSize = '11px';
    addParamBtn.style.padding = '2px 6px';
    addParamBtn.onclick = () => this.addParam();
    paramHeader.appendChild(addParamBtn);
    container.appendChild(paramHeader);

    this.argsContainer = document.createElement('div');
    this.argsContainer.style.marginBottom = '12px';
    container.appendChild(this.argsContainer);
    this.renderParams();

    // --- Code Section (Flex to fill remaining space) ---
    const codeWrapper = document.createElement('div');
    codeWrapper.style.display = 'flex';
    codeWrapper.style.flexDirection = 'column';
    codeWrapper.style.flex = '1';
    codeWrapper.style.minHeight = '120px';

    const codeHeader = document.createElement('h3');
    codeHeader.textContent = 'Code Template';
    codeHeader.style.fontSize = '13px';
    codeHeader.style.marginBottom = '4px';
    codeHeader.style.marginTop = '0';
    codeWrapper.appendChild(codeHeader);

    this.codeInput = document.createElement('textarea');
    this.codeInput.className = 'jp-mod-styled';
    this.codeInput.style.width = '100%';
    this.codeInput.style.flex = '1';
    this.codeInput.style.minHeight = '100px';
    this.codeInput.style.boxSizing = 'border-box';
    this.codeInput.style.fontFamily = 'var(--jp-code-font-family)';
    this.codeInput.style.fontSize = '12px';
    this.codeInput.style.lineHeight = '1.4';
    this.codeInput.style.whiteSpace = 'pre';
    this.codeInput.style.overflowX = 'auto';
    this.codeInput.style.backgroundColor = 'var(--jp-layout-color2)';
    this.codeInput.style.border = '1px solid var(--jp-border-color2)';
    this.codeInput.style.padding = '8px';
    this.codeInput.spellcheck = false;
    this.codeInput.style.resize = 'none';

    // Initial Code
    if (algo?.code) {
      this.codeInput.value = algo.code;
    } else {
      this.syncCode(true); // Generate initial code
    }

    codeWrapper.appendChild(this.codeInput);
    container.appendChild(codeWrapper);
  }

  private renderParams() {
    this.argsContainer.innerHTML = '';

    if (this.args.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No parameters defined.';
      empty.style.color = 'var(--jp-ui-font-color2)';
      empty.style.fontStyle = 'italic';
      empty.style.fontSize = '12px';
      this.argsContainer.appendChild(empty);
      return;
    }

    // Table Design matching Info Dialog
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '13px';
    table.style.border = '1px solid var(--jp-border-color2)';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = 'var(--jp-layout-color2)';

    ['Name', 'Type', 'Description', ''].forEach(text => { // Last col for Action
      const th = document.createElement('th');
      th.textContent = text;
      th.style.textAlign = 'left';
      th.style.padding = '8px';
      th.style.borderBottom = '1px solid var(--jp-border-color2)';
      th.style.color = 'var(--jp-ui-font-color1)';
      th.style.fontWeight = '600';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    this.args.forEach((arg, index) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--jp-border-color2)';

      const createCellInput = (initialValue: string, onChange: (val: string) => void) => {
        const input = document.createElement('input');
        input.value = initialValue;
        input.style.width = '100%';
        input.style.boxSizing = 'border-box'; // FIX: Padding calculation
        input.style.border = 'none';
        input.style.background = 'transparent';
        input.style.fontSize = '13px';
        input.style.color = 'var(--jp-ui-font-color0)';
        input.style.padding = '0'; // Increase padding to match height of select
        input.style.margin = '0';
        input.style.outline = 'none';
        input.onfocus = () => { input.style.borderBottom = '1px solid var(--jp-brand-color1)'; };
        input.onblur = () => { input.style.borderBottom = 'none'; };
        input.oninput = (e) => onChange((e.target as HTMLInputElement).value);
        return input;
      };

      // Name
      const tdName = document.createElement('td');
      tdName.style.padding = '8px'; // Match header padding exactly
      tdName.appendChild(createCellInput(arg.name || '', (val) => {
        this.args[index].name = val;
        this.syncCode();
      }));
      tr.appendChild(tdName);

      // Type
      const tdType = document.createElement('td');
      tdType.style.padding = '8px'; // Match header padding exactly
      tdType.style.fontFamily = 'var(--jp-code-font-family)';
      tdType.style.width = '120px';

      const typeSelect = document.createElement('select');
      typeSelect.style.width = 'auto';
      typeSelect.style.border = 'none';
      typeSelect.style.background = 'transparent';
      typeSelect.style.fontSize = '12px';
      typeSelect.style.fontFamily = 'var(--jp-code-font-family)';
      typeSelect.style.outline = 'none';
      typeSelect.style.margin = '0';
      typeSelect.style.padding = '0';
      // Negative margin to compensate for browser's internal select padding
      typeSelect.style.marginLeft = '-3px';

      const types = ['pd.DataFrame', 'str', 'int', 'float', 'bool', 'list', 'dict', 'Any'];
      if (arg.type && !types.includes(arg.type)) types.push(arg.type);

      types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.text = t;
        if (arg.type === t) opt.selected = true;
        typeSelect.appendChild(opt);
      });
      typeSelect.onchange = (e) => {
        this.args[index].type = (e.target as HTMLSelectElement).value;
        this.syncCode();
      };
      tdType.appendChild(typeSelect);
      tr.appendChild(tdType);

      // Description
      const tdDesc = document.createElement('td');
      tdDesc.style.padding = '8px'; // Match header padding exactly
      tdDesc.appendChild(createCellInput(arg.description || '', (val) => {
        this.args[index].description = val;
        this.syncCode();
      }));
      tr.appendChild(tdDesc);

      // Action (Delete)
      const tdAction = document.createElement('td');
      tdAction.style.padding = '8px';
      tdAction.style.textAlign = 'center';
      tdAction.style.width = '40px';
      tdAction.style.verticalAlign = 'middle';

      const delBtn = document.createElement('div');
      delBtn.innerHTML = '&#x2715;';
      delBtn.style.color = 'var(--jp-ui-font-color2)';
      delBtn.style.cursor = 'pointer';
      delBtn.style.fontSize = '12px';
      delBtn.title = 'Remove parameter';
      delBtn.onclick = () => {
        this.args.splice(index, 1);
        this.renderParams();
        this.syncCode();
      };
      delBtn.onmouseover = () => { delBtn.style.color = 'var(--jp-error-color1)'; };
      delBtn.onmouseout = () => { delBtn.style.color = 'var(--jp-ui-font-color2)'; };

      tdAction.appendChild(delBtn);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    this.argsContainer.appendChild(table);
  }

  private addParam() {
    this.args.push({ name: 'new_param', type: 'str', description: 'Description' });
    this.renderParams();
    this.syncCode();
  }

  private addInput() {
    this.inputs.push({ name: 'new_input', type: 'DataFrame' });
    this.renderInputs();
  }

  private addOutput() {
    this.outputs.push({ name: 'new_output', type: 'DataFrame' });
    this.renderOutputs();
  }

  private renderInputs() {
    this.renderPortTable(this.inputsContainer, this.inputs, 'input');
  }

  private renderOutputs() {
    this.renderPortTable(this.outputsContainer, this.outputs, 'output');
  }

  private renderPortTable(container: HTMLElement, ports: IPort[], portType: 'input' | 'output') {
    container.innerHTML = '';

    if (ports.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = `No ${portType}s defined.`;
      empty.style.color = 'var(--jp-ui-font-color2)';
      empty.style.fontStyle = 'italic';
      empty.style.fontSize = '12px';
      container.appendChild(empty);
      return;
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '13px';
    table.style.border = '1px solid var(--jp-border-color2)';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = 'var(--jp-layout-color2)';

    ['Name', 'Type', ''].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      th.style.textAlign = 'left';
      th.style.padding = '8px';
      th.style.borderBottom = '1px solid var(--jp-border-color2)';
      th.style.color = 'var(--jp-ui-font-color1)';
      th.style.fontWeight = '600';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    ports.forEach((port, index) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--jp-border-color2)';

      // Name
      const tdName = document.createElement('td');
      tdName.style.padding = '8px';
      const nameInput = document.createElement('input');
      nameInput.value = port.name || '';
      nameInput.style.width = '100%';
      nameInput.style.boxSizing = 'border-box';
      nameInput.style.border = 'none';
      nameInput.style.background = 'transparent';
      nameInput.style.fontSize = '13px';
      nameInput.style.color = 'var(--jp-ui-font-color0)';
      nameInput.style.padding = '0';
      nameInput.style.outline = 'none';
      nameInput.onfocus = () => { nameInput.style.borderBottom = '1px solid var(--jp-brand-color1)'; };
      nameInput.onblur = () => { nameInput.style.borderBottom = 'none'; };
      nameInput.oninput = (e) => { ports[index].name = (e.target as HTMLInputElement).value; };
      tdName.appendChild(nameInput);
      tr.appendChild(tdName);

      // Type
      const tdType = document.createElement('td');
      tdType.style.padding = '8px';
      tdType.style.width = '120px';
      const typeSelect = document.createElement('select');
      typeSelect.style.width = 'auto';
      typeSelect.style.border = 'none';
      typeSelect.style.background = 'transparent';
      typeSelect.style.fontSize = '12px';
      typeSelect.style.outline = 'none';
      typeSelect.style.margin = '0';
      typeSelect.style.padding = '0';

      const types = ['DataFrame', 'any', 'str', 'int', 'float', 'list', 'dict'];
      if (port.type && !types.includes(port.type)) types.push(port.type);

      types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.text = t;
        if (port.type === t) opt.selected = true;
        typeSelect.appendChild(opt);
      });
      typeSelect.onchange = (e) => { ports[index].type = (e.target as HTMLSelectElement).value; };
      tdType.appendChild(typeSelect);
      tr.appendChild(tdType);

      // Action (Delete)
      const tdAction = document.createElement('td');
      tdAction.style.padding = '8px';
      tdAction.style.textAlign = 'center';
      tdAction.style.width = '40px';

      const delBtn = document.createElement('div');
      delBtn.innerHTML = '&#x2715;';
      delBtn.style.color = 'var(--jp-ui-font-color2)';
      delBtn.style.cursor = 'pointer';
      delBtn.style.fontSize = '12px';
      delBtn.title = `Remove ${portType}`;
      delBtn.onclick = () => {
        ports.splice(index, 1);
        this.renderPortTable(container, ports, portType);
      };
      delBtn.onmouseover = () => { delBtn.style.color = 'var(--jp-error-color1)'; };
      delBtn.onmouseout = () => { delBtn.style.color = 'var(--jp-ui-font-color2)'; };

      tdAction.appendChild(delBtn);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  private syncCode(force: boolean = false) {
    const id = this.idInput.value.trim() || 'new_algorithm';
    const desc = this.descriptionInput.value || 'Algorithm Description';

    // Construct Args string for function definition
    const defArgs = this.args.map(a => a.name).join(', ');

    // Construct Docstring
    let docstring = `    """\n    ${desc}\n\n    Args:\n`;
    this.args.forEach(a => {
      docstring += `        ${a.name} (${a.type}): ${a.description}\n`;
    });
    docstring += `\n    Returns:\n        DataFrame or dict: Result\n    """`;

    const currentCode = this.codeInput.value;
    const funcRegex = /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*?)\)\s*:/;
    let newCode = currentCode;

    if (force || !currentCode) {
      newCode = `def ${id}(${defArgs}):
${docstring}
    # Your code here
    return df
`;
    } else {
      const lines = currentCode.split('\n');
      const defLineIndex = lines.findIndex(l => l.trim().startsWith('def '));

      if (defLineIndex !== -1) {
        lines[defLineIndex] = `def ${id}(${defArgs}):`;

        let tempCode = lines.join('\n');
        const match = tempCode.match(funcRegex);
        if (match) {
          const endOfDef = match.index! + match[0].length;
          const afterDef = tempCode.slice(endOfDef);
          const docMatch = afterDef.match(/^\s*("""[\s\S]*?"""|'''[\s\S]*?''')/);

          if (docMatch) {
            const beforeDoc = tempCode.slice(0, endOfDef);
            const afterDoc = afterDef.slice(docMatch.index! + docMatch[0].length);
            newCode = beforeDoc + '\n' + docstring + afterDoc;
          } else {
            const beforeDoc = tempCode.slice(0, endOfDef);
            newCode = beforeDoc + '\n' + docstring + afterDef;
          }
        } else {
          newCode = tempCode;
        }
      } else {
        if (!currentCode.trim()) {
          newCode = `def ${id}(${defArgs}):\n${docstring}\n    pass`;
        }
      }
    }

    this.codeInput.value = newCode;
  }

  getValue(): IAlgorithmData {
    return {
      id: this.idInput.value.trim(),
      category: this.categorySelect.value,
      code: this.codeInput.value,
      description: this.descriptionInput.value,
      args: this.args,
      inputs: this.inputs,
      outputs: this.outputs
    };
  }
}

export class AlgorithmEditorDialogManager {

  async showEditor(
    algo: IAlgorithmData | null,
    categories: ICategory[]
  ): Promise<IAlgorithmData | null> {

    const body = new AlgorithmEditorBody(algo, categories);

    const dialog = new Dialog({
      title: algo ? 'Edit Algorithm' : 'Add New Algorithm',
      body: body,
      buttons: [
        Dialog.cancelButton(),
        Dialog.okButton({ label: 'Save' })
      ]
    });

    // Style adjustments to match InfoDialog constraints
    const content = dialog.node.querySelector('.jp-Dialog-content') as HTMLElement;
    const bodyEl = dialog.node.querySelector('.jp-Dialog-body') as HTMLElement;

    dialog.node.style.resize = 'none';
    dialog.node.style.overflow = 'hidden';

    if (content) {
      content.style.resize = 'none';
      content.style.overflow = 'hidden';
      // FIX: Ensure 70vh matches height of internal container, but let Internal handle scroll
      content.style.maxHeight = 'none';
    }

    if (bodyEl) {
      bodyEl.style.overflow = 'visible'; // Keep visible, inner container has overflow: auto
    }

    const result = await dialog.launch();

    if (result.button.accept) {
      return body.getValue();
    }
    return null;
  }
}
