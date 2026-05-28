import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (request.url?.startsWith('/api/auth') || request.url?.startsWith('/auth')) {
      return next.handle();
    }

    const message = this.resolveMessage(request.method, request.route?.path || request.url);
    return next.handle().pipe(map((data) => ({ success: true, message, data })));
  }

  private resolveMessage(method: string, path: string) {
    const resource = path.split('/').filter(Boolean)[0] || 'resource';
    const action = method === 'POST' ? 'created' : method === 'PATCH' ? 'updated' : method === 'DELETE' ? 'deleted' : 'retrieved';
    return `${resource} ${action} successfully`;
  }
}
