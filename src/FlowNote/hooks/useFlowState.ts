import { useState, useCallback } from 'react';
import {
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeChange,
  applyNodeChanges,
  addEdge,
  Connection
} from 'reactflow';
import { NotebookPanel } from '@jupyterlab/notebook';
import { CellUpdater } from '../codegen';

export const useFlowState = (notebook: NotebookPanel, serverRoot: string) => {
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Handle node removal syncing with notebook
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

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      if (!notebook.model || !deletedNodes || deletedNodes.length === 0) {
        return;
      }
      const ids = new Set(deletedNodes.map(n => n.id));
      const cells = notebook.model.cells;
      for (let i = cells.length - 1; i >= 0; i--) {
        const cell = cells.get(i);
        const nid = cell.sharedModel.getMetadata('node_id') as string;
        if (nid && ids.has(nid)) {
          notebook.model.sharedModel.deleteCell(i);
        }
      }

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
    [notebook.model, setEdges]
  );

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
        if (params.target) {
          new CellUpdater(notebook, serverRoot).updateCellForNode(String(params.target));
          // Update target node status
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
    [notebook.model, setEdges, setNodes, serverRoot]
  );

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

      removes.forEach((r: any) => {
        const tgt = r?.edge?.target || undefined;
        if (tgt) {
          new CellUpdater(notebook, serverRoot).updateCellForNode(String(tgt));
          // Update target node status
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
    [onEdgesChange, notebook.model, serverRoot, setNodes]
  );

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
      deleted.forEach(d => {
        new CellUpdater(notebook, serverRoot).updateCellForNode(String(d.target));
        // Update target node status
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
    [notebook.model, serverRoot, setNodes]
  );

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    onNodesChange,
    onNodesDelete,
    onConnect,
    handleEdgesChange,
    onEdgesDelete,
    selectedNodeId,
    setSelectedNodeId
  };
};
