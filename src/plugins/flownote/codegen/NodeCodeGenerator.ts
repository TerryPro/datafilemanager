import { INodeSchema } from '../types';
import { CodeBuilder } from './CodeBuilder';
import { PythonFormatter } from './PythonFormatter';

/**
 * 节点代码生成器
 * 负责根据节点 schema 和参数值生成 Python 代码
 */
export class NodeCodeGenerator {
  private schema: INodeSchema;
  private values: Record<string, any>;
  private serverRoot?: string;
  private builder: CodeBuilder;

  constructor(
    schema: INodeSchema,
    values: Record<string, any>,
    serverRoot?: string
  ) {
    this.schema = schema;
    this.values = values;
    this.serverRoot = serverRoot;
    this.builder = new CodeBuilder();
  }

  /**
   * 生成代码
   */
  generate(): string {
    const title = this.schema?.name || 'Step';

    this.builder
      .addComment(title)
      .addImport('from aiserver.workflow_lib import *');

    const outputs = this.schema.outputs || [];

    if (outputs.length === 0) {
      this.generateNoOutputCode();
    } else if (this.canDirectAssign(outputs)) {
      this.generateSingleOutputCode(outputs[0].name);
    } else {
      this.generateMultiOutputCode(outputs);
    }

    return this.builder.build();
  }

  /**
   * 生成无输出的代码
   */
  private generateNoOutputCode(): void {
    const funcName = this.schema?.id || 'noop';
    const args = this.collectArguments();
    this.builder.addFunctionCall(funcName, args);
  }

  /**
   * 生成单输出的代码
   */
  private generateSingleOutputCode(portName: string): void {
    const funcName = this.schema?.id || 'noop';
    const args = this.collectArguments();
    const outVars = this.getOutputVariables();
    const varName = outVars[portName];

    const expression = `${funcName}(${args.join(', ')})`;
    this.builder.addAssignment(varName, expression);
    this.addDisplayBlock(varName);
  }

  /**
   * 生成多输出的代码
   */
  private generateMultiOutputCode(outputs: any[]): void {
    const funcName = this.schema?.id || 'noop';
    const args = this.collectArguments();
    const outVars = this.getOutputVariables();

    const expression = `${funcName}(${args.join(', ')})`;
    this.builder.addAssignment('res', expression);

    // 绑定输出变量
    outputs.forEach(port => {
      const varName = outVars[port.name];
      if (PythonFormatter.isBareIdentifier(varName)) {
        this.builder.addAssignment(varName, 'res');
      }
    });

    this.addDisplayBlock('res');
  }

  /**
   * 添加显示代码块
   */
  private addDisplayBlock(varName: string): void {
    this.builder.addTryExcept(
      [`display(${varName}.head())`],
      [`print(${varName})`]
    );
  }

  /**
   * 收集函数参数
   */
  private collectArguments(): string[] {
    const argStrs: string[] = [];
    const included = new Set<string>();

    // 先处理输入端口（保持顺序，这些是变量引用）
    (this.schema.inputs || []).forEach(port => {
      if (included.has(port.name)) {
        return;
      }

      const value = this.values[port.name];
      // 输入端口明确标记为 input 角色
      const argStr = this.formatArgument(port.name, value, port.type, 'input');
      argStrs.push(argStr);
      included.add(port.name);
    });

    // 再处理其他参数
    (this.schema.args || []).forEach(arg => {
      if (arg.role === 'output' || included.has(arg.name)) {
        return;
      }

      const value =
        this.values[arg.name] !== undefined
          ? this.values[arg.name]
          : arg.default;

      const argStr = this.formatArgument(arg.name, value, arg.type, arg.role);
      argStrs.push(argStr);
      included.add(arg.name);
    });

    return argStrs;
  }

  /**
   * 格式化单个参数
   */
  private formatArgument(
    name: string,
    value: any,
    type?: string,
    role?: string
  ): string {
    // 只有明确标记为 input 角色的参数才当作变量引用
    if (role === 'input' && PythonFormatter.isBareIdentifier(value)) {
      return `${name}=${String(value)}`;
    }

    // 其他所有参数都格式化为 Python 值（即使看起来像标识符）
    const formatted = PythonFormatter.formatValue(
      value,
      type,
      name,
      this.serverRoot
    );
    return `${name}=${formatted}`;
  }

  /**
   * 获取输出变量映射
   */
  private getOutputVariables(): Record<string, string> {
    return (this.values['__output_vars__'] || {}) as Record<string, string>;
  }

  /**
   * 判断是否可以直接赋值（单输出且有合法变量名）
   */
  private canDirectAssign(outputs: any[]): boolean {
    if (outputs.length !== 1) {
      return false;
    }

    const outVars = this.getOutputVariables();
    const firstPortName = outputs[0].name;
    const varName = outVars[firstPortName];

    return PythonFormatter.isBareIdentifier(varName);
  }
}
