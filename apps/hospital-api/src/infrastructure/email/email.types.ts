export type MailTransportMode = 'smtp' | 'json';

export type MailConfig = {
  mode: MailTransportMode;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export type TemporaryCredentialMessage = {
  to: string;
  fullName: string;
  username: string;
  temporaryPassword: string;
};

export interface TemporaryCredentialMailerPort {
  sendTemporaryPassword(message: TemporaryCredentialMessage): Promise<void>;
}
