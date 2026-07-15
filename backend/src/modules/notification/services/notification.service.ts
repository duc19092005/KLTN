import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { Subject, interval, merge, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface NotificationFilter {
  /** When defined, filters by read state. */
  isRead?: boolean;
  /** Inclusive lower bound on createdAt. */
  from?: Date;
  /** Inclusive upper bound on createdAt (end of day applied by caller). */
  to?: Date;
}

@Injectable()
export class NotificationService {
  private readonly notification$ = new Subject<{ userId: string; notification: any }>();

  constructor(private readonly prisma: PrismaService) {}

  async createNotification(userId: string, title: string, message: string) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        isRead: false,
      },
    });
    this.notification$.next({ userId, notification });
    return notification;
  }

  getNotificationStream(userId: string): Observable<any> {
    const keepAlive$ = interval(30000).pipe(
      map(() => ({ data: { type: 'ping' } }))
    );
    const notifications$ = this.notification$.asObservable().pipe(
      filter((event) => event.userId === userId),
      map((event) => ({ data: event.notification })),
    );
    return merge(keepAlive$, notifications$);
  }

  /**
   * List a user's notifications, newest first, with optional read-state and date-range filters.
   * Works for users of ANY role since notifications are keyed only by userId.
   */
  async getUserNotifications(userId: string, filter: NotificationFilter = {}) {
    const where: Prisma.NotificationWhereInput = { userId };

    if (typeof filter.isRead === 'boolean') {
      where.isRead = filter.isRead;
    }

    if (filter.from || filter.to) {
      if (filter.from && filter.to && filter.from > filter.to) {
        throw new BadRequestException('Khoảng ngày không hợp lệ: ngày bắt đầu sau ngày kết thúc.');
      }
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = filter.from;
      if (filter.to) where.createdAt.lte = filter.to;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Count of unread notifications for the badge. */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Không tìm thấy thông báo.');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /** Mark every unread notification for the user as read. Returns the number updated. */
  async markAllAsRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: res.count };
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Không tìm thấy thông báo.');
    }

    return this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }
}
