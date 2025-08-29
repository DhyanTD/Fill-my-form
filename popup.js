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

  let currentData = null;

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

  // Example function to fill fields (can be called from console or extended)
  window.fillFormFields = async function (suggestions) {
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
        const successCount = Object.values(response.results).filter(
          Boolean,
        ).length;
        showStatus(`Successfully filled ${successCount} fields!`, "success");
      } else {
        showStatus("Error filling fields", "error");
      }
    } catch (error) {
      console.error("Error filling fields:", error);
      showStatus("Error filling fields", "error");
    }
  };

  // Add keyboard shortcut info
  const instructionsParagraph = document.querySelector(".ai-section p");
  if (instructionsParagraph) {
    instructionsParagraph.innerHTML +=
      "<br>5. Use fillFormFields() in console to auto-fill with AI responses";
  }
});
