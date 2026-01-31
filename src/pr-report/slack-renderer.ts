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

function renderInlineForSlack(inline: ReportInline): string {
    if (typeof inline === 'string') {
        return inline;
    }

    switch (inline.type) {
        case 'link':
            return `<${inline.url}|${inline.text}>`;

        case 'user':
            return `@${inline.name}`;

        case 'emoji':
            return `:${inline.name}:`;

        case 'strikethrough':
            return `~${inline.content.map(c => renderInlineForSlack(c)).join('')}~`;
    }
}
