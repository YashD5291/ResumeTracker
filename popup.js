let mongodbEnabled = false;
let mongoConfig = null;

document.addEventListener('DOMContentLoaded', function () {
    // Check MongoDB configuration
    checkMongoDBConfig();

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

    // MongoDB configuration events
    document.getElementById('enableMongoSync').addEventListener('change', function () {
        const mongoConfigForm = document.getElementById('mongoConfigForm');
        if (this.checked) {
            mongoConfigForm.style.display = 'block';
        } else {
            mongoConfigForm.style.display = 'none';
        }
    });

    document.getElementById('saveMongoConfig').addEventListener('click', saveMongoDBConfig);
    document.getElementById('testConnection').addEventListener('click', testMongoDBConnection);

    const syncNowBtn = document.getElementById('syncNowBtn');
    if (syncNowBtn) {
        syncNowBtn.addEventListener('click', syncToMongoDB);
    }

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

// Check and initialize MongoDB configuration
function checkMongoDBConfig() {
    chrome.storage.local.get(['mongoConfig', 'mongodbEnabled'], function (data) {
        mongoConfig = data.mongoConfig;
        mongodbEnabled = data.mongodbEnabled || false;

        // Update UI based on the configuration
        const enableMongoSync = document.getElementById('enableMongoSync');
        enableMongoSync.checked = mongodbEnabled;

        const mongoConfigForm = document.getElementById('mongoConfigForm');
        mongoConfigForm.style.display = mongodbEnabled ? 'block' : 'none';

        // Show Sync Now button if MongoDB is enabled
        const syncNowBtn = document.getElementById('syncNowBtn');
        if (syncNowBtn) {
            syncNowBtn.style.display = mongodbEnabled ? 'inline-block' : 'none';
        }

        // Pre-fill configuration fields if available
        if (mongoConfig) {
            document.getElementById('mongoUri').value = mongoConfig.mongoUri || '';
            document.getElementById('dbName').value = mongoConfig.dbName || '';
            document.getElementById('collectionName').value = mongoConfig.collectionName || '';
            document.getElementById('apiKey').value = mongoConfig.apiKey || '';
            document.getElementById('dataApiUrl').value = mongoConfig.dataApiUrl || '';
        }
    });
}

// Save MongoDB configuration
function saveMongoDBConfig() {
    const mongoUri = document.getElementById('mongoUri').value.trim();
    const dbName = document.getElementById('dbName').value.trim();
    const collectionName = document.getElementById('collectionName').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const dataApiUrl = document.getElementById('dataApiUrl').value.trim();

    // Validate configuration
    if (!mongoUri || !dbName || !collectionName || !apiKey || !dataApiUrl) {
        const configStatus = document.getElementById('configStatus');
        configStatus.textContent = 'Please fill in all MongoDB configuration fields';
        configStatus.className = 'config-status error';
        configStatus.style.display = 'block';
        return;
    }

    // Save configuration
    const newMongoConfig = {
        mongoUri,
        dbName,
        collectionName,
        apiKey,
        dataApiUrl
    };

    chrome.storage.local.set({
        'mongoConfig': newMongoConfig,
        'mongodbEnabled': true
    }, function () {
        mongoConfig = newMongoConfig;
        mongodbEnabled = true;

        // Show success message
        const configStatus = document.getElementById('configStatus');
        configStatus.textContent = 'MongoDB configuration saved successfully';
        configStatus.className = 'config-status success';
        configStatus.style.display = 'block';

        // Show Sync Now button
        const syncNowBtn = document.getElementById('syncNowBtn');
        if (syncNowBtn) {
            syncNowBtn.style.display = 'inline-block';
        }

        // Test connection automatically
        testMongoDBConnection();
    });
}

// Test MongoDB connection
function testMongoDBConnection() {
    const configStatus = document.getElementById('configStatus');
    configStatus.textContent = 'Testing connection...';
    configStatus.className = 'config-status';
    configStatus.style.display = 'block';

    if (!mongoConfig) {
        configStatus.textContent = 'Please save configuration first';
        configStatus.className = 'config-status error';
        return;
    }

    // Make a simple ping request to the Data API
    fetch(mongoConfig.dataApiUrl + '/action/findOne', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': mongoConfig.apiKey
        },
        body: JSON.stringify({
            dataSource: 'Cluster0', // This is typically the default cluster name
            database: mongoConfig.dbName,
            collection: mongoConfig.collectionName,
            filter: { _test: true }
        })
    })
        .then(response => {
            if (response.ok) {
                configStatus.textContent = 'Connection successful!';
                configStatus.className = 'config-status success';
            } else {
                throw new Error('Connection failed with status: ' + response.status);
            }
        })
        .catch(error => {
            configStatus.textContent = 'Connection failed: ' + error.message;
            configStatus.className = 'config-status error';
        });
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
        pdfData: null
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
            alert('Error reading the PDF file');
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

            // Reload resume list
            loadResumes();
        });
    });
}

// Delete a resume
function deleteResume(index) {
    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];

        // Remove resume at index
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

        if (resume && resume.pdfData) {
            // Open the PDF in a new tab
            chrome.tabs.create({ url: resume.pdfData });
        } else {
            alert('No PDF file available for this resume');
        }
    });
}

// Clear all resumes
function clearResumes() {
    if (confirm('Are you sure you want to clear all resumes?')) {
        chrome.storage.local.set({ 'resumes': [] }, function () {
            // Reload resume list
            loadResumes();
        });
    }
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
        const entryId = 'entry_' + Date.now();
        const entry = {
            id: entryId,
            url: url,
            site: siteName,
            resumeId: resumeId,
            resumeName: selectedResume.name,
            resumeFilename: selectedResume.filename,
            job: jobTitle,
            date: new Date().toISOString(),
            synced: false
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

                // Try to sync to MongoDB if enabled
                if (mongodbEnabled && mongoConfig) {
                    syncEntryToMongoDB(entry);
                }

                // Switch to view tab
                document.querySelector('.tab[data-tab="view"]').click();

                // Reload entries
                loadEntries();
            });
        });
    });
}

// Sync a single entry to MongoDB
function syncEntryToMongoDB(entry) {
    if (!mongodbEnabled || !mongoConfig) return;

    const entryForSync = {
        ...entry,
        _id: entry.id // MongoDB requires an _id field
    };

    // Remove PDF data from the synced entry
    if (entryForSync.pdfData) {
        delete entryForSync.pdfData;
    }

    fetch(mongoConfig.dataApiUrl + '/action/updateOne', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': mongoConfig.apiKey
        },
        body: JSON.stringify({
            dataSource: 'Cluster0',
            database: mongoConfig.dbName,
            collection: mongoConfig.collectionName,
            filter: { _id: entry.id },
            update: { $set: entryForSync },
            upsert: true
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.matchedCount > 0 || data.upsertedId) {
                // Update the entry in local storage to mark as synced
                chrome.storage.local.get('entries', function (storageData) {
                    const entries = storageData.entries || [];
                    const entryIndex = entries.findIndex(e => e.id === entry.id);

                    if (entryIndex >= 0) {
                        entries[entryIndex].synced = true;
                        chrome.storage.local.set({ 'entries': entries }, function () {
                            // Reload entries to update the UI
                            loadEntries();
                        });
                    }
                });
            }
        })
        .catch(error => {
            console.error('Error syncing entry to MongoDB:', error);
        });
}

// Sync all entries to MongoDB
function syncToMongoDB() {
    if (!mongodbEnabled || !mongoConfig) {
        alert('MongoDB sync is not configured. Please go to Settings.');
        return;
    }

    const configStatus = document.getElementById('configStatus');
    if (configStatus) {
        configStatus.textContent = 'Syncing entries to MongoDB...';
        configStatus.className = 'config-status';
        configStatus.style.display = 'block';
    }

    chrome.storage.local.get('entries', function (data) {
        const entries = data.entries || [];
        const unsyncedEntries = entries.filter(entry => !entry.synced);

        if (unsyncedEntries.length === 0) {
            if (configStatus) {
                configStatus.textContent = 'All entries already synced!';
                configStatus.className = 'config-status success';
            }
            return;
        }

        // Create a deep copy of entries without PDF data
        const entriesForSync = unsyncedEntries.map(entry => {
            const entryCopy = { ...entry, _id: entry.id };
            if (entryCopy.pdfData) {
                delete entryCopy.pdfData;
            }
            return entryCopy;
        });

        // Use insertMany for bulk operation
        fetch(mongoConfig.dataApiUrl + '/action/insertMany', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': mongoConfig.apiKey
            },
            body: JSON.stringify({
                dataSource: 'Cluster0',
                database: mongoConfig.dbName,
                collection: mongoConfig.collectionName,
                documents: entriesForSync
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.insertedIds && data.insertedIds.length > 0) {
                    // Update all entries to mark as synced
                    const updatedEntries = entries.map(entry => {
                        if (!entry.synced) {
                            return { ...entry, synced: true };
                        }
                        return entry;
                    });

                    chrome.storage.local.set({ 'entries': updatedEntries }, function () {
                        // Show success message
                        if (configStatus) {
                            configStatus.textContent = `Successfully synced ${data.insertedIds.length} entries!`;
                            configStatus.className = 'config-status success';
                        }

                        // Reload entries to update the UI
                        loadEntries();
                    });
                }
            })
            .catch(error => {
                console.error('Error syncing entries to MongoDB:', error);
                if (configStatus) {
                    configStatus.textContent = 'Sync failed: ' + error.message;
                    configStatus.className = 'config-status error';
                }
            });
    });
}

// Load entries from storage
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
                // Look up the resume to check if it has PDF data
                chrome.storage.local.get('resumes', function (resumeData) {
                    const resumes = resumeData.resumes || [];
                    const resume = resumes.find(r => r.id === entry.resumeId);
                    const hasPdf = resume && resume.pdfData;

                    const row = document.createElement('tr');
                    row.innerHTML = `
            <td><a href="${entry.url}" target="_blank">${entry.site || 'Unknown'}</a></td>
            <td>${entry.job || 'N/A'}</td>
            <td>
              <div>${entry.resumeName || 'Unknown'}</div>
              <div class="file-name">${entry.resumeFilename}</div>
              ${hasPdf ? '<button class="view-btn view-entry-pdf" data-resume-id="' + entry.resumeId + '">View PDF</button>' : ''}
              ${mongodbEnabled ? `<span class="sync-indicator ${entry.synced ? 'synced' : 'not-synced'}">${entry.synced ? 'Synced' : 'Not synced'}</span>` : ''}
            </td>
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
            alert('No PDF file available for this resume');
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
        const entry = entries[index];

        // Remove entry at index
        entries.splice(index, 1);

        // Save updated list
        chrome.storage.local.set({ 'entries': entries }, function () {
            // If MongoDB sync is enabled, also delete from MongoDB
            if (mongodbEnabled && mongoConfig && entry && entry.id) {
                deleteEntryFromMongoDB(entry.id);
            }

            // Reload entries
            const searchTerm = document.getElementById('searchInput').value.trim();
            loadEntries(searchTerm);
        });
    });
}

// Delete an entry from MongoDB
function deleteEntryFromMongoDB(entryId) {
    if (!mongodbEnabled || !mongoConfig) return;

    fetch(mongoConfig.dataApiUrl + '/action/deleteOne', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': mongoConfig.apiKey
        },
        body: JSON.stringify({
            dataSource: 'Cluster0',
            database: mongoConfig.dbName,
            collection: mongoConfig.collectionName,
            filter: { _id: entryId }
        })
    })
        .catch(error => {
            console.error('Error deleting entry from MongoDB:', error);
        });
}

// Clear all entries
function clearEntries() {
    if (confirm('Are you sure you want to clear all application entries?')) {
        chrome.storage.local.set({ 'entries': [] }, function () {
            // If MongoDB sync is enabled, also clear the collection
            if (mongodbEnabled && mongoConfig) {
                clearEntriesFromMongoDB();
            }

            // Reload entries
            loadEntries();
        });
    }
}

// Clear all entries from MongoDB
function clearEntriesFromMongoDB() {
    if (!mongodbEnabled || !mongoConfig) return;

    fetch(mongoConfig.dataApiUrl + '/action/deleteMany', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': mongoConfig.apiKey
        },
        body: JSON.stringify({
            dataSource: 'Cluster0',
            database: mongoConfig.dbName,
            collection: mongoConfig.collectionName,
            filter: {}
        })
    })
        .catch(error => {
            console.error('Error clearing entries from MongoDB:', error);
        });
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
        let csv = 'Date,Site,Job Title,Resume Name,Resume Filename,Synced\n';

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
                entry.synced ? 'Yes' : 'No'
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