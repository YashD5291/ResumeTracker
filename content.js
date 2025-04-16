document.addEventListener('DOMContentLoaded', function () {
    // Find all file input elements that could be resume uploads
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));

    // Filter for likely resume upload fields
    const resumeInputs = fileInputs.filter(input => {
        const inputName = input.name.toLowerCase();
        const inputId = input.id.toLowerCase();
        const inputLabel = findLabelText(input).toLowerCase();

        return (
            inputName.includes('resume') ||
            inputName.includes('cv') ||
            inputId.includes('resume') ||
            inputId.includes('cv') ||
            inputLabel.includes('resume') ||
            inputLabel.includes('cv')
        );
    });

    // Monitor these fields for file selection
    resumeInputs.forEach(input => {
        input.addEventListener('change', function (event) {
            if (this.files && this.files.length > 0) {
                const resumeFile = this.files[0];

                // Extract job details from the page
                const jobTitle = extractJobTitle();
                const companyName = extractCompanyName();

                // Prepare application data
                const applicationData = {
                    resumeFileName: resumeFile.name,
                    websiteUrl: window.location.href,
                    companyName: companyName,
                    jobTitle: jobTitle,
                    dateApplied: new Date().toISOString(),
                    status: "Applied"
                };

                // Save to Chrome storage when the form is submitted
                const form = findParentForm(this);
                if (form) {
                    form.addEventListener('submit', function () {
                        saveApplication(applicationData);
                    });
                }
            }
        });
    });
});

// Find the text of a label associated with an input
function findLabelText(input) {
    const id = input.id;
    if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return label.textContent.trim();
    }

    // Try to find a parent label
    let parent = input.parentElement;
    while (parent) {
        if (parent.tagName === 'LABEL') return parent.textContent.trim();
        parent = parent.parentElement;
        if (parent.tagName === 'BODY') break;
    }

    return "";
}

// Find the form containing an input
function findParentForm(input) {
    let parent = input.parentElement;
    while (parent) {
        if (parent.tagName === 'FORM') return parent;
        parent = parent.parentElement;
        if (parent.tagName === 'BODY') break;
    }
    return null;
}

// Extract job title from the page
function extractJobTitle() {
    // Try common selectors where job titles might be found
    const selectors = [
        'h1',
        '.job-title',
        '.position-title',
        '[data-automation="job-title"]'
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent.trim();
            if (text) return text;
        }
    }

    // Fallback to page title
    const pageTitle = document.title;
    return pageTitle || "Unknown Position";
}

// Extract company name from the page
function extractCompanyName() {
    // Try to find company name in common locations
    const selectors = [
        '.company-name',
        '.employer-name',
        '[data-automation="company-name"]'
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent.trim();
            if (text) return text;
        }
    }

    // Try to extract from URL
    const hostname = window.location.hostname;
    // Remove www. and .com/.org/etc.
    const domainParts = hostname.split('.');
    if (domainParts.length > 1) {
        if (domainParts[0] === 'www') {
            return domainParts[1].charAt(0).toUpperCase() + domainParts[1].slice(1);
        } else {
            return domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
        }
    }

    return hostname || "Unknown Company";
}

// Save application data to Chrome storage
function saveApplication(applicationData) {
    chrome.storage.local.get('applications', function (data) {
        const applications = data.applications || [];
        applications.push(applicationData);

        chrome.storage.local.set({ 'applications': applications }, function () {
            console.log('Application saved:', applicationData);
        });
    });
}