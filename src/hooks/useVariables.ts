import { useContext } from 'react';
import { VariablesContext } from '../context/variablesContextInstance';

export const useVariables = () => {
  const context = useContext(VariablesContext);
  if (context === undefined) {
    throw new Error('useVariables must be used within a VariablesProvider');
  }
  return context;
};
