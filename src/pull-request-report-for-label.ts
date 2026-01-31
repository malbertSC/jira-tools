import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import * as moment from "moment-business-time";
import { getPrListQ, getAuthorQ, getCreatedFilter } from "./list-prs";
import { getGithubToLdapMap } from "./gh-ldap-map";
import { getPrReviewerInfo } from "./get-reviewer-data";
import { workingHours, holidays } from "./working-hours";
import { getPrRocketComments, RocketComments } from "./get-reaction-rockets";
import { getDaysToLookBack } from "./utils";
import { credentials } from "./credentials";
moment.updateLocale('en', {
    workinghours: workingHours,
    holidays
});

async function main() {
    const label = process.argv[2];
    if (!label) {
        console.error("Usage: node pull-request-report-for-label.ts <label>");
        process.exit(1);
    }
    const ghUsernameToLdap = await getGithubToLdapMap();
    const qs = [
        getAuthorQ(Object.keys(ghUsernameToLdap)),
        getCreatedFilter(moment().subtract(getDaysToLookBack(), "d"), moment()),
        `label:${label}`
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
        rocketComments = rocketComments.concat(prRocketComments); 
    }

    const prsOutOfSlo = getPrsOutOfSlo(prReviewerInfo);
    console.log("out of SLO", prsOutOfSlo.length);
    console.log(prsOutOfSlo.map(pr => `https://github.com/squareup/${pr.repository}/pull/${pr.pr_number}`))
    console.log("all", prReviewerInfo.length);
    console.log(getReviewerLeaderboard(prReviewerInfo));
    console.log(getTotalPointsLeaderboard(prReviewerInfo));
    console.log(rocketComments);
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
// In this context, "reviews" refers to the number of times a user has acted as a reviewer on pull requests (PRs)—that is, how many PRs they have reviewed.
// "Points" refers to the total number of PRs a user has participated in, either as an author (creator) or as a reviewer. 
// In the getTotalPointsLeaderboard function, each PR author and each reviewer receives one point per PR they are involved with.
// Therefore, the "reviews" leaderboard shows who has reviewed the most PRs, while the "points" leaderboard shows overall participation (as author or reviewer) in PRs.


function getTotalPointsLeaderboard(prs: Array<any>) {
    const pointsByUser = prs.reduce((accum, iter) => {
        if (!accum[iter.author]) {
            accum[iter.author] = 0;
        }
        accum[iter.author]++;
        const reviewers = iter.reviewers;
        if (!reviewers) return accum;
        for (const reviewer of reviewers) {
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

main(); 