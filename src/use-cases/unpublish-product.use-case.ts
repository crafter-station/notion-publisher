import { GumroadService } from '../services/gumroad.service';
import { getNotionPage, parseNotionPage, updateNotionMetadata } from '../services/notion.service';

/**
 * Orchestrator to unpublish an existing product.
 */
export async function executeUnpublishProductUseCase(notionPageId: string, pageData?: any) {
  const gumroad = new GumroadService();

  try {
    console.log(`[USE-CASE] Executing unpublish pipeline for Notion page: ${notionPageId}`);
    
    // 1. Fetch metadata to get the Gumroad Product ID
    let rawPage = pageData;
    if (!rawPage) {
      console.log(`[USE-CASE] Fetching Notion page...`);
      rawPage = await getNotionPage(notionPageId);
    }
    const record = parseNotionPage(rawPage);
    const productId = record.gumroad_product_id;

    if (!productId) {
      throw new Error('This record does not have an associated Gumroad product ID.');
    }

    // 2. Unpublish from Gumroad
    console.log(`[USE-CASE] Unpublishing product ${productId} on Gumroad...`);
    await gumroad.unpublish(productId);

    // 3. Update Status (Fallback to unpublished)
    console.log(`[USE-CASE] Updating final statuses to 'unpublished'...`);
    await updateNotionMetadata(
        notionPageId,
        productId,
        record.public_url || '',
        record.slug || '',
        'unpublished'
    );

    console.log(`Unpublish pipeline complete for ${notionPageId}.`);

  } catch (error: any) {
     console.error('Unpublish pipeline failed:', error);
     throw error;
  }
}
