import { ReactFlow, Background, Controls, applyEdgeChanges, applyNodeChanges, addEdge, MarkerType, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import { useState, useCallback, useEffect } from 'react';
import { JavaProcessNode } from './nodes/JavaProcessNode';
import { Sidebar } from './components/Sidebar';
import { LayoutControls } from './components/LayoutControls';
import { LoadingOverlay } from './components/LoadingOverlay';
import type { VmMetrics, VmInfo } from './types/nodes';

const nodeTypes = {
  javaProcess: JavaProcessNode,
};

// Polling intervals
const VM_POLL_INTERVAL = 30 * 60 * 1000; // 30 minutes
const METRICS_POLL_INTERVAL = 30 * 1000; // 30 seconds

export default function App() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<{ id: string; source: string; target: string }[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );

  const onEdgesChange = useCallback(
    (changes: any) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );

  const onConnect = useCallback(
    (params: any) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const saveLayout = useCallback(async () => {
    const layout = {
      nodes: nodes.map(node => ({
        id: node.id,
        position: node.position,
      })),
      edges: edges,
    };
    await fetch('http://localhost:5000/api/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout),
    });
  }, [nodes, edges]);

  const resetLayout = useCallback(async () => {
    setNodes([]);
    setEdges([]);
    await fetch('http://localhost:5000/api/layout', { method: 'DELETE' });
  }, []);

  // Fetch metrics from the backend (GET request, reads from TinyDB)
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/metrics');
      if (!response.ok) return;
      const metricsMap: Record<string, VmMetrics> = await response.json();

      setNodes(currentNodes => {
        return currentNodes.map(node => {
          const vms = (node.data?.vms as VmInfo[]) || [];
          const updatedVms = vms.map(vm => {
            const metrics = metricsMap[vm.ip];
            return metrics ? { ...vm, metrics } : vm;
          });
          return {
            ...node,
            data: {
              ...node.data,
              vms: updatedVms,
            },
          };
        });
      });

      setSelectedNode(current => {
        if (!current) return null;
        const vms = (current.data?.vms as VmInfo[]) || [];
        const updatedVms = vms.map(vm => {
          const metrics = metricsMap[vm.ip];
          return metrics ? { ...vm, metrics } : vm;
        });
        return {
          ...current,
          data: {
            ...current.data,
            vms: updatedVms,
          },
        };
      });
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  }, []);

  // Fetch VM data from the backend
  const fetchVmData = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/vms');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();

      setNodes(currentNodes => {
        return data.services.map((service: any, index: number) => {
          const existingNode = currentNodes.find(n => n.id === service.service);

          return {
            id: service.service,
            position: existingNode?.position ?? { x: (index % 3) * 350, y: Math.floor(index / 3) * 300 },
            data: {
              service: service.service,
              businessOwner: service.businessOwner,
              status: service.vms.every((vm: any) => vm.status === 'running') ? 'healthy' : 'unhealthy',
              vms: service.vms,
            },
            type: 'javaProcess',
          };
        });
      });
    } catch (error) {
      console.error('Failed to fetch VM data:', error);
    }
  }, []);

  // Manual refresh: fetch both VM data and metrics
  const refreshData = useCallback(async () => {
    await fetchVmData();
    await fetchMetrics();
  }, [fetchVmData, fetchMetrics]);

  useEffect(() => {
    let vmPollTimer: ReturnType<typeof setInterval> | null = null;
    let metricsPollTimer: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const init = async () => {
      // Fetch saved layout first
      let savedLayout: { nodes?: { id: string; position: { x: number; y: number } }[]; edges?: any[] } | null = null;
      try {
        const res = await fetch('http://localhost:5000/api/layout');
        const layout = await res.json();
        if (layout.nodes || layout.edges) {
          savedLayout = layout;
        }
      } catch {
        // Ignore errors
      }

      // Initial data fetch
      try {
        const response = await fetch('http://localhost:5000/api/vms');
        if (!response.ok) throw new Error('Failed to fetch VM data');
        const data = await response.json();

        if (!isMounted) return;

        // Create nodes from VM data
        let newNodes = data.services.map((service: any, index: number) => ({
          id: service.service,
          position: { x: (index % 3) * 350, y: Math.floor(index / 3) * 300 },
          data: {
            service: service.service,
            businessOwner: service.businessOwner,
            status: service.vms.every((vm: any) => vm.status === 'running') ? 'healthy' : 'unhealthy',
            vms: service.vms,
          },
          type: 'javaProcess',
        }));

        // Restore saved layout positions
        if (savedLayout) {
          console.log('Restoring saved layout');
          if (savedLayout.nodes) {
            newNodes = newNodes.map((node: Node) => {
              const savedNode = savedLayout!.nodes!.find(n => n.id === node.id);
              return savedNode ? { ...node, position: savedNode.position } : node;
            });
          }
          if (savedLayout.edges) {
            setEdges(savedLayout.edges);
          }
        }

        setNodes(newNodes);
      } catch (error) {
        console.error('Failed to fetch initial VM data:', error);
      }

      // Fetch initial metrics
      try {
        const metricsResponse = await fetch('http://localhost:5000/api/metrics');
        if (metricsResponse.ok && isMounted) {
          const metricsMap: Record<string, VmMetrics> = await metricsResponse.json();
          setNodes(currentNodes => {
            return currentNodes.map(node => {
              const vms = (node.data?.vms as VmInfo[]) || [];
              const updatedVms = vms.map(vm => {
                const metrics = metricsMap[vm.ip];
                return metrics ? { ...vm, metrics } : vm;
              });
              return { ...node, data: { ...node.data, vms: updatedVms } };
            });
          });
        }
      } catch (error) {
        console.error('Failed to fetch initial metrics:', error);
      }

      if (isMounted) {
        setIsLoading(false);
      }

      // Start polling timers
      vmPollTimer = setInterval(async () => {
        if (!isMounted) return;
        try {
          const response = await fetch('http://localhost:5000/api/vms');
          if (!response.ok) return;
          const data = await response.json();

          setNodes(currentNodes => {
            return data.services.map((service: any, index: number) => {
              const existingNode = currentNodes.find(n => n.id === service.service);
              return {
                id: service.service,
                position: existingNode?.position ?? { x: (index % 3) * 350, y: Math.floor(index / 3) * 300 },
                data: {
                  service: service.service,
                  businessOwner: service.businessOwner,
                  status: service.vms.every((vm: any) => vm.status === 'running') ? 'healthy' : 'unhealthy',
                  vms: service.vms,
                },
                type: 'javaProcess',
              };
            });
          });
        } catch (error) {
          console.error('Failed to poll VM data:', error);
        }
      }, VM_POLL_INTERVAL);

      metricsPollTimer = setInterval(async () => {
        if (!isMounted) return;
        try {
          const response = await fetch('http://localhost:5000/api/metrics');
          if (!response.ok) return;
          const metricsMap: Record<string, VmMetrics> = await response.json();

          setNodes(currentNodes => {
            return currentNodes.map(node => {
              const vms = (node.data?.vms as VmInfo[]) || [];
              const updatedVms = vms.map(vm => {
                const metrics = metricsMap[vm.ip];
                return metrics ? { ...vm, metrics } : vm;
              });
              return { ...node, data: { ...node.data, vms: updatedVms } };
            });
          });

          setSelectedNode(current => {
            if (!current) return null;
            const vms = (current.data?.vms as VmInfo[]) || [];
            const updatedVms = vms.map(vm => {
              const metrics = metricsMap[vm.ip];
              return metrics ? { ...vm, metrics } : vm;
            });
            return { ...current, data: { ...current.data, vms: updatedVms } };
          });
        } catch (error) {
          console.error('Failed to poll metrics:', error);
        }
      }, METRICS_POLL_INTERVAL);
    };

    init();

    return () => {
      isMounted = false;
      if (vmPollTimer) clearInterval(vmPollTimer);
      if (metricsPollTimer) clearInterval(metricsPollTimer);
    };
  }, []);

  return (
    <div className="react-flow-container">
      {isLoading && <LoadingOverlay />}
      <LayoutControls onSave={saveLayout} onReset={resetLayout} onRefresh={refreshData} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        }}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
      <Sidebar node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}