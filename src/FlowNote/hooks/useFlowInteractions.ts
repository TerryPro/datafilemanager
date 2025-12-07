import { useCallback } from 'react';
import { Node, ReactFlowInstance } from 'reactflow';
import { NotebookPanel } from '@jupyterlab/notebook';
import { UUID } from '@lumino/coreutils';
import * as nbformat from '@jupyterlab/nbformat';
import { AiService } from '../../services/ai-service';
import { CellUpdater } from '../codegen';

export const useFlowInteractions = (
  notebook: NotebookPanel,
  reactFlowWrapper: React.RefObject<HTMLDivElement>,
  reactFlowInstance: ReactFlowInstance | null,
  setReactFlowInstance: (instance: ReactFlowInstance | null) => void,
  nodes: Node[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  setSelectedNodeId: (id: string | null) => void,
  serverRoot: string
) => {
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
    [reactFlowInstance, reactFlowWrapper]
  );

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

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
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
          centerCellInView(i);
          break;
        }
      }
    },
    [notebook, centerNodeInView, centerCellInView, setSelectedNodeId]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
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

      const defaultCode = `# ${
        schema.name || 'New Step'
      }\n# Add your code here\n`;

      const cellData: nbformat.ICodeCell = {
        cell_type: 'code',
        source: defaultCode,
        metadata: {
          node_id: nodeId,
          flow_position: position,
          flow_schema: schema,
          flow_values: {}
        },
        outputs: [],
        execution_count: null
      };

      notebook.model.sharedModel.insertCell(
        notebook.model.cells.length,
        cellData
      );

      (async () => {
        const root = serverRoot || (await new AiService().getServerRoot());
        new CellUpdater(notebook, root).updateCellForNode(nodeId);
      })();
    },
    [notebook, reactFlowInstance, reactFlowWrapper, serverRoot]
  );

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!notebook.model) {
        return;
      }
      const cells = notebook.model.cells;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells.get(i);
        if ((cell.sharedModel.getMetadata('node_id') as string) === node.id) {
          cell.sharedModel.setMetadata('flow_position', node.position as any);
          break;
        }
      }
    },
    [notebook]
  );

  return {
    centerNodeInView,
    centerCellInView,
    onNodeClick,
    onDragOver,
    onDrop,
    onNodeDragStop
  };
};
