import { redditConnections } from '../../../../../lib/server/reddit-connections';
import { context, handle, respond } from '../../../../../lib/server/context';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return handle(async () => {
    await context(request);
    return respond(await redditConnections());
  });
}
