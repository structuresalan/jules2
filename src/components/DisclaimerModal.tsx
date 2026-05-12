import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const DISCLAIMER_SESSION_KEY = 'simplifystruct.engineeringDisclaimerAcceptedThisVisit.v1';

const hasAcceptedDisclaimerThisVisit = () => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(DISCLAIMER_SESSION_KEY) === 'true';
};

export const DisclaimerModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(() => !hasAcceptedDisclaimerThisVisit());

  const handleAccept = () => {
    window.sessionStorage.setItem(DISCLAIMER_SESSION_KEY, 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-200 flex items-start gap-4">
          <div className="p-3 bg-yellow-100 text-yellow-700 rounded-full shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Engineering Liability Disclaimer</h2>
            <p className="text-sm text-gray-500 mt-1">Please read carefully before using SimplifyStruct.</p>
          </div>
        </div>

        <div className="p-6 bg-gray-50 text-sm text-gray-700 space-y-4 max-h-[60vh] overflow-y-auto">
          <p>
            <strong>1. No Warranty:</strong> The SimplifyStruct application and its calculation modules are provided "as-is" without any warranty of any kind, either express or implied, including but not limited to the implied warranties of merchantability, fitness for a particular purpose, or non-infringement.
          </p>
          <p>
            <strong>2. Not a Substitute for Professional Judgment:</strong> This software is a tool intended to assist qualified professionals. It is <strong>NOT</strong> a substitute for the professional judgment, independent verification, and expertise of a licensed structural or civil engineer.
          </p>
          <p>
            <strong>3. Engineer of Record Responsibility:</strong> The user assumes all risk and liability associated with the use of this software. The user is entirely responsible for verifying the accuracy of all inputs, boundary conditions, mathematical formulas, load factors, material properties, and final output results before applying them to any real-world construction or engineering project.
          </p>
          <p>
            <strong>4. Limitation of Liability:</strong> In no event shall the creators, developers, or distributors of SimplifyStruct be liable for any direct, indirect, incidental, special, exemplary, or consequential damages arising in any way out of the use of this software.
          </p>
        </div>

        <div className="p-6 border-t border-gray-200 bg-white flex justify-end">
          <button
            onClick={handleAccept}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            I Understand and Accept
          </button>
        </div>
      </div>
    </div>
  );
};
