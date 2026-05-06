import { GumroadService } from '../services/gumroad.service';
import { getNotionPage, parseNotionPage, updateNotionMetadata } from '../services/notion.service';

/**
 * Main orchestrator executing ONLY the publish of an already existing draft product.
 */
export async function executePublishExistingProductUseCase(notionPageId: string, pageData?: any) {
  const gumroad = new GumroadService();
  
  let productId: string | undefined;

  try {
    console.log(`[USE-CASE] Executing publish existing product pipeline for Notion page: ${notionPageId}`);
    
    // 1. Fetch metadata to get the Gumroad Product ID
    let rawPage = pageData;
    if (!rawPage) {
      console.log(`[USE-CASE] Fetching Notion page...`);
      rawPage = await getNotionPage(notionPageId);
    }
    const record = parseNotionPage(rawPage);
    productId = record.gumroad_product_id;

    if (!productId) {
      throw new Error('This record does not have an associated Gumroad product ID to publish.');
    }

    // 2. Publish (Enable) the product on Gumroad
    console.log(`[USE-CASE] Publishing product ${productId} on Gumroad...`);
    const liveProd = await gumroad.publish(productId);

    // 3. Update Status 
    console.log(`[USE-CASE] Updating final statuses to 'published'...`);
    await updateNotionMetadata(
        notionPageId,
        productId,
        liveProd.short_url || record.public_url || '',
        record.slug || '',
        'published'
    );

    console.log(`Publish existing product pipeline complete for ${notionPageId}. Live at ${liveProd.short_url}`);

  } catch (error: any) {
     console.error('Publish existing pipeline failed:', error);
     throw error;
  }
}
