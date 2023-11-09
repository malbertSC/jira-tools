import { getPullRequestData } from "./get-pull-request-data";

export async function getPrRocketComments(repository, prNumber): Promise<Array<RocketComments>> {
    const reviewData = await getPullRequestData(repository, prNumber);
    let rocketComments: Array<RocketComments> = [];
    for (const review of reviewData) {
        const topLevelRockets = getRockets(review.node.reactions.edges);
        if (topLevelRockets > 0) {
            rocketComments.push({
                url: review.node.url,
                body: review.node.body,
                rockets: topLevelRockets,
                ghUsername: review.node.author.login
            })
        }
        const comments = review.node.comments.edges;
        for (const comment of comments) {
            const commentRockets = getRockets(comment.node.reactions.edges)
            if (commentRockets > 0) {
                rocketComments.push({
                    url: comment.node.url,
                    body: comment.node.body,
                    rockets: commentRockets,
                    ghUsername: comment.node.author.login
                })
            }
        }
    }
    return rocketComments;
}

function getRockets(reactions: Array<any>): number {
    return reactions.filter(reaction => reaction.node.content === "ROCKET").length;
}

export interface RocketComments {
    body: String;
    url: String;
    rockets: number;
    ghUsername: String;
}