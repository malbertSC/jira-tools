import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { credentials } from "./credentials";
import { workingHours, holidays } from "./working-hours";
import { getGithubToLdapMap } from "./gh-ldap-map";
import * as moment from "moment-business-time";
import { getAuthorQ, getPrListQ, getCreatedFilter } from "./list-prs";
import { getDaysToLookBack, getSloHours } from "./utils";

moment.updateLocale('en', {
    workinghours: workingHours,
    holidays
});

export async function getOpenPrsPastSLO() {
    const ghUsernameToLdap = await getGithubToLdapMap();
    const sloCutoffTime = getSloTime();
    const qs = [
        getAuthorQ(Object.keys(ghUsernameToLdap)),
        getCreatedFilter(moment().subtract(getDaysToLookBack(), "d"), sloCutoffTime),
        "review:none",
        "is:open"
    ]
    const openPRs = await getPrListQ(credentials, qs);
    console.log(openPRs.map(pr => pr.pull_request.html_url));
}

function getSloTime() {
    const time = moment();
    time.subtractWorkingTime(getSloHours(), "hours");
    return time;
}

getOpenPrsPastSLO();