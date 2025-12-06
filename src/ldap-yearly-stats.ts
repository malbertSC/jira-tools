import { moment } from "./utils";
import {
    parseCliArgs,
    resolveGithubUsername,
    getDateRange,
    paginatedGraphQLSearch,
    categorizePR,
    PRCategory,
    printMonthlyTrendChart,
    printQuarterlyComparison
} from "./ldap-stats-common";

interface PRStats {
    repository: string;
    prNumber: number;
    prTitle: string;
    prUrl: string;
    createdAt: string;
    mergedAt: string | null;
    state: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    category: PRCategory;
}

interface MonthlyPRData {
    count: number;
    additions: number;
    deletions: number;
}

interface YearlyStats {
    ldap: string;
    githubUsername: string;
    year: number;
    prs: PRStats[];
    summary: {
        totalPRs: number;
        totalAdditions: number;
        totalDeletions: number;
        totalChangedFiles: number;
        byCategory: {
            application: { count: number; additions: number; deletions: number };
            tests: { count: number; additions: number; deletions: number };
            infra: { count: number; additions: number; deletions: number };
            internal: { count: number; additions: number; deletions: number };
            mixed: { count: number; additions: number; deletions: number };
        };
        byMonth: Record<string, MonthlyPRData>;
    };
}

async function fetchPRsForUser(githubUsername: string, year: number): Promise<PRStats[]> {
    const { startDate, endDate } = getDateRange(year);
    console.log(`Fetching PRs for @${githubUsername} from ${startDate} to ${endDate}...`);

    const searchQuery = `author:${githubUsername} created:${startDate}..${endDate} is:pr org:squareup repo:!zzz-archive-java draft:false is:merged`;
    const prs: PRStats[] = [];

    for await (const nodes of paginatedGraphQLSearch(searchQuery, (nodes) => nodes, { pageSize: 25 })) {
        for (const pr of nodes) {
            if (!pr || !pr.repository) continue;

            const filePaths = pr.files?.nodes?.map((f: any) => f.path) || [];
            const category = categorizePR(pr.repository.name, pr.title, filePaths);

            prs.push({
                repository: pr.repository.name,
                prNumber: pr.number,
                prTitle: pr.title,
                prUrl: pr.url,
                createdAt: pr.createdAt,
                mergedAt: pr.mergedAt,
                state: pr.state,
                additions: pr.additions,
                deletions: pr.deletions,
                changedFiles: pr.changedFiles,
                category
            });
        }
    }

    return prs;
}

function generateSummary(prs: PRStats[]): YearlyStats["summary"] {
    const summary: YearlyStats["summary"] = {
        totalPRs: prs.length,
        totalAdditions: 0,
        totalDeletions: 0,
        totalChangedFiles: 0,
        byCategory: {
            application: { count: 0, additions: 0, deletions: 0 },
            tests: { count: 0, additions: 0, deletions: 0 },
            infra: { count: 0, additions: 0, deletions: 0 },
            internal: { count: 0, additions: 0, deletions: 0 },
            mixed: { count: 0, additions: 0, deletions: 0 }
        },
        byMonth: {}
    };

    for (const pr of prs) {
        summary.totalAdditions += pr.additions;
        summary.totalDeletions += pr.deletions;
        summary.totalChangedFiles += pr.changedFiles;

        summary.byCategory[pr.category].count++;
        summary.byCategory[pr.category].additions += pr.additions;
        summary.byCategory[pr.category].deletions += pr.deletions;

        // Track by month
        const month = moment(pr.createdAt).format("YYYY-MM");
        if (!summary.byMonth[month]) {
            summary.byMonth[month] = { count: 0, additions: 0, deletions: 0 };
        }
        summary.byMonth[month].count++;
        summary.byMonth[month].additions += pr.additions;
        summary.byMonth[month].deletions += pr.deletions;
    }

    return summary;
}

function printReport(stats: YearlyStats): void {
    console.log("\n" + "=".repeat(80));
    console.log(`PR Stats for ${stats.ldap} (@${stats.githubUsername}) - Calendar Year ${stats.year}`);
    console.log("=".repeat(80));

    console.log(`\nSUMMARY`);
    console.log("-".repeat(40));
    console.log(`Total Merged PRs:    ${stats.summary.totalPRs}`);
    console.log(`Total Lines Added:   +${stats.summary.totalAdditions.toLocaleString()}`);
    console.log(`Total Lines Removed: -${stats.summary.totalDeletions.toLocaleString()}`);
    console.log(`Net Lines Changed:   ${(stats.summary.totalAdditions - stats.summary.totalDeletions).toLocaleString()}`);
    console.log(`Total Files Changed: ${stats.summary.totalChangedFiles.toLocaleString()}`);

    // Monthly trend chart for PRs
    const prCountByMonth: Record<string, number> = {};
    for (const [month, data] of Object.entries(stats.summary.byMonth)) {
        prCountByMonth[month] = data.count;
    }
    printMonthlyTrendChart(prCountByMonth, stats.year, "PRs Merged");

    // Monthly trend chart for lines of code
    const linesAddedByMonth: Record<string, number> = {};
    for (const [month, data] of Object.entries(stats.summary.byMonth)) {
        linesAddedByMonth[month] = data.additions;
    }
    printMonthlyTrendChart(linesAddedByMonth, stats.year, "Lines Added");

    // Quarterly comparison
    printQuarterlyComparison(prCountByMonth, stats.year, "PRs");

    console.log(`\nBY CATEGORY`);
    console.log("-".repeat(40));

    const categories: Array<{ key: keyof typeof stats.summary.byCategory; label: string }> = [
        { key: "application", label: "Application Code" },
        { key: "tests", label: "Tests" },
        { key: "infra", label: "Infra/Configuration" },
        { key: "internal", label: "Internal (Omnibot)" },
        { key: "mixed", label: "Mixed" }
    ];

    for (const { key, label } of categories) {
        const cat = stats.summary.byCategory[key];
        if (cat.count > 0) {
            const net = cat.additions - cat.deletions;
            const netStr = net >= 0 ? `+${net.toLocaleString()}` : net.toLocaleString();
            console.log(`\n${label}:`);
            console.log(`   PRs: ${cat.count}`);
            console.log(`   Lines: +${cat.additions.toLocaleString()} / -${cat.deletions.toLocaleString()} (net: ${netStr})`);
        }
    }

    console.log(`\nPR DETAILS`);
    console.log("-".repeat(40));

    // Group PRs by category
    for (const { key, label } of categories) {
        const categoryPRs = stats.prs.filter(pr => pr.category === key);
        if (categoryPRs.length === 0) continue;

        console.log(`\n${label} (${categoryPRs.length} PRs):`);

        for (const pr of categoryPRs) {
            const date = moment(pr.createdAt).format("YYYY-MM-DD");
            console.log(`   - [${date}] ${pr.repository}#${pr.prNumber}: ${pr.prTitle}`);
            console.log(`     +${pr.additions}/-${pr.deletions} (${pr.changedFiles} files)`);
            console.log(`     ${pr.prUrl}`);
        }
    }
}

async function main() {
    const { ldap, year } = parseCliArgs("ldap-yearly-stats");

    try {
        const githubUsername = await resolveGithubUsername(ldap);
        const prs = await fetchPRsForUser(githubUsername, year);
        console.log(`Found ${prs.length} merged PRs`);

        const stats: YearlyStats = {
            ldap,
            githubUsername,
            year,
            prs,
            summary: generateSummary(prs)
        };

        printReport(stats);

    } catch (error) {
        console.error("Failed to fetch stats:", (error as Error).message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export { YearlyStats, PRStats, fetchPRsForUser, generateSummary };
