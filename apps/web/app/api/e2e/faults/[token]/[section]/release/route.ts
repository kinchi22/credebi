import { getContainer } from '../../../../../../../server/container';
import { serveRelease } from '../../../../../../../server/section-fault-release';

export const dynamic = 'force-dynamic';

export const POST = serveRelease(() => getContainer().sectionFaults);
