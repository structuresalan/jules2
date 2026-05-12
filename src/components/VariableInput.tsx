import React, { useState } from 'react';
import { Database } from 'lucide-react';
import { useVariables } from '../hooks/useVariables';

interface VariableInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  unit?: string;
  step?: string;
}

export const VariableInput: React.FC<VariableInputProps> = ({ label, value, onChange, unit, step }) => {
  const { variables } = useVariables();
  const [isVariableMode, setIsVariableMode] = useState(false);
  const [selectedVarId, setSelectedVarId] = useState<string>("");

  const handleModeToggle = () => {
    setIsVariableMode(!isVariableMode);
  };

  const handleVarSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedVarId(id);
    const selectedVar = variables.find(v => v.id === id);
    if (selectedVar) {
      onChange(selectedVar.value);
    }
  };

  // If variable mode is on but the variable is updated elsewhere, we should sync it.
  // A robust implementation would store the activeVarId at the parent component level.
  // For this prototype, we'll just allow setting it once.

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">{label} {unit && `(${unit})`}</label>
        <button 
          type="button"
          onClick={handleModeToggle}
          className={`p-1 rounded text-xs flex items-center gap-1 transition-colors ${isVariableMode ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
          title="Toggle Variable Reference"
        >
          <Database size={12} />
        </button>
      </div>

      {isVariableMode ? (
        <div className="relative">
          <select 
            value={selectedVarId} 
            onChange={handleVarSelect}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-blue-50/50 appearance-none pl-8"
          >
            <option value="" disabled>Select a variable...</option>
            {variables.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.value} {v.unit})</option>
            ))}
          </select>
          {selectedVarId && (
            <div 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none"
              style={{ backgroundColor: variables.find(v => v.id === selectedVarId)?.color || '#64748b' }}
            ></div>
          )}
        </div>
      ) : (
        <input 
          type="number" 
          step={step || "any"} 
          value={value} 
          onChange={(e) => onChange(Number(e.target.value))} 
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" 
        />
      )}
    </div>
  );
};
