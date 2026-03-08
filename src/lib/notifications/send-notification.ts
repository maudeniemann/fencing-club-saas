import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface SendNotificationParams {
  recipientMemberId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  relatedConversationId?: string;
  sendEmail?: boolean;
  sendSMS?: boolean;
}

/**
 * Send notification to a club member
 * Supports in-app, email, and SMS channels
 */
export async function sendNotification({
  recipientMemberId,
  type,
  title,
  body,
  data = {},
  relatedConversationId,
  sendEmail = false,
  sendSMS = false,
}: SendNotificationParams) {
  const admin = createAdminClient();

  // Get recipient details
  const { data: member } = await admin
    .from('club_members')
    .select('club_id, display_name, phone')
    .eq('id', recipientMemberId)
    .single();

  if (!member) {
    console.error(`Member not found: ${recipientMemberId}`);
    return null;
  }

  // Get user email from auth
  const { data: authUser } = await admin.auth.admin.getUserById(recipientMemberId);
  const userEmail = authUser?.user?.email;

  // Create in-app notification
  const { data: notification, error: notifError } = await admin
    .from('notifications')
    .insert({
      club_id: member.club_id,
      recipient_member_id: recipientMemberId,
      type,
      title,
      body,
      data,
      related_conversation_id: relatedConversationId || null,
      channel: 'in_app',
    })
    .select()
    .single();

  if (notifError) {
    console.error('Failed to create notification:', notifError);
    return null;
  }

  // Send email if requested and resend is configured
  if (sendEmail && userEmail && resend) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'notifications@fencingclub.com',
        to: userEmail,
        subject: title,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${title}</h2>
            <p style="color: #666; line-height: 1.6;">${body}</p>
            <p style="margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}"
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View in App
              </a>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This is an automated message from your fencing club management system.
            </p>
          </div>
        `,
      });

      // Update notification record
      await admin
        .from('notifications')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', notification.id);
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  }

  // TODO: Implement SMS via Twilio if sendSMS is true
  if (sendSMS && member.phone) {
    // Implement Twilio SMS here in the future
    // const twilioClient = new Twilio(accountSid, authToken);
    // await twilioClient.messages.create({
    //   body: `${title}: ${body}`,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: member.phone,
    // });
    //
    // await admin
    //   .from('notifications')
    //   .update({ sms_sent_at: new Date().toISOString() })
    //   .eq('id', notification.id);
    console.log('SMS notifications not yet implemented');
  }

  return notification;
}
