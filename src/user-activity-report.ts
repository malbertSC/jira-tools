import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import axios from "axios";
import { credentials } from "./credentials";
import { getDaysToLookBack, initializeMoment, moment } from "./utils";

initializeMoment();

interface UserActivity {
    username: string;
    prApprovals: Array<{
        repository: string;
        prNumber: number;
        prTitle: string;
        approvedAt: string;
        prUrl: string;
    }>;
    comments: Array<{
        repository: string;
        prNumber: number;
        prTitle: string;
        commentBody: string;
        commentedAt: string;
        commentUrl: string;
    }>;
    authoredPRs: Array<{
        repository: string;
        prNumber: number;
        prTitle: string;
        createdAt: string;
        prUrl: string;
        state: string;
    }>;
    totalApprovals: number;
    totalComments: number;
    totalAuthoredPRs: number;
}

async function getUserActivity(username: string, daysBack: number = getDaysToLookBack()): Promise<UserActivity> {
    const sinceDate = moment().subtract(daysBack, "d").toISOString();
    
    const activity: UserActivity = {
        username,
        prApprovals: [],
        comments: [],
        authoredPRs: [],
        totalApprovals: 0,
        totalComments: 0,
        totalAuthoredPRs: 0
    };

    try {
        console.log(`Searching for activity by @${username} in the last ${daysBack} days...`);

        // First, get all PRs from the last N days
        const allPRsQuery = `
        query {
            search(query: "created:>${moment().subtract(daysBack, "d").format("YYYY-MM-DD")} is:pr org:squareup repo:!zzz-archive-java draft:false", type: ISSUE, first: 100) {
                nodes {
                    ... on PullRequest {
                        number
                        title
                        url
                        createdAt
                        state
                        author {
                            login
                        }
                        repository {
                            name
                            owner {
                                login
                            }
                        }
                        reviews(first: 50) {
                            nodes {
                                author {
                                    login
                                }
                                state
                                submittedAt
                                comments(first: 10) {
                                    nodes {
                                        author {
                                            login
                                        }
                                        body
                                        createdAt
                                        url
                                    }
                                }
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

        const allPRsResponse = await axios.post(
            "https://api.github.com/graphql",
            { query: allPRsQuery },
            credentials
        );

        if (allPRsResponse.data.errors) {
            console.error("GraphQL Errors:", allPRsResponse.data.errors);
            throw new Error(`GraphQL errors: ${allPRsResponse.data.errors.map(e => e.message).join(', ')}`);
        }

        console.log("✅ All PRs search successful");
        const allPRs = allPRsResponse.data.data.search.nodes;
        console.log(`Found ${allPRs.length} PRs to analyze for ${username}'s activity`);
        
        // Also try to find PRs that have been reviewed by the user
        const reviewedPRsQuery = `
        query {
            search(query: "reviewed-by:${username} created:>${moment().subtract(daysBack, "d").format("YYYY-MM-DD")} is:pr org:squareup repo:!zzz-archive-java draft:false", type: ISSUE, first: 100) {
                nodes {
                    ... on PullRequest {
                        number
                        title
                        url
                        createdAt
                        state
                        author {
                            login
                        }
                        repository {
                            name
                            owner {
                                login
                            }
                        }
                        reviews(first: 50) {
                            nodes {
                                author {
                                    login
                                }
                                state
                                submittedAt
                                comments(first: 10) {
                                    nodes {
                                        author {
                                            login
                                        }
                                        body
                                        createdAt
                                        url
                                    }
                                }
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

        const reviewedPRsResponse = await axios.post(
            "https://api.github.com/graphql",
            { query: reviewedPRsQuery },
            credentials
        );

        if (reviewedPRsResponse.data.errors) {
            console.error("GraphQL Errors (reviewed search):", reviewedPRsResponse.data.errors);
        } else {
            console.log("✅ Reviewed PRs search successful");
            const reviewedPRs = reviewedPRsResponse.data.data.search.nodes;
            console.log(`Found ${reviewedPRs.length} PRs reviewed by ${username}`);
            
            // Add reviewed PRs to the analysis
            allPRs.push(...reviewedPRs);
        }
        
        for (const result of allPRs) {
            if (result && result.repository) {
                const repoName = result.repository.name;
                const owner = result.repository.owner.login;
                
                // Check for authored PRs
                if (result.author && result.author.login === username) {
                    const createdAt = moment(result.createdAt);
                    if (createdAt.isAfter(moment().subtract(daysBack, "d"))) {
                        activity.authoredPRs.push({
                            repository: repoName,
                            prNumber: result.number,
                            prTitle: result.title,
                            createdAt: result.createdAt,
                            prUrl: result.url,
                            state: result.state
                        });
                    }
                }
                
                // Check for reviews by the user
                for (const review of result.reviews.nodes) {
                    if (review.author && review.author.login === username) {
                        const submittedAt = moment(review.submittedAt);
                        if (submittedAt.isAfter(moment().subtract(daysBack, "d"))) {
                            if (review.state === "APPROVED") {
                                activity.prApprovals.push({
                                    repository: repoName,
                                    prNumber: result.number,
                                    prTitle: result.title,
                                    approvedAt: review.submittedAt,
                                    prUrl: result.url
                                });
                            }
                            
                            // Get comments from this review
                            for (const comment of review.comments.nodes) {
                                if (comment.author && comment.author.login === username) {
                                    const commentedAt = moment(comment.createdAt);
                                    if (commentedAt.isAfter(moment().subtract(daysBack, "d"))) {
                                        activity.comments.push({
                                            repository: repoName,
                                            prNumber: result.number,
                                            prTitle: result.title,
                                            commentBody: comment.body,
                                            commentedAt: comment.createdAt,
                                            commentUrl: comment.url
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        activity.totalApprovals = activity.prApprovals.length;
        activity.totalComments = activity.comments.length;
        activity.totalAuthoredPRs = activity.authoredPRs.length;

        return activity;

    } catch (error) {
        console.error("Error fetching user activity:", error);
        throw error;
    }
}

async function main() {
    const username = process.argv[2];
    
    if (!username) {
        console.error("Please provide a GitHub username as an argument");
        console.error("Usage: npm run user-activity <username>");
        process.exit(1);
    }

    const daysToLookBack = getDaysToLookBack();

    try {
        console.log(`\n📊 Activity Report for @${username} (Last ${daysToLookBack} days)\n`);
        console.log("=" .repeat(60));
        
        const activity = await getUserActivity(username, daysToLookBack);
        
        console.log(`\n✅ PR Approvals (${activity.totalApprovals}):`);
        if (activity.prApprovals.length === 0) {
            console.log(`   No PR approvals in the last ${daysToLookBack} days`);
        } else {
            activity.prApprovals.forEach((approval, index) => {
                console.log(`   ${index + 1}. ${approval.repository}#${approval.prNumber}: ${approval.prTitle}`);
                console.log(`      Approved: ${moment(approval.approvedAt).format('YYYY-MM-DD HH:mm')}`);
                console.log(`      URL: ${approval.prUrl}`);
                console.log("");
            });
        }

        console.log(`\n💬 Comments (${activity.totalComments}):`);
        if (activity.comments.length === 0) {
            console.log(`   No comments in the last ${daysToLookBack} days`);
        } else {
            activity.comments.forEach((comment, index) => {
                console.log(`   ${index + 1}. ${comment.repository}#${comment.prNumber}: ${comment.prTitle}`);
                console.log(`      Comment: ${comment.commentBody.substring(0, 100)}${comment.commentBody.length > 100 ? '...' : ''}`);
                console.log(`      Posted: ${moment(comment.commentedAt).format('YYYY-MM-DD HH:mm')}`);
                console.log(`      URL: ${comment.commentUrl}`);
                console.log("");
            });
        }

        console.log(`\n📝 Authored PRs (${activity.totalAuthoredPRs}):`);
        if (activity.authoredPRs.length === 0) {
            console.log(`   No PRs authored in the last ${daysToLookBack} days`);
        } else {
            activity.authoredPRs.forEach((pr, index) => {
                console.log(`   ${index + 1}. ${pr.repository}#${pr.prNumber}: ${pr.prTitle}`);
                console.log(`      State: ${pr.state.toUpperCase()}`);
                console.log(`      Created: ${moment(pr.createdAt).format('YYYY-MM-DD HH:mm')}`);
                console.log(`      URL: ${pr.prUrl}`);
                console.log("");
            });
        }

        console.log(`\n📈 Summary:`);
        console.log(`   Total PR Approvals: ${activity.totalApprovals}`);
        console.log(`   Total Comments: ${activity.totalComments}`);
        console.log(`   Total Authored PRs: ${activity.totalAuthoredPRs}`);
        console.log(`   Total Activity: ${activity.totalApprovals + activity.totalComments + activity.totalAuthoredPRs}`);

    } catch (error) {
        console.error("Failed to fetch user activity:", error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export { getUserActivity, UserActivity }; 