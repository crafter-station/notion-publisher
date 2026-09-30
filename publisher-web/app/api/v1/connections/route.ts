import { ApiError, context, handle, respond } from '../../../../lib/server/context';
import { connectionReaders as readers } from '../../../../lib/server/connection-readers';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return handle(async () => {
    await context(request);
    const provider = new URL(request.url).searchParams.get('provider');
    if (provider !== null && !Object.hasOwn(readers, provider))
      throw new ApiError(400, 'invalid_provider', 'El proveedor no es válido.');
    const selected = provider === null
      ? Object.values(readers)
      : [readers[provider as keyof typeof readers]];
    return respond({ items: await Promise.all(selected.map((read) => read())) });
  });
}
