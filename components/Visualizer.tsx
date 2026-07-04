
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
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  node, width, height, x = 0, y = 0, system, selectedNodeId, onSelectNode, theme = 'light', shape = 'rect', archHeight = 400, hasThreshold = false, lang = 'tr', viewPerspective = 'interior'
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
    const hW = 6;
    const hH = 30;
    const lever = 25;
    let hx = 0;
    let hy = gy + gh / 2 - hH / 2;
    let isLeft = false;

    if (type.includes('left')) {
      hx = gx + gw - 15;
      isLeft = true;
    } else if (type.includes('right')) {
      hx = gx + 15;
      isLeft = false;
    } else if (type.includes('sliding')) {
      hx = gx + 15; // Sürme için kulp sol kenarda (LogiKal standardı)
      isLeft = false;
    } else if (type === 'tilt') {
      hx = gx + gw / 2 - hW / 2;
      hy = gy + gh - 25;
    }

    return (
      <g transform={`translate(${hx}, ${hy})`}>
        <rect width={hW} height={hH} fill={hardwareColor} rx="1" />
        <rect x={isLeft ? -lever : hW} y={hH/2 - 3} width={lever} height={6} fill={hardwareColor} rx="2" />
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
        </g>
      </g>
    );
  };

  const rendered = renderContent();
  if (isRoot && viewPerspective === 'exterior') {
    return (
      <g transform={`translate(${width}, 0) scale(-1, 1)`}>
        {rendered}
      </g>
    );
  }
  return rendered;
};

export default Visualizer;
