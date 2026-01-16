import { useEnvironment, VALID_ENVIRONMENTS } from '../context/EnvironmentContext';
import { environmentColors } from '../types/nodes';
import './EnvironmentSelector.css';

export function EnvironmentSelector() {
  const { environment, setEnvironment } = useEnvironment();

  return (
    <div className="environment-selector">
      {VALID_ENVIRONMENTS.map((env) => (
        <button
          key={env}
          className={`environment-selector__button ${environment === env ? 'environment-selector__button--active' : ''}`}
          onClick={() => setEnvironment(env)}
          style={{
            '--env-color': environmentColors[env].text,
            '--env-bg': environmentColors[env].bg,
          } as React.CSSProperties}
        >
          <span className="environment-selector__indicator" />
          <span className="environment-selector__label">
            {env}
          </span>
        </button>
      ))}
    </div>
  );
}
