import { handle } from '../../../../lib/server/context';
import { createMedia } from '../../../../lib/server/media-api';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return handle(() => createMedia(request)); }
