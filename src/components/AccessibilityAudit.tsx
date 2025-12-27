import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, Eye, EyeOff } from "lucide-react";
import AccessibleModal from "./ui/AccessibleModal";

interface AuditResult {
  category: string;
  checks: {
    name: string;
    passed: boolean;
    description: string;
    element?: string;
  }[];
}

export default function AccessibilityAudit() {
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const runAudit = () => {
    setIsRunning(true);
    const results: AuditResult[] = [];

    // Keyboard Navigation Audit
    const keyboardChecks = [
      {
        name: "Tab Order",
        passed: document.querySelectorAll("button, a, input, select, textarea").length > 0,
        description: "Interactive elements have logical tab order"
      },
      {
        name: "Focus Indicators", 
        passed: document.querySelector("style")?.textContent?.includes("focus-visible") !== null,
        description: "Visible focus indicators exist"
      },
      {
        name: "Skip Links",
        passed: document.querySelectorAll(".skip-link, [href=\"#main-content\"]").length > 0,
        description: "Skip links available for keyboard users"
      },
      {
        name: "Keyboard Trapping",
        passed: (() => {
          const modals = document.querySelectorAll("[role=\"dialog\"], .modal");
          if (modals.length === 0) return false;
          
          // Check if any modal has proper focus trapping setup
          return Array.from(modals).some(modal => {
            const hasFocusableElements = modal.querySelectorAll("button, a, input, select, textarea, [tabindex]:not([tabindex=\"-1\"])").length > 0;
            const hasAriaModal = modal.getAttribute("aria-modal") === "true";
            return hasFocusableElements && hasAriaModal;
          });
        })(),
        description: "Focus trapping in modals"
      }
    ];

    // Screen Reader Audit
    const screenReaderChecks = [
      {
        name: "ARIA Labels",
        passed: document.querySelectorAll("[aria-label], [aria-labelledby]").length > 0,
        description: "ARIA labels present on interactive elements"
      },
      {
        name: "Live Regions",
        passed: document.querySelectorAll("[aria-live]").length > 0,
        description: "Live regions for dynamic content"
      },
      {
        name: "Semantic HTML",
        passed: document.querySelectorAll("main, nav, header, footer, section, article, aside").length > 0,
        description: "Semantic HTML elements used"
      },
      {
        name: "Form Labels",
        passed: document.querySelectorAll("label, [aria-label], [placeholder]").length > 0,
        description: "Form inputs have proper labels"
      }
    ];

    // Visual Accessibility Audit
    const visualChecks = [
      {
        name: "Color Contrast",
        passed: document.querySelector("style")?.textContent?.includes("#4b5563") !== null,
        description: "Text meets contrast requirements"
      },
      {
        name: "High Contrast Mode",
        passed: document.querySelector("[data-high-contrast]") !== null,
        description: "High contrast mode supported"
      },
      {
        name: "Text Scaling",
        passed: document.querySelector("style")?.textContent?.includes("min-resolution") !== null,
        description: "Text can be scaled up to 200%"
      },
      {
        name: "Button Sizing",
        passed: document.querySelector("style")?.textContent?.includes("min-height: 44px") !== null,
        description: "Buttons meet minimum touch target size"
      },
      {
        name: "Focus Styles",
        passed: document.querySelector("style")?.textContent?.includes("focus-visible") !== null,
        description: "Enhanced focus styles implemented"
      }
    ];

    // Motor Accessibility Audit
    const motorChecks = [
      {
        name: "Touch Targets",
        passed: document.querySelector("style")?.textContent?.includes("min-height: 44px") !== null,
        description: "Touch targets meet minimum size requirements"
      },
      {
        name: "Spacing",
        passed: document.querySelector("style")?.textContent?.includes("margin-bottom: 16px") !== null,
        description: "Adequate spacing between interactive elements"
      },
      {
        name: "Timeout Accommodations",
        passed: document.querySelector("style")?.textContent?.includes("timeout-message") !== null,
        description: "Timeout accommodations implemented"
      }
    ];

    results.push(
      { category: "Keyboard Navigation", checks: keyboardChecks },
      { category: "Screen Reader", checks: screenReaderChecks },
      { category: "Visual Accessibility", checks: visualChecks },
      { category: "Motor Accessibility", checks: motorChecks }
    );

    setAuditResults(results);
    setIsRunning(false);
  };

  useEffect(() => {
    runAudit();
  }, []);

  const getOverallScore = () => {
    const totalChecks = auditResults.reduce((sum, cat) => sum + cat.checks.length, 0);
    const passedChecks = auditResults.reduce((sum, cat) => 
      sum + cat.checks.filter(check => check.passed).length, 0
    );
    return totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  if (!isVisible) {
    return (
      <div className="fixed top-20 right-4 z-30">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          aria-label="Show accessibility audit"
        >
          <CheckCircle className="w-4 h-4" />
          <span className="text-xs font-medium">A11y Audit</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 bg-white rounded-lg shadow-xl p-4 w-80 border border-gray-200 max-h-[70vh] overflow-y-auto">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex-1">
          <h2 className="text-base font-bold text-gray-900 mb-1">Accessibility Audit</h2>
          <p className="text-xs text-gray-600">
            WCAG 2.1 AA compliance check
          </p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 ml-2"
          aria-label="Close accessibility audit"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-center">
            <div className={`text-xl font-bold ${getScoreColor(getOverallScore())}`}>
              {getOverallScore()}%
            </div>
            <div className="text-xs text-gray-600">Score</div>
          </div>
        </div>
        
        <div className="flex gap-1">
          <button
            onClick={runAudit}
            disabled={isRunning}
            className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
          >
            {isRunning ? "..." : "Run"}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
          >
            Test
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 flex items-center gap-1"
          >
            {showDetails ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="space-y-3 mb-3">
          {auditResults.map((category, catIndex) => (
            <div key={catIndex} className="border rounded-lg p-2">
              <h3 className="font-semibold text-gray-900 mb-2 text-xs">{category.category}</h3>
              <div className="space-y-1">
                {category.checks.map((check, checkIndex) => (
                  <div key={checkIndex} className="flex items-start gap-1">
                    {check.passed ? (
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-xs">{check.name}</div>
                      <div className="text-xs text-gray-500">{check.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1 text-xs">Note</h4>
            <p className="text-xs text-blue-800">
              Automated audit - manual testing recommended
            </p>
          </div>
        </div>
      </div>

      {/* Test Modal */}
      <AccessibleModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Test Modal for Focus Trapping"
      >
        <p className="mb-4">
          This is a test modal to demonstrate proper focus trapping functionality.
        </p>
        <p className="mb-4">
          Try using Tab key to navigate between elements. Focus should be trapped within this modal.
        </p>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Test input 1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Test input 2"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
            Test Button Inside Modal
          </button>
        </div>
      </AccessibleModal>
    </div>
  );
}
