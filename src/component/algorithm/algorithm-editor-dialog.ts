import { Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { LibraryService } from '../../services/library-service';

export interface IPort {
  name: string;
  type: string;
  description?: string;
}

export interface IParameter {
  name: string;
  type: string;
  description: string;
  label?: string;
  default?: string; // Keep as string for input, parse later if needed
  widget?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  priority?: 'critical' | 'non-critical';
}

export interface IAlgorithmData {
  id: string;
  name?: string;
  category: string;
  code: string;
  description?: string;
  prompt?: string;
  imports?: string[];
  args?: IParameter[];
  inputs?: IPort[];
  outputs?: IPort[];
}

export interface ICategory {
  id: string;
  label: string;
}

class ParameterSettingsBody
  extends Widget
  implements Dialog.IBodyWidget<Partial<IParameter>>
{
  private form!: HTMLFormElement;

  constructor(private param: IParameter) {
    super();
    this.node.appendChild(this.createForm());
  }

  createForm() {
    this.form = document.createElement('form');
    this.form.className = 'jp-ParameterSettings-form';

    const createRow = (label: string, input: HTMLElement) => {
      const row = document.createElement('div');
      row.className = 'jp-ParameterSettings-row';

      const lbl = document.createElement('label');
      lbl.textContent = label;
      lbl.className = 'jp-ParameterSettings-label';

      input.classList.add('jp-ParameterSettings-input');
      // Force input to be interactive and selectable, overriding any global JupyterLab styles
      input.style.pointerEvents = 'auto';
      input.style.userSelect = 'text';
      input.style.cursor = 'text';

      row.appendChild(lbl);
      row.appendChild(input);
      return row;
    };

    // Default Value
    const defaultInput = document.createElement('input');
    // Remove 'jp-mod-styled' to avoid gray background if that's the issue,
    // but keep consistent styling with class 'jp-ParameterSettings-input' which is added in createRow
    // defaultInput.className = 'jp-mod-styled';
    defaultInput.value =
      this.param.default !== undefined ? String(this.param.default) : '';
    defaultInput.name = 'default';
    this.form.appendChild(createRow('Default Value:', defaultInput));

    // Priority
    const prioritySelect = document.createElement('select');
    prioritySelect.className = 'jp-mod-styled';
    ['critical', 'non-critical'].forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.text = p;
      if (this.param.priority === p) {
        opt.selected = true;
      }
      prioritySelect.appendChild(opt);
    });
    prioritySelect.name = 'priority';
    this.form.appendChild(createRow('Priority:', prioritySelect));

    // Options (Only for select widget)
    if (this.param.widget === 'select') {
      const optionsInput = document.createElement('input');
      // optionsInput.className = 'jp-mod-styled';
      optionsInput.value = this.param.options
        ? JSON.stringify(this.param.options)
        : '';
      optionsInput.placeholder = '["opt1", "opt2"]';
      optionsInput.name = 'options';
      this.form.appendChild(createRow('Options (JSON):', optionsInput));
    }

    // Show Min/Max/Step only for numeric types AND widget is number
    if (
      ['int', 'float', 'number'].includes(this.param.type) &&
      this.param.widget === 'number'
    ) {
      // Min
      const minInput = document.createElement('input');
      minInput.type = 'number';
      // minInput.className = 'jp-mod-styled';
      minInput.value =
        this.param.min !== undefined ? String(this.param.min) : '';
      minInput.name = 'min';
      this.form.appendChild(createRow('Min:', minInput));

      // Max
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      // maxInput.className = 'jp-mod-styled';
      maxInput.value =
        this.param.max !== undefined ? String(this.param.max) : '';
      maxInput.name = 'max';
      this.form.appendChild(createRow('Max:', maxInput));

      // Step
      const stepInput = document.createElement('input');
      stepInput.type = 'number';
      // stepInput.className = 'jp-mod-styled';
      stepInput.value =
        this.param.step !== undefined ? String(this.param.step) : '';
      stepInput.name = 'step';
      this.form.appendChild(createRow('Step:', stepInput));
    }

    return this.form;
  }

  getValue(): Partial<IParameter> {
    const data: any = {};
    const defaultVal = this.form.querySelector<HTMLInputElement>(
      'input[name="default"]'
    )?.value;
    // Allow empty string to be set (to clear default) if needed,
    // but usually we check if it exists.
    // If user wants to set empty string as default, we should allow it.
    if (defaultVal !== undefined) {
      data.default = defaultVal;
    }

    const priority = this.form.querySelector<HTMLSelectElement>(
      'select[name="priority"]'
    )?.value;
    if (priority) {
      data.priority = priority;
    }

    const optionsVal = this.form.querySelector<HTMLInputElement>(
      'input[name="options"]'
    )?.value;
    if (optionsVal) {
      try {
        data.options = JSON.parse(optionsVal);
      } catch (e) {
        data.options = optionsVal.split(',').map(s => s.trim());
      }
    }

    if (
      ['int', 'float', 'number'].includes(this.param.type) &&
      this.param.widget === 'number'
    ) {
      const minVal =
        this.form.querySelector<HTMLInputElement>('input[name="min"]')?.value;
      if (minVal) {
        data.min = parseFloat(minVal);
      }

      const maxVal =
        this.form.querySelector<HTMLInputElement>('input[name="max"]')?.value;
      if (maxVal) {
        data.max = parseFloat(maxVal);
      }

      const stepVal =
        this.form.querySelector<HTMLInputElement>('input[name="step"]')?.value;
      if (stepVal) {
        data.step = parseFloat(stepVal);
      }
    }

    return data;
  }
}

class AlgorithmEditorBody
  extends Widget
  implements Dialog.IBodyWidget<IAlgorithmData>
{
  private libraryService = new LibraryService();
  private syncTimeout: any = null;
  private idInput: HTMLInputElement;
  private nameInput: HTMLInputElement;
  private categorySelect: HTMLSelectElement;
  private descriptionInput: HTMLTextAreaElement;
  private promptInput: HTMLTextAreaElement;
  private argsContainer: HTMLElement;
  private inputsContainer: HTMLElement;
  private outputsContainer: HTMLElement;
  private args: IParameter[] = [];
  private inputs: IPort[] = [];
  private outputs: IPort[] = [];
  private codeInput: HTMLTextAreaElement;
  private isEdit: boolean;
  private expandedParamIndex: number | null = null;

  constructor(algo: IAlgorithmData | null, categories: ICategory[]) {
    super();
    this.isEdit = !!algo;
    this.args = algo?.args ? JSON.parse(JSON.stringify(algo.args)) : [];
    this.inputs = algo?.inputs ? JSON.parse(JSON.stringify(algo.inputs)) : [];
    this.outputs = algo?.outputs
      ? JSON.parse(JSON.stringify(algo.outputs))
      : [];

    // If new algorithm, add defaults
    if (!this.isEdit && this.inputs.length === 0) {
      this.inputs = [
        { name: 'df', type: 'pd.DataFrame', description: 'Input DataFrame' }
      ];
    }
    if (!this.isEdit && this.outputs.length === 0) {
      this.outputs = [
        { name: 'df_out', type: 'DataFrame', description: 'Output DataFrame' }
      ];
    }

    this.addClass('jp-AlgorithmEditorBody');

    // Main Container (Split Layout)
    const container = document.createElement('div');
    container.className = 'jp-AlgorithmEditor-container';

    this.node.appendChild(container);

    // --- Left Panel (Metadata) ---
    const leftPanel = document.createElement('div');
    leftPanel.className = 'jp-AlgorithmEditor-leftPanel';
    container.appendChild(leftPanel);

    // --- Right Panel (Code) ---
    const rightPanel = document.createElement('div');
    rightPanel.className = 'jp-AlgorithmEditor-rightPanel';
    container.appendChild(rightPanel);

    // --- Header Section (Sticky in Left Panel) ---
    const header = document.createElement('div');
    header.className = 'jp-AlgorithmEditor-header';

    // Name (ID) Input
    const idWrapper = document.createElement('div');
    idWrapper.className = 'jp-AlgorithmEditor-header-idWrapper';

    const idLabel = document.createElement('label');
    idLabel.textContent = '算法ID';
    idLabel.className = 'jp-AlgorithmEditor-label';

    this.idInput = document.createElement('input');
    this.idInput.className = 'jp-mod-styled';
    this.idInput.style.width = '100%';
    this.idInput.style.fontWeight = 'bold';
    this.idInput.value = algo?.id || '';
    this.idInput.placeholder = 'my_algorithm_name';
    this.idInput.addEventListener('input', () => this.syncCode());

    idWrapper.appendChild(idLabel);
    idWrapper.appendChild(this.idInput);

    // Name Input
    const nameWrapper = document.createElement('div');
    nameWrapper.className = 'jp-AlgorithmEditor-header-idWrapper'; // Reuse class

    const nameLabel = document.createElement('label');
    nameLabel.textContent = '算法名称';
    nameLabel.className = 'jp-AlgorithmEditor-label';

    this.nameInput = document.createElement('input');
    this.nameInput.className = 'jp-mod-styled';
    this.nameInput.style.width = '100%';
    this.nameInput.value = algo?.name || '';
    this.nameInput.placeholder = 'Algorithm Name';
    this.nameInput.addEventListener('input', () => this.syncCode());

    nameWrapper.appendChild(nameLabel);
    nameWrapper.appendChild(this.nameInput);

    // Category Select
    const catWrapper = document.createElement('div');
    catWrapper.className = 'jp-AlgorithmEditor-header-catWrapper';

    const catLabel = document.createElement('label');
    catLabel.textContent = '算法分类';
    catLabel.className = 'jp-AlgorithmEditor-label';

    this.categorySelect = document.createElement('select');
    this.categorySelect.className = 'jp-mod-styled';
    this.categorySelect.style.width = '100%';

    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.text = cat.label;
      if (algo && algo.category === cat.id) {
        option.selected = true;
      }
      this.categorySelect.appendChild(option);
    });

    catWrapper.appendChild(catLabel);
    catWrapper.appendChild(this.categorySelect);

    header.appendChild(idWrapper);
    header.appendChild(nameWrapper);
    header.appendChild(catWrapper);
    leftPanel.appendChild(header);

    // --- Inputs & Outputs Row ---
    const ioRow = document.createElement('div');
    ioRow.className = 'jp-AlgorithmEditor-ioRow';

    // Inputs (group = header + panel)
    const inputsGroup = document.createElement('div');
    inputsGroup.className = 'jp-AlgorithmEditor-ioGroup';

    const inputsHeader = document.createElement('div');
    inputsHeader.className = 'jp-AlgorithmEditor-paramHeader';

    const inputsTitle = document.createElement('h3');
    inputsTitle.textContent = 'Inputs';
    inputsTitle.className = 'jp-AlgorithmEditor-paramTitle';
    inputsHeader.appendChild(inputsTitle);

    const addInputBtn = document.createElement('button');
    addInputBtn.className =
      'jp-mod-styled jp-mod-accept jp-AlgorithmEditor-addParamBtn';
    addInputBtn.textContent = '+ Add Input';
    addInputBtn.onclick = () => this.addInput();
    inputsHeader.appendChild(addInputBtn);
    inputsGroup.appendChild(inputsHeader);

    const inputsColumn = document.createElement('div');
    inputsColumn.className = 'jp-AlgorithmEditor-ioColumn';
    this.inputsContainer = document.createElement('div');
    inputsColumn.appendChild(this.inputsContainer);
    inputsGroup.appendChild(inputsColumn);
    this.renderInputs();
    ioRow.appendChild(inputsGroup);

    // Outputs (group = header + panel)
    const outputsGroup = document.createElement('div');
    outputsGroup.className = 'jp-AlgorithmEditor-ioGroup';

    const outputsHeader = document.createElement('div');
    outputsHeader.className = 'jp-AlgorithmEditor-paramHeader';

    const outputsTitle = document.createElement('h3');
    outputsTitle.textContent = 'Outputs';
    outputsTitle.className = 'jp-AlgorithmEditor-paramTitle';
    outputsHeader.appendChild(outputsTitle);

    const addOutputBtn = document.createElement('button');
    addOutputBtn.className =
      'jp-mod-styled jp-mod-accept jp-AlgorithmEditor-addParamBtn';
    addOutputBtn.textContent = '+ Add Output';
    addOutputBtn.onclick = () => this.addOutput();
    outputsHeader.appendChild(addOutputBtn);
    outputsGroup.appendChild(outputsHeader);

    const outputsColumn = document.createElement('div');
    outputsColumn.className = 'jp-AlgorithmEditor-ioColumn';

    this.outputsContainer = document.createElement('div');
    outputsColumn.appendChild(this.outputsContainer);
    outputsGroup.appendChild(outputsColumn);
    this.renderOutputs();
    ioRow.appendChild(outputsGroup);

    leftPanel.appendChild(ioRow);

    // --- Parameters Section ---
    const paramHeader = document.createElement('div');
    paramHeader.className = 'jp-AlgorithmEditor-paramHeader';

    const paramTitle = document.createElement('h3');
    paramTitle.textContent = 'Parameters';
    paramTitle.className = 'jp-AlgorithmEditor-paramTitle';
    paramHeader.appendChild(paramTitle);

    const addParamBtn = document.createElement('button');
    addParamBtn.className =
      'jp-mod-styled jp-mod-accept jp-AlgorithmEditor-addParamBtn';
    addParamBtn.textContent = '+ Add Parameter';
    addParamBtn.onclick = () => this.addParam();
    paramHeader.appendChild(addParamBtn);
    leftPanel.appendChild(paramHeader);

    this.argsContainer = document.createElement('div');
    this.argsContainer.className = 'jp-AlgorithmEditor-argsContainer';
    leftPanel.appendChild(this.argsContainer);
    this.renderParams();

    // --- Description Section (Right Panel) ---
    const descHeader = document.createElement('h3');
    descHeader.textContent = '算法简介';
    descHeader.className = 'jp-AlgorithmEditor-sectionHeader';
    rightPanel.appendChild(descHeader);

    this.descriptionInput = document.createElement('textarea');
    this.descriptionInput.className =
      'jp-mod-styled jp-AlgorithmEditor-descriptionInput';
    this.descriptionInput.style.height = '60px'; // Increased height for better visibility
    this.descriptionInput.style.width = '100%';
    this.descriptionInput.style.boxSizing = 'border-box';
    this.descriptionInput.value = algo?.description || '';
    this.descriptionInput.placeholder = 'Enter a brief description...';
    this.descriptionInput.addEventListener('input', () => this.syncCode());
    rightPanel.appendChild(this.descriptionInput);

    // --- Prompt Section (Right Panel) ---
    const promptHeader = document.createElement('h3');
    promptHeader.textContent = '提示词模板（Prompt Template）';
    promptHeader.className = 'jp-AlgorithmEditor-sectionHeader';
    rightPanel.appendChild(promptHeader);

    this.promptInput = document.createElement('textarea');
    this.promptInput.className =
      'jp-mod-styled jp-AlgorithmEditor-descriptionInput';
    this.promptInput.style.width = '100%';
    this.promptInput.style.boxSizing = 'border-box';
    this.promptInput.value =
      algo?.prompt || 'Perform {ALGO_NAME} on {VAR_NAME}';
    this.promptInput.placeholder =
      'e.g. Perform operation on {VAR_NAME} with param {param}';
    this.promptInput.addEventListener('input', () => this.syncCode());
    rightPanel.appendChild(this.promptInput);

    // --- Right Panel: Code Section ---
    const codeHeader = document.createElement('h3');
    codeHeader.textContent = '算法代码';
    codeHeader.className = 'jp-AlgorithmEditor-codeHeader';
    rightPanel.appendChild(codeHeader);

    this.codeInput = document.createElement('textarea');
    this.codeInput.className = 'jp-mod-styled jp-AlgorithmEditor-codeInput';
    this.codeInput.spellcheck = false;

    // Initial Code
    if (algo?.code) {
      this.codeInput.value = algo.code;
    } else {
      this.syncCode(true); // Generate initial code
    }

    rightPanel.appendChild(this.codeInput);
  }

  private renderParams() {
    this.argsContainer.innerHTML = '';

    if (this.args.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No parameters defined.';
      empty.className = 'jp-AlgorithmEditor-emptyParams';
      this.argsContainer.appendChild(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'jp-AlgorithmEditor-table';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.className = 'jp-AlgorithmEditor-table-headerRow';

    ['Name', 'Label', 'Type', 'Widget', 'Description', 'Action'].forEach(
      text => {
        const th = document.createElement('th');
        th.textContent = text;
        th.className = 'jp-AlgorithmEditor-table-th';
        headerRow.appendChild(th);
      }
    );
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    this.args.forEach((arg, index) => {
      const tr = document.createElement('tr');
      tr.className = 'jp-AlgorithmEditor-table-tr';

      const createCellInput = (
        initialValue: string,
        onChange: (val: string) => void
      ) => {
        const input = document.createElement('input');
        input.value = initialValue;
        input.className = 'jp-AlgorithmEditor-table-input';
        input.oninput = e => onChange((e.target as HTMLInputElement).value);
        return input;
      };

      // Name
      const tdName = document.createElement('td');
      tdName.className = 'jp-AlgorithmEditor-table-td';
      tdName.appendChild(
        createCellInput(arg.name || '', val => {
          this.args[index].name = val;
          this.syncCode();
        })
      );
      tr.appendChild(tdName);

      // Label
      const tdLabel = document.createElement('td');
      tdLabel.className = 'jp-AlgorithmEditor-table-td';
      tdLabel.appendChild(
        createCellInput(arg.label || '', val => {
          this.args[index].label = val;
          this.syncCode();
        })
      );
      tr.appendChild(tdLabel);

      // Type
      const tdType = document.createElement('td');
      tdType.className =
        'jp-AlgorithmEditor-table-td jp-AlgorithmEditor-table-td-type';

      const typeSelect = document.createElement('select');
      typeSelect.className = 'jp-AlgorithmEditor-table-select';

      [
        'str',
        'int',
        'float',
        'bool',
        'pd.DataFrame',
        'List',
        'Dict',
        'tuple'
      ].forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.text = t;
        if (arg.type === t) {
          opt.selected = true;
        }
        typeSelect.appendChild(opt);
      });
      typeSelect.onchange = () => {
        const newType = typeSelect.value;
        this.args[index].type = newType;

        // Set default widget based on type constraints
        switch (newType) {
          case 'str':
            this.args[index].widget = 'input';
            break;
          case 'int':
          case 'float':
            this.args[index].widget = 'number';
            break;
          case 'bool':
            this.args[index].widget = 'checkbox';
            break;
          case 'List':
            this.args[index].widget = 'column-selector';
            break;
          case 'tuple':
            this.args[index].widget = 'input';
            break;
          default:
            this.args[index].widget = 'input';
            break;
        }

        this.renderParams();
        this.syncCode();
      };
      tdType.appendChild(typeSelect);
      tr.appendChild(tdType);

      // Widget
      const tdWidget = document.createElement('td');
      tdWidget.className =
        'jp-AlgorithmEditor-table-td jp-AlgorithmEditor-table-td-widget';

      const widgetSelect = document.createElement('select');
      widgetSelect.className = 'jp-AlgorithmEditor-table-select';

      let allowedWidgets: string[] = ['input'];
      switch (arg.type) {
        case 'str':
          allowedWidgets = [
            'input',
            'select',
            'file-selector',
            'column-selector'
          ];
          break;
        case 'int':
        case 'float':
          allowedWidgets = ['number', 'select'];
          break;
        case 'bool':
          allowedWidgets = ['checkbox', 'select'];
          break;
        case 'List':
          allowedWidgets = ['column-selector', 'input'];
          break;
        case 'tuple':
          allowedWidgets = ['input'];
          break;
        default:
          allowedWidgets = ['input'];
          break;
      }

      allowedWidgets.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w;
        opt.text = w;
        if (arg.widget === w) {
          opt.selected = true;
        }
        widgetSelect.appendChild(opt);
      });
      widgetSelect.onchange = () => {
        this.args[index].widget = widgetSelect.value;
        this.renderParams();
        this.syncCode();
      };
      tdWidget.appendChild(widgetSelect);
      tr.appendChild(tdWidget);

      // Description
      const tdDesc = document.createElement('td');
      tdDesc.className = 'jp-AlgorithmEditor-table-td';
      tdDesc.appendChild(
        createCellInput(arg.description || '', val => {
          this.args[index].description = val;
          this.syncCode();
        })
      );
      tr.appendChild(tdDesc);

      // Action
      const tdAction = document.createElement('td');
      tdAction.className =
        'jp-AlgorithmEditor-table-td jp-AlgorithmEditor-table-td-action';

      const actionDiv = document.createElement('div');
      actionDiv.className = 'jp-AlgorithmEditor-actionDiv';

      // Settings Btn
      const setBtn = document.createElement('div');
      setBtn.innerHTML = this.expandedParamIndex === index ? '▲' : '⚙️';
      setBtn.title =
        this.expandedParamIndex === index
          ? 'Close Settings'
          : 'Advanced Settings';
      setBtn.className = 'jp-AlgorithmEditor-actionBtn';
      setBtn.onclick = () => this.toggleParamSettings(index);

      // Delete Btn
      const delBtn = document.createElement('div');
      delBtn.innerHTML = '🗑️';
      delBtn.title = 'Delete';
      delBtn.className = 'jp-AlgorithmEditor-actionBtn';
      delBtn.onclick = () => {
        this.args.splice(index, 1);
        this.renderParams();
        this.syncCode();
      };

      actionDiv.appendChild(setBtn);
      actionDiv.appendChild(delBtn);
      tdAction.appendChild(actionDiv);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);

      // Render Expanded Settings Row
      if (this.expandedParamIndex === index) {
        const trExp = document.createElement('tr');
        trExp.className = 'jp-AlgorithmEditor-table-tr-expanded';

        const tdExp = document.createElement('td');
        tdExp.colSpan = 6;
        tdExp.style.padding = '8px';
        tdExp.style.backgroundColor = 'var(--jp-layout-color2)';
        tdExp.style.borderTop = 'none';

        const settingsBody = new ParameterSettingsBody(arg);

        // Wrap body in a container with "Save" action
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '8px';

        wrapper.appendChild(settingsBody.node);

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'flex-end';
        btnRow.style.gap = '8px';
        btnRow.style.marginTop = '8px';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'jp-mod-styled';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => {
          this.toggleParamSettings(index);
        };

        const saveBtn = document.createElement('button');
        saveBtn.className = 'jp-mod-styled jp-mod-accept';
        saveBtn.textContent = 'Confirm Changes';
        saveBtn.onclick = () => {
          const value = settingsBody.getValue();
          Object.assign(this.args[index], value);
          this.syncCode();
          // Optional: Close after save
          // this.toggleParamSettings(index);
          // Or just feedback? For now, we keep it open or close it?
          // Usually "Confirm" implies done.
          this.toggleParamSettings(index);
        };

        btnRow.appendChild(closeBtn);
        btnRow.appendChild(saveBtn);
        wrapper.appendChild(btnRow);

        tdExp.appendChild(wrapper);
        trExp.appendChild(tdExp);
        tbody.appendChild(trExp);
      }
    });
    table.appendChild(tbody);
    this.argsContainer.appendChild(table);
  }

  /**
   * Toggle the parameter settings visibility (inline expansion).
   * @param index - The index of the parameter to edit
   */
  private toggleParamSettings(index: number): void {
    if (this.expandedParamIndex === index) {
      this.expandedParamIndex = null;
    } else {
      this.expandedParamIndex = index;
    }
    this.renderParams();
  }

  private addParam() {
    this.args.push({
      name: 'new_param',
      type: 'str',
      description: 'Description',
      label: '新参数',
      widget: 'input'
    });
    this.renderParams();
    this.syncCode();
  }

  private addInput() {
    let name = 'df';
    let i = 1;
    // Check if 'df' exists
    const existingNames = this.inputs.map(p => p.name);
    if (existingNames.includes(name)) {
      // Try df1, df2...
      while (existingNames.includes(`df${i}`)) {
        i++;
      }
      name = `df${i}`;
    }

    this.inputs.push({
      name: name,
      type: 'pd.DataFrame',
      description: ''
    });
    this.renderInputs();
    this.syncCode();
  }

  private addOutput() {
    let name = 'df_out';
    let i = 1;
    const existingNames = this.outputs.map(p => p.name);
    if (existingNames.includes(name)) {
      while (existingNames.includes(`df_out_${i}`)) {
        i++;
      }
      name = `df_out_${i}`;
    }

    this.outputs.push({
      name: name,
      type: 'pd.DataFrame',
      description: ''
    });
    this.renderOutputs();
    this.syncCode();
  }

  private renderInputs() {
    this.renderPortTable(this.inputsContainer, this.inputs, 'input');
  }

  private renderOutputs() {
    this.renderPortTable(this.outputsContainer, this.outputs, 'output');
  }

  private renderPortTable(
    container: HTMLElement,
    ports: IPort[],
    portType: 'input' | 'output'
  ) {
    container.innerHTML = '';

    if (ports.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = `No ${portType}s defined.`;
      empty.className = 'jp-AlgorithmEditor-portTable-empty';
      container.appendChild(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'jp-AlgorithmEditor-portTable';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.className = 'jp-AlgorithmEditor-portTable-headerRow';

    ['Name', 'Description', ''].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      th.className = 'jp-AlgorithmEditor-portTable-th';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    ports.forEach((port, index) => {
      const tr = document.createElement('tr');
      tr.className = 'jp-AlgorithmEditor-portTable-tr';

      // Name
      const tdName = document.createElement('td');
      tdName.className = 'jp-AlgorithmEditor-portTable-td';
      const nameInput = document.createElement('input');
      nameInput.value = port.name || '';
      nameInput.className = 'jp-AlgorithmEditor-portTable-input';
      nameInput.placeholder = 'Variable Name';
      nameInput.oninput = e => {
        ports[index].name = (e.target as HTMLInputElement).value;
        this.syncCode();
      };
      tdName.appendChild(nameInput);
      tr.appendChild(tdName);

      // Description (Replacing Type)
      const tdDesc = document.createElement('td');
      tdDesc.className = 'jp-AlgorithmEditor-portTable-td';
      const descInput = document.createElement('input');
      descInput.value = port.description || '';
      descInput.className = 'jp-AlgorithmEditor-portTable-input';
      descInput.placeholder = 'Description';
      descInput.oninput = e => {
        ports[index].description = (e.target as HTMLInputElement).value;
        this.syncCode();
      };
      tdDesc.appendChild(descInput);
      tr.appendChild(tdDesc);

      // Action (Delete)
      const tdAction = document.createElement('td');
      tdAction.className = 'jp-AlgorithmEditor-portTable-actionTd';

      const delBtn = document.createElement('div');
      delBtn.innerHTML = '&#x2715;';
      delBtn.title = `Remove ${portType}`;
      delBtn.className = 'jp-AlgorithmEditor-portTable-deleteBtn';
      delBtn.onclick = () => {
        ports.splice(index, 1);
        this.renderPortTable(container, ports, portType);
        this.syncCode();
      };

      tdAction.appendChild(delBtn);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  private syncCode(force = false) {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      this.doSyncCode(force);
    }, 500);
  }

  private async doSyncCode(force: boolean) {
    const id = this.idInput.value.trim() || 'new_algorithm';
    const name = this.nameInput.value.trim() || id;
    const desc = this.descriptionInput.value || 'Algorithm Description';
    const category = this.categorySelect.value;
    const prompt =
      this.promptInput.value || 'Perform {ALGO_NAME} on {VAR_NAME}';

    const metadata = {
      id,
      name,
      category,
      description: desc,
      prompt,
      args: this.args,
      inputs: this.inputs,
      outputs: this.outputs
    };

    try {
      const currentCode = this.codeInput.value;
      const newCode = await this.libraryService.generateCode(
        metadata,
        force ? undefined : currentCode
      );
      this.codeInput.value = newCode;
    } catch (e) {
      console.error('Failed to sync code:', e);
    }
  }

  getValue(): IAlgorithmData {
    return {
      id: this.idInput.value.trim(),
      name: this.nameInput.value.trim(),
      category: this.categorySelect.value,
      code: this.codeInput.value,
      description: this.descriptionInput.value,
      prompt: this.promptInput.value,
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
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Save' })]
    });
    dialog.addClass('jp-AlgorithmEditor-dialog-wrapper');

    // Style adjustments to match InfoDialog constraints
    const content = dialog.node.querySelector(
      '.jp-Dialog-content'
    ) as HTMLElement;
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
