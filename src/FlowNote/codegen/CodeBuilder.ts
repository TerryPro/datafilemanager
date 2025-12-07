/**
 * Python 代码构建器
 * 使用 Builder 模式构建 Python 代码
 */
export class CodeBuilder {
  private lines: string[] = [];

  /**
   * 添加注释
   */
  addComment(text: string): this {
    this.lines.push(`# ${text}`);
    return this;
  }

  /**
   * 添加导入语句
   */
  addImport(statement: string): this {
    this.lines.push(statement);
    return this;
  }

  /**
   * 添加函数调用（无返回值）
   */
  addFunctionCall(funcName: string, args: string[]): this {
    this.lines.push(`${funcName}(${args.join(', ')})`);
    return this;
  }

  /**
   * 添加赋值语句
   */
  addAssignment(varName: string, expression: string): this {
    this.lines.push(`${varName} = ${expression}`);
    return this;
  }

  /**
   * 添加 try-except 块
   */
  addTryExcept(tryBlock: string[], exceptBlock: string[]): this {
    this.lines.push('try:');
    tryBlock.forEach(line => this.lines.push(`    ${line}`));
    this.lines.push('except Exception:');
    exceptBlock.forEach(line => this.lines.push(`    ${line}`));
    return this;
  }

  /**
   * 添加原始代码行
   */
  addLine(line: string): this {
    this.lines.push(line);
    return this;
  }

  /**
   * 构建最终代码
   */
  build(): string {
    return this.lines.join('\n');
  }

  /**
   * 清空构建器
   */
  clear(): this {
    this.lines = [];
    return this;
  }
}
