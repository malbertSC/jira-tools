import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { getPrListQ, getAuthorQ, getCreatedFilter } from "./list-prs";
import { getGithubToLdapMap } from "./gh-ldap-map";
import { getPrReviewerInfo } from "./get-reviewer-data";
import { getPrRocketComments, RocketComments } from "./get-reaction-rockets";
import { getDaysToLookBack, initializeMoment, moment } from "./utils";
import { credentials } from "./credentials";
import { getPrsOutOfSlo, getReviewerLeaderboard, getTotalPointsLeaderboard } from "./pr-analytics";

initializeMoment();

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
        const parsedData = await getPrReviewerInfo(repository, number, createdAt, githubUsername);
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

main(); 