import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo
} from 'react';
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Node,
  Edge,
  MarkerType,
  NodeChange,
  applyNodeChanges,
  addEdge,
  Connection
} from 'reactflow';
import 'reactflow/dist/style.css';
import { NotebookPanel, NotebookActions } from '@jupyterlab/notebook';
import { ServiceManager } from '@jupyterlab/services';
import { ICellModel } from '@jupyterlab/cells';
import { UUID } from '@lumino/coreutils';
import * as nbformat from '@jupyterlab/nbformat';
import { FlowGenericNode } from './nodes/FlowGenericNode';
import { FlowEmptyNode } from './nodes/FlowEmptyNode';
import { FlowSidebar } from './components/FlowSidebar';
import { FlowPropertyPanel } from './components/FlowPropertyPanel';
import { updateCellSourceForNode } from './services/CodeGenerator';
import { AiService } from '../services/ai-service';

const nodeTypes = {
  generic: FlowGenericNode,
  code: FlowGenericNode,
  markdown: FlowGenericNode,
  empty: FlowEmptyNode
};

interface IFlowNotePanelProps {
  notebook: NotebookPanel;
  serviceManager?: ServiceManager;
}

export const FlowNotePanel: React.FC<IFlowNotePanelProps> = ({
  notebook,
  serviceManager
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [serverRoot, setServerRoot] = useState<string>('');

  // Helper to generate node from cell
  /**
   * 根据 Notebook 的 Cell 构造 ReactFlow 节点
   * - 从 sharedModel 元数据读取 node_id、位置、算法 schema、参数值
   * - 若缺失则生成默认值
   * - 生成并持久化节点编号与输出变量名
   */
  const createNodeFromCell = (cellModel: ICellModel, index: number): Node => {
    // Ensure node_id exists using sharedModel for consistency
    let nodeId = (cellModel.sharedModel.getMetadata('node_id') as string) || '';

    if (!nodeId) {
      nodeId = UUID.uuid4();
      cellModel.sharedModel.setMetadata('node_id', nodeId);
    }

    // Get position from metadata if available
    const metaPos = cellModel.sharedModel.getMetadata('flow_position') as any;
    const position = metaPos
      ? JSON.parse(JSON.stringify(metaPos))
      : { x: 100, y: index * 150 + 50 };

    // Get schema and values from metadata
    const metaSchema = cellModel.sharedModel.getMetadata('flow_schema') as any;
    const metaValues = cellModel.sharedModel.getMetadata('flow_values') as any;

    // Node number persistence
    let nodeNumber = cellModel.sharedModel.getMetadata(
      'flow_node_number'
    ) as number as number;
    if (!nodeNumber || typeof nodeNumber !== 'number') {
      const seqRaw = notebook.model
        ? (notebook.model.sharedModel.getMetadata('flow_number_seq') as any)
        : undefined;
      const seq = typeof seqRaw === 'number' ? seqRaw : 1;
      nodeNumber = seq;
      cellModel.sharedModel.setMetadata('flow_node_number', nodeNumber);
      if (notebook.model) {
        notebook.model.sharedModel.setMetadata('flow_number_seq', seq + 1);
      }
    }

    // Infer label if no schema name
    let label = '(Unnamed Step)';
    if (metaSchema && metaSchema.name) {
      label = metaSchema.name;
    } else {
      const source = cellModel.sharedModel.getSource();
      if (source.trim() !== '') {
        const lines = source.split('\n');
        const firstLine = lines[0].trim();
        if (firstLine.startsWith('#')) {
          label = firstLine.replace(/^#+\s*/, '');
        } else {
          label =
            firstLine.substring(0, 20) + (firstLine.length > 20 ? '...' : '');
        }
      }
    }

    const schema = metaSchema
      ? JSON.parse(JSON.stringify(metaSchema))
      : {
          id: 'free_cell',
          name: '自由CELL',
          category: 'free',
          inputs: index > 0 ? [{ name: 'in', type: 'any' }] : [],
          outputs: [{ name: 'out', type: 'any' }],
          args: []
        };

    const values = metaValues ? JSON.parse(JSON.stringify(metaValues)) : {};

    // Output variable naming persistence
    let outVars = cellModel.sharedModel.getMetadata(
      'flow_output_vars'
    ) as Record<string, string> as Record<string, string>;
    if (!outVars || typeof outVars !== 'object') {
      outVars = {} as Record<string, string>;
      const ports: string[] = (schema.outputs || []).map((p: any) => p.name);
      ports.forEach((port: string) => {
        const safePort = String(port).replace(/[^a-zA-Z0-9_]+/g, '_');
        outVars[port] = `n${String(nodeNumber).padStart(2, '0')}_${safePort}`;
      });
      cellModel.sharedModel.setMetadata('flow_output_vars', outVars);
    }

    const sm = serviceManager || (notebook as any).context?.manager;
    // 读取并计算节点状态（统一为五态）
    const rawStatus =
      (cellModel.sharedModel.getMetadata('flow_status') as string) || '';
    const status = (() => {
      if (rawStatus === 'running' || rawStatus === 'calculating') {
        return 'running';
      }
      if (rawStatus === 'success' || rawStatus === 'ready') {
        return 'success';
      }
      if (rawStatus === 'failed' || rawStatus === 'error') {
        return 'failed';
      }
      // 自动判断：自由CELL或存在未连接的输入端口则视为未配置完整
      if (schema && schema.category === 'free') {
        return 'unconfigured';
      }
      try {
        const metaEdges =
          (notebook.model?.sharedModel.getMetadata('flow_edges') as any[]) ||
          [];
        const needInputs = (schema.inputs || []).map((p: any) => p.name);
        const hasAllInputs = needInputs.every((p: string) =>
          metaEdges.some(e => e.targetId === nodeId && e.targetPort === p)
        );
        return hasAllInputs ? 'configured' : 'unconfigured';
      } catch {
        return 'unconfigured';
      }
    })();
    return {
      id: nodeId,
      type: 'generic',
      position: position,
      data: {
        label: label,
        schema: schema,
        values: values,
        index: index,
        number: nodeNumber,
        outputVariables: outVars,
        onSelectAlgorithm: handleSelectAlgorithm,
        serviceManager: sm,
        metadata: {
          status
        },
        onRunNode: handleRunNode,
        onValuesChange: async (nid: string, newValues: Record<string, any>) => {
          if (!notebook.model) {
            return;
          }
          const cells = notebook.model.cells;
          for (let i = 0; i < cells.length; i++) {
            const cell = cells.get(i);
            if ((cell.sharedModel.getMetadata('node_id') as string) === nid) {
              cell.sharedModel.setMetadata('flow_values', newValues);
              const root =
                serverRoot || (await new AiService().getServerRoot());
              updateCellSourceForNode(notebook, nid, root);
              break;
            }
          }
        },
        onFileChange: async (nid: string, filepath: string) => {
          if (!notebook.model) {
            return;
          }
          const cells = notebook.model.cells;
          for (let i = 0; i < cells.length; i++) {
            const cell = cells.get(i);
            if ((cell.sharedModel.getMetadata('node_id') as string) === nid) {
              const currentValues =
                (cell.sharedModel.getMetadata('flow_values') as any) || {};
              currentValues['filepath'] = filepath;
              cell.sharedModel.setMetadata('flow_values', currentValues);
              const root =
                serverRoot || (await new AiService().getServerRoot());
              updateCellSourceForNode(notebook, nid, root);
              break;
            }
          }
        }
      }
    };
  };

  /**
   * 重新从 Notebook 模型刷新画布中的节点与边
   * - 节点位置来源于 Cell 元数据中的 flow_position
   * - 边从 Notebook 元数据 flow_edges 读取（仅手动连线）
   */
  const refreshFlow = useCallback(() => {
    if (!notebook || !notebook.model || notebook.isDisposed) {
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const cells = notebook.model.cells;
    for (let i = 0; i < cells.length; i++) {
      const cellModel = cells.get(i);
      // 计算默认位置：若无 flow_position，则放在当前画布最后一个节点之后
      const metaPos = cellModel.sharedModel.getMetadata('flow_position') as any;
      let posUsed = metaPos
        ? { x: metaPos.x || 100, y: metaPos.y || 50 }
        : null;
      if (!posUsed) {
        const spacingY = 150;
        // 计算当前已生成节点的最大Y
        const currentMaxY =
          newNodes.length > 0
            ? Math.max(...newNodes.map(n => n.position.y))
            : 50;
        posUsed = { x: 100, y: currentMaxY + spacingY };
        cellModel.sharedModel.setMetadata('flow_position', posUsed);
      }
      const node = createNodeFromCell(cellModel, i);
      newNodes.push(node);
    }

    try {
      const metaEdges =
        (notebook.model &&
          (notebook.model.sharedModel.getMetadata('flow_edges') as any[])) ||
        [];
      if (Array.isArray(metaEdges)) {
        metaEdges.forEach((e: any, idx: number) => {
          newEdges.push({
            id:
              e.id ||
              `e-${e.sourceId}-${e.targetId}-${e.sourcePort}-${e.targetPort}-${idx}`,
            source: e.sourceId,
            target: e.targetId,
            sourceHandle: e.sourcePort,
            targetHandle: e.targetPort,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 }
          } as Edge);
        });
      }
    } catch (err) {
      // ignore
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [notebook.model, setNodes, setEdges]);

  useEffect(() => {
    const ai = new AiService();
    ai.getServerRoot().then(root => {
      if (typeof root === 'string') {
        setServerRoot(root);
      }
    });
  }, []);

  useEffect(() => {
    if (!serverRoot || !notebook.model) {
      return;
    }
    const cells = notebook.model.cells;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells.get(i);
      const nid = cell.sharedModel.getMetadata('node_id') as string;
      if (nid) {
        updateCellSourceForNode(notebook, nid, serverRoot);
      }
    }
  }, [serverRoot, notebook.model]);

  /**
   * 选择占位节点算法后，将对应 Cell 转换为具体算法：
   * - 写入 flow_schema 与默认 flow_values
   * - 更新 Cell 源码为算法标题模板
   * - 刷新画布
   */
  const handleSelectAlgorithm = useCallback(
    async (nodeId: string, schema: any) => {
      if (!notebook.model) {
        return;
      }
      const cells = notebook.model.cells;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells.get(i);
        if ((cell.sharedModel.getMetadata('node_id') as string) === nodeId) {
          const initialValues: Record<string, any> = {};
          if (schema.args && Array.isArray(schema.args)) {
            schema.args.forEach((arg: any) => {
              if (Object.prototype.hasOwnProperty.call(arg, 'default')) {
                if (arg.name === 'filepath') {
                  initialValues[arg.name] = '';
                } else if (
                  arg.name === 'timeIndex' ||
                  arg.name === 'time_index'
                ) {
                  initialValues[arg.name] = '';
                } else {
                  initialValues[arg.name] = arg.default;
                }
              }
            });
          }

          cell.sharedModel.setMetadata('flow_schema', schema);
          cell.sharedModel.setMetadata('flow_values', initialValues);
          // 切换到算法节点后，按新 outputs 重建输出变量命名
          try {
            const nodeNumber = cell.sharedModel.getMetadata(
              'flow_node_number'
            ) as number as number;
            const ports: string[] = (schema.outputs || []).map(
              (p: any) => p.name
            );
            const outVars: Record<string, string> = {};
            ports.forEach((port: string) => {
              const safePort = String(port).replace(/[^a-zA-Z0-9_]+/g, '_');
              outVars[port] = `n${String(nodeNumber).padStart(
                2,
                '0'
              )}_${safePort}`;
            });
            cell.sharedModel.setMetadata('flow_output_vars', outVars);
          } catch (e) {
            // ignore
          }
          const root = serverRoot || (await new AiService().getServerRoot());
          updateCellSourceForNode(notebook, nodeId, root);

          break;
        }
      }
      refreshFlow();
    },
    [notebook.model, refreshFlow, serverRoot]
  );

  /**
   * 运行指定节点对应的 Notebook Cell
   * - 设置运行状态为 calculating
   * - 调用 NotebookActions.run 执行该 Cell
   * - 根据输出判断成功/异常并写回状态
   */
  const handleRunNode = useCallback(
    async (nodeId: string) => {
      if (!notebook.model) {
        return;
      }
      const cells = notebook.model.cells;
      let runIndex = -1;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells.get(i);
        const nid = cell.sharedModel.getMetadata('node_id') as string;
        if (nid === nodeId) {
          runIndex = i;
          cell.sharedModel.setMetadata('flow_status', 'calculating');
          break;
        }
      }
      if (runIndex < 0) {
        return;
      }
      setNodes(nds =>
        nds.map(n =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  metadata: {
                    ...(n.data.metadata || {}),
                    status: 'calculating'
                  }
                }
              }
            : n
        )
      );
      try {
        const nb = notebook.content;
        const sc = notebook.context.sessionContext;
        nb.activeCellIndex = runIndex;
        await (NotebookActions as any).run(nb, sc);
        const cell = cells.get(runIndex);
        let ok = true;
        try {
          const outputs = (cell.toJSON() as any).outputs || [];
          ok = !outputs.some((o: any) => o.output_type === 'error');
        } catch (e) {
          console.error('FlowNotePanel: outputs parse error', e);
        }
        cell.sharedModel.setMetadata('flow_status', ok ? 'ready' : 'error');
        setNodes(nds =>
          nds.map(n =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    metadata: {
                      ...(n.data.metadata || {}),
                      status: ok ? 'ready' : 'error'
                    }
                  }
                }
              : n
          )
        );
      } catch (e) {
        try {
          const cell = cells.get(runIndex);
          cell.sharedModel.setMetadata('flow_status', 'error');
        } catch (e2) {
          console.error('FlowNotePanel: set error status failed', e2);
        }
        setNodes(nds =>
          nds.map(n =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    metadata: { ...(n.data.metadata || {}), status: 'error' }
                  }
                }
              : n
          )
        );
      }
    },
    [notebook.model]
  );

  // 取消空节点逻辑，默认即为自由CELL，保留选择算法的转化流程

  // Handle node changes (dragging)
  /**
   * 处理节点拖拽等变更，更新本地节点状态
   */
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // 删除节点时同步删除对应的 Notebook Cell
      changes.forEach(change => {
        if (change.type === 'remove') {
          const nodeId = (change as any).id as string;
          if (notebook.model) {
            const cells = notebook.model.cells;
            for (let i = 0; i < cells.length; i++) {
              const cell = cells.get(i);
              if (
                (cell.sharedModel.getMetadata('node_id') as string) === nodeId
              ) {
                notebook.model.sharedModel.deleteCell(i);
                break;
              }
            }
          }
        }
      });
      setNodes(nds => applyNodeChanges(changes, nds));
    },
    [setNodes, notebook.model]
  );

  /**
   * 当 ReactFlow 通知节点被删除时，删除对应的 Notebook Cell
   */
  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      if (!notebook.model || !deletedNodes || deletedNodes.length === 0) {
        return;
      }
      const ids = new Set(deletedNodes.map(n => n.id));
      const cells = notebook.model.cells;
      // 从后向前删除避免索引偏移
      for (let i = cells.length - 1; i >= 0; i--) {
        const cell = cells.get(i);
        const nid = cell.sharedModel.getMetadata('node_id') as string;
        if (nid && ids.has(nid)) {
          notebook.model.sharedModel.deleteCell(i);
        }
      }

      // 清理与删除节点相关的连线元数据
      try {
        const metaEdges =
          (notebook.model.sharedModel.getMetadata('flow_edges') as any[]) || [];
        const filtered = metaEdges.filter(
          (e: any) => !ids.has(e.sourceId) && !ids.has(e.targetId)
        );
        notebook.model.sharedModel.setMetadata('flow_edges', filtered);
        setEdges(eds =>
          eds.filter(e => !ids.has(e.source) && !ids.has(e.target))
        );
      } catch (err) {
        // ignore
      }
    },
    [notebook.model]
  );

  /**
   * 处理用户手动连线事件：更新画布与 Notebook 元数据
   */
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges(eds => addEdge(params, eds));
      if (!notebook.model) {
        return;
      }
      const record = {
        id: `e-${params.source}-${params.target}-${params.sourceHandle}-${params.targetHandle}`,
        sourceId: params.source,
        targetId: params.target,
        sourcePort: params.sourceHandle,
        targetPort: params.targetHandle
      } as any;
      const metaEdges =
        (notebook.model!.sharedModel.getMetadata('flow_edges') as any[]) || [];
      const exists = metaEdges.some(
        (e: any) =>
          e.sourceId === record.sourceId &&
          e.targetId === record.targetId &&
          e.sourcePort === record.sourcePort &&
          e.targetPort === record.targetPort
      );
      if (!exists) {
        metaEdges.push(record);
        notebook.model.sharedModel.setMetadata('flow_edges', metaEdges);
        // 立即更新目标节点代码，使其输入引用生效
        if (params.target) {
          updateCellSourceForNode(notebook, String(params.target), serverRoot);
          // 更新目标节点状态为“已配置/未配置”
          setNodes(nds =>
            nds.map(n => {
              if (n.id !== params.target) {
                return n;
              }
              const schema = (n.data as any)?.schema || {};
              const needInputs = (schema.inputs || []).map((p: any) => p.name);
              const hasAllInputs = needInputs.every((p: string) =>
                metaEdges.some(
                  (e: any) =>
                    e.targetId === String(params.target) && e.targetPort === p
                )
              );
              return {
                ...n,
                data: {
                  ...n.data,
                  metadata: {
                    ...(n.data as any).metadata,
                    status: hasAllInputs ? 'configured' : 'unconfigured'
                  }
                }
              };
            })
          );
        }
      }
    },
    [notebook.model]
  );

  /**
   * 处理边的变更（尤其删除）：同步 Notebook 元数据
   */
  const handleEdgesChange = useCallback(
    (changes: any[]) => {
      onEdgesChange(changes as any);
      if (!notebook.model || !Array.isArray(changes)) {
        return;
      }
      const removes = changes.filter((c: any) => c.type === 'remove');
      if (removes.length === 0) {
        return;
      }
      const metaEdges =
        (notebook.model.sharedModel.getMetadata('flow_edges') as any[]) || [];
      const removeIds = new Set(
        removes.map((r: any) => (r.id ? r.id : r.edge?.id)).filter(Boolean)
      );
      const filtered = metaEdges.filter((e: any) => !removeIds.has(e.id));
      notebook.model!.sharedModel.setMetadata('flow_edges', filtered);
      // 对受影响的目标节点重新生成代码
      removes.forEach((r: any) => {
        const tgt = r?.edge?.target || undefined;
        if (tgt) {
          updateCellSourceForNode(notebook, String(tgt), serverRoot);
          // 更新目标节点状态为“已配置/未配置”
          const newEdges =
            (notebook.model!.sharedModel.getMetadata('flow_edges') as any[]) ||
            [];
          setNodes(nds =>
            nds.map(n => {
              if (n.id !== tgt) {
                return n;
              }
              const schema = (n.data as any)?.schema || {};
              const needInputs = (schema.inputs || []).map((p: any) => p.name);
              const hasAllInputs = needInputs.every((p: string) =>
                newEdges.some(
                  (e: any) => e.targetId === String(tgt) && e.targetPort === p
                )
              );
              return {
                ...n,
                data: {
                  ...n.data,
                  metadata: {
                    ...(n.data as any).metadata,
                    status: hasAllInputs ? 'configured' : 'unconfigured'
                  }
                }
              };
            })
          );
        }
      });
    },
    [onEdgesChange, notebook.model]
  );

  /**
   * 当边被删除时：按 source/target/handle 精确匹配并清理元数据，更新目标节点代码
   */
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (!notebook.model || !Array.isArray(deleted) || deleted.length === 0) {
        return;
      }
      const metaEdges =
        (notebook.model.sharedModel.getMetadata('flow_edges') as any[]) || [];
      const filtered = metaEdges.filter((e: any) => {
        return !deleted.some(
          d =>
            e.sourceId === d.source &&
            e.targetId === d.target &&
            e.sourcePort === d.sourceHandle &&
            e.targetPort === d.targetHandle
        );
      });
      notebook.model!.sharedModel.setMetadata('flow_edges', filtered);
      // 触发目标节点代码更新（重置未连线输入为 None）
      deleted.forEach(d => {
        updateCellSourceForNode(notebook, String(d.target), serverRoot);
        // 更新目标节点状态为“已配置/未配置”
        const afterEdges =
          (notebook.model!.sharedModel.getMetadata('flow_edges') as any[]) ||
          [];
        setNodes(nds =>
          nds.map(n => {
            if (n.id !== d.target) {
              return n;
            }
            const schema = (n.data as any)?.schema || {};
            const needInputs = (schema.inputs || []).map((p: any) => p.name);
            const hasAllInputs = needInputs.every((p: string) =>
              afterEdges.some(
                (e: any) =>
                  e.targetId === String(d.target) && e.targetPort === p
              )
            );
            return {
              ...n,
              data: {
                ...n.data,
                metadata: {
                  ...(n.data as any).metadata,
                  status: hasAllInputs ? 'configured' : 'unconfigured'
                }
              }
            };
          })
        );
      });
    },
    [notebook.model, serverRoot]
  );

  // Save position on drag stop
  /**
   * 节点拖拽结束时，将最新坐标写回对应 Cell 的 flow_position 元数据
   */
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!notebook.model) {
        return;
      }
      const cells = notebook.model.cells;
      // Find cell by node id
      for (let i = 0; i < cells.length; i++) {
        const cell = cells.get(i);
        if ((cell.sharedModel.getMetadata('node_id') as string) === node.id) {
          // Update metadata
          cell.sharedModel.setMetadata('flow_position', node.position as any);
          break;
        }
      }
    },
    [notebook]
  );

  // Handle property changes
  /**
   * 当属性面板修改节点参数时：
   * - 将参数写入对应 Cell 的 flow_values 元数据
   * - 同步更新本地节点状态以立即生效
   */
  const handlePropertyChange = useCallback(
    async (nodeId: string, newValues: Record<string, any>) => {
      if (!notebook.model) {
        return;
      }
      const cells = notebook.model.cells;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells.get(i);
        if ((cell.sharedModel.getMetadata('node_id') as string) === nodeId) {
          cell.sharedModel.setMetadata('flow_values', newValues);
          const root = serverRoot || (await new AiService().getServerRoot());
          updateCellSourceForNode(notebook, nodeId, root);
          // Update local state to reflect changes immediately
          setNodes(nds =>
            nds.map(node => {
              if (node.id === nodeId) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    values: newValues
                  }
                };
              }
              return node;
            })
          );
          break;
        }
      }
    },
    [notebook.model, setNodes, serverRoot]
  );

  // Initial load and subscriptions
  /**
   * 初始化订阅 Notebook 模型变化：
   * - cells.changed：新增/删除/移动 Cell 时刷新画布
   * - contentChanged：内容变化时刷新标签等
   */
  useEffect(() => {
    refreshFlow();

    const onCellsChanged = () => {
      refreshFlow();
    };

    const onContentChanged = () => {
      // Cell content changed (e.g. text edit), need to update labels
      // We might want to debounce this or check if label actually changed
      refreshFlow();
    };

    if (notebook.model) {
      notebook.model.cells.changed.connect(onCellsChanged);
      notebook.model.contentChanged.connect(onContentChanged);
    }

    return () => {
      if (notebook && notebook.model) {
        notebook.model.cells.changed.disconnect(onCellsChanged);
        notebook.model.contentChanged.disconnect(onContentChanged);
      }
    };
  }, [notebook, refreshFlow]);

  /**
   * 将指定节点居中显示到 ReactFlow 视口
   * - 优先使用 fitView 精确聚焦到节点
   * - 回退到 getNode + setCenter 计算中心坐标
   */
  const centerNodeInView = useCallback(
    (nid: string) => {
      try {
        const inst = reactFlowInstance;
        if (!inst) {
          return;
        }
        if (
          typeof inst.getNode === 'function' &&
          typeof inst.setCenter === 'function'
        ) {
          const n = inst.getNode(nid);
          if (n && n.position) {
            const w = (n as any).width || 100;
            const h = (n as any).height || 40;
            const cx = n.position.x + w / 2;
            const cy = n.position.y + h / 2;
            // 若节点已在当前容器可见区域，则不移动
            const container = reactFlowWrapper.current as HTMLDivElement | null;
            if (container) {
              const zoom =
                typeof (inst as any).getZoom === 'function'
                  ? (inst as any).getZoom()
                  : 1;
              const vp =
                typeof (inst as any).getViewport === 'function'
                  ? (inst as any).getViewport()
                  : { x: 0, y: 0, zoom };
              const left = n.position.x * vp.zoom + vp.x;
              const top = n.position.y * vp.zoom + vp.y;
              const right = left + w * vp.zoom;
              const bottom = top + h * vp.zoom;
              const margin = 12;
              const visible =
                right > margin &&
                bottom > margin &&
                left < container.clientWidth - margin &&
                top < container.clientHeight - margin;
              if (visible) {
                return;
              }
            }
            const currentZoom =
              typeof (inst as any).getZoom === 'function'
                ? (inst as any).getZoom()
                : undefined;
            if (currentZoom !== undefined) {
              inst.setCenter(cx, cy, { zoom: currentZoom });
            } else {
              inst.setCenter(cx, cy);
            }
          }
        }
      } catch (err) {
        // ignore
      }
    },
    [reactFlowInstance]
  );

  /**
   * 将 Notebook 指定索引的 Cell 居中到视口
   * - 通过计算容器高度与 Cell 高度，滚动到中心位置
   */
  const centerCellInView = useCallback(
    (index: number) => {
      try {
        const container = notebook.content?.node as HTMLElement | undefined;
        const widget = notebook.content?.widgets[index];
        if (!container || !widget) {
          return;
        }
        const cellRect = widget.node.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        const margin = 8;
        const visible =
          cellRect.bottom > contRect.top + margin &&
          cellRect.top < contRect.bottom - margin &&
          cellRect.right > contRect.left + margin &&
          cellRect.left < contRect.right - margin;
        if (visible) {
          return;
        }
        // 使用浏览器原生滚动到视图，block:center 居中显示
        widget.node.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      } catch (err) {
        // ignore
      }
    },
    [notebook]
  );

  /**
   * 监听 Notebook 的激活 Cell 变化：
   * - 同步选中对应的 Flow 节点并将其居中
   */
  useEffect(() => {
    const onActiveCellChanged = () => {
      try {
        const idx = notebook.content.activeCellIndex;
        const cells = notebook.model?.cells;
        if (!cells || idx < 0 || idx >= cells.length) {
          return;
        }
        const cellModel = cells.get(idx);
        const nid = cellModel.sharedModel.getMetadata('node_id') as string;
        if (!nid) {
          return;
        }
        setSelectedNodeId(nid);
        setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nid })));
        centerNodeInView(nid);
      } catch (err) {
        // ignore
      }
    };
    notebook.content.activeCellChanged.connect(onActiveCellChanged);
    return () => {
      try {
        notebook.content.activeCellChanged.disconnect(onActiveCellChanged);
      } catch (_) {
        // ignore
      }
    };
  }, [notebook, centerNodeInView, setNodes]);

  // Handle node click -> Scroll to cell & Select
  /**
   * 点击节点：选中节点并滚动到对应的 Notebook Cell
   */
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      // 将节点居中到 Flow 视口
      centerNodeInView(node.id);

      if (!notebook.model) {
        return;
      }
      const cells = notebook.model.cells;
      for (let i = 0; i < cells.length; i++) {
        const cellModel = cells.get(i);
        const nid = cellModel.sharedModel.getMetadata('node_id') as string;
        if (nid === node.id) {
          notebook.content.activeCellIndex = i;
          // 将对应的 Notebook Cell 居中到视口
          centerCellInView(i);
          break;
        }
      }
    },
    [notebook, centerNodeInView, centerCellInView]
  );

  /**
   * 拖拽经过画布时设置光标效果
   */
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    /**
     * 将工具箱中的算法拖入画布时：
     * - 使用 ReactFlow 实例的 project 方法将屏幕坐标转换为画布坐标
     * - 在 Notebook 尾部插入一个 Code Cell，并写入位置与 schema 元数据
     */
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');
      const schemaStr = event.dataTransfer.getData(
        'application/reactflow-schema'
      );

      if (
        typeof type === 'undefined' ||
        !type ||
        !reactFlowBounds ||
        !notebook.model
      ) {
        return;
      }

      let schema: any = {};
      try {
        schema = JSON.parse(schemaStr);
      } catch (e) {
        console.error('Invalid schema', e);
      }

      let position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top
      };

      if (
        reactFlowInstance &&
        typeof reactFlowInstance.project === 'function'
      ) {
        position = reactFlowInstance.project(position);
      }

      const nodeId = UUID.uuid4();

      // Create a new Code Cell
      const defaultCode = `# ${
        schema.name || 'New Step'
      }\n# Add your code here\n`;

      const cellData: nbformat.ICodeCell = {
        cell_type: 'code',
        source: defaultCode,
        metadata: {
          node_id: nodeId,
          flow_position: position,
          flow_schema: schema, // Save schema
          flow_values: {} // Initialize values
        },
        outputs: [],
        execution_count: null
      };

      // Insert at the end
      notebook.model.sharedModel.insertCell(
        notebook.model.cells.length,
        cellData
      );

      // 立即生成该节点代码（无需等待 serverRoot 变更）
      (async () => {
        const root = serverRoot || (await new AiService().getServerRoot());
        updateCellSourceForNode(notebook, nodeId, root);
      })();
      // The refreshFlow will pick this up and create the node
    },
    [notebook, reactFlowInstance]
  );

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div
        className="reactflow-wrapper"
        style={{ flex: 1, height: '100%', position: 'relative' }}
        ref={reactFlowWrapper}
      >
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={handleEdgesChange}
            onEdgesDelete={onEdgesDelete}
            onNodesDelete={onNodesDelete}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onConnect={onConnect}
            onInit={instance => {
              setReactFlowInstance(instance);
              // 初始化视口为正常缩放
              if (instance && typeof instance.setViewport === 'function') {
                instance.setViewport({ x: 0, y: 0, zoom: 1 });
              }
            }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
      <div
        style={{
          width: '250px',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--jp-border-color2)',
          height: '100%'
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            borderBottom: '1px solid var(--jp-border-color2)'
          }}
        >
          <FlowSidebar />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <FlowPropertyPanel
            selectedNode={selectedNode}
            onChange={handlePropertyChange}
            serviceManager={
              serviceManager || (notebook as any).context?.manager
            }
          />
        </div>
      </div>
    </div>
  );
};
