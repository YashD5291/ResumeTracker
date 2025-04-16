// popup.js - Dashboard functionality
document.addEventListener('DOMContentLoaded', function () {
    // Load all applications when popup opens
    loadApplications();

    // Set up event listeners
    document.getElementById('searchBtn').addEventListener('click', filterApplications);
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);

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
            app.companyName.toLowerCase().includes(lowercaseFilter) ||
            app.jobTitle.toLowerCase().includes(lowercaseFilter) ||
            app.resumeFileName.toLowerCase().includes(lowercaseFilter)
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
        const date = new Date(app.dateApplied);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

        row.innerHTML = `
        <td>${formattedDate}</td>
        <td><a href="${app.websiteUrl}" target="_blank">${app.companyName}</a></td>
        <td>${app.jobTitle}</td>
        <td>${app.resumeFileName}</td>
        <td class="status-${app.status.toLowerCase()}">${app.status}</td>
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

// Edit application status and details
function editApplication(index) {
    chrome.storage.local.get('applications', function (data) {
        const applications = data.applications || [];
        const app = applications[index];

        if (!app) return;

        // Simple prompt for status update (in a real extension, use a modal)
        const newStatus = prompt(
            `Update status for ${app.jobTitle} at ${app.companyName}:
        Options: Applied, Interview, Rejected, Offer, Accepted`,
            app.status
        );

        if (newStatus) {
            app.status = newStatus;
            applications[index] = app;

            chrome.storage.local.set({ 'applications': applications }, function () {
                loadApplications(document.getElementById('searchInput').value.trim());
            });
        }
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
            const date = new Date(app.dateApplied).toLocaleDateString();
            // Escape commas in fields
            const row = [
                date,
                `"${app.companyName.replace(/"/g, '""')}"`,
                `"${app.jobTitle.replace(/"/g, '""')}"`,
                `"${app.resumeFileName.replace(/"/g, '""')}"`,
                app.status,
                `"${app.websiteUrl.replace(/"/g, '""')}"`
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
            window.URL.revokeObjectURL(url);
        }, 0);
    });
}
