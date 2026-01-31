// NOTE: This file contains legacy Jira sprint reporting code that is no longer functional.
// The required module './get-issue-report' does not exist in the codebase.
// This code is preserved for reference but commented out until the module is restored or removed.

// import { config as dotenvConfig } from "dotenv";
// dotenvConfig();
// import { getSprintId, getBoardId, getIssueReport } from "./get-issue-report";
//
// const [, , cliBoardName, cliSprintId] = process.argv;
//
// (async function main() {
//
//     const boardId = await getBoardId(cliBoardName || "APP board");
//     const sprintId = cliSprintId || await getSprintId(boardId);
//     const { data: { contents: jiraData } } = await getIssueReport(boardId, sprintId);
//
//     const issueKeysAddedDuringSprint = Object.keys(jiraData.issueKeysAddedDuringSprint);
//
//     const completedIssues = jiraData.completedIssues.map((issue) => {
//         return { ...issue, ...{ section: "completed" } };
//     });
//     const issuesNotCompletedInCurrentSprint = jiraData.issuesNotCompletedInCurrentSprint.map(
//         (issue) => {
//             return { ...issue, ...{ section: "not completed" } };
//         }
//     );
//     const puntedIssues = jiraData.puntedIssues.map((issue) => {
//         return { ...issue, ...{ section: "punted" } };
//     });
//     const issuesCompletedInAnotherSprint = jiraData.issuesCompletedInAnotherSprint.map(
//         (issue) => {
//             return { ...issue, ...{ section: "completed in another sprint" } };
//         }
//     );
//
//     const allIssues = [
//         ...completedIssues,
//         ...issuesNotCompletedInCurrentSprint,
//         ...puntedIssues,
//         ...issuesCompletedInAnotherSprint
//     ];
//
//     const issuesOriginallyInSprint = allIssues.filter((issue) => {
//         return !issueKeysAddedDuringSprint.includes(issue.key);
//     });
//
//     const issuesNotOriginallyInSprint = allIssues.filter((issue) => {
//         return issueKeysAddedDuringSprint.includes(issue.key);
//     });
//
//     function sumPointsFromIssues(issues) {
//         return issues.reduce((accum, issue) => {
//             if (issue.estimateStatistic && issue.estimateStatistic.statFieldValue.value) {
//                 accum = accum + issue.estimateStatistic.statFieldValue.value;
//             }
//             return accum;
//         }, 0);
//     }
//
//     const pointsFromOriginalIssuesEstimate = sumPointsFromIssues(issuesOriginallyInSprint);
//
//     const originalIssuesNotDone = issuesOriginallyInSprint.filter((issue) => {
//         return !issue.done;
//     });
//
//     const originalIssuesEstimateCountNotDone = sumPointsFromIssues(originalIssuesNotDone);
//
//     const pointsFromOriginalIssuesNotDone = sumPointsFromIssues(originalIssuesNotDone);
//     const pointsFromOriginalIssuesAccomplished =
//         pointsFromOriginalIssuesEstimate - pointsFromOriginalIssuesNotDone;
//     const puntedFromOriginalIssues = originalIssuesNotDone.filter(
//         (issue) => issue.section === "punted"
//     );
//     const pointsPuntedFromOriginalIssues = sumPointsFromIssues(puntedFromOriginalIssues);
//
//     const doneAddedIssues = issuesNotOriginallyInSprint.filter((issue) => issue.done);
//     const finalIssueEstimateSum =
//         (jiraData.completedIssuesEstimateSum.value || 0) + jiraData.issuesNotCompletedEstimateSum.value;
//
//     const printStoriesFor = (storiesArray) => {
//         return storiesArray.map(
//             (issue) =>
//                 `${issue.key} ${issue.summary} - (${issue.typeName}) ` +
//                 `(${(issue.section === "not completed" ? issue.status.name : issue.section)}) ` +
//                 `(${issue.estimateStatistic && issue.estimateStatistic.statFieldValue.value !== undefined ?
//                     issue.estimateStatistic.statFieldValue.value + ' points' : 'not pointed'})`
//         )
//     }
//
//     console.log("original estimate: ", pointsFromOriginalIssuesEstimate);
//     console.log("final estimate:", finalIssueEstimateSum);
//     console.log(
//         "points accomplished from original estimate: ",
//         pointsFromOriginalIssuesAccomplished
//     );
//     console.log(
//         "points accomplished from issues added after sprint began: ",
//         sumPointsFromIssues(doneAddedIssues)
//     );
//     console.log("points punted from original estimate: ", pointsPuntedFromOriginalIssues);
//     console.log("points not completed from original estimate:", originalIssuesEstimateCountNotDone);
//     console.log("issues not done status: ", printStoriesFor(originalIssuesNotDone));
//     console.log("issues added during sprint: ", printStoriesFor(issuesNotOriginallyInSprint));
//     console.log("issues punted: ", printStoriesFor(puntedFromOriginalIssues));
// })();
