// Node type constants - single source of truth for node type strings
export const NODE_TYPES = {
  JAVA_PROCESS: 'javaProcess',
  GROUP: 'group',
} as const;

export type NodeType = typeof NODE_TYPES[keyof typeof NODE_TYPES];

// Type guard functions for node type checking
export function isGroupNode(type: string | undefined): boolean {
  return type === NODE_TYPES.GROUP;
}

export function isJavaProcessNode(type: string | undefined): boolean {
  return type === NODE_TYPES.JAVA_PROCESS;
}
