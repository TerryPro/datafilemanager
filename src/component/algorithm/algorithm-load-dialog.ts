import { Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { NotebookPanel } from '@jupyterlab/notebook';
import { KernelMessage } from '@jupyterlab/services';

interface IParameter {
  name: string;
  type: string;
  description?: string;
  label?: string;
  default?: any;
  widget?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  role?: 'input' | 'output' | 'parameter';
}

interface IPort {
  name: string;
  type: string;
  description?: string;
}

interface IAlgorithmInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
  imports?: string[];
  args?: IParameter[];
  inputs?: IPort[];
  outputs?: IPort[];
}

interface ILoadConfig {
  algorithmId: string;
  parameters: { [key: string]: any };
  inputs: { [key: string]: string };
  outputs: { [key: string]: string };
}

class AlgorithmLoadBody
  extends Widget
  implements Dialog.IBodyWidget<ILoadConfig>
{
  private algo: IAlgorithmInfo;
  private panel: NotebookPanel | null;
  private parameters: { [key: string]: any } = {};
  private inputVars: { [key: string]: string } = {};
  private outputVars: { [key: string]: string } = {};
  private codePreview!: HTMLPreElement; // 使用 ! 断言，会在 render() 中初始化
  private container: HTMLDivElement;
  private availableDataFrames: string[] = [];
  private dataFrameColumns: { [dfName: string]: string[] } = {}; // 存储每个 DataFrame 的列名

  constructor(algo: IAlgorithmInfo, panel: NotebookPanel | null) {
    super();
    this.algo = algo;
    this.panel = panel;
    this.addClass('jp-AlgorithmLoad-body');

    this.container = document.createElement('div');
    this.container.className = 'jp-AlgorithmLoad-container';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.height = '70vh';
    this.container.style.width = '800px';
    this.container.style.minWidth = '600px';
    this.node.appendChild(this.container);

    // 异步加载可用的 DataFrames
    this.loadAvailableDataFrames().then(() => {
      this.render();
    });
  }

  private async loadAvailableDataFrames(): Promise<void> {
    if (!this.panel || !this.panel.sessionContext.session?.kernel) {
      return;
    }

    try {
      const kernel = this.panel.sessionContext.session.kernel;
      const code = `
import pandas as pd
import json

# 获取所有 DataFrame 变量及其列名
result = {}
for name, obj in list(globals().items()):
    if isinstance(obj, pd.DataFrame) and not name.startswith('_'):
        result[name] = list(obj.columns)

print(json.dumps(result))
`;

      const future = kernel.requestExecute({ code });

      return new Promise(resolve => {
        let resolved = false;

        future.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
          if (msg.header.msg_type === 'stream') {
            const content = msg.content as KernelMessage.IStreamMsg['content'];
            if (content.name === 'stdout') {
              try {
                const result = JSON.parse(content.text.trim());
                this.availableDataFrames = Object.keys(result);
                this.dataFrameColumns = result;
              } catch (e) {
                console.error('Failed to parse dataframes:', e);
              }
            }
          } else if (msg.header.msg_type === 'status') {
            const content = msg.content as KernelMessage.IStatusMsg['content'];
            if (content.execution_state === 'idle' && !resolved) {
              resolved = true;
              resolve();
            }
          }
        };

        // 设置超时保护
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }, 5000);
      });
    } catch (e) {
      console.error('Failed to load dataframes:', e);
    }
  }

  private render(): void {
    // 创建滚动区域 - 使用flex布局
    const scrollArea = document.createElement('div');
    scrollArea.style.flex = '1';
    scrollArea.style.display = 'flex';
    scrollArea.style.flexDirection = 'column';
    scrollArea.style.overflowY = 'auto';
    scrollArea.style.padding = '16px';
    scrollArea.style.paddingBottom = '8px';

    // 1. 算法基本信息
    const infoSection = this.createInfoSection();
    scrollArea.appendChild(infoSection);

    // 2. 输入参数配置
    const inputSection = this.createInputSection();
    scrollArea.appendChild(inputSection);

    // 3. 参数配置
    const paramSection = this.createParameterSection();
    scrollArea.appendChild(paramSection);

    // 4. 输出配置
    const outputSection = this.createOutputSection();
    scrollArea.appendChild(outputSection);

    // 5. 代码预览
    const previewSection = this.createCodePreview();
    scrollArea.appendChild(previewSection);

    this.container.appendChild(scrollArea);
  }

  private createInfoSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'jp-AlgorithmLoad-section';
    section.style.marginBottom = '20px';
    section.style.padding = '12px';
    section.style.background = 'var(--jp-layout-color2)';
    section.style.borderRadius = '4px';
    section.style.border = '1px solid var(--jp-border-color2)';

    const title = document.createElement('h3');
    title.textContent = this.algo.name;
    title.style.margin = '0 0 8px 0';
    title.style.fontSize = '16px';
    title.style.fontWeight = '600';
    title.style.color = 'var(--jp-ui-font-color0)';
    section.appendChild(title);

    const category = document.createElement('div');
    category.textContent = `分类: ${this.algo.category}`;
    category.style.fontSize = '11px';
    category.style.color = 'var(--jp-ui-font-color2)';
    category.style.marginBottom = '8px';
    section.appendChild(category);

    const desc = document.createElement('div');
    desc.textContent = this.algo.description;
    desc.style.fontSize = '12px';
    desc.style.lineHeight = '1.5';
    desc.style.color = 'var(--jp-ui-font-color1)';
    section.appendChild(desc);

    return section;
  }

  private createInputSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'jp-AlgorithmLoad-section';
    section.style.marginBottom = '20px';

    const header = document.createElement('h4');
    header.textContent = '输入参数配置';
    header.style.margin = '0 0 12px 0';
    header.style.fontSize = '13px';
    header.style.fontWeight = '600';
    header.style.color = 'var(--jp-ui-font-color1)';
    section.appendChild(header);

    const inputs = this.algo.inputs || [
      { name: 'df', type: 'pd.DataFrame', description: '输入数据' }
    ];

    if (inputs.length > 0) {
      inputs.forEach(input => {
        const row = this.createInputRow(input);
        section.appendChild(row);
        // 不在这里初始化，让 createInputRow 自己处理
      });
    } else {
      const empty = document.createElement('div');
      empty.textContent = '此算法无需输入参数';
      empty.style.color = 'var(--jp-ui-font-color2)';
      empty.style.fontSize = '12px';
      section.appendChild(empty);
    }

    return section;
  }

  private createInputRow(input: IPort): HTMLElement {
    const row = document.createElement('div');
    row.style.marginBottom = '12px';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';

    const label = document.createElement('label');
    label.textContent = `${input.description || input.name} (${input.type}):`;
    label.style.fontSize = '12px';
    label.style.fontWeight = '500';
    label.style.minWidth = '150px';
    label.style.color = 'var(--jp-ui-font-color1)';
    row.appendChild(label);

    // 如果是 DataFrame 类型且有可用的 DataFrame 列表，使用下拉选择
    if (
      input.type.includes('DataFrame') &&
      this.availableDataFrames.length > 0
    ) {
      const selectWrapper = document.createElement('div');
      selectWrapper.style.flex = '1';
      selectWrapper.style.display = 'flex';
      selectWrapper.style.gap = '8px';

      const select = document.createElement('select');
      select.className = 'jp-mod-styled';
      select.style.flex = '1';

      // 添加空选项
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = '-- 选择 DataFrame --';
      select.appendChild(emptyOption);

      // 添加可用的 DataFrame
      this.availableDataFrames.forEach(dfName => {
        const option = document.createElement('option');
        option.value = dfName;
        option.textContent = dfName;
        if (dfName === input.name) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      // 选择默认值并初始化 inputVars
      if (this.availableDataFrames.includes(input.name)) {
        select.value = input.name;
        this.inputVars[input.name] = input.name;
      } else if (this.availableDataFrames.length > 0) {
        select.value = this.availableDataFrames[0];
        this.inputVars[input.name] = this.availableDataFrames[0];
      } else {
        // 如果没有可用的 DataFrame，使用空值
        select.value = '';
        this.inputVars[input.name] = input.name;
      }

      select.onchange = () => {
        this.inputVars[input.name] = select.value;
        this.updateCodePreview();
      };

      selectWrapper.appendChild(select);

      // 添加手动输入按钮
      const manualBtn = document.createElement('button');
      manualBtn.className = 'jp-mod-styled';
      manualBtn.textContent = '手动输入';
      manualBtn.style.flexShrink = '0';
      manualBtn.style.fontSize = '11px';
      manualBtn.style.padding = '4px 8px';
      manualBtn.onclick = () => {
        // 替换为输入框
        const inputEl = document.createElement('input');
        inputEl.className = 'jp-mod-styled';
        inputEl.style.flex = '1';
        inputEl.value = this.inputVars[input.name] || input.name;
        inputEl.placeholder = '输入变量名';
        inputEl.oninput = () => {
          this.inputVars[input.name] = inputEl.value;
          this.updateCodePreview();
        };

        // 添加返回选择框按钮
        const backBtn = document.createElement('button');
        backBtn.className = 'jp-mod-styled';
        backBtn.textContent = '选择列表';
        backBtn.style.flexShrink = '0';
        backBtn.style.fontSize = '11px';
        backBtn.style.padding = '4px 8px';
        backBtn.onclick = () => {
          selectWrapper.innerHTML = '';
          selectWrapper.appendChild(select);
          selectWrapper.appendChild(manualBtn);
        };

        selectWrapper.innerHTML = '';
        selectWrapper.appendChild(inputEl);
        selectWrapper.appendChild(backBtn);
      };

      selectWrapper.appendChild(manualBtn);
      row.appendChild(selectWrapper);
    } else {
      // 默认使用输入框
      const inputEl = document.createElement('input');
      inputEl.className = 'jp-mod-styled';
      inputEl.style.flex = '1';
      inputEl.value = input.name;
      inputEl.placeholder = '输入变量名';

      // 初始化 inputVars
      this.inputVars[input.name] = input.name;

      inputEl.oninput = () => {
        this.inputVars[input.name] = inputEl.value;
        this.updateCodePreview();
      };
      row.appendChild(inputEl);
    }

    return row;
  }

  private createParameterSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'jp-AlgorithmLoad-section';
    section.style.marginBottom = '20px';

    const header = document.createElement('h4');
    header.textContent = '算法参数配置';
    header.style.margin = '0 0 12px 0';
    header.style.fontSize = '13px';
    header.style.fontWeight = '600';
    header.style.color = 'var(--jp-ui-font-color1)';
    section.appendChild(header);

    const params = (this.algo.args || []).filter(
      arg => arg.role !== 'input' && arg.role !== 'output'
    );

    if (params.length > 0) {
      const paramContainer = document.createElement('div');
      paramContainer.style.padding = '12px';
      paramContainer.style.background = 'var(--jp-layout-color2)';
      paramContainer.style.borderRadius = '4px';
      paramContainer.style.border = '1px solid var(--jp-border-color2)';

      params.forEach(param => {
        const row = this.createParameterRow(param);
        paramContainer.appendChild(row);
        // 注意：参数初始化在 createParameterInput 的各个子方法中完成
        // 只有当参数没有被初始化时，才使用默认值
        if (this.parameters[param.name] === undefined) {
          this.parameters[param.name] =
            param.default !== undefined ? param.default : '';
        }
      });

      section.appendChild(paramContainer);
    } else {
      const empty = document.createElement('div');
      empty.textContent = '此算法无需额外参数';
      empty.style.color = 'var(--jp-ui-font-color2)';
      empty.style.fontSize = '12px';
      section.appendChild(empty);
    }

    return section;
  }

  private createParameterRow(param: IParameter): HTMLElement {
    const row = document.createElement('div');
    row.style.marginBottom = '12px';

    const labelRow = document.createElement('div');
    labelRow.style.display = 'flex';
    labelRow.style.justifyContent = 'space-between';
    labelRow.style.marginBottom = '4px';

    const label = document.createElement('label');
    label.textContent = param.label || param.name;
    label.style.fontWeight = '500';
    label.style.fontSize = '12px';
    label.style.color = 'var(--jp-ui-font-color1)';
    labelRow.appendChild(label);

    if (param.description) {
      const desc = document.createElement('span');
      desc.textContent = param.description;
      desc.style.fontSize = '10px';
      desc.style.color = 'var(--jp-ui-font-color2)';
      labelRow.appendChild(desc);
    }

    row.appendChild(labelRow);

    const input = this.createParameterInput(param);
    row.appendChild(input);

    return row;
  }

  private createParameterInput(param: IParameter): HTMLElement {
    // 根据参数类型和widget创建不同的输入控件

    // 列选择器：根据类型判断单选或多选
    if (param.widget === 'column-selector') {
      if (param.type === 'list') {
        return this.createMultiColumnSelector(param);
      } else {
        return this.createColumnSelector(param);
      }
    }

    // 下拉选择（widget 为 select 或有预定义选项）
    if (
      param.widget === 'select' ||
      (param.options && param.options.length > 0)
    ) {
      return this.createSelectInput(param);
    }

    // 复选框
    if (param.type === 'bool' || param.widget === 'checkbox') {
      return this.createCheckboxInput(param);
    }

    // 数字输入
    if (param.type === 'int' || param.type === 'float') {
      return this.createNumberInput(param);
    }

    // 列表输入
    if (param.type === 'list' || Array.isArray(param.default)) {
      return this.createListInput(param);
    }

    // 默认：文本输入
    return this.createTextInput(param);
  }

  /**
   * 获取当前选中的 DataFrame 的列名列表
   */
  private getAvailableColumns(): string[] {
    // 获取第一个输入的 DataFrame 名称
    const inputs = this.algo.inputs || [];
    if (inputs.length > 0) {
      const firstInput = inputs[0];
      const dfName = this.inputVars[firstInput.name];
      if (dfName && this.dataFrameColumns[dfName]) {
        return this.dataFrameColumns[dfName];
      }
    }

    // 如果没有找到，返回所有可用 DataFrame 的列名并集
    const allColumns = new Set<string>();
    Object.values(this.dataFrameColumns).forEach(cols => {
      cols.forEach(col => allColumns.add(col));
    });
    return Array.from(allColumns);
  }

  /**
   * 创建列选择器（单选）
   */
  private createColumnSelector(param: IParameter): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '8px';

    const select = document.createElement('select');
    select.className = 'jp-mod-styled';
    select.style.flex = '1';

    // 添加空选项
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-- 选择列 --';
    select.appendChild(emptyOption);

    // 获取可用列名
    const columns = this.getAvailableColumns();
    columns.forEach(col => {
      const option = document.createElement('option');
      option.value = col;
      option.textContent = col;
      if (col === param.default) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    // 设置默认值
    if (param.default && columns.includes(param.default as string)) {
      select.value = param.default as string;
      this.parameters[param.name] = param.default;
    } else if (columns.length > 0) {
      select.value = columns[0];
      this.parameters[param.name] = columns[0];
    }

    select.onchange = () => {
      this.parameters[param.name] = select.value;
      this.updateCodePreview();
    };

    wrapper.appendChild(select);

    // 添加手动输入按钮
    const manualBtn = document.createElement('button');
    manualBtn.className = 'jp-mod-styled';
    manualBtn.textContent = '手动';
    manualBtn.style.fontSize = '11px';
    manualBtn.style.padding = '4px 8px';
    manualBtn.style.flexShrink = '0';
    manualBtn.onclick = () => {
      const input = document.createElement('input');
      input.className = 'jp-mod-styled';
      input.style.flex = '1';
      input.value = this.parameters[param.name] || '';
      input.placeholder = '输入列名';
      input.oninput = () => {
        this.parameters[param.name] = input.value;
        this.updateCodePreview();
      };

      const backBtn = document.createElement('button');
      backBtn.className = 'jp-mod-styled';
      backBtn.textContent = '选择';
      backBtn.style.fontSize = '11px';
      backBtn.style.padding = '4px 8px';
      backBtn.style.flexShrink = '0';
      backBtn.onclick = () => {
        wrapper.innerHTML = '';
        wrapper.appendChild(select);
        wrapper.appendChild(manualBtn);
      };

      wrapper.innerHTML = '';
      wrapper.appendChild(input);
      wrapper.appendChild(backBtn);
    };

    wrapper.appendChild(manualBtn);
    return wrapper;
  }

  /**
   * 创建多列选择器 - 使用复选框列表
   */
  private createMultiColumnSelector(param: IParameter): HTMLElement {
    const container = document.createElement('div');
    container.className = 'jp-AlgorithmLoad-multiSelector';

    // 获取可用列名
    const columns = this.getAvailableColumns();

    // 初始化已选列表
    let selectedColumns: string[] = [];
    if (Array.isArray(param.default)) {
      selectedColumns = [...param.default];
    }
    this.parameters[param.name] = selectedColumns;

    if (columns.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = '无可用列（请先选择 DataFrame）';
      emptyMsg.className = 'jp-AlgorithmLoad-emptyMessage';
      container.appendChild(emptyMsg);
      return container;
    }

    // 创建复选框列表
    const checkboxList = document.createElement('div');
    checkboxList.className = 'jp-AlgorithmLoad-checkboxList';

    columns.forEach(col => {
      const label = document.createElement('label');
      label.className = 'jp-AlgorithmLoad-checkboxItem';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = col;
      checkbox.checked = selectedColumns.includes(col);
      checkbox.onchange = () => {
        if (checkbox.checked) {
          if (!selectedColumns.includes(col)) {
            selectedColumns.push(col);
          }
        } else {
          const index = selectedColumns.indexOf(col);
          if (index > -1) {
            selectedColumns.splice(index, 1);
          }
        }
        this.parameters[param.name] = [...selectedColumns];
        this.updateCodePreview();
      };

      const text = document.createElement('span');
      text.textContent = col;

      label.appendChild(checkbox);
      label.appendChild(text);
      checkboxList.appendChild(label);
    });

    container.appendChild(checkboxList);
    return container;
  }

  private createSelectInput(param: IParameter): HTMLElement {
    const select = document.createElement('select');
    select.className = 'jp-mod-styled';
    select.style.width = '100%';

    const options = param.options || [];

    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (opt === param.default) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    // 初始化参数值
    if (
      param.default !== undefined &&
      options.includes(param.default as string)
    ) {
      this.parameters[param.name] = param.default;
    } else if (options.length > 0) {
      this.parameters[param.name] = options[0];
      select.value = options[0];
    }

    select.onchange = () => {
      this.parameters[param.name] = select.value;
      this.updateCodePreview();
    };

    return select;
  }

  private createCheckboxInput(param: IParameter): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.minHeight = '24px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.style.margin = '0 8px 0 0';

    const isChecked = param.default === true || param.default === 'True';
    checkbox.checked = isChecked;
    this.parameters[param.name] = isChecked;

    const label = document.createElement('span');
    label.textContent = isChecked ? 'True' : 'False';
    label.style.fontSize = '12px';

    checkbox.onchange = () => {
      this.parameters[param.name] = checkbox.checked;
      label.textContent = checkbox.checked ? 'True' : 'False';
      this.updateCodePreview();
    };

    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    return wrapper;
  }

  private createNumberInput(param: IParameter): HTMLElement {
    const input = document.createElement('input');
    input.className = 'jp-mod-styled';
    input.style.width = '100%';
    input.type = 'number';
    input.value = param.default !== undefined ? String(param.default) : '';

    if (param.min !== undefined) {
      input.min = String(param.min);
    }
    if (param.max !== undefined) {
      input.max = String(param.max);
    }
    if (param.step !== undefined) {
      input.step = String(param.step);
    }

    // 初始化参数值
    if (param.default !== undefined) {
      this.parameters[param.name] =
        param.type === 'int'
          ? parseInt(String(param.default))
          : parseFloat(String(param.default));
    }

    input.oninput = () => {
      const val = input.value;
      this.parameters[param.name] =
        param.type === 'int' ? parseInt(val) : parseFloat(val);
      this.updateCodePreview();
    };

    return input;
  }

  private createListInput(param: IParameter): HTMLElement {
    const input = document.createElement('input');
    input.className = 'jp-mod-styled';
    input.style.width = '100%';
    input.placeholder = '列名1, 列名2 (逗号分隔)';

    let displayVal = '';
    if (Array.isArray(param.default)) {
      displayVal = param.default.join(', ');
      // 初始化参数值
      this.parameters[param.name] = [...param.default];
    } else {
      this.parameters[param.name] = [];
    }
    input.value = displayVal;

    input.oninput = () => {
      const raw = input.value;
      const parts = raw
        .split(/[,，]/)
        .map(s => s.trim())
        .filter(s => s);
      this.parameters[param.name] = parts;
      this.updateCodePreview();
    };

    return input;
  }

  private createTextInput(param: IParameter): HTMLElement {
    const input = document.createElement('input');
    input.className = 'jp-mod-styled';
    input.style.width = '100%';
    input.value = param.default !== undefined ? String(param.default) : '';
    input.placeholder = param.description || '';

    // 初始化参数值
    if (param.default !== undefined) {
      this.parameters[param.name] = param.default;
    }

    input.oninput = () => {
      this.parameters[param.name] = input.value;
      this.updateCodePreview();
    };

    return input;
  }

  private createOutputSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'jp-AlgorithmLoad-section';
    section.style.marginBottom = '20px';

    const header = document.createElement('h4');
    header.textContent = '输出变量配置';
    header.style.margin = '0 0 12px 0';
    header.style.fontSize = '13px';
    header.style.fontWeight = '600';
    header.style.color = 'var(--jp-ui-font-color1)';
    section.appendChild(header);

    const outputs = this.algo.outputs || [
      { name: 'df_out', type: 'DataFrame', description: '输出数据' }
    ];

    if (outputs.length > 0) {
      outputs.forEach(output => {
        const row = this.createOutputRow(output);
        section.appendChild(row);
        // 初始化默认输出变量名
        this.outputVars[output.name] = output.name;
      });
    }

    return section;
  }

  private createOutputRow(output: IPort): HTMLElement {
    const row = document.createElement('div');
    row.style.marginBottom = '12px';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';

    const label = document.createElement('label');
    label.textContent = `${output.description || output.name} (${
      output.type
    }):`;
    label.style.fontSize = '12px';
    label.style.fontWeight = '500';
    label.style.minWidth = '150px';
    label.style.color = 'var(--jp-ui-font-color1)';
    row.appendChild(label);

    const inputEl = document.createElement('input');
    inputEl.className = 'jp-mod-styled';
    inputEl.style.flex = '1';
    inputEl.value = output.name;
    inputEl.placeholder = '输出变量名';
    inputEl.oninput = () => {
      this.outputVars[output.name] = inputEl.value;
      this.updateCodePreview();
    };
    row.appendChild(inputEl);

    return row;
  }

  private createCodePreview(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'jp-AlgorithmLoad-section';
    section.style.flex = '1'; // 占据剩余空间
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    section.style.marginBottom = '0'; // 最后一个section，不需要下边距
    section.style.marginTop = '20px'; // 上边距保持与其他section一致
    section.style.minHeight = '0'; // 允许flex项目缩小

    const header = document.createElement('h4');
    header.textContent = '代码预览';
    header.style.margin = '0 0 8px 0';
    header.style.fontSize = '12px';
    header.style.fontWeight = '600';
    header.style.color = 'var(--jp-ui-font-color2)';
    header.style.flexShrink = '0'; // header不缩小
    section.appendChild(header);

    this.codePreview = document.createElement('pre');
    this.codePreview.style.flex = '1'; // 充满剩余高度
    this.codePreview.style.background = 'var(--jp-layout-color0)';
    this.codePreview.style.padding = '12px';
    this.codePreview.style.borderRadius = '4px';
    this.codePreview.style.border = '1px solid var(--jp-border-color2)';
    this.codePreview.style.fontFamily = 'var(--jp-code-font-family)';
    this.codePreview.style.fontSize = '12px';
    this.codePreview.style.overflowY = 'auto'; // 内容过多时滚动
    this.codePreview.style.margin = '0';
    this.codePreview.style.whiteSpace = 'pre';
    this.codePreview.style.minHeight = '0'; // 允许缩小
    section.appendChild(this.codePreview);

    // 初始化代码预览
    this.updateCodePreview();

    return section;
  }

  private updateCodePreview(): void {
    const code = this.generateCode();
    if (this.codePreview) {
      this.codePreview.textContent = code;
    }
  }

  private generateCode(): string {
    let code = '';

    // 注意:this.algo.code可能已经包含了imports(从文件读取时)
    // 检查code是否已包含import语句
    const codeHasImports =
      this.algo.code &&
      (this.algo.code.includes('import ') || this.algo.code.includes('from '));

    // 1. 添加导入语句(仅当code中不包含imports时)
    if (!codeHasImports && this.algo.imports && this.algo.imports.length > 0) {
      code += this.algo.imports.join('\n') + '\n\n';
    }

    // 2. 添加算法代码
    if (this.algo.code) {
      code += this.algo.code + '\n\n';
    }

    // 3. 生成函数调用
    code += `# ${this.algo.name}\n`;

    const callArgs: string[] = [];

    // 处理输入参数
    (this.algo.inputs || []).forEach(input => {
      const varName = this.inputVars[input.name] || input.name;
      // 修复问题1：使用实际选择的变量名，而不是固定的 df
      callArgs.push(`${input.name}=${varName}`);
    });

    // 处理其他参数
    Object.keys(this.parameters).forEach(key => {
      let val = this.parameters[key];

      if (val === undefined || val === null || val === '') {
        return; // 跳过空值
      }

      if (typeof val === 'boolean') {
        val = val ? 'True' : 'False';
      } else if (Array.isArray(val)) {
        const formatted = val.map(v => `'${v}'`).join(', ');
        val = `[${formatted}]`;
      } else if (typeof val === 'string') {
        // 检查是否需要引号
        const noQuote =
          val === 'True' ||
          val === 'False' ||
          val === 'None' ||
          !isNaN(Number(val));
        if (!noQuote) {
          val = `'${val}'`;
        }
      }

      callArgs.push(`${key}=${val}`);
    });

    // 修复问题2：检查是否有输出变量
    const outputs = this.algo.outputs || [];
    const hasOutputs = outputs.length > 0;
    const hasOutputVars =
      hasOutputs &&
      outputs.some(o => {
        const varName = this.outputVars[o.name];
        return varName && varName.trim() !== '';
      });

    // 生成函数调用代码
    if (hasOutputVars) {
      // 有输出变量，生成赋值语句
      const outputNames = outputs
        .map(o => this.outputVars[o.name] || o.name)
        .filter(name => name && name.trim() !== '');

      if (outputNames.length > 0) {
        const outputStr =
          outputNames.length > 1 ? outputNames.join(', ') : outputNames[0];
        code += `${outputStr} = ${this.algo.id}(${callArgs.join(', ')})\n`;

        // 添加显示结果
        code += '\n# 显示结果\n';
        code += `if ${outputNames[0]} is not None:\n`;
        code += `    display(${outputNames[0]}.head())`;
      } else {
        // 输出变量为空，只调用函数
        code += `${this.algo.id}(${callArgs.join(', ')})`;
      }
    } else {
      // 没有输出或输出变量为空，只调用函数
      code += `${this.algo.id}(${callArgs.join(', ')})`;
    }

    return code;
  }

  getValue(): ILoadConfig {
    return {
      algorithmId: this.algo.id,
      parameters: this.parameters,
      inputs: this.inputVars,
      outputs: this.outputVars
    };
  }

  getCode(): string {
    return this.generateCode();
  }
}

export class AlgorithmLoadDialogManager {
  async showLoadDialog(
    algo: IAlgorithmInfo,
    panel: NotebookPanel | null = null
  ): Promise<string | null> {
    const body = new AlgorithmLoadBody(algo, panel);

    const dialog = new Dialog({
      title: `加载算法: ${algo.name}`,
      body: body,
      buttons: [
        Dialog.cancelButton({ label: '取消' }),
        Dialog.okButton({ label: '加载到Cell' })
      ]
    });

    dialog.addClass('jp-AlgorithmLoad-dialog');

    // 样式调整
    const content = dialog.node.querySelector(
      '.jp-Dialog-content'
    ) as HTMLElement;
    const bodyEl = dialog.node.querySelector('.jp-Dialog-body') as HTMLElement;

    dialog.node.style.resize = 'none';
    dialog.node.style.overflow = 'hidden';

    if (content) {
      content.style.resize = 'none';
      content.style.overflow = 'hidden';
      content.style.maxHeight = 'none';
    }

    if (bodyEl) {
      bodyEl.style.overflow = 'visible';
    }

    const result = await dialog.launch();

    if (result.button.accept) {
      return body.getCode();
    }
    return null;
  }
}
