/**
 * Bot detection utility for filtering bot accounts from PR rankings
 */

// Common bot username patterns
const BOT_PATTERNS = [
    /bot$/i,                              // ends with "bot"
    /^bot-/i,                             // starts with "bot-"
    /-bot-/i,                             // contains "-bot-"
    /\[bot\]/i,                           // contains [bot]
    /^dependabot/i,                       // dependabot
    /^renovate/i,                         // renovate bot
    /^github-actions/i,                   // github actions
    /copilot.*reviewer/i,                 // copilot reviewers
    /^greenkeeper/i,                      // greenkeeper
    /^snyk/i,                             // snyk bot
    /^codecov/i,                          // codecov bot
    /^sonarcloud/i,                       // sonarcloud
    /^whitesource/i,                      // whitesource
    /^allcontributors/i,                  // all contributors bot
    /^stale/i,                            // stale bot
    /^svc-/i,                             // service accounts (svc-)
    /^square-cloud-/i,                    // square cloud bots
    /^plus-1-bot/i,                       // plus-1-bot variants
    /-reviews$/i,                         // ends with "-reviews"
];

// Known bot usernames (exact matches)
const KNOWN_BOTS = new Set([
    'copilot-pull-request-reviewer',
    'github-actions',
    'dependabot',
    'renovate',
    'greenkeeper',
    'codecov',
    'snyk-bot',
    'sonarcloud',
    'whitesource-bolt',
    'allcontributors',
    'stale',
    'plus-1-bot-production',
    'plus-1-bot-staging',
    'square-cloud-cd-pr-bot-production',
    'square-cloud-cd-pr-bot-staging',
    'svc-block-automated-reviews',
]);

/**
 * Checks if a GitHub username belongs to a bot
 * @param username - GitHub username to check
 * @returns true if the username appears to be a bot
 */
export function isBot(username: string | null | undefined): boolean {
    if (!username) return false;

    const normalizedUsername = username.toLowerCase();

    // Check exact matches first (faster)
    if (KNOWN_BOTS.has(normalizedUsername)) {
        return true;
    }

    // Check pattern matches
    return BOT_PATTERNS.some(pattern => pattern.test(normalizedUsername));
}

/**
 * Filters out bot accounts from a list of users
 * @param users - Array of user objects with a 'user' property
 * @returns Filtered array without bot accounts
 */
export function filterBots<T extends { user: string }>(users: T[]): T[] {
    return users.filter(item => !isBot(item.user));
}
