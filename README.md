hacky way to get some useful metrics from ~~jira~~ github

# install

-   edit `github-username-to-ldap.csv` and add entries for all your team members
-   edit `src/working-hours.ts` to set your team's "core hours" that will be evaluated against for SLO tracking
-   run `yarn`
-   copy `.env.test` to `.env` and adjust settings as needed

## github authentication

If you have the [gh CLI](https://cli.github.com/) installed and authenticated, you're all set - the tool will automatically use your existing credentials.

Otherwise, you'll need to create a fine-grained PAT:

1.  go to https://github.com/settings/tokens?type=beta and click "generate new token"
2.  pick a name and set your expiration (I used 1 year)
3.  set "resource owner" to "squareup"
4.  add a note to describe why you need this access
5.  under "repository access", either specify the repository/repositories your team uses, or use "all repositories" if your team is frequently spinning up + working in new repositories
6.  under "repository permissions", set Issues, Metadata, and Pull Requests to "read only"
7.  click "generate token and request access". your request should be approved in a few days.
8.  add your token to `.env` as `GITHUB_TOKEN`

# run

-   `yarn get-pr-stats` to get assorted reviewer statistics
-   `yarn get-pr-stats:report` same as above but in a condensed report format
-   `yarn get-prs-past-slo` to get open PRs that are currently exceeding our review SLO
-   `yarn user-activity <username>` to get activity report for a specific user
-   `yarn get-pr-stats-for-label <label>` to get PR stats for a specific label
-   `yarn label-contributor-stats [label] [days]` to analyze PRs by label with internal/external contributor comparison (see [LABEL_CONTRIBUTOR_STATS.md](./LABEL_CONTRIBUTOR_STATS.md) for details)
-   `yarn label-comparison [hasLabel] [notLabel] [days]` to find PRs that have one label but not another (useful for finding PRs missing a required label)
-   `yarn ldap-yearly-stats` to get yearly PR statistics
-   `yarn ldap-yearly-review-stats` to get yearly review statistics

# configuration

The number of days to look back can be configured using the `DAYS_TO_LOOK_BACK` environment variable:

You can configure the following environment variables in your `.env` file:

-   `DAYS_TO_LOOK_BACK=30`  
    Number of days to look back for PRs and activity.  
    Default fallback: 15 days

-   `SLO_HOURS=4`  
    Number of working hours allowed for SLO (Service Level Objective) review window.  
    Default fallback: 4 hours

# quirks & limitations

-   the 🚀 rocket watch 🚀 feature only looks back 14 days for PRs, so sometimes PRs that were opened prior to the sprint but reviewed during the sprint won't be surfaced. you can change the lookback period with the `.env` config setting DAYS_TO_LOOK_BACK.
-   the jira integration was written against a different version of jira I used at a previous employer. I'll either delete this or dust it off eventually but for now it's non-functional.
