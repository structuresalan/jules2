import { createContext } from 'react';

export interface ProjectVariable {
  id: string;
  name: string;
  value: number; // The dynamically calculated or static value
  formula?: string; // e.g. "=12*2" or "=Main_Span / 2"
  unit: string;
  group: string;
  color?: string; // Hex color code
}

export interface ProjectVariableTable {
  id: string;
  name: string;
  isEnabled: boolean; // Only enabled tables make their variables valid across modules
  variables: ProjectVariable[];
}

export interface VariablesContextType {
  variableTables: ProjectVariableTable[];
  variables: ProjectVariable[];
  addVariableTable: (name?: string) => void;
  updateVariableTable: (id: string, table: Partial<Omit<ProjectVariableTable, 'id' | 'variables'>>) => void;
  deleteVariableTable: (id: string) => void;
  addVariable: (tableId: string, variable: Omit<ProjectVariable, 'id'>) => void;
  updateVariable: (tableId: string, id: string, variable: Partial<Omit<ProjectVariable, 'id'>>) => void;
  deleteVariable: (tableId: string, id: string) => void;
}

export const VariablesContext = createContext<VariablesContextType | undefined>(undefined);
