import { NODE_TYPES, type NodeType } from '../types';
import { javaProcessLabels } from '../types';
import { JavaProcessNode } from './JavaProcessNode';
import { GroupNode } from './GroupNode';

// Single source of truth for node component registration
export const nodeComponents = {
  [NODE_TYPES.JAVA_PROCESS]: JavaProcessNode,
  [NODE_TYPES.GROUP]: GroupNode,
};

// Node configuration for sidebar and other UI
export interface NodeConfig {
  title: string;
  labels: Record<string, string>;
  isSelectable: boolean;
}

export const nodeConfigs: Record<NodeType, NodeConfig> = {
  [NODE_TYPES.JAVA_PROCESS]: {
    title: '服务详情',
    labels: javaProcessLabels,
    isSelectable: true,
  },
  [NODE_TYPES.GROUP]: {
    title: '分组',
    labels: {},
    isSelectable: false,
  },
};

// Re-export node components for convenience
export { JavaProcessNode } from './JavaProcessNode';
export { GroupNode } from './GroupNode';
