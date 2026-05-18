
import React from 'react';
import { ProfileSystem, Language } from '../types';
import { t } from '../translations';
import { X, Ruler, Layers } from 'lucide-react';

interface CrossSectionProps {
  system: ProfileSystem;
  glassThickness: number;
  isOpenable: boolean;
  lang: Language;
  onClose: () => void;
}

const CrossSection: React.FC<CrossSectionProps> = ({ system, glassThickness, isOpenable, lang, onClose }) => {
  // Styles
  const lineStroke = "#e2e8f0";
  const dimensionStroke = "#3b82f6";
  const thermalFill = "#1e293b";
  const profileFill = "none";
  const glassFill = "#bae6fd";
  
  // Technical parameters
  const fw = system.frameWidth;
  const fd = system.frameDepth;
  const sd = system.sashDepth || fd + 10;
  const tw = system.thermalBreakWidth || 24;
  const wall = system.wallThickness || 1.6;
  const overlap = system.correctionConfig.sashOverlap;

  // Scaling logic to fit SVG
  const scale = 4;
  const svgW = 600;
  const svgH = 500;
  const startX = 100;
  const startY = 100;

  // Calculated Points
  const frameOuterW = fw * scale;
  const frameOuterH = fd * scale;
  
  // Thermal break calculation
  const aluPart1 = (fd - tw) / 2;
  const aluPart2 = aluPart1;

  const renderProfileHollow = (x: number, y: number, w: number, h: number) => (
    <g>
      <rect x={x} y={y} width={w} height={h} stroke={lineStroke} fill={profileFill} strokeWidth="1.5" />
      <rect x={x + wall*scale} y={y + wall*scale} width={w - 2*wall*scale} height={h - 2*wall*scale} stroke={lineStroke} fill="none" strokeWidth="0.5" opacity="0.3" />
    </g>
  );

  const renderThermalBridge = (x: number, y: number, w: number, h: number) => (
    <rect x={x} y={y} width={w} height={h} fill={thermalFill} stroke={lineStroke} strokeWidth="0.5" />
  );

  const renderDimension = (x1: number, y1: number, x2: number, y2: number, label: string, horizontal = true) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={dimensionStroke} strokeWidth="1" strokeDasharray="2,2" />
      <text 
        x={(x1 + x2) / 2} 
        y={(y1 + y2) / 2 - (horizontal ? 5 : 0)} 
        transform={!horizontal ? `rotate(-90, ${(x1 + x2) / 2}, ${(y1 + y2) / 2})` : ''}
        fill={dimensionStroke} 
        fontSize="10" 
        fontWeight="bold" 
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/10 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                    <Layers size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white leading-tight">{system.name}</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{t(lang, 'sectionDetail')}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all">
                <X size={28} />
            </button>
        </div>

        {/* Blueprint Area */}
        <div className="p-10 bg-[#0f172a] relative overflow-hidden flex justify-center items-center h-[500px]">
             {/* Technical Grid Background */}
             <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                  style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
             />

             <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="drop-shadow-2xl">
                {/* 1. FRAME SECTION */}
                <g className="frame-group">
                   {/* Alu Outer */}
                   {renderProfileHollow(startX, startY, frameOuterW, aluPart1 * scale)}
                   {/* Polyamide Bridge */}
                   {renderThermalBridge(startX + wall*scale, startY + aluPart1*scale, frameOuterW - 2*wall*scale, tw*scale)}
                   {/* Alu Inner */}
                   {renderProfileHollow(startX, startY + (aluPart1 + tw) * scale, frameOuterW, aluPart2 * scale)}
                   
                   {/* Dimensions Frame */}
                   {renderDimension(startX, startY - 20, startX + frameOuterW, startY - 20, `${fw}mm`)}
                   {renderDimension(startX - 20, startY, startX - 20, startY + frameOuterH, `${fd}mm`, false)}
                </g>

                {/* 2. SASH SECTION (If Openable) */}
                {isOpenable && (
                   <g className="sash-group" transform={`translate(${(frameOuterW - overlap * scale)}, ${- (sd - fd) * scale / 2})`}>
                      {/* Sash Profile */}
                      {renderProfileHollow(startX, startY, 55 * scale, (sd-tw)/2 * scale)}
                      {renderThermalBridge(startX + wall*scale, startY + (sd-tw)/2 * scale, 55 * scale - 2*wall*scale, tw*scale)}
                      {renderProfileHollow(startX, startY + (sd-tw)/2 * scale + tw*scale, 55 * scale, (sd-tw)/2 * scale)}
                      
                      {/* Gaskets */}
                      <circle cx={startX + overlap*scale} cy={startY + (sd/2)*scale} r="3" fill="#000" />
                      
                      {/* Dimensions Sash */}
                      {renderDimension(startX + 55*scale + 20, startY, startX + 55*scale + 20, startY + sd*scale, `${sd}mm`, false)}
                   </g>
                )}

                {/* 3. GLASS SECTION */}
                <g className="glass-group">
                    {/* Simplified Triple Glazing for effect */}
                    <rect x={startX + frameOuterW + (isOpenable ? 100 : 20)} y={startY - 50} width={glassThickness * scale} height={300} fill={glassFill} opacity="0.4" stroke={lineStroke} strokeWidth="0.5" />
                    <line x1={startX + frameOuterW + (isOpenable ? 100 : 20) + 4} y1={startY - 50} x2={startX + frameOuterW + (isOpenable ? 100 : 20) + 4} y2={startY + 250} stroke={dimensionStroke} strokeWidth="0.5" opacity="0.3" />
                    <line x1={startX + frameOuterW + (isOpenable ? 100 : 20) + (glassThickness * scale) - 4} y1={startY - 50} x2={startX + frameOuterW + (isOpenable ? 100 : 20) + (glassThickness * scale) - 4} y2={startY + 250} stroke={dimensionStroke} strokeWidth="0.5" opacity="0.3" />
                    
                    {/* Glass Dimension */}
                    {renderDimension(startX + frameOuterW + (isOpenable ? 100 : 20), startY - 70, startX + frameOuterW + (isOpenable ? 100 : 20) + glassThickness*scale, startY - 70, `${glassThickness}mm`)}
                </g>

                {/* Labels */}
                <text x={startX} y={startY + frameOuterH + 40} fill="#94a3b8" fontSize="12" fontWeight="bold">EXTERIOR</text>
                <text x={startX + 350} y={startY + frameOuterH + 40} fill="#94a3b8" fontSize="12" fontWeight="bold">INTERIOR</text>
             </svg>
        </div>

        {/* Footer info */}
        <div className="bg-slate-900 p-6 flex items-center justify-between text-slate-500 border-t border-white/5">
            <div className="flex items-center gap-2">
                <Ruler size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Scale 1:1 Engineering Drawing</span>
            </div>
            <div className="text-[10px] italic">
                {t(lang, 'schematic')} - Rescara {system.name.split(' ')[2]} Series
            </div>
        </div>
      </div>
    </div>
  );
};

export default CrossSection;
