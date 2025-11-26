import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import * as moment from "moment-business-time";
import { getPrListQ, getCreatedFilter } from "./list-prs";
import { workingHours, holidays } from "./working-hours";

const credentials = {
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json"
    },
    auth: {
        username: process.env.GITHUB_USERNAME ?? "",
        password: process.env.GITHUB_PAT ?? ""
    }
}

moment.updateLocale('en', {
    workinghours: workingHours,
    holidays
});

async function main() {
    const hasLabel = process.argv[2] || "esperanto";
    const notLabel = process.argv[3] || "payment-foundations";
    const daysToLookBack = parseInt(process.argv[4] || "90");

    console.log(`\n🔍 Finding PRs with label "${hasLabel}" but NOT "${notLabel}" (last ${daysToLookBack} days)\n`);

    // Get PRs with the "has" label
    const qs = [
        getCreatedFilter(moment().subtract(daysToLookBack, "d"), moment()),
        `label:${hasLabel}`
    ];
    const prsWithHasLabel = await getPrListQ(credentials, qs);

    console.log(`Found ${prsWithHasLabel.length} PRs with label "${hasLabel}"\n`);

    // Filter out PRs that also have the "not" label
    const filteredPrs = prsWithHasLabel.filter(pr => {
        const labels = pr.labels.map((label: any) => label.name);
        return !labels.includes(notLabel);
    });

    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`📊 RESULTS: ${filteredPrs.length} PRs with "${hasLabel}" but NOT "${notLabel}"`);
    console.log(`═══════════════════════════════════════════════════════════\n`);

    if (filteredPrs.length === 0) {
        console.log("✅ All PRs with the first label also have the second label!\n");
        return;
    }

    // Display the PRs
    filteredPrs.forEach((pr, index) => {
        const repository = pr.repository_url.split("/").at(-1);
        const author = pr.user.login;
        const createdAt = moment(pr.created_at).format("YYYY-MM-DD");
        const state = pr.state === "open" ? "🟢 Open" : pr.pull_request.merged_at ? "🟣 Merged" : "⚫ Closed";
        const labels = pr.labels.map((label: any) => label.name).join(", ");

        console.log(`${index + 1}. ${repository}#${pr.number} - ${state}`);
        console.log(`   Author: ${author}`);
        console.log(`   Created: ${createdAt}`);
        console.log(`   Title: ${pr.title}`);
        console.log(`   Labels: ${labels}`);
        console.log(`   URL: https://github.com/squareup/${repository}/pull/${pr.number}`);
        console.log();
    });

    // Summary statistics
    const open = filteredPrs.filter(pr => pr.state === "open").length;
    const merged = filteredPrs.filter(pr => pr.pull_request.merged_at).length;
    const closed = filteredPrs.filter(pr => pr.state === "closed" && !pr.pull_request.merged_at).length;

    console.log(`\n📈 Summary:`);
    console.log(`   Total: ${filteredPrs.length}`);
    console.log(`   🟢 Open: ${open}`);
    console.log(`   🟣 Merged: ${merged}`);
    console.log(`   ⚫ Closed: ${closed}\n`);
}

main().catch(err => {
    console.error("Error running label comparison:", err);
    process.exit(1);
});
