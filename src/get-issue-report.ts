import * as axios from "axios";
const RAPID_VIEW = process.env.RAPID_VIEW;
const SPRINT_ID = process.env.SPRINT_ID;
export async function getIssueReport() {
    return await axios.default.get(
        `https://gathertech.atlassian.net/rest/greenhopper/latest/rapid/charts/sprintreport?rapidViewId=${RAPID_VIEW}&sprintId=${SPRINT_ID}`,
        {
            headers: {
                "Content-Type": "application/json"
            },
            auth: {
                username: process.env.JIRA_USERNAME,
                password: process.env.JIRA_PASSWORD
            }
        }
    );
}
