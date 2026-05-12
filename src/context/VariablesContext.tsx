import React, { useMemo, useState, type ReactNode } from 'react';
import { VariablesContext, type ProjectVariable, type ProjectVariableTable } from './variablesContextInstance';

const makeId = () => Math.random().toString(36).slice(2, 11);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Simple formula evaluator
const evaluateFormula = (formula: string, currentVariables: ProjectVariable[]): number => {
  if (!formula) return 0;

  let expression = formula;
  if (expression.startsWith('=')) {
    expression = expression.substring(1);
  }

  // Sort variables by length descending so we replace longest names first (avoids partial replacements)
  const sortedVars = [...currentVariables].sort((a, b) => b.name.length - a.name.length);

  sortedVars.forEach((v) => {
    // Only replace whole words to avoid replacing part of a longer variable name
    const regex = new RegExp(`\\b${escapeRegExp(v.name)}\\b`, 'g');
    expression = expression.replace(regex, v.value.toString());
  });

  try {
    // Basic safe eval using Function (since this is a client-side prototype)
    // In production, a math parser like mathjs should be used.
    const result = new Function(`return ${expression}`)();
    return Number.isFinite(result) ? Number(result.toFixed(4)) : 0;
  } catch (e) {
    console.warn('Formula evaluation failed', e);
    return 0;
  }
};

const recalculateTables = (tables: ProjectVariableTable[]): ProjectVariableTable[] => {
  let nextTables = tables.map((table) => ({
    ...table,
    variables: table.variables.map((variable) => ({ ...variable })),
  }));

  // Iterate a few times to allow for variable dependencies across enabled tables.
  for (let i = 0; i < 4; i++) {
    const enabledVariables = nextTables
      .filter((table) => table.isEnabled)
      .flatMap((table) => table.variables);

    nextTables = nextTables.map((table) => {
      const referenceVariables = table.isEnabled ? enabledVariables : table.variables;

      return {
        ...table,
        variables: table.variables.map((variable) => {
          if (!variable.formula) return variable;
          return {
            ...variable,
            value: evaluateFormula(variable.formula, referenceVariables),
          };
        }),
      };
    });
  }

  return nextTables;
};

const initialTables: ProjectVariableTable[] = [
  {
    id: 'default-table',
    name: 'Default Variables',
    isEnabled: true,
    variables: [
      { id: '1', name: 'Main_Span_L', value: 24, formula: '24', unit: 'ft', group: 'Geometry', color: '#ef4444' },
      { id: '2', name: 'Dead_Load', value: 50, formula: '50', unit: 'psf', group: 'Loads', color: '#3b82f6' },
      { id: '3', name: 'Factored_Dead', value: 60, formula: '=1.2 * Dead_Load', unit: 'psf', group: 'Loads', color: '#8b5cf6' },
    ],
  },
];

export const VariablesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [variableTables, setVariableTables] = useState<ProjectVariableTable[]>(() => recalculateTables(initialTables));

  const variables = useMemo(
    () => variableTables.filter((table) => table.isEnabled).flatMap((table) => table.variables),
    [variableTables],
  );

  const addVariableTable = (name?: string) => {
    setVariableTables((prev) => [
      ...prev,
      {
        id: makeId(),
        name: name || `Variable Table ${prev.length + 1}`,
        isEnabled: true,
        variables: [],
      },
    ]);
  };

  const updateVariableTable = (id: string, table: Partial<Omit<ProjectVariableTable, 'id' | 'variables'>>) => {
    setVariableTables((prev) => recalculateTables(prev.map((item) => (item.id === id ? { ...item, ...table } : item))));
  };

  const deleteVariableTable = (id: string) => {
    setVariableTables((prev) => {
      const filtered = prev.filter((table) => table.id !== id);
      return recalculateTables(filtered.length ? filtered : [{ id: makeId(), name: 'Default Variables', isEnabled: true, variables: [] }]);
    });
  };

  const addVariable = (tableId: string, variable: Omit<ProjectVariable, 'id'>) => {
    const newVar = { ...variable, id: makeId() };
    setVariableTables((prev) =>
      recalculateTables(
        prev.map((table) =>
          table.id === tableId ? { ...table, variables: [...table.variables, newVar] } : table,
        ),
      ),
    );
  };

  const updateVariable = (tableId: string, id: string, updatedFields: Partial<Omit<ProjectVariable, 'id'>>) => {
    setVariableTables((prev) =>
      recalculateTables(
        prev.map((table) =>
          table.id === tableId
            ? { ...table, variables: table.variables.map((v) => (v.id === id ? { ...v, ...updatedFields } : v)) }
            : table,
        ),
      ),
    );
  };

  const deleteVariable = (tableId: string, id: string) => {
    setVariableTables((prev) =>
      recalculateTables(
        prev.map((table) =>
          table.id === tableId ? { ...table, variables: table.variables.filter((v) => v.id !== id) } : table,
        ),
      ),
    );
  };

  return (
    <VariablesContext.Provider
      value={{
        variableTables,
        variables,
        addVariableTable,
        updateVariableTable,
        deleteVariableTable,
        addVariable,
        updateVariable,
        deleteVariable,
      }}
    >
      {children}
    </VariablesContext.Provider>
  );
};
