import { config as dotenvConfig } from "dotenv";
dotenvConfig();
import { getIssueReport } from "./get-issue-report";

async function main() {
    const { data: jiraData } = await getIssueReport();

    const issueKeysAddedDuringSprint = Object.keys(jiraData.contents.issueKeysAddedDuringSprint);

    const completedIssues = jiraData.contents.completedIssues.map((issue) => {
        return { ...issue, ...{ section: "completed" } };
    });
    const issuesNotCompletedInCurrentSprint = jiraData.contents.issuesNotCompletedInCurrentSprint.map(
        (issue) => {
            return { ...issue, ...{ section: "not completed" } };
        }
    );
    const puntedIssues = jiraData.contents.puntedIssues.map((issue) => {
        return { ...issue, ...{ section: "punted" } };
    });
    const issuesCompletedInAnotherSprint = jiraData.contents.issuesCompletedInAnotherSprint.map(
        (issue) => {
            return { ...issue, ...{ section: "completed in another sprint" } };
        }
    );

    const allIssues = [
        ...completedIssues,
        ...issuesNotCompletedInCurrentSprint,
        ...puntedIssues,
        ...issuesCompletedInAnotherSprint
    ];

    const issuesOriginallyInSprint = allIssues.filter((issue) => {
        return !issueKeysAddedDuringSprint.includes(issue.key);
    });

    const issuesNotOriginallyInSprint = allIssues.filter((issue) => {
        return issueKeysAddedDuringSprint.includes(issue.key);
    });

    function sumPointsFromIssues(issues) {
        return issues.reduce((accum, issue) => {
            if (issue.estimateStatistic && issue.estimateStatistic.statFieldValue.value) {
                accum = accum + issue.estimateStatistic.statFieldValue.value;
            }
            return accum;
        }, 0);
    }

    const pointsFromOriginalIssuesEstimate = sumPointsFromIssues(issuesOriginallyInSprint);

    const originalIssuesNotDone = issuesOriginallyInSprint.filter((issue) => {
        return !issue.done;
    });

    const pointsFromOriginalIssuesNotDone = sumPointsFromIssues(originalIssuesNotDone);
    const pointsFromOriginalIssuesAccomplished =
        pointsFromOriginalIssuesEstimate - pointsFromOriginalIssuesNotDone;
    const puntedFromOriginalIssues = originalIssuesNotDone.filter(
        (issue) => issue.section === "punted"
    );
    const pointsPuntedFromOriginalIssues = sumPointsFromIssues(puntedFromOriginalIssues);

    const doneAddedIssues = issuesNotOriginallyInSprint.filter((issue) => issue.done);

    console.log("original estimate: ", pointsFromOriginalIssuesEstimate);
    console.log(
        "points accomplished from original estimate: ",
        pointsFromOriginalIssuesAccomplished
    );
    console.log("points punted from original estimate: ", pointsPuntedFromOriginalIssues);
    console.log(
        "issues not done status: ",
        originalIssuesNotDone.map(
            (issue) =>
                issue.key +
                " " +
                (issue.section === "not completed" ? issue.status.name : issue.section)
        )
    );
    console.log(
        "points accomplished from issues added after sprint began: ",
        sumPointsFromIssues(doneAddedIssues)
    );
}
main();
