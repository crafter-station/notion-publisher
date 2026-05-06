import crypto from 'crypto';

const API = 'https://api.gumroad.com/v2';
const GUMROAD_TOKEN = process.env.GUMROAD_TOKEN;

/**
 * Creates a digital product on Gumroad directly via API requests according to the v2 Flow.
 */
export class GumroadService {
  private getAuthBody(extraParams: Record<string, string | number> = {}) {
    const params = new URLSearchParams();
    params.append('access_token', GUMROAD_TOKEN!);
    for (const [k, v] of Object.entries(extraParams)) {
      params.append(k, String(v));
    }
    return params;
  }

  private async safeJson(res: Response, context: string) {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${context} failed HTTP ${res.status}: ${text}`);
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error(`${context} failed to parse JSON HTTP ${res.status}: ${text}`);
    }
  }

  // 1. Create a draft product
  async createDraft(name: string, description: string) {
    const params = this.getAuthBody({
      native_type: 'digital',
      name,
      description,
      price: 0,
      currency: 'usd'
    });

    const res = await fetch(`${API}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await this.safeJson(res, 'createDraft');
    if (!data.success) throw new Error(`Create failed: ${data.message}`);
    return data.product;
  }

  // 2. Presign, S3 Upload, and Complete processing for downloading the main file
  async uploadMainFile(fileBuffer: Buffer, filename: string) {
    const fileSize = fileBuffer.length;

    // Presign
    const presignReq = await fetch(`${API}/files/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: this.getAuthBody({ filename, file_size: fileSize }).toString()
    });

    const presignData = await this.safeJson(presignReq, 'presign');
    if (!presignData.success) throw new Error(`Presign failed: ${presignData.message}`);

    const s3Url = presignData.parts[0].presigned_url;
    const partNumber = presignData.parts[0].part_number;

    // Direct PUT to S3
    const s3Res = await fetch(s3Url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: new Uint8Array(fileBuffer)
    });

    if (!s3Res.ok) throw new Error(`S3 direct upload failed HTTP ${s3Res.status}`);
    let etag = s3Res.headers.get('etag') || s3Res.headers.get('ETag');
    if (!etag) throw new Error('ETag missing from S3 response header');

    // Complete
    const completeParams = this.getAuthBody({
      upload_id: presignData.upload_id,
      key: presignData.key,
      'parts[][part_number]': partNumber,
      'parts[][etag]': etag,
    });

    const completeReq = await fetch(`${API}/files/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: completeParams.toString()
    });

    const completeData = await this.safeJson(completeReq, 'completeUpload');
    if (!completeData.success) throw new Error(`Complete failed: ${completeData.message}`);

    return completeData.file_url;
  }

  // 3. Attach file to product
  async attachFile(productId: string, fileUrl: string) {
    const params = this.getAuthBody({
      'files[][url]': fileUrl
    });

    const res = await fetch(`${API}/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const data = await this.safeJson(res, 'attachFile');
    if (!data.success) throw new Error(`Attach failed: ${data.message}`);
  }

  // 4. Add cover via URL
  async setCover(productId: string, coverUrl: string) {
    const params = this.getAuthBody({ url: coverUrl });
    const res = await fetch(`${API}/products/${productId}/covers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    try {
      const data = await this.safeJson(res, 'setCover');
      if (!data.success) console.warn('Cover set failed', data.message);
    } catch (e: any) {
      console.warn('Cover set API failed:', e.message);
    }
  }

  // 5. Add thumbnail via URL
  async setThumbnail(productId: string, thumbUrl: string) {
    const params = this.getAuthBody({ url: thumbUrl });
    const res = await fetch(`${API}/products/${productId}/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    try {
      const data = await this.safeJson(res, 'setThumbnail');
      if (!data.success) {
        console.warn('Thumbnail set failed:', data.message);
      }
    } catch (e: any) {
      console.warn('Thumbnail set API failed:', e.message);
    }
  }

  // 6. Enable / Publish product
  async publish(productId: string) {
    const params = this.getAuthBody();
    const res = await fetch(`${API}/products/${productId}/enable`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const data = await this.safeJson(res, 'publish');
    if (!data.success) throw new Error(`Publish failed: ${data.message}`);
    return data.product;
  }

  // 7. Disable / Unpublish product
  async unpublish(productId: string) {
    const params = this.getAuthBody();
    const res = await fetch(`${API}/products/${productId}/disable`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const data = await this.safeJson(res, 'unpublish');
    if (!data.success) throw new Error(`Unpublish failed: ${data.message}`);
    return data.product;
  }

  // 8. Update product receipt
  async updateProductReceipt(productId: string, custom_receipt: string) {
    const params = this.getAuthBody({ custom_receipt });
    const res = await fetch(`${API}/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const data = await this.safeJson(res, 'updateProductReceipt');
    if (!data.success) console.warn('Update receipt failed', data.message);
  }
}
