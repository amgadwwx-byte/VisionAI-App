
import React from 'react';
import { Layer } from '../types';

interface LayerItemProps {
  layer: Layer;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Layer>) => void;
}

const LayerItem: React.FC<LayerItemProps> = ({ layer, isSelected, onSelect, onUpdate }) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
    opacity: layer.opacity,
    cursor: 'move',
    userSelect: 'none',
    border: isSelected ? '2px solid #3b82f6' : 'none',
    zIndex: isSelected ? 50 : 10,
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(layer.id);
  };

  const getTextStyle = () => {
    let effectStyle: React.CSSProperties = {
      fontSize: `${layer.fontSize}px`,
      color: layer.color,
      fontFamily: layer.fontFamily,
      textAlign: 'center',
    };

    switch (layer.effect) {
      case 'neon':
        effectStyle.textShadow = `0 0 5px #fff, 0 0 10px #fff, 0 0 15px ${layer.color}, 0 0 20px ${layer.color}`;
        break;
      case 'glow':
        effectStyle.filter = 'drop-shadow(0 0 8px currentColor)';
        break;
      case 'shadow':
        effectStyle.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        break;
      case 'gradient':
        // Complex gradient text is tricky with CSS alone on absolute text, but we can try
        effectStyle.backgroundImage = `linear-gradient(to bottom, ${layer.color}, #ffffff)`;
        effectStyle.WebkitBackgroundClip = 'text';
        effectStyle.WebkitTextFillColor = 'transparent';
        break;
    }

    return effectStyle;
  };

  return (
    <div 
      style={style} 
      onMouseDown={handleMouseDown}
      className="transition-shadow duration-200"
    >
      {layer.type === 'image' ? (
        <img 
          src={layer.content} 
          alt="Layer" 
          style={{ width: layer.width ? `${layer.width}px` : 'auto' }}
          className="max-w-[800px] pointer-events-none"
        />
      ) : (
        <div style={getTextStyle()} className="whitespace-pre">
          {layer.content}
        </div>
      )}
    </div>
  );
};

export default LayerItem;
