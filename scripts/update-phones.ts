// Update club_members with phone numbers extracted from popover details
// Run after scrape-popovers-only.ts

import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, CLUB_ID } from './lib/supabase-admin';
import { NameMatcher, type MemberInfo } from './lib/name-matcher';

const DATA_DIR = path.join(__dirname, 'data');

async function main() {
  const supabase = createAdminClient();
  console.log('=== UPDATING MEMBER PHONE NUMBERS ===\n');

  // Load popover details
  const popoverPath = path.join(DATA_DIR, 'popover-details.json');
  if (!fs.existsSync(popoverPath)) {
    console.error('popover-details.json not found. Run scrape-popovers-only.ts first.');
    process.exit(1);
  }
  const popovers: Array<{ popover_ref: string; instructor: string; student: string; date: string; details: string }> =
    JSON.parse(fs.readFileSync(popoverPath, 'utf-8'));

  // Extract name → phone mapping
  const phoneMap = new Map<string, string>();
  for (const p of popovers) {
    const phoneMatch = p.details.match(/href="tel:(\d+)"/);
    const nameMatch = p.details.match(/<\/a>\s*\r?\n?\s*([^<\r\n]+?)\s*\r?\n?\s*<\/h6>/m);
    if (phoneMatch && nameMatch) {
      const name = nameMatch[1].trim();
      const phone = phoneMatch[1];
      if (name && phone && !phoneMap.has(name)) {
        phoneMap.set(name, phone);
      }
    }
  }
  console.log(`Extracted ${phoneMap.size} unique name→phone mappings\n`);

  // Load all members for name matching
  const { data: members, error: memberError } = await supabase
    .from('club_members')
    .select('id, display_name, role, phone')
    .eq('club_id', CLUB_ID)
    .eq('is_active', true);

  if (memberError || !members) {
    console.error(`Failed to load members: ${memberError?.message}`);
    process.exit(1);
  }

  const matcher = new NameMatcher(members as MemberInfo[]);

  // Match and update
  let updated = 0;
  let alreadyHasPhone = 0;
  let noMatch = 0;

  for (const [name, phone] of phoneMap) {
    const match = matcher.match(name);
    if (!match) {
      noMatch++;
      console.log(`  No match: "${name}" → ${phone}`);
      continue;
    }

    // Check if member already has a phone number
    const member = members.find((m) => m.id === match.member.id);
    if (member?.phone) {
      alreadyHasPhone++;
      continue;
    }

    // Format phone: add +1 prefix for US numbers
    const formattedPhone = phone.length === 10 ? `+1${phone}` : `+${phone}`;

    const { error } = await supabase
      .from('club_members')
      .update({ phone: formattedPhone })
      .eq('id', match.member.id);

    if (error) {
      console.error(`  Failed to update ${name}: ${error.message}`);
    } else {
      updated++;
      console.log(`  Updated: ${match.member.display_name} → ${formattedPhone} (${match.confidence})`);
    }
  }

  console.log(`\n=== PHONE UPDATE COMPLETE ===`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Already had phone: ${alreadyHasPhone}`);
  console.log(`  No name match: ${noMatch}`);

  // Show coverage
  const { data: withPhone } = await supabase
    .from('club_members')
    .select('id', { count: 'exact' })
    .eq('club_id', CLUB_ID)
    .not('phone', 'is', null);

  const { data: total } = await supabase
    .from('club_members')
    .select('id', { count: 'exact' })
    .eq('club_id', CLUB_ID);

  console.log(`  Members with phone: ${withPhone?.length ?? 0} / ${total?.length ?? 0}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
