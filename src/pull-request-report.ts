import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import * as moment from "moment-business-time";
import { getPrListQ, getAuthorQ, getCreatedFilter } from "./list-prs";
import { getGithubToLdapMap } from "./gh-ldap-map";
import { getPrReviewerInfo } from "./get-reviewer-data";
import { workingHours, holidays } from "./working-hours";

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
    const ghUsernameToLdap = await getGithubToLdapMap();
    const qs = [
        getAuthorQ(Object.keys(ghUsernameToLdap)),
        getCreatedFilter(moment().subtract(14, "d"), moment())
    ]
    const recentPrs = await getPrListQ(credentials, qs);

    const prReviewerInfo = [];
    for (const pr of recentPrs) {
        const number = pr.number;
        const repository = pr.repository_url.split("/").at(-1);
        const githubUsername = pr.user.login;
        const createdAt = moment(pr.created_at);
        const parsedData = await getPrReviewerInfo(repository, number, createdAt, githubUsername);
        prReviewerInfo.push(parsedData);
    }

    const prsOutOfSlo = getPrsOutOfSlo(prReviewerInfo);
    console.log("out of SLO", prsOutOfSlo.length);
    console.log(prsOutOfSlo.map(pr => `${pr.repository}+${pr.pr_number}`))
    console.log("all", prReviewerInfo.length);
    console.log(getReviewerLeaderboard(prReviewerInfo));
    console.log(getTotalPointsLeaderboard(prReviewerInfo));
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