import React from 'react';
import { WindowNode, ProfileSystem } from '../types';
import { clsx } from 'clsx';

interface VisualizerProps {
  node: WindowNode;
  width: number;
  height: number;
  x?: number;
  y?: number;
  system: ProfileSystem;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  node, 
  width, 
  height, 
  x = 0, 
  y = 0, 
  system,
  selectedNodeId,
  onSelectNode 
}) => {
  const isSelected = node.id === selectedNodeId;
  const frameWidth = system.frameWidth;

  // Handle Container (Split) Nodes
  if (node.type === 'container' && node.children && node.children.length === 2 && node.splitRatio) {
    const isVertical = node.direction === 'vertical';
    
    // We need to account for the mullion thickness in the split
    // Visual logic: The mullion takes up 'frameWidth' space in the middle.
    // The remaining space is divided by ratio.
    
    const availableSpace = isVertical ? width - frameWidth : height - frameWidth;
    const firstSize = availableSpace * node.splitRatio[0];
    const secondSize = availableSpace * node.splitRatio[1];

    return (
      <g>
        {/* First Child */}
        <Visualizer 
          node={node.children[0]}
          width={isVertical ? firstSize : width}
          height={isVertical ? height : firstSize}
          x={x}
          y={y}
          system={system}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
        
        {/* Mullion / Transom Profile */}
        <rect
          x={isVertical ? x + firstSize : x}
          y={isVertical ? y : y + firstSize}
          width={isVertical ? frameWidth : width}
          height={isVertical ? height : frameWidth}
          fill="#334155" // Slate 700 - Profile Color
          stroke="#0f172a"
          strokeWidth="1"
        />

        {/* Second Child */}
        <Visualizer 
          node={node.children[1]}
          width={isVertical ? secondSize : width}
          height={isVertical ? height : secondSize}
          x={isVertical ? x + firstSize + frameWidth : x}
          y={isVertical ? y : y + firstSize + frameWidth}
          system={system}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
      </g>
    );
  }

  // Handle Leaf (Glass/Sash) Nodes
  // We draw the outer frame of this specific leaf sector first
  return (
    <g 
      onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); }}
      className="cursor-pointer hover:opacity-90 transition-opacity"
    >
      {/* Outer Frame for this section */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#334155" // Profile Color
        stroke={isSelected ? "#3b82f6" : "#0f172a"}
        strokeWidth={isSelected ? 4 : 1}
      />

      {/* Glass Area (inset by frame width) */}
      <rect
        x={x + frameWidth}
        y={y + frameWidth}
        width={Math.max(0, width - frameWidth * 2)}
        height={Math.max(0, height - frameWidth * 2)}
        fill="#93c5fd" // Glass Blue
        fillOpacity={0.3}
        stroke="#60a5fa"
        strokeWidth="1"
      />

      {/* Sash Indicator (if applicable) */}
      {node.openingType !== 'fixed' && (
        <path 
          d={`M${x + frameWidth},${y + frameWidth} L${x + width/2},${y + height/2} L${x + frameWidth},${y + height - frameWidth}`}
          stroke="#fff"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="5,5"
          className="pointer-events-none"
        />
      )}
      
      {/* Selection Highlight Overlay */}
      {isSelected && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="rgba(59, 130, 246, 0.2)"
          className="pointer-events-none"
        />
      )}
      
      {/* ID Label for Debug/Clarity */}
      <text 
        x={x + width / 2} 
        y={y + height / 2} 
        textAnchor="middle" 
        dominantBaseline="middle" 
        fill="white" 
        fontSize="12"
        className="pointer-events-none drop-shadow-md font-bold opacity-50"
      >
        {Math.round(width)}x{Math.round(height)}
      </text>
    </g>
  );
};

export default Visualizer;
