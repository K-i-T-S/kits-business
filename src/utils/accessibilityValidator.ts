import { AccessibilityTester } from "./accessibility";

export class AccessibilityValidator {
  static validateWCAGCompliance(): {
    score: number;
    issues: string[];
    recommendations: string[];
    categoryScores: {
      keyboard: number;
      visual: number;
      cognitive: number;
      motor: number;
    };
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Keyboard Navigation
    const keyboardScore = this.validateKeyboardNavigation(issues, recommendations);
    
    // Visual Accessibility
    const visualScore = this.validateVisualAccessibility(issues, recommendations);
    
    // Cognitive Accessibility
    const cognitiveScore = this.validateCognitiveAccessibility(issues, recommendations);
    
    // Motor Accessibility
    const motorScore = this.validateMotorAccessibility(issues, recommendations);
    
    const overallScore = Math.round(
      (keyboardScore + visualScore + cognitiveScore + motorScore) / 4
    );
    
    return {
      score: overallScore,
      issues,
      recommendations,
      categoryScores: {
        keyboard: keyboardScore,
        visual: visualScore,
        cognitive: cognitiveScore,
        motor: motorScore
      }
    };
  }
  
  private static validateKeyboardNavigation(issues: string[], recommendations: string[]): number {
    let score = 100;
    
    // Check for focusable elements
    const focusableElements = document.querySelectorAll(
      "button, a, input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
    );
    
    if (focusableElements.length === 0) {
      issues.push("No focusable elements found");
      recommendations.push("Add keyboard-accessible interactive elements");
      score -= 30;
    }
    
    // Check for skip links
    const skipLinks = document.querySelectorAll(".skip-link, [href=\"#main-content\"]");
    if (skipLinks.length === 0) {
      issues.push("No skip links found");
      recommendations.push("Add skip links for keyboard navigation");
      score -= 10;
    }
    
    // Check focus indicators
    const focusStyles = getComputedStyle(document.body);
    if (!focusStyles.getPropertyValue("--focus-ring") && !focusStyles.outline) {
      issues.push("No visible focus indicators");
      recommendations.push("Add visible focus styles for keyboard navigation");
      score -= 20;
    }
    
    return Math.max(0, score);
  }
  
  private static validateVisualAccessibility(issues: string[], recommendations: string[]): number {
    let score = 100;
    
    // Check for alt text
    const missingAlt = AccessibilityTester.checkMissingAltText();
    if (missingAlt.length > 0) {
      issues.push(`${missingAlt.length} images missing alt text`);
      recommendations.push("Add descriptive alt text to all images");
      score -= Math.min(30, missingAlt.length * 5);
    }
    
    // Check for high contrast mode
    const highContrastElements = document.querySelectorAll("[data-high-contrast]");
    if (highContrastElements.length === 0) {
      issues.push("No high contrast mode support");
      recommendations.push("Implement high contrast mode");
      score -= 15;
    }
    
    // Check color contrast (simplified)
    const textElements = document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, span, div");
    if (textElements.length > 0) {
      // This is a simplified check - real implementation would calculate actual contrast
      const hasContrastStyles = document.querySelector("style")?.textContent?.includes("contrast");
      if (!hasContrastStyles) {
        issues.push("Color contrast not explicitly defined");
        recommendations.push("Ensure text meets WCAG contrast requirements");
        score -= 10;
      }
    }
    
    return Math.max(0, score);
  }
  
  private static validateCognitiveAccessibility(issues: string[], recommendations: string[]): number {
    let score = 100;
    
    // Check for semantic HTML
    const semanticElements = document.querySelectorAll("main, nav, header, footer, section, article");
    if (semanticElements.length < 3) {
      issues.push("Insufficient semantic HTML structure");
      recommendations.push("Use semantic HTML elements for better structure");
      score -= 15;
    }
    
    // Check for headings hierarchy
    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    if (headings.length === 0) {
      issues.push("No headings found");
      recommendations.push("Add proper heading structure");
      score -= 20;
    }
    
    // Check for ARIA labels
    const ariaElements = document.querySelectorAll("[aria-label], [aria-labelledby]");
    if (ariaElements.length === 0) {
      issues.push("No ARIA labels found");
      recommendations.push("Add ARIA labels for screen readers");
      score -= 10;
    }
    
    // Check for live regions
    const liveRegions = document.querySelectorAll("[aria-live]");
    if (liveRegions.length === 0) {
      issues.push("No live regions for dynamic content");
      recommendations.push("Add live regions for dynamic content updates");
      score -= 5;
    }
    
    return Math.max(0, score);
  }
  
  private static validateMotorAccessibility(issues: string[], recommendations: string[]): number {
    let score = 100;
    
    // Check button sizes
    const buttons = document.querySelectorAll("button, [role=\"button\"]");
    const smallButtons = Array.from(buttons).filter(btn => {
      const rect = btn.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    });
    
    if (smallButtons.length > 0) {
      issues.push(`${smallButtons.length} buttons smaller than 44x44px`);
      recommendations.push("Ensure buttons meet minimum touch target size");
      score -= Math.min(20, smallButtons.length * 3);
    }
    
    // Check for spacing between interactive elements
    const interactiveElements = document.querySelectorAll("button, a, input, select, textarea");
    if (interactiveElements.length > 1) {
      // Simplified check - real implementation would measure actual spacing
      const hasSpacingStyles = document.querySelector("style")?.textContent?.includes("margin");
      if (!hasSpacingStyles) {
        issues.push("Insufficient spacing between interactive elements");
        recommendations.push("Add adequate spacing between interactive elements");
        score -= 10;
      }
    }
    
    // Check for keyboard timeouts
    const hasTimeoutStyles = document.querySelector("style")?.textContent?.includes("timeout");
    if (!hasTimeoutStyles) {
      issues.push("No timeout accommodations for motor impairments");
      recommendations.push("Implement timeout accommodations");
      score -= 5;
    }
    
    return Math.max(0, score);
  }
  
  static generateReport(): string {
    const validation = this.validateWCAGCompliance();
    
    let report = "# WCAG 2.1 AA Accessibility Report\\n\\n";
    report += `**Overall Score: ${validation.score}/100**\\n\\n`;
    
    report += "## Category Scores\\n";
    report += `- Keyboard Navigation: ${validation.categoryScores.keyboard}/100\\n`;
    report += `- Visual Accessibility: ${validation.categoryScores.visual}/100\\n`;
    report += `- Cognitive Accessibility: ${validation.categoryScores.cognitive}/100\\n`;
    report += `- Motor Accessibility: ${validation.categoryScores.motor}/100\\n\\n`;
    
    if (validation.issues.length > 0) {
      report += "## Issues Found\\n";
      validation.issues.forEach(issue => {
        report += `- ${issue}\\n`;
      });
      report += "\\n";
    }
    
    if (validation.recommendations.length > 0) {
      report += "## Recommendations\\n";
      validation.recommendations.forEach(rec => {
        report += `- ${rec}\\n`;
      });
      report += "\\n";
    }
    
    report += "## Next Steps\\n";
    report += "1. Address high-priority issues first\\n";
    report += "2. Test with actual screen readers\\n";
    report += "3. Conduct keyboard navigation testing\\n";
    report += "4. Validate with users with disabilities\\n";
    
    return report;
  }
}
