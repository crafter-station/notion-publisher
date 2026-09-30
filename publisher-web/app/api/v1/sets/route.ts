import { handle } from '../../../../lib/server/context';
import {
  listPublicationSets,
  createPublicationSet,
} from '../../../../lib/server/publication-sets';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) =>
  handle(() => listPublicationSets(request));
export const POST = (request: Request) =>
  handle(() => createPublicationSet(request));
