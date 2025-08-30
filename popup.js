// Popup script for Form Field Extractor
document.addEventListener("DOMContentLoaded", function () {
  const extractBtn = document.getElementById("extractBtn");
  const loading = document.getElementById("loading");
  const status = document.getElementById("status");
  const fieldCount = document.getElementById("fieldCount");
  const fieldList = document.getElementById("fieldList");
  const aiSection = document.getElementById("aiSection");
  const aiData = document.getElementById("aiData");
  const copyBtn = document.getElementById("copyBtn");

  // New AI response elements
  const aiResponseSection = document.getElementById("aiResponseSection");
  const aiResponseInput = document.getElementById("aiResponseInput");
  const parseJsonBtn = document.getElementById("parseJsonBtn");
  const parseTextBtn = document.getElementById("parseTextBtn");
  const clearResponseBtn = document.getElementById("clearResponseBtn");
  const fillStatus = document.getElementById("fillStatus");
  const fillResults = document.getElementById("fillResults");
  const fillSummary = document.getElementById("fillSummary");
  const debugBtn = document.getElementById("debugBtn");

  let currentData = null;
  let lastFillResults = null;

  // Show status message
  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = "block";

    setTimeout(() => {
      status.style.display = "none";
    }, 3000);
  }

  // Format field data for display
  function formatFieldForDisplay(field) {
    const requiredBadge = field.required
      ? ' <span style="color: #e74c3c;">*</span>'
      : "";
    return `
            <div class="field-item">
                <div class="field-label">${field.label}${requiredBadge}</div>
                <div class="field-type">${field.semanticType} (${field.type})</div>
                ${field.placeholder ? `<div class="field-type">Placeholder: "${field.placeholder}"</div>` : ""}
            </div>
        `;
  }

  // Extract form fields from current tab
  extractBtn.addEventListener("click", async function () {
    try {
      // Show loading
      loading.style.display = "block";
      extractBtn.disabled = true;
      fieldCount.style.display = "none";
      aiSection.style.display = "none";

      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Execute content script and extract fields
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "extractFields",
      });

      if (response && response.success) {
        currentData = response.data;
        displayResults(currentData);
        showStatus(
          `Successfully extracted ${currentData.totalFields} form fields!`,
          "success",
        );
      } else {
        throw new Error("Failed to extract form fields");
      }
    } catch (error) {
      console.error("Error extracting fields:", error);
      showStatus(
        "Error: Could not extract form fields. Make sure you're on a page with forms.",
        "error",
      );
    } finally {
      loading.style.display = "none";
      extractBtn.disabled = false;
    }
  });

  // Display extraction results
  function displayResults(data) {
    // Show field count and list
    fieldList.innerHTML = data.fields.map(formatFieldForDisplay).join("");
    fieldCount.style.display = "block";

    // Prepare and show AI data
    const aiReadyData = {
      pageInfo: {
        url: data.pageUrl,
        title: data.pageTitle,
        timestamp: data.timestamp,
      },
      formFields: data.fields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        semanticType: field.semanticType,
        required: field.required,
        placeholder: field.placeholder,
        currentValue: field.currentValue,
        options: field.options.length > 0 ? field.options : undefined,
        constraints: Object.keys(field.constraints).some(
          (key) =>
            field.constraints[key] !== null && field.constraints[key] !== false,
        )
          ? field.constraints
          : undefined,
      })),
      formGroups: data.formGroups,
      instructions: {
        purpose:
          "Analyze these form fields and provide appropriate values based on the field types and labels",
        responseFormat:
          "Return suggestions as an array of objects with 'id' and 'suggestedValue' properties",
        notes:
          "Consider semantic types, constraints, and context when suggesting values",
      },
    };

    aiData.textContent = JSON.stringify(aiReadyData, null, 2);
    aiSection.style.display = "block";

    // Show AI response input section
    aiResponseSection.style.display = "block";
  }

  // Copy JSON data to clipboard
  copyBtn.addEventListener("click", async function () {
    try {
      await navigator.clipboard.writeText(aiData.textContent);
      showStatus("JSON data copied to clipboard!", "success");
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = aiData.textContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showStatus("JSON data copied to clipboard!", "success");
    }
  });

  // Parse JSON response and fill fields
  parseJsonBtn.addEventListener("click", async function () {
    const responseText = aiResponseInput.value.trim();
    if (!responseText) {
      showStatus("Please paste AI response first", "error");
      return;
    }

    try {
      parseJsonBtn.disabled = true;
      parseJsonBtn.textContent = "🔄 Processing...";

      const suggestions = parseAIResponse(responseText, "json");
      if (suggestions.length > 0) {
        await fillFormWithSuggestions(suggestions);
      } else {
        showStatus("No valid field suggestions found in response", "error");
      }
    } catch (error) {
      showStatus("Error parsing AI response: " + error.message, "error");
    } finally {
      parseJsonBtn.disabled = false;
      parseJsonBtn.textContent = "🎯 Parse & Fill (JSON)";
    }
  });

  // Parse text response and fill fields
  parseTextBtn.addEventListener("click", async function () {
    const responseText = aiResponseInput.value.trim();
    if (!responseText) {
      showStatus("Please paste AI response first", "error");
      return;
    }

    console.log(responseText, "suggestions resp");
    try {
      parseTextBtn.disabled = true;
      parseTextBtn.textContent = "🔄 Processing...";

      const suggestions = parseAIResponse(responseText, "text");
      if (suggestions.length > 0) {
        console.log(suggestions, "suggestions");
        await fillFormWithSuggestions(suggestions);
      } else {
        showStatus(
          "Could not extract field values from text response",
          "error",
        );
      }
    } catch (error) {
      showStatus("Error parsing text response: " + error.message, "error");
    } finally {
      parseTextBtn.disabled = false;
      parseTextBtn.textContent = "📝 Parse & Fill (Text)";
    }
  });

  // Clear AI response input
  clearResponseBtn.addEventListener("click", function () {
    aiResponseInput.value = "";
    fillStatus.style.display = "none";
    showStatus("Response input cleared", "success");
  });

  // Parse AI response based on format
  function parseAIResponse(responseText, format) {
    if (format === "json") {
      return parseJSONResponse(responseText);
    } else {
      return parseTextResponse(responseText);
    }
  }

  // Parse JSON formatted AI response
  function parseJSONResponse(responseText) {
    try {
      // Try to parse as direct JSON array
      let parsed = JSON.parse(responseText);

      // Handle different response formats
      if (Array.isArray(parsed)) {
        return validateSuggestions(parsed);
      } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        return validateSuggestions(parsed.suggestions);
      } else if (parsed.fields && Array.isArray(parsed.fields)) {
        return validateSuggestions(parsed.fields);
      } else if (parsed.data && Array.isArray(parsed.data)) {
        return validateSuggestions(parsed.data);
      } else {
        throw new Error(
          "Invalid JSON format: expected array of field suggestions",
        );
      }
    } catch (error) {
      // Try to extract JSON from text if it's embedded
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[0]);
          return validateSuggestions(extracted);
        } catch (e) {
          throw new Error("Could not parse JSON: " + error.message);
        }
      }
      throw new Error("Invalid JSON format: " + error.message);
    }
  }

  // Parse text formatted AI response
  function parseTextResponse(responseText) {
    console.log("heere");
    if (!currentData || !currentData.fields) {
      throw new Error(
        "No form data available. Please extract fields first....",
      );
    }

    const suggestions = [];
    const lines = responseText.split("\n");

    // Try to match field labels/IDs with values in text
    currentData.fields.forEach((field) => {
      const fieldLabel = field.label.toLowerCase();
      const fieldId = field.id;

      // Look for patterns like "Email: john@example.com" or "Email Address: john@example.com"
      for (let line of lines) {
        const normalizedLine = line.toLowerCase();

        // Pattern 1: "Label: Value"
        if (normalizedLine.includes(fieldLabel + ":")) {
          const value = line.split(":")[1]?.trim().replace(/['"]/g, "");
          if (value) {
            suggestions.push({ id: fieldId, suggestedValue: value });
            break;
          }
        }

        // Pattern 2: "Label - Value" or "Label = Value"
        if (
          normalizedLine.includes(fieldLabel + "-") ||
          normalizedLine.includes(fieldLabel + "=")
        ) {
          const value = line.split(/[-=]/)[1]?.trim().replace(/['"]/g, "");
          if (value) {
            suggestions.push({ id: fieldId, suggestedValue: value });
            break;
          }
        }

        // Pattern 3: Field ID mentioned with value
        if (normalizedLine.includes(fieldId.toLowerCase())) {
          const parts = line.split(/[:=-]/);
          if (parts.length > 1) {
            const value = parts[1].trim().replace(/['"]/g, "");
            if (value) {
              suggestions.push({ id: fieldId, suggestedValue: value });
              break;
            }
          }
        }
      }
    });

    return suggestions;
  }

  // Validate suggestion format
  function validateSuggestions(suggestions) {
    if (!Array.isArray(suggestions)) {
      throw new Error("Expected array of suggestions");
    }

    return suggestions.filter((suggestion) => {
      if (typeof suggestion !== "object" || !suggestion.id) {
        return false;
      }

      // Handle different property names
      if (
        !suggestion.suggestedValue &&
        !suggestion.value &&
        !suggestion.answer
      ) {
        return false;
      }

      // Normalize property names
      if (!suggestion.suggestedValue) {
        suggestion.suggestedValue = suggestion.value || suggestion.answer;
      }

      return true;
    });
  }

  // Fill form with AI suggestions
  async function fillFormWithSuggestions(suggestions) {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "fillMultipleFields",
        fields: suggestions,
      });

      if (response && response.success) {
        lastFillResults = response;
        displayFillResults(
          suggestions,
          response.results,
          response.detailedResults,
          response.summary,
        );
        showStatus(
          `Successfully filled ${response.summary.successful}/${response.summary.total} fields!`,
          response.summary.successful === response.summary.total
            ? "success"
            : "error",
        );
      } else {
        throw new Error("Failed to fill fields");
      }
    } catch (error) {
      console.error("Error filling fields:", error);
      showStatus("Error filling fields: " + error.message, "error");
    }
  }

  // Display fill results with enhanced information
  function displayFillResults(suggestions, results, detailedResults, summary) {
    // Display summary
    fillSummary.innerHTML = `
            <strong>Fill Summary:</strong> 
            ${summary.successful} successful, 
            ${summary.failed} failed out of ${summary.total} fields
            ${summary.failed > 0 ? '<br><em>Click "Debug Failed Fields" below for details</em>' : ""}
        `;

    fillResults.innerHTML = "";

    suggestions.forEach((suggestion) => {
      const success = results[suggestion.id];
      const detailResult = detailedResults[suggestion.id];
      const field = currentData.fields.find((f) => f.id === suggestion.id);
      const label = field ? field.label : suggestion.id;

      const resultItem = document.createElement("div");
      resultItem.className = `fill-result-item ${success ? "success" : "error"}`;

      let errorInfo = "";
      if (!success && detailResult && detailResult.error) {
        errorInfo = `<div class="fill-result-error" style="font-size: 10px; color: #721c24; margin-top: 4px;">
                    Error: ${detailResult.error}
                </div>`;
      }

      resultItem.innerHTML = `
                <div>
                    <div class="fill-result-label">${label}</div>
                    <div class="fill-result-value">"${suggestion.suggestedValue}"</div>
                    ${errorInfo}
                </div>
                <div style="font-size: 16px;">${success ? "✅" : "❌"}</div>
            `;

      fillResults.appendChild(resultItem);
    });

    fillStatus.style.display = "block";
  }

  // Add auto-resize for textarea
  aiResponseInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 200) + "px";
  });

  // Example function to fill fields (can be called from console or extended)
  window.fillFormFields = async function (suggestions) {
    return await fillFormWithSuggestions(suggestions);
  };

  // Debug failed fields
  debugBtn.addEventListener("click", async function () {
    if (!lastFillResults) {
      showStatus("No fill results to debug", "error");
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const failedFields = Object.entries(lastFillResults.results)
        .filter(([fieldId, success]) => !success)
        .map(([fieldId]) => fieldId);

      if (failedFields.length === 0) {
        showStatus("No failed fields to debug", "success");
        return;
      }

      const debugInfo = await Promise.all(
        failedFields.map(async (fieldId) => {
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "debugField",
            fieldId: fieldId,
          });
          return { fieldId, debug: response.debug };
        }),
      );

      displayDebugInfo(debugInfo);
    } catch (error) {
      showStatus("Error debugging fields: " + error.message, "error");
    }
  });

  // Add keyboard shortcut info
  const instructionsParagraph = document.querySelector(".ai-section p");
  if (instructionsParagraph) {
    instructionsParagraph.innerHTML = instructionsParagraph.innerHTML.replace(
      '5. Click "Parse & Fill" to auto-complete the form',
      '5. Click "Parse & Fill" to auto-complete the form<br>6. View detailed results below',
    );
  }
});
