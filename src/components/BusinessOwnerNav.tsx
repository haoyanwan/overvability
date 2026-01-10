import { useReactFlow } from '@xyflow/react';
import './BusinessOwnerNav.css';

interface BusinessOwnerNavProps {
  owners: string[];
}

export function BusinessOwnerNav({ owners }: BusinessOwnerNavProps) {
  const { setCenter, getNode } = useReactFlow();

  const panToGroup = (owner: string) => {
    const node = getNode(`group-${owner}`);
    if (node) {
      const width = (node.measured?.width ?? node.width ?? 300) as number;
      const height = (node.measured?.height ?? node.height ?? 200) as number;
      const x = node.position.x + width / 2;
      const y = node.position.y + height / 2;
      setCenter(x, y, { zoom: 1, duration: 500 });
    }
  };

  if (owners.length === 0) return null;

  return (
    <div className="business-owner-nav">
      <div className="business-owner-nav__title">业务方</div>
      {owners.map(owner => (
        <button
          key={owner}
          className="business-owner-nav__btn"
          onClick={() => panToGroup(owner)}
        >
          {owner}
        </button>
      ))}
    </div>
  );
}
