
import React, { useState, useEffect } from 'react';
import { Layer } from '../types';

interface LayerItemProps {
  layer: Layer;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Layer>) => void;
}

const LayerItem: React.FC<LayerItemProps> = ({ layer, isSelected, onSelect, onUpdate }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, initialX: 0, initialY: 0 });

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
    opacity: layer.opacity,
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
    boxShadow: isSelected ? '0 0 20px rgba(59, 130, 246, 0.3)' : 'none',
    zIndex: isSelected ? 50 : 10,
    touchAction: 'none',
    transition: isDragging ? 'none' : 'all 0.1s ease-out'
  };

  const startDrag = (clientX: number, clientY: number) => {
    onSelect(layer.id);
    setIsDragging(true);
    setDragStart({
      x: clientX,
      y: clientY,
      initialX: layer.x,
      initialY: layer.y
    });
  };

  const onDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    const parent = document.querySelector('.relative.bg-\\[\\#0a0f1e\\]');
    if (!parent) return;
    
    const rect = parent.getBoundingClientRect();
    const dx = ((clientX - dragStart.x) / rect.width) * 100;
    const dy = ((clientY - dragStart.y) / rect.height) * 100;
    
    onUpdate(layer.id, {
      x: Math.max(0, Math.min(100, dragStart.initialX + dx)),
      y: Math.max(0, Math.min(100, dragStart.initialY + dy))
    });
  };

  const endDrag = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => onDrag(e.clientX, e.clientY);
      const handleTouchMove = (e: TouchEvent) => onDrag(e.touches[0].clientX, e.touches[0].clientY);
      const handleUp = () => endDrag();

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchend', handleUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchend', handleUp);
      };
    }
  }, [isDragging, dragStart]);

  const getTextStyle = () => {
    let effectStyle: React.CSSProperties = {
      fontSize: `${layer.fontSize}px`,
      color: layer.color,
      fontFamily: layer.fontFamily,
      textAlign: 'center',
      pointerEvents: 'none',
      whiteSpace: 'nowrap'
    };

    switch (layer.effect) {
      case 'neon':
        effectStyle.textShadow = `0 0 5px #fff, 0 0 10px #fff, 0 0 15px ${layer.color}, 0 0 20px ${layer.color}`;
        break;
      case 'glow':
        effectStyle.filter = 'drop-shadow(0 0 10px currentColor)';
        break;
      case 'shadow':
        effectStyle.textShadow = '4px 4px 8px rgba(0,0,0,0.7)';
        break;
    }
    return effectStyle;
  };

  return (
    <div 
      style={style} 
      onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
      onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      className="layer-item"
    >
      {layer.type === 'image' ? (
        <img 
          src={layer.content} 
          alt="VisionAI Layer" 
          style={{ width: layer.width ? `${layer.width}px` : 'auto' }}
          className="max-w-none pointer-events-none rounded-sm"
        />
      ) : (
        <div style={getTextStyle()} className="font-bold">
          {layer.content}
        </div>
      )}
    </div>
  );
};

export default LayerItem;
