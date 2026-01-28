import type { JavaProcessNodeData, GroupNodeData } from '../types';

// Props for JavaProcess node component
export interface JavaProcessNodeProps {
  data: JavaProcessNodeData;
  selected?: boolean;
}

// Props for Group node component (used with ReactFlow's custom nodes)
export interface GroupNodeProps {
  data: GroupNodeData;
  selected?: boolean;
}
