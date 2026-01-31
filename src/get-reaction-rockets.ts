import { getPullRequestData } from "./get-pull-request-data";

export async function getPrRocketComments(repository, prNumber): Promise<Array<RocketComments>> {
    const reviewData = await getPullRequestData(repository, prNumber);
    let rocketComments: Array<RocketComments> = [];
    for (const review of reviewData) {
        const rocketInfo = getRocketInfo(review.node.reactions.edges);
        if (rocketInfo.count > 0) {
            rocketComments.push({
                url: review.node.url,
                body: review.node.body,
                rockets: rocketInfo.count,
                reactors: rocketInfo.reactors,
                ghUsername: review.node.author.login
            })
        }
        const comments = review.node.comments.edges;
        for (const comment of comments) {
            const commentRocketInfo = getRocketInfo(comment.node.reactions.edges)
            if (commentRocketInfo.count > 0) {
                rocketComments.push({
                    url: comment.node.url,
                    body: comment.node.body,
                    rockets: commentRocketInfo.count,
                    reactors: commentRocketInfo.reactors,
                    ghUsername: comment.node.author.login
                })
            }
        }
    }
    return rocketComments;
}

function getRocketInfo(reactions: Array<any>): { count: number; reactors: string[] } {
    const rocketReactions = reactions.filter(reaction => reaction.node.content === "ROCKET");
    return {
        count: rocketReactions.length,
        reactors: rocketReactions.map(r => r.node.user?.login).filter(Boolean)
    };
}

export interface RocketComments {
    body: String;
    url: String;
    rockets: number;
    reactors: string[];
    ghUsername: String;
}