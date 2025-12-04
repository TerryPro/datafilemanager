import { useCallback } from 'react';
import { NotebookPanel, NotebookActions } from '@jupyterlab/notebook';
import { AiService } from '../../services/ai-service';
import { updateCellSourceForNode } from '../services/CodeGenerator';

export const useFlowActions = (
  notebook: NotebookPanel,
  serverRoot: string,
  setNodes: React.Dispatch<React.SetStateAction<any[]>>,
  refreshFlow: () => void
) => {
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
    [notebook.model, setNodes]
  );

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

  return {
    handleSelectAlgorithm,
    handleRunNode,
    handlePropertyChange
  };
};
