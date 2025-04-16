# Resume Tracker

A Chrome extension that automatically tracks which resume you upload to each job application site, helping you manage your job applications efficiently.

## Features

- **Automatic Resume Detection**: Identifies and records which resume file you upload to job applications
- **Job Application Tracking**: Stores company name, job title, date applied, and application status
- **Application Dashboard**: View all your job applications in one place
- **Search Functionality**: Easily find applications by company name, job title, or resume filename
- **Status Management**: Update application status (Applied, Interview, Rejected, Offer, Accepted)
- **Export to CSV**: Download your application history for backup or analysis

## Installation

### Developer Mode Installation

1. **Download the Extension Files**:
   - Clone this repository or download it as a ZIP file and extract it
   
2. **Load the Extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" by toggling the switch in the top-right corner
   - Click "Load unpacked" and select the directory containing the extension files
   - The Resume Tracker extension should now appear in your extensions list
   
3. **Pin the Extension** (Optional):
   - Click the puzzle piece icon in Chrome toolbar
   - Find Resume Tracker and click the pin icon to keep it easily accessible

### From Chrome Web Store (Once Published)

1. Navigate to the Chrome Web Store listing (link will be provided once published)
2. Click "Add to Chrome"
3. Confirm by clicking "Add extension" in the popup

## Usage

1. **Apply for Jobs**:
   - When you upload a resume on a job application site, the extension automatically detects and records it
   - The application is saved when you submit the form

2. **View Your Applications**:
   - Click the Resume Tracker icon in your Chrome toolbar
   - View your complete application history in the dashboard
   
3. **Manage Applications**:
   - Search for specific applications using the search box
   - Update application status (Applied, Interview, Rejected, Offer, Accepted)
   - Delete applications you no longer want to track
   
4. **Export Data**:
   - Click the "Export to CSV" button to download your application history
   - The CSV file includes all tracked information for backup or analysis

## Privacy

This extension:
- Only stores data locally on your computer (using Chrome's storage API)
- Does not send your data to any external servers
- Only activates on pages where you upload resume files
- Requires minimal permissions (storage and active tab access)

## Troubleshooting

If the extension doesn't detect your resume upload:
- Make sure you're using a file input field to upload your resume
- The extension looks for input fields with names/IDs containing "resume" or "cv"
- Some websites with heavily customized file upload widgets may not be compatible

## License

[MIT License](LICENSE)

## Contributing

Contributions, bug reports, and feature requests are welcome! Feel free to open an issue or submit a pull request. 