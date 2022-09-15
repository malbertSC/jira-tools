import * as csvtojson from "csvtojson"

export async function getGithubToLdapMap() {
    const mapJson = await csvtojson().fromFile("./src/github-username-to-ldap.csv");
    return mapJson.reduce((accum, item) => ({ ...accum, [item["github_username"]]: item["ldap"]}), {})
}