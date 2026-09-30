import { handle } from '../../../../../../lib/server/context';
import { verifyPublicationSet } from '../../../../../../lib/server/publication-sets';
export const dynamic = 'force-dynamic';
export const GET = (request: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => verifyPublicationSet(request, (await params).id));
