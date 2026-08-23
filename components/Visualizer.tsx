
import React, { useMemo } from 'react';
import { WindowNode, ProfileSystem, UnitShape } from '../types';

interface VisualizerProps {
  node: WindowNode;
  width: number;
  height: number;
  x?: number;
  y?: number;
  system: ProfileSystem;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  theme?: 'dark' | 'light';
  shape?: UnitShape;
  archHeight?: number;
  hasThreshold?: boolean;
  lang?: string;
  viewPerspective?: 'interior' | 'exterior';
  showDimensions?: boolean;
}

// Helper: Calculate Y cuts for horizontal transoms (dividing height)
export function getYCuts(node: WindowNode, y0: number, h: number, frameW: number): number[] {
  if (!node || node.type !== 'container' || !node.children || node.children.length !== 2 || !node.splitRatio) {
    return [];
  }
  if (node.direction === 'horizontal') {
    const available = h - frameW;
    const s1 = available * node.splitRatio[0];
    const cutY = y0 + s1 + frameW / 2;
    const cutsTop = getYCuts(node.children[0], y0, s1, frameW);
    const cutsBottom = getYCuts(node.children[1], y0 + s1 + frameW, available * node.splitRatio[1], frameW);
    return [...cutsTop, cutY, ...cutsBottom];
  } else {
    const cutsLeft = getYCuts(node.children[0], y0, h, frameW);
    const cutsRight = getYCuts(node.children[1], y0, h, frameW);
    return [...cutsLeft, ...cutsRight];
  }
}

// Helper: Calculate X cuts for vertical mullions (dividing width)
export function getXCuts(node: WindowNode, x0: number, w: number, frameW: number): number[] {
  if (!node || node.type !== 'container' || !node.children || node.children.length !== 2 || !node.splitRatio) {
    return [];
  }
  if (node.direction === 'vertical') {
    const available = w - frameW;
    const s1 = available * node.splitRatio[0];
    const cutX = x0 + s1 + frameW / 2;
    const cutsLeft = getXCuts(node.children[0], x0, s1, frameW);
    const cutsRight = getXCuts(node.children[1], x0 + s1 + frameW, available * node.splitRatio[1], frameW);
    return [...cutsLeft, cutX, ...cutsRight];
  } else {
    const cutsTop = getXCuts(node.children[0], x0, w, frameW);
    const cutsBottom = getXCuts(node.children[1], x0, w, frameW);
    return [...cutsTop, ...cutsBottom];
  }
}

export interface SegmentInterval {
  start: number;
  end: number;
  length: number;
}

export function getSegmentsFromCuts(cuts: number[], totalLength: number): SegmentInterval[] {
  const rounded = Array.from(new Set(cuts.map(c => Math.round(c))))
    .filter(c => c > 15 && c < totalLength - 15)
    .sort((a, b) => a - b);
  
  if (rounded.length === 0) {
    return [{ start: 0, end: totalLength, length: totalLength }];
  }

  const points = [0, ...rounded, totalLength];
  const segments: SegmentInterval[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    segments.push({ start, end, length: Math.round(end - start) });
  }
  return segments;
}

export const getViewBoxWithDimensions = (w: number, h: number) => {
  const padX = Math.max(75, Math.round(w * 0.14));
  const padY = Math.max(75, Math.round(h * 0.12));
  const minX = -padX;
  const minY = -padY;
  const totalW = w + padX * 2.3;
  const totalH = h + padY * 2.3;
  return `${minX} ${minY} ${totalW} ${totalH}`;
};

const Visualizer: React.FC<VisualizerProps> = ({ 
  node, width, height, x = 0, y = 0, system, selectedNodeId, onSelectNode, theme = 'light', shape = 'rect', archHeight = 400, hasThreshold = false, lang = 'tr', viewPerspective = 'interior', showDimensions = true
}) => {
  const isSelected = node.id === selectedNodeId;
  const isRoot = x === 0 && y === 0;
  
  const frameWidth = system.frameWidth;
  const bottomFw = (isRoot && hasThreshold) ? Math.min(15, frameWidth) : frameWidth;
  const sashWidth = 55; 

  const scaleFactor = Math.min(width, height);
  const strokeBase = Math.max(1.5, Math.min(scaleFactor / 300, 3));

  const profileFill = theme === 'dark' ? "#334155" : "#f1f5f9"; 
  const profileSelectedFill = theme === 'dark' ? "#1e40af" : "#dbeafe"; 
  const strokeColor = isSelected ? (theme === 'dark' ? "#60a5fa" : "#3b82f6") : (theme === 'dark' ? "#475569" : "#64748b"); 
  
  const glassFill = "#bae6fd"; 
  const symbolColor = theme === 'dark' ? "#f8fafc" : "#0f172a"; // Oklar ve semboller için daha koyu/belirgin renk
  const hardwareColor = "#1e293b";
  const lineLight = theme === 'dark' ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";

  const clipId = useMemo(() => `clip-${Math.random().toString(36).substr(2, 9)}`, []);

  const renderProfileRect = (px: number, py: number, pw: number, ph: number, isSash = false) => {
    const step = 6;
    const bead = 12;
    return (
      <g>
        <rect x={px} y={py} width={pw} height={ph} fill={isSelected ? profileSelectedFill : profileFill} stroke={strokeColor} strokeWidth={strokeBase} />
        <rect x={px + step} y={py + step} width={Math.max(0, pw - step * 2)} height={Math.max(0, ph - step * 2)} fill="none" stroke={lineLight} strokeWidth={0.5} />
        {isSash ? (
           <>
            <rect x={px + bead} y={py + bead} width={Math.max(0, pw - bead * 2)} height={Math.max(0, ph - bead * 2)} fill="none" stroke={strokeColor} strokeWidth={0.5} opacity="0.3" />
            <line x1={px} y1={py} x2={px + pw} y2={py + ph} stroke={lineLight} strokeWidth={0.5} />
            <line x1={px + pw} y1={py} x2={px} y2={py + ph} stroke={lineLight} strokeWidth={0.5} />
           </>
        ) : (
          <rect x={px + pw - bead} y={py + step} width={bead - step} height={ph - step*2} fill="none" stroke={strokeColor} strokeWidth={0.5} opacity="0.2" />
        )}
      </g>
    );
  };

  const renderHinges = (gx: number, gy: number, gw: number, gh: number, type: string) => {
    if (!type || type === 'fixed' || type.includes('sliding')) return null;
    const hSize = 8;
    const hinges = [];
    
    if (type.includes('left')) {
      hinges.push(<rect key="h1" x={gx - hSize/2} y={gy + 40} width={hSize} height={20} fill={hardwareColor} rx="2" />);
      hinges.push(<rect key="h2" x={gx - hSize/2} y={gy + gh - 60} width={hSize} height={20} fill={hardwareColor} rx="2" />);
    } else if (type.includes('right')) {
      hinges.push(<rect key="h3" x={gx + gw - hSize/2} y={gy + 40} width={hSize} height={20} fill={hardwareColor} rx="2" />);
      hinges.push(<rect key="h4" x={gx + gw - hSize/2} y={gy + gh - 60} width={hSize} height={20} fill={hardwareColor} rx="2" />);
    } else if (type === 'tilt') {
        hinges.push(<rect key="h5" x={gx + 40} y={gy + gh - hSize/2} width={20} height={hSize} fill={hardwareColor} rx="2" />);
        hinges.push(<rect key="h6" x={gx + gw - 60} y={gy + gh - hSize/2} width={20} height={hSize} fill={hardwareColor} rx="2" />);
    }
    return hinges;
  };

  const renderHandle = (gx: number, gy: number, gw: number, gh: number, type: string) => {
    if (!type || type === 'fixed') return null;
    
    let finalH = 100;
    let finalW = 20;
    let finalLever = 140;
    let finalOffset = 50;
    let finalRosetteW = 45;
    let finalRosetteH = 90;

    // Scale down on very small panes to prevent overflow
    const maxDimension = Math.min(gw, gh);
    if (maxDimension < 450) {
      const ratio = Math.max(0.35, maxDimension / 450);
      finalH = Math.round(finalH * ratio);
      finalW = Math.round(finalW * ratio);
      finalLever = Math.round(finalLever * ratio);
      finalOffset = Math.round(finalOffset * ratio);
      finalRosetteW = Math.round(finalRosetteW * ratio);
      finalRosetteH = Math.round(finalRosetteH * ratio);
    }

    let hx = 0;
    let hy = gy + gh / 2 - finalH / 2;
    let isLeft = false;

    if (type.includes('left')) {
      hx = gx + gw - finalOffset;
      isLeft = true;
    } else if (type.includes('right')) {
      hx = gx + finalOffset;
      isLeft = false;
    } else if (type.includes('sliding')) {
      hx = gx + finalOffset + 10; // Sürme için kulp sol kenarda (LogiKal standardı)
      isLeft = false;
    } else if (type === 'tilt') {
      hx = gx + gw / 2 - finalW / 2;
      hy = gy + gh - finalOffset;
    }

    const neckW = Math.round(finalW * 0.5);
    const neckH = Math.round(finalH * 0.15);
    const leverH = Math.round(finalH * 0.18);

    return (
      <g transform={`translate(${hx}, ${hy})`}>
        {/* Rosette Base Plate (Rozet) - highly visible contrast wrapper */}
        <rect 
          x={finalW / 2 - finalRosetteW / 2} 
          y={finalH / 2 - finalRosetteH / 2} 
          width={finalRosetteW} 
          height={finalRosetteH} 
          fill="#ffffff" 
          stroke="#000000" 
          strokeWidth="2.5" 
          rx="5" 
        />
        
        {/* Inner Rosette details to look very premium */}
        <rect 
          x={finalW / 2 - finalRosetteW / 2 + 3} 
          y={finalH / 2 - finalRosetteH / 2 + 3} 
          width={finalRosetteW - 6} 
          height={finalRosetteH - 6} 
          fill="none" 
          stroke="#94a3b8" 
          strokeWidth="1" 
          rx="3" 
        />
        
        {/* Connection neck */}
        <rect 
          x={isLeft ? -neckW : finalW} 
          y={finalH / 2 - neckH / 2} 
          width={neckW} 
          height={neckH} 
          fill="#475569" 
          stroke="#000000" 
          strokeWidth="2" 
        />

        {/* Handle Grip (Kol) */}
        <rect 
          x={isLeft ? -finalLever : finalW + neckW} 
          y={finalH / 2 - leverH / 2} 
          width={finalLever} 
          height={leverH} 
          fill="#1e293b" 
          stroke="#000000" 
          strokeWidth="2.5" 
          rx="4" 
        />
        
        {/* Metallic chrome shine highlight */}
        <rect 
          x={isLeft ? -finalLever + 4 : finalW + neckW + 4} 
          y={finalH / 2 - leverH / 2 + 3} 
          width={finalLever - 8} 
          height={Math.max(2, Math.round(leverH * 0.25))} 
          fill="#ffffff" 
          opacity="0.65" 
          rx="1" 
        />

        {/* Handle Body Base (Gövde) */}
        <rect 
          x={0} 
          y={0} 
          width={finalW} 
          height={finalH} 
          fill="#0f172a" 
          stroke="#000000" 
          strokeWidth="2.5" 
          rx="3" 
        />
        
        {/* Body highlight */}
        <rect 
          x={3} 
          y={3} 
          width={Math.max(2, finalW - 6)} 
          height={Math.max(2, finalH - 6)} 
          fill="#cbd5e1" 
          opacity="0.3" 
          rx="1.5" 
        />
      </g>
    );
  };

  const renderOpeningSymbol = (gx: number, gy: number, gw: number, gh: number, type: string) => {
    if (!type || type === 'fixed') return null;
    const dash = "6,4";
    const color = symbolColor;
    const weight = 2.2;
    const symbols = [];
    
    // Sürme (Sliding) Sembolü - OK Çizimi
    if (type.includes('sliding')) {
      const arrowY = gy + gh / 2;
      const arrowXStart = gx + 25;
      const arrowXEnd = gx + gw - 25;
      const headSize = 10;
      
      symbols.push(<line key="s1" x1={arrowXStart} y1={arrowY} x2={arrowXEnd} y2={arrowY} stroke={color} strokeWidth={weight} />);
      symbols.push(<path key="s2" d={`M ${arrowXEnd - headSize} ${arrowY - headSize/2} L ${arrowXEnd} ${arrowY} L ${arrowXEnd - headSize} ${arrowY + headSize/2}`} fill="none" stroke={color} strokeWidth={weight} />);
    }

    // Yandan açılım çizgileri
    if (type.includes('left') && !type.includes('sliding')) {
      symbols.push(<line key="l1" x1={gx} y1={gy} x2={gx + gw} y2={gy + gh/2} stroke={color} strokeDasharray={dash} strokeWidth={weight} />);
      symbols.push(<line key="l2" x1={gx} y1={gy + gh} x2={gx + gw} y2={gy + gh/2} stroke={color} strokeDasharray={dash} strokeWidth={weight} />);
    } else if (type.includes('right') && !type.includes('sliding')) {
      symbols.push(<line key="r1" x1={gx + gw} y1={gy} x2={gx} y2={gy + gh/2} stroke={color} strokeDasharray={dash} strokeWidth={weight} />);
      symbols.push(<line key="r2" x1={gx + gw} y1={gy + gh} x2={gx} y2={gy + gh/2} stroke={color} strokeDasharray={dash} strokeWidth={weight} />);
    }
    
    // Üstten açılım çizgileri
    if (type.includes('tilt')) {
      symbols.push(<line key="t1" x1={gx} y1={gy + gh} x2={gx + gw/2} y2={gy} stroke={color} strokeDasharray={dash} strokeWidth={weight} />);
      symbols.push(<line key="t2" x1={gx + gw} y1={gy + gh} x2={gx + gw/2} y2={gy} stroke={color} strokeDasharray={dash} strokeWidth={weight} />);
    }

    return <g className="opening-symbols-layer">{symbols}</g>;
  };

  const getShapePath = (isInner: boolean = false) => {
    const w = width;
    const h = height;
    if (shape === 'triangle') {
      if (!isInner) return `M 0,${h} L ${w/2},0 L ${w},${h} Z`;
      const fw = frameWidth;
      const halfW = w / 2;
      const sideLen = Math.sqrt(halfW * halfW + h * h);
      const sinA = h / sideLen;
      const cosA = halfW / sideLen;
      const ix1 = fw * (1 + cosA) / sinA;
      const ix2 = w - ix1;
      const iy = h - bottomFw;
      const topY = fw / (halfW / sideLen);
      return `M ${ix1},${iy} L ${w/2},${topY} L ${ix2},${iy} Z`;
    }
    if (shape === 'arch') {
      const aH = archHeight || w/2;
      if (!isInner) return `M 0,${h} L 0,${aH} A ${w/2},${aH} 0 0 1 ${w},${aH} L ${w},${h} Z`;
      const iw = w - 2*frameWidth;
      const iaH = aH - frameWidth;
      return `M ${frameWidth},${h-bottomFw} L ${frameWidth},${aH} A ${iw/2},${iaH} 0 0 1 ${w-frameWidth},${aH} L ${w-frameWidth},${h-bottomFw} Z`;
    }
    if (!isInner) return `M 0,0 L ${w},0 L ${w},${h} L 0,${h} Z`;
    return `M ${frameWidth},${frameWidth} L ${w-frameWidth},${frameWidth} L ${w-frameWidth},${h-bottomFw} L ${frameWidth},${h-bottomFw} Z`;
  };

  const renderContent = () => {
    if (node.type === 'container' && node.children?.length === 2 && node.splitRatio) {
      const isVerticalSplit = node.direction === 'vertical'; 
      const availableSpace = isVerticalSplit ? width - frameWidth : height - frameWidth;
      const firstSize = availableSpace * node.splitRatio[0];
      const secondSize = availableSpace * node.splitRatio[1];

      return (
        <g>
          {isRoot && (
            <>
              <defs><clipPath id={clipId}><path d={getShapePath(true)} /></clipPath></defs>
              <path d={getShapePath(false)} fill={isSelected ? profileSelectedFill : profileFill} stroke={strokeColor} strokeWidth={strokeBase} fillRule="evenodd" />
              <path d={getShapePath(true)} fill="none" stroke={lineLight} strokeWidth={1} />
            </>
          )}
          <g clipPath={isRoot ? `url(#${clipId})` : undefined}>
            <Visualizer node={node.children[0]} width={isVerticalSplit ? firstSize : width} height={isVerticalSplit ? height : firstSize} x={x} y={y} system={system} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} theme={theme} shape="rect" hasThreshold={hasThreshold} lang={lang} viewPerspective={viewPerspective} />
            <g onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); }}>
               {renderProfileRect(isVerticalSplit ? x + firstSize : x, isVerticalSplit ? y : y + firstSize, isVerticalSplit ? frameWidth : width, isVerticalSplit ? height : frameWidth)}
            </g>
            <Visualizer node={node.children[1]} width={isVerticalSplit ? secondSize : width} height={isVerticalSplit ? height : secondSize} x={isVerticalSplit ? x + firstSize + frameWidth : x} y={isVerticalSplit ? y : y + firstSize + frameWidth} system={system} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} theme={theme} shape="rect" hasThreshold={hasThreshold} lang={lang} viewPerspective={viewPerspective} />
          </g>
        </g>
      );
    }

    const isOpening = node.openingType && node.openingType !== 'fixed';
    const frameInnerX = x + frameWidth;
    const frameInnerY = y + frameWidth;
    const frameInnerW = Math.max(0, width - frameWidth * 2);
    const frameInnerH = Math.max(0, height - frameWidth - bottomFw);

    const glassX = isOpening ? frameInnerX + sashWidth : frameInnerX;
    const glassY = isOpening ? frameInnerY + sashWidth : frameInnerY;
    const glassW = isOpening ? Math.max(0, frameInnerW - sashWidth * 2) : frameInnerW;
    const glassH = isOpening ? Math.max(0, frameInnerH - sashWidth * 2) : frameInnerH;

    if (node.type === 'void') {
      const voidBg = theme === 'dark' ? '#0f172a' : '#f1f5f9';
      const voidStroke = theme === 'dark' ? '#64748b' : '#94a3b8';
      const isSelected = selectedNodeId === node.id;
      
      return (
        <g onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); }} className="cursor-pointer">
          {isRoot ? (
            <>
              <defs><clipPath id={clipId}><path d={getShapePath(true)} /></clipPath></defs>
              <path d={getShapePath(false)} fill={isSelected ? profileSelectedFill : profileFill} stroke={strokeColor} strokeWidth={strokeBase} fillRule="evenodd" />
            </>
          ) : (
            renderProfileRect(x, y, width, height)
          )}
          <g clipPath={isRoot ? `url(#${clipId})` : undefined}>
            {/* Void Background Box */}
            <rect 
              x={frameInnerX} 
              y={frameInnerY} 
              width={frameInnerW} 
              height={frameInnerH} 
              fill={isSelected ? (theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(219, 234, 254, 0.6)') : voidBg} 
              stroke={isSelected ? strokeColor : voidStroke} 
              strokeWidth={1.5} 
              strokeDasharray="6,4" 
            />
            {/* CAD Diagonal Cross Lines (X) */}
            <line 
              x1={frameInnerX} 
              y1={frameInnerY} 
              x2={frameInnerX + frameInnerW} 
              y2={frameInnerY + frameInnerH} 
              stroke={voidStroke} 
              strokeWidth={1} 
              strokeDasharray="5,5" 
              opacity="0.7" 
            />
            <line 
              x1={frameInnerX + frameInnerW} 
              y1={frameInnerY} 
              x2={frameInnerX} 
              y2={frameInnerY + frameInnerH} 
              stroke={voidStroke} 
              strokeWidth={1} 
              strokeDasharray="5,5" 
              opacity="0.7" 
            />
            {/* Void Label Badge */}
            <g className="select-none pointer-events-none">
              <rect 
                x={frameInnerX + frameInnerW/2 - Math.max(45, Math.min(65, frameInnerW * 0.4))} 
                y={frameInnerY + frameInnerH/2 - 16} 
                width={Math.max(90, Math.min(130, frameInnerW * 0.8))} 
                height={32} 
                rx={4} 
                fill={theme === 'dark' ? '#1e293b' : '#ffffff'} 
                stroke={isSelected ? strokeColor : voidStroke} 
                strokeWidth={1.2} 
              />
              <text 
                x={frameInnerX + frameInnerW/2} 
                y={frameInnerY + frameInnerH/2 - 3} 
                textAnchor="middle" 
                fill={theme === 'dark' ? '#cbd5e1' : '#475569'} 
                fontSize={10} 
                fontWeight="900" 
                letterSpacing="0.8px"
                fontFamily="monospace"
              >
                {lang === 'tr' ? 'BOŞLUK / VOID' : 'VOID OPENING'}
              </text>
              <text 
                x={frameInnerX + frameInnerW/2} 
                y={frameInnerY + frameInnerH/2 + 10} 
                textAnchor="middle" 
                fill={theme === 'dark' ? '#38bdf8' : '#2563eb'} 
                fontSize={9} 
                fontWeight="800" 
                fontFamily="monospace"
              >
                {Math.round(width)} × {Math.round(height)} mm
              </text>
            </g>
          </g>
        </g>
      );
    }

    return (
      <g onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); }} className="cursor-pointer">
        {isRoot ? (
            <>
                <defs><clipPath id={clipId}><path d={getShapePath(true)} /></clipPath></defs>
                <path d={getShapePath(false)} fill={isSelected ? profileSelectedFill : profileFill} stroke={strokeColor} strokeWidth={strokeBase} fillRule="evenodd" />
                {hasThreshold && (
                  <g>
                    {/* Structural Aluminum Metallic Base */}
                    <rect 
                      x={0} 
                      y={height - bottomFw} 
                      width={width} 
                      height={bottomFw} 
                      fill={theme === 'dark' ? '#1e293b' : '#334155'} 
                      stroke={strokeColor} 
                      strokeWidth={1.5} 
                    />
                    
                    {/* Highly Contrast Amber/Orange Warning Zone Strip */}
                    <rect 
                      x={0} 
                      y={height - bottomFw + 1} 
                      width={width} 
                      height={Math.max(2, bottomFw - 2)} 
                      fill="#eab308" 
                      stroke="#d97706"
                      strokeWidth={0.5}
                    />
                    
                    {/* High-visibility safety hazard stripes across the threshold */}
                    {Array.from({ length: Math.ceil(width / 30) }).map((_, i) => {
                      const stripeX = i * 30;
                      return (
                        <path
                          key={i}
                          d={`M ${stripeX} ${height} L ${stripeX + 10} ${height - bottomFw} L ${stripeX + 18} ${height - bottomFw} L ${stripeX + 8} ${height} Z`}
                          fill="#1e293b"
                          opacity="0.25"
                        />
                      );
                    })}

                    {/* Proportional, bold centered overlay badge designed to survive high scale down */}
                    <g className="select-none pointer-events-none" transform={viewPerspective === 'exterior' ? `translate(${width}, 0) scale(-1, 1)` : undefined}>
                      {/* Badge Background Card */}
                      <rect 
                        x={width / 2 - Math.max(160, width * 0.25)} 
                        y={height - bottomFw - Math.max(45, height * 0.045)} 
                        width={Math.max(320, width * 0.5)} 
                        height={Math.max(40, height * 0.038)} 
                        rx={6} 
                        fill="#ca8a04" 
                        stroke="#f59e0b" 
                        strokeWidth={Math.max(1.5, height * 0.0015)} 
                      />
                      {/* Contrastive Text Label */}
                      <text 
                        x={width / 2} 
                        y={height - bottomFw - Math.max(45, height * 0.045) + Math.max(25, height * 0.024)} 
                        textAnchor="middle" 
                        fill="#ffffff" 
                        fontSize={Math.max(14, height * 0.0165)} 
                        fontWeight="900" 
                        letterSpacing="0.8px"
                        fontFamily="system-ui, sans-serif"
                      >
                        ⚠️ {lang === 'tr' ? 'ALÜMİNYUM EŞİK' : 'ALU THRESHOLD'}
                      </text>
                    </g>
                  </g>
                )}
            </>
        ) : (
          renderProfileRect(x, y, width, height)
        )}
        <g clipPath={isRoot ? `url(#${clipId})` : undefined}>
          {isOpening && renderProfileRect(frameInnerX, frameInnerY, frameInnerW, frameInnerH, true)}
          <rect x={glassX} y={glassY} width={glassW} height={glassH} fill={glassFill} stroke={strokeColor} strokeWidth={0.5} />
          {renderOpeningSymbol(glassX, glassY, glassW, glassH, node.openingType || 'fixed')}
          {isOpening && renderHinges(glassX, glassY, glassW, glassH, node.openingType || 'fixed')}
          {isOpening && renderHandle(glassX, glassY, glassW, glassH, node.openingType || 'fixed')}

          {/* Segment Dimension Badge inside Pane (LogiKal Style) */}
          {glassW >= 40 && glassH >= 40 && (
            <g className="select-none pointer-events-none opacity-90 hover:opacity-100 transition-opacity">
              {(() => {
                const baseScale = Math.max(width, height);
                const bFont = Math.max(11, Math.min(Math.round(baseScale * 0.02), Math.round(glassH * 0.25)));
                const bW = Math.max(60, Math.min(glassW * 0.85, bFont * 7));
                const bH = Math.max(18, Math.round(bFont * 1.5));
                const bY = glassY + glassH / 2 - bH / 2;
                const bX = glassX + glassW / 2 - bW / 2;
                return (
                  <>
                    <rect 
                      x={bX} 
                      y={bY} 
                      width={bW} 
                      height={bH} 
                      rx={3} 
                      fill={theme === 'dark' ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)'} 
                      stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} 
                      strokeWidth={0.8} 
                    />
                    <text 
                      x={glassX + glassW / 2} 
                      y={bY + bH * 0.68} 
                      textAnchor="middle" 
                      fill={theme === 'dark' ? '#e2e8f0' : '#1e293b'} 
                      fontSize={bFont} 
                      fontWeight="800" 
                      fontFamily="monospace"
                    >
                      {Math.round(width)} × {Math.round(height)}
                    </text>
                  </>
                );
              })()}
            </g>
          )}
        </g>
      </g>
    );
  };

  const renderDimensions = () => {
    if (!isRoot || !showDimensions) return null;

    const dimStroke = theme === 'dark' ? '#64748b' : '#475569';
    const dimTextFill = theme === 'dark' ? '#38bdf8' : '#1e40af';
    const dimBgFill = theme === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)';
    const dimBorder = theme === 'dark' ? '#334155' : '#cbd5e1';

    const baseScale = Math.max(width, height);
    const fsOverall = Math.max(14, Math.round(baseScale * 0.022));
    const fsSegment = Math.max(12, Math.round(baseScale * 0.018));
    const tick = Math.max(4, Math.round(baseScale * 0.007));
    const sw = Math.max(1, Math.round(baseScale * 0.0012));

    const offTop = Math.max(35, Math.round(height * 0.065));
    const offLeft = Math.max(35, Math.round(width * 0.065));
    const offRight = Math.max(35, Math.round(width * 0.065));
    const offBottom = Math.max(35, Math.round(height * 0.065));

    const yCuts = getYCuts(node, 0, height, frameWidth);
    const vSegments = getSegmentsFromCuts(yCuts, height);

    const xCuts = getXCuts(node, 0, width, frameWidth);
    const hSegments = getSegmentsFromCuts(xCuts, width);

    return (
      <g className="cad-dimension-lines select-none pointer-events-none" style={{ fontFamily: 'monospace' }}>
        {/* 1. TOP OVERALL WIDTH */}
        <g>
          <line x1={0} y1={0} x2={0} y2={-offTop - tick * 1.5} stroke={dimStroke} strokeWidth={sw * 0.8} strokeDasharray="3,3" opacity="0.6" />
          <line x1={width} y1={0} x2={width} y2={-offTop - tick * 1.5} stroke={dimStroke} strokeWidth={sw * 0.8} strokeDasharray="3,3" opacity="0.6" />
          <line x1={0} y1={-offTop} x2={width} y2={-offTop} stroke={dimStroke} strokeWidth={sw} />
          <line x1={-tick} y1={-offTop + tick} x2={tick} y2={-offTop - tick} stroke={dimStroke} strokeWidth={sw * 1.5} />
          <line x1={width - tick} y1={-offTop + tick} x2={width + tick} y2={-offTop - tick} stroke={dimStroke} strokeWidth={sw * 1.5} />
          <rect 
            x={width / 2 - (fsOverall * 2.8)} 
            y={-offTop - (fsOverall * 0.85)} 
            width={fsOverall * 5.6} 
            height={fsOverall * 1.4} 
            rx={3} 
            fill={dimBgFill} 
            stroke={dimBorder} 
            strokeWidth={0.8} 
          />
          <text 
            x={width / 2} 
            y={-offTop + (fsOverall * 0.22)} 
            textAnchor="middle" 
            fill={dimTextFill} 
            fontSize={fsOverall} 
            fontWeight="900" 
          >
            {Math.round(width)} mm
          </text>
        </g>

        {/* 2. LEFT OVERALL HEIGHT */}
        <g>
          <line x1={0} y1={0} x2={-offLeft - tick * 1.5} y2={0} stroke={dimStroke} strokeWidth={sw * 0.8} strokeDasharray="3,3" opacity="0.6" />
          <line x1={0} y1={height} x2={-offLeft - tick * 1.5} y2={height} stroke={dimStroke} strokeWidth={sw * 0.8} strokeDasharray="3,3" opacity="0.6" />
          <line x1={-offLeft} y1={0} x2={-offLeft} y2={height} stroke={dimStroke} strokeWidth={sw} />
          <line x1={-offLeft - tick} y1={tick} x2={-offLeft + tick} y2={-tick} stroke={dimStroke} strokeWidth={sw * 1.5} />
          <line x1={-offLeft - tick} y1={height + tick} x2={-offLeft + tick} y2={height - tick} stroke={dimStroke} strokeWidth={sw * 1.5} />
          <g transform={`translate(${-offLeft}, ${height / 2}) rotate(-90)`}>
            <rect 
              x={-(fsOverall * 2.8)} 
              y={-(fsOverall * 0.7)} 
              width={fsOverall * 5.6} 
              height={fsOverall * 1.4} 
              rx={3} 
              fill={dimBgFill} 
              stroke={dimBorder} 
              strokeWidth={0.8} 
            />
            <text 
              x={0} 
              y={fsOverall * 0.35} 
              textAnchor="middle" 
              fill={dimTextFill} 
              fontSize={fsOverall} 
              fontWeight="900" 
            >
              {Math.round(height)} mm
            </text>
          </g>
        </g>

        {/* 3. RIGHT VERTICAL SUB-DIVISION SEGMENTS (Dikey Bölmelerin Uzunlukları) */}
        {vSegments.length > 1 && (
          <g>
            {vSegments.map((seg, idx) => {
              const segMidY = (seg.start + seg.end) / 2;
              return (
                <g key={`vseg-${idx}`}>
                  <line x1={width} y1={seg.start} x2={width + offRight + tick * 1.5} y2={seg.start} stroke={dimStroke} strokeWidth={sw * 0.8} strokeDasharray="3,3" opacity="0.6" />
                  <line x1={width} y1={seg.end} x2={width + offRight + tick * 1.5} y2={seg.end} stroke={dimStroke} strokeWidth={sw * 0.8} strokeDasharray="3,3" opacity="0.6" />
                  <line x1={width + offRight} y1={seg.start} x2={width + offRight} y2={seg.end} stroke={dimStroke} strokeWidth={sw} />
                  <line x1={width + offRight - tick} y1={seg.start + tick} x2={width + offRight + tick} y2={seg.start - tick} stroke={dimStroke} strokeWidth={sw * 1.5} />
                  <line x1={width + offRight - tick} y1={seg.end + tick} x2={width + offRight + tick} y2={seg.end - tick} stroke={dimStroke} strokeWidth={sw * 1.5} />
                  <g transform={`translate(${width + offRight}, ${segMidY}) rotate(-90)`}>
                    <rect 
                      x={-(fsSegment * 2.5)} 
                      y={-(fsSegment * 0.65)} 
                      width={fsSegment * 5.0} 
                      height={fsSegment * 1.3} 
                      rx={2.5} 
                      fill={dimBgFill} 
                      stroke={dimBorder} 
                      strokeWidth={0.7} 
                    />
                    <text 
                      x={0} 
                      y={fsSegment * 0.32} 
                      textAnchor="middle" 
                      fill={theme === 'dark' ? '#38bdf8' : '#0284c7'} 
                      fontSize={fsSegment} 
                      fontWeight="800" 
                    >
                      {seg.length} mm
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        )}

        {/* 4. BOTTOM HORIZONTAL SUB-DIVISION SEGMENTS (Yatay Bölmelerin Genişlikleri) */}
        {hSegments.length > 1 && (
          <g>
            {hSegments.map((seg, idx) => {
              const segMidX = (seg.start + seg.end) / 2;
              return (
                <g key={`hseg-${idx}`}>
                  <line x1={seg.start} y1={height} x2={seg.start} y2={height + offBottom + tick * 1.5} stroke={dimStroke} strokeWidth={sw * 0.8} strokeDasharray="3,3" opacity="0.6" />
                  <line x1={seg.end} y1={height} x2={seg.end} y2={height + offBottom + tick * 1.5} stroke={dimStroke} strokeWidth={sw * 0.8} strokeDasharray="3,3" opacity="0.6" />
                  <line x1={seg.start} y1={height + offBottom} x2={seg.end} y2={height + offBottom} stroke={dimStroke} strokeWidth={sw} />
                  <line x1={seg.start - tick} y1={height + offBottom + tick} x2={seg.start + tick} y2={height + offBottom - tick} stroke={dimStroke} strokeWidth={sw * 1.5} />
                  <line x1={seg.end - tick} y1={height + offBottom + tick} x2={seg.end + tick} y2={height + offBottom - tick} stroke={dimStroke} strokeWidth={sw * 1.5} />
                  <rect 
                    x={segMidX - (fsSegment * 2.5)} 
                    y={height + offBottom - (fsSegment * 0.65)} 
                    width={fsSegment * 5.0} 
                    height={fsSegment * 1.3} 
                    rx={2.5} 
                    fill={dimBgFill} 
                    stroke={dimBorder} 
                    strokeWidth={0.7} 
                  />
                  <text 
                    x={segMidX} 
                    y={height + offBottom + (fsSegment * 0.32)} 
                    textAnchor="middle" 
                    fill={theme === 'dark' ? '#38bdf8' : '#0284c7'} 
                    fontSize={fsSegment} 
                    fontWeight="800" 
                  >
                    {seg.length} mm
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </g>
    );
  };

  const rendered = renderContent();
  const dimensions = isRoot && showDimensions ? renderDimensions() : null;

  if (isRoot) {
    return (
      <g>
        {viewPerspective === 'exterior' ? (
          <g transform={`translate(${width}, 0) scale(-1, 1)`}>
            {rendered}
          </g>
        ) : (
          rendered
        )}
        {dimensions}
      </g>
    );
  }

  return rendered;
};

export default Visualizer;
