/**
 * Report Card Validation Gate Component
 * 
 * Wrapper component that validates data before allowing report card rendering.
 * Enforces the "no mock data" rule by showing errors when data is incomplete.
 */

import React, { useEffect, useState } from 'react';
import { validateReportCardData, type ValidationResult } from '../services/reportCardValidationService';
import Spinner from './common/Spinner';
import ReportCardValidationErrors from './ReportCardValidationErrors';

interface ReportCardValidationGateProps {
  studentId: number;
  termId: number;
  children: (data: ValidationResult['data']) => React.ReactNode;
  onValidationFailed?: (result: ValidationResult) => void;
}

/**
 * Validation gate that ensures data integrity before rendering report cards
 * 
 * Usage:
 * <ReportCardValidationGate studentId={123} termId={456}>
 *   {(data) => <ReportCardComponent data={data} />}
 * </ReportCardValidationGate>
 */
const ReportCardValidationGate: React.FC<ReportCardValidationGateProps> = ({
  studentId,
  termId,
  children,
  onValidationFailed
}) => {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    async function validate() {
      setIsValidating(true);
      const result = await validateReportCardData(studentId, termId);
      setValidationResult(result);
      setIsValidating(false);

      if (result.status !== 'success' && onValidationFailed) {
        onValidationFailed(result);
      }
    }

    validate();
  }, [studentId, termId, onValidationFailed]);

  if (isValidating) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
        <span className="ml-3 text-gray-600">Validating report card data...</span>
      </div>
    );
  }

  if (!validationResult) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Unable to validate report card data.</p>
      </div>
    );
  }

  if (validationResult.status !== 'success') {
    return (
      <ReportCardValidationErrors 
        validationResult={validationResult}
        studentId={studentId}
        termId={termId}
      />
    );
  }

  // Validation passed - render the report card
  return <>{children(validationResult.data!)}</>;
};

export default ReportCardValidationGate;
