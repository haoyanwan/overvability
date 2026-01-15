import { ReactFlow, ReactFlowProvider, Background, Controls, applyEdgeChanges, applyNodeChanges, addEdge, MarkerType, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { JavaProcessNode } from './nodes/JavaProcessNode';
import { GroupNode } from './nodes/GroupNode';
import { Sidebar } from './components/Sidebar';
import { LoadingOverlay } from './components/LoadingOverlay';
import { LeftNavPanel } from './components/LeftNavPanel';
import type { VmMetrics, VmInfo, GroupNodeData } from './types/nodes';

const nodeTypes = {
  javaProcess: JavaProcessNode,
  group: GroupNode,
};

const API_BASE = '';
const VM_POLL_INTERVAL = 30 * 60 * 1000;
const METRICS_POLL_INTERVAL = 30 * 1000;

interface SavedLayout {
  nodes?: { id: string; position: { x: number; y: number }; width?: number; height?: number }[];
  edges?: { id: string; source: string; target: string }[];
}

function createNodesWithGroups(services: any[], savedLayout?: SavedLayout): Node[] {
  const servicesByOwner: Record<string, any[]> = {};
  for (const service of services) {
    const owner = service.businessOwner || 'default';
    if (!servicesByOwner[owner]) {
      servicesByOwner[owner] = [];
    }
    servicesByOwner[owner].push(service);
  }

  const allNodes: Node[] = [];

  for (const owner of Object.keys(servicesByOwner)) {
    const ownerServices = servicesByOwner[owner];
    const groupId = `group-${owner}`;
    const savedGroup = savedLayout?.nodes?.find(n => n.id === groupId);

    allNodes.push({
      id: groupId,
      type: 'group',
      position: savedGroup?.position || { x: 0, y: 0 },
      data: {
        businessOwner: owner,
        label: owner,
        childCount: ownerServices.length,
      } as GroupNodeData,
      style: {
        width: savedGroup?.width,
        height: savedGroup?.height,
      },
      draggable: true,
    });

    for (const service of ownerServices) {
      const nodeId = service.service;
      const savedNode = savedLayout?.nodes?.find(n => n.id === nodeId);

      allNodes.push({
        id: nodeId,
        type: 'javaProcess',
        position: savedNode?.position || { x: 0, y: 0 },
        parentId: groupId,
        extent: 'parent',
        data: {
          service: service.service,
          businessOwner: service.businessOwner,
          status: service.vms.every((vm: any) => vm.status === 'running') ? 'healthy' : 'unhealthy',
          vms: service.vms,
        },
        draggable: true,
      });
    }
  }

  return allNodes;
}

function applyMetricsToNodes(nodes: Node[], metricsMap: Record<string, VmMetrics>): Node[] {
  return nodes.map(node => {
    if (node.type === 'group') return node;
    const vms = (node.data?.vms as VmInfo[]) || [];
    const updatedVms = vms.map(vm => {
      const metrics = metricsMap[vm.ip];
      return metrics ? { ...vm, metrics } : vm;
    });
    return { ...node, data: { ...node.data, vms: updatedVms } };
  });
}

export default function App() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<{ id: string; source: string; target: string }[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const onNodesChange = useCallback(
    (changes: any) => setNodes(nds => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange = useCallback(
    (changes: any) => setEdges(eds => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect = useCallback(
    (params: any) => setEdges(eds => addEdge(params, eds)),
    [],
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type !== 'group') {
      setSelectedNode(node);
    }
  }, []);

  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const saveLayout = useCallback(async () => {
    const layout = {
      nodes: nodes.map(node => ({
        id: node.id,
        position: node.position,
        ...(node.type === 'group' ? {
          width: node.measured?.width ?? node.width ?? node.style?.width,
          height: node.measured?.height ?? node.height ?? node.style?.height,
        } : {}),
      })),
      edges,
    };
    await fetch(`${API_BASE}/api/layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout),
    });
  }, [nodes, edges]);

  const resetLayout = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/layout`);
      const savedLayout: SavedLayout = await res.json();

      if (savedLayout.nodes) {
        setNodes(currentNodes => currentNodes.map(node => {
          const saved = savedLayout.nodes!.find(n => n.id === node.id);
          if (!saved) return node;
          return {
            ...node,
            position: saved.position,
            ...(node.type === 'group' && saved.width && saved.height ? {
              style: { ...node.style, width: saved.width, height: saved.height },
            } : {}),
          };
        }));
      }
      if (savedLayout.edges) {
        setEdges(savedLayout.edges);
      }
    } catch (error) {
      console.error('Failed to load saved layout:', error);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/metrics`);
      if (!response.ok) return;
      const metricsMap: Record<string, VmMetrics> = await response.json();

      setNodes(currentNodes => applyMetricsToNodes(currentNodes, metricsMap));
      setSelectedNode(current => {
        if (!current || current.type === 'group') return current;
        const vms = (current.data?.vms as VmInfo[]) || [];
        const updatedVms = vms.map(vm => metricsMap[vm.ip] ? { ...vm, metrics: metricsMap[vm.ip] } : vm);
        return { ...current, data: { ...current.data, vms: updatedVms } };
      });
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [layoutRes, vmsRes] = await Promise.all([
        fetch(`${API_BASE}/api/layout`),
        fetch(`${API_BASE}/api/vms`),
      ]);

      const savedLayout: SavedLayout = layoutRes.ok ? await layoutRes.json() : {};
      const vmsData = vmsRes.ok ? await vmsRes.json() : { services: [] };

      setNodes(createNodesWithGroups(vmsData.services, savedLayout));
      if (savedLayout.edges) {
        setEdges(savedLayout.edges);
      }

      await fetchMetrics();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [fetchMetrics]);

  useEffect(() => {
    let vmPollTimer: ReturnType<typeof setInterval> | null = null;
    let metricsPollTimer: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const init = async () => {
      try {
        const [layoutRes, vmsRes, metricsRes] = await Promise.all([
          fetch(`${API_BASE}/api/layout`),
          fetch(`${API_BASE}/api/vms`),
          fetch(`${API_BASE}/api/metrics`),
        ]);

        if (!isMounted) return;

        const savedLayout: SavedLayout = layoutRes.ok ? await layoutRes.json() : {};
        const vmsData = vmsRes.ok ? await vmsRes.json() : { services: [] };
        const metricsMap: Record<string, VmMetrics> = metricsRes.ok ? await metricsRes.json() : {};

        let newNodes = createNodesWithGroups(vmsData.services, savedLayout);
        newNodes = applyMetricsToNodes(newNodes, metricsMap);

        setNodes(newNodes);
        if (savedLayout.edges) {
          setEdges(savedLayout.edges);
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }

      vmPollTimer = setInterval(async () => {
        if (!isMounted) return;
        try {
          const [layoutRes, vmsRes] = await Promise.all([
            fetch(`${API_BASE}/api/layout`),
            fetch(`${API_BASE}/api/vms`),
          ]);
          const savedLayout: SavedLayout = layoutRes.ok ? await layoutRes.json() : {};
          const vmsData = vmsRes.ok ? await vmsRes.json() : { services: [] };
          setNodes(createNodesWithGroups(vmsData.services, savedLayout));
        } catch (error) {
          console.error('Failed to poll VM data:', error);
        }
      }, VM_POLL_INTERVAL);

      metricsPollTimer = setInterval(async () => {
        if (!isMounted) return;
        try {
          const response = await fetch(`${API_BASE}/api/metrics`);
          if (!response.ok) return;
          const metricsMap: Record<string, VmMetrics> = await response.json();
          setNodes(currentNodes => applyMetricsToNodes(currentNodes, metricsMap));
          setSelectedNode(current => {
            if (!current || current.type === 'group') return current;
            const vms = (current.data?.vms as VmInfo[]) || [];
            const updatedVms = vms.map(vm => metricsMap[vm.ip] ? { ...vm, metrics: metricsMap[vm.ip] } : vm);
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

  const businessOwners = useMemo(() => {
    return nodes
      .filter(node => node.type === 'group')
      .map(node => (node.data as GroupNodeData).businessOwner);
  }, [nodes]);

  return (
    <ReactFlowProvider>
      <div className="app-layout">
        {isLoading && <LoadingOverlay />}
        <LeftNavPanel
          owners={businessOwners}
          onSave={saveLayout}
          onReset={resetLayout}
          onRefresh={refreshData}
        />
        <div className="react-flow-container">
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
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
          <Sidebar node={selectedNode} onClose={() => setSelectedNode(null)} />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
