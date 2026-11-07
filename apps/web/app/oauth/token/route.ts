import { getContainer } from '../../../server/container';
import { serveToken } from '../../../server/oauth-token';

export const POST = serveToken(getContainer);
