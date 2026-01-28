import type { Environment } from './environment';

// Business owner color schemes for visual distinction
export const businessOwnerColors: Record<string, { bg: string; border: string; text: string }> = {
  fleet: { bg: 'rgba(59, 130, 246, 0.08)', border: '#3b82f6', text: '#3b82f6' },
  mowerbot: { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', text: '#10b981' },
  base: { bg: 'rgba(245, 158, 11, 0.08)', border: '#f59e0b', text: '#f59e0b' },
  bigData: { bg: 'rgba(139, 92, 246, 0.08)', border: '#8b5cf6', text: '#8b5cf6' },
  o2o: { bg: 'rgba(236, 72, 153, 0.08)', border: '#ec4899', text: '#ec4899' },
  SRE: { bg: 'rgba(239, 68, 68, 0.08)', border: '#ef4444', text: '#ef4444' },
  default: { bg: 'rgba(107, 114, 128, 0.08)', border: '#6b7280', text: '#6b7280' },
};

// Environment colors for visual distinction
export const environmentColors: Record<Environment, { bg: string; text: string }> = {
  dev: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  fra: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  release: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
};
