import { Report, ReportBlock, ReportInline } from './types';

export function renderMarkdown(report: Report): string {
    return report.map(block => renderBlock(block)).join('\n');
}

function renderBlock(block: ReportBlock): string {
    switch (block.type) {
        case 'header':
            const emoji = block.emoji ? `:${block.emoji}: ` : '';
            return `\n## ${emoji}${block.text}`;

        case 'section':
            return renderInlineArray(block.content);

        case 'list':
            return block.items.map(item => `- ${renderInlineArray(item)}`).join('\n');

        case 'divider':
            return '\n---';

        case 'context':
            return '\n' + renderInlineArray(block.content);
    }
}

function renderInlineArray(content: ReportInline[]): string {
    return content.map(inline => renderInline(inline)).join('');
}

function renderInline(inline: ReportInline): string {
    if (typeof inline === 'string') {
        return inline;
    }

    switch (inline.type) {
        case 'link':
            return `[${inline.text}](${inline.url})`;

        case 'user':
            return `@${inline.name}`;

        case 'emoji':
            return `:${inline.name}:`;

        case 'strikethrough':
            return `~~${renderInlineArray(inline.content)}~~`;
    }
}
