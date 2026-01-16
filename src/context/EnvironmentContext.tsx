import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Environment = 'fra' | 'dev' | 'release';

export const VALID_ENVIRONMENTS: Environment[] = ['fra', 'dev', 'release'];
export const DEFAULT_ENVIRONMENT: Environment = 'dev';

interface EnvironmentContextValue {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
  isValidEnvironment: (env: string) => env is Environment;
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null);

function isValidEnvironment(env: string): env is Environment {
  return VALID_ENVIRONMENTS.includes(env as Environment);
}

function getEnvironmentFromUrl(): Environment {
  const params = new URLSearchParams(window.location.search);
  const envParam = params.get('env');
  if (envParam && isValidEnvironment(envParam)) {
    return envParam;
  }
  return DEFAULT_ENVIRONMENT;
}

function updateUrlEnvironment(env: Environment): void {
  const url = new URL(window.location.href);
  url.searchParams.set('env', env);
  window.history.replaceState({}, '', url.toString());
}

interface EnvironmentProviderProps {
  children: ReactNode;
}

export function EnvironmentProvider({ children }: EnvironmentProviderProps) {
  const [environment, setEnvironmentState] = useState<Environment>(() => getEnvironmentFromUrl());

  // Update URL when environment changes
  const setEnvironment = useCallback((env: Environment) => {
    if (isValidEnvironment(env)) {
      setEnvironmentState(env);
      updateUrlEnvironment(env);
    }
  }, []);

  // Initialize URL on mount if not set
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('env')) {
      updateUrlEnvironment(environment);
    }
  }, [environment]);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const newEnv = getEnvironmentFromUrl();
      setEnvironmentState(newEnv);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const value: EnvironmentContextValue = {
    environment,
    setEnvironment,
    isValidEnvironment,
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment(): EnvironmentContextValue {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
}
