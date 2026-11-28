import { type SectionFaults } from './section-faults';

type ReleaseParams = { readonly token: string; readonly section: string };

export function serveRelease(
  getFaults: () => SectionFaults,
): (request: Request, context: { params: Promise<ReleaseParams> }) => Promise<Response> {
  return async (_request, { params }) => {
    const { token, section } = await params;
    return getFaults().release(token, section)
      ? new Response(null, {
          status: 204,
          headers: { 'cache-control': 'no-store' },
        })
      : new Response(null, { status: 404 });
  };
}
