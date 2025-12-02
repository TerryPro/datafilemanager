import { useEffect, useState, useCallback, useRef } from 'react';
import { Node, Edge } from 'reactflow';
import { INodeData, INodeMetadata, IColumn } from '../types';
import { getTransformer } from '../transformers';
import { metadataService } from '../services/MetadataService';

// Graph helper to sort nodes topologically
const topologicalSort = (nodes: Node[], edges: Edge[]): Node[] => {
  const visited = new Set<string>();
  const sorted: Node[] = [];
  const visiting = new Set<string>(); // detect cycles

  const visit = (nodeId: string) => {
    if (visiting.has(nodeId)) {
      return;
    } // Cycle detected or processing
    if (visited.has(nodeId)) {
      return;
    }

    visiting.add(nodeId);

    // Find upstream nodes
    const incomingEdges = edges.filter(e => e.target === nodeId);
    for (const edge of incomingEdges) {
      visit(edge.source);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      sorted.push(node);
    }
  };

  nodes.forEach(node => visit(node.id));
  return sorted;
};

export const useColumnPropagation = (
  nodes: Node<INodeData>[],
  edges: Edge[],
  setNodes: (nodes: Node<INodeData>[]) => void
) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const processingRef = useRef(false);

  const propagate = useCallback(async () => {
    if (processingRef.current) {
      return;
    }
    processingRef.current = true;
    setIsCalculating(true);

    // 1. Topo Sort
    const sortedNodes = topologicalSort(nodes, edges);
    const metadataMap: Record<string, INodeMetadata> = {};

    // Initialize metadata map with existing (to preserve status if needed, but we recalculate)

    for (const node of sortedNodes) {
      const nodeId = node.id;
      const schema = node.data.schema;

      // Prepare Inputs
      const inputColumns: Record<string, IColumn[]> = {};

      // Find incoming edges
      const incomingEdges = edges.filter(e => e.target === nodeId);
      for (const edge of incomingEdges) {
        const sourceNodeId = edge.source;
        const sourcePort = edge.sourceHandle || 'df_out'; // default
        const targetPort = edge.targetHandle || 'df_in'; // default

        const sourceMeta = metadataMap[sourceNodeId];
        if (sourceMeta && sourceMeta.outputColumns[sourcePort]) {
          // Handle Merge: inputs might be array if multiple edges to same handle?
          // Usually ReactFlow handles are 1-to-many (source) or many-to-1 (target)?
          // For 'merge', we expect specific handles like 'left', 'right'.
          // If multiple edges go to same handle (rare for data flow), we might overwrite or union.
          // We overwrite for now.
          inputColumns[targetPort] = sourceMeta.outputColumns[sourcePort];
        }
      }

      // Calculate Outputs
      let outputColumns: Record<string, IColumn[]> = {};
      let status: INodeMetadata['status'] = 'ready';

      try {
        if (
          schema.category === 'source' ||
          schema.id === 'load_csv' ||
          schema.id === 'import_variable'
        ) {
          // Source Node Logic
          // We need to fetch from backend/kernel if not cached
          // For now, we trigger fetch if params changed.
          // But here we are in a calculation loop. We shouldn't do async fetch here blocking everything?
          // Ideally, source nodes fetch their data independently and update their own 'data.metadata'.
          // Here we just read what's available in node.data.metadata or fetch if needed?

          // Better approach: Source nodes manage their own output metadata via callbacks/effects in the Node component.
          // The propagator just reads it.

          // However, for this hook to be the "Central Brain", it should maybe handle it.
          // Let's check if node.data.metadata is already populated by the node itself?
          // If not, we try to calculate it.

          if (schema.id === 'load_csv') {
            const filepath = node.data.values?.['filepath'];
            // Check both node.data.timeIndex and node.data.values.timeIndex
            const timeIndex = node.data.timeIndex || node.data.values?.['timeIndex'];
            if (filepath) {
              // We can't await async here easily for all nodes in sequence without slowing UI.
              // But we need the columns for downstream.
              // Strategy: Use cached value. If missing, trigger fetch and return empty for now.
              // The fetch will update node data and trigger re-run.

              // Check if we have cached output in the CURRENT node data (from previous run)
              // or if we should fetch.
              // To avoid infinite loops, we only fetch if filepath changed?
              // Let's assume the MetadataService caches or we do it here.

              // For this implementation, we will do it async one by one.
              const cols = await metadataService.fetchCSVColumns(filepath);
              
              // If timeIndex is set, remove it from the output columns
              // because it will be used as index, not as a regular column
              let filteredCols = cols;
              const timeIndexValue = timeIndex?.trim();
              if (timeIndexValue) {
                filteredCols = cols.filter(col => {
                  // Use case-insensitive comparison to handle possible case differences
                  return col.name.toLowerCase() !== timeIndexValue.toLowerCase();
                });
              }
              
              outputColumns = { df_out: filteredCols };
            }
          } else if (schema.id === 'import_variable') {
            const varName = node.data.values?.['variable_name'];
            if (varName) {
              const cols = await metadataService.fetchVariableColumns(varName);
              outputColumns = { df_out: cols };
            }
          }
        } else {
          // Transformer Logic
          const transformer = getTransformer(schema.id);
          outputColumns = transformer(
            inputColumns,
            node.data.values || {},
            schema
          );
        }
      } catch (e) {
        console.error(`Error calculating metadata for node ${nodeId}`, e);
        status = 'error';
      }

      metadataMap[nodeId] = {
        inputColumns,
        outputColumns,
        status
      };
    }

    // Update Nodes with new metadata
    // We only call setNodes if something changed to avoid infinite loop
    let changed = false;
    const newNodes = nodes.map(node => {
      const newMeta = metadataMap[node.id];
      // Simple JSON stringify comparison (inefficient but works for small meta)
      if (JSON.stringify(node.data.metadata) !== JSON.stringify(newMeta)) {
        changed = true;
        return {
          ...node,
          data: {
            ...node.data,
            metadata: newMeta
          }
        };
      }
      return node;
    });

    if (changed) {
      setNodes(newNodes);
    }

    processingRef.current = false;
    setIsCalculating(false);
  }, [nodes, edges, setNodes]);

  // Debounce trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      propagate();
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [nodes, edges, propagate]); // Warning: 'nodes' in dependency array might cause loop if we setNodes inside.

  // To fix the loop:
  // We need to separate "structural/value changes" from "metadata changes".
  // If we put 'nodes' in dep array, and setNodes updates nodes, it triggers effect again.
  // We should depend on:
  // 1. edges (topology change)
  // 2. node.data.values (param change)
  // 3. node.data.schema (type change)
  // BUT NOT node.data.metadata

  // Implementing a custom compare or just relying on the JSON check inside propagate?
  // The problem is the useEffect triggers propagate().

  // Correct pattern:
  // The propagate function uses the *latest* nodes ref, but is triggered only by specific changes.

  return { isCalculating };
};
