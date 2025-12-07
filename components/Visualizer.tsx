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
  // Visual approximation for sash profile width (standard aluminium sash is ~50-60mm)
  const sashWidth = 55; 

  // Dynamic stroke width based on overall size to keep drawings legible at different scales
  // Clamp between 1.5 and 4
  const scaleFactor = Math.min(width, height);
  const strokeBase = Math.max(1.5, Math.min(scaleFactor / 300, 4));

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
          fill="#334155" // Slate 700
          stroke="#0f172a"
          strokeWidth={strokeBase}
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

  // --- Leaf Node Logic ---

  const isOpening = node.openingType && node.openingType !== 'fixed';
  
  // 1. Outer Frame (The hole boundaries allocated to this node)
  // This is the background "Frame"
  
  // 2. Inner Frame Coordinates (where the frame material ends)
  const frameInnerX = x + frameWidth;
  const frameInnerY = y + frameWidth;
  const frameInnerW = Math.max(0, width - frameWidth * 2);
  const frameInnerH = Math.max(0, height - frameWidth * 2);

  // 3. Sash Logic
  // If opening, we have a Sash Profile inside the Frame
  // If fixed, glass usually starts at frame (or adapter), we assume direct glaze at frameInner
  
  const glassX = isOpening ? frameInnerX + sashWidth : frameInnerX;
  const glassY = isOpening ? frameInnerY + sashWidth : frameInnerY;
  const glassW = isOpening ? Math.max(0, frameInnerW - sashWidth * 2) : frameInnerW;
  const glassH = isOpening ? Math.max(0, frameInnerH - sashWidth * 2) : frameInnerH;

  const centerX = glassX + glassW / 2;
  const centerY = glassY + glassH / 2;

  // Text Position
  const isSliding = node.openingType === 'sliding';
  const textY = isSliding ? centerY - (Math.min(glassW, glassH) * 0.15) : centerY;

  const renderOpeningSymbol = () => {
    if (!isOpening) return null;

    const paths: React.ReactElement[] = [];
    const symbolColor = "#1e293b"; // Slate 800 - Contrast on glass
    const dashArray = `${strokeBase * 3},${strokeBase * 2}`;

    // Dimensions for symbol drawing (relative to the visible glass area)
    const symX = glassX;
    const symY = glassY;
    const symW = glassW;
    const symH = glassH;
    
    // Midpoints
    const midX = symX + symW / 2;
    const midY = symY + symH / 2;

    const drawLine = (x1: number, y1: number, x2: number, y2: number, key: string, dashed = false) => (
      <line 
        key={key} 
        x1={x1} y1={y1} 
        x2={x2} y2={y2} 
        stroke={symbolColor} 
        strokeWidth={strokeBase} 
        strokeDasharray={dashed ? dashArray : undefined}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    );

    // DIN Standards: Triangles point TO the handle (operating side).
    // Dashed lines for Tilt (Hinge bottom).
    switch (node.openingType) {
        case 'turn-left': // Hinges Left, Handle Right -> Lines converge Right
            paths.push(drawLine(symX, symY, symX + symW, midY, 'tl1'));
            paths.push(drawLine(symX, symY + symH, symX + symW, midY, 'tl2'));
            break;
        case 'turn-right': // Hinges Right, Handle Left -> Lines converge Left
            paths.push(drawLine(symX + symW, symY, symX, midY, 'tr1'));
            paths.push(drawLine(symX + symW, symY + symH, symX, midY, 'tr2'));
            break;
        case 'tilt': // Hinges Bottom, Handle Top -> Lines converge Top (Dashed)
            paths.push(drawLine(symX, symY + symH, midX, symY, 't1', true));
            paths.push(drawLine(symX + symW, symY + symH, midX, symY, 't2', true));
            break;
        case 'tilt-turn-left': 
            // Turn Left (Solid)
            paths.push(drawLine(symX, symY, symX + symW, midY, 'ttl1'));
            paths.push(drawLine(symX, symY + symH, symX + symW, midY, 'ttl2'));
            // Tilt (Dashed)
            paths.push(drawLine(symX, symY + symH, midX, symY, 'ttl3', true)); 
            paths.push(drawLine(symX + symW, symY + symH, midX, symY, 'ttl4', true));
            break;
        case 'tilt-turn-right': 
            // Turn Right (Solid)
            paths.push(drawLine(symX + symW, symY, symX, midY, 'ttr1'));
            paths.push(drawLine(symX + symW, symY + symH, symX, midY, 'ttr2'));
            // Tilt (Dashed)
            paths.push(drawLine(symX, symY + symH, midX, symY, 'ttr3', true)); 
            paths.push(drawLine(symX + symW, symY + symH, midX, symY, 'ttr4', true));
            break;
        case 'sliding':
            const arrowLen = Math.min(symW, symH) * 0.25;
            const arrowHead = arrowLen * 0.3;
            // Draw horizontal arrow
            paths.push(drawLine(midX - arrowLen/2, midY, midX + arrowLen/2, midY, 's-line'));
            // Arrow head (Right pointing)
            const ahPath = `M ${midX + arrowLen/2} ${midY} L ${midX + arrowLen/2 - arrowHead} ${midY - arrowHead} M ${midX + arrowLen/2} ${midY} L ${midX + arrowLen/2 - arrowHead} ${midY + arrowHead}`;
            paths.push(<path key="s-head" d={ahPath} stroke={symbolColor} strokeWidth={strokeBase} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" />);
            break;
    }
    return <g>{paths}</g>;
  };

  return (
    <g 
      onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); }}
      className="cursor-pointer hover:opacity-95 transition-opacity"
    >
      {/* 1. Outer Profile (Frame) */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#334155" // Slate 700
        stroke={isSelected ? "#3b82f6" : "#0f172a"}
        strokeWidth={isSelected ? strokeBase * 2 : strokeBase}
        vectorEffect="non-scaling-stroke"
      />

      {/* 2. Sash Profile (if opening) */}
      {isOpening && (
         <rect
            x={frameInnerX}
            y={frameInnerY}
            width={frameInnerW}
            height={frameInnerH}
            fill="#475569" // Slate 600 - Slightly lighter than frame to distinguish
            stroke="#1e293b" // Slate 800 - Border
            strokeWidth={strokeBase}
            vectorEffect="non-scaling-stroke"
         />
      )}

      {/* 3. Glass Area */}
      <rect
        x={glassX}
        y={glassY}
        width={glassW}
        height={glassH}
        fill="#93c5fd" // Blue 300
        fillOpacity={0.25}
        stroke="#60a5fa" // Blue 400
        strokeWidth={strokeBase * 0.5}
        vectorEffect="non-scaling-stroke"
      />

      {/* 4. Opening Symbols */}
      {renderOpeningSymbol()}
      
      {/* 5. Selection Overlay */}
      {isSelected && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="rgba(59, 130, 246, 0.15)"
          className="pointer-events-none"
        />
      )}
      
      {/* 6. Dimensions Label (Only if large enough) */}
      {width > 250 && height > 250 && (
         <text 
            x={centerX} 
            y={textY} 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill="white" 
            fontSize={Math.max(12, Math.min(width, height) / 10)}
            fontWeight="600"
            opacity="0.5"
            className="pointer-events-none select-none drop-shadow-md font-mono"
            style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}
        >
            {Math.round(width)}x{Math.round(height)}
        </text>
      )}
    </g>
  );
};

export default Visualizer;