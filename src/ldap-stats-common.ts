import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import axios from "axios";
import { credentials } from "./credentials";
import { getGithubToLdapMap } from "./gh-ldap-map";
import { initializeMoment } from "./utils";

initializeMoment();

export async function getGithubUsernameForLdap(ldap: string): Promise<string | null> {
    const ghToLdap = await getGithubToLdapMap();

    // Reverse lookup: find GitHub username for LDAP
    for (const [ghUsername, ldapName] of Object.entries(ghToLdap)) {
        if (ldapName === ldap) {
            return ghUsername;
        }
    }
    return null;
}

export interface GraphQLSearchOptions {
    query: string;
    pageSize?: number;
    timeout?: number;
    retries?: number;
}

export interface PRNode {
    number: number;
    title: string;
    url: string;
    createdAt: string;
    mergedAt: string | null;
    state: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    author?: {
        login: string;
    };
    repository?: {
        name: string;
    };
    files?: {
        nodes: Array<{ path: string }>;
    };
    reviews?: {
        nodes: Array<{
            author?: { login: string };
            state: string;
            submittedAt: string;
            url: string;
        }>;
    };
}

export async function* paginatedGraphQLSearch(
    searchQuery: string,
    nodeExtractor: (nodes: PRNode[]) => PRNode[],
    options: Partial<GraphQLSearchOptions> = {}
): AsyncGenerator<PRNode[], void, unknown> {
    const { pageSize = 50, timeout = 60000, retries: maxRetries = 3 } = options;

    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
        const afterClause = cursor ? `, after: "${cursor}"` : "";

        const query = `
        query {
            search(query: "${searchQuery}", type: ISSUE, first: ${pageSize}${afterClause}) {
                pageInfo {
                    hasNextPage
                    endCursor
                }
                nodes {
                    ... on PullRequest {
                        number
                        title
                        url
                        createdAt
                        mergedAt
                        state
                        additions
                        deletions
                        changedFiles
                        author {
                            login
                        }
                        repository {
                            name
                        }
                        files(first: 30) {
                            nodes {
                                path
                            }
                        }
                        reviews(first: 50) {
                            nodes {
                                author {
                                    login
                                }
                                state
                                submittedAt
                                url
                            }
                        }
                    }
                }
            }
            rateLimit {
                cost
                remaining
            }
        }`;

        let response;
        let retries = maxRetries;
        while (retries > 0) {
            try {
                response = await axios.post(
                    "https://api.github.com/graphql",
                    { query },
                    { ...credentials, timeout }
                );
                break;
            } catch (err) {
                retries--;
                if (retries === 0) throw err;
                console.log(`  Retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        if (response!.data.errors) {
            console.error("GraphQL Errors:", response!.data.errors);
            throw new Error(`GraphQL errors: ${response!.data.errors.map((e: any) => e.message).join(', ')}`);
        }

        const searchData = response!.data.data.search;
        const rateLimit = response!.data.data.rateLimit;

        console.log(`  Fetched ${searchData.nodes.length} items (rate limit: ${rateLimit.remaining})`);

        yield nodeExtractor(searchData.nodes);

        hasNextPage = searchData.pageInfo.hasNextPage;
        cursor = searchData.pageInfo.endCursor;
    }
}

export function parseCliArgs(scriptName: string): { ldap: string; year: number } {
    const ldap = process.argv[2];
    const yearArg = process.argv[3];

    if (!ldap) {
        console.error("Please provide an LDAP username as an argument");
        console.error(`Usage: yarn ${scriptName} <ldap> [year]`);
        console.error(`Example: yarn ${scriptName} estanfill 2024`);
        process.exit(1);
    }

    // Default to current calendar year
    const year = yearArg ? parseInt(yearArg, 10) : new Date().getFullYear();

    if (isNaN(year) || year < 2000 || year > 2100) {
        console.error("Invalid year provided. Please use a valid year (e.g., 2024)");
        process.exit(1);
    }

    return { ldap, year };
}

export async function resolveGithubUsername(ldap: string): Promise<string> {
    const githubUsername = await getGithubUsernameForLdap(ldap);

    if (!githubUsername) {
        console.error(`Could not find GitHub username for LDAP: ${ldap}`);
        console.error("Make sure the user is in github-username-to-ldap.csv");
        process.exit(1);
    }

    console.log(`Found GitHub username: @${githubUsername} for LDAP: ${ldap}`);
    return githubUsername;
}

export function getDateRange(year: number): { startDate: string; endDate: string } {
    return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`
    };
}

export type PRCategory = "application" | "tests" | "infra" | "internal" | "mixed";

export function categorizePR(repoName: string, prTitle: string, files: string[]): PRCategory {
    const lowerTitle = prTitle.toLowerCase();
    const lowerRepo = repoName.toLowerCase();

    // Internal: omnibot, payf-scripts, square-console
    const internalRepos = ["omnibot", "payf-scripts", "square-console"];
    if (internalRepos.some(repo => lowerRepo.includes(repo)) || lowerTitle.includes("omnibot")) {
        return "internal";
    }

    // Analyze files to determine category
    let testFiles = 0;
    let infraFiles = 0;
    let appFiles = 0;

    for (const file of files) {
        const lowerFile = file.toLowerCase();

        // Test files
        if (
            lowerFile.includes("test") ||
            lowerFile.includes("spec") ||
            lowerFile.includes("__tests__") ||
            lowerFile.endsWith(".test.ts") ||
            lowerFile.endsWith(".test.js") ||
            lowerFile.endsWith(".spec.ts") ||
            lowerFile.endsWith(".spec.js") ||
            lowerFile.endsWith("_test.go") ||
            lowerFile.endsWith("_test.py")
        ) {
            testFiles++;
            continue;
        }

        // Infra/config files
        if (
            lowerFile.includes("dockerfile") ||
            lowerFile.includes("docker-compose") ||
            lowerFile.includes(".github/") ||
            lowerFile.includes("ci/") ||
            lowerFile.includes("cd/") ||
            lowerFile.includes("terraform") ||
            lowerFile.includes("kubernetes") ||
            lowerFile.includes("k8s") ||
            lowerFile.includes("helm") ||
            lowerFile.endsWith(".yaml") ||
            lowerFile.endsWith(".yml") ||
            lowerFile.endsWith(".json") ||
            lowerFile.endsWith(".toml") ||
            lowerFile.includes("config") ||
            lowerFile.includes("makefile") ||
            lowerFile.includes("build.gradle") ||
            lowerFile.includes("pom.xml") ||
            lowerFile.includes("package.json") ||
            lowerFile.includes(".env")
        ) {
            infraFiles++;
            continue;
        }

        // Everything else is application code
        appFiles++;
    }

    const total = testFiles + infraFiles + appFiles;
    if (total === 0) return "application";

    // Tests category: ONLY if 100% test files (no app or infra code)
    if (testFiles > 0 && appFiles === 0 && infraFiles === 0) {
        return "tests";
    }

    // If there are non-test files, categorize by those (ignore test files)
    const nonTestTotal = appFiles + infraFiles;
    if (nonTestTotal === 0) return "application";

    const infraRatio = infraFiles / nonTestTotal;
    const appRatio = appFiles / nonTestTotal;

    // If >70% of non-test files are one category, assign that category
    if (infraRatio > 0.7) return "infra";
    if (appRatio > 0.7) return "application";

    // Mixed infra and app code
    return "mixed";
}

// Trend analysis utilities

export interface MonthlyData {
    month: string;
    count: number;
    additions?: number;
    deletions?: number;
}

export interface TrendAnalysis {
    slope: number;           // positive = increasing, negative = decreasing
    percentChange: number;   // overall % change from first to last
    average: number;
    trend: "increasing" | "decreasing" | "stable";
    firstHalfAvg: number;
    secondHalfAvg: number;
}

export function calculateTrend(data: MonthlyData[]): TrendAnalysis {
    if (data.length === 0) {
        return { slope: 0, percentChange: 0, average: 0, trend: "stable", firstHalfAvg: 0, secondHalfAvg: 0 };
    }

    const counts = data.map(d => d.count);
    const n = counts.length;
    const average = counts.reduce((a, b) => a + b, 0) / n;

    // Linear regression for slope
    const xMean = (n - 1) / 2;
    const yMean = average;
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
        numerator += (i - xMean) * (counts[i] - yMean);
        denominator += (i - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;

    // First half vs second half comparison
    const midpoint = Math.floor(n / 2);
    const firstHalf = counts.slice(0, midpoint);
    const secondHalf = counts.slice(midpoint);
    const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;

    // Percent change from first to last (excluding zeros)
    const nonZeroCounts = counts.filter(c => c > 0);
    let percentChange = 0;
    if (nonZeroCounts.length >= 2) {
        const first = nonZeroCounts[0];
        const last = nonZeroCounts[nonZeroCounts.length - 1];
        percentChange = first > 0 ? ((last - first) / first) * 100 : 0;
    }

    // Determine trend (using 10% threshold for stability)
    let trend: TrendAnalysis["trend"] = "stable";
    const halfChangePercent = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;
    if (halfChangePercent > 15) trend = "increasing";
    else if (halfChangePercent < -15) trend = "decreasing";

    return { slope, percentChange, average, trend, firstHalfAvg, secondHalfAvg };
}

export function getAllMonthsForYear(year: number): string[] {
    const months: string[] = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-indexed

    for (let m = 0; m < 12; m++) {
        // Don't include future months
        if (year === currentYear && m > currentMonth) break;
        months.push(`${year}-${String(m + 1).padStart(2, '0')}`);
    }
    return months;
}

export function printMonthlyTrendChart(
    byMonth: Record<string, number>,
    year: number,
    label: string,
    maxBarWidth: number = 40
): void {
    const allMonths = getAllMonthsForYear(year);
    const monthlyData: MonthlyData[] = allMonths.map(month => ({
        month,
        count: byMonth[month] || 0
    }));

    const maxCount = Math.max(...monthlyData.map(d => d.count), 1);
    const trend = calculateTrend(monthlyData);

    console.log(`\nMONTHLY ${label.toUpperCase()}`);
    console.log("-".repeat(60));

    // Month labels
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (const data of monthlyData) {
        const monthIdx = parseInt(data.month.split('-')[1]) - 1;
        const monthName = monthNames[monthIdx];
        const barLength = Math.round((data.count / maxCount) * maxBarWidth);
        const bar = "#".repeat(barLength);
        const countStr = data.count.toString().padStart(4);
        console.log(`${monthName} ${data.month.split('-')[1]}: ${countStr} ${bar}`);
    }

    // Trend summary
    console.log("-".repeat(60));
    const trendArrow = trend.trend === "increasing" ? "^" : trend.trend === "decreasing" ? "v" : "=";
    const trendLabel = trend.trend === "increasing" ? "INCREASING" : trend.trend === "decreasing" ? "DECREASING" : "STABLE";
    console.log(`Trend: ${trendArrow} ${trendLabel}`);
    console.log(`  Average: ${trend.average.toFixed(1)} per month`);
    console.log(`  H1 avg: ${trend.firstHalfAvg.toFixed(1)} | H2 avg: ${trend.secondHalfAvg.toFixed(1)}`);

    if (trend.percentChange !== 0) {
        const changeStr = trend.percentChange > 0 ? `+${trend.percentChange.toFixed(0)}%` : `${trend.percentChange.toFixed(0)}%`;
        console.log(`  Change: ${changeStr} (first to last month)`);
    }
}

export function printQuarterlyComparison(
    byMonth: Record<string, number>,
    year: number,
    label: string
): void {
    const quarters = [
        { name: "Q1", months: ["01", "02", "03"] },
        { name: "Q2", months: ["04", "05", "06"] },
        { name: "Q3", months: ["07", "08", "09"] },
        { name: "Q4", months: ["10", "11", "12"] }
    ];

    console.log(`\nQUARTERLY ${label.toUpperCase()}`);
    console.log("-".repeat(40));

    const quarterlyTotals: number[] = [];

    for (const q of quarters) {
        const total = q.months.reduce((sum, m) => {
            const key = `${year}-${m}`;
            return sum + (byMonth[key] || 0);
        }, 0);
        quarterlyTotals.push(total);

        // Only show quarters that have data or are in the past
        const currentDate = new Date();
        const qEndMonth = parseInt(q.months[2]);
        const isInPast = year < currentDate.getFullYear() ||
            (year === currentDate.getFullYear() && qEndMonth <= currentDate.getMonth() + 1);

        if (isInPast || total > 0) {
            console.log(`${q.name} ${year}: ${total.toString().padStart(4)} ${label.toLowerCase()}`);
        }
    }

    // Quarter-over-quarter comparison
    const validQuarters = quarterlyTotals.filter((_, i) => {
        const q = quarters[i];
        const qEndMonth = parseInt(q.months[2]);
        const currentDate = new Date();
        return year < currentDate.getFullYear() ||
            (year === currentDate.getFullYear() && qEndMonth <= currentDate.getMonth() + 1);
    });

    if (validQuarters.length >= 2) {
        console.log("-".repeat(40));
        for (let i = 1; i < validQuarters.length; i++) {
            const prev = validQuarters[i - 1];
            const curr = validQuarters[i];
            if (prev > 0) {
                const change = ((curr - prev) / prev) * 100;
                const changeStr = change > 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`;
                console.log(`Q${i} -> Q${i + 1}: ${changeStr}`);
            }
        }
    }
}
