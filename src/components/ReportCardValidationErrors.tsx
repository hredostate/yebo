/**
 * Report Card Validation Errors Component
 * 
 * Displays structured validation errors with actionable details.
 * Shows exactly what's missing and what needs to be fixed.
 */

import React from 'react';
import { 
  formatValidationError, 
  getDetailedValidationErrors, 
  type ValidationResult 
} from '../services/reportCardValidationService';
import { AlertCircleIcon, CheckCircleIcon } from './common/icons';

interface ReportCardValidationErrorsProps {
  validationResult: ValidationResult;
  studentId: number;
  termId: number;
}

const ReportCardValidationErrors: React.FC<ReportCardValidationErrorsProps> = ({
  validationResult,
  studentId,
  termId
}) => {
  const mainMessage = formatValidationError(validationResult);
  const detailedErrors = getDetailedValidationErrors(validationResult);

  const getErrorIcon = () => {
    return (
      <div className="flex-shrink-0">
        <AlertCircleIcon className="w-8 h-8 text-red-500" />
      </div>
    );
  };

  const getActionableSteps = () => {
    switch (validationResult.reason) {
      case 'NOT_ENROLLED':
        return [
          'Enroll the student in a class for this term',
          'Ensure the enrollment is saved properly',
          'Refresh this page after enrollment is complete'
        ];
      
      case 'RESULTS_NOT_PUBLISHED':
        return [
          'Go to the Results Manager',
          'Select the appropriate class and term',
          'Click "Publish Results" to make them available',
          'Refresh this page after publishing'
        ];
      
      case 'MISSING_GRADING_SCHEME':
        return [
          'Go to Settings → Grading Schemes',
          'Create or assign a grading scheme for this class/campus',
          'Set it as default if needed',
          'Refresh this page after configuration'
        ];
      
      case 'MISSING_SCORES':
        return [
          'Go to Score Entry for this term',
          'Complete all assessment components for the missing subjects',
          'Save all scores',
          'Refresh this page after scores are entered'
        ];
      
      default:
        return [
          'Contact your system administrator',
          'Provide the error details shown below'
        ];
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-lg shadow-sm">
        <div className="flex items-start">
          {getErrorIcon()}
          <div className="ml-4 flex-1">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Cannot Generate Report Card
            </h3>
            <p className="text-red-700 mb-4">
              {mainMessage}
            </p>

            {/* Detailed error breakdown */}
            {detailedErrors.length > 0 && (
              <div className="mt-4 bg-white p-4 rounded border border-red-200">
                <h4 className="font-medium text-red-800 mb-2">Details:</h4>
                <ul className="space-y-2">
                  {detailedErrors.map((error, index) => (
                    <li key={index} className="text-sm text-gray-700">
                      {error.subject && (
                        <span className="font-medium text-red-700">
                          {error.subject}:
                        </span>
                      )}{' '}
                      {Array.isArray(error.missing) 
                        ? error.missing.join(', ')
                        : error.missing || error.error
                      }
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actionable steps */}
            <div className="mt-6 bg-white p-4 rounded border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                What to do next:
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                {getActionableSteps().map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            {/* Technical details (collapsible) */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                Technical Details
              </summary>
              <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-700">
                <p><strong>Student ID:</strong> {studentId}</p>
                <p><strong>Term ID:</strong> {termId}</p>
                <p><strong>Error Code:</strong> {validationResult.reason}</p>
                {validationResult.details && (
                  <p><strong>Details:</strong> {JSON.stringify(validationResult.details, null, 2)}</p>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Info box about the system's data integrity philosophy */}
      <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">About Data Integrity</h4>
        <p className="text-sm text-blue-700">
          This system enforces strict data integrity rules to ensure report cards are accurate 
          and traceable. Report cards are only generated when all required data is complete and 
          properly validated. This prevents errors and maintains the credibility of academic records.
        </p>
      </div>
    </div>
  );
};

export default ReportCardValidationErrors;
