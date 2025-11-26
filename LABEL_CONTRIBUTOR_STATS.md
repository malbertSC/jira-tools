# Label Contributor Stats Tool

An analytics tool for tracking PRs with specific labels and analyzing differences between internal and external contributors.

## Overview

This tool analyzes pull requests over a configurable time period and provides insights into:
- Total number of PRs with the specified label
- Breakdown of internal vs external contributors
- Average time to first approval for internal vs external PRs
- Comparison of approval times between internal and external contributors

## Usage

### Basic Usage (Default: 90 days for "esperanto" label)
```bash
yarn label-contributor-stats
```

### Specify Custom Label
```bash
yarn label-contributor-stats <label-name> [days]
```

### Specify Custom Time Period
```bash
yarn label-contributor-stats esperanto 30
```

### Get Detailed PR Lists
```bash
yarn label-contributor-stats esperanto 90 --detailed
```

## Examples

### Analyze esperanto label for last 90 days
```bash
yarn label-contributor-stats esperanto 90
```

### Analyze different label for last 30 days
```bash
yarn label-contributor-stats bug-fix 30
```

### Get detailed list of all PRs
```bash
yarn label-contributor-stats esperanto 90 --detailed
```

## Output

### Summary Report
The tool provides a comprehensive summary including:
- **Total PRs**: Count of all PRs with the specified label
- **Internal PRs**: PRs from contributors in `github-username-to-ldap.csv` (with percentage)
- **External PRs**: PRs from contributors NOT in the CSV file (with percentage)
- **Average Time to First Approval**:
  - Internal contributors
  - External contributors
- **Comparative Analysis**: Shows if external PRs take longer/shorter than internal PRs

### Example Output
```
📊 Analyzing PRs with label: "esperanto" over the last 90 days

Found 45 PRs with label "esperanto"

═══════════════════════════════════════════════════════════
📈 SUMMARY REPORT: "esperanto" label (last 90 days)
═══════════════════════════════════════════════════════════

Total PRs: 45
├─ Internal PRs: 32 (71.1%)
└─ External PRs: 13 (28.9%)

⏱️  Average Time to First Approval:
├─ Internal: 3.45 hours (30 PRs approved)
└─ External: 8.72 hours (11 PRs approved)

📊 External PRs take 5.27 hours longer (152.8% slower)

═══════════════════════════════════════════════════════════

💡 Run with --detailed flag to see complete PR lists
```

### Detailed Output
When using `--detailed` flag, the tool also shows:
- Complete list of external PRs with:
  - Author username
  - Repository and PR number
  - GitHub URL
  - Creation timestamp
  - Time to first approval (or "Not yet approved")
- Complete list of internal PRs with the same details

## How It Works

1. **Internal vs External Classification**:
   - The tool reads `github-username-to-ldap.csv` to identify internal contributors
   - Any GitHub username found in the CSV is considered "internal"
   - All other usernames are considered "external"

2. **Time to Approval Calculation**:
   - Measures the time from PR creation to the first approval review
   - Calculates averages separately for internal and external PRs
   - Only includes PRs that have received at least one approval

3. **Label Filtering**:
   - Searches GitHub for PRs with the specified label
   - Includes both open and merged PRs (excludes closed-without-merge)
   - Defaults to the `squareup` organization

## Configuration

The tool respects the following environment variables from `.env`:
- `GITHUB_USERNAME`: Your GitHub username for API authentication
- `GITHUB_PAT`: Your GitHub Personal Access Token
- `DAYS_TO_LOOK_BACK`: Default number of days (can be overridden by command line argument)

## Requirements

- Node.js and Yarn
- GitHub Personal Access Token with appropriate permissions
- Access to the repository organization (squareup)
- Valid `github-username-to-ldap.csv` file in the project root

## Debugging

To run in debug mode:
```bash
yarn label-contributor-stats:debug esperanto 90
```

This will start the Node.js debugger and pause execution at the first line, allowing you to attach a debugger.

## Related Scripts

- `get-pr-stats-for-label`: Original label-based PR statistics
- `get-pr-stats`: General PR statistics for team members
- `user-activity`: User-specific activity reports
