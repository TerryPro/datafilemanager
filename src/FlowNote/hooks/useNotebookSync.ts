import { useCallback, useEffect } from 'react';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ICellModel } from '@jupyterlab/cells';
import { UUID } from '@lumino/coreutils';
import { Node, Edge, MarkerType } from 'reactflow';
import { AiService } from '../../services/ai-service';
import { updateCellSourceForNode } from '../services/CodeGenerator';

// 辅助函数：提取列信息
async function extractColumns(
  notebook: NotebookPanel,
  cellModel: ICellModel,
  nodeId: string
) {
  if (!notebook.sessionContext.session?.kernel) {
    return;
  }
  const outVars =
    (cellModel.sharedModel.getMetadata('flow_output_vars') as Record<
      string,
      string
    >) || {};
  console.log('FlowNote: extractColumns', nodeId, outVars);
  const varNames = Object.values(outVars).filter(v => v && !v.startsWith('_'));
  if (varNames.length === 0) {
    console.log('FlowNote: No output vars to extract');
    return;
  }

  const code = `
import json
try:
    import pandas as pd
except ImportError:
    print(json.dumps({}))
else:
    _flow_cols = {}
    _ctx = globals()
    for v in ${JSON.stringify(varNames)}:
        if v in _ctx:
            val = _ctx[v]
            if isinstance(val, pd.DataFrame):
                try:
                    _flow_cols[v] = [{"name": str(c), "type": str(val[c].dtype)} for c in val.columns]
                except:
                    pass
    print(json.dumps(_flow_cols))
    del _flow_cols
    del _ctx
`;

  try {
    const future = notebook.sessionContext.session.kernel.requestExecute({
      code
    });
    let output = '';
    future.onIOPub = msg => {
      const t = (msg as any).header.msg_type;
      const c = (msg as any).content;
      if (t === 'stream' && c.name === 'stdout') {
        output += c.text as string;
      } else if (
        (t === 'execute_result' || t === 'display_data') &&
        c.data &&
        c.data['text/plain']
      ) {
        output += c.data['text/plain'] as string;
      }
    };
    await future.done;

    if (output) {
      try {
        console.log('FlowNote: Kernel output', output);
        const colsMap = JSON.parse(output);
        // 映射回端口名
        const outputColumns: Record<string, any[]> = {};
        console.log('FlowNote: colsMap received from kernel:', colsMap);
        Object.entries(outVars).forEach(([port, varName]) => {
          if (colsMap[varName]) {
            outputColumns[port] = colsMap[varName];
          }
        });
        console.log('FlowNote: Mapped outputColumns:', outputColumns);

        // 只有当列信息发生变化时才更新，避免死循环
        const current = cellModel.sharedModel.getMetadata(
          'flow_output_columns'
        );
        if (JSON.stringify(current) !== JSON.stringify(outputColumns)) {
          cellModel.sharedModel.setMetadata(
            'flow_output_columns',
            outputColumns
          );
        }
      } catch (e) {
        console.error('FlowNote: Failed to parse columns', e);
      }
    }
  } catch (e) {
    console.error('FlowNote: Failed to extract columns', e);
  }
}

export const useNotebookSync = (
  notebook: NotebookPanel,
  serverRoot: string,
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  handleSelectAlgorithm: (nodeId: string, schema: any) => void,
  handleRunNode: (nodeId: string) => void,
  serviceManager?: any
) => {
  // Define refreshFlow first to use in extractColumns
  const refreshFlow = useCallback(() => {
    if (!notebook || !notebook.model || notebook.isDisposed) {
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    console.log('FlowNote: refreshFlow called', notebook.model?.cells.length);

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
      // 计算输入列信息和输入变量
      const inputColumns: Record<string, any[]> = {};
      const inputVariables: Record<string, string> = {};
      try {
        const metaEdges =
          (notebook.model?.sharedModel.getMetadata('flow_edges') as any[]) ||
          [];
        const myEdges = metaEdges.filter(
          (e: any) =>
            e.targetId ===
            (cellModel.sharedModel.getMetadata('node_id') as string)
        );

        myEdges.forEach((e: any) => {
          // 找到源节点
          for (let j = 0; j < cells.length; j++) {
            const srcCell = cells.get(j);
            if (
              (srcCell.sharedModel.getMetadata('node_id') as string) ===
              e.sourceId
            ) {
              // Columns
              const srcCols =
                (srcCell.sharedModel.getMetadata(
                  'flow_output_columns'
                ) as Record<string, any[]>) || {};

              console.log(
                `FlowNote: checking source ${e.sourceId} port ${e.sourcePort} for target ${e.targetId} port ${e.targetPort}`
              );
              console.log('FlowNote: srcCols:', srcCols);

              if (srcCols[e.sourcePort]) {
                // 如果目标端口已存在，则合并（通常一个端口只有一个输入，但为了健壮性）
                inputColumns[e.targetPort] = [
                  ...(inputColumns[e.targetPort] || []),
                  ...srcCols[e.sourcePort]
                ];
              }

              // Variables
              const srcVars =
                (srcCell.sharedModel.getMetadata('flow_output_vars') as Record<
                  string,
                  string
                >) || {};
              if (srcVars[e.sourcePort]) {
                inputVariables[e.targetPort] = srcVars[e.sourcePort];
              }

              break;
            }
          }
        });
      } catch (err) {
        console.error('FlowNote: Error calculating input columns', err);
      }

      const node = createNodeFromCell(
        cellModel,
        i,
        inputColumns,
        inputVariables
      );
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
  }, [notebook, setNodes, setEdges]);

  const createNodeFromCell = useCallback(
    (
      cellModel: ICellModel,
      index: number,
      inputColumns: Record<string, any[]> = {},
      inputVariables: Record<string, string> = {}
    ): Node => {
      // Ensure node_id exists using sharedModel for consistency
      let nodeId =
        (cellModel.sharedModel.getMetadata('node_id') as string) || '';

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
      const metaSchema = cellModel.sharedModel.getMetadata(
        'flow_schema'
      ) as any;
      const metaValues = cellModel.sharedModel.getMetadata(
        'flow_values'
      ) as any;

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
          inputVariables,
          onSelectAlgorithm: handleSelectAlgorithm,
          serviceManager: sm,
          metadata: {
            status,
            inputColumns
          },
          onRunNode: handleRunNode,
          onValuesChange: async (
            nid: string,
            newValues: Record<string, any>
          ) => {
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
    },
    [notebook, serverRoot, handleSelectAlgorithm, handleRunNode, serviceManager]
  );

  // Update refreshFlow dependency to include createNodeFromCell
  const refreshFlowWithCreateNode = useCallback(() => {
    refreshFlow();
  }, [refreshFlow]);

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

  useEffect(() => {
    refreshFlowWithCreateNode();

    const onCellStateChanged = (sender: any, args: any) => {
      if (args.name === 'executionCount' && args.newValue) {
        const nodeId = sender.sharedModel.getMetadata('node_id') as string;
        console.log('FlowNote: executionCount changed', nodeId, args.newValue);
        if (nodeId) {
          extractColumns(notebook, sender, nodeId).then(() => {
            // Refresh flow after extracting columns to update target nodes' input columns
            refreshFlowWithCreateNode();
          });
        }
      }
    };

    const onCellsChanged = (sender: any, args: any) => {
      refreshFlow();
      if (args.type === 'add') {
        args.newValues.forEach((cell: ICellModel) => {
          cell.stateChanged.connect(onCellStateChanged);
        });
      }
    };

    const onContentChanged = () => {
      // Cell content changed (e.g. text edit), need to update labels
      refreshFlow();
    };

    if (notebook.model) {
      notebook.model.cells.changed.connect(onCellsChanged);
      notebook.model.contentChanged.connect(onContentChanged);

      // 监听执行计数变化以触发列提取
      const cells = notebook.model.cells;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells.get(i);
        cell.stateChanged.connect(onCellStateChanged);
      }
    }

    return () => {
      if (notebook && notebook.model) {
        notebook.model.cells.changed.disconnect(onCellsChanged);
        notebook.model.contentChanged.disconnect(onContentChanged);
        // Clean up cell listeners? It's hard to track all of them here without keeping a list.
        // But since the component unmounts, the signals might be cleared by the model disposal if the notebook closes.
        // For strict correctness we should track them, but for now let's rely on notebook disposal or ignore minor leak in this hook scope.
      }
    };
  }, [notebook, refreshFlowWithCreateNode]);

  return {
    refreshFlow: refreshFlowWithCreateNode
  };
};
