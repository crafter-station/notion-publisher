import { context, handle, respond } from '../../../../lib/server/context';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return handle(async () => {
    const { workspaceId, userId, email, role } = await context(request);
    return respond({ workspaceId, userId, email, role });
  });
}
