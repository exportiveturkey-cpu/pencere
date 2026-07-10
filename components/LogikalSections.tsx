import React from 'react';
import { ProfileSystem, Language } from '../types';

interface SectionProps {
  width: number;
  height: number;
  system?: ProfileSystem;
  isOpenable?: boolean;
  lang: Language;
}

export const PlanKesitSVG: React.FC<SectionProps> = ({ width, height, system, isOpenable = false, lang }) => {
  // Styles for light/print background (dark slate paths, blue dimensions)
  const lineStroke = "#334155"; // slate-700
  const wallStroke = "#64748b"; // slate-500
  const thermalFill = "#1e293b"; // slate-800
  const dimensionStroke = "#2563eb"; // blue-600
  const glassFill = "#bae6fd"; // sky-200
  const textFill = "#0f172a"; // slate-900

  return (
    <svg 
      viewBox="0 0 160 65" 
      className="w-full h-full max-h-full max-w-full select-none"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Background Subtle Grid for Technical CAD feel */}
      <defs>
        <pattern id="grid-plan" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="160" height="65" fill="url(#grid-plan)" rx="8" />

      {/* --- LEFT PROFILE --- */}
      <g className="left-profile">
        {/* Outer Frame chamber */}
        <rect x="15" y="10" width="16" height="10" fill="#f8fafc" stroke={lineStroke} strokeWidth="1" />
        {/* Thermal Break Bridge */}
        <rect x="17" y="20" width="12" height="6" fill={thermalFill} stroke={lineStroke} strokeWidth="0.5" />
        {/* Inner Frame chamber */}
        <rect x="15" y="26" width="16" height="10" fill="#f8fafc" stroke={lineStroke} strokeWidth="1" />
        
        {/* Internal Wall Detail for multi-chamber effect */}
        <line x1="20" y1="10" x2="20" y2="20" stroke={wallStroke} strokeWidth="0.5" strokeDasharray="1,1" />
        <line x1="26" y1="26" x2="26" y2="36" stroke={wallStroke} strokeWidth="0.5" strokeDasharray="1,1" />
        
        {/* Gaskets */}
        <circle cx="31" cy="22" r="1.5" fill="#000" />
      </g>

      {/* --- SASH IF OPENABLE (Left-side overlapping sash) --- */}
      {isOpenable ? (
        <g className="left-sash">
          {/* Sash Profile Outer */}
          <rect x="31" y="12" width="14" height="8" fill="#f1f5f9" stroke={lineStroke} strokeWidth="1" />
          <rect x="33" y="20" width="10" height="4" fill={thermalFill} stroke={lineStroke} strokeWidth="0.5" />
          {/* Sash Profile Inner */}
          <rect x="31" y="24" width="14" height="8" fill="#f1f5f9" stroke={lineStroke} strokeWidth="1" />
          {/* Gasket */}
          <circle cx="31" cy="16" r="1" fill="#475569" />
          {/* Glass pocket lines */}
          <line x1="45" y1="15" x2="45" y2="29" stroke={lineStroke} strokeWidth="1" />
        </g>
      ) : null}

      {/* --- GLASS PANE --- */}
      <g className="glass-pane">
        {/* Double glazing representation */}
        {/* Glass 1 */}
        <rect 
          x={isOpenable ? "42" : "31"} 
          y="18" 
          width={isOpenable ? "76" : "98"} 
          height="3" 
          fill={glassFill} 
          stroke={lineStroke} 
          strokeWidth="0.5" 
        />
        {/* Air Gap */}
        <rect 
          x={isOpenable ? "42" : "31"} 
          y="21" 
          width={isOpenable ? "76" : "98"} 
          height="4" 
          fill="#ffffff" 
          opacity="0.5" 
          stroke="none" 
        />
        {/* Glass 2 */}
        <rect 
          x={isOpenable ? "42" : "31"} 
          y="25" 
          width={isOpenable ? "76" : "98"} 
          height="3" 
          fill={glassFill} 
          stroke={lineStroke} 
          strokeWidth="0.5" 
        />
      </g>

      {/* --- SASH IF OPENABLE (Right-side overlapping sash) --- */}
      {isOpenable ? (
        <g className="right-sash">
          {/* Sash Profile Outer */}
          <rect x="115" y="12" width="14" height="8" fill="#f1f5f9" stroke={lineStroke} strokeWidth="1" />
          <rect x="117" y="20" width="10" height="4" fill={thermalFill} stroke={lineStroke} strokeWidth="0.5" />
          {/* Sash Profile Inner */}
          <rect x="115" y="24" width="14" height="8" fill="#f1f5f9" stroke={lineStroke} strokeWidth="1" />
          {/* Gasket */}
          <circle cx="129" cy="16" r="1" fill="#475569" />
          {/* Glass pocket lines */}
          <line x1="115" y1="15" x2="115" y2="29" stroke={lineStroke} strokeWidth="1" />
        </g>
      ) : null}

      {/* --- RIGHT PROFILE --- */}
      <g className="right-profile">
        {/* Outer Frame chamber */}
        <rect x="129" y="10" width="16" height="10" fill="#f8fafc" stroke={lineStroke} strokeWidth="1" />
        {/* Thermal Break Bridge */}
        <rect x="131" y="20" width="12" height="6" fill={thermalFill} stroke={lineStroke} strokeWidth="0.5" />
        {/* Inner Frame chamber */}
        <rect x="129" y="26" width="16" height="10" fill="#f8fafc" stroke={lineStroke} strokeWidth="1" />
        
        {/* Internal Wall Detail */}
        <line x1="139" y1="10" x2="139" y2="20" stroke={wallStroke} strokeWidth="0.5" strokeDasharray="1,1" />
        <line x1="133" y1="26" x2="133" y2="36" stroke={wallStroke} strokeWidth="0.5" strokeDasharray="1,1" />

        {/* Gaskets */}
        <circle cx="129" cy="22" r="1.5" fill="#000" />
      </g>

      {/* --- CAD TEXT LABELS --- */}
      <text x="15" y="8" fill="#94a3b8" fontSize="5" fontWeight="bold" letterSpacing="0.5">EXTERIOR (DIŞ)</text>
      <text x="15" y="44" fill="#94a3b8" fontSize="5" fontWeight="bold" letterSpacing="0.5">INTERIOR (İÇ)</text>
      <text x="80" y="34" fill="#64748b" fontSize="4.5" fontWeight="black" textAnchor="middle" opacity="0.8">
        {lang === 'tr' ? 'PLAN KESİTİ' : 'PLAN SECTION (X-X)'}
      </text>

      {/* --- BLUE DIMENSION LINE --- */}
      <g className="dimension">
        {/* Line */}
        <line x1="15" y1="52" x2="145" y2="52" stroke={dimensionStroke} strokeWidth="0.75" />
        
        {/* Left Arrow/Tick */}
        <line x1="12" y1="55" x2="18" y2="49" stroke={dimensionStroke} strokeWidth="1.2" />
        <line x1="15" y1="49" x2="15" y2="55" stroke={dimensionStroke} strokeWidth="0.5" />

        {/* Right Arrow/Tick */}
        <line x1="142" y1="55" x2="148" y2="49" stroke={dimensionStroke} strokeWidth="1.2" />
        <line x1="145" y1="49" x2="145" y2="55" stroke={dimensionStroke} strokeWidth="0.5" />

        {/* Value Text */}
        <rect x="67" y="47" width="26" height="9" fill="#ffffff" rx="2" />
        <text 
          x="80" 
          y="54" 
          fill={dimensionStroke} 
          fontSize="7" 
          fontWeight="black" 
          fontFamily="monospace"
          textAnchor="middle"
        >
          {width} mm
        </text>
      </g>
    </svg>
  );
};

export const BoyKesitSVG: React.FC<SectionProps> = ({ width, height, system, isOpenable = false, lang }) => {
  // Styles for light/print background
  const lineStroke = "#334155"; // slate-700
  const wallStroke = "#64748b"; // slate-500
  const thermalFill = "#1e293b"; // slate-800
  const dimensionStroke = "#2563eb"; // blue-600
  const glassFill = "#bae6fd"; // sky-200
  const textFill = "#0f172a"; // slate-900

  return (
    <svg 
      viewBox="0 0 65 160" 
      className="w-full h-full max-h-full max-w-full select-none"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Background Subtle Grid for Technical CAD feel */}
      <defs>
        <pattern id="grid-boy" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="65" height="160" fill="url(#grid-boy)" rx="8" />

      {/* --- TOP PROFILE (Ust Kasa) --- */}
      <g className="top-profile">
        {/* Outer Frame chamber */}
        <rect x="10" y="15" width="10" height="16" fill="#f8fafc" stroke={lineStroke} strokeWidth="1" />
        {/* Thermal Break Bridge */}
        <rect x="20" y="17" width="6" height="12" fill={thermalFill} stroke={lineStroke} strokeWidth="0.5" />
        {/* Inner Frame chamber */}
        <rect x="26" y="15" width="10" height="16" fill="#f8fafc" stroke={lineStroke} strokeWidth="1" />
        
        {/* Internal Wall Detail */}
        <line x1="10" y1="20" x2="20" y2="20" stroke={wallStroke} strokeWidth="0.5" strokeDasharray="1,1" />
        <line x1="26" y1="26" x2="36" y2="26" stroke={wallStroke} strokeWidth="0.5" strokeDasharray="1,1" />

        {/* Gasket */}
        <circle cx="22" cy="31" r="1.5" fill="#000" />
      </g>

      {/* --- SASH IF OPENABLE (Top sash profile) --- */}
      {isOpenable ? (
        <g className="top-sash">
          {/* Sash Profile Outer */}
          <rect x="12" y="31" width="8" height="14" fill="#f1f5f9" stroke={lineStroke} strokeWidth="1" />
          <rect x="20" y="33" width="4" height="10" fill={thermalFill} stroke={lineStroke} strokeWidth="0.5" />
          {/* Sash Profile Inner */}
          <rect x="24" y="31" width="8" height="14" fill="#f1f5f9" stroke={lineStroke} strokeWidth="1" />
          {/* Gasket */}
          <circle cx="16" cy="31" r="1" fill="#475569" />
        </g>
      ) : null}

      {/* --- GLASS PANE --- */}
      <g className="glass-pane">
        {/* Double glazing representation */}
        {/* Glass 1 */}
        <rect 
          x="18" 
          y={isOpenable ? "42" : "31"} 
          width="3" 
          height={isOpenable ? "76" : "98"} 
          fill={glassFill} 
          stroke={lineStroke} 
          strokeWidth="0.5" 
        />
        {/* Air Gap */}
        <rect 
          x="21" 
          y={isOpenable ? "42" : "31"} 
          width="4" 
          height={isOpenable ? "76" : "98"} 
          fill="#ffffff" 
          opacity="0.5" 
          stroke="none" 
        />
        {/* Glass 2 */}
        <rect 
          x="25" 
          y={isOpenable ? "42" : "31"} 
          width="3" 
          height={isOpenable ? "76" : "98"} 
          fill={glassFill} 
          stroke={lineStroke} 
          strokeWidth="0.5" 
        />
      </g>

      {/* --- SASH IF OPENABLE (Bottom sash profile) --- */}
      {isOpenable ? (
        <g className="bottom-sash">
          {/* Sash Profile Outer */}
          <rect x="12" y="115" width="8" height="14" fill="#f1f5f9" stroke={lineStroke} strokeWidth="1" />
          <rect x="20" y="117" width="4" height="10" fill={thermalFill} stroke={lineStroke} strokeWidth="0.5" />
          {/* Sash Profile Inner */}
          <rect x="24" y="115" width="8" height="14" fill="#f1f5f9" stroke={lineStroke} strokeWidth="1" />
          {/* Gasket */}
          <circle cx="16" cy="129" r="1" fill="#475569" />
        </g>
      ) : null}

      {/* --- BOTTOM PROFILE (Alt Kasa) --- */}
      <g className="bottom-profile">
        {/* Outer Frame chamber */}
        <rect x="10" y="129" width="10" height="16" fill="#f8fafc" stroke={lineStroke} strokeWidth="1" />
        {/* Thermal Break Bridge */}
        <rect x="20" y="131" width="6" height="12" fill={thermalFill} stroke={lineStroke} strokeWidth="0.5" />
        {/* Inner Frame chamber */}
        <rect x="26" y="129" width="10" height="16" fill="#f8fafc" stroke={lineStroke} strokeWidth="1" />
        
        {/* Internal Wall Detail */}
        <line x1="10" y1="134" x2="20" y2="134" stroke={wallStroke} strokeWidth="0.5" strokeDasharray="1,1" />
        <line x1="26" y1="139" x2="36" y2="139" stroke={wallStroke} strokeWidth="0.5" strokeDasharray="1,1" />

        {/* Gasket */}
        <circle cx="22" cy="129" r="1.5" fill="#000" />
      </g>

      {/* --- CAD TEXT LABELS --- */}
      <text x="8" y="12" fill="#94a3b8" fontSize="4.5" fontWeight="bold" letterSpacing="0.2" transform="rotate(-90 8 12)">EXTERIOR (DIŞ)</text>
      <text x="41" y="12" fill="#94a3b8" fontSize="4.5" fontWeight="bold" letterSpacing="0.2" transform="rotate(-90 41 12)">INTERIOR (İÇ)</text>
      
      {/* Rotated text for section title */}
      <text 
        x="33" 
        y="80" 
        fill="#64748b" 
        fontSize="4.5" 
        fontWeight="black" 
        textAnchor="middle" 
        transform="rotate(-90 33 80)"
        opacity="0.8"
      >
        {lang === 'tr' ? 'BOY KESİTİ' : 'VERTICAL SECTION (Y-Y)'}
      </text>

      {/* --- BLUE DIMENSION LINE (Right Side) --- */}
      <g className="dimension">
        {/* Line */}
        <line x1="52" y1="15" x2="52" y2="145" stroke={dimensionStroke} strokeWidth="0.75" />
        
        {/* Top Arrow/Tick */}
        <line x1="49" y1="12" x2="55" y2="18" stroke={dimensionStroke} strokeWidth="1.2" />
        <line x1="49" y1="15" x2="55" y2="15" stroke={dimensionStroke} strokeWidth="0.5" />

        {/* Bottom Arrow/Tick */}
        <line x1="49" y1="142" x2="55" y2="148" stroke={dimensionStroke} strokeWidth="1.2" />
        <line x1="49" y1="145" x2="55" y2="145" stroke={dimensionStroke} strokeWidth="0.5" />

        {/* Value Text (Rotated) */}
        <rect x="47" y="67" width="9" height="26" fill="#ffffff" rx="2" />
        <text 
          x="53" 
          y="80" 
          fill={dimensionStroke} 
          fontSize="7" 
          fontWeight="black" 
          fontFamily="monospace"
          textAnchor="middle"
          transform="rotate(-90 53 80)"
        >
          {height} mm
        </text>
      </g>
    </svg>
  );
};
