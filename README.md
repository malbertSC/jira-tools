hacky way to get some useful metrics from jira

# install

-   create a github PAT with repo access -> https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
-   ask matt to send you the csv for GH username <> ldap (or add your own)
-   run `yarn`
-   create an `.env` file with configs from `.env.test` but add your own values

# run

-   `yarn get-pr-stats` to get assorted reviewer statistics
-   `get-prs-past-slo` to get open PRs that are currently exceeding our review SLO
