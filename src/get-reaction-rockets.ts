import axios from "axios";
import { credentials } from "./credentials";

async function getComments(repository, prNumber) {
    const { data } = await axios.get(
        `https://api.github.com/repos/squareup/${repository}/pulls/${prNumber}/comments`, credentials
    );
    return data;
}

export interface RocketComments {
    body: String;
    url: String;
    rockets: number;
    ghUsername: String;
}

export async function getPrRocketComments(repository: string, prNumber: string): Promise<Array<RocketComments>> {
    const commentsRaw = await getComments(repository, prNumber);
    const rocketComments: Array<RocketComments> = [];
    for (const comment of commentsRaw) {
        const rockets = comment["reactions"]["rocket"];
        if (rockets == 0) {
            continue;
        }
        rocketComments.push({
            body: comment["body"],
            url: comment["_links"]["html"]["href"],
            rockets,
            ghUsername: comment["user"]["login"],
        });

    }
    return rocketComments;
}