import axios from 'axios';
import { SlackBlock } from './slack-renderer';

const SLACK_API_URL = 'https://slack.com/api/chat.postMessage';

export async function postToSlack(blocks: SlackBlock[], channel: string): Promise<void> {
    const token = process.env.SLACK_BOT_TOKEN;

    if (!token) {
        throw new Error(
            'SLACK_BOT_TOKEN environment variable is not set.\n' +
            'To post to Slack, you need to:\n' +
            '1. Create a Slack app at https://api.slack.com/apps\n' +
            '2. Add Bot Token Scopes: chat:write, chat:write.public\n' +
            '3. Install the app to your workspace\n' +
            '4. Copy the Bot User OAuth Token to your .env file as SLACK_BOT_TOKEN'
        );
    }

    try {
        const response = await axios.post(
            SLACK_API_URL,
            {
                channel,
                blocks,
                text: 'PR Review Report',
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.data.ok) {
            const error = response.data.error;
            if (error === 'channel_not_found') {
                throw new Error(
                    `Slack channel "${channel}" not found.\n` +
                    'Make sure the channel exists and the bot has been invited to it,\n' +
                    'or use the chat:write.public scope for public channels.'
                );
            }
            if (error === 'not_in_channel') {
                throw new Error(
                    `Bot is not in channel "${channel}".\n` +
                    'Invite the bot to the channel with /invite @your-bot-name,\n' +
                    'or use the chat:write.public scope for public channels.'
                );
            }
            if (error === 'invalid_auth' || error === 'not_authed') {
                throw new Error(
                    'Invalid Slack bot token.\n' +
                    'Check that SLACK_BOT_TOKEN in your .env file is correct.'
                );
            }
            throw new Error(`Slack API error: ${error}`);
        }

        console.log(`Report posted to Slack channel: ${channel}`);
    } catch (error) {
        const err = error as any;
        if (err.response) {
            throw new Error(`Slack API request failed: ${err.response.status} ${err.response.statusText}`);
        }
        throw error;
    }
}
