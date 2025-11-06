import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import * as moment from "moment-business-time";
import { getPrListQ, getAuthorQ, getCreatedFilter } from "./list-prs";
import { getGithubToLdapMap } from "./gh-ldap-map";
import { getPrReviewerInfo } from "./get-reviewer-data";
import { workingHours, holidays } from "./working-hours";
import { getPrRocketComments, RocketComments } from "./get-reaction-rockets";
import { getDaysToLookBack, getSloHours } from "./utils";
import { isBot } from "./bot-filter";

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

async function main() {
    const args = process.argv.slice(2);
    const formatAsReport = args.includes('--format=report');
 
    const ghUsernameToLdap = await getGithubToLdapMap();
    const qs = [
        getAuthorQ(Object.keys(ghUsernameToLdap)),
        getCreatedFilter(moment().subtract(getDaysToLookBack(), "d"), moment())
    ];
    const recentPrs = await getPrListQ(credentials, qs);

    const prReviewerInfo = [];
    let rocketComments: Array<RocketComments> = [];
    for (const pr of recentPrs) {
        const number = pr.number;
        const repository = pr.repository_url.split("/").at(-1);
        const githubUsername = pr.user.login;
        const createdAt = moment(pr.created_at);
        const parsedData = await getPrReviewerInfo(repository, number, createdAt, githubUsername);
        prReviewerInfo.push(parsedData);
        const prRocketComments = await getPrRocketComments(repository, number);
        // Filter out rocket comments from bots
        const humanRocketComments = prRocketComments.filter(comment => !isBot(comment.ghUsername as string));
        rocketComments = rocketComments.concat(humanRocketComments);
    }

    const prsOutOfSlo = getPrsOutOfSlo(prReviewerInfo);
    const reviewerLeaderboard = getReviewerLeaderboard(prReviewerInfo);
    const pointsLeaderboard = getTotalPointsLeaderboard(prReviewerInfo);
    const throughputStats = calculatePrThroughput(prReviewerInfo);

    if (formatAsReport) {
        generateFormattedReport(prsOutOfSlo, prReviewerInfo, reviewerLeaderboard, pointsLeaderboard, rocketComments, ghUsernameToLdap, throughputStats);
    } else {
        // Original output format
        console.log("out of SLO", prsOutOfSlo.length);
        console.log(prsOutOfSlo.map(pr => `${pr.repository}+${pr.pr_number}`))
        console.log("all", prReviewerInfo.length);
        console.log(reviewerLeaderboard);
        console.log(pointsLeaderboard);
        console.log(rocketComments);
    }
}

function getPrsOutOfSlo(prs: Array<any>) {
    return prs.filter(pr => {
        return !(pr.reviewers as Array<any>).some(review => review.is_within_slo);
    })
}

function getReviewerLeaderboard(prs: Array<any>) {
    const reviewsByUser = prs.reduce((accum, iter) => {
        const reviewers = iter.reviewers;
        if (!reviewers) return accum;
        for (const reviewer of reviewers) {
            // Skip bot accounts
            if (isBot(reviewer.user)) continue;

            if (!accum[reviewer.user]) {
                accum[reviewer.user] = 0;
            }
            accum[reviewer.user]++;
        }
        return accum;
    }, {});
    return Object.keys(reviewsByUser).map(user => {
        return {
            user,
            reviews: reviewsByUser[user]
        }
    }).sort((a, b) => b.reviews - a.reviews);
}

function getTotalPointsLeaderboard(prs: Array<any>) {
    const pointsByUser = prs.reduce((accum, iter) => {
        // Skip bot authors
        if (!isBot(iter.author)) {
            if (!accum[iter.author]) {
                accum[iter.author] = 0;
            }
            accum[iter.author]++;
        }

        const reviewers = iter.reviewers;
        if (!reviewers) return accum;
        for (const reviewer of reviewers) {
            // Skip bot reviewers
            if (isBot(reviewer.user)) continue;

            if (!accum[reviewer.user]) {
                accum[reviewer.user] = 0;
            }
            accum[reviewer.user]++;
        }
        return accum;
    }, {});
    return Object.keys(pointsByUser).map(user => {
        return {
            user,
            points: pointsByUser[user]
        }
    }).sort((a, b) => b.points - a.points);
}

function calculatePrThroughput(prs: Array<any>) {
    // Group PRs by author and week
    const prsByAuthorByWeek = prs.reduce((accum, pr) => {
        const author = pr.author;
        const createdAt = moment(pr.created_at);
        // Get the week number and year (e.g., "2023-W42")
        const weekKey = createdAt.format('YYYY-[W]WW');
        
        if (!accum[author]) {
            accum[author] = {};
        }
        if (!accum[author][weekKey]) {
            accum[author][weekKey] = 0;
        }
        accum[author][weekKey]++;
        return accum;
    }, {} as Record<string, Record<string, number>>);
    
    // Calculate statistics for each author
    const throughputStats = Object.entries(prsByAuthorByWeek).map(([author, weekData]) => {
        const totalPRs = Object.values(weekData).reduce((sum, count) => sum + count, 0);
        const weeksCount = Object.keys(weekData).length;
        const avgPRsPerWeek = weeksCount > 0 ? (totalPRs / weeksCount) : 0;
        
        return {
            author,
            totalPRs,
            weeksWithActivity: weeksCount,
            avgPRsPerWeek: parseFloat(avgPRsPerWeek.toFixed(1)),  // Round to 1 decimal place
            weeklyBreakdown: weekData
        };
    });
    
    // Sort by average PRs per week (highest first)
    return throughputStats.sort((a, b) => b.avgPRsPerWeek - a.avgPRsPerWeek);
}

function generateFormattedReport(
    prsOutOfSlo: Array<any>, 
    allPrs: Array<any>, 
    reviewerLeaderboard: Array<any>, 
    pointsLeaderboard: Array<any>, 
    rocketComments: Array<RocketComments>,
    ghUsernameToLdap: Record<string, string>,
    throughputStats: Array<any>
) {
    const sloHours = getSloHours();
    const totalPrs = allPrs.length;
    const prsWithinSlo = totalPrs - prsOutOfSlo.length;
    const sloPercentage = totalPrs > 0 ? Math.round((prsWithinSlo / totalPrs) * 100) : 0;

    // Convert GitHub usernames to LDAP where possible
    const convertToLdap = (githubUsername: string): string => {
        return ghUsernameToLdap[githubUsername] || githubUsername;
    };

    console.log(`:robot_face: **beep boop here are your end-of-sprint PR review stats!** :robot_face:

${sloPercentage === 100 
    ? `:fire: **${prsWithinSlo}/${totalPrs} (${sloPercentage}%) PRs were reviewed within SLO, perfect score!** :tada: :clap:`
    : `:fire: **${prsWithinSlo}/${totalPrs} (${sloPercentage}%) PRs were reviewed within SLO, ${sloPercentage >= 80 ? 'good work!' : 'needs improvement'}** ${sloPercentage >= 80 ? ':clap:' : ':warning:'}`
}

## Top Reviewers by Review Count`);

    // Top 3 reviewers with LDAP conversion
    const topReviewers = reviewerLeaderboard.slice(0, 3);
    const medals = [':first_place_medal:', ':second_place_medal:', ':third_place_medal:'];
    
    topReviewers.forEach((reviewer, index) => {
        const ldapName = convertToLdap(reviewer.user);
        const medal = medals[index];
        const fire = index === 0 ? ' :fire:' : '';
        console.log(`${medal} **@${ldapName}** with **${reviewer.reviews} reviews**${fire}`);
    });

    console.log(`
## Top Contributors by Points`);

    // Top contributors with points breakdown
    const topContributors = pointsLeaderboard.slice(0, 3);
    topContributors.forEach((contributor, index) => {
        const ldapName = convertToLdap(contributor.user);
        const medal = medals[index];
        
        // Calculate authored vs reviewed breakdown
        const authoredPrs = allPrs.filter(pr => pr.author === contributor.user).length;
        const reviewedPrs = contributor.points - authoredPrs;
        
        console.log(`${medal} **@${ldapName}** with **${contributor.points} points** (${authoredPrs} PRs authored + ${reviewedPrs} PRs reviewed)`);
    });

    console.log(`
**How Points Work:** Each person gets +1 point for every PR they author and +1 point for every PR they review. This measures total participation in the code review process - both contributing code and helping teammates by reviewing their work.

## PRs Past SLO`);

    if (prsOutOfSlo.length === 0) {
        console.log(`:green_heart: **No PRs past SLO - amazing work team!** All ${totalPrs} PRs were reviewed within the ${sloHours}-hour SLO.`);
    } else {
        console.log(`The following ${prsOutOfSlo.length} PRs need attention:`);
        prsOutOfSlo.forEach(pr => {
            const url = `https://github.com/squareup/${pr.repository}/pull/${pr.pr_number}`;
            console.log(`- [${pr.repository}+${pr.pr_number}](${url})`);
        });
    }

    console.log(`
:rocket: **ROCKET WATCH** :rocket:`);
    
    if (rocketComments.length === 0) {
        console.log(`_No rocket reactions found this sprint - remember to react to great PR review comments with :rocket: to highlight them in future reports!_`);
    } else {
        rocketComments.forEach(comment => {
            const ldapName = convertToLdap(comment.ghUsername as string);
            console.log(`@${ldapName} ${comment.body}`);
        });
        console.log(`Shoutout to the contributors for highlighting these! React to PR review comments with :rocket: to highlight them in these reviews!`);
    }

    console.log(`
---

${sloPercentage === 100 
    ? `**Outstanding performance this period with 100% SLO compliance!** Every PR received its first review within ${sloHours} working hours. Keep up the excellent review velocity! :muscle:`
    : `**${sloPercentage >= 80 ? 'Great' : 'Keep working on'} performance this period!** ${prsWithinSlo} out of ${totalPrs} PRs were reviewed within the ${sloHours}-hour SLO.`
}`);

    // PR Throughput section
    console.log(`
## Team PR Throughput`);    

    if (throughputStats.length > 0) {        
        // Calculate team statistics
        const teamTotalPRs = throughputStats.reduce((sum, dev) => sum + dev.totalPRs, 0);
        // Get number of active contributors
        const activeContributors = throughputStats.length;
        const prPerDeveloper = parseFloat((teamTotalPRs / activeContributors).toFixed(1));
        
        console.log(`**${prPerDeveloper} PRs per developer** (${teamTotalPRs} total PRs / ${activeContributors} developers)`);
        console.log(`**${teamTotalPRs} total PRs merged** in the last ${getDaysToLookBack()} days`);
        console.log(`**${activeContributors} active contributors** creating PRs`);    
    } else {
        console.log(`No merged PR data available for throughput calculation.`);
    }

    // Note about unmapped usernames
    const unmappedUsers = [...reviewerLeaderboard, ...pointsLeaderboard, ...throughputStats.map(item => item.author)]
        .map(item => typeof item === 'string' ? item : item.user || item.author)
        .filter((user, index, arr) => arr.indexOf(user) === index) // unique
        .filter(user => !ghUsernameToLdap[user]);
    
    if (unmappedUsers.length > 0) {
        console.log(`
*Note: Some GitHub usernames (${unmappedUsers.join(', ')}) don't have LDAP mappings in the CSV and may appear with their GitHub usernames.*`);
    }
}

main();