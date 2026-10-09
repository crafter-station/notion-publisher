import { redditConnections } from './reddit-connections';
import { postizConnections } from './postiz-connections';
import { typefullyConnections } from './typefully-connections';
import {
  postlyConnections,
  identityConnections,
} from './connections';
export const connectionReaders = {
      postly: postlyConnections,
      postiz: postizConnections,
      typefully: typefullyConnections,
      reddit: redditConnections,
      gumroad: () => identityConnections('gumroad'),
      luma: () => identityConnections('luma'),
      github: () => identityConnections('github'),
      skool: () => identityConnections('skool'),
    };
