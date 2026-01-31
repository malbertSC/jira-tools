import { execSync } from "child_process";

function getGitHubToken(): string {
    try {
        const token = execSync("gh auth token", { encoding: "utf-8" }).trim();
        if (token) return token;
    } catch {
        // gh CLI not available or not authenticated
    }

    // Fall back to PAT from environment
    if (process.env.GITHUB_PAT) {
        return process.env.GITHUB_PAT;
    }

    throw new Error(
        "No GitHub token found. Either run 'gh auth login' or set GITHUB_PAT environment variable."
    );
}

export const credentials = {
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${getGitHubToken()}`
    }
}