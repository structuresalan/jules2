import React, { useState } from 'react';
import { Wind, Download } from 'lucide-react';
import { usePDF } from 'react-to-pdf';
import snowData from '../data/asce/snow_factors.json';
import { IBC_TO_ASCE_MAP } from '../data/ibc_mapping';
import windData from '../data/asce/wind_factors.json';
import { VariableInput } from '../components/VariableInput';
import { WindZonesSVG } from '../components/WindZonesSVG';
import { WindElevationSVG } from '../components/WindElevationSVG';
import { WindPlanSVG } from '../components/WindPlanSVG';
import windCpData from '../data/asce/wind_cp_tables.json';

type ExposureCategory = "B" | "C" | "D";
type RoofExposure = "Fully Exposed" | "Partially Exposed" | "Sheltered";

export const Loads: React.FC = () => {
  const { toPDF, targetRef } = usePDF({filename: 'asce-snow-load-report.pdf'});
  
  // Code Logic
  const [ibcYear, setIbcYear] = useState('IBC 2018');
  const [asceYear, setAsceYear] = useState(IBC_TO_ASCE_MAP['IBC 2018']);
  const [isOverridden, setIsOverridden] = useState(false);
  
  // Navigation
  const [activeTab, setActiveTab] = useState('Snow');

  // Load appropriate year data, cast back to the structure we expect.
  // The JSON structure guarantees ASCE 7-05 through 7-22 have these keys.
  const activeSnowData = (snowData as Record<string, typeof snowData["ASCE 7-16"]>)[asceYear];

  // Inputs
  const [pg, setPg] = useState(20); // Ground snow load (psf)
  const [roofPitch, setRoofPitch] = useState(0); // degrees
  
  // Categorical Inputs
  const [riskCategory, setRiskCategory] = useState<"I"|"II"|"III"|"IV">("II");
  const [thermalCondition, setThermalCondition] = useState("All structures except as indicated below");
  const [terrain, setTerrain] = useState<ExposureCategory>("C");
  const [roofExposure, setRoofExposure] = useState<RoofExposure>("Partially Exposed");
  const [surfaceCondition, setSurfaceCondition] = useState<"Slippery"|"Non-Slippery">("Non-Slippery");
  const [roofShape, setRoofShape] = useState<"Flat"|"Monoslope"|"Hip and Gable"|"Curved">("Flat");

  // Dynamically extract ASCE Factors based on the ACTIVE YEAR
  const isAsce22 = asceYear === 'ASCE 7-22';
  
  // In ASCE 7-22, Is is baked into the reliability-targeted ground snow load pg, so we effectively treat it as 1.0 for math, but we hide it in the UI.
  const Is = activeSnowData.importance_factor_Is[riskCategory];
  const mathIs = isAsce22 ? 1.0 : Is;
  
  const Ct = activeSnowData.thermal_factor_Ct[thermalCondition as keyof typeof activeSnowData.thermal_factor_Ct];
  const Ce = activeSnowData.exposure_factor_Ce[terrain][roofExposure];

  // Calculation: pf = 0.7 * Ce * Ct * (Is) * pg
  const pf_raw = 0.7 * Ce * Ct * mathIs * pg;
  
  // ASCE 7 Minimum Snow Load Check (pm) for low-slope roofs
  // Applies if roof slope < 15 deg (for normal roofs) or < W/50 for curved
  const pm = isAsce22 
    ? (pg <= 20 ? pg : 20)
    : (pg <= 20 ? Is * pg : Is * 20);

  const applyPm = roofPitch < 15;
  const pf = applyPm ? Math.max(pf_raw, pm) : pf_raw;
  const controls = (applyPm && pf === pm) ? 'Minimum (pm) Controls' : 'Calculated (pf_calc) Controls';

  // Slope Factor Cs Calculation
  const ctKey = Ct <= 1.0 ? "Ct<=1.0" : "Ct>=1.1";
  const limitAngle = activeSnowData.roof_slope_factor_Cs[surfaceCondition][ctKey];
  
  const Cs = roofShape === "Flat" || roofPitch <= limitAngle 
    ? 1.0 
    : roofPitch >= 70 
      ? 0.0 
      : 1.0 - (roofPitch - limitAngle) / (70 - limitAngle);

  // Final Sloped Roof Snow Load
  const ps = Cs * pf;


  // --- Wind Load Logic ---
  const activeWindData = (windData as Record<string, typeof windData["ASCE 7-16"]>)[asceYear];
  
  // Wind Inputs
  const [vWind, setVWind] = useState(115); // mph
  const [meanRoofHeight, setMeanRoofHeight] = useState(30); // ft
  const [bldgLength, setBldgLength] = useState(100); // ft (L - parallel to ridge usually)
  const [bldgWidth, setBldgWidth] = useState(60); // ft (B - normal to ridge)
  const [windProcedure, setWindProcedure] = useState<string>("MWFRS (Directional)");
  const [windExposure, setWindExposure] = useState<ExposureCategory>("C");
  const [enclosureType, setEnclosureType] = useState<string>("Enclosed");
  const [kzt, setKzt] = useState(1.0); // Topographic factor
  const [groundElevation, setGroundElevation] = useState(0); // ft (For Ke calculation in ASCE 7-16+)

  // Wind Math
  const Kd = 0.85; // Hardcoded for Building MWFRS/C&C per user request
  const alpha = activeWindData.exposure_constants[windExposure].alpha;
  const zg = activeWindData.exposure_constants[windExposure].zg;

  // Calculate Kz (Exposure Coefficient)
  const z = Math.max(15, meanRoofHeight); // ASCE 7 limits z to minimum 15ft for calculations
  const Kz = z < 15 
    ? 2.01 * Math.pow(15 / zg, 2 / alpha) 
    : 2.01 * Math.pow(z / zg, 2 / alpha);
  
  // Calculate Ke (Ground Elevation Factor) - Introduced in ASCE 7-16
  const isAscePre16 = asceYear === 'ASCE 7-10' || asceYear === 'ASCE 7-05';
  let Ke = 1.0;
  if (!isAscePre16 && groundElevation > 0) {
    Ke = Math.exp(-0.0000362 * groundElevation);
  }

  // Velocity Pressure (qz) in psf
  const qz = 0.00256 * Kz * kzt * Kd * Ke * Math.pow(vWind, 2);

  // ASCE Edge Dimension 'a' Calculation
  const leastBldgDim = Math.min(bldgLength, bldgWidth);
  const a_calc1 = 0.10 * leastBldgDim;
  const a_calc2 = 0.40 * meanRoofHeight;
  let a_dim = Math.max(Math.min(a_calc1, a_calc2), 3, 0.04 * leastBldgDim);
  // Ensure a isn't absurdly large relative to the building (can happen with weird inputs)
  a_dim = Math.min(a_dim, leastBldgDim / 2);

  // --- MWFRS Wall Pressures ---
  // Internal Pressure Coefficient
  const gcpi = (windCpData.gcpi as Record<string, number[]>)[enclosureType];
  const gcpi_pos = gcpi[0];
  const gcpi_neg = gcpi[1];
  
  // External Pressure Coefficients (Cp)
  const cp_windward = windCpData.wall_cp.windward;
  const cp_side = windCpData.wall_cp.side;
  
  const G = windCpData.gust_effect_factor_G;

  // Helper to calculate MWFRS case based on wind direction
  const calculateMWFRSCase = (windDirL: number, windDirB: number) => {
    const lb_ratio = windDirL / windDirB;
    let cp_leeward = windCpData.wall_cp.leeward["0_to_1"];
    if (lb_ratio > 1 && lb_ratio <= 2) {
      cp_leeward = windCpData.wall_cp.leeward["1_to_2"];
    } else if (lb_ratio > 2) {
      cp_leeward = windCpData.wall_cp.leeward["greater_than_2"];
    }

    const p_ww_max = qz * G * cp_windward - qz * gcpi_neg;
    const p_ww_min = qz * G * cp_windward - qz * gcpi_pos;

    const p_lw_max = qz * G * cp_leeward - qz * gcpi_neg;
    const p_lw_min = qz * G * cp_leeward - qz * gcpi_pos;

    const p_side_max = qz * G * cp_side - qz * gcpi_neg;
    const p_side_min = qz * G * cp_side - qz * gcpi_pos;

    return { lb_ratio, cp_leeward, p_ww_max, p_ww_min, p_lw_max, p_lw_min, p_side_max, p_side_min };
  };

  // Case 1: Wind X (Parallel to L) -> Length is L, Width is B
  const caseX = calculateMWFRSCase(bldgLength, bldgWidth);
  // Case 2: Wind Y (Parallel to B) -> Length is B, Width is L
  const caseY = calculateMWFRSCase(bldgWidth, bldgLength);

  // --- C&C Interpolation Engine ---
  const calcGCp = (zoneKey: string, area: number, isPositive: boolean) => {
    const data = (windCpData.cnc_gcp as Record<string, typeof windCpData.cnc_gcp.roof_zone_1>)[zoneKey];
    const val10 = isPositive ? data.pos_10 : data.neg_10;
    const val500 = isPositive ? data.pos_500 : data.neg_500;
    
    if (area <= 10) return val10;
    if (area >= 500) return val500;
    
    // Logarithmic interpolation: C = C10 - (C10 - C500) * log10(A/10) / log10(500/10)
    // Note: log10(500/10) = log10(50) ≈ 1.69897
    const interp = val10 - (val10 - val500) * (Math.log10(area / 10) / Math.log10(50));
    return Number(interp.toFixed(2));
  };

  const cncAreas = [10, 20, 50, 100, 500];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header and Global Settings */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <Wind className="text-blue-600" />
            Environmental Loads
          </h1>
          <p className="mt-2 text-gray-500">Calculate gravity and lateral environmental loads.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-lg border border-gray-200 shadow-sm w-full lg:w-auto">
          {/* Top Right Code Selectors */}
          <div className="flex items-center gap-3 pr-4 border-r border-gray-200">
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-semibold">IBC</div>
              <select 
                value={ibcYear} 
                onChange={(e) => {
                  const newIbc = e.target.value;
                  setIbcYear(newIbc);
                  setAsceYear(IBC_TO_ASCE_MAP[newIbc] || "ASCE 7-16");
                  setIsOverridden(false);
                }}
                className="text-sm font-medium bg-transparent focus:outline-none focus:ring-0 cursor-pointer text-gray-900"
              >
                {Object.keys(IBC_TO_ASCE_MAP).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="text-[10px] text-gray-500 uppercase font-semibold">ASCE</div>
                {isOverridden && (
                  <span className="absolute -top-1 -right-2 transform translate-x-full text-[8px] font-bold bg-amber-100 text-amber-800 px-1 rounded border border-amber-200">
                    OVERRIDE
                  </span>
                )}
              </div>
              <select 
                value={asceYear} 
                onChange={(e) => {
                  setAsceYear(e.target.value);
                  setIsOverridden(e.target.value !== IBC_TO_ASCE_MAP[ibcYear]);
                }}
                className="text-sm font-medium bg-transparent focus:outline-none focus:ring-0 cursor-pointer text-gray-900"
              >
                <option>ASCE 7-22</option>
                <option>ASCE 7-16</option>
                <option>ASCE 7-10</option>
                <option>ASCE 7-05</option>
              </select>
            </div>
          </div>

          <button 
            onClick={() => toPDF()}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors text-sm font-medium shrink-0"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Navigation Sub-tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['Snow', 'Wind', 'Dead', 'Live'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab} Loads
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div ref={targetRef} className="pt-2">
        {activeTab === 'Snow' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Input Section */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Snow Parameters</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ground Snow Load, pg (psf)</label>
                    <input type="number" value={pg} onChange={(e) => setPg(Number(e.target.value))} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                  </div>

                  {!isAsce22 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Risk Category</label>
                      <select 
                        value={riskCategory} 
                        onChange={(e) => setRiskCategory(e.target.value as "I"|"II"|"III"|"IV")}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-gray-50"
                      >
                        {Object.keys(activeSnowData.importance_factor_Is).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Thermal Condition</label>
                    <select 
                      value={thermalCondition} 
                      onChange={(e) => setThermalCondition(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-gray-50"
                    >
                      {Object.keys(activeSnowData.thermal_factor_Ct).map(cond => (
                        <option key={cond} value={cond}>{cond}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Terrain</label>
                      <select 
                        value={terrain} 
                        onChange={(e) => setTerrain(e.target.value as ExposureCategory)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-gray-50"
                      >
                        {Object.keys(activeSnowData.exposure_factor_Ce).map(t => (
                          <option key={t} value={t}>Exposure {t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Roof Exposure</label>
                      <select 
                        value={roofExposure} 
                        onChange={(e) => setRoofExposure(e.target.value as RoofExposure)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-gray-50"
                      >
                        {Object.keys(activeSnowData.exposure_factor_Ce["B"]).map(exp => (
                          <option key={exp} value={exp}>{exp}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Roof Geometry</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Roof Shape</label>
                        <select 
                          value={roofShape} 
                          onChange={(e) => {
                            setRoofShape(e.target.value as "Flat"|"Monoslope"|"Hip and Gable"|"Curved");
                            if (e.target.value === "Flat") setRoofPitch(0);
                          }}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-gray-50"
                        >
                          <option>Flat</option>
                          <option>Monoslope</option>
                          <option>Hip and Gable</option>
                          <option>Curved</option>
                        </select>
                      </div>
                      
                      {roofShape !== "Flat" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Roof Pitch (°)</label>
                            <input type="number" value={roofPitch} onChange={(e) => setRoofPitch(Number(e.target.value))} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Surface Condition</label>
                            <select 
                              value={surfaceCondition} 
                              onChange={(e) => setSurfaceCondition(e.target.value as "Slippery"|"Non-Slippery")}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-gray-50"
                            >
                              <option>Non-Slippery</option>
                              <option>Slippery</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Output Section (Tedds Style) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm h-full">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 border-b pb-2">Calculation Output: {asceYear}</h2>
                
                {/* Calculation Block */}
                <div className="font-mono text-sm text-gray-800 space-y-4">
                  
                  <div className="border-l-4 border-blue-500 pl-4 py-1 mb-6">
                    <h3 className="font-bold text-gray-900 uppercase">Flat Roof Snow Load</h3>
                  </div>

                  {/* Factors */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 mb-6">
                    <div>Ground snow load</div>
                    <div>p<sub className="text-[10px]">g</sub> = <strong>{pg} psf</strong></div>
                    
                    {!isAsce22 && (
                      <>
                        <div>Importance factor (Table 1.5-2)</div>
                        <div>I<sub className="text-[10px]">s</sub> = <strong>{Is.toFixed(2)}</strong></div>
                      </>
                    )}
                    
                    <div>Thermal factor (Table 7.3-2)</div>
                    <div>C<sub className="text-[10px]">t</sub> = <strong>{Ct.toFixed(2)}</strong></div>
                    
                    <div>Exposure factor (Table 7.3-1)</div>
                    <div>C<sub className="text-[10px]">e</sub> = <strong>{Ce.toFixed(2)}</strong></div>
                  </div>

                  <div className="my-4 border-t border-gray-200"></div>

                  {/* Equation */}
                  <div className="space-y-2">
                    <div className="text-gray-500">Calculate flat roof snow load (Eq. 7.3-1)</div>
                    {isAsce22 ? (
                      <>
                        <div>p<sub className="text-[10px]">f_calc</sub> = 0.7 × C<sub className="text-[10px]">e</sub> × C<sub className="text-[10px]">t</sub> × p<sub className="text-[10px]">g</sub></div>
                        <div>p<sub className="text-[10px]">f_calc</sub> = 0.7 × {Ce} × {Ct} × {pg}</div>
                      </>
                    ) : (
                      <>
                        <div>p<sub className="text-[10px]">f_calc</sub> = 0.7 × C<sub className="text-[10px]">e</sub> × C<sub className="text-[10px]">t</sub> × I<sub className="text-[10px]">s</sub> × p<sub className="text-[10px]">g</sub></div>
                        <div>p<sub className="text-[10px]">f_calc</sub> = 0.7 × {Ce} × {Ct} × {Is} × {pg}</div>
                      </>
                    )}
                    <div className="font-bold">p<sub className="text-[10px]">f_calc</sub> = {pf_raw.toFixed(2)} psf</div>
                  </div>

                  <div className="my-4 border-t border-gray-200"></div>

                  {/* Minimum Check */}
                  <div className="space-y-2">
                    <div className="text-gray-500">Minimum allowable snow load for low-slope roofs (Sec. 7.3.4)</div>
                    {!applyPm ? (
                      <div className="text-gray-500 italic">Does not apply. Roof slope ({roofPitch}°) is not considered low-slope.</div>
                    ) : isAsce22 ? (
                      pg <= 20 ? (
                        <>
                          <div>p<sub className="text-[10px]">m</sub> = p<sub className="text-[10px]">g</sub> (Since p<sub className="text-[10px]">g</sub> ≤ 20 psf)</div>
                          <div>p<sub className="text-[10px]">m</sub> = {pm.toFixed(2)} psf</div>
                        </>
                      ) : (
                        <>
                          <div>p<sub className="text-[10px]">m</sub> = 20 psf (Since p<sub className="text-[10px]">g</sub> {'>'} 20 psf)</div>
                          <div>p<sub className="text-[10px]">m</sub> = {pm.toFixed(2)} psf</div>
                        </>
                      )
                    ) : (
                      pg <= 20 ? (
                        <>
                          <div>p<sub className="text-[10px]">m</sub> = I<sub className="text-[10px]">s</sub> × p<sub className="text-[10px]">g</sub> (Since p<sub className="text-[10px]">g</sub> ≤ 20 psf)</div>
                          <div>p<sub className="text-[10px]">m</sub> = {Is} × {pg} = {pm.toFixed(2)} psf</div>
                        </>
                      ) : (
                        <>
                          <div>p<sub className="text-[10px]">m</sub> = I<sub className="text-[10px]">s</sub> × 20 psf (Since p<sub className="text-[10px]">g</sub> {'>'} 20 psf)</div>
                          <div>p<sub className="text-[10px]">m</sub> = {Is} × 20 = {pm.toFixed(2)} psf</div>
                        </>
                      )
                    )}
                  </div>

                  <div className="my-4 border-t border-gray-200"></div>
                  
                  {roofShape !== "Flat" && (
                    <>
                      <div className="my-4 border-t border-gray-200"></div>
                      
                      {/* Roof Slope Factor */}
                      <div className="space-y-2">
                        <div className="text-gray-500">Calculate roof slope factor (Fig. 7.4-1)</div>
                        <div>Roof Shape: <strong>{roofShape}</strong></div>
                        <div>Limit angle for C<sub className="text-[10px]">t</sub> {Ct <= 1.0 ? '≤ 1.0' : '≥ 1.1'} and {surfaceCondition} surface = <strong>{limitAngle}°</strong></div>
                        {Cs === 1.0 ? (
                          <div>C<sub className="text-[10px]">s</sub> = 1.0 (Since Pitch ≤ {limitAngle}°)</div>
                        ) : Cs === 0.0 ? (
                          <div>C<sub className="text-[10px]">s</sub> = 0.0 (Since Pitch ≥ 70°)</div>
                        ) : (
                          <>
                            <div>C<sub className="text-[10px]">s</sub> = 1.0 - (Pitch - {limitAngle}) / (70 - {limitAngle})</div>
                            <div>C<sub className="text-[10px]">s</sub> = 1.0 - ({roofPitch} - {limitAngle}) / {70 - limitAngle} = <strong>{Cs.toFixed(3)}</strong></div>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  <div className="my-4 border-t border-gray-200"></div>

                  {/* Final Result */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                    {roofShape !== "Flat" && (
                      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-4">
                        <div>
                          <div className="text-gray-600 font-medium">Flat Roof Design Load</div>
                          <div className="text-xs text-blue-600 mt-1 italic">{controls}</div>
                        </div>
                        <div className="text-xl font-bold text-gray-700">
                          p<sub className="text-sm">f</sub> = {pf.toFixed(2)} psf
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-gray-900 font-bold">{roofShape === "Flat" ? "Flat" : "Sloped"} Roof Design Load</div>
                        {roofShape !== "Flat" ? (
                          <div className="text-xs text-gray-500 mt-1">p<sub className="text-[10px]">s</sub> = C<sub className="text-[10px]">s</sub> × p<sub className="text-[10px]">f</sub></div>
                        ) : (
                          <div className="text-xs text-blue-600 mt-1 italic">{controls}</div>
                        )}
                      </div>
                      <div className="text-3xl font-bold text-gray-900 border-b-2 border-gray-900 pb-1">
                        p<sub className="text-sm">{roofShape === "Flat" ? "f" : "s"}</sub> = {ps.toFixed(2)} psf
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'Wind' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Input Section */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Wind Parameters</h2>
                
                <div className="space-y-4">
                  <VariableInput label="Basic Wind Speed, V" value={vWind} onChange={setVWind} unit="mph" />

                  <div className="grid grid-cols-2 gap-4">
                    <VariableInput label="Building Length, L" value={bldgLength} onChange={setBldgLength} unit="ft" />
                    <VariableInput label="Building Width, B" value={bldgWidth} onChange={setBldgWidth} unit="ft" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <VariableInput label="Mean Roof Height, h" value={meanRoofHeight} onChange={setMeanRoofHeight} unit="ft" />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Exposure Category</label>
                      <select 
                        value={windExposure} 
                        onChange={(e) => setWindExposure(e.target.value as ExposureCategory)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-gray-50"
                      >
                        <option value="B">Exposure B</option>
                        <option value="C">Exposure C</option>
                        <option value="D">Exposure D</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Wind Procedure</label>
                      <select 
                        value={windProcedure} 
                        onChange={(e) => setWindProcedure(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-gray-50"
                      >
                        <option>Components & Cladding</option>
                        <option>MWFRS (Directional)</option>
                        <option>MWFRS (Envelope)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enclosure Type (GCpi)</label>
                      <select 
                        value={enclosureType} 
                        onChange={(e) => setEnclosureType(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-gray-50"
                      >
                        <option>Enclosed</option>
                        <option>Partially Enclosed</option>
                        <option>Open</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Topography & Elevation</h3>
                    <div className="space-y-4">
                      <VariableInput label="Topographic Factor, Kzt" value={kzt} onChange={setKzt} step="0.1" />
                      {!isAscePre16 && (
                        <VariableInput label="Ground Elevation, Ze" value={groundElevation} onChange={setGroundElevation} unit="ft" />
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Output Section */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm h-full">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 border-b pb-2">Wind Load Output: {asceYear}</h2>
                
                {windProcedure === "Components & Cladding" && (
                  <div className="mb-8">
                    <WindZonesSVG L={bldgLength} B={bldgWidth} a={a_dim} />
                  </div>
                )}
                
                {windProcedure === "MWFRS (Directional)" && (
                  <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <WindPlanSVG bldgL={bldgLength} bldgB={bldgWidth} />
                    <WindElevationSVG h={meanRoofHeight} L={bldgLength} roofPitch={0} />
                  </div>
                )}

                <div className="font-mono text-sm text-gray-800 space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4 py-1 mb-6 mt-8">
                    <h3 className="font-bold text-gray-900 uppercase">Velocity Pressure (q<sub className="text-[10px]">z</sub>)</h3>
                  </div>

                  {/* Coefficients Block */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 mb-6">
                    <div>Basic Wind Speed (V)</div>
                    <div>V = <strong>{vWind} mph</strong></div>

                    <div>Wind Directionality Factor</div>
                    <div>K<sub className="text-[10px]">d</sub> = <strong>{Kd.toFixed(2)}</strong> <span className="text-xs text-gray-500">(Building)</span></div>

                    <div>Topographic Factor</div>
                    <div>K<sub className="text-[10px]">zt</sub> = <strong>{kzt.toFixed(2)}</strong></div>

                    {!isAscePre16 ? (
                      <>
                        <div>Ground Elevation Factor</div>
                        <div>K<sub className="text-[10px]">e</sub> = <strong>{Ke.toFixed(3)}</strong> <span className="text-xs text-gray-500">(z_e = {groundElevation} ft)</span></div>
                      </>
                    ) : (
                      <>
                        <div>Ground Elevation Factor</div>
                        <div>K<sub className="text-[10px]">e</sub> = <strong>N/A</strong> <span className="text-xs text-gray-500">(Not used in {asceYear})</span></div>
                      </>
                    )}
                  </div>

                  <div className="my-4 border-t border-gray-200"></div>

                  {/* Kz Derivation */}
                  <div className="space-y-2">
                    <div className="text-gray-500">Velocity Pressure Exposure Coefficient (K<sub className="text-[10px]">z</sub>)</div>
                    <div>Exposure Category = <strong>{windExposure}</strong></div>
                    <div>α = {alpha.toFixed(1)}, z<sub className="text-[10px]">g</sub> = {zg} ft</div>
                    
                    {z < 15 ? (
                      <>
                        <div className="mt-2 text-xs italic text-gray-500">Note: z &lt; 15 ft, using minimum height of 15 ft for calculation.</div>
                        <div>K<sub className="text-[10px]">z</sub> = 2.01 × (15 / z<sub className="text-[10px]">g</sub>)<sup>2/α</sup></div>
                        <div>K<sub className="text-[10px]">z</sub> = 2.01 × (15 / {zg})<sup>2/{alpha.toFixed(1)}</sup> = <strong>{Kz.toFixed(3)}</strong></div>
                      </>
                    ) : (
                      <>
                        <div className="mt-2">K<sub className="text-[10px]">z</sub> = 2.01 × (z / z<sub className="text-[10px]">g</sub>)<sup>2/α</sup></div>
                        <div>K<sub className="text-[10px]">z</sub> = 2.01 × ({z} / {zg})<sup>2/{alpha.toFixed(1)}</sup> = <strong>{Kz.toFixed(3)}</strong></div>
                      </>
                    )}
                  </div>

                  <div className="my-4 border-t border-gray-200"></div>

                  {/* Final qz calculation */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded mb-8">
                    <div className="text-gray-500 mb-2">Velocity Pressure Eq.</div>
                    
                    {!isAscePre16 ? (
                      <div>q<sub className="text-[10px]">z</sub> = 0.00256 × K<sub className="text-[10px]">z</sub> × K<sub className="text-[10px]">zt</sub> × K<sub className="text-[10px]">d</sub> × K<sub className="text-[10px]">e</sub> × V²</div>
                    ) : (
                      <div>q<sub className="text-[10px]">z</sub> = 0.00256 × K<sub className="text-[10px]">z</sub> × K<sub className="text-[10px]">zt</sub> × K<sub className="text-[10px]">d</sub> × V²</div>
                    )}
                    
                    {!isAscePre16 ? (
                      <div className="mb-4">q<sub className="text-[10px]">z</sub> = 0.00256 × {Kz.toFixed(3)} × {kzt.toFixed(2)} × {Kd.toFixed(2)} × {Ke.toFixed(3)} × {vWind}²</div>
                    ) : (
                      <div className="mb-4">q<sub className="text-[10px]">z</sub> = 0.00256 × {Kz.toFixed(3)} × {kzt.toFixed(2)} × {Kd.toFixed(2)} × {vWind}²</div>
                    )}
                    
                    <div className="flex justify-between items-end border-t border-gray-200 pt-4">
                      <div className="font-bold text-gray-900">Final Velocity Pressure</div>
                      <div className="text-3xl font-bold text-blue-900 border-b-2 border-blue-900 pb-1">
                        q<sub className="text-sm">z</sub> = {qz.toFixed(2)} psf
                      </div>
                    </div>
                  </div>

                  {windProcedure === "Components & Cladding" && (
                    <>
                      <div className="border-l-4 border-blue-500 pl-4 py-1 mb-6 mt-8">
                        <h3 className="font-bold text-gray-900 uppercase">C&C Edge Dimension 'a'</h3>
                      </div>
                      
                      <div className="space-y-2 mb-8">
                        <div>Least horizontal bldg dimension = <strong>{leastBldgDim} ft</strong></div>
                        <div>a = max( min(0.1 × {leastBldgDim}, 0.4 × {meanRoofHeight}), 3, 0.04 × {leastBldgDim} )</div>
                        <div>a = max( min({a_calc1.toFixed(1)}, {a_calc2.toFixed(1)}), 3, {(0.04 * leastBldgDim).toFixed(1)} )</div>
                        <div className="font-bold text-lg mt-2 text-gray-900">a = {a_dim.toFixed(1)} ft</div>
                      </div>

                      <div className="border-l-4 border-blue-500 pl-4 py-1 mb-6">
                        <h3 className="font-bold text-gray-900 uppercase">Design Pressures (p = q × GC<sub className="text-[10px]">p</sub> - q<sub className="text-[10px]">i</sub> × GC<sub className="text-[10px]">pi</sub>)</h3>
                      </div>

                      <div className="bg-gray-50 rounded-md border border-gray-200 overflow-x-auto mb-4">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                              <th className="p-2 font-semibold text-gray-700 border-r border-gray-200">Zone</th>
                              <th className="p-2 font-semibold text-gray-700">Area <span className="text-[10px] font-normal">(sf)</span></th>
                              <th className="p-2 font-semibold text-gray-700">+GC<sub className="text-[10px]">p</sub></th>
                              <th className="p-2 font-semibold text-gray-700">-GC<sub className="text-[10px]">p</sub></th>
                              <th className="p-2 font-semibold text-gray-700 text-blue-800 bg-blue-50/50">+p <span className="text-[10px] font-normal">(psf)</span></th>
                              <th className="p-2 font-semibold text-gray-700 text-blue-800 bg-blue-50/50">-p <span className="text-[10px] font-normal">(psf)</span></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {[
                              { label: 'Roof 1 (Interior)', key: 'roof_zone_1', color: '#f8fafc' },
                              { label: 'Roof 2 (Edge)', key: 'roof_zone_2', color: '#bbf7d0' },
                              { label: 'Roof 3 (Corner)', key: 'roof_zone_3', color: '#fca5a5' },
                              { label: 'Wall 4 (Interior)', key: 'wall_zone_4', color: '#e2e8f0' },
                              { label: 'Wall 5 (Corner)', key: 'wall_zone_5', color: '#cbd5e1' }
                            ].map((zone) => (
                              <React.Fragment key={zone.key}>
                                {cncAreas.map((area, idx) => {
                                  const gcpPos = calcGCp(zone.key, area, true);
                                  const gcpNeg = calcGCp(zone.key, area, false);
                                  // p = qz * GCp - qz * GCpi (calculating max envelopes)
                                  const pPos = qz * gcpPos - qz * gcpi_neg;
                                  const pNeg = qz * gcpNeg - qz * gcpi_pos;
                                  
                                  return (
                                    <tr key={`${zone.key}-${area}`} className="bg-white hover:bg-blue-50/30">
                                      {idx === 0 && (
                                        <td rowSpan={cncAreas.length} className="p-2 font-medium text-gray-900 border-r border-gray-200 align-top bg-white">
                                          <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full border border-gray-400" style={{ backgroundColor: zone.color }}></div>
                                            {zone.label}
                                          </div>
                                        </td>
                                      )}
                                      <td className="p-2 text-gray-600">{area === 10 ? '≤ 10' : area === 500 ? '≥ 500' : area}</td>
                                      <td className="p-2">{gcpPos.toFixed(2)}</td>
                                      <td className="p-2">{gcpNeg.toFixed(2)}</td>
                                      <td className="p-2 font-bold text-blue-900 bg-blue-50/30">{pPos.toFixed(1)}</td>
                                      <td className="p-2 font-bold text-blue-900 bg-blue-50/30">{pNeg.toFixed(1)}</td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {windProcedure === "MWFRS (Directional)" && (
                    <>
                      <div className="border-l-4 border-blue-500 pl-4 py-1 mb-6 mt-12">
                        <h3 className="font-bold text-gray-900 uppercase">MWFRS Wall Pressures</h3>
                        <p className="text-xs text-gray-500 mt-1">p = q × G × C<sub className="text-[10px]">p</sub> - q<sub className="text-[10px]">i</sub> × (GC<sub className="text-[10px]">pi</sub>)</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 mb-8">
                        <div>Enclosure Type</div>
                        <div><strong>{enclosureType}</strong></div>
                        <div>Internal Pressure (GC<sub className="text-[10px]">pi</sub>)</div>
                        <div><strong>±{gcpi_pos}</strong></div>
                        <div>Gust Effect Factor (G)</div>
                        <div><strong>{G}</strong></div>
                      </div>

                      {/* Case X Table */}
                      <h4 className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-1">Wind Case 1: X-Direction (Parallel to L)</h4>
                      <div className="mb-2 text-xs text-gray-500">L/B Ratio = {caseX.lb_ratio.toFixed(2)} → Leeward Cp = {caseX.cp_leeward}</div>
                      <div className="bg-gray-50 rounded-md border border-gray-200 overflow-hidden mb-8">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                              <th className="p-3 font-semibold text-gray-700">Surface</th>
                              <th className="p-3 font-semibold text-gray-700">C<sub className="text-[10px]">p</sub></th>
                              <th className="p-3 font-semibold text-gray-700">p (Max) <span className="text-xs font-normal text-gray-500">psf</span></th>
                              <th className="p-3 font-semibold text-gray-700">p (Min) <span className="text-xs font-normal text-gray-500">psf</span></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            <tr className="bg-white">
                              <td className="p-3 font-medium text-gray-900">Windward</td>
                              <td className="p-3">{cp_windward}</td>
                              <td className="p-3 text-blue-700 font-bold">{caseX.p_ww_max.toFixed(1)}</td>
                              <td className="p-3">{caseX.p_ww_min.toFixed(1)}</td>
                            </tr>
                            <tr className="bg-white">
                              <td className="p-3 font-medium text-gray-900">Leeward</td>
                              <td className="p-3">{caseX.cp_leeward}</td>
                              <td className="p-3">{caseX.p_lw_max.toFixed(1)}</td>
                              <td className="p-3 text-blue-700 font-bold">{caseX.p_lw_min.toFixed(1)}</td>
                            </tr>
                            <tr className="bg-white">
                              <td className="p-3 font-medium text-gray-900">Side Walls</td>
                              <td className="p-3">{cp_side}</td>
                              <td className="p-3">{caseX.p_side_max.toFixed(1)}</td>
                              <td className="p-3 text-blue-700 font-bold">{caseX.p_side_min.toFixed(1)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Case Y Table */}
                      <h4 className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-1">Wind Case 2: Y-Direction (Parallel to B)</h4>
                      <div className="mb-2 text-xs text-gray-500">L/B Ratio = {caseY.lb_ratio.toFixed(2)} → Leeward Cp = {caseY.cp_leeward}</div>
                      <div className="bg-gray-50 rounded-md border border-gray-200 overflow-hidden mb-4">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                              <th className="p-3 font-semibold text-gray-700">Surface</th>
                              <th className="p-3 font-semibold text-gray-700">C<sub className="text-[10px]">p</sub></th>
                              <th className="p-3 font-semibold text-gray-700">p (Max) <span className="text-xs font-normal text-gray-500">psf</span></th>
                              <th className="p-3 font-semibold text-gray-700">p (Min) <span className="text-xs font-normal text-gray-500">psf</span></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            <tr className="bg-white">
                              <td className="p-3 font-medium text-gray-900">Windward</td>
                              <td className="p-3">{cp_windward}</td>
                              <td className="p-3 text-blue-700 font-bold">{caseY.p_ww_max.toFixed(1)}</td>
                              <td className="p-3">{caseY.p_ww_min.toFixed(1)}</td>
                            </tr>
                            <tr className="bg-white">
                              <td className="p-3 font-medium text-gray-900">Leeward</td>
                              <td className="p-3">{caseY.cp_leeward}</td>
                              <td className="p-3">{caseY.p_lw_max.toFixed(1)}</td>
                              <td className="p-3 text-blue-700 font-bold">{caseY.p_lw_min.toFixed(1)}</td>
                            </tr>
                            <tr className="bg-white">
                              <td className="p-3 font-medium text-gray-900">Side Walls</td>
                              <td className="p-3">{cp_side}</td>
                              <td className="p-3">{caseY.p_side_max.toFixed(1)}</td>
                              <td className="p-3 text-blue-700 font-bold">{caseY.p_side_min.toFixed(1)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="text-xs text-gray-500 mt-2 italic">
                        * Note: Windward pressure varies with height z. Values shown are conservatively evaluated at mean roof height h = {meanRoofHeight}'. Positive indicates pressure towards surface, negative indicates suction away from surface.
                      </div>
                    </>
                  )}

                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Placeholders for other tabs */}
        {activeTab !== 'Snow' && activeTab !== 'Wind' && (
          <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900">{activeTab} Loads</h3>
            <p className="mt-2 text-sm text-gray-500">This calculation module is under construction.</p>
          </div>
        )}
      </div>
    </div>
  );
};
