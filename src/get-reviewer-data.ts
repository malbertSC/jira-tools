import moment = require("moment-business-time");
import { getPullRequestData } from "./get-pull-request-data";
import { getSloHours } from "./utils";

export async function getPrReviewerInfo(repository: string, prNumber: string, createdAt: moment.Moment, githubUsername: string) {
    const reviewerRawData = await getPullRequestData(repository, prNumber);
    const reviewerData = reviewerRawData.map((item) => {
        return {
            user: item.node.author.login,
            is_within_slo: isReviewWithinSlo(moment(item.node.publishedAt), createdAt)
        }
    }).reduce((accum, item) => {
        if (item.user == githubUsername) return accum;
        const accumReviewsForUser = accum.filter(review => review.user === item.user);
        if (accumReviewsForUser.length == 0) {
            accum.push(item);
        } else {
            const review = accumReviewsForUser[0];
            if (item.is_within_slo) {
                review["is_within_slo"] = true;
            }
        }
        return accum;
    }, []);
    return {
        reviewers: reviewerData,
        author: githubUsername,
        pr_number: prNumber,
        repository,
        created_at: createdAt.toISOString()
    }

}

function isReviewWithinSlo(reviewSubmitted: moment.Moment, prSubmitted: moment.Moment): boolean {
    const SLO_HOURS = getSloHours();
    const diffTime = reviewSubmitted.workingDiff(prSubmitted);
    const diffHours = convertMsToAbsoluteHours(diffTime);
    return diffHours <= SLO_HOURS;
}

function convertMsToAbsoluteHours(timeDiffInMs) {
   return Math.abs(timeDiffInMs/1000/60/60);
}