import React from 'react';

interface SteelCrossSectionProps {
  d: number;  // Depth
  bf: number; // Flange Width
  tf: number; // Flange Thickness
  tw: number; // Web Thickness
}

export const SteelCrossSection: React.FC<SteelCrossSectionProps> = ({ d, bf, tf, tw }) => {
  // Prevent zero or negative dimensions
  const safeD = Math.max(d, 1);
  const safeBf = Math.max(bf, 1);
  const safeTf = Math.max(tf, 0.1);
  const safeTw = Math.max(tw, 0.1);

  // SVG Padding and ViewBox
  const pad = Math.max(safeD, safeBf) * 0.15;
  const viewBoxW = safeBf + pad * 2;
  const viewBoxH = safeD + pad * 2;

  // Center the shape in the viewBox
  const centerX = viewBoxW / 2;
  const startY = pad;

  // Path commands for an I-Beam (Wide Flange)
  // Starts top-left of top flange, goes clockwise
  const pathData = `
    M ${centerX - safeBf/2} ${startY} 
    H ${centerX + safeBf/2} 
    V ${startY + safeTf} 
    H ${centerX + safeTw/2} 
    V ${startY + safeD - safeTf} 
    H ${centerX + safeBf/2} 
    V ${startY + safeD} 
    H ${centerX - safeBf/2} 
    V ${startY + safeD - safeTf} 
    H ${centerX - safeTw/2} 
    V ${startY + safeTf} 
    H ${centerX - safeBf/2} 
    Z
  `;

  return (
    <div className="w-full flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="text-xs text-gray-500 mb-2 font-mono uppercase tracking-wider">Cross-Section Diagram</div>
      <svg 
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} 
        className="w-full h-auto max-h-64 object-contain"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Dimensions Text */}
        <text x={centerX} y={pad - 1} fontSize={pad * 0.3} textAnchor="middle" fill="#64748b" fontFamily="monospace">
          b_f = {bf.toFixed(2)}"
        </text>
        <text x={viewBoxW - pad + 1} y={viewBoxH / 2} fontSize={pad * 0.3} textAnchor="start" dominantBaseline="middle" fill="#64748b" fontFamily="monospace">
          d = {d.toFixed(2)}"
        </text>

        {/* I-Beam Shape */}
        <path 
          d={pathData} 
          fill="#cbd5e1" 
          stroke="#475569" 
          strokeWidth={pad * 0.05} 
          strokeLinejoin="round"
        />

        {/* Flange Thickness Dimension Line */}
        <line 
          x1={centerX - safeBf/2 - pad*0.1} 
          y1={startY} 
          x2={centerX - safeBf/2 - pad*0.3} 
          y2={startY} 
          stroke="#94a3b8" 
          strokeWidth={pad * 0.02} 
        />
        <line 
          x1={centerX - safeBf/2 - pad*0.1} 
          y1={startY + safeTf} 
          x2={centerX - safeBf/2 - pad*0.3} 
          y2={startY + safeTf} 
          stroke="#94a3b8" 
          strokeWidth={pad * 0.02} 
        />
        <text x={centerX - safeBf/2 - pad*0.4} y={startY + safeTf/2} fontSize={pad * 0.25} textAnchor="end" dominantBaseline="middle" fill="#64748b" fontFamily="monospace">
          t_f = {tf.toFixed(3)}"
        </text>

        {/* Web Thickness Indicator */}
        <text x={centerX + safeTw/2 + pad*0.2} y={viewBoxH / 2} fontSize={pad * 0.25} textAnchor="start" dominantBaseline="middle" fill="#64748b" fontFamily="monospace">
          t_w = {tw.toFixed(3)}"
        </text>
      </svg>
    </div>
  );
};
