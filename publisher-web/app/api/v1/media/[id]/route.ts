import { handle } from '../../../../../lib/server/context';
import { finishMedia, inspectMedia, uploadMediaPart } from '../../../../../lib/server/media-api';
export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) { return handle(async () => inspectMedia(request,(await params).id)); }
export async function PUT(request: Request, { params }: Params) { return handle(async () => uploadMediaPart(request,(await params).id)); }
export async function POST(request: Request, { params }: Params) { return handle(async () => finishMedia(request,(await params).id)); }
