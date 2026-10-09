import {
  MEDIA_PART_BYTES,
  MAX_MEDIA_BYTES,
} from '../../../../lib/server/private-media';
import { redditSettings } from '../../../../lib/channel-settings';
import {
  postizFields,
  postizVersionKey,
} from '../../../../lib/postiz-versions';
import { context, handle, respond } from '../../../../lib/server/context';
import { channelCatalog } from '../../../../lib/channels';
import { threadChannels } from '../../../../lib/thread-content';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return handle(async () => {
    await context(request);
    return respond({
      items: channelCatalog.map((channel) => ({
        ...channel,
        authoring: {
          text: true,
          channelSettings:
            channel.id === 'Reddit'
              ? Object.entries(redditSettings).map(([key, spec]) => ({
                  field: `channelSettings.${key}`,
                  type: 'string',
                  maxCharacters: spec.max,
                  notionField: spec.notion,
                  ...(key === 'reddit_kind'
                    ? { enum: ['', 'self', 'link'] }
                    : {}),
                  ...(key === 'reddit_link'
                    ? { format: 'http-url-without-credentials' }
                    : {}),
                }))
              : [],
          providerVersions: postizFields[channel.id]
            ? [
                {
                  provider: 'postiz',
                  field: `versions.${postizVersionKey(channel.id)}`,
                  notionField: postizFields[channel.id],
                  fallback: [`versions.${channel.id}`, 'body'],
                },
              ]
            : [],
          threadComposer: threadChannels.includes(channel.id),
          threadStorage: threadChannels.includes(channel.id)
            ? { field: `versions.${channel.id}`, separator: '\n\n\n\n' }
            : null,
          media: false,
          nativePreview: false,
          publishing: false,
        },
      })),
      privateMedia: {
        scope: 'draft-storage-only',
        create: {
          method: 'POST',
          path: '/api/v1/media',
          required: [
            'draftId',
            'idempotencyKey',
            'fileName',
            'size',
            'declaredType',
          ],
        },
        inspect: { method: 'GET', path: '/api/v1/media/{id}' },
        uploadPart: {
          method: 'PUT',
          path: '/api/v1/media/{id}?part={number}',
          body: 'binary',
          firstPart: 1,
        },
        complete: { method: 'POST', path: '/api/v1/media/{id}' },
        download: {
          method: 'GET',
          path: '/api/v1/media/{id}?download=1',
          authenticationRequired: true,
        },
        partBytes: MEDIA_PART_BYTES,
        maxBytes: MAX_MEDIA_BYTES,
        attachmentField: 'mediaIds',
        attachmentRequiresDraftRevision: true,
        attachmentInvalidatesApproval: true,
        declaredMimePrefixes: ['image/', 'video/', 'audio/'],
        contentValidation: false,
        providerTransfer: false,
        readyMeans:
          'stored privately; not validated for a channel or published',
      },
      coverage: 'mapped',
      publishingVerified: false,
    });
  });
}
