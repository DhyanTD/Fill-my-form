// Form Field Extractor Content Script
class FormFieldExtractor {
  constructor() {
    this.formFields = [];
  }

  // Generate unique identifier for field
  generateFieldId(element, index) {
    const id =
      element.id || element.name || element.className || `field_${index}`;
    const tagName = element.tagName.toLowerCase();
    return `${tagName}_${id}_${index}`;
  }

  // Get label for form field
  getFieldLabel(element) {
    // Check for associated label element
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Check for parent label
    const parentLabel = element.closest("label");
    if (parentLabel) {
      return parentLabel.textContent.replace(element.value || "", "").trim();
    }

    // Check for preceding label sibling
    let prevSibling = element.previousElementSibling;
    while (prevSibling) {
      if (prevSibling.tagName === "LABEL") {
        return prevSibling.textContent.trim();
      }
      if (prevSibling.textContent && prevSibling.textContent.trim()) {
        break;
      }
      prevSibling = prevSibling.previousElementSibling;
    }

    // Check for nearby text content
    const nearbyText = this.findNearbyText(element);
    if (nearbyText) return nearbyText;

    // Fallback to attributes
    return (
      element.placeholder ||
      element.name ||
      element.id ||
      element.getAttribute("aria-label") ||
      "Unknown Field"
    );
  }

  // Find nearby text that might serve as a label
  findNearbyText(element) {
    const parent = element.parentElement;
    if (!parent) return null;

    // Check parent's text content
    const parentText = parent.textContent
      .replace(element.value || "", "")
      .trim();
    if (parentText && parentText.length < 100) {
      return parentText;
    }

    // Check for nearby spans or divs with text
    const siblings = Array.from(parent.children);
    for (let sibling of siblings) {
      if (
        sibling !== element &&
        sibling.textContent.trim() &&
        sibling.textContent.trim().length < 50
      ) {
        return sibling.textContent.trim();
      }
    }

    return null;
  }

  // Determine field type and constraints
  analyzeField(element) {
    const type = element.type || element.tagName.toLowerCase();
    const constraints = {
      required: element.hasAttribute("required"),
      minLength: element.minLength || null,
      maxLength: element.maxLength || null,
      pattern: element.pattern || null,
      min: element.min || null,
      max: element.max || null,
      step: element.step || null,
    };

    // Get options for select elements
    let options = [];
    if (element.tagName === "SELECT") {
      options = Array.from(element.options).map((opt) => ({
        value: opt.value,
        text: opt.textContent.trim(),
      }));
    }

    // Determine semantic type based on field analysis
    const semanticType = this.determineSemanticType(element);

    return {
      fieldType: type,
      semanticType: semanticType,
      constraints: constraints,
      options: options,
      placeholder: element.placeholder || null,
      currentValue: element.value || null,
    };
  }

  // Determine semantic type of field for better AI understanding
  determineSemanticType(element) {
    const label = this.getFieldLabel(element).toLowerCase();
    const name = (element.name || "").toLowerCase();
    const id = (element.id || "").toLowerCase();
    const placeholder = (element.placeholder || "").toLowerCase();
    const type = element.type || "";

    const allText = `${label} ${name} ${id} ${placeholder}`.toLowerCase();

    // Email detection
    if (type === "email" || /email|e-mail/.test(allText)) {
      return "email";
    }

    // Phone detection
    if (type === "tel" || /phone|mobile|contact|number/.test(allText)) {
      return "phone";
    }

    // Name detection
    if (/name|full.name|first.name|last.name|surname/.test(allText)) {
      return "name";
    }

    // Address detection
    if (/address|street|city|zip|postal|country|state/.test(allText)) {
      return "address";
    }

    // Date detection
    if (type === "date" || /date|birth|dob/.test(allText)) {
      return "date";
    }

    // Password detection
    if (type === "password") {
      return "password";
    }

    // Number detection
    if (type === "number" || /age|quantity|amount|count/.test(allText)) {
      return "number";
    }

    // URL detection
    if (type === "url" || /website|url|link/.test(allText)) {
      return "url";
    }

    // Company/Organization
    if (/company|organization|employer|business/.test(allText)) {
      return "company";
    }

    // Title/Position
    if (/title|position|role|job/.test(allText)) {
      return "title";
    }

    return "text"; // default
  }

  // Extract all form fields from the page
  extractFormFields() {
    this.formFields = [];
    const formElements = document.querySelectorAll("input, select, textarea");

    formElements.forEach((element, index) => {
      // Skip hidden fields, buttons, and submit inputs
      if (
        element.type === "hidden" ||
        element.type === "button" ||
        element.type === "submit" ||
        element.type === "reset" ||
        element.style.display === "none" ||
        element.offsetParent === null
      ) {
        return;
      }

      const fieldData = {
        id: this.generateFieldId(element, index),
        label: this.getFieldLabel(element),
        element: {
          tagName: element.tagName,
          type: element.type || null,
          name: element.name || null,
          id: element.id || null,
          className: element.className || null,
        },
        analysis: this.analyzeField(element),
        context: this.getFieldContext(element),
        selector: this.generateSelector(element),
        position: this.getElementPosition(element),
      };

      this.formFields.push(fieldData);
    });

    return this.formFields;
  }

  // Get context about the form field (surrounding form, section, etc.)
  getFieldContext(element) {
    const form = element.closest("form");
    const section = element.closest('section, div[class*="section"], fieldset');

    return {
      formId: form ? form.id || form.className || "unnamed-form" : null,
      formAction: form ? form.action : null,
      sectionClass: section ? section.className : null,
      sectionId: section ? section.id : null,
      fieldIndex: Array.from(form ? form.elements : [element]).indexOf(element),
    };
  }

  // Generate CSS selector for the element
  generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    if (element.name) {
      return `${element.tagName.toLowerCase()}[name="${element.name}"]`;
    }
    if (element.className) {
      return `${element.tagName.toLowerCase()}.${element.className.split(" ")[0]}`;
    }

    // Fallback to nth-child selector
    const parent = element.parentElement;
    if (parent) {
      const index = Array.from(parent.children).indexOf(element) + 1;
      return `${parent.tagName.toLowerCase()} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
    }

    return element.tagName.toLowerCase();
  }

  // Get element position for reference
  getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    };
  }

  // Prepare data for AI processing
  prepareForAI() {
    const extractedFields = this.extractFormFields();

    const aiReadyData = {
      timestamp: new Date().toISOString(),
      pageUrl: window.location.href,
      pageTitle: document.title,
      totalFields: extractedFields.length,
      fields: extractedFields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.analysis.fieldType,
        semanticType: field.analysis.semanticType,
        required: field.analysis.constraints.required,
        placeholder: field.analysis.placeholder,
        currentValue: field.analysis.currentValue,
        options: field.analysis.options,
        constraints: field.analysis.constraints,
        context: field.context.formId || "no-form",
      })),
      formGroups: this.groupFieldsByForm(extractedFields),
    };

    return aiReadyData;
  }

  // Group fields by form for better context
  groupFieldsByForm(fields) {
    const groups = {};

    fields.forEach((field) => {
      const formId = field.context.formId || "no-form";
      if (!groups[formId]) {
        groups[formId] = [];
      }
      groups[formId].push({
        id: field.id,
        label: field.label,
        semanticType: field.analysis.semanticType,
        required: field.analysis.constraints.required,
      });
    });

    return groups;
  }

  // Fill field with provided value
  fillField(fieldId, value) {
    const field = this.formFields.find((f) => f.id === fieldId);
    if (!field) return false;

    const element = document.querySelector(field.selector);
    if (!element) return false;

    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }
}

// Initialize extractor
const formExtractor = new FormFieldExtractor();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractFields") {
    const data = formExtractor.prepareForAI();
    sendResponse({ success: true, data: data });
  } else if (request.action === "fillField") {
    const success = formExtractor.fillField(request.fieldId, request.value);
    sendResponse({ success: success });
  } else if (request.action === "fillMultipleFields") {
    const results = {};
    request.fields.forEach(({ fieldId, value }) => {
      results[fieldId] = formExtractor.fillField(fieldId, value);
    });
    sendResponse({ success: true, results: results });
  }
});

// Auto-extract on page load for debugging
window.addEventListener("load", () => {
  console.log("Form Field Extractor loaded");
});
