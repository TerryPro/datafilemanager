/**
 * Python 值格式化工具
 * 负责将 JavaScript 值转换为 Python 代码字符串
 */
export class PythonFormatter {
  /**
   * 判断字符串是否为合法的 Python 标识符
   */
  static isBareIdentifier(val: any): boolean {
    if (typeof val !== 'string') {
      return false;
    }
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(val);
  }

  /**
   * 格式化文件路径
   */
  static formatFilePath(path: string, serverRoot?: string): string {
    if (!path || path.trim().length === 0) {
      return "''";
    }

    // 统一使用正斜杠
    const normalized = path.replace(/\\/g, '/');
    const hasDataset = normalized.startsWith('dataset/');
    const relativePath = hasDataset ? normalized : `dataset/${normalized}`;

    if (serverRoot && serverRoot.length > 0) {
      const isWindows = /\\|:/.test(serverRoot);
      const separator = isWindows ? '\\' : '/';
      const rootNormalized = serverRoot.replace(/[\\/]+$/g, '');
      const pathParts = relativePath.split('/');
      const absolutePath = [rootNormalized, ...pathParts].join(separator);
      return `'${absolutePath}'`;
    }

    return `'${relativePath}'`;
  }

  /**
   * 格式化数组
   */
  static formatArray(arr: any[]): string {
    const items = arr.map(v => (typeof v === 'string' ? `'${v}'` : String(v)));
    return `[${items.join(', ')}]`;
  }

  /**
   * 格式化值为 Python 代码
   */
  static formatValue(
    val: any,
    argType?: string,
    argName?: string,
    serverRoot?: string
  ): string {
    // null/undefined
    if (val === undefined || val === null) {
      return 'None';
    }

    // 布尔值
    if (val === true) {
      return 'True';
    }
    if (val === false) {
      return 'False';
    }

    // 数组
    if (Array.isArray(val)) {
      return this.formatArray(val);
    }

    // 数字
    if (typeof val === 'number') {
      return String(val);
    }

    // 文件路径特殊处理
    if (argName === 'filepath') {
      return this.formatFilePath(String(val), serverRoot);
    }

    // 字符串
    const str = String(val).replace(/\\/g, '/');
    return `'${str}'`;
  }
}
