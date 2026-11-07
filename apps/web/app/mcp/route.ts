import { NO_LIVE_ACCESS_TOKEN, serveMcp } from '../../server/mcp';

const serve = serveMcp(NO_LIVE_ACCESS_TOKEN);

export const GET = serve;

export const POST = serve;

export const DELETE = serve;
