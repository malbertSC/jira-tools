import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import * as moment from "moment-business-time";
import { getPrListQ, getAuthorQ, getCreatedFilter } from "../list-prs";
import { getGithubToLdapMap } from "../gh-ldap-map";
import { getPrReviewerInfo } from "../get-reviewer-data";
import { workingHours, holidays } from "../working-hours";
import { getPrRocketComments, RocketComments } from "../get-reaction-rockets";
import { getDaysToLookBack } from "../utils";
import { credentials } from "../credentials";
import { isBot } from "../bot-filter";
import { buildReport, ReportData } from "./builder";
import { renderMarkdown } from "./markdown-renderer";
import { renderSlackBlocks } from "./slack-renderer";
import { postToSlack } from "./slack-client";

moment.updateLocale('en', {
    workinghours: workingHours,
    holidays
});

interface CliArgs {
    formatAsReport: boolean;
    postToSlack: boolean;
    slackChannel: string | null;
}

function parseArgs(args: string[]): CliArgs {
    const formatAsReport = args.includes('--format=report');
    const postToSlack = args.includes('--slack');

    let slackChannel: string | null = null;
    const channelArgIndex = args.findIndex(arg => arg.startsWith('--channel'));
    if (channelArgIndex !== -1) {
        const channelArg = args[channelArgIndex];
        if (channelArg.includes('=')) {
            slackChannel = channelArg.split('=')[1];
        } else if (args[channelArgIndex + 1]) {
            slackChannel = args[channelArgIndex + 1];
        }
    }

    if (!slackChannel && process.env.SLACK_CHANNEL) {
        slackChannel = process.env.SLACK_CHANNEL;
    }

    return { formatAsReport, postToSlack, slackChannel };
}

async function main() {
    const args = process.argv.slice(2);
    const cliArgs = parseArgs(args);

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
        const prState = pr.state;
        const mergedAt = pr.pull_request?.merged_at || null;
        const parsedData = await getPrReviewerInfo(repository, number, createdAt, githubUsername, prState, mergedAt);
        prReviewerInfo.push(parsedData);
        const prRocketComments = await getPrRocketComments(repository, number);
        const humanRocketComments = prRocketComments.filter(comment => !isBot(comment.ghUsername as string));
        rocketComments = rocketComments.concat(humanRocketComments);
    }

    const prsOutOfSlo = getPrsOutOfSlo(prReviewerInfo);
    const reviewerLeaderboard = getReviewerLeaderboard(prReviewerInfo);
    const pointsLeaderboard = getTotalPointsLeaderboard(prReviewerInfo);
    const throughputStats = calculatePrThroughput(prReviewerInfo);

    if (cliArgs.formatAsReport) {
        const reportData: ReportData = {
            prsOutOfSlo,
            allPrs: prReviewerInfo,
            reviewerLeaderboard,
            pointsLeaderboard,
            rocketComments,
            ghUsernameToLdap,
            throughputStats: throughputStats as ReportData['throughputStats']
        };

        const report = buildReport(reportData);

        if (cliArgs.postToSlack) {
            if (!cliArgs.slackChannel) {
                console.error('Error: No Slack channel specified.');
                console.error('Use --channel=#channel-name or set SLACK_CHANNEL in your .env file.');
                process.exit(1);
            }

            const slackBlocks = renderSlackBlocks(report);
            await postToSlack(slackBlocks, cliArgs.slackChannel);
        } else {
            const markdown = renderMarkdown(report);
            console.log(markdown);
        }
    } else {
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
        if (!isBot(iter.author)) {
            if (!accum[iter.author]) {
                accum[iter.author] = 0;
            }
            accum[iter.author]++;
        }

        const reviewers = iter.reviewers;
        if (!reviewers) return accum;
        for (const reviewer of reviewers) {
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
    const prsByAuthorByWeek = prs.reduce((accum, pr) => {
        const author = pr.author;
        const createdAt = moment(pr.created_at);
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

    const throughputStats = Object.entries(prsByAuthorByWeek).map(([author, weekData]) => {
        const totalPRs = Object.values(weekData).reduce((sum, count) => sum + count, 0);
        const weeksCount = Object.keys(weekData).length;
        const avgPRsPerWeek = weeksCount > 0 ? (totalPRs / weeksCount) : 0;

        return {
            author,
            totalPRs,
            weeksWithActivity: weeksCount,
            avgPRsPerWeek: parseFloat(avgPRsPerWeek.toFixed(1)),
            weeklyBreakdown: weekData
        };
    });

    return throughputStats.sort((a, b) => b.avgPRsPerWeek - a.avgPRsPerWeek);
}

main();
