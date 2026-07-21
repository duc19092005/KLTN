import { Global, Module } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { MAIL_CONFIG, MAIL_TRANSPORTER, TEMPORARY_CREDENTIAL_MAILER } from './email.constants';
import { loadMailConfig } from './email.config';
import { MailConfig } from './email.types';
import { TemporaryCredentialMailService } from './temporary-credential-mail.service';

@Global()
@Module({
  providers: [
    { provide: MAIL_CONFIG, useFactory: loadMailConfig },
    {
      provide: MAIL_TRANSPORTER,
      inject: [MAIL_CONFIG],
      useFactory: (config: MailConfig) =>
        config.mode === 'json'
          ? nodemailer.createTransport({ jsonTransport: true })
          : nodemailer.createTransport({
              host: config.host,
              port: config.port,
              secure: config.secure,
              auth: { user: config.user, pass: config.pass },
              requireTLS: !config.secure,
            }),
    },
    TemporaryCredentialMailService,
    { provide: TEMPORARY_CREDENTIAL_MAILER, useExisting: TemporaryCredentialMailService },
  ],
  exports: [TEMPORARY_CREDENTIAL_MAILER],
})
export class EmailModule {}
