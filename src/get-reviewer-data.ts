import axios from "axios";
import moment = require("moment-business-time");
import { credentials } from "./credentials";

async function getReviewerData(repository, prNumber) {
    const { data } = await axios.get(
        `https://api.github.com/repos/squareup/${repository}/pulls/${prNumber}/reviews`, credentials
    );
    return data;
}

export async function getPrReviewerInfo(repository: string, prNumber: string, createdAt: moment.Moment, githubUsername: string) {
    const reviewerRawData = await getReviewerData(repository, prNumber);
    const reviewerData = reviewerRawData.map((item) => {
        return {
            user: item.user.login,
            is_within_slo: isReviewWithinSlo(moment(item.submitted_at), createdAt)
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
        repository
    }

}

function isReviewWithinSlo(reviewSubmitted: moment.Moment, prSubmitted: moment.Moment): boolean {
    const diffTime = reviewSubmitted.workingDiff(prSubmitted);
    const diffHours = convertMsToAbsoluteHours(diffTime);
    return diffHours <= 4;
}

function convertMsToAbsoluteHours(timeDiffInMs) {
   return Math.abs(timeDiffInMs/1000/60/60);
}