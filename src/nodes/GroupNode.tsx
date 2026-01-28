import { memo } from 'react';
import { NodeResizer } from '@xyflow/react';
import type { GroupNodeProps } from './types';
import './GroupNode.css';

export const GroupNode = memo(function GroupNode({ data, selected }: GroupNodeProps) {
  return (
    <div className={`group-node ${selected ? 'group-node--selected' : ''}`}>
      <NodeResizer
        minWidth={280}
        minHeight={200}
        isVisible={selected}
        lineClassName="group-node__resizer-line"
        handleClassName="group-node__resizer-handle"
      />
      <div className="group-node__header">
        <span className="group-node__label">{data.businessOwner}</span>
        <span className="group-node__count">{data.childCount} 服务</span>
      </div>
    </div>
  );
});
