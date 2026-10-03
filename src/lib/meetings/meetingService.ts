import { prisma } from '../prisma';
import { CalendarProviderFactory } from './calendarProvider';

export interface ScheduleMeetingInput {
  meetingId?: string;
  leadId: string;
  campaignId?: string;
  replyId?: string;
  title?: string;
  startTime: Date | string;
  endTime?: Date | string;
  attendeeEmail: string;
  attendeeName?: string;
  notes?: string;
}

export class MeetingService {
  /**
   * Confirms and schedules a meeting for a prospect.
   */
  static async scheduleMeeting(input: ScheduleMeetingInput) {
    const start = new Date(input.startTime);
    const end = input.endTime ? new Date(input.endTime) : new Date(start.getTime() + 30 * 60 * 1000);

    const business = await prisma.business.findUnique({
      where: { id: input.leadId },
    });

    const title = input.title || `Introductory Call with ${business?.name || 'Prospect'}`;
    const provider = CalendarProviderFactory.getProvider();

    // 1. Dispatch to Calendar Provider
    const calResult = await provider.createEvent({
      title,
      startTime: start,
      endTime: end,
      attendeeEmail: input.attendeeEmail,
      attendeeName: input.attendeeName || business?.name,
      meetingLocation: 'Google Meet',
    });

    // 2. Persist in Meeting table
    let meeting;
    if (input.meetingId) {
      meeting = await prisma.meeting.update({
        where: { id: input.meetingId },
        data: {
          title,
          status: calResult.status,
          startTime: start,
          endTime: end,
          meetingUrl: calResult.meetingUrl,
          calendarProvider: calResult.provider,
          calendarEventId: calResult.calendarEventId,
          notes: input.notes,
        },
      });
    } else {
      meeting = await prisma.meeting.create({
        data: {
          leadId: input.leadId,
          campaignId: input.campaignId,
          replyId: input.replyId,
          title,
          status: calResult.status,
          startTime: start,
          endTime: end,
          meetingUrl: calResult.meetingUrl,
          calendarProvider: calResult.provider,
          calendarEventId: calResult.calendarEventId,
          attendeeEmail: input.attendeeEmail,
          attendeeName: input.attendeeName || business?.name,
          notes: input.notes,
        },
      });
    }

    // 3. Update business status
    await prisma.business.update({
      where: { id: input.leadId },
      data: { status: 'Meeting Scheduled' },
    }).catch(() => {});

    // 4. Log Event
    await prisma.emailEvent.create({
      data: {
        campaignId: input.campaignId,
        leadId: input.leadId,
        eventType: 'MEETING_BOOKED',
        provider: calResult.provider,
        metadata: JSON.stringify({
          meetingId: meeting.id,
          startTime: start.toISOString(),
          meetingUrl: calResult.meetingUrl,
        }),
      },
    });

    return {
      success: true,
      meeting,
      calendarResult: calResult,
    };
  }

  /**
   * Retrieves all meetings with lead details.
   */
  static async getMeetings(statusFilter?: string) {
    return prisma.meeting.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            category: true,
            city: true,
            phone: true,
            email: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Cancels a scheduled meeting.
   */
  static async cancelMeeting(meetingId: string, reason?: string) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) throw new Error('Meeting not found.');

    if (meeting.calendarEventId) {
      const provider = CalendarProviderFactory.getProvider();
      await provider.cancelEvent(meeting.calendarEventId).catch(() => {});
    }

    return prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'CANCELLED',
        notes: reason ? `${meeting.notes || ''} [Cancelled: ${reason}]` : meeting.notes,
      },
    });
  }
}
