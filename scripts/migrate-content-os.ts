/**
 * Map legacy Publisher rows (or a snapshot JSON) onto Content OS
 * 🧩 Piezas + 🚀 Publicaciones. --dry-run is the default. No env required.
 *
 *   npm run migrate-content-os -- --snapshot=./exports/publisher-snapshot.json
 *   npm run migrate-content-os -- --snapshot=./snap.json --offline
 *   npm run migrate-content-os -- --snapshot=./snap.json --live
 *
 * Does not import src/config/env.ts. --live needs NOTION_TOKEN only.
 */
import { main } from '../src/services/migrate-content-os-cli';

if (require.main === module) {
  main(process.argv).then(code => {
    process.exit(code);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
