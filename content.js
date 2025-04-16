// Global variables
let resumeFileName = null;
let formSubmitted = false;
let applicationData = null;

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeTracker);
// Also try initializing after a delay to ensure dynamic content is loaded
setTimeout(initializeTracker, 2000);

function initializeTracker() {
    console.log('Resume Tracker initializing...');

    // Add site-specific handlers
    if (window.location.hostname.includes('dice.com')) {
        handleDiceSite();
    } else {
        // Generic detection for other sites
        detectResumeFields();
    }

    // Listen for form submissions
    detectFormSubmissions();

    // Setup XHR and Fetch interceptors for AJAX submissions
    interceptAjaxRequests();
}

// Site-specific handler for Dice.com
function handleDiceSite() {
    console.log('Dice.com detected, applying special handling');

    // Dice uses various approaches for file uploads
    const observers = [];

    // Monitor for file upload dialogs that appear dynamically
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check for file inputs in the new elements
                        const fileInputs = node.querySelectorAll('input[type="file"]');
                        fileInputs.forEach(input => {
                            console.log('Dice: Found file input:', input);
                            monitorFileInput(input);
                        });

                        // Check for buttons that might trigger resume uploads
                        const buttons = node.querySelectorAll('button');
                        buttons.forEach(button => {
                            if (button.textContent.toLowerCase().includes('upload') ||
                                button.textContent.toLowerCase().includes('resume') ||
                                button.textContent.toLowerCase().includes('cv')) {
                                button.addEventListener('click', function () {
                                    console.log('Dice: Upload button clicked');
                                    setTimeout(checkForFileInputs, 500);
                                });
                            }
                        });
                    }
                });
            }
        }
    });

    // Start observing the entire document
    observer.observe(document.body, { childList: true, subtree: true });
    observers.push(observer);

    // Also check for existing file inputs
    checkForFileInputs();

    // Special handling for "Apply" or "Submit" buttons on Dice
    document.querySelectorAll('button').forEach(button => {
        if (button.textContent.toLowerCase().includes('apply') ||
            button.textContent.toLowerCase().includes('submit')) {
            button.addEventListener('click', function () {
                console.log('Dice: Apply/Submit button clicked');

                // If we have a resume file recorded, capture the application data
                if (resumeFileName) {
                    captureApplicationData();

                    // Wait a moment and send the data (Dice often uses AJAX)
                    setTimeout(() => {
                        if (applicationData) {
                            saveApplication(applicationData);
                        }
                    }, 1000);
                }
            });
        }
    });
}

// Check for file inputs on the page
function checkForFileInputs() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        monitorFileInput(input);
    });
}

// Monitor a file input for changes
function monitorFileInput(input) {
    // Check if this might be a resume upload field
    const isLikelyResumeField = isResumeField(input);

    if (isLikelyResumeField) {
        console.log('Likely resume field found:', input);

        // Monitor for file selection
        input.addEventListener('change', function (event) {
            if (this.files && this.files.length > 0) {
                resumeFileName = this.files[0].name;
                console.log('Resume file selected:', resumeFileName);

                // Capture application data right away
                captureApplicationData();
            }
        });
    }
}

// Detect all possible resume upload fields
function detectResumeFields() {
    // Find all file inputs
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));

    // Check each one
    fileInputs.forEach(input => {
        monitorFileInput(input);
    });

    // Also look for buttons that might trigger file upload dialogs
    const buttons = document.querySelectorAll('button, a, div[role="button"]');
    buttons.forEach(button => {
        const text = button.textContent.toLowerCase();
        if (text.includes('upload resume') ||
            text.includes('upload cv') ||
            text.includes('attach resume') ||
            text.includes('browse resume')) {
            button.addEventListener('click', function () {
                // After clicking, check for new file inputs
                setTimeout(checkForFileInputs, 500);
            });
        }
    });
}

// Check if a field is likely a resume upload
function isResumeField(input) {
    // Check the input itself
    const inputName = (input.name || '').toLowerCase();
    const inputId = (input.id || '').toLowerCase();
    const inputAccept = (input.accept || '').toLowerCase();

    // Check for resume-related attributes
    if (inputName.includes('resume') || inputName.includes('cv') ||
        inputId.includes('resume') || inputId.includes('cv') ||
        inputAccept.includes('pdf') || inputAccept.includes('doc')) {
        return true;
    }

    // Check surrounding labels and text
    const surroundingText = getSurroundingText(input).toLowerCase();
    const resumeKeywords = ['resume', 'cv', 'curriculum vitae', 'upload your resume',
        'attach resume', 'upload document', 'upload file'];

    for (const keyword of resumeKeywords) {
        if (surroundingText.includes(keyword)) {
            return true;
        }
    }

    return false;
}

// Get text surrounding an element
function getSurroundingText(element) {
    // Look at parent and siblings for context
    let surroundingText = '';

    // Check parent nodes up to 3 levels
    let parent = element.parentElement;
    let level = 0;
    while (parent && level < 3) {
        surroundingText += ' ' + parent.textContent;
        parent = parent.parentElement;
        level++;
    }

    // Look for associated labels
    if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) {
            surroundingText += ' ' + label.textContent;
        }
    }

    return surroundingText;
}

// Detect form submissions through various methods
function detectFormSubmissions() {
    // Monitor all forms
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function (event) {
            console.log('Form submit detected');

            if (resumeFileName) {
                captureApplicationData();
                saveApplication(applicationData);
            }
        });
    });

    // Monitor submit buttons not in forms
    document.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])').forEach(button => {
        button.addEventListener('click', function (event) {
            console.log('Submit button clicked');

            if (resumeFileName) {
                captureApplicationData();

                // Give a slight delay to allow for AJAX form processing
                setTimeout(() => {
                    if (applicationData) {
                        saveApplication(applicationData);
                    }
                }, 500);
            }
        });
    });

    // Monitor navigation away from the page
    window.addEventListener('beforeunload', function (event) {
        // Only if we have a resume file but haven't submitted yet
        if (resumeFileName && !formSubmitted && !applicationData) {
            captureApplicationData();
            saveApplication(applicationData);
        }
    });
}

// Intercept AJAX requests that might be form submissions
function interceptAjaxRequests() {
    // For modern Fetch API
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        // Check if this might be a form/application submission
        const [resource, config] = args;
        let url = resource;

        if (resource instanceof Request) {
            url = resource.url;
        }

        // If URL contains application-related keywords and we have a resume
        if (resumeFileName && !formSubmitted &&
            (url.includes('apply') || url.includes('submit') || url.includes('application'))) {
            console.log('Fetch API detected possible application submission', url);
            captureApplicationData();
            saveApplication(applicationData);
        }

        return originalFetch.apply(this, args);
    };

    // For older XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        // Store URL for checking on send
        this._url = url;
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
        // Check if this request might be a form submission
        if (resumeFileName && !formSubmitted && this._url &&
            (this._url.includes('apply') || this._url.includes('submit') || this._url.includes('application'))) {
            console.log('XHR detected possible application submission', this._url);
            captureApplicationData();
            saveApplication(applicationData);
        }

        return originalXHRSend.apply(this, arguments);
    };
}

// Capture application data from the page
function captureApplicationData() {
    if (!resumeFileName) return null;

    console.log('Capturing application data');

    // Extract job details from the page
    const jobTitle = extractJobTitle();
    const companyName = extractCompanyName();

    // Create application data object
    applicationData = {
        resumeFileName: resumeFileName,
        websiteUrl: window.location.href,
        companyName: companyName,
        jobTitle: jobTitle,
        dateApplied: new Date().toISOString(),
        status: "Applied"
    };

    console.log('Application data captured:', applicationData);
    return applicationData;
}

// Extract job title from the page with enhanced detection
function extractJobTitle() {
    // Prioritize structured data if available (used by many job sites)
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
        try {
            const data = JSON.parse(script.textContent);
            if (data && data.title) return data.title;
            if (data && data["@type"] === "JobPosting" && data.title) return data.title;
        } catch (e) {
            // Continue if parsing fails
        }
    }

    // Dice.com specific selectors
    if (window.location.hostname.includes('dice.com')) {
        const diceTitleSelectors = [
            'h1.job-title',
            '.job-details-header h1',
            'h1.jobTitle',
            'h1[data-cy="jobTitle"]'
        ];

        for (const selector of diceTitleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                return element.textContent.trim();
            }
        }
    }

    // Try common selectors where job titles might be found
    const selectors = [
        'h1',
        'h1.job-title',
        'h1.jobTitle',
        'h1.position-title',
        '.job-title',
        '.jobTitle',
        '.position-title',
        '[data-automation="job-title"]',
        'title'
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent.trim();
            if (text) return text;
        }
    }

    // Try to find the most prominent heading that might be a job title
    const headings = document.querySelectorAll('h1, h2');
    for (const heading of headings) {
        const text = heading.textContent.trim();
        if (text && text.length < 100) { // Likely a title if relatively short
            return text;
        }
    }

    // Fallback to page title, cleaned up
    const pageTitle = document.title;
    // Try to extract just the job title part
    if (pageTitle) {
        // Often title is in format "Job Title - Company Name"
        const parts = pageTitle.split(/[-|]/);
        if (parts.length > 1) {
            return parts[0].trim();
        }
        return pageTitle;
    }

    return "Unknown Position";
}

// Extract company name from the page with enhanced detection
function extractCompanyName() {
    // Prioritize structured data if available
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
        try {
            const data = JSON.parse(script.textContent);
            if (data && data.hiringOrganization && data.hiringOrganization.name) {
                return data.hiringOrganization.name;
            }
            if (data && data["@type"] === "JobPosting" && data.hiringOrganization && data.hiringOrganization.name) {
                return data.hiringOrganization.name;
            }
        } catch (e) {
            // Continue if parsing fails
        }
    }

    // Dice.com specific selectors
    if (window.location.hostname.includes('dice.com')) {
        const diceCompanySelectors = [
            '.company-header-name',
            'a[data-cy="companyNameLink"]',
            '.employer-name',
            '.company-name'
        ];

        for (const selector of diceCompanySelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                return element.textContent.trim();
            }
        }
    }

    // Try common selectors for company names
    const selectors = [
        '.company-name',
        '.employer-name',
        '.companyName',
        '.organization-name',
        '[data-automation="company-name"]',
        '[itemprop="hiringOrganization"]'
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent.trim();
            if (text) return text;
        }
    }

    // Try to extract from page title
    const pageTitle = document.title;
    if (pageTitle) {
        // Often title is in format "Job Title - Company Name"
        const parts = pageTitle.split(/[-|]/);
        if (parts.length > 1) {
            return parts[1].trim();
        }
    }

    // Try to extract from URL
    const hostname = window.location.hostname;
    // Remove www. and .com/.org/etc.
    const domainParts = hostname.split('.');
    if (domainParts.length > 1) {
        // Skip job board domains
        const jobBoardDomains = ['dice', 'indeed', 'linkedin', 'glassdoor', 'monster', 'ziprecruiter'];
        if (!jobBoardDomains.includes(domainParts[domainParts.length - 2].toLowerCase())) {
            if (domainParts[0] === 'www') {
                return domainParts[1].charAt(0).toUpperCase() + domainParts[1].slice(1);
            } else {
                return domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
            }
        }
    }

    return "Unknown Company";
}

// Save application data to storage
function saveApplication(data) {
    if (!data || formSubmitted) return;

    console.log('Saving application data:', data);
    formSubmitted = true;

    // Send to background script for storage
    chrome.runtime.sendMessage(
        { action: 'saveApplication', data: data },
        function (response) {
            console.log('Application saved, response:', response);
        }
    );
}
