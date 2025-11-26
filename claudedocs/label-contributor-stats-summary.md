# Label Contributor Stats Implementation Summary

## Overview
Created a new analytics tool to analyze PRs by label with comparison between internal and external contributors.

## Files Created/Modified

### New Files
1. **src/label-contributor-stats.ts** - Main analytics script
2. **LABEL_CONTRIBUTOR_STATS.md** - Comprehensive documentation
3. **claudedocs/label-contributor-stats-summary.md** - This summary

### Modified Files
1. **package.json** - Added `label-contributor-stats` and `label-contributor-stats:debug` scripts
2. **README.md** - Added reference to new analytics tool
3. **github-username-to-ldap.csv** - Already had team member data

## Key Features

1. **Internal vs External Classification**
   - Uses `github-username-to-ldap.csv` to identify internal contributors
   - Any username not in the CSV is considered external

2. **Metrics Provided**
   - Total PRs with the specified label
   - Breakdown: internal vs external (with percentages)
   - Average time to first approval for each group
   - Comparative analysis showing time difference

3. **Flexible Usage**
   - Default: 90 days for "esperanto" label
   - Can specify custom label and time period
   - `--detailed` flag shows complete PR lists

## Test Results (Real Data)

When tested with `yarn label-contributor-stats esperanto 90`:

```
📊 Analyzing PRs with label: "esperanto" over the last 90 days

Found 89 PRs with label "esperanto"

═══════════════════════════════════════════════════════════
📈 SUMMARY REPORT: "esperanto" label (last 90 days)
═══════════════════════════════════════════════════════════

Total PRs: 89
├─ Internal PRs: 33 (37.1%)
└─ External PRs: 56 (62.9%)

⏱️  Average Time to First Approval:
├─ Internal: 27.12 hours (31 PRs approved)
└─ External: 46.44 hours (53 PRs approved)

📊 External PRs take 19.32 hours longer (71.2% slower)

═══════════════════════════════════════════════════════════
```

### Key Insights from Test Data
- **62.9% of esperanto PRs are from external contributors** (56 out of 89)
- **External PRs take 71% longer to get approved** (46.44 hours vs 27.12 hours)
- **Most PRs get approved**: 31 of 33 internal PRs, 53 of 56 external PRs

## Usage Examples

### Basic Usage
```bash
# Default: esperanto label, 90 days
yarn label-contributor-stats

# Specify label and days
yarn label-contributor-stats esperanto 90

# Different label, 30 days
yarn label-contributor-stats bug-fix 30

# Get detailed PR lists
yarn label-contributor-stats esperanto 90 --detailed
```

### Debug Mode
```bash
yarn label-contributor-stats:debug esperanto 90
```

## Technical Implementation

### Architecture
- Extends existing PR analysis infrastructure
- Reuses existing modules:
  - `list-prs.ts` - GitHub PR search
  - `gh-ldap-map.ts` - Internal user mapping
  - `get-reviewer-data.ts` - Review timing data
  - `working-hours.ts` - Business hours calculation

### Data Flow
1. Load internal user map from CSV
2. Search GitHub for PRs with specified label
3. Classify each PR as internal or external
4. Fetch review data for each PR
5. Calculate time to first approval
6. Aggregate statistics and generate report

### Performance
- Execution time: ~90-100 seconds for 89 PRs
- Makes individual API calls for each PR (required for detailed review data)
- Could be optimized with parallel API calls if needed

## Future Enhancements (Optional)

1. **Export Formats**
   - CSV export for spreadsheet analysis
   - JSON output for programmatic use

2. **Additional Metrics**
   - Time to merge (not just approval)
   - Number of review iterations
   - PR size analysis (lines changed)

3. **Filtering Options**
   - Filter by repository
   - Filter by date range for specific quarters
   - Exclude bot accounts from analysis

4. **Visualization**
   - Graph of approval times over time
   - Distribution charts
   - Trend analysis

## Notes

- The script respects existing `.env` configuration
- Works with GitHub API rate limits
- Handles both merged and open PRs
- Excludes closed-without-merge PRs
- All timestamps use business hours calculation
