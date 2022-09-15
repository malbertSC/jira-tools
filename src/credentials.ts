export const credentials = {
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json"
    },
    auth: {
        username: process.env.GITHUB_USERNAME ?? "",
        password: process.env.GITHUB_PAT ?? ""
    }
}