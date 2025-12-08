import { NotebookPanel } from '@jupyterlab/notebook';
import { INodeSchema } from '../types';
import { NodeCodeGenerator } from './NodeCodeGenerator';
import { PythonFormatter } from './PythonFormatter';

/**
 * Cell 更新器
 * 负责查找和更新 Notebook Cell 的源代码
 */
export class CellUpdater {
  private notebook: NotebookPanel;
  private serverRoot?: string;

  constructor(notebook: NotebookPanel, serverRoot?: string) {
    this.notebook = notebook;
    this.serverRoot = serverRoot;
  }

  /**
   * 更新指定节点对应的 Cell 源代码
   */
  updateCellForNode(nodeId: string): void {
    if (!this.notebook.model) {
      return;
    }

    const cells = this.notebook.model.cells;
    const cellIndex = this.findCellByNodeId(cells, nodeId);

    if (cellIndex === -1) {
      return;
    }

    const cell = cells.get(cellIndex);
    const schema = this.getCellSchema(cell);

    // 跳过自由单元格
    if (this.isFreeCell(schema)) {
      return;
    }

    const values = this.computeCellValues(cell, nodeId, schema);
    const code = this.generateCode(schema, values);
    this.setCellSource(cell, code);
  }

  /**
   * 查找节点对应的 Cell 索引
   */
  private findCellByNodeId(cells: any, nodeId: string): number {
    for (let i = 0; i < cells.length; i++) {
      const cell = cells.get(i);
      const nid = cell.sharedModel.getMetadata('node_id') as string;
      if (nid === nodeId) {
        return i;
      }
    }
    return -1;
  }

  /**
   * 获取 Cell 的 schema
   */
  private getCellSchema(cell: any): INodeSchema {
    return (cell.sharedModel.getMetadata('flow_schema') || {}) as INodeSchema;
  }

  /**
   * 判断是否为自由单元格
   */
  private isFreeCell(schema: INodeSchema): boolean {
    // 空 schema 或没有 id 的都是自由单元格
    if (!schema || !schema.id) {
      return true;
    }
    return schema.id === 'free_cell' || schema.category === 'free';
  }

  /**
   * 计算 Cell 的值（包含连线引用）
   */
  private computeCellValues(
    cell: any,
    nodeId: string,
    schema: INodeSchema
  ): Record<string, any> {
    const baseValues = (cell.sharedModel.getMetadata('flow_values') ||
      {}) as Record<string, any>;
    const computedValues = { ...baseValues };

    // 添加输出变量映射
    const outVars = (cell.sharedModel.getMetadata('flow_output_vars') ||
      {}) as Record<string, string>;
    computedValues['__output_vars__'] = outVars;

    // 处理输入连线
    this.resolveInputConnections(computedValues, nodeId, schema);

    return computedValues;
  }

  /**
   * 解析输入连线，填充上游变量引用
   */
  private resolveInputConnections(
    values: Record<string, any>,
    nodeId: string,
    schema: INodeSchema
  ): void {
    const metaEdges = this.getFlowEdges();
    const inputNames = this.collectInputNames(schema);

    inputNames.forEach(name => {
      const edge = metaEdges.find(
        (e: any) => e.targetId === nodeId && e.targetPort === name
      );

      if (edge) {
        const refVar = this.findSourceOutputVariable(
          edge.sourceId,
          edge.sourcePort
        );
        if (refVar && PythonFormatter.isBareIdentifier(refVar)) {
          values[name] = refVar;
        }
      } else {
        // 无连线：强制使用 None
        values[name] = undefined;
      }
    });
  }

  /**
   * 获取流程图连线元数据
   */
  private getFlowEdges(): any[] {
    if (!this.notebook.model) {
      return [];
    }
    return (
      (this.notebook.model.sharedModel.getMetadata('flow_edges') as any[]) || []
    );
  }

  /**
   * 收集所有输入参数名
   */
  private collectInputNames(schema: INodeSchema): Set<string> {
    const inputNames = new Set<string>();

    // 从 args 中收集 input 角色的参数
    (schema.args || [])
      .filter(arg => arg.role === 'input')
      .forEach(arg => inputNames.add(arg.name));

    // 从 inputs 端口收集
    (schema.inputs || []).forEach(port => inputNames.add(port.name));

    return inputNames;
  }

  /**
   * 查找源节点的输出变量
   */
  private findSourceOutputVariable(
    sourceId: string,
    sourcePort: string
  ): string | undefined {
    if (!this.notebook.model) {
      return undefined;
    }

    const cells = this.notebook.model.cells;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells.get(i);
      const cellId = cell.sharedModel.getMetadata('node_id') as string;

      if (cellId === sourceId) {
        const outVars = (cell.sharedModel.getMetadata('flow_output_vars') ||
          {}) as Record<string, string>;
        return outVars[sourcePort];
      }
    }
    return undefined;
  }

  /**
   * 生成代码
   */
  private generateCode(
    schema: INodeSchema,
    values: Record<string, any>
  ): string {
    const generator = new NodeCodeGenerator(schema, values, this.serverRoot);
    return generator.generate();
  }

  /**
   * 设置 Cell 源代码
   */
  private setCellSource(cell: any, code: string): void {
    const sharedModel: any = cell.sharedModel;
    if (typeof sharedModel.setSource === 'function') {
      sharedModel.setSource(code);
    }
  }
}
