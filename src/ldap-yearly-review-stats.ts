import { moment } from "./utils";
import {
    parseCliArgs,
    resolveGithubUsername,
    getDateRange,
    paginatedGraphQLSearch,
    printMonthlyTrendChart,
    printQuarterlyComparison
} from "./ldap-stats-common";

interface ReviewStats {
    repository: string;
    prNumber: number;
    prTitle: string;
    prUrl: string;
    prAuthor: string;
    reviewedAt: string;
    reviewState: string;
    reviewUrl: string;
}

interface YearlyReviewStats {
    ldap: string;
    githubUsername: string;
    year: number;
    reviews: ReviewStats[];
    summary: {
        totalReviews: number;
        uniquePRsReviewed: number;
        uniqueAuthorsReviewed: number;
        byState: {
            approved: number;
            changesRequested: number;
            commented: number;
            dismissed: number;
        };
        byMonth: Record<string, number>;
        topAuthorsReviewed: Array<{ author: string; count: number }>;
        topRepositories: Array<{ repo: string; count: number }>;
    };
}

async function fetchReviewsForUser(githubUsername: string, year: number): Promise<ReviewStats[]> {
    const { startDate, endDate } = getDateRange(year);
    console.log(`Fetching reviews by @${githubUsername} from ${startDate} to ${endDate}...`);

    const searchQuery = `reviewed-by:${githubUsername} created:${startDate}..${endDate} is:pr org:squareup repo:!zzz-archive-java`;
    const reviews: ReviewStats[] = [];

    for await (const nodes of paginatedGraphQLSearch(searchQuery, (nodes) => nodes)) {
        for (const pr of nodes) {
            if (!pr || !pr.repository || !pr.reviews) continue;

            // Filter reviews to only include ones by our user
            const userReviews = pr.reviews.nodes.filter(
                (review: any) => review.author?.login?.toLowerCase() === githubUsername.toLowerCase()
            );

            for (const review of userReviews) {
                if (!review.submittedAt) continue;

                // Verify the review is within our date range
                const reviewDate = moment(review.submittedAt);
                if (reviewDate.year() !== year) continue;

                reviews.push({
                    repository: pr.repository.name,
                    prNumber: pr.number,
                    prTitle: pr.title,
                    prUrl: pr.url,
                    prAuthor: pr.author?.login || "unknown",
                    reviewedAt: review.submittedAt,
                    reviewState: review.state,
                    reviewUrl: review.url
                });
            }
        }
    }

    // Deduplicate reviews (same PR might appear multiple times in search)
    const uniqueReviews = reviews.reduce((acc, review) => {
        const key = `${review.repository}-${review.prNumber}-${review.reviewedAt}`;
        if (!acc.has(key)) {
            acc.set(key, review);
        }
        return acc;
    }, new Map<string, ReviewStats>());

    return Array.from(uniqueReviews.values());
}

function generateSummary(reviews: ReviewStats[]): YearlyReviewStats["summary"] {
    const uniquePRs = new Set(reviews.map(r => `${r.repository}-${r.prNumber}`));
    const uniqueAuthors = new Set(reviews.map(r => r.prAuthor));

    const byState = {
        approved: 0,
        changesRequested: 0,
        commented: 0,
        dismissed: 0
    };

    const byMonth: Record<string, number> = {};
    const authorCounts: Record<string, number> = {};
    const repoCounts: Record<string, number> = {};

    for (const review of reviews) {
        // Count by state
        switch (review.reviewState) {
            case "APPROVED":
                byState.approved++;
                break;
            case "CHANGES_REQUESTED":
                byState.changesRequested++;
                break;
            case "COMMENTED":
                byState.commented++;
                break;
            case "DISMISSED":
                byState.dismissed++;
                break;
        }

        // Count by month
        const month = moment(review.reviewedAt).format("YYYY-MM");
        byMonth[month] = (byMonth[month] || 0) + 1;

        // Count by author
        authorCounts[review.prAuthor] = (authorCounts[review.prAuthor] || 0) + 1;

        // Count by repo
        repoCounts[review.repository] = (repoCounts[review.repository] || 0) + 1;
    }

    // Sort and get top authors
    const topAuthorsReviewed = Object.entries(authorCounts)
        .map(([author, count]) => ({ author, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // Sort and get top repositories
    const topRepositories = Object.entries(repoCounts)
        .map(([repo, count]) => ({ repo, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return {
        totalReviews: reviews.length,
        uniquePRsReviewed: uniquePRs.size,
        uniqueAuthorsReviewed: uniqueAuthors.size,
        byState,
        byMonth,
        topAuthorsReviewed,
        topRepositories
    };
}

function printReport(stats: YearlyReviewStats): void {
    console.log("\n" + "=".repeat(80));
    console.log(`PR Review Stats for ${stats.ldap} (@${stats.githubUsername}) - Calendar Year ${stats.year}`);
    console.log("=".repeat(80));

    console.log(`\nSUMMARY`);
    console.log("-".repeat(40));
    console.log(`Total Reviews Given:      ${stats.summary.totalReviews}`);
    console.log(`Unique PRs Reviewed:      ${stats.summary.uniquePRsReviewed}`);
    console.log(`Unique Authors Reviewed:  ${stats.summary.uniqueAuthorsReviewed}`);

    console.log(`\nBY REVIEW TYPE`);
    console.log("-".repeat(40));
    console.log(`Approved:          ${stats.summary.byState.approved}`);
    console.log(`Changes Requested: ${stats.summary.byState.changesRequested}`);
    console.log(`Commented:         ${stats.summary.byState.commented}`);
    console.log(`Dismissed:         ${stats.summary.byState.dismissed}`);

    // Monthly trend chart with trend analysis
    printMonthlyTrendChart(stats.summary.byMonth, stats.year, "Reviews");

    // Quarterly comparison
    printQuarterlyComparison(stats.summary.byMonth, stats.year, "Reviews");

    console.log(`\nTOP AUTHORS REVIEWED`);
    console.log("-".repeat(40));
    for (const { author, count } of stats.summary.topAuthorsReviewed) {
        console.log(`   @${author}: ${count} reviews`);
    }

    console.log(`\nTOP REPOSITORIES`);
    console.log("-".repeat(40));
    for (const { repo, count } of stats.summary.topRepositories) {
        console.log(`   ${repo}: ${count} reviews`);
    }

    console.log(`\nREVIEW DETAILS`);
    console.log("-".repeat(40));

    // Group reviews by state
    const reviewsByState: Record<string, ReviewStats[]> = {
        APPROVED: [],
        CHANGES_REQUESTED: [],
        COMMENTED: [],
        DISMISSED: []
    };

    for (const review of stats.reviews) {
        if (reviewsByState[review.reviewState]) {
            reviewsByState[review.reviewState].push(review);
        }
    }

    const stateInfo = [
        { key: "APPROVED", label: "Approved" },
        { key: "CHANGES_REQUESTED", label: "Changes Requested" },
        { key: "COMMENTED", label: "Commented" },
        { key: "DISMISSED", label: "Dismissed" }
    ];

    for (const { key, label } of stateInfo) {
        const stateReviews = reviewsByState[key];
        if (stateReviews.length === 0) continue;

        console.log(`\n${label} (${stateReviews.length} reviews):`);

        // Sort by date
        stateReviews.sort((a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime());

        for (const review of stateReviews) {
            const date = moment(review.reviewedAt).format("YYYY-MM-DD");
            console.log(`   - [${date}] ${review.repository}#${review.prNumber}: ${review.prTitle}`);
            console.log(`     Author: @${review.prAuthor}`);
            console.log(`     ${review.reviewUrl}`);
        }
    }
}

async function main() {
    const { ldap, year } = parseCliArgs("ldap-yearly-review-stats");

    try {
        const githubUsername = await resolveGithubUsername(ldap);
        const reviews = await fetchReviewsForUser(githubUsername, year);
        console.log(`Found ${reviews.length} reviews`);

        const stats: YearlyReviewStats = {
            ldap,
            githubUsername,
            year,
            reviews,
            summary: generateSummary(reviews)
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

export { YearlyReviewStats, ReviewStats, fetchReviewsForUser, generateSummary };
