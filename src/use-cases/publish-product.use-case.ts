import { GumroadService } from '../services/gumroad.service';
import { getNotionPage, parseNotionPage, updateNotionMetadata } from '../services/notion.service';

/**
 * Main orchestrator executing the full business logic using Notion as the source of truth.
 */
export async function executePublishProductUseCase(notionPageId: string, pageData?: any) {
  const gumroad = new GumroadService();

  let productId: string | undefined;

  try {
    console.log(`[USE-CASE] Executing publish pipeline for Notion page: ${notionPageId}`);

    // Status updates are deferred until the end as requested by the user.

    // 2. Fetch the metadata to publish from Notion
    let rawPage = pageData;
    if (!rawPage) {
      console.log(`[USE-CASE] Step 1: Fetching Notion page ${notionPageId} manually...`);
      rawPage = await getNotionPage(notionPageId);
    } else {
      console.log(`[USE-CASE] Step 1: Using provided Notion page payload...`);
    }

    console.log(`[USE-CASE] Step 2: Parsing Notion properties...`);
    const record = parseNotionPage(rawPage);

    console.log(`[USE-CASE] ---> Parsed Data:`);
    console.log(`[USE-CASE] ---> Title: "${record.title}"`);
    console.log(`[USE-CASE] ---> Description: ${record.description?.length || 0} chars`);
    console.log(`[USE-CASE] ---> Cover URL: ${record.cover_url ? 'Yes' : 'No'}`);
    console.log(`[USE-CASE] ---> Thumb URL: ${record.thumbnail_url ? 'Yes' : 'No'}`);
    console.log(`[USE-CASE] ---> Is Incomplete: ${record.is_incomplete}`);

    // Generate JSON buffer
    const fileBuffer = Buffer.from(JSON.stringify(record.chain_json || {}, null, 2), 'utf-8');
    console.log(`[USE-CASE] ---> JSON File Size: ${fileBuffer.length} bytes`);

    // 3. Draft Gumroad Product
    console.log(`[USE-CASE] Step 3: API Request -> gumroad.createDraft()...`);
    const draft = await gumroad.createDraft(
      record.title,
      record.description
    );

    console.log(`[USE-CASE] ---> Draft created successfully. ID: ${draft.id}`);
    productId = draft.id;

    const shortUrl = draft.short_url;
    // Extract slug e.g. https://.../l/slug
    const urlParts = shortUrl.split('/');
    const slug = urlParts[urlParts.length - 1];

    // Fast-save basic Gumroad info so if it fails midway, users can delete it via Edit Url
    console.log(`[USE-CASE] Step 4: Updating Notion with initial Gumroad data (Slug: ${slug})...`);
    await updateNotionMetadata(
      notionPageId,
      productId || '',
      shortUrl,
      slug,
      'publishing'
    );

    // 4. File Upload (multipart S3 API)
    console.log(`[USE-CASE] Step 5: API Request -> gumroad.uploadMainFile() (Multipart S3)...`);
    const fileUrl = await gumroad.uploadMainFile(fileBuffer, 'chain.json');
    console.log(`[USE-CASE] ---> File uploaded to S3 successfully. URL: ${fileUrl}`);

    // 5. Attach file
    console.log(`[USE-CASE] Step 6: API Request -> gumroad.attachFile()...`);
    await gumroad.attachFile(productId!, fileUrl);
    console.log(`[USE-CASE] ---> File attached successfully.`);

    // 6. Custom Receipt Message (Hardcoded in English)
    const HARDCODED_RECEIPT = "Thank you for your purchase! To use this workflow, please download the attached .json file and import it into your GPTChain extension. If you have any questions, feel free to reach out.";
    console.log(`[USE-CASE] Step 7: API Request -> gumroad.updateProductReceipt()...`);
    await gumroad.updateProductReceipt(productId!, HARDCODED_RECEIPT);

    // 7. Cover + Thumbnails
    if (record.cover_url) {
      console.log(`[USE-CASE] Step 8a: API Request -> gumroad.setCover()...`);
      await gumroad.setCover(productId!, record.cover_url);
    }
    if (record.thumbnail_url) {
      console.log(`[USE-CASE] Step 8b: API Request -> gumroad.setThumbnail()...`);
      await gumroad.setThumbnail(productId!, record.thumbnail_url);
    }

    // 8. Publish to live
    if (record.is_incomplete) {
      console.log(`[USE-CASE] Step 9: Missing fields detected. Skipping gumroad.publish()...`);
      // Update final status to unpublished
      await updateNotionMetadata(
        notionPageId,
        productId!,
        shortUrl,
        slug,
        'unpublished'
      );
      console.log(`[USE-CASE] ---> Pipeline complete. Created as Draft (Unpublished) at ${shortUrl}`);
    } else {
      console.log(`[USE-CASE] Step 9: API Request -> gumroad.publish()...`);
      const liveProd = await gumroad.publish(productId!);
      console.log(`[USE-CASE] ---> Product published live successfully.`);

      // 9. Commit final success
      console.log(`[USE-CASE] Step 10: Updating final statuses ('published') in Notion...`);
      await updateNotionMetadata(
        notionPageId,
        productId!,
        liveProd.short_url,
        slug,
        'published'
      );

      console.log(`[USE-CASE] ---> Pipeline complete. Live at ${liveProd.short_url}`);
    }

  } catch (error: any) {
    console.error('Publish pipeline failed:', error);

    // Reflect error in Notion
    await updateNotionMetadata(notionPageId, productId || '', '', '', 'error');

    throw error;
  }
}
