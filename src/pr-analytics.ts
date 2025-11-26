import { isBot } from "./bot-filter";

/**
 * Filter PRs that did not receive any review within SLO
 */
export function getPrsOutOfSlo(prs: Array<any>) {
    return prs.filter(pr => {
        return !(pr.reviewers as Array<any>).some(review => review.is_within_slo);
    });
}

/**
 * Calculate reviewer leaderboard - counts reviews per user
 * Bot accounts are filtered out
 */
export function getReviewerLeaderboard(prs: Array<any>) {
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
    }, {} as Record<string, number>);
    return Object.keys(reviewsByUser).map(user => {
        return {
            user,
            reviews: reviewsByUser[user]
        };
    }).sort((a, b) => b.reviews - a.reviews);
}

/**
 * Calculate total points leaderboard - +1 for authored PR, +1 for each review
 * Bot accounts are filtered out
 */
export function getTotalPointsLeaderboard(prs: Array<any>) {
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
    }, {} as Record<string, number>);
    return Object.keys(pointsByUser).map(user => {
        return {
            user,
            points: pointsByUser[user]
        };
    }).sort((a, b) => b.points - a.points);
}
