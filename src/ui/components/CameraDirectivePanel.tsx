import React from 'react';

// 15 种运镜指令
const CAMERA_DIRECTIVES = [
  { group: '左右移', items: ['左移', '右移'] },
  { group: '左右摇', items: ['左摇', '右摇'] },
  { group: '推拉', items: ['推进', '拉远'] },
  { group: '升降', items: ['上升', '下降'] },
  { group: '上下摇', items: ['上摇', '下摇'] },
  { group: '变焦', items: ['变焦推近', '变焦拉远'] },
  { group: '其他', items: ['晃动', '跟随', '固定'] },
];

interface CameraDirectivePanelProps {
  onInsert: (directive: string) => void;
  style?: React.CSSProperties;
}

export const CameraDirectivePanel: React.FC<CameraDirectivePanelProps> = ({ onInsert, style }) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div style={style}>
      <button
        className="btn btn-secondary"
        style={{ fontSize: '0.8rem' }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? '▲' : '▼'} 运镜指令
      </button>
      {expanded && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.75rem',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}>
          {CAMERA_DIRECTIVES.map(group => (
            <React.Fragment key={group.group}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: '100%', marginTop: '0.25rem' }}>
                {group.group}
              </span>
              {group.items.map(directive => (
                <button
                  key={directive}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => onInsert(directive)}
                  title={`插入 [${directive}]`}
                >
                  [{directive}]
                </button>
              ))}
            </React.Fragment>
          ))}
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.5rem 0 0 0', width: '100%' }}>
            组合运镜: [左摇,上升] · 顺序运镜: ...[推进], 然后...[拉远]
          </p>
        </div>
      )}
    </div>
  );
};
