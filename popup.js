let firebaseApp = null;
let storage = null;

document.addEventListener('DOMContentLoaded', function () {
    // Check Firebase configuration
    checkFirebaseConfig();

    // Tab navigation
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and content
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabName = tab.getAttribute('data-tab');
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });

    // Get current URL
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const url = tabs[0].url;
        document.getElementById('currentUrl').value = url;

        // Extract site name from URL
        try {
            const hostname = new URL(url).hostname;
            const parts = hostname.split('.');
            let siteName = parts[0];

            if (parts[0] === 'www') {
                siteName = parts[1];
            }

            // Capitalize first letter and remove common domain extensions
            siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
            document.getElementById('siteName').value = siteName;
        } catch (e) {
            // URL parsing failed, leave empty
        }
    });

    // Load resume list
    loadResumes();

    // Load entries
    loadEntries();

    // Setup event listeners
    document.getElementById('saveEntry').addEventListener('click', saveEntry);
    document.getElementById('addResume').addEventListener('click', addResume);
    document.getElementById('clearResumes').addEventListener('click', clearResumes);
    document.getElementById('searchBtn').addEventListener('click', searchEntries);
    document.getElementById('searchInput').addEventListener('input', searchEntries);
    document.getElementById('clearEntries').addEventListener('click', clearEntries);
    document.getElementById('exportEntries').addEventListener('click', exportEntries);
    document.getElementById('saveFirebaseConfig').addEventListener('click', saveFirebaseConfig);

    // Settings navigation
    document.getElementById('goToSettingsBtn')?.addEventListener('click', function () {
        document.querySelector('.tab[data-tab="settings"]').click();
    });

    document.getElementById('goToSettingsBtnManage')?.addEventListener('click', function () {
        document.querySelector('.tab[data-tab="settings"]').click();
    });

    // PDF file selection
    document.getElementById('browseResumeBtn').addEventListener('click', function () {
        document.getElementById('newResumePdf').click();
    });

    document.getElementById('newResumePdf').addEventListener('change', function () {
        if (this.files && this.files.length > 0) {
            const file = this.files[0];
            document.getElementById('selectedFileName').textContent = file.name;
            document.getElementById('newResumeFilename').value = file.name;
        }
    });
});

// Check and initialize Firebase configuration
function checkFirebaseConfig() {
    chrome.storage.local.get('firebaseConfig', function (data) {
        const config = data.firebaseConfig;

        if (config && isValidFirebaseConfig(config)) {
            // Initialize Firebase with the stored config
            initializeFirebase(config);

            // Hide setup reminders
            document.getElementById('firebaseSetupReminder').style.display = 'none';
            document.getElementById('firebaseSetupReminderManage').style.display = 'none';
            document.getElementById('trackContent').style.display = 'block';
            document.getElementById('manageContent').style.display = 'block';

            // Pre-fill configuration fields
            document.getElementById('apiKey').value = config.apiKey || '';
            document.getElementById('authDomain').value = config.authDomain || '';
            document.getElementById('projectId').value = config.projectId || '';
            document.getElementById('storageBucket').value = config.storageBucket || '';
            document.getElementById('messagingSenderId').value = config.messagingSenderId || '';
            document.getElementById('appId').value = config.appId || '';

            // Show success message in settings
            const configStatus = document.getElementById('configStatus');
            configStatus.textContent = 'Firebase is configured and connected';
            configStatus.className = 'config-status success';
            configStatus.style.display = 'block';
        } else {
            // Show setup reminders
            document.getElementById('firebaseSetupReminder').style.display = 'block';
            document.getElementById('firebaseSetupReminderManage').style.display = 'block';
            document.getElementById('trackContent').style.display = 'none';
            document.getElementById('manageContent').style.display = 'none';

            // Show error message in settings
            const configStatus = document.getElementById('configStatus');
            configStatus.textContent = 'Firebase configuration needed';
            configStatus.className = 'config-status error';
            configStatus.style.display = 'block';
        }
    });
}

// Validate Firebase configuration
function isValidFirebaseConfig(config) {
    return config &&
        config.apiKey &&
        config.authDomain &&
        config.projectId &&
        config.storageBucket;
}

// Initialize Firebase
function initializeFirebase(config) {
    try {
        firebaseApp = firebase.initializeApp(config);
        storage = firebase.storage();
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
}

// Save Firebase configuration
function saveFirebaseConfig() {
    const config = {
        apiKey: document.getElementById('apiKey').value.trim(),
        authDomain: document.getElementById('authDomain').value.trim(),
        projectId: document.getElementById('projectId').value.trim(),
        storageBucket: document.getElementById('storageBucket').value.trim(),
        messagingSenderId: document.getElementById('messagingSenderId').value.trim(),
        appId: document.getElementById('appId').value.trim()
    };

    // Validate configuration
    if (!config.apiKey || !config.authDomain || !config.projectId || !config.storageBucket) {
        const configStatus = document.getElementById('configStatus');
        configStatus.textContent = 'Please fill in at least API Key, Auth Domain, Project ID, and Storage Bucket';
        configStatus.className = 'config-status error';
        configStatus.style.display = 'block';
        return;
    }

    // Try to initialize Firebase
    if (firebaseApp) {
        firebaseApp.delete().then(() => {
            if (initializeFirebase(config)) {
                saveConfigToStorage(config);
            } else {
                showConfigError();
            }
        }).catch(error => {
            console.error('Error deleting Firebase app:', error);
            showConfigError();
        });
    } else {
        if (initializeFirebase(config)) {
            saveConfigToStorage(config);
        } else {
            showConfigError();
        }
    }
}

// Save configuration to storage
function saveConfigToStorage(config) {
    chrome.storage.local.set({ 'firebaseConfig': config }, function () {
        const configStatus = document.getElementById('configStatus');
        configStatus.textContent = 'Firebase configuration saved successfully';
        configStatus.className = 'config-status success';
        configStatus.style.display = 'block';

        // Hide setup reminders
        document.getElementById('firebaseSetupReminder').style.display = 'none';
        document.getElementById('firebaseSetupReminderManage').style.display = 'none';
        document.getElementById('trackContent').style.display = 'block';
        document.getElementById('manageContent').style.display = 'block';

        // Reload resumes with new configuration
        loadResumes();
    });
}

// Show configuration error
function showConfigError() {
    const configStatus = document.getElementById('configStatus');
    configStatus.textContent = 'Failed to connect to Firebase. Please check your configuration.';
    configStatus.className = 'config-status error';
    configStatus.style.display = 'block';
}

// Load resumes from storage
function loadResumes() {
    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];

        // Populate resume list
        const resumeList = document.getElementById('resumeList');
        resumeList.innerHTML = '';

        if (resumes.length === 0) {
            resumeList.innerHTML = '<div class="resume-item">No resumes added yet</div>';
        } else {
            resumes.forEach((resume, index) => {
                const item = document.createElement('div');
                item.className = 'resume-item';
                item.innerHTML = `
          <div class="resume-details">
            <div class="resume-name">${resume.name}</div>
            <div class="resume-filename">${resume.filename}</div>
            <div class="${resume.pdfUrl ? 'upload-status has-pdf' : 'upload-status no-pdf'}">
              ${resume.pdfUrl ? 'PDF stored in Firebase' : 'No PDF stored'}
            </div>
          </div>
          <div class="resume-actions">
            ${resume.pdfUrl ? '<button class="view-btn" data-index="' + index + '">View PDF</button>' : ''}
            <button class="delete-btn" data-index="${index}">×</button>
          </div>
        `;
                resumeList.appendChild(item);
            });

            // Add event listeners to delete buttons
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    deleteResume(parseInt(this.getAttribute('data-index')));
                });
            });

            // Add event listeners to view buttons
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    viewResumePdf(parseInt(this.getAttribute('data-index')));
                });
            });
        }

        // Populate resume select dropdown
        const resumeSelect = document.getElementById('resumeSelect');
        // Clear previous options except the first one
        while (resumeSelect.options.length > 1) {
            resumeSelect.remove(1);
        }

        // Add resumes to dropdown
        resumes.forEach(resume => {
            const option = document.createElement('option');
            option.value = resume.id;
            option.textContent = `${resume.name} (${resume.filename})`;
            resumeSelect.appendChild(option);
        });
    });
}

// Add a new resume
function addResume() {
    // Check if Firebase is configured
    if (!storage) {
        alert('Please configure Firebase in the Settings tab first');
        document.querySelector('.tab[data-tab="settings"]').click();
        return;
    }

    const newResumeName = document.getElementById('newResumeName').value.trim();
    const newResumeFilename = document.getElementById('newResumeFilename').value.trim();
    const fileInput = document.getElementById('newResumePdf');

    if (!newResumeName) {
        alert('Please enter a resume name');
        return;
    }

    if (!newResumeFilename) {
        alert('Please enter a filename or select a PDF');
        return;
    }

    // Show progress bar if file is selected
    const hasFile = fileInput.files && fileInput.files.length > 0;
    if (hasFile) {
        document.getElementById('uploadProgress').style.display = 'block';
        document.getElementById('progressBar').style.width = '0%';
    }

    // Create resume object with basic info
    const newResumeId = 'resume_' + Date.now();
    const newResume = {
        id: newResumeId,
        name: newResumeName,
        filename: newResumeFilename,
        pdfUrl: null
    };

    // If PDF file is selected, upload to Firebase
    if (hasFile) {
        const file = fileInput.files[0];
        const storageRef = storage.ref();
        const resumeRef = storageRef.child(`resumes/${newResumeId}/${file.name}`);

        const uploadTask = resumeRef.put(file);

        uploadTask.on('state_changed',
            (snapshot) => {
                // Progress function
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                document.getElementById('progressBar').style.width = progress + '%';
            },
            (error) => {
                // Error function
                console.error('Upload failed:', error);
                document.getElementById('uploadProgress').style.display = 'none';
                alert('Failed to upload PDF: ' + error.message);

                // Still save the resume without PDF URL
                saveResumeToStorage(newResume);
            },
            () => {
                // Complete function - get the download URL
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    newResume.pdfUrl = downloadURL;
                    saveResumeToStorage(newResume);
                });
            }
        );
    } else {
        // Save resume without PDF URL
        saveResumeToStorage(newResume);
    }
}

// Save resume to chrome.storage
function saveResumeToStorage(newResume) {
    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];

        // Add new resume
        resumes.push(newResume);

        // Save updated list
        chrome.storage.local.set({ 'resumes': resumes }, function () {
            // Clear input fields
            document.getElementById('newResumeName').value = '';
            document.getElementById('newResumeFilename').value = '';
            document.getElementById('selectedFileName').textContent = '';
            document.getElementById('newResumePdf').value = '';
            document.getElementById('uploadProgress').style.display = 'none';

            // Reload resume list
            loadResumes();
        });
    });
}

// Delete a resume
function deleteResume(index) {
    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];
        const resume = resumes[index];

        // If there's a PDF in Firebase, delete it
        if (resume && resume.pdfUrl && storage) {
            try {
                // Extract the path from the URL
                const url = new URL(resume.pdfUrl);
                const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);

                if (pathMatch && pathMatch[1]) {
                    const path = decodeURIComponent(pathMatch[1]);
                    const fileRef = storage.ref(path);

                    fileRef.delete().catch(error => {
                        console.error('Error deleting file from Firebase:', error);
                    });
                }
            } catch (error) {
                console.error('Error parsing URL:', error);
            }
        }

        // Remove resume from list
        resumes.splice(index, 1);

        // Save updated list
        chrome.storage.local.set({ 'resumes': resumes }, function () {
            // Reload resume list
            loadResumes();
        });
    });
}

// View PDF file of a resume
function viewResumePdf(index) {
    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];
        const resume = resumes[index];

        if (resume && resume.pdfUrl) {
            // Open the PDF in a new tab
            chrome.tabs.create({ url: resume.pdfUrl });
        } else {
            alert('No PDF file available for this resume');
        }
    });
}

// Clear all resumes
function clearResumes() {
    if (!confirm('Are you sure you want to clear all resumes?')) {
        return;
    }

    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];

        // Delete all PDFs from Firebase
        if (storage) {
            resumes.forEach(resume => {
                if (resume.pdfUrl) {
                    try {
                        // Extract the path from the URL
                        const url = new URL(resume.pdfUrl);
                        const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);

                        if (pathMatch && pathMatch[1]) {
                            const path = decodeURIComponent(pathMatch[1]);
                            const fileRef = storage.ref(path);

                            fileRef.delete().catch(error => {
                                console.error('Error deleting file from Firebase:', error);
                            });
                        }
                    } catch (error) {
                        console.error('Error parsing URL:', error);
                    }
                }
            });
        }

        // Clear resumes from local storage
        chrome.storage.local.set({ 'resumes': [] }, function () {
            // Reload resume list
            loadResumes();
        });
    });
}

// Save application entry
function saveEntry() {
    const url = document.getElementById('currentUrl').value;
    const siteName = document.getElementById('siteName').value;
    const resumeId = document.getElementById('resumeSelect').value;
    const jobTitle = document.getElementById('jobTitle').value;

    // Validate required fields
    if (!url) {
        alert('URL is required');
        return;
    }

    if (!resumeId) {
        alert('Please select a resume');
        return;
    }

    // Get resume details
    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];
        const selectedResume = resumes.find(r => r.id === resumeId);

        if (!selectedResume) {
            alert('Selected resume not found');
            return;
        }

        // Create entry object
        const entry = {
            url: url,
            site: siteName,
            resumeId: resumeId,
            resumeName: selectedResume.name,
            resumeFilename: selectedResume.filename,
            pdfUrl: selectedResume.pdfUrl,
            job: jobTitle,
            date: new Date().toISOString()
        };

        // Save entry
        chrome.storage.local.get('entries', function (data) {
            const entries = data.entries || [];
            entries.push(entry);

            chrome.storage.local.set({ 'entries': entries }, function () {
                // Show success message
                const successMsg = document.getElementById('saveSuccess');
                successMsg.style.display = 'block';

                // Hide after 3 seconds
                setTimeout(() => {
                    successMsg.style.display = 'none';
                }, 3000);

                // Switch to view tab
                document.querySelector('.tab[data-tab="view"]').click();

                // Reload entries
                loadEntries();
            });
        });
    });
}

// Load entries
function loadEntries(filter = '') {
    chrome.storage.local.get('entries', function (data) {
        const entries = data.entries || [];

        // Filter entries if needed
        let filteredEntries = entries;
        if (filter) {
            const lowercaseFilter = filter.toLowerCase();
            filteredEntries = entries.filter(entry =>
                (entry.site || '').toLowerCase().includes(lowercaseFilter) ||
                (entry.job || '').toLowerCase().includes(lowercaseFilter) ||
                (entry.resumeName || '').toLowerCase().includes(lowercaseFilter) ||
                (entry.resumeFilename || '').toLowerCase().includes(lowercaseFilter)
            );
        }

        // Sort by date, newest first
        filteredEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Populate entries table
        const entriesBody = document.getElementById('entriesBody');
        entriesBody.innerHTML = '';

        if (filteredEntries.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="4">No applications found</td>';
            entriesBody.appendChild(row);
        } else {
            filteredEntries.forEach((entry, index) => {
                const hasPdf = !!entry.pdfUrl;

                const row = document.createElement('tr');
                row.innerHTML = `
          <td><a href="${entry.url}" target="_blank">${entry.site || 'Unknown'}</a></td>
          <td>${entry.job || 'N/A'}</td>
          <td>
            <div>${entry.resumeName || 'Unknown'}</div>
            <div class="file-name">${entry.resumeFilename}</div>
            ${hasPdf ? '<button class="view-btn view-entry-pdf" data-url="' + entry.pdfUrl + '">View PDF</button>' : ''}
          </td>
          <td><button class="delete-btn" data-index="${entries.indexOf(entry)}">×</button></td>
        `;
                entriesBody.appendChild(row);
            });

            // Add event listeners to delete buttons
            document.querySelectorAll('#entriesBody .delete-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    deleteEntry(parseInt(this.getAttribute('data-index')));
                });
            });

            // Add event listeners to view PDF buttons
            document.querySelectorAll('.view-entry-pdf').forEach(btn => {
                btn.addEventListener('click', function () {
                    const pdfUrl = this.getAttribute('data-url');
                    if (pdfUrl) {
                        chrome.tabs.create({ url: pdfUrl });
                    }
                });
            });
        }
    });
}

// Search entries
function searchEntries() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    loadEntries(searchTerm);
}

// Delete an entry
function deleteEntry(index) {
    chrome.storage.local.get('entries', function (data) {
        const entries = data.entries || [];

        // Remove entry at index
        entries.splice(index, 1);

        // Save updated list
        chrome.storage.local.set({ 'entries': entries }, function () {
            // Reload entries
            const searchTerm = document.getElementById('searchInput').value.trim();
            loadEntries(searchTerm);
        });
    });
}

// Clear all entries
function clearEntries() {
    if (confirm('Are you sure you want to clear all application entries?')) {
        chrome.storage.local.set({ 'entries': [] }, function () {
            // Reload entries
            loadEntries();
        });
    }
}

// Export entries to CSV
function exportEntries() {
    chrome.storage.local.get('entries', function (data) {
        const entries = data.entries || [];

        if (entries.length === 0) {
            alert('No entries to export');
            return;
        }

        // Create CSV header
        let csv = 'Date,Site,Job Title,Resume Name,Resume Filename,Resume URL\n';

        // Add each entry as a row
        entries.forEach(entry => {
            const date = new Date(entry.date).toLocaleDateString();

            // Escape commas in fields
            const row = [
                date,
                `"${(entry.site || 'Unknown').replace(/"/g, '""')}"`,
                `"${(entry.job || 'N/A').replace(/"/g, '""')}"`,
                `"${(entry.resumeName || 'Unknown').replace(/"/g, '""')}"`,
                `"${entry.resumeFilename.replace(/"/g, '""')}"`,
                `"${(entry.pdfUrl || '').replace(/"/g, '""')}"`
            ];

            csv += row.join(',') + '\n';
        });

        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resume_tracking_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();

        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revoObjectURL(url);
        }, 0);
    });
}