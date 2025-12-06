import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  theme?: 'dark' | 'light';
}

const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10", showText = true, theme = 'dark' }) => {
  const primaryColor = theme === 'dark' ? '#3b82f6' : '#2563eb'; // Blue-500 : Blue-600
  const secondaryColor = theme === 'dark' ? '#94a3b8' : '#475569'; // Slate-400 : Slate-600
  const textColor = theme === 'dark' ? '#f8fafc' : '#0f172a'; // Slate-50 : Slate-900

  return (
    <div className="flex items-center gap-3 select-none">
      <svg 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className={className}
      >
        {/* Isometric Corner / 'A' shape base */}
        <path 
          d="M20 80 L20 35 L50 15 L80 35 L80 80" 
          stroke={primaryColor} 
          strokeWidth="8" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        
        {/* Internal Profile Structure (Cross section feel) */}
        <path 
          d="M35 80 L35 45 L50 35 L65 45 L65 80" 
          stroke={secondaryColor} 
          strokeWidth="4" 
          strokeLinejoin="round"
        />
        
        {/* Horizontal Crossbar (Creating the A) */}
        <path 
          d="M20 60 L80 60" 
          stroke={primaryColor} 
          strokeWidth="6" 
        />

        {/* Technical Center Line */}
        <path 
          d="M50 15 L50 35" 
          stroke={secondaryColor} 
          strokeWidth="2" 
        />
        
        {/* Measurement Dots */}
        <circle cx="20" cy="80" r="3" fill={primaryColor} />
        <circle cx="80" cy="80" r="3" fill={primaryColor} />
        <circle cx="50" cy="15" r="3" fill={primaryColor} />
      </svg>
      
      {showText && (
        <div className="flex flex-col justify-center">
          <span className="font-bold text-xl tracking-tight leading-none" style={{ color: textColor }}>
            Alu<span style={{ color: primaryColor }}>metric</span>
          </span>
          <span className="text-[9px] uppercase tracking-widest opacity-60 font-medium leading-none mt-1" style={{ color: textColor }}>
            Engineering Suite
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;