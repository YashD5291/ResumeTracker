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
            </div>
            <div class="resume-actions">
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

// Save a new resume
function addResume() {
    const newResumeName = document.getElementById('newResumeName').value.trim();
    const newResumeFilename = document.getElementById('newResumeFilename').value.trim();

    if (!newResumeName) {
        alert('Please enter a resume name');
        return;
    }

    if (!newResumeFilename) {
        alert('Please enter a filename or select a PDF');
        return;
    }

    chrome.storage.local.get('resumes', function (data) {
        const resumes = data.resumes || [];

        // Create unique ID for the resume
        const newResumeId = 'resume_' + Date.now();

        // Add new resume
        resumes.push({
            id: newResumeId,
            name: newResumeName,
            filename: newResumeFilename
        });

        // Save updated list
        chrome.storage.local.set({ 'resumes': resumes }, function () {
            // Clear input fields
            document.getElementById('newResumeName').value = '';
            document.getElementById('newResumeFilename').value = '';
            document.getElementById('selectedFileName').textContent = '';
            document.getElementById('newResumePdf').value = '';

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
        const entry = {
            url: url,
            site: siteName,
            resumeId: resumeId,
            resumeName: selectedResume.name,
            resumeFilename: selectedResume.filename,
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
                const row = document.createElement('tr');
                row.innerHTML = `
            <td><a href="${entry.url}" target="_blank">${entry.site || 'Unknown'}</a></td>
            <td>${entry.job || 'N/A'}</td>
            <td>
              <div>${entry.resumeName || 'Unknown'}</div>
              <div class="file-name">${entry.resumeFilename}</div>
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
        let csv = 'Date,Site,Job Title,Resume Name,Resume Filename,URL\n';

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
                `"${entry.url.replace(/"/g, '""')}"`
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