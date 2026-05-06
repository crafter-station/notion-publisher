import 'dotenv/config';

/**
 * Validates and exports environment variables.
 * If a required variable is missing, the process will exit immediately.
 */

const requiredVars = ['NOTION_TOKEN', 'GUMROAD_TOKEN'] as const;

export const env = {
  NOTION_TOKEN: process.env.NOTION_TOKEN!,
  GUMROAD_TOKEN: process.env.GUMROAD_TOKEN!,
  PORT: Number(process.env.PORT) || 3000,
};

// Validation logic
const missingVars: string[] = [];

for (const key of requiredVars) {
  if (!process.env[key]) {
    missingVars.push(key);
  }
}

if (missingVars.length > 0) {
  console.error('\n❌ [FATAL ERROR] Missing required environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  console.error('\nPlease check your .env file or deployment environment variables.\n');
  process.exit(1);
}
