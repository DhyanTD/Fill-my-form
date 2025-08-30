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
    if (!field) {
      console.log(`Field not found: ${fieldId}`);
      return { success: false, error: "Field not found" };
    }

    const element = document.querySelector(field.selector);
    if (!element) {
      console.log(`Element not found for selector: ${field.selector}`);
      return { success: false, error: "Element not found" };
    }

    try {
      return this.setElementValue(element, value, field);
    } catch (error) {
      console.error(`Error filling field ${fieldId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Smart element value setting based on element type
  setElementValue(element, value, field) {
    const tagName = element.tagName.toLowerCase();
    const inputType = element.type?.toLowerCase();

    // Handle different element types
    switch (tagName) {
      case "input":
        return this.handleInputElement(element, value, inputType);
      case "select":
        return this.handleSelectElement(element, value);
      case "textarea":
        return this.handleTextareaElement(element, value);
      default:
        return {
          success: false,
          error: `Unsupported element type: ${tagName}`,
        };
    }
  }

  // Handle input elements
  handleInputElement(element, value, inputType) {
    switch (inputType) {
      case "checkbox":
      case "radio":
        return this.handleCheckboxRadio(element, value);
      case "date":
        return this.handleDateInput(element, value);
      case "email":
      case "text":
      case "password":
      case "tel":
      case "url":
      case "search":
      default:
        return this.handleTextInput(element, value);
    }
  }

  // Handle text inputs
  handleTextInput(element, value) {
    // Clear existing value
    element.value = "";
    element.focus();

    // Set new value
    element.value = String(value);

    // Trigger events in sequence for Angular/React compatibility
    this.triggerEvents(element, ["focus", "input", "change", "blur"]);

    // Special handling for autocomplete fields
    if (element.classList.contains("ui-autocomplete-input")) {
      setTimeout(() => {
        // Try to trigger autocomplete
        element.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
          }),
        );
        setTimeout(() => {
          element.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Enter",
              bubbles: true,
            }),
          );
        }, 100);
      }, 100);
    }

    return { success: true, value: element.value };
  }

  // Handle checkbox and radio inputs
  handleCheckboxRadio(element, value) {
    const shouldCheck =
      value === true || value === "true" || value === "1" || value === "yes";
    element.checked = shouldCheck;
    this.triggerEvents(element, ["change", "click"]);
    return { success: true, value: element.checked };
  }

  // Handle date inputs
  handleDateInput(element, value) {
    // Try to parse different date formats
    let dateValue = value;

    if (typeof value === "string") {
      // Handle common date formats
      if (value.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        // DD/MM/YYYY or MM/DD/YYYY
        const parts = value.split("/");
        dateValue = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      } else if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Already in YYYY-MM-DD format
        dateValue = value;
      }
    }

    element.value = dateValue;
    this.triggerEvents(element, ["input", "change"]);
    return { success: true, value: element.value };
  }

  // Handle select elements
  handleSelectElement(element, value) {
    // Try to find matching option by value or text
    const options = Array.from(element.options);
    let selectedOption = null;

    // First try exact value match
    selectedOption = options.find((opt) => opt.value === String(value));

    // Then try text content match
    if (!selectedOption) {
      selectedOption = options.find((opt) =>
        opt.textContent
          .trim()
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      );
    }

    // Try partial match
    if (!selectedOption) {
      selectedOption = options.find(
        (opt) =>
          String(value)
            .toLowerCase()
            .includes(opt.textContent.trim().toLowerCase()) ||
          opt.textContent
            .trim()
            .toLowerCase()
            .includes(String(value).toLowerCase()),
      );
    }

    if (selectedOption) {
      element.selectedIndex = selectedOption.index;
      this.triggerEvents(element, ["change"]);
      return { success: true, value: selectedOption.textContent.trim() };
    } else {
      return {
        success: false,
        error: `No matching option found for value: ${value}`,
      };
    }
  }

  // Handle textarea elements
  handleTextareaElement(element, value) {
    element.value = String(value);
    this.triggerEvents(element, ["input", "change"]);
    return { success: true, value: element.value };
  }

  // Trigger multiple events on an element
  triggerEvents(element, eventTypes) {
    eventTypes.forEach((eventType) => {
      let event;
      if (eventType === "input") {
        event = new Event("input", { bubbles: true, cancelable: true });
      } else if (eventType === "change") {
        event = new Event("change", { bubbles: true, cancelable: true });
      } else if (eventType === "focus") {
        event = new FocusEvent("focus", { bubbles: true });
      } else if (eventType === "blur") {
        event = new FocusEvent("blur", { bubbles: true });
      } else if (eventType === "click") {
        event = new MouseEvent("click", { bubbles: true, cancelable: true });
      } else {
        event = new Event(eventType, { bubbles: true, cancelable: true });
      }

      element.dispatchEvent(event);
    });
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
    const result = formExtractor.fillField(request.fieldId, request.value);
    sendResponse({ success: result.success, result: result });
  } else if (request.action === "fillMultipleFields") {
    const results = {};
    const detailedResults = {};

    request.fields.forEach(({ fieldId, value }) => {
      const result = formExtractor.fillField(fieldId, value);
      results[fieldId] = result.success;
      detailedResults[fieldId] = result;
    });

    sendResponse({
      success: true,
      results: results,
      detailedResults: detailedResults,
      summary: {
        total: request.fields.length,
        successful: Object.values(results).filter(Boolean).length,
        failed: Object.values(results).filter((r) => !r).length,
      },
    });
  } else if (request.action === "debugField") {
    // Debug specific field
    const field = formExtractor.formFields.find(
      (f) => f.id === request.fieldId,
    );
    const element = field ? document.querySelector(field.selector) : null;

    sendResponse({
      success: true,
      debug: {
        fieldFound: !!field,
        elementFound: !!element,
        fieldData: field,
        elementInfo: element
          ? {
              tagName: element.tagName,
              type: element.type,
              value: element.value,
              classList: Array.from(element.classList),
              attributes: Array.from(element.attributes).map((attr) => ({
                name: attr.name,
                value: attr.value,
              })),
            }
          : null,
      },
    });
  } else if (request.action === "getAllFields") {
    // Return all current field data for debugging
    sendResponse({
      success: true,
      fields: formExtractor.formFields.map((field) => ({
        id: field.id,
        label: field.label,
        selector: field.selector,
        type: field.analysis.fieldType,
        semanticType: field.analysis.semanticType,
      })),
    });
  }
});

// Auto-extract on page load for debugging
window.addEventListener("load", () => {
  console.log("Form Field Extractor loaded");
});
