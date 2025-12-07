
import React from 'react';
import { ProfileSystem, Language } from '../types';
import { t } from '../translations';
import { X } from 'lucide-react';

interface CrossSectionProps {
  system: ProfileSystem;
  glassThickness: number;
  isOpenable: boolean;
  lang: Language;
  onClose: () => void;
}

const CrossSection: React.FC<CrossSectionProps> = ({ system, glassThickness, isOpenable, lang, onClose }) => {
  const profileFill = "#334155";
  const strokeColor = "#0f172a";
  
  // Use config rules for schematic drawing
  const rules = system.correctionConfig || { sashOverlap: 6, glassClearance: 4 };
  const frameW = system.frameWidth;
  const frameD = system.frameWidth; // Simplified: usually depth ~ width for schematic
  const sashW = 55; // visual rep
  const sashD = sashW;
  
  // Scale factor to fit in svg
  const scale = 2.5; 
  
  // Dimensions
  const viewW = 400;
  const viewH = 300;
  
  // Coordinates
  const frameX = 50;
  const frameY = 150;
  
  // Sash coordinates (if openable)
  // Sash overlaps frame by `sashOverlap`
  const sashX = frameX + frameW - (rules.sashOverlap || 6); 
  
  // Removed unused variables (sashY, glassX, glassY, etc.) to fix TS6133
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-2xl relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
            <X size={24} />
        </button>
        
        <div className="p-6 border-b border-slate-800">
             <h3 className="text-xl font-bold text-white">{t(lang, 'sectionDetail')}</h3>
             <p className="text-sm text-slate-400 font-mono mt-1">
                 {system.name} • {isOpenable ? t(lang, 'turn') : t(lang, 'fixed')}
             </p>
        </div>
        
        <div className="p-8 flex justify-center bg-white/5 relative">
            {/* Grid bg */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '10px 10px' }} 
            />

            <svg width={viewW} height={viewH} viewBox={`0 0 ${viewW} ${viewH}`} className="drop-shadow-lg">
                <defs>
                    <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="4" stroke="#000000" strokeOpacity="0.3" strokeWidth="1" />
                    </pattern>
                </defs>

                {/* 1. FRAME (Sabit Kasa) */}
                <g>
                    {/* Main Box */}
                    <rect x={frameX} y={frameY} width={frameW * scale} height={frameD * scale} 
                        fill={profileFill} stroke={strokeColor} strokeWidth="2" />
                    {/* Thermal Break (Schematic) */}
                    <rect x={frameX + (frameW * scale * 0.4)} y={frameY} width={frameW * scale * 0.2} height={frameD * scale} 
                        fill="#1e293b" />
                </g>
                
                {/* 2. SASH (Kanat) - Only if openable */}
                {isOpenable && (
                    <g>
                         {/* Sash Box */}
                        <rect x={sashX + 20} y={frameY - (sashW * scale) + 20} width={sashW * scale} height={sashD * scale} 
                            fill={profileFill} stroke={strokeColor} strokeWidth="2" rx="4" />
                         {/* Gasket between Sash and Frame */}
                        <circle cx={sashX + 30} cy={frameY + 5} r="4" fill="black" />
                    </g>
                )}

                {/* 3. GLASS */}
                <g>
                     {/* Glass 1 */}
                    <rect x={(isOpenable ? sashX + 60 : frameX + 40)} y={0} width="4" height={frameY + 50} fill="#93c5fd" opacity="0.6" />
                     {/* Spacer */}
                    <rect x={(isOpenable ? sashX + 60 : frameX + 40) + 4} y={0} width={glassThickness * scale} height={frameY + 50} fill="url(#hatch)" stroke="#333" strokeWidth="0.5" />
                     {/* Glass 2 */}
                    <rect x={(isOpenable ? sashX + 60 : frameX + 40) + 4 + (glassThickness * scale)} y={0} width="4" height={frameY + 50} fill="#93c5fd" opacity="0.6" />
                    
                    {/* Glazing Bead (Cam Çıtası) */}
                    <rect x={(isOpenable ? sashX + 60 : frameX + 40) + 15 + (glassThickness * scale)} y={frameY} width="15" height="40" fill={profileFill} stroke={strokeColor} />
                </g>

                {/* DIMENSIONS */}
                <g>
                    {/* Frame Width Line */}
                    <line x1={frameX} y1={frameY + (frameD * scale) + 20} x2={frameX + (frameW * scale)} y2={frameY + (frameD * scale) + 20} stroke="white" strokeWidth="1" />
                    <text x={frameX + (frameW * scale)/2} y={frameY + (frameD * scale) + 35} fill="white" fontSize="12" textAnchor="middle">{frameW}mm</text>
                    
                    {/* Glass Clearance / Bini Payı indicators */}
                    {isOpenable && (
                         <text x={frameX} y={frameY - 10} fill="#94a3b8" fontSize="10" fontStyle="italic">
                             Overlap: {rules.sashOverlap}mm
                         </text>
                    )}
                </g>

            </svg>
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-500 text-center">
            * Schematic representation. Actual profile geometry depends on specific extrusion dies.
        </div>
      </div>
    </div>
  );
};

export default CrossSection;
