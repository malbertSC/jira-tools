import { Report, ReportBlock, ReportInline } from './types';
import { RocketComments } from '../get-reaction-rockets';
import { getSloHours, getDaysToLookBack } from '../utils';

export interface ReportData {
    prsOutOfSlo: Array<any>;
    allPrs: Array<any>;
    reviewerLeaderboard: Array<{ user: string; reviews: number }>;
    pointsLeaderboard: Array<{ user: string; points: number }>;
    rocketComments: Array<RocketComments>;
    ghUsernameToLdap: Record<string, string>;
    throughputStats: Array<{
        author: string;
        totalPRs: number;
        weeksWithActivity: number;
        avgPRsPerWeek: number;
        weeklyBreakdown: Record<string, number>;
    }>;
}

export function buildReport(data: ReportData): Report {
    const {
        prsOutOfSlo,
        allPrs,
        reviewerLeaderboard,
        pointsLeaderboard,
        rocketComments,
        ghUsernameToLdap,
        throughputStats
    } = data;

    const sloHours = getSloHours();
    const totalPrs = allPrs.length;
    const prsWithinSlo = totalPrs - prsOutOfSlo.length;
    const sloPercentage = totalPrs > 0 ? Math.round((prsWithinSlo / totalPrs) * 100) : 0;

    const convertToLdap = (githubUsername: string): string => {
        return ghUsernameToLdap[githubUsername] || githubUsername;
    };

    const report: Report = [];

    report.push({
        type: 'section',
        content: [
            { type: 'emoji', name: 'robot_face' },
            ' ',
            '**beep boop here are your end-of-sprint PR review stats!**',
            ' ',
            { type: 'emoji', name: 'robot_face' }
        ]
    });

    report.push(buildSloSection(sloPercentage, prsWithinSlo, totalPrs));

    report.push({ type: 'header', text: 'Top Reviewers by Review Count' });
    report.push(buildTopReviewersSection(reviewerLeaderboard.slice(0, 3), convertToLdap));

    report.push({ type: 'header', text: 'Top Contributors by Points' });
    report.push(buildTopContributorsSection(pointsLeaderboard.slice(0, 3), allPrs, convertToLdap));

    report.push({
        type: 'section',
        content: [
            '**How Points Work:** Each person gets +1 point for every PR they author and +1 point for every PR they review. This measures total participation in the code review process - both contributing code and helping teammates by reviewing their work.'
        ]
    });

    report.push({ type: 'header', text: 'PRs Past SLO' });
    report.push(...buildPrsOutOfSloSection(prsOutOfSlo, totalPrs, sloHours));

    report.push({
        type: 'section',
        content: [
            { type: 'emoji', name: 'rocket' },
            ' **ROCKET WATCH** ',
            { type: 'emoji', name: 'rocket' }
        ]
    });
    report.push(...buildRocketSection(rocketComments, convertToLdap));

    report.push({ type: 'divider' });

    report.push({ type: 'header', text: 'Team PR Throughput' });
    report.push(...buildThroughputSection(throughputStats));

    return report;
}

function buildSloSection(sloPercentage: number, prsWithinSlo: number, totalPrs: number): ReportBlock {
    let content: ReportInline[];

    if (sloPercentage === 100) {
        content = [
            { type: 'emoji', name: 'fire' },
            ` **${prsWithinSlo}/${totalPrs} (${sloPercentage}%) PRs were reviewed within SLO, perfect score!** `,
            { type: 'emoji', name: 'tada' },
            ' ',
            { type: 'emoji', name: 'clap' }
        ];
    } else if (sloPercentage >= 90) {
        content = [
            { type: 'emoji', name: 'fire' },
            ` **${prsWithinSlo}/${totalPrs} (${sloPercentage}%) PRs were reviewed within SLO!** `,
            { type: 'emoji', name: 'clap' }
        ];
    } else if (sloPercentage >= 80) {
        content = [
            { type: 'emoji', name: 'not_bad' },
            ` **${prsWithinSlo}/${totalPrs} (${sloPercentage}%) PRs were reviewed within SLO**`
        ];
    } else {
        content = [
            { type: 'emoji', name: 'see_no_evil' },
            ` **${prsWithinSlo}/${totalPrs} (${sloPercentage}%) PRs were reviewed within SLO, needs improvement** `,
            { type: 'emoji', name: 'warning' }
        ];
    }

    return { type: 'section', content };
}

function buildTopReviewersSection(
    topReviewers: Array<{ user: string; reviews: number }>,
    convertToLdap: (name: string) => string
): ReportBlock {
    const medals = ['first_place_medal', 'second_place_medal', 'third_place_medal'];

    const items: ReportInline[][] = topReviewers.map((reviewer, index) => {
        const ldapName = convertToLdap(reviewer.user);
        const item: ReportInline[] = [
            { type: 'emoji', name: medals[index] },
            ' **',
            { type: 'user', name: ldapName },
            `** with **${reviewer.reviews} reviews**`
        ];
        if (index === 0) {
            item.push(' ');
            item.push({ type: 'emoji', name: 'fire' });
        }
        return item;
    });

    return { type: 'list', items };
}

function buildTopContributorsSection(
    topContributors: Array<{ user: string; points: number }>,
    allPrs: Array<any>,
    convertToLdap: (name: string) => string
): ReportBlock {
    const medals = ['first_place_medal', 'second_place_medal', 'third_place_medal'];

    const items: ReportInline[][] = topContributors.map((contributor, index) => {
        const ldapName = convertToLdap(contributor.user);
        const authoredPrs = allPrs.filter(pr => pr.author === contributor.user).length;
        const reviewedPrs = contributor.points - authoredPrs;

        return [
            { type: 'emoji', name: medals[index] },
            ' **',
            { type: 'user', name: ldapName },
            `** with **${contributor.points} points** (${authoredPrs} PRs authored + ${reviewedPrs} PRs reviewed)`
        ];
    });

    return { type: 'list', items };
}

function buildPrsOutOfSloSection(prsOutOfSlo: Array<any>, totalPrs: number, sloHours: number): ReportBlock[] {
    if (prsOutOfSlo.length === 0) {
        return [{
            type: 'section',
            content: [
                { type: 'emoji', name: 'green_heart' },
                ` **No PRs past SLO - amazing work team!** All ${totalPrs} PRs were reviewed within the ${sloHours}-hour SLO.`
            ]
        }];
    }

    const sortedPrs = [...prsOutOfSlo].sort((a, b) => {
        if (a.state === 'open' && b.state !== 'open') return -1;
        if (a.state !== 'open' && b.state === 'open') return 1;
        return 0;
    });

    const openCount = sortedPrs.filter(pr => pr.state === 'open').length;
    const mergedCount = sortedPrs.length - openCount;

    const blocks: ReportBlock[] = [];

    let introText = `The following ${prsOutOfSlo.length} PRs were not reviewed within SLO`;
    if (openCount > 0 && mergedCount > 0) {
        introText += ` (${openCount} still open, ${mergedCount} merged)`;
    }
    introText += ':';
    blocks.push({ type: 'section', content: [introText] });

    const items: ReportInline[][] = sortedPrs.map(pr => {
        const url = `https://github.com/squareup/${pr.repository}/pull/${pr.pr_number}`;
        const link: ReportInline = { type: 'link', text: `${pr.repository}+${pr.pr_number}`, url };

        if (pr.state === 'merged') {
            return [
                { type: 'strikethrough', content: [link] },
                ' (merged)'
            ];
        }
        return [link];
    });

    blocks.push({ type: 'list', items });

    return blocks;
}

function buildRocketSection(
    rocketComments: Array<RocketComments>,
    convertToLdap: (name: string) => string
): ReportBlock[] {
    if (rocketComments.length === 0) {
        return [{
            type: 'section',
            content: [
                '_No rocket reactions found this sprint - remember to react to great PR review comments with ',
                { type: 'emoji', name: 'rocket' },
                ' to highlight them in future reports!_'
            ]
        }];
    }

    const blocks: ReportBlock[] = [];

    for (const comment of rocketComments) {
        const ldapName = convertToLdap(comment.ghUsername as string);
        blocks.push({
            type: 'section',
            content: [
                { type: 'user', name: ldapName },
                ' (',
                { type: 'link', text: 'link', url: comment.url as string },
                '):'
            ]
        });
        blocks.push({
            type: 'quote',
            content: [comment.body as string]
        });
    }

    const allReactors: string[] = [];
    for (const comment of rocketComments) {
        for (const reactor of (comment.reactors || [])) {
            if (!allReactors.includes(reactor)) {
                allReactors.push(reactor);
            }
        }
    }
    const reactorNames = allReactors.map(convertToLdap);

    const shoutoutContent: ReportInline[] = ['Shoutout to '];
    reactorNames.forEach((name, i) => {
        shoutoutContent.push({ type: 'user', name });
        if (i < reactorNames.length - 1) shoutoutContent.push(', ');
    });
    shoutoutContent.push(
        ' for highlighting these! React to PR review comments with ',
        { type: 'emoji', name: 'rocket' },
        ' to highlight them in these reviews!'
    );

    blocks.push({ type: 'section', content: shoutoutContent });

    return blocks;
}

function buildThroughputSection(
    throughputStats: Array<{
        author: string;
        totalPRs: number;
        weeksWithActivity: number;
        avgPRsPerWeek: number;
    }>
): ReportBlock[] {
    if (throughputStats.length === 0) {
        return [{
            type: 'section',
            content: ['No merged PR data available for throughput calculation.']
        }];
    }

    const teamTotalPRs = throughputStats.reduce((sum, dev) => sum + dev.totalPRs, 0);
    const activeContributors = throughputStats.length;
    const prPerDeveloper = parseFloat((teamTotalPRs / activeContributors).toFixed(1));
    const daysToLookBack = getDaysToLookBack();

    return [{
        type: 'section',
        content: [
            `**${prPerDeveloper} PRs per developer** (${teamTotalPRs} total PRs / ${activeContributors} developers)\n`,
            `**${teamTotalPRs} total PRs merged** in the last ${daysToLookBack} days\n`,
            `**${activeContributors} active contributors** creating PRs`
        ]
    }];
}
