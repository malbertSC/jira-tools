import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import * as moment from "moment-business-time";
import { getPrListQ, getCreatedFilter } from "./list-prs";
import { getGithubToLdapMap } from "./gh-ldap-map";
import { getPrReviewerInfo } from "./get-reviewer-data";
import { workingHours, holidays } from "./working-hours";
import { getDaysToLookBack } from "./utils";

const credentials = {
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json"
    },
    auth: {
        username: process.env.GITHUB_USERNAME ?? "",
        password: process.env.GITHUB_PAT ?? ""
    }
}

moment.updateLocale('en', {
    workinghours: workingHours,
    holidays
});

interface PRAnalytics {
    totalPRs: number;
    internalPRs: number;
    externalPRs: number;
    internalAvgApprovalHours: number;
    externalAvgApprovalHours: number;
    externalPRsList: Array<{
        author: string;
        prNumber: string;
        repository: string;
        url: string;
        createdAt: string;
        approvalHours: number | null;
    }>;
    internalPRsList: Array<{
        author: string;
        prNumber: string;
        repository: string;
        url: string;
        createdAt: string;
        approvalHours: number | null;
    }>;
}

async function main() {
    const label = process.argv[2] || "esperanto";
    const daysToLookBack = parseInt(process.argv[3]) || getDaysToLookBack();

    console.log(`\n📊 Analyzing PRs with label: "${label}" over the last ${daysToLookBack} days\n`);

    const ghUsernameToLdap = await getGithubToLdapMap();
    const internalUsers = new Set(Object.keys(ghUsernameToLdap));

    // Get all PRs with the label (not just from internal users)
    const qs = [
        getCreatedFilter(moment().subtract(daysToLookBack, "d"), moment()),
        `label:${label}`
    ];
    const recentPrs = await getPrListQ(credentials, qs);

    console.log(`Found ${recentPrs.length} PRs with label "${label}"\n`);

    const analytics: PRAnalytics = {
        totalPRs: recentPrs.length,
        internalPRs: 0,
        externalPRs: 0,
        internalAvgApprovalHours: 0,
        externalAvgApprovalHours: 0,
        externalPRsList: [],
        internalPRsList: []
    };

    let internalTotalHours = 0;
    let externalTotalHours = 0;
    let internalPRsWithApproval = 0;
    let externalPRsWithApproval = 0;

    for (const pr of recentPrs) {
        const number = pr.number;
        const repository = pr.repository_url.split("/").at(-1);
        const githubUsername = pr.user.login;
        const createdAt = moment(pr.created_at);
        const isInternal = internalUsers.has(githubUsername);

        // Get reviewer info to calculate approval time
        const parsedData = await getPrReviewerInfo(repository, number, createdAt, githubUsername);

        // Calculate time to first approval
        let approvalHours: number | null = null;
        if (parsedData.reviewers && parsedData.reviewers.length > 0) {
            // Find the earliest approval time
            const reviewerData = await getDetailedReviewerData(repository, number);
            if (reviewerData.firstApprovalTime) {
                const diffMs = moment(reviewerData.firstApprovalTime).diff(createdAt);
                approvalHours = diffMs / 1000 / 60 / 60; // Convert to hours
            }
        }

        const prInfo = {
            author: githubUsername,
            prNumber: number,
            repository: repository || "unknown",
            url: `https://github.com/squareup/${repository}/pull/${number}`,
            createdAt: createdAt.format("YYYY-MM-DD HH:mm"),
            approvalHours
        };

        if (isInternal) {
            analytics.internalPRs++;
            analytics.internalPRsList.push(prInfo);
            if (approvalHours !== null) {
                internalTotalHours += approvalHours;
                internalPRsWithApproval++;
            }
        } else {
            analytics.externalPRs++;
            analytics.externalPRsList.push(prInfo);
            if (approvalHours !== null) {
                externalTotalHours += approvalHours;
                externalPRsWithApproval++;
            }
        }
    }

    // Calculate averages
    analytics.internalAvgApprovalHours = internalPRsWithApproval > 0
        ? internalTotalHours / internalPRsWithApproval
        : 0;
    analytics.externalAvgApprovalHours = externalPRsWithApproval > 0
        ? externalTotalHours / externalPRsWithApproval
        : 0;

    // Print summary
    printSummary(analytics, label, daysToLookBack);

    // Print detailed lists if requested
    if (process.argv.includes("--detailed")) {
        printDetailedList(analytics);
    }
}

async function getDetailedReviewerData(repository: string, prNumber: string): Promise<{ firstApprovalTime: string | null }> {
    const axios = require("axios");

    try {
        const url = `https://api.github.com/repos/squareup/${repository}/pulls/${prNumber}/reviews`;
        const { data } = await axios.get(url, credentials);

        // Find first approval
        const approvals = data.filter((review: any) => review.state === "APPROVED");
        if (approvals.length > 0) {
            const sortedApprovals = approvals.sort((a: any, b: any) =>
                new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
            );
            return { firstApprovalTime: sortedApprovals[0].submitted_at };
        }
    } catch (error) {
        console.error(`Error fetching review data for ${repository}#${prNumber}:`, error.message);
    }

    return { firstApprovalTime: null };
}

function printSummary(analytics: PRAnalytics, label: string, days: number) {
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`📈 SUMMARY REPORT: "${label}" label (last ${days} days)`);
    console.log("═══════════════════════════════════════════════════════════\n");

    console.log(`Total PRs: ${analytics.totalPRs}`);
    console.log(`├─ Internal PRs: ${analytics.internalPRs} (${((analytics.internalPRs / analytics.totalPRs) * 100).toFixed(1)}%)`);
    console.log(`└─ External PRs: ${analytics.externalPRs} (${((analytics.externalPRs / analytics.totalPRs) * 100).toFixed(1)}%)\n`);

    const internalPRsWithApproval = analytics.internalPRsList.filter(pr => pr.approvalHours !== null).length;
    const externalPRsWithApproval = analytics.externalPRsList.filter(pr => pr.approvalHours !== null).length;

    console.log("⏱️  Average Time to First Approval:");
    console.log(`├─ Internal: ${analytics.internalAvgApprovalHours.toFixed(2)} hours (${internalPRsWithApproval} PRs approved)`);
    console.log(`└─ External: ${analytics.externalAvgApprovalHours.toFixed(2)} hours (${externalPRsWithApproval} PRs approved)\n`);

    if (analytics.externalAvgApprovalHours > 0 && analytics.internalAvgApprovalHours > 0) {
        const diff = analytics.externalAvgApprovalHours - analytics.internalAvgApprovalHours;
        const pctDiff = ((diff / analytics.internalAvgApprovalHours) * 100).toFixed(1);
        if (diff > 0) {
            console.log(`📊 External PRs take ${diff.toFixed(2)} hours longer (${pctDiff}% slower)\n`);
        } else {
            console.log(`📊 External PRs are ${Math.abs(diff).toFixed(2)} hours faster (${Math.abs(parseFloat(pctDiff))}% faster)\n`);
        }
    }

    console.log("═══════════════════════════════════════════════════════════\n");
    console.log("💡 Run with --detailed flag to see complete PR lists\n");
}

function printDetailedList(analytics: PRAnalytics) {
    console.log("\n🔍 DETAILED EXTERNAL PR LIST:");
    console.log("═══════════════════════════════════════════════════════════");

    if (analytics.externalPRsList.length === 0) {
        console.log("No external PRs found.\n");
    } else {
        analytics.externalPRsList.forEach(pr => {
            console.log(`\n${pr.author} - ${pr.repository}#${pr.prNumber}`);
            console.log(`  URL: ${pr.url}`);
            console.log(`  Created: ${pr.createdAt}`);
            console.log(`  Time to approval: ${pr.approvalHours !== null ? pr.approvalHours.toFixed(2) + ' hours' : 'Not yet approved'}`);
        });
    }

    console.log("\n\n🔍 DETAILED INTERNAL PR LIST:");
    console.log("═══════════════════════════════════════════════════════════");

    if (analytics.internalPRsList.length === 0) {
        console.log("No internal PRs found.\n");
    } else {
        analytics.internalPRsList.forEach(pr => {
            console.log(`\n${pr.author} - ${pr.repository}#${pr.prNumber}`);
            console.log(`  URL: ${pr.url}`);
            console.log(`  Created: ${pr.createdAt}`);
            console.log(`  Time to approval: ${pr.approvalHours !== null ? pr.approvalHours.toFixed(2) + ' hours' : 'Not yet approved'}`);
        });
    }

    console.log("\n");
}

main().catch(err => {
    console.error("Error running analytics:", err);
    process.exit(1);
});
