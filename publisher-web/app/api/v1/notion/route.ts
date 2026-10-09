import { context, handle, respond } from '../../../../lib/server/context';
import { notionInventory } from '../../../../lib/server/notion';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return handle(async () => {
    await context(request);
    return respond(
      await notionInventory(
        new URL(request.url).searchParams.get('cursor') || undefined,
      ),
    );
  });
}
