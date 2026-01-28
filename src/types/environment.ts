// Environment types - single source of truth
export type Environment = 'fra' | 'dev' | 'release';

export const VALID_ENVIRONMENTS: Environment[] = ['fra', 'dev', 'release'];
export const DEFAULT_ENVIRONMENT: Environment = 'dev';

// Environment mapping by resource group (expandable)
export const environmentMap: Record<string, Environment> = {
  'NINEBOT-WILLAND': 'fra',
  // Add more mappings as needed:
  // 'NINEBOT-DEV': 'dev',
  // 'NINEBOT-RELEASE': 'release',
};

// Get environment from resource group
export function getEnvironment(resourceGroup: string): Environment {
  return environmentMap[resourceGroup.toUpperCase()] || DEFAULT_ENVIRONMENT;
}

// Type guard for environment validation
export function isValidEnvironment(env: string): env is Environment {
  return VALID_ENVIRONMENTS.includes(env as Environment);
}
