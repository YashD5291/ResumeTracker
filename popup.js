document.addEventListener('DOMContentLoaded', function () {
    // Set today's date for the manual entry form
    document.getElementById('manualDate').valueAsDate = new Date();

    // Load all applications when popup opens
    loadApplications();

    // Set up event listeners
    document.getElementById('searchBtn').addEventListener('click', filterApplications);
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('clearAllBtn').addEventListener('click', clearAllData);
    document.getElementById('addManualBtn').addEventListener('click', showAddModal);
    document.getElementById('closeAddModal').addEventListener('click', hideAddModal);
    document.getElementById('cancelAddBtn').addEventListener('click', hideAddModal);
    document.getElementById('saveAddBtn').addEventListener('click', saveManualApplication);
    document.getElementById('closeEditModal').addEventListener('click', hideEditModal);
    document.getElementById('cancelEditBtn').addEventListener('click', hideEditModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveEditApplication);

    // Add listener for search input (search as you type)
    document.getElementById('searchInput').addEventListener('input', filterApplications);
});

// Load applications from storage
function loadApplications(filter = '') {
    chrome.storage.local.get('applications', function (data) {
        const applications = data.applications || [];
        displayApplications(applications, filter);
    });
}

// Display applications in the table
function displayApplications(applications, filter = '') {
    const tableBody = document.getElementById('applicationsBody');
    const noDataMessage = document.getElementById('noDataMessage');

    // Clear current table
    tableBody.innerHTML = '';

    // Filter applications if filter is provided
    let filteredApps = applications;
    if (filter) {
        const lowercaseFilter = filter.toLowerCase();
        filteredApps = applications.filter(app =>
            (app.companyName || '').toLowerCase().includes(lowercaseFilter) ||
            (app.jobTitle || '').toLowerCase().includes(lowercaseFilter) ||
            (app.resumeFileName || '').toLowerCase().includes(lowercaseFilter)
        );
    }

    // Show no data message if there are no applications
    if (filteredApps.length === 0) {
        noDataMessage.style.display = 'block';
        return;
    } else {
        noDataMessage.style.display = 'none';
    }

    // Sort by date, newest first
    filteredApps.sort((a, b) => new Date(b.dateApplied) - new Date(a.dateApplied));

    // Add applications to table
    filteredApps.forEach((app, index) => {
        const row = document.createElement('tr');

        // Format date
        let formattedDate = 'Unknown';
        try {
            const date = new Date(app.dateApplied);
            formattedDate = date.toLocaleDateString();
        } catch (e) {
            console.error('Date parsing error:', e);
        }

        // Default values for missing properties
        const companyName = app.companyName || 'Unknown Company';
        const jobTitle = app.jobTitle || 'Unknown Position';
        const resumeFileName = app.resumeFileName || 'Unknown File';
        const status = app.status || 'Applied';
        const websiteUrl = app.websiteUrl || '#';

        // Create row HTML
        row.innerHTML = `
        <td>${formattedDate}</td>
        <td>${websiteUrl ? `<a href="${websiteUrl}" target="_blank">${companyName}</a>` : companyName}</td>
        <td>${jobTitle}</td>
        <td>${resumeFileName}</td>
        <td class="status-${status.toLowerCase()}">${status}</td>
        <td class="action-buttons">
          <button class="edit-btn" data-index="${index}">Edit</button>
          <button class="delete-btn" data-index="${index}">Delete</button>
        </td>
      `;

        tableBody.appendChild(row);
    });

    // Add event listeners to action buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            editApplication(parseInt(this.getAttribute('data-index')));
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            deleteApplication(parseInt(this.getAttribute('data-index')));
        });
    });
}

// Filter applications based on search input
function filterApplications() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    loadApplications(searchTerm);
}

// Clear search input and show all applications
function clearSearch() {
    document.getElementById('searchInput').value = '';
    loadApplications();
}

// Show add application modal
function showAddModal() {
    document.getElementById('addModal').style.display = 'block';
}

// Hide add application modal
function hideAddModal() {
    document.getElementById('addModal').style.display = 'none';
}

// Save manual application entry
function saveManualApplication() {
    const companyName = document.getElementById('manualCompany').value.trim();
    const jobTitle = document.getElementById('manualJobTitle').value.trim();
    const resumeFileName = document.getElementById('manualResume').value.trim();
    const websiteUrl = document.getElementById('manualWebsite').value.trim();
    const dateValue = document.getElementById('manualDate').value;
    const status = document.getElementById('manualStatus').value;

    // Validate required fields
    if (!companyName || !jobTitle || !resumeFileName) {
        alert('Please fill in Company Name, Job Title, and Resume File Name.');
        return;
    }

    // Format date
    let dateApplied;
    if (dateValue) {
        dateApplied = new Date(dateValue).toISOString();
    } else {
        dateApplied = new Date().toISOString();
    }

    // Create application object
    const newApplication = {
        companyName,
        jobTitle,
        resumeFileName,
        websiteUrl,
        dateApplied,
        status
    };

    // Save to storage
    chrome.storage.local.get('applications', function (data) {
        const applications = data.applications || [];
        applications.push(newApplication);

        chrome.storage.local.set({ 'applications': applications }, function () {
            // Reset form
            document.getElementById('manualCompany').value = '';
            document.getElementById('manualJobTitle').value = '';
            document.getElementById('manualResume').value = '';
            document.getElementById('manualWebsite').value = '';
            document.getElementById('manualDate').valueAsDate = new Date();
            document.getElementById('manualStatus').value = 'Applied';

            // Hide modal and refresh list
            hideAddModal();
            loadApplications(document.getElementById('searchInput').value.trim());
        });
    });
}

// Show edit modal with application data
function editApplication(index) {
    chrome.storage.local.get('applications', function (data) {
        const applications = data.applications || [];
        const app = applications[index];

        if (!app) return;

        // Set form values from application data
        document.getElementById('editCompany').value = app.companyName || '';
        document.getElementById('editJobTitle').value = app.jobTitle || '';
        document.getElementById('editResume').value = app.resumeFileName || '';
        document.getElementById('editWebsite').value = app.websiteUrl || '';

        // Format date for date input
        try {
            const date = new Date(app.dateApplied);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            document.getElementById('editDate').value = `${year}-${month}-${day}`;
        } catch (e) {
            document.getElementById('editDate').valueAsDate = new Date();
        }

        document.getElementById('editStatus').value = app.status || 'Applied';

        // Store index for saving
        document.getElementById('saveEditBtn').setAttribute('data-index', index);

        // Show modal
        document.getElementById('editModal').style.display = 'block';
    });
}

// Hide edit modal
function hideEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

// Save edited application
function saveEditApplication() {
    const index = parseInt(document.getElementById('saveEditBtn').getAttribute('data-index'));

    const companyName = document.getElementById('editCompany').value.trim();
    const jobTitle = document.getElementById('editJobTitle').value.trim();
    const resumeFileName = document.getElementById('editResume').value.trim();
    const websiteUrl = document.getElementById('editWebsite').value.trim();
    const dateValue = document.getElementById('editDate').value;
    const status = document.getElementById('editStatus').value;

    // Validate required fields
    if (!companyName || !jobTitle || !resumeFileName) {
        alert('Please fill in Company Name, Job Title, and Resume File Name.');
        return;
    }

    // Format date
    let dateApplied;
    if (dateValue) {
        dateApplied = new Date(dateValue).toISOString();
    } else {
        dateApplied = new Date().toISOString();
    }

    chrome.storage.local.get('applications', function (data) {
        const applications = data.applications || [];

        // Update application data
        applications[index] = {
            ...applications[index],
            companyName,
            jobTitle,
            resumeFileName,
            websiteUrl,
            dateApplied,
            status
        };

        chrome.storage.local.set({ 'applications': applications }, function () {
            // Hide modal and refresh list
            hideEditModal();
            loadApplications(document.getElementById('searchInput').value.trim());
        });
    });
}

// Delete an application
function deleteApplication(index) {
    if (confirm('Are you sure you want to delete this application record?')) {
        chrome.storage.local.get('applications', function (data) {
            const applications = data.applications || [];

            // Remove the application at the given index
            applications.splice(index, 1);

            chrome.storage.local.set({ 'applications': applications }, function () {
                loadApplications(document.getElementById('searchInput').value.trim());
            });
        });
    }
}

// Clear all application data
function clearAllData() {
    if (confirm('Are you sure you want to delete ALL application records? This cannot be undone.')) {
        chrome.storage.local.set({ 'applications': [] }, function () {
            loadApplications();
        });
    }
}

// Export applications to CSV
function exportToCSV() {
    chrome.storage.local.get('applications', function (data) {
        const applications = data.applications || [];

        if (applications.length === 0) {
            alert('No applications to export');
            return;
        }

        // Create CSV header
        let csv = 'Date Applied,Company,Job Title,Resume File,Status,Website URL\n';

        // Add each application as a row
        applications.forEach(app => {
            let date = 'Unknown Date';
            try {
                date = new Date(app.dateApplied).toLocaleDateString();
            } catch (e) { }

            // Escape commas in fields and handle missing values
            const row = [
                date,
                `"${(app.companyName || 'Unknown Company').replace(/"/g, '""')}"`,
                `"${(app.jobTitle || 'Unknown Position').replace(/"/g, '""')}"`,
                `"${(app.resumeFileName || 'Unknown File').replace(/"/g, '""')}"`,
                app.status || 'Applied',
                `"${(app.websiteUrl || '').replace(/"/g, '""')}"`
            ];

            csv += row.join(',') + '\n';
        });

        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resume_applications_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();

        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revoObjectURL(url);
        }, 0);
    });
}
