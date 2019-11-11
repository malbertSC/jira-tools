import * as axios from "axios";

const credentials = {
    headers: {
        "Content-Type": "application/json"
    },
    auth: {
        username: process.env.JIRA_USERNAME,
        password: process.env.JIRA_PASSWORD
    }
}

export async function getSprintId(boardId) {
    const { data: { values: sprints } } = await axios.default.get(
        `https://gathertech.atlassian.net/rest/agile/1.0/board/${boardId}/sprint`, credentials
    );
    const sprint = sprints.find(allSprints => allSprints.state === 'active');
    return sprint.id;
}

export async function getBoardId(boardName) {
    const { data: { values: boards } } = await axios.default.get(
        `https://gathertech.atlassian.net/rest/agile/1.0/board`, credentials
    );
    const board = boards.find(allBoards => allBoards.name === boardName);
    return board.id;
};

export async function getIssueReport(boardId, sprintId) {
    return await axios.default.get(
        `https://gathertech.atlassian.net/rest/greenhopper/latest/rapid/charts/sprintreport?rapidViewId=${boardId}&sprintId=${sprintId}`,
        credentials
    );
};
