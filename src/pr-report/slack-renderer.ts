import { Report, ReportBlock, ReportInline } from './types';

export interface SlackTextObject {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
}

export interface SlackHeaderBlock {
    type: 'header';
    text: SlackTextObject;
}

export interface SlackSectionBlock {
    type: 'section';
    text: SlackTextObject;
}

export interface SlackDividerBlock {
    type: 'divider';
}

export interface SlackContextBlock {
    type: 'context';
    elements: SlackTextObject[];
}

export type SlackBlock = SlackHeaderBlock | SlackSectionBlock | SlackDividerBlock | SlackContextBlock;

export function renderSlackBlocks(report: Report): SlackBlock[] {
    const blocks: SlackBlock[] = [];

    for (const block of report) {
        const rendered = renderBlock(block);
        if (rendered) {
            if (Array.isArray(rendered)) {
                blocks.push(...rendered);
            } else {
                blocks.push(rendered);
            }
        }
    }

    return blocks;
}

function renderBlock(block: ReportBlock): SlackBlock | SlackBlock[] | null {
    switch (block.type) {
        case 'header':
            const headerText = block.emoji
                ? `:${block.emoji}: ${block.text}`
                : block.text;
            return {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: headerText,
                    emoji: true
                }
            };

        case 'section':
            return {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: renderInlineArrayForSlack(block.content)
                }
            };

        case 'list':
            const listText = block.items
                .map(item => `• ${renderInlineArrayForSlack(item)}`)
                .join('\n');
            return {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: listText
                }
            };

        case 'rocket-list':
            const rocketListText = block.items
                .map(item => renderRocketItemForSlack(item))
                .join('\n');
            return {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: rocketListText
                }
            };

        case 'quote':
            return {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '> ' + renderInlineArrayForSlack(block.content)
                }
            };

        case 'divider':
            return {
                type: 'divider'
            };

        case 'context':
            return {
                type: 'context',
                elements: [{
                    type: 'mrkdwn',
                    text: renderInlineArrayForSlack(block.content)
                }]
            };
    }
}

function renderInlineArrayForSlack(content: ReportInline[]): string {
    const joined = content.map(inline => renderInlineForSlack(inline)).join('');
    return joined.replace(/\*\*([^*]+)\*\*/g, '*$1*');
}

// Renders rocket items without bullets and with blockquote for the comment body
// Expected structure: [user, ' (', link, '): "', body, '"']
function renderRocketItemForSlack(item: ReportInline[]): string {
    // Find the comment body (the string after '): "')
    let header = '';
    let body = '';
    let foundBodyStart = false;

    for (let i = 0; i < item.length; i++) {
        const inline = item[i];
        if (typeof inline === 'string' && inline === '): "') {
            foundBodyStart = true;
            header += '): ';
            continue;
        }
        if (foundBodyStart) {
            // This is the body or the closing quote
            if (typeof inline === 'string' && inline !== '"') {
                body = inline;
            }
        } else {
            header += renderInlineForSlack(inline);
        }
    }

    header = header.replace(/\*\*([^*]+)\*\*/g, '*$1*');
    return `${header}\n>${body}`;
}

function renderInlineForSlack(inline: ReportInline): string {
    if (typeof inline === 'string') {
        return inline;
    }

    switch (inline.type) {
        case 'link':
            return `<${inline.url}|${inline.text}>`;

        case 'pr-link':
            return `<${inline.url}|${inline.repo}#${inline.prNumber}>`;

        case 'user':
            return `@${inline.name}`;

        case 'emoji':
            return `:${inline.name}:`;

        case 'strikethrough':
            return `~${inline.content.map(c => renderInlineForSlack(c)).join('')}~`;
    }
}
