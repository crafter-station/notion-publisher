# Notion Publisher Service (Gumroad & Postly)

This backend microservice acts as the main automation engine between **Notion**, **Gumroad**, and **Postly**. It transforms your Notion database into a complete CMS (Content Management System) that allows you to:
1. Create, publish, and unpublish digital products (GPT-Chain JSON files) directly to Gumroad.
2. Automate and synchronize multi-platform social media publishing (Instagram, Facebook, etc.) via Postly without leaving the Notion interface.

## ⚙️ 1. Initial Configuration

### Environment Variables (`.env`)
You must have a `.env` file in the root of this project configured with the following access tokens:

```env
# Internal Notion Integration (Must be invited to the database)
NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxx

# Gumroad API v2 Token
GUMROAD_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxx

# Postly API Key & Configuration
POSTLY_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx
POSTLY_WORKSPACE_ID=xxxxxxxxxxxxxxxxxxxxxxxxx
POSTLY_TARGET_PLATFORMS=platformId1,platformId2
```

## 📊 2. Exact Structure in Notion
The service reads and writes properties automatically. Your Notion database **must contain** the following properties (case-sensitive):

### Input Properties (What you fill in)
- **`Gumroad Title`** *(Rich Text)*: The product title. (If omitted, it will try to use `Prompt Chain Template Name`).
- **`Landing Page Copy`** *(Rich Text)*: The descriptive text that will appear in the Gumroad store.
- **`Template`** *(Rich Text)*: **VERY IMPORTANT**. Paste your valid JSON code here. Due to Notion limits, if the JSON is very long, Notion will split it into several fragments, but this service will automatically reassemble them.
- **`Gumroad Cover`** *(Files & media)*: Promotional cover image.
- **`Gumroad Thumbnail`** *(Files & media)*: Square thumbnail for the Gumroad feed.

### Output Properties (What the bot fills in)
*The bot will update these columns automatically upon completing the process.*
- **`Gumroad Publish Status`** *(Status)*: Reflects the final state (`Not started`, `Unpublished`, `Published`, `Failed`).
- **`Gumroad Product ID`** *(Rich Text)*: The secret internal Gumroad ID. (Used for unpublishing later).
- **`Gumroad URL`** *(URL)*: The public short link to sell the product.
- **`Gumroad Edit URL`** *(URL)*: Direct link to the administration panel for that specific product in Gumroad.

---

## 🚀 3. Daily Usage Flow

### A. To Publish a New Product
1. Enter your Notion database.
2. Fill in the **Title**, **Description**, and upload the **Cover** / **Thumbnail**.
3. **Paste your JSON code into the `Template` cell.**
4. Trigger your Notion automation (e.g., by changing a tag or moving the card to the "Publishing" column).
5. Done! In a few seconds, you will see the URL fields in Notion fill up automatically, and the status will change to `Published`.

### B. Error Prevention System (Draft Mode)
What happens if you forget to add the JSON, the Title, or accidentally paste plain text into `Template`?
- The system is smart: it will detect that the data is incomplete.
- It will upload everything to Gumroad but leave it as a **Draft**.
- In Notion, it will mark the product as **`Unpublished`**.
- This protects your database from selling broken products. To fix it, simply paste the correct JSON in Notion and run the automation again.

### C. To Unpublish a Product
If you decide to temporarily withdraw a product from sale:
1. Trigger the unpublish webhook (to the `/webhooks/unpublish-gumroad` route).
2. The system will read the `Gumroad Product ID` from Notion, go to Gumroad, and disable the product.
3. The status in Notion will return to `Unpublished`.

---

## 💻 4. Local Development Commands

If you need to make technical adjustments to the code in the future:

- **Install dependencies:** `npm install`
- **Compile Typescript to JS:** `npm run build`
- **Start development server:** `npm run dev`

### Log Monitoring
During automations, the server will output an extremely detailed step-by-step log, ideal for debugging:

#### Gumroad Publisher Logs
```text
[INFO] Starting background job...
[USE-CASE] Step 1: Using provided Notion page payload...
[USE-CASE] Step 2: Parsing Notion properties...
[USE-CASE] ---> Title: "Meme Generator"
[USE-CASE] ---> Description: 712 chars
[USE-CASE] ---> Is Incomplete: false
[USE-CASE] Step 3: API Request -> gumroad.createDraft()...
[USE-CASE] Step 5: API Request -> gumroad.uploadMainFile() (Multipart S3)...
[USE-CASE] Step 8: API Request -> gumroad.publish()...
[USE-CASE] ---> Product published live successfully.
```

---

## 🌐 5. Local Deployment with ngrok (Webhooks)

For Notion to send data to your local computer during development, you need a public URL. We will use **ngrok** for this.

### 1. Start the local server
Make sure your service is running on port 3000:
```bash
npm run dev
```

### 2. Expose the port with ngrok
In a new terminal, run:
```bash
ngrok http 3000
```
This will give you a URL similar to `https://xxxx-xxx-xxx.ngrok-free.app`.

### 3. Configure the endpoint in Notion
Copy the URL generated by ngrok and update your Notion automation or the service triggering the webhook:

- **Creation/Publication Endpoint**: `https://your-ngrok-url.app/webhooks/publish-gumroad`
- **Unpublication Endpoint**: `https://your-ngrok-url.app/webhooks/unpublish-gumroad`
- **Postly Social Publishing**: `https://your-ngrok-url.app/webhooks/publish-postly`

> [!IMPORTANT]
> Every time you restart ngrok (if using the free version), the URL will change, and you must update it in Notion.

---

## 📱 6. Postly Social Media Automation

This service includes a robust webhook for scheduling and verifying social media posts via the Postly API, directly from Notion automations.

### 6.1. Exact Structure in Notion
For the Postly integration, your Notion database must contain:

**Input Properties (What you fill in)**
- **`Instagram Caption`** *(Rich Text)*: The description, text, and hashtags for your post.
- **`Video`** *(Files & media)*: The media file (image or `.mp4` video) to be published.

**Output Properties (What the bot fills in)**
- **`Instagram Status`** *(Status)*: Reflects the publishing state (`Not started`, `In progress`, `Failed`, `Published`).
- **`Instagram URL`** *(URL)*: The live URL of the published post(s).
- **`Post ID`** *(Rich Text)*: The external platform IDs.

### 6.2. Advanced Platform Targeting
By default, triggering `/webhooks/publish-postly` will publish to **all** platforms listed in your `POSTLY_TARGET_PLATFORMS` environment variable.

You can selectively target platforms by passing their index in a query parameter. For example, if `POSTLY_TARGET_PLATFORMS=instagramId,facebookId`:
- `.../webhooks/publish-postly?target=0` publishes only to Instagram.
- `.../webhooks/publish-postly?target=1` publishes only to Facebook.
- `.../webhooks/publish-postly?target=0,1` publishes to both.

### 6.3. Asynchronous Polling & Aggregation
When the webhook is triggered:
1. The service detects if your media is an image or an `.mp4` video and formats the Postly payload correctly.
2. It sends the post to Postly and immediately responds to Notion with a `202 Accepted` to prevent timeouts.
3. In the background, it implements an **exponential backoff polling loop** (`[30s, 10s, 20s, 30s, 40s, 50s, 60s]`) to continuously check the status of your post across all selected platforms.
4. Once all platforms resolve, it concatenates the resulting URLs and Post IDs (separated by commas) and synchronizes them directly back to your Notion row.

### 6.4. Postly Log Monitoring
When Postly automations trigger, you can see exactly which phase is currently executing in your terminal:

```text
[2026-05-07T17:22:08.777Z] POST /webhooks/publish-postly?target=0 accessed.
[INFO] Starting background job for executePublishPostlyUseCase (notionPageId: 23bda243..., platforms: 1)
[POSTLY-USE-CASE] Starting pipeline for Notion page: 23bda243...
[POSTLY-USE-CASE] Phase 1: Initializing Notion properties...
[POSTLY-USE-CASE] Phase 2: Creating post in Postly...
[POSTLY-USE-CASE] Post accepted. Waiting 3s to fetch its internal ID...
[POSTLY-USE-CASE] Post found. Internal ID: 69fcca47e547e107fd000000
[POSTLY-USE-CASE] Phase 3: Wait 30s before attempt 1...
[POSTLY-USE-CASE] Attempt 1: Fetching post status...
[POSTLY-USE-CASE] All platforms resolved.
[POSTLY-USE-CASE] Phase 6: Final Notion update...
[POSTLY-USE-CASE] Pipeline finished with IG status: Published
```
