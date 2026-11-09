import { getContainer } from '../../server/container';
import { serveMcp } from '../../server/mcp';

const serve = serveMcp(getContainer);

export const GET = serve;

export const POST = serve;

export const DELETE = serve;
