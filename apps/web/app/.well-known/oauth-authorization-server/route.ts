import { discoveryResponse } from '../../../server/mcp';

export function GET(request: Request): Response {
  return discoveryResponse(request);
}
