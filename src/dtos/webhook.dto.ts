export interface NotionAutomationSource {
  type: string;
  automation_id: string;
  action_id: string;
  event_id: string;
  user_id: string;
  attempt: number;
}

export interface NotionPageData {
  object: 'page';
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, any>;
  url: string;
  [key: string]: any;
}

export interface PublishGumroadWebhookDto {
  source?: NotionAutomationSource;
  data: NotionPageData;
}