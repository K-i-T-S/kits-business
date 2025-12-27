import React, { useState, useEffect } from 'react';
import { AccessibilityTester as AccessibilityUtils } from '../utils/accessibility';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface TestResult {
  type: 'missing-alt' | 'missing-labels' | 'heading-structure';
  issues: string[];
  elements: HTMLElement[];
  passed: boolean;
}

export default function AccessibilityTesterComponent() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runAccessibilityTests = () => {
    setIsRunning(true);
    const results: TestResult[] = [];

    // Test for missing alt text
    const missingAlt = AccessibilityUtils.checkMissingAltText();
    results.push({
      type: 'missing-alt',
      issues: missingAlt.length > 0 
        ? [`Found ${missingAlt.length} images without alt text`] 
        : [],
      elements: missingAlt,
      passed: missingAlt.length === 0
    });

    // Test for missing form labels
    const missingLabels = AccessibilityUtils.checkMissingLabels();
    results.push({
      type: 'missing-labels',
      issues: missingLabels.length > 0 
        ? [`Found ${missingLabels.length} form inputs without labels`] 
        : [],
      elements: missingLabels,
      passed: missingLabels.length === 0
    });

    // Test heading structure
    const headingCheck = AccessibilityUtils.checkHeadingStructure();
    results.push({
      type: 'heading-structure',
      issues: headingCheck.issues,
      elements: headingCheck.headings,
      passed: headingCheck.issues.length === 0
    });

    setTestResults(results);
    setIsRunning(false);
  };

  useEffect(() => {
    runAccessibilityTests();
  }, []);

  const getTestIcon = (result: TestResult) => {
    if (result.passed) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (result.issues.length > 0) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getTestTitle = (type: string) => {
    switch (type) {
      case 'missing-alt': return 'Image Alt Text';
      case 'missing-labels': return 'Form Labels';
      case 'heading-structure': return 'Heading Structure';
      default: return 'Unknown Test';
    }
  };

  const getTestDescription = (type: string) => {
    switch (type) {
      case 'missing-alt': return 'All images should have descriptive alt text';
      case 'missing-labels': return 'All form inputs should have associated labels';
      case 'heading-structure': return 'Headings should follow proper hierarchy';
      default: return 'Unknown test description';
    }
  };

  const highlightElements = (elements: HTMLElement[]) => {
    // Remove existing highlights
    document.querySelectorAll('.accessibility-highlight').forEach(el => {
      el.classList.remove('accessibility-highlight');
    });

    // Add new highlights
    elements.forEach(el => {
      el.classList.add('accessibility-highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // Remove highlights after 3 seconds
    setTimeout(() => {
      document.querySelectorAll('.accessibility-highlight').forEach(el => {
        el.classList.remove('accessibility-highlight');
      });
    }, 3000);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Accessibility Test Results</h2>
        <p className="text-gray-600">
          Automated accessibility checks for WCAG 2.1 AA compliance
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={runAccessibilityTests}
          disabled={isRunning}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning ? 'Running Tests...' : 'Run Tests Again'}
        </button>
      </div>

      <div className="space-y-4">
        {testResults.map((result, index) => (
          <div
            key={index}
            className={`border rounded-lg p-4 ${
              result.passed 
                ? 'border-green-200 bg-green-50' 
                : result.issues.length > 0
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {getTestIcon(result)}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {getTestTitle(result.type)}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {getTestDescription(result.type)}
                </p>
                
                {result.issues.length > 0 && (
                  <div className="mb-2">
                    <p className="text-sm font-medium text-gray-700 mb-1">Issues found:</p>
                    <ul className="text-sm text-gray-600 list-disc list-inside">
                      {result.issues.map((issue, issueIndex) => (
                        <li key={issueIndex}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.elements.length > 0 && (
                  <button
                    onClick={() => highlightElements(result.elements)}
                    className="text-sm text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Highlight {result.elements.length} element{result.elements.length > 1 ? 's' : ''} on page
                  </button>
                )}

                {result.passed && (
                  <p className="text-sm text-green-700 font-medium">
                    ✓ Test passed
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Note</h4>
            <p className="text-sm text-blue-800">
              These are automated checks. Manual testing with screen readers and keyboard navigation 
              is also recommended for comprehensive accessibility validation.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>
          Last updated: {new Date().toLocaleString()}
        </p>
      </div>
    </div>
  );
}
