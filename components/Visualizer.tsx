import React from 'react';
import { WindowNode, ProfileSystem } from '../types';

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
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
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
  const innerX = x + frameWidth;
  const innerY = y + frameWidth;
  const innerW = Math.max(0, width - frameWidth * 2);
  const innerH = Math.max(0, height - frameWidth * 2);
  const midX = innerX + innerW / 2;
  const midY = innerY + innerH / 2;

  // Calculate Text Y Position
  // If sliding, move text up to avoid overlap with the arrow
  const isSliding = node.openingType === 'sliding';
  const textY = isSliding ? midY - (Math.min(innerW, innerH) * 0.15) : midY;

  // Generate Path for Opening Symbols based on architectural standards
  // Triangle tip points to the HANDLE.
  // Triangle base is the HINGE.
  const renderOpeningSymbol = () => {
    if (node.openingType === 'fixed' || !node.openingType) return null;

    const paths: React.ReactElement[] = [];
    const strokeColor = "#334155"; // Dark Slate
    const strokeWidth = 1.5;
    const dashArray = "4,4"; // Used for tilt/vasistas lines

    // Helper to draw triangle pointing to handle
    // Direction: where the handle is.
    const drawTurn = (direction: 'left' | 'right') => {
        let d = "";
        if (direction === 'left') {
            // Handle Left, Hinge Right. Triangle Points Left (<).
            d = `M ${innerX + innerW},${innerY} L ${innerX},${midY} L ${innerX + innerW},${innerY + innerH}`;
        } else {
            // Handle Right, Hinge Left. Triangle Points Right (>).
            d = `M ${innerX},${innerY} L ${innerX + innerW},${midY} L ${innerX},${innerY + innerH}`;
        }
        return <path key={`turn-${direction}`} d={d} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" vectorEffect="non-scaling-stroke" />;
    };

    const drawTilt = () => {
        // Tilt (Vasistas): Hinge Bottom, Handle Top. Triangle Points Up (^).
        // Usually drawn with dashed lines.
        const d = `M ${innerX},${innerY + innerH} L ${midX},${innerY} L ${innerX + innerW},${innerY + innerH}`;
        return <path key="tilt" d={d} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" vectorEffect="non-scaling-stroke" strokeDasharray={dashArray} />;
    };

    switch (node.openingType) {
        case 'turn-left':
            // Sola Açılım (Left Hand): Hinges Left, Handle Right. Symbol: >
            paths.push(drawTurn('right'));
            break;
        case 'turn-right':
             // Sağa Açılım (Right Hand): Hinges Right, Handle Left. Symbol: <
            paths.push(drawTurn('left'));
            break;
        case 'tilt':
            // Vasistas
            paths.push(drawTilt());
            break;
        case 'tilt-turn-left':
            // Sola + Vasistas: Hinges Left (Handle Right) + Hinge Bottom
            paths.push(drawTurn('right'));
            paths.push(drawTilt());
            break;
        case 'tilt-turn-right':
             // Sağa + Vasistas: Hinges Right (Handle Left) + Hinge Bottom
            paths.push(drawTurn('left'));
            paths.push(drawTilt());
            break;
        case 'sliding':
             const arrowSize = Math.min(innerW, innerH) * 0.1;
             const d = `M ${midX - arrowSize},${midY} L ${midX + arrowSize},${midY} M ${midX + arrowSize - 5},${midY - 5} L ${midX + arrowSize},${midY} L ${midX + arrowSize - 5},${midY + 5}`;
             paths.push(
                <path key="slide" d={d} stroke={strokeColor} strokeWidth={strokeWidth * 2} fill="none" vectorEffect="non-scaling-stroke" />
            );
            break;
    }

    return <g>{paths}</g>;
  };

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
        strokeWidth={isSelected ? 4 : 2}
        vectorEffect="non-scaling-stroke"
      />

      {/* Glass Area (inset by frame width) */}
      <rect
        x={innerX}
        y={innerY}
        width={innerW}
        height={innerH}
        fill="#93c5fd" // Glass Blue
        fillOpacity={0.3}
        stroke="#60a5fa"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />

      {/* Sash Frame (Optional visual, if not fixed, draw a thicker inner border) */}
      {node.openingType !== 'fixed' && (
         <rect
            x={innerX}
            y={innerY}
            width={innerW}
            height={innerH}
            fill="none"
            stroke="#1e293b"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            opacity="0.5"
         />
      )}

      {/* Technical Drawing Symbols */}
      {renderOpeningSymbol()}
      
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
      {width > 200 && height > 200 && (
         <text 
            x={midX} 
            y={textY} 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill="white" 
            fontSize="48"
            fontWeight="bold"
            opacity="0.3"
            className="pointer-events-none select-none"
            style={{ textShadow: '0px 0px 4px rgba(0,0,0,0.5)' }}
        >
            {Math.round(width)}x{Math.round(height)}
        </text>
      )}
    </g>
  );
};

export default Visualizer;