import { Controller, Delete, Get, Param, Patch, Query, UseGuards, Sse, MessageEvent } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { NotificationService, NotificationFilter } from '../services/notification.service';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable } from 'rxjs';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Sse('sse')
  @ApiOperation({ summary: 'Stream notifications to current user in real-time' })
  streamNotifications(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.notificationService.getNotificationStream(user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user (filter by read state / date range)' })
  async getMyNotifications(@CurrentUser() user: AuthUser, @Query() query: NotificationQueryDto) {
    const filter: NotificationFilter = {};
    if (query.isRead === 'true') filter.isRead = true;
    else if (query.isRead === 'false') filter.isRead = false;

    if (query.from) {
      const from = new Date(query.from);
      from.setHours(0, 0, 0, 0);
      filter.from = from;
    }
    if (query.to) {
      const to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
      filter.to = to;
    }
    return this.notificationService.getUserNotifications(user.sub, filter);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get the number of unread notifications for current user' })
  async unreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationService.getUnreadCount(user.sub);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async readAll(@CurrentUser() user: AuthUser) {
    return this.notificationService.markAllAsRead(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async readNotification(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationService.markAsRead(id, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async deleteNotification(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationService.deleteNotification(id, user.sub);
  }
}
