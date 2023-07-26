hacky way to get some useful metrics from ~~jira~~ github

# install

-   create a fine-grained PAT in github
    -   go here https://github.com/settings/tokens?type=beta and click the "generate new token" button
    -   pick a name and set your expiration (I used 1 year)
    -   set "resource owner" to "squareup"
    -   add a note to describe why you need this access
    -   under "repository access", either specify the repository/repositories your team uses, or use "all repositories" if your team is frequently spinning up + working in new repositories
    -   under "repository permissions", set Issues, Metadata, and Pull Requests to "read only"
    -   click "generate token and request access". your request should be approved in a few days.
-   edit `github-username-to-ldap.csv` and add entries for all your team members
-   edit `src/working-hours.ts` to set your team's "core hours" that will be evaluated against for SLO tracking
-   run `yarn`
-   copy `.env.test` to a new file called `.env` and replace the github username and password secrets with your own values

# run

-   `yarn get-pr-stats` to get assorted reviewer statistics
-   `get-prs-past-slo` to get open PRs that are currently exceeding our review SLO

# quirks & limitations

-   the 🚀 rocket watch 🚀 feature only looks back 14 days for PRs, so sometimes PRs that were opened prior to the sprint but reviewed during the sprint won't be surfaced. you can change the lookback period with the `.env` config setting DAYS_TO_LOOK_BACK.
-   the jira integration was written against a different version of jira I used at a previous employer. I'll either delete this or dust it off eventually but for now it's non-functional.
