import React from 'react';

interface ConcreteCrossSectionProps {
  width: number;       // inches
  height: number;      // inches
  cover: number;       // inches
  rebarDiameter: number; // inches
  rebarQty: number;    // count
  isSlab?: boolean;
}

export const ConcreteCrossSection: React.FC<ConcreteCrossSectionProps> = ({
  width,
  height,
  cover,
  rebarDiameter,
  rebarQty,
  isSlab = false
}) => {
  // Prevent zero or negative dimensions to avoid SVG errors
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);

  // SVG Coordinate System Padding
  const pad = Math.max(safeWidth, safeHeight) * 0.1;
  const viewBoxW = safeWidth + pad * 2;
  const viewBoxH = safeHeight + pad * 2;

  // Stirrup estimation (only for beam)
  const stirrupDia = isSlab ? 0 : 0.5; // Assume #4 stirrup for visual purposes
  
  // Calculate rebar positions
  const rebarY = safeHeight - cover - stirrupDia - (rebarDiameter / 2);
  
  const rebars = [];
  if (isSlab) {
    // For a slab (12" strip), we visually represent the spacing.
    // If spacing is e.g. 12", we just draw one bar in the middle of the 12" block.
    // If spacing is 6", we draw two bars.
    // rebarQty here is (12 / spacing)
    const visualQty = Math.max(1, Math.floor(rebarQty));
    const step = safeWidth / visualQty;
    for (let i = 0; i < visualQty; i++) {
      rebars.push(step / 2 + i * step);
    }
  } else {
    // For a beam, bars are clustered at the bottom.
    // Spaced evenly between the vertical legs of the stirrups.
    const innerWidth = safeWidth - (2 * cover) - (2 * stirrupDia) - rebarDiameter;
    if (rebarQty <= 1) {
      rebars.push(safeWidth / 2);
    } else {
      const step = innerWidth / (rebarQty - 1);
      const startX = cover + stirrupDia + (rebarDiameter / 2);
      for (let i = 0; i < rebarQty; i++) {
        rebars.push(startX + i * step);
      }
    }
  }

  return (
    <div className="w-full flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="text-xs text-gray-500 mb-2 font-mono uppercase tracking-wider">Cross-Section Diagram</div>
      <svg 
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} 
        className="w-full h-auto max-h-64 object-contain"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Dimensions Text */}
        <text x={pad + safeWidth/2} y={pad - 1} fontSize={pad * 0.3} textAnchor="middle" fill="#64748b" fontFamily="monospace">
          b = {width}"
        </text>
        <text x={viewBoxW - pad + 1} y={pad + safeHeight/2} fontSize={pad * 0.3} textAnchor="start" dominantBaseline="middle" fill="#64748b" fontFamily="monospace">
          h = {height}"
        </text>

        {/* Concrete Outline */}
        <rect 
          x={pad} 
          y={pad} 
          width={safeWidth} 
          height={safeHeight} 
          fill="#e2e8f0" 
          stroke="#94a3b8" 
          strokeWidth={Math.max(0.1, pad * 0.02)} 
        />

        {/* Stirrup (Beams Only) */}
        {!isSlab && (
          <rect 
            x={pad + cover} 
            y={pad + cover} 
            width={safeWidth - 2 * cover} 
            height={safeHeight - 2 * cover} 
            fill="none" 
            stroke="#334155" 
            strokeWidth={stirrupDia || 0.1} 
            rx={stirrupDia * 2}
          />
        )}

        {/* Rebars */}
        {rebars.map((x, i) => (
          <circle 
            key={i} 
            cx={pad + x} 
            cy={pad + rebarY} 
            r={rebarDiameter / 2} 
            fill="#1e293b" 
          />
        ))}

        {/* Cover / d line indicators */}
        <line 
          x1={pad - pad*0.2} 
          y1={pad} 
          x2={pad} 
          y2={pad} 
          stroke="#cbd5e1" 
          strokeWidth={pad * 0.01} 
        />
        <line 
          x1={pad - pad*0.2} 
          y1={pad + rebarY} 
          x2={pad} 
          y2={pad + rebarY} 
          stroke="#cbd5e1" 
          strokeWidth={pad * 0.01} 
        />
        <text x={pad - pad*0.3} y={pad + rebarY/2} fontSize={pad * 0.25} textAnchor="end" dominantBaseline="middle" fill="#94a3b8" fontFamily="monospace">
          d
        </text>
      </svg>
    </div>
  );
};
