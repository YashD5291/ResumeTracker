document.addEventListener('DOMContentLoaded', function () {
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

            // Update storage info when going to backup tab
            if (tabName === 'backup') {
                updateStorageInfo();
            }
        });
    });

    // Get current URL
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs.length > 0) {
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

    // Backup tab event listeners
    document.getElementById('createFullBackup').addEventListener('click', createFullBackup);
    document.getElementById('exportDataOnly').addEventListener('click', exportDataOnly);

    // Import functionality
    const importZone = document.getElementById('importZone');
    const importFile = document.getElementById('importFile');

    importZone.addEventListener('click', () => {
        importFile.click();
    });

    importZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        importZone.classList.add('dragover');
    });

    importZone.addEventListener('dragleave', () => {
        importZone.classList.remove('dragover');
    });

    importZone.addEventListener('drop', (e) => {
        e.preventDefault();
        importZone.classList.remove('dragover');

        if (e.dataTransfer.files.length > 0) {
            handleImportFile(e.dataTransfer.files[0]);
        }
    });

    importFile.addEventListener('change', () => {
        if (importFile.files.length > 0) {
            handleImportFile(importFile.files[0]);
        }
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

// Update storage usage information
function updateStorageInfo() {
    const storageInfo = document.getElementById('storageInfo');
    storageInfo.textContent = 'Calculating storage usage...';

    chrome.storage.local.getBytesInUse(null, function (bytesUsed) {
        let usageText = '';

        if (bytesUsed < 1024) {
            usageText = `${bytesUsed} bytes used`;
        } else if (bytesUsed < 1048576) {
            usageText = `${(bytesUsed / 1024).toFixed(2)} KB used`;
        } else {
            usageText = `${(bytesUsed / 1048576).toFixed(2)} MB used`;
        }

        // Chrome storage limit is 5MB
        const percentUsed = (bytesUsed / 5242880) * 100;
        usageText += ` (${percentUsed.toFixed(1)}% of 5MB limit)`;

        storageInfo.textContent = usageText;
    });
}

// Create full backup including PDF files
function createFullBackup() {
    const fullBackupInfo = document.getElementById('fullBackupInfo');
    fullBackupInfo.textContent = 'Creating backup...';
    fullBackupInfo.style.display = 'block';

    // Get all data from storage
    chrome.storage.local.get(null, function (data) {
        // Create backup object with version info
        const backup = {
            version: '1.0',
            date: new Date().toISOString(),
            type: 'full',
            data: data
        };

        // Convert to JSON
        const backupJson = JSON.stringify(backup);

        // Create download
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const date = new Date().toISOString().slice(0, 10);

        chrome.downloads.download({
            url: url,
            filename: `resume_tracker_backup_${date}.rsbak`,
            saveAs: true
        }, function (downloadId) {
            if (chrome.runtime.lastError) {
                fullBackupInfo.textContent = 'Error creating backup: ' + chrome.runtime.lastError.message;
            } else {
                fullBackupInfo.textContent = 'Backup created successfully!';
            }
        });
    });
}

// Export just application data (no PDFs)
function exportDataOnly() {
    // Get just the applications data
    chrome.storage.local.get(['applications', 'resumes'], function (data) {
        // Create backup object with version info but without PDF data
        const backup = {
            version: '1.0',
            date: new Date().toISOString(),
            type: 'data_only',
            data: {
                applications: data.applications || [],
                resumes: data.resumes ? data.resumes.map(resume => {
                    // Keep resume metadata but remove PDF data
                    return {
                        id: resume.id,
                        filename: resume.filename,
                        title: resume.title,
                        dateAdded: resume.dateAdded,
                        notes: resume.notes
                    };
                }) : []
            }
        };

        // Convert to JSON
        const backupJson = JSON.stringify(backup);

        // Create download
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const date = new Date().toISOString().slice(0, 10);

        chrome.downloads.download({
            url: url,
            filename: `resume_tracker_data_${date}.json`,
            saveAs: true
        });
    });
}

// Handle import of backup file
function handleImportFile(file) {
    const importStatus = document.getElementById('importStatus');
    importStatus.textContent = 'Reading backup file...';
    importStatus.style.display = 'block';

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const backup = JSON.parse(e.target.result);
            
            // Verify it's a valid backup
            if (!backup.version || !backup.data) {
                throw new Error('Invalid backup file format');
            }
            
            // Confirm with user before overwriting data
            if (confirm('This will overwrite your current data. Continue?')) {
                // Set the data to storage
                chrome.storage.local.set(backup.data, function() {
                    if (chrome.runtime.lastError) {
                        importStatus.textContent = 'Error: ' + chrome.runtime.lastError.message;
                    } else {
                        importStatus.textContent = 'Backup restored successfully!';
                        // Reload the UI to show the imported data
                        loadResumes();
                        loadEntries();
                        updateStorageInfo();
                    }
                });
            } else {
                importStatus.textContent = 'Import cancelled.';
            }
        } catch (error) {
            importStatus.textContent = 'Error: ' + error.message;
        }
    };
    
    reader.onerror = function() {
        importStatus.textContent = 'Error reading file.';
    };
    
    reader.readAsText(file);
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
              <div class="${resume.pdfData ? 'upload-status has-pdf' : 'upload-status no-pdf'}">
                ${resume.pdfData ? 'PDF stored locally' : 'No PDF stored'}
              </div>
            </div>
            <div class="resume-actions">
              ${resume.pdfData ? '<button class="view-btn" data-index="' + index + '">View PDF</button>' : ''}
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
    const newResumeName = document.getElementById('newResumeName').value.trim();
    const newResumeFilename = document.getElementById('newResumeFilename').value.trim();
    const fileInput = document.getElementById('newResumePdf');

    if (!newResumeName) {
        showNotification('Please enter a resume name', 'error');
        return;
    }

    if (!newResumeFilename) {
        showNotification('Please enter a filename or select a PDF', 'error');
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
        pdfData: null,
        dateAdded: new Date().toISOString()
    };

    // If PDF file is selected, read and store it
    if (hasFile) {
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onprogress = function (event) {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                document.getElementById('progressBar').style.width = percentComplete + '%';
            }
        };

        reader.onload = function (event) {
            // Store file data as base64 string
            newResume.pdfData = event.target.result;

            // Save resume with PDF data
            saveResumeToStorage(newResume);
        };

        reader.onerror = function () {
            showNotification('Error reading the PDF file', 'error');
            document.getElementById('uploadProgress').style.display = 'none';

            // Still save the resume without PDF data
            saveResumeToStorage(newResume);
        };

        // Read the file as a data URL (base64)
        reader.readAsDataURL(file);
    } else {
        // Save resume without PDF data
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

            // Show success notification
            showNotification('Resume added successfully');

            // Reload resume list
            loadResumes();
        });
    });
}

// Delete a resume
function deleteResume(index) {
    if (!confirm('Are you sure you want to delete this resume?')) {
        return;
    }

    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];

        // Remove resume at index
        resumes.splice(index, 1);

        // Save updated list
        chrome.storage.local.set({ 'resumes': resumes }, function () {
            // Reload resume list
            loadResumes();
            showNotification('Resume deleted');
        });
    });
}

// View PDF file of a resume
function viewResumePdf(index) {
    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];
        const resume = resumes[index];

        if (resume && resume.pdfData) {
            // Open the PDF in a new tab
            chrome.tabs.create({ url: resume.pdfData });
        } else {
            showNotification('No PDF file available for this resume', 'error');
        }
    });
}

// Clear all resumes
function clearResumes() {
    if (!confirm('Are you sure you want to clear all resumes? This cannot be undone.')) {
        return;
    }

    chrome.storage.local.set({ 'resumes': [] }, function () {
        // Reload resume list
        loadResumes();
        showNotification('All resumes cleared');
    });
}

// Save application entry
function saveEntry() {
    const url = document.getElementById('currentUrl').value;
    const siteName = document.getElementById('siteName').value;
    const resumeId = document.getElementById('resumeSelect').value;
    const jobTitle = document.getElementById('jobTitle').value;
    const status = document.getElementById('applicationStatus').value;
    const tagsInput = document.getElementById('jobTags').value;

    // Process tags
    const tags = tagsInput.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

    // Validate required fields
    if (!url) {
        showNotification('URL is required', 'error');
        return;
    }

    if (!resumeId) {
        showNotification('Please select a resume', 'error');
        return;
    }

    // Get resume details
    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];
        const selectedResume = resumes.find(r => r.id === resumeId);

        if (!selectedResume) {
            showNotification('Selected resume not found', 'error');
            return;
        }

        // Create entry object
        const entryId = 'entry_' + Date.now();
        const entry = {
            id: entryId,
            url: url,
            site: siteName,
            resumeId: resumeId,
            resumeName: selectedResume.name,
            resumeFilename: selectedResume.filename,
            job: jobTitle,
            status: status,
            tags: tags,
            date: new Date().toISOString(),
            dateApplied: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            notes: '',
            statusHistory: [
                {
                    status: status,
                    date: new Date().toISOString()
                }
            ]
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

// Load entries from storage
function loadEntries(filter = '', tagFilter = null) {
    chrome.storage.local.get(['entries', 'resumes'], function (data) {
        const entries = data.entries || [];
        const resumes = data.resumes || [];

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

        // Apply tag filter if provided
        if (tagFilter) {
            filteredEntries = filteredEntries.filter(entry =>
                entry.tags && entry.tags.includes(tagFilter)
            );
        }

        // Sort by date, newest first
        filteredEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Collect all unique tags for the tag filter
        const allTags = new Set();
        entries.forEach(entry => {
            if (entry.tags && Array.isArray(entry.tags)) {
                entry.tags.forEach(tag => allTags.add(tag));
            }
        });

        // Populate tag filter container
        const tagsContainer = document.getElementById('tagsContainer');
        tagsContainer.innerHTML = '';

        if (allTags.size > 0) {
            Array.from(allTags).sort().forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tag tag-filter';
                if (tag === tagFilter) {
                    tagElement.classList.add('active');
                }
                tagElement.textContent = tag;
                tagElement.addEventListener('click', () => {
                    const newFilter = tag === tagFilter ? null : tag;
                    loadEntries(filter, newFilter);
                });
                tagsContainer.appendChild(tagElement);
            });

            // Add "Clear filters" tag if a tag filter is active
            if (tagFilter) {
                const clearTag = document.createElement('span');
                clearTag.className = 'tag tag-filter';
                clearTag.style.backgroundColor = '#ffebee';
                clearTag.style.color = '#c62828';
                clearTag.textContent = 'Clear filters';
                clearTag.addEventListener('click', () => {
                    loadEntries(filter);
                });
                tagsContainer.appendChild(clearTag);
            }
        }

        // Populate entries table
        const entriesBody = document.getElementById('entriesBody');
        entriesBody.innerHTML = '';

        if (filteredEntries.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="5">No applications found</td>';
            entriesBody.appendChild(row);
        } else {
            filteredEntries.forEach((entry, index) => {
                // Find the associated resume
                const resume = resumes.find(r => r.id === entry.resumeId);
                const hasPdf = resume && resume.pdfData;

                // Format date
                const date = new Date(entry.date);
                const formattedDate = date.toLocaleDateString();

                // Create status badge class
                const statusClass = `status-badge status-${entry.status.toLowerCase()}`;

                const row = document.createElement('tr');
                row.innerHTML = `
            <td>${formattedDate}</td>
            <td>
              <div><a href="${entry.url}" target="_blank">${entry.site || 'Unknown'}</a></div>
              <div>${entry.job || 'N/A'}</div>
              ${entry.tags && entry.tags.length > 0 ?
                        `<div class="status-badges">
                  ${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>` : ''}
            </td>
            <td>
              <div>${entry.resumeName || 'Unknown'}</div>
              <div class="file-name">${entry.resumeFilename}</div>
              ${hasPdf ? '<button class="view-btn view-entry-pdf" data-resume-id="' + entry.resumeId + '">View PDF</button>' : ''}
            </td>
            <td><span class="${statusClass}">${entry.status}</span></td>
            <td><button class="delete-btn" data-index="${entries.indexOf(entry)}">×</button></td>
          `;
                entriesBody.appendChild(row);

                // Add event listeners to delete buttons
                row.querySelector('.delete-btn').addEventListener('click', function () {
                    deleteEntry(parseInt(this.getAttribute('data-index')));
                });

                // Add event listeners to view PDF buttons
                const viewBtn = row.querySelector('.view-entry-pdf');
                if (viewBtn) {
                    viewBtn.addEventListener('click', function () {
                        const resumeId = this.getAttribute('data-resume-id');
                        viewEntryPdf(resumeId);
                    });
                }
            });
        }
    });
}

// View PDF associated with an entry
function viewEntryPdf(resumeId) {
    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];
        const resume = resumes.find(r => r.id === resumeId);

        if (resume && resume.pdfData) {
            // Open the PDF in a new tab
            chrome.tabs.create({ url: resume.pdfData });
        } else {
            showNotification('No PDF file available for this resume', 'error');
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
    if (!confirm('Are you sure you want to delete this application entry?')) {
        return;
    }

    chrome.storage.local.get('entries', function (data) {
        const entries = data.entries || [];

        // Remove entry at index
        entries.splice(index, 1);

        // Save updated list
        chrome.storage.local.set({ 'entries': entries }, function () {
            // Reload entries
            const searchTerm = document.getElementById('searchInput').value.trim();
            loadEntries(searchTerm);
            showNotification('Entry deleted');
        });
    });
}

// Clear all entries
function clearEntries() {
    if (!confirm('Are you sure you want to clear all application entries? This cannot be undone.')) {
        return;
    }

    chrome.storage.local.set({ 'entries': [] }, function () {
        // Reload entries
        loadEntries();
        showNotification('All entries cleared');
    });
}

// Export entries to CSV
function exportEntries() {
    chrome.storage.local.get('entries', function (data) {
        const entries = data.entries || [];

        if (entries.length === 0) {
            showNotification('No entries to export', 'error');
            return;
        }

        // Create CSV header
        let csv = 'Date,Site,Job Title,Resume Name,Resume Filename,Status,Tags,URL\n';

        // Add each entry as a row
        entries.forEach(entry => {
            const date = new Date(entry.date).toLocaleDateString();
            const tags = entry.tags ? entry.tags.join('; ') : '';

            // Escape commas in fields
            const row = [
                date,
                `"${(entry.site || 'Unknown').replace(/"/g, '""')}"`,
                `"${(entry.job || 'N/A').replace(/"/g, '""')}"`,
                `"${(entry.resumeName || 'Unknown').replace(/"/g, '""')}"`,
                `"${entry.resumeFilename.replace(/"/g, '""')}"`,
                entry.status,
                `"${tags}"`,
                `"${entry.url.replace(/"/g, '""')}"`
            ];

            csv += row.join(',') + '\n';
        });

        // Create download
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
            URL.revoObjectURL(url);
        }, 1000);
    });
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = type === 'success' ? '#4caf50' : '#f44336';
    notification.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}
