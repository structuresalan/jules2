import React from 'react';

interface WindZonesSVGProps {
  L: number;
  B: number;
  a: number;
}

export const WindZonesSVG: React.FC<WindZonesSVGProps> = ({ L, B, a }) => {
  // Safe bounds
  const safeL = Math.max(L, 10);
  const safeB = Math.max(B, 10);
  const safeA = Math.max(0, Math.min(a, safeL / 2, safeB / 2));

  // Determine drawing orientation: always draw the longer dimension horizontally for better UI fit
  const drawW = safeL >= safeB ? safeL : safeB;
  const drawH = safeL >= safeB ? safeB : safeL;

  // ViewBox Setup
  const pad = Math.max(drawW, drawH) * 0.1;
  const viewBoxW = drawW + pad * 2;
  const viewBoxH = drawH + pad * 2;

  // Drawing origin
  const x0 = pad;
  const y0 = pad;

  // Colors based on Tedds / standard engineering convention
  const colorZone1 = "#f8fafc"; // Light gray interior
  const colorZone2 = "#bbf7d0"; // Blue/Green edges
  const colorZone3 = "#fca5a5"; // Red corners

  return (
    <div className="w-full flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-lg">
      <div className="text-xs text-gray-500 mb-2 font-mono uppercase tracking-wider">C&C Roof Zones (Plan View)</div>
      
      <svg 
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} 
        className="w-full h-auto max-h-64 object-contain"
      >
        {/* Exterior Dimensions */}
        <text x={x0 + drawW/2} y={y0 - pad*0.2} fontSize={pad * 0.3} textAnchor="middle" fill="#64748b" fontFamily="monospace">
          {safeL >= safeB ? `L = ${safeL.toFixed(1)}'` : `B = ${safeB.toFixed(1)}'`}
        </text>
        <text x={x0 - pad*0.2} y={y0 + drawH/2} fontSize={pad * 0.3} textAnchor="end" dominantBaseline="middle" fill="#64748b" fontFamily="monospace">
          {safeL >= safeB ? `B = ${safeB.toFixed(1)}'` : `L = ${safeL.toFixed(1)}'`}
        </text>

        {/* Zone 1 (Base interior) */}
        <rect x={x0} y={y0} width={drawW} height={drawH} fill={colorZone1} stroke="#475569" strokeWidth={pad * 0.02} />

        {/* Zone 2 (Edges) */}
        {/* Top Edge */}
        <rect x={x0 + safeA} y={y0} width={drawW - 2*safeA} height={safeA} fill={colorZone2} stroke="#475569" strokeWidth={pad * 0.01} />
        {/* Bottom Edge */}
        <rect x={x0 + safeA} y={y0 + drawH - safeA} width={drawW - 2*safeA} height={safeA} fill={colorZone2} stroke="#475569" strokeWidth={pad * 0.01} />
        {/* Left Edge */}
        <rect x={x0} y={y0 + safeA} width={safeA} height={drawH - 2*safeA} fill={colorZone2} stroke="#475569" strokeWidth={pad * 0.01} />
        {/* Right Edge */}
        <rect x={x0 + drawW - safeA} y={y0 + safeA} width={safeA} height={drawH - 2*safeA} fill={colorZone2} stroke="#475569" strokeWidth={pad * 0.01} />

        {/* Zone 3 (Corners) */}
        {/* Top-Left */}
        <rect x={x0} y={y0} width={safeA} height={safeA} fill={colorZone3} stroke="#475569" strokeWidth={pad * 0.01} />
        {/* Top-Right */}
        <rect x={x0 + drawW - safeA} y={y0} width={safeA} height={safeA} fill={colorZone3} stroke="#475569" strokeWidth={pad * 0.01} />
        {/* Bottom-Left */}
        <rect x={x0} y={y0 + drawH - safeA} width={safeA} height={safeA} fill={colorZone3} stroke="#475569" strokeWidth={pad * 0.01} />
        {/* Bottom-Right */}
        <rect x={x0 + drawW - safeA} y={y0 + drawH - safeA} width={safeA} height={safeA} fill={colorZone3} stroke="#475569" strokeWidth={pad * 0.01} />

        {/* Labels for Zones */}
        <text x={x0 + drawW/2} y={y0 + drawH/2} fontSize={pad * 0.4} textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontWeight="bold">
          1
        </text>
        
        {/* Zone 2 Labels */}
        {safeA > pad * 0.5 && (
          <>
            <text x={x0 + drawW/2} y={y0 + safeA/2} fontSize={pad * 0.3} textAnchor="middle" dominantBaseline="middle" fill="#065f46" fontWeight="bold">2</text>
            <text x={x0 + drawW/2} y={y0 + drawH - safeA/2} fontSize={pad * 0.3} textAnchor="middle" dominantBaseline="middle" fill="#065f46" fontWeight="bold">2</text>
            <text x={x0 + safeA/2} y={y0 + drawH/2} fontSize={pad * 0.3} textAnchor="middle" dominantBaseline="middle" fill="#065f46" fontWeight="bold">2</text>
            <text x={x0 + drawW - safeA/2} y={y0 + drawH/2} fontSize={pad * 0.3} textAnchor="middle" dominantBaseline="middle" fill="#065f46" fontWeight="bold">2</text>
          </>
        )}

        {/* Zone 3 Labels */}
        {safeA > pad * 0.5 && (
          <>
            <text x={x0 + safeA/2} y={y0 + safeA/2} fontSize={pad * 0.3} textAnchor="middle" dominantBaseline="middle" fill="#991b1b" fontWeight="bold">3</text>
            <text x={x0 + drawW - safeA/2} y={y0 + safeA/2} fontSize={pad * 0.3} textAnchor="middle" dominantBaseline="middle" fill="#991b1b" fontWeight="bold">3</text>
            <text x={x0 + safeA/2} y={y0 + drawH - safeA/2} fontSize={pad * 0.3} textAnchor="middle" dominantBaseline="middle" fill="#991b1b" fontWeight="bold">3</text>
            <text x={x0 + drawW - safeA/2} y={y0 + drawH - safeA/2} fontSize={pad * 0.3} textAnchor="middle" dominantBaseline="middle" fill="#991b1b" fontWeight="bold">3</text>
          </>
        )}

        {/* Dimension 'a' line */}
        <line x1={x0} y1={y0 + drawH + pad*0.1} x2={x0 + safeA} y2={y0 + drawH + pad*0.1} stroke="#94a3b8" strokeWidth={pad*0.02} />
        <line x1={x0} y1={y0 + drawH + pad*0.05} x2={x0} y2={y0 + drawH + pad*0.15} stroke="#94a3b8" strokeWidth={pad*0.02} />
        <line x1={x0 + safeA} y1={y0 + drawH + pad*0.05} x2={x0 + safeA} y2={y0 + drawH + pad*0.15} stroke="#94a3b8" strokeWidth={pad*0.02} />
        <text x={x0 + safeA/2} y={y0 + drawH + pad*0.3} fontSize={pad * 0.25} textAnchor="middle" fill="#64748b" fontFamily="monospace">
          a = {safeA.toFixed(1)}'
        </text>

      </svg>
    </div>
  );
};
