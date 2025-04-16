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

    // Generic detection for sites
    detectResumeFields();

    // Listen for form submissions
    detectFormSubmissions();

    // Setup XHR and Fetch interceptors for AJAX submissions
    interceptAjaxRequests();
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
    
    // Set up a mutation observer to detect dynamically added file inputs
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check for file inputs in new elements
                        const fileInputs = node.querySelectorAll('input[type="file"]');
                        fileInputs.forEach(input => {
                            monitorFileInput(input);
                        });
                    }
                });
            }
        }
    });
    
    // Start observing the entire document
    observer.observe(document.body, { childList: true, subtree: true });
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

// Detect form submissions
function detectFormSubmissions() {
    // Listen for form submissions
    document.addEventListener('submit', function (event) {
        if (!formSubmitted && resumeFileName) {
            formSubmitted = true;
            console.log('Form submitted, capturing application data');

            // Ensure we have application data
            if (!applicationData) {
                captureApplicationData();
            }

            // Save the application data
            if (applicationData) {
                saveApplication(applicationData);
            }
        }
    });

    // Also listen for clicks on submit buttons
    document.addEventListener('click', function (event) {
        const button = event.target.closest('button, input[type="submit"]');
        if (button) {
            const buttonText = button.textContent.toLowerCase();
            if ((buttonText.includes('apply') || buttonText.includes('submit')) && 
                resumeFileName && !formSubmitted) {
                console.log('Submit button clicked, capturing application data');
                
                // Capture and save application data with a slight delay
                captureApplicationData();
                setTimeout(() => {
                    if (applicationData) {
                        formSubmitted = true;
                        saveApplication(applicationData);
                    }
                }, 500);
            }
        }
    });
}

// Intercept AJAX request to catch form submissions
function interceptAjaxRequests() {
    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._method = method;
        this._url = url;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (data) {
        // Check if this might be an application submission and we have resume data
        if (resumeFileName && !formSubmitted &&
            (this._method.toLowerCase() === 'post' || this._url.includes('apply'))) {
            
            // Try to capture application data
            if (!applicationData) {
                captureApplicationData();
            }
            
            // Save application with a delay to let the request complete
            setTimeout(() => {
                if (applicationData) {
                    formSubmitted = true;
                    saveApplication(applicationData);
                }
            }, 1000);
        }
        
        return originalXHRSend.apply(this, arguments);
    };

    // Intercept fetch API if available
    if (window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function (url, options = {}) {
            // Check if this might be an application submission
            if (resumeFileName && !formSubmitted && 
                options.method && options.method.toLowerCase() === 'post') {
                
                // Try to capture application data
                if (!applicationData) {
                    captureApplicationData();
                }
                
                // Save application with a delay
                setTimeout(() => {
                    if (applicationData) {
                        formSubmitted = true;
                        saveApplication(applicationData);
                    }
                }, 1000);
            }
            
            return originalFetch.apply(window, arguments);
        };
    }
}

// Capture data about the current application
function captureApplicationData() {
    if (!resumeFileName) {
        return;
    }

    // Extract company name and job title
    const companyName = extractCompanyName();
    const jobTitle = extractJobTitle();

    // Create application data object
    applicationData = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        companyName: companyName || window.location.hostname,
        jobTitle: jobTitle || 'Unknown Position',
        resumeFileName: resumeFileName,
        applicationUrl: window.location.href,
        status: 'Applied'
    };

    console.log('Captured application data:', applicationData);
}

// Extract job title from the page
function extractJobTitle() {
    // Check for common job title elements
    const titleElements = [
        document.querySelector('h1'),
        ...document.querySelectorAll('h2'),
        ...document.querySelectorAll('h3'),
        ...document.querySelectorAll('.job-title'),
        ...document.querySelectorAll('[data-testid="jobTitle"]'),
    ];

    for (const element of titleElements) {
        if (element && element.textContent.trim()) {
            // Check if the text looks like a job title
            const text = element.textContent.trim();
            if (text.length > 3 && text.length < 100) {
                return text;
            }
        }
    }

    // Try to find it in document title
    if (document.title && document.title.includes(' - ')) {
        return document.title.split(' - ')[0].trim();
    }

    return null;
}

// Extract company name from the page
function extractCompanyName() {
    // Check for common company name elements
    const companyElements = [
        document.querySelector('.company-name'),
        document.querySelector('[data-testid="companyName"]'),
        document.querySelector('.employer'),
        document.querySelector('.organization')
    ];

    for (const element of companyElements) {
        if (element && element.textContent.trim()) {
            return element.textContent.trim();
        }
    }

    // Try to extract from document title
    if (document.title && document.title.includes(' - ')) {
        const parts = document.title.split(' - ');
        if (parts.length > 1) {
            return parts[1].trim();
        }
    }

    // Extract from hostname
    try {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        
        // Take the domain name
        let companyName = parts[parts.length - 2];
        
        // If it starts with "www", try the next part
        if (parts[0] === 'www' && parts.length > 2) {
            companyName = parts[1];
        }
        
        // Capitalize first letter
        return companyName.charAt(0).toUpperCase() + companyName.slice(1);
    } catch (e) {
        return null;
    }
}

// Save the application data
function saveApplication(data) {
    // Send message to background script to save the data
    chrome.runtime.sendMessage({
        action: 'saveApplication',
        data: data
    }, function(response) {
        if (response && response.success) {
            console.log('Application saved successfully');
        } else {
            console.error('Failed to save application');
        }
    });
}
