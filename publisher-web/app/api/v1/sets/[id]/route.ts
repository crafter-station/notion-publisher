import { handle } from '../../../../../lib/server/context';
import {
  getPublicationSet,
  updatePublicationSet,
} from '../../../../../lib/server/publication-sets';
type Params = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';
export const GET = (request: Request, { params }: Params) =>
  handle(async () => getPublicationSet(request, (await params).id));
export const PATCH = (request: Request, { params }: Params) =>
  handle(async () => updatePublicationSet(request, (await params).id));
