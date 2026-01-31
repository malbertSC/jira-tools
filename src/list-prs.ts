import axios from "axios";
import * as moment from "moment";

export function getAuthorQ(authors: Array<String>) {
    return authors.map(author => `author:${author}`).join("+");
}

export function getCreatedFilter(createdFrom: moment.Moment, createdTo: moment.Moment) {
    const createdFromFilter = createdFrom.format("YYYY-MM-DDTHH:mm:ssZ");
    const createdToFilter = createdTo.format("YYYY-MM-DDTHH:mm:ssZ");
    return `created:${createdFromFilter}..${createdToFilter}`;
}
export async function getPrListQ(credentials: any, q: Array<String>, repo?: string) {
    const alwaysApplicableQs = [
        "type:pr",
        "draft:false"
    ];

    if (repo) {
        alwaysApplicableQs.push(`repo:squareup/${repo}`);
    } else {
        alwaysApplicableQs.push("repo:!zzz-archive-java");
        alwaysApplicableQs.push("org:squareup");
    }

    const allQs = [...q, ...alwaysApplicableQs];

    // Handle pagination - GitHub returns max 100 items per page
    let allItems: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const url = `https://api.github.com/search/issues?q=${allQs.join("+")}&per_page=${perPage}&page=${page}`;
        const { data } = await axios.get(url, credentials);

        if (data.items.length === 0) break;

        allItems = allItems.concat(data.items);

        // If we got fewer than perPage items, we've reached the end
        if (data.items.length < perPage) break;

        page++;

        // Safety limit to prevent infinite loops
        if (page > 10) {
            console.warn(`⚠️  Warning: Reached page limit of 10 (${allItems.length} PRs fetched). There may be more PRs.`);
            break;
        }
    }

    return allItems.filter(item => !isClosedAndUnmerged(item));
}

function isClosedAndUnmerged(item: any): boolean {
    return item.state === "closed" && !item.pull_request.merged_at;
}
