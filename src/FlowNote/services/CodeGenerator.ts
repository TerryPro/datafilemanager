import { NotebookPanel } from '@jupyterlab/notebook';
import { INodeSchema } from '../types';

/**
 * 根据参数类型格式化值为 Python 代码片段
 */
/**
 * 将参数值格式化为 Python 代码
 */
function formatValue(
  val: any,
  argType?: string,
  argName?: string,
  serverRoot?: string
): string {
  if (val === undefined || val === null) {
    return 'None';
  }
  if (val === true) {
    return 'True';
  }
  if (val === false) {
    return 'False';
  }
  if (Array.isArray(val)) {
    const items = val.map(v => (typeof v === 'string' ? `'${v}'` : String(v)));
    return `[${items.join(', ')}]`;
  }
  if (typeof val === 'number') {
    return String(val);
  }
  // 字符串与其他类型按字符串处理
  // 文件路径统一用正斜杠
  const s = String(val).replace(/\\/g, '/');
  if (argName === 'filepath') {
    if (!s || s.trim().length === 0) {
      return "''";
    }
    const hasDataset = s.startsWith('dataset/');
    const rel = hasDataset ? s : `dataset/${s}`;
    if (serverRoot && serverRoot.length > 0) {
      const isWin = /\\|:/.test(serverRoot);
      const sep = isWin ? '\\' : '/';
      const rootNorm = serverRoot.replace(/[\\/]+$/g, '');
      const relParts = rel.split('/');
      const absPath = [rootNorm, ...relParts].join(sep);
      return `'${absPath}'`;
    }
    return `'${rel}'`;
  }
  return `'${s}'`;
}

/**
 * 判断值是否可作为裸变量标识符（不加引号）
 */
function isBareIdentifier(val: any): boolean {
  if (typeof val !== 'string') {
    return false;
  }
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(val);
}

/**
 * 针对常见节点生成单元格代码（单步）
 */
/**
 * 生成节点对应的 Python 代码
 */
export function generateNodeCode(
  schema: INodeSchema,
  values: Record<string, any>,
  serverRoot?: string
): string {
  const lines: string[] = [];
  const title = schema?.name || 'Step';
  lines.push(`# ${title}`);

  // 统一：采用工作流库函数调用方式
  lines.push('from aiserver.workflow_lib import *');
  const func = schema?.id || 'noop';
  const argStrs: string[] = [];
  const included = new Set<string>();
  // 先按输入端口顺序传入，确保签名顺序（例如 df 放在最前）
  (schema.inputs || []).forEach(port => {
    const name = port.name;
    if (included.has(name)) {
      return;
    }
    const v = values[name] !== undefined ? values[name] : undefined;
    if (isBareIdentifier(v)) {
      argStrs.push(`${name}=${String(v)}`);
    } else {
      argStrs.push(`${name}=${formatValue(v, port.type, name, serverRoot)}`);
    }
    included.add(name);
  });
  // 再补充其余非输出参数（保持 args 原有顺序）
  (schema.args || []).forEach(arg => {
    if (arg.role === 'output') {
      return;
    }
    if (included.has(arg.name)) {
      return;
    }
    const v = values[arg.name] !== undefined ? values[arg.name] : arg.default;
    if (arg.role === 'input' && isBareIdentifier(v)) {
      argStrs.push(`${arg.name}=${String(v)}`);
    } else {
      argStrs.push(
        `${arg.name}=${formatValue(v, arg.type, arg.name, serverRoot)}`
      );
    }
    included.add(arg.name);
  });
  const outs = Array.isArray(schema.outputs) ? schema.outputs : [];
  const outVars = (values['__output_vars__'] || {}) as Record<string, string>;
  const firstPortName = outs.length > 0 ? outs[0].name : undefined;
  const primaryOutVar = firstPortName ? outVars[firstPortName] : undefined;
  const canDirectAssign = outs.length === 1 && isBareIdentifier(primaryOutVar);

  if (outs.length === 0) {
    // 无输出：仅调用函数，无需中间变量与显示
    lines.push(`${func}(${argStrs.join(', ')})`);
    return lines.join('\n');
  } else if (canDirectAssign) {
    // 单输出：直接将函数结果赋值给统一输出变量名
    lines.push(`${primaryOutVar} = ${func}(${argStrs.join(', ')})`);
  } else {
    // 多输出或无法确认变量名：使用临时变量 res 承接
    lines.push(`res = ${func}(${argStrs.join(', ')})`);
    // 将统一输出变量名与 res 绑定，便于后续连线引用
    outs.forEach(port => {
      const varName = outVars[port.name];
      if (isBareIdentifier(varName)) {
        lines.push(`${varName} = res`);
      }
    });
  }

  const displayTarget = canDirectAssign ? String(primaryOutVar) : 'res';
  lines.push('try:');
  lines.push(`    display(${displayTarget}.head())`);
  lines.push('except Exception:');
  lines.push(`    print(${displayTarget})`);
  return lines.join('\n');
}

/**
 * 根据节点ID查找对应Cell，生成代码并写入Cell源代码
 */
/**
 * 更新指定节点对应的 Cell 源代码
 */
export function updateCellSourceForNode(
  notebook: NotebookPanel,
  nodeId: string,
  serverRoot?: string
): void {
  if (!notebook.model) {
    return;
  }
  const cells = notebook.model.cells;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells.get(i);
    const nid = cell.sharedModel.getMetadata('node_id') as string;
    if (nid === nodeId) {
      const schema = (cell.sharedModel.getMetadata('flow_schema') || {}) as any;
      if (!schema || schema.id === 'free_cell' || schema.category === 'free') {
        return;
      }
      const values = (cell.sharedModel.getMetadata('flow_values') || {}) as any;
      // 读取 Notebook 级连线元数据，填充输入引用与输出变量名
      const metaEdges =
        (notebook.model.sharedModel.getMetadata('flow_edges') as any[]) || [];
      const computedValues = { ...values } as Record<string, any>;
      // 输出变量名注入到特殊键，供代码生成赋值
      const outVars =
        (cell.sharedModel.getMetadata('flow_output_vars') as Record<
          string,
          string
        >) || {};
      computedValues['__output_vars__'] = outVars;
      // 为每个输入参数或输入端口查找上游输出变量
      const inputNames = new Set<string>();
      (schema.args || [])
        .filter((arg: any) => arg.role === 'input')
        .forEach((arg: any) => inputNames.add(arg.name));
      (schema.inputs || []).forEach((p: any) => inputNames.add(p.name));
      inputNames.forEach(name => {
        const edge = metaEdges.find(
          (e: any) => e.targetId === nodeId && e.targetPort === name
        );
        if (edge) {
          // 查找源 Cell 的输出变量映射
          let srcOutVars: Record<string, string> = {};
          for (let j = 0; j < cells.length; j++) {
            const c = cells.get(j);
            const cid = c.sharedModel.getMetadata('node_id') as string;
            if (cid === edge.sourceId) {
              srcOutVars =
                (c.sharedModel.getMetadata('flow_output_vars') as Record<
                  string,
                  string
                >) || {};
              break;
            }
          }
          const refVar = srcOutVars[edge.sourcePort];
          if (refVar && isBareIdentifier(refVar)) {
            computedValues[name] = refVar;
          }
        } else {
          // 无连线：强制使用 None（覆盖可能残留的旧值）
          computedValues[name] = undefined;
        }
      });

      const code = generateNodeCode(schema, computedValues, serverRoot);
      const sm: any = cell.sharedModel as any;
      if (typeof sm.setSource === 'function') {
        sm.setSource(code);
      }
      break;
    }
  }
}
