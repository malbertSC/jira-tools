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
export async function getPrListQ(credentials: any, q: Array<String>) {
    const alwaysApplicableQs = [
        "repo:!zzz-archive-java",
        "type:pr",
        "draft:false",
        "org:squareup"
    ]
    const allQs = [...q, ...alwaysApplicableQs];
    const url = `https://api.github.com/search/issues?q=${allQs.join("+")}&per_page=100`;
    const { data } = await axios.get(url, credentials);
    return data.items.filter(item => !isClosedAndUnmerged(item));
}

function isClosedAndUnmerged(item: any): boolean {
    return item.state === "closed" && !item.pull_request.merged_at;
}
